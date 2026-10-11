const BOOT_RELOAD_PARAM = 'ceBootReload';
const STALE_CHUNK_RELOAD_PARAM = 'ceChunkReload';
// Set by an automatic reload and cleared once a primary route commits.
export const STALE_CHUNK_RELOAD_STORAGE_KEY = 'ce:staleChunkReloadAttempted:v20260618b';
// Time of the last automatic reload. Route commits keep it, so a chunk that fails on
// every load reloads at most once per window instead of looping.
export const STALE_CHUNK_RELOAD_AT_STORAGE_KEY = 'ce:staleChunkReloadAt:v20261011';
export const STALE_CHUNK_RELOAD_WINDOW_MS = 60_000;
// Failures that already caused an automatic reload in this tab, for the build that was
// running. One that comes back in that build, for example a chunk a content blocker
// always blocks, shows the error panel instead; a new deploy starts a new list.
const STALE_CHUNK_RELOADED_FAILURES_STORAGE_KEY = 'ce:staleChunkReloadedFailures:v20261011';
const MAX_REMEMBERED_RELOAD_FAILURES = 20;

type BootStorage = {
  clear?: () => void;
  getItem?: (key: string) => string | null;
  removeItem?: (key: string) => void;
  setItem?: (key: string, value: string) => void;
};

type BootCacheApi = {
  keys?: () => Promise<string[]>;
  delete?: (cacheName: string) => Promise<boolean> | boolean;
};

type BootLocation = {
  href: string;
  assign?: (url: string) => void;
  reload?: () => void;
};

type BootHistory = {
  replaceState?: (data: unknown, unused: string, url?: string | URL | null) => void;
  state?: unknown;
};

type BootWindow = {
  caches?: BootCacheApi;
  document?: Pick<Document, 'querySelector'>;
  history?: BootHistory;
  localStorage?: BootStorage;
  location?: BootLocation;
  navigator?: { onLine?: boolean };
  sessionStorage?: BootStorage;
  setTimeout?: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => unknown;
};

type BootRecoveryOptions = {
  autoRefreshDelayMs?: number;
  clearCaches?: () => Promise<void> | void;
  document?: Document;
  reload?: () => void;
  reloadParam?: string;
  root?: HTMLElement | null;
  storage?: BootStorage;
  storageKey?: string;
  window?: BootWindow;
};

const readErrorField = (error: unknown, key: 'name' | 'message' | 'stack'): string => {
  if (!error || typeof error !== 'object') return '';
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
};

export const isStaleChunkLoadError = (error: unknown): boolean => {
  const message = [
    readErrorField(error, 'name'),
    readErrorField(error, 'message'),
    readErrorField(error, 'stack'),
    String(error || ''),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  return (
    message.includes('not a valid javascript mime type') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('unable to preload css') ||
    message.includes('chunkloaderror') ||
    (message.includes('loading chunk') && message.includes('failed'))
  );
};

export const getBootErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const message = String(error || '').trim();
  return message || 'Unknown startup error';
};

export const clearBootCaches = async (win: BootWindow = globalThis.window): Promise<void> => {
  try {
    const cacheApi = win?.caches;
    const listCaches = cacheApi?.keys;
    const deleteCache = cacheApi?.delete;
    if (listCaches && deleteCache) {
      const cacheNames = await listCaches.call(cacheApi);
      await Promise.all(cacheNames.map((cacheName) => deleteCache.call(cacheApi, cacheName)));
    }
  } catch {
    // Cache API can be unavailable or permission-blocked in embedded browsers.
  }
};

export const reloadWithCacheBuster = (win: BootWindow = globalThis.window, reloadParam = BOOT_RELOAD_PARAM): void => {
  if (!win?.location) {
    return;
  }

  try {
    const location = win.location;
    const url = new URL(location.href);
    url.searchParams.set(reloadParam, String(Date.now()));
    if (!location.assign) throw new Error('Navigation assignment is unavailable.');
    location.assign(url.toString());
    return;
  } catch {
    // Fall back to a plain reload when URL parsing or navigation assignment fails.
  }

  win.location.reload?.();
};

const hasReloadParam = (win: BootWindow, reloadParam: string): boolean => {
  try {
    return win.location ? new URL(win.location.href).searchParams.has(reloadParam) : false;
  } catch {
    return false;
  }
};

// Reading window.sessionStorage itself throws when site data is blocked.
const readSessionStorage = (win: BootWindow | undefined): BootStorage | undefined => {
  try {
    return win?.sessionStorage;
  } catch {
    return undefined;
  }
};

export const clearBootReloadMarker = (
  win: BootWindow = globalThis.window,
  reloadParam = BOOT_RELOAD_PARAM,
): boolean => {
  if (!win?.location || !win.history?.replaceState) return false;

  try {
    const url = new URL(win.location.href);
    if (!url.searchParams.has(reloadParam)) return false;
    url.searchParams.delete(reloadParam);
    win.history.replaceState(win.history.state ?? null, '', `${url.pathname}${url.search}${url.hash}`);
    return true;
  } catch {
    return false;
  }
};

export const clearStaleChunkReloadMarker = (win: BootWindow = globalThis.window): boolean => {
  // A primary route committed, so drop the boot-loop flag. The reload time is the loop
  // guard from here on; keep the URL marker unless that time reads back from storage.
  const storage = readSessionStorage(win);
  let reloadTimeStored = false;
  try {
    storage?.removeItem?.(STALE_CHUNK_RELOAD_STORAGE_KEY);
    if (!storage?.getItem?.(STALE_CHUNK_RELOAD_AT_STORAGE_KEY)) {
      const markerTime = win?.location ? new URL(win.location.href).searchParams.get(STALE_CHUNK_RELOAD_PARAM) : null;
      if (Number(markerTime) > 0) storage?.setItem?.(STALE_CHUNK_RELOAD_AT_STORAGE_KEY, String(markerTime));
    }
    reloadTimeStored = Number(storage?.getItem?.(STALE_CHUNK_RELOAD_AT_STORAGE_KEY)) > 0;
  } catch {
    reloadTimeStored = false;
  }

  return reloadTimeStored ? clearBootReloadMarker(win, STALE_CHUNK_RELOAD_PARAM) : false;
};

const describeReloadFailure = (error: unknown): string =>
  (readErrorField(error, 'message') || String(error || '')).trim().slice(0, 500);

// The entry script's hashed URL changes when any chunk or stylesheet changes, so it
// names the running build. WebKit's import error names no chunk, so the build is what
// tells two deploys apart.
const readRunningBuild = (win: BootWindow | undefined): string => {
  try {
    return win?.document?.querySelector('script[type="module"][src]')?.getAttribute('src') || '';
  } catch {
    return '';
  }
};

type ReloadedFailures = { build?: unknown; failures?: unknown };

const readReloadedFailures = (storage: BootStorage | undefined, build: string): string[] => {
  try {
    const stored = JSON.parse(
      storage?.getItem?.(STALE_CHUNK_RELOADED_FAILURES_STORAGE_KEY) || 'null',
    ) as ReloadedFailures | null;
    // A list from another build never blocks this one; the next write replaces it.
    if (stored?.build !== build || !Array.isArray(stored.failures)) return [];
    return stored.failures.filter((failure): failure is string => typeof failure === 'string');
  } catch {
    return [];
  }
};

const wasRecentlyAutoReloaded = (storage: BootStorage | undefined, storageKey: string, now: number): boolean => {
  try {
    if (storage?.getItem?.(storageKey) === 'true') return true;
    const elapsedMs = now - Number(storage?.getItem?.(STALE_CHUNK_RELOAD_AT_STORAGE_KEY) || 0);
    return elapsedMs >= 0 && elapsedMs < STALE_CHUNK_RELOAD_WINDOW_MS;
  } catch {
    // The URL marker still guards reload loops when storage is unavailable.
    return false;
  }
};

export const recoverFromStaleChunkLoadError = (error: unknown, options: BootRecoveryOptions = {}): boolean => {
  if (!isStaleChunkLoadError(error)) {
    return false;
  }

  const win = options.window || globalThis.window;
  // Offline failures are transient; a reload would only reach the browser's offline page.
  if (win?.navigator?.onLine === false) return false;

  const storage = options.storage || readSessionStorage(win);
  const storageKey = options.storageKey || STALE_CHUNK_RELOAD_STORAGE_KEY;
  const reloadParam = options.reloadParam || STALE_CHUNK_RELOAD_PARAM;
  const reload = options.reload || (() => reloadWithCacheBuster(win, reloadParam));
  const now = Date.now();

  // Regression guard: at most one automatic reload per window, and never twice in a tab
  // for the same failure in the same build; otherwise the error boundary stays up and
  // reloads on request.
  const build = readRunningBuild(win);
  const failure = describeReloadFailure(error);
  const reloadedFailures = readReloadedFailures(storage, build);
  if (
    hasReloadParam(win, reloadParam) ||
    wasRecentlyAutoReloaded(storage, storageKey, now) ||
    reloadedFailures.includes(failure)
  ) {
    return false;
  }

  try {
    storage?.setItem?.(storageKey, 'true');
    storage?.setItem?.(STALE_CHUNK_RELOAD_AT_STORAGE_KEY, String(now));
    storage?.setItem?.(
      STALE_CHUNK_RELOADED_FAILURES_STORAGE_KEY,
      JSON.stringify({ build, failures: [...reloadedFailures, failure].slice(-MAX_REMEMBERED_RELOAD_FAILURES) }),
    );
  } catch {
    // Best-effort loop guard; reloadWithCacheBuster also marks the URL.
  }
  reload();
  return true;
};

// React.lazy caches a rejected chunk import, so only a fresh page load can pick up a newer deploy.
export const reloadForStaleChunk = (win: BootWindow = globalThis.window): void =>
  reloadWithCacheBuster(win, STALE_CHUNK_RELOAD_PARAM);

const appendTextNode = (
  doc: Document,
  parent: Element,
  tagName: keyof HTMLElementTagNameMap,
  text: string,
  style?: string,
): HTMLElement => {
  const node = doc.createElement(tagName);
  node.textContent = text;
  if (style) {
    node.setAttribute('style', style);
  }
  parent.appendChild(node);
  return node;
};

const appendButton = (doc: Document, parent: Element, label: string, onClick: EventListener): HTMLButtonElement => {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.setAttribute(
    'style',
    [
      'border:var(--ce-border-control-width,2px) solid var(--ce-focus-ring,Highlight)',
      'border-radius:10px',
      'background:var(--ce-action-primary,Highlight)',
      'color:var(--ce-action-primary-text,HighlightText)',
      'cursor:pointer',
      'font:700 16px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'padding:14px 18px',
    ].join(';'),
  );
  button.addEventListener('click', onClick);
  parent.appendChild(button);
  return button;
};

export const renderBootFailure = (error: unknown, options: BootRecoveryOptions = {}): boolean => {
  const doc = options.document || globalThis.document;
  const win = options.window || globalThis.window;
  const root = options.root || doc?.getElementById?.('root');

  if (!doc || !root) {
    return false;
  }

  const staleChunk = isStaleChunkLoadError(error);
  const reloadParam = options.reloadParam || BOOT_RELOAD_PARAM;
  const reload =
    options.reload ||
    (() => {
      if (staleChunk) reloadWithCacheBuster(win, reloadParam);
      else win?.location?.reload?.();
    });
  const clearCaches = options.clearCaches || (() => clearBootCaches(win));
  const requestedAutoReloadDelayMs = typeof options.autoRefreshDelayMs === 'number' ? options.autoRefreshDelayMs : 3000;
  const automaticReloadPaused = hasReloadParam(win, reloadParam);
  const autoReloadDelayMs = !staleChunk || automaticReloadPaused ? -1 : requestedAutoReloadDelayMs;
  let refreshStarted = false;
  const refresh = async (button: HTMLButtonElement | null) => {
    if (refreshStarted) return;
    refreshStarted = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Refreshing...';
    }
    try {
      if (staleChunk) await clearCaches();
    } finally {
      reload();
    }
  };

  root.textContent = '';

  const container = doc.createElement('main');
  container.setAttribute('role', 'alert');
  container.setAttribute('data-boot-error', getBootErrorMessage(error));
  container.setAttribute(
    'style',
    [
      'box-sizing:border-box',
      'min-height:100vh',
      'width:100%',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:var(--ce-surface-raised,Canvas)',
      'color:var(--ce-panel-text,CanvasText)',
      'padding:32px',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';'),
  );

  const panel = doc.createElement('section');
  panel.setAttribute(
    'style',
    [
      'max-width:680px',
      'width:100%',
      'border:var(--ce-border-control-width,2px) solid var(--ce-border-strong,CanvasText)',
      'border-radius:18px',
      'background:var(--ce-surface-raised,Canvas)',
      'box-shadow:var(--ce-shadow-raised,none)',
      'padding:32px',
    ].join(';'),
  );

  appendTextNode(
    doc,
    panel,
    'h1',
    staleChunk ? 'A new version of Context Engine is available' : 'Context Engine could not start',
    'margin:0 0 14px;color:var(--ce-panel-text,CanvasText);font-size:28px;line-height:1.15;font-weight:800',
  );
  appendTextNode(
    doc,
    panel,
    'p',
    staleChunk
      ? 'Reloading clears cached app data and loads the latest version.'
      : 'Reload to try again. Your drafts and settings will be preserved.',
    'margin:0 0 20px;color:var(--ce-panel-text-muted,CanvasText);font-size:17px;line-height:1.45',
  );
  const countdownNode = appendTextNode(
    doc,
    panel,
    'p',
    automaticReloadPaused
      ? 'Automatic reload paused after the previous attempt. Fix the startup issue, then select Reload.'
      : '',
    'margin:0 0 20px;color:var(--ce-panel-text,CanvasText);font-size:15px;font-weight:700;line-height:1.35',
  );

  const actions = doc.createElement('div');
  actions.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:12px');
  const refreshButton = appendButton(doc, actions, 'Reload', () => refresh(refreshButton));
  panel.appendChild(actions);
  container.appendChild(panel);
  root.appendChild(container);

  if (autoReloadDelayMs >= 0) {
    const schedule = win?.setTimeout || globalThis.setTimeout;
    const delaySeconds = Math.max(0, Math.ceil(autoReloadDelayMs / 1000));
    let remainingSeconds = delaySeconds;
    const updateCountdown = () => {
      countdownNode.textContent =
        remainingSeconds > 0
          ? `Reloading and clearing cached app data in ${remainingSeconds}s...`
          : 'Reloading and clearing cached app data...';
    };
    const tick = () => {
      remainingSeconds -= 1;
      updateCountdown();
      if (remainingSeconds > 0) {
        schedule?.(tick, 1000);
      }
    };

    updateCountdown();
    if (delaySeconds > 1) {
      schedule?.(tick, 1000);
    }
    schedule?.(() => {
      refresh(refreshButton);
    }, autoReloadDelayMs);
  }

  return true;
};
