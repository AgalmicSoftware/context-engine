const BOOT_RELOAD_PARAM = 'ceBootReload';
const STALE_CHUNK_RELOAD_PARAM = 'ceChunkReload';
// Set by an automatic reload and cleared once a primary route commits.
export const STALE_CHUNK_RELOAD_STORAGE_KEY = 'ce:staleChunkReloadAttempted:v20260618b';
// Time of the last automatic reload. Route commits keep it, so a chunk that fails on
// every load reloads at most once per window instead of looping.
export const STALE_CHUNK_RELOAD_AT_STORAGE_KEY = 'ce:staleChunkReloadAt:v20261011';
export const STALE_CHUNK_RELOAD_WINDOW_MS = 60_000;
const STALE_ASSET_REFRESH_TIMEOUT_MS = 2000;
const MAX_STALE_ASSET_URLS = 4;
const STALE_ASSET_URL_RE = /(?:https?:\/\/[^\s'"<>]+|\/[^\s'"<>]+)\.(?:css|m?js)\b/gi;

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
  history?: BootHistory;
  localStorage?: BootStorage;
  location?: BootLocation;
  navigator?: { onLine?: boolean };
  sessionStorage?: BootStorage;
  setTimeout?: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => unknown;
};

type BootFetch = (
  url: string,
  init: { cache: 'reload'; credentials: 'same-origin'; signal?: AbortSignal },
) => Promise<{ arrayBuffer?: () => Promise<unknown> }>;

type BootRecoveryOptions = {
  autoRefreshDelayMs?: number;
  clearCaches?: () => Promise<void> | void;
  document?: Document;
  fetchImpl?: BootFetch;
  refreshTimeoutMs?: number;
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
  // A primary route committed, so drop the boot-loop flag. The automatic-reload time
  // stays as the loop guard; without session storage the URL marker is that guard.
  let storageAvailable = false;
  try {
    storageAvailable = !!win?.sessionStorage;
    win?.sessionStorage?.removeItem?.(STALE_CHUNK_RELOAD_STORAGE_KEY);
  } catch {
    storageAvailable = false;
  }

  return storageAvailable ? clearBootReloadMarker(win, STALE_CHUNK_RELOAD_PARAM) : false;
};

// Same-origin JS and CSS URLs named in a chunk-load error, such as Vite's
// "Unable to preload CSS for /assets/x.css" or Chrome's dynamic import message.
export const readStaleChunkAssetUrls = (error: unknown, win: BootWindow | undefined = globalThis.window): string[] => {
  const href = win?.location?.href;
  if (!href) return [];
  const urls = new Set<string>();
  const text = `${readErrorField(error, 'message')}\n${typeof error === 'string' ? error : ''}`;
  for (const match of text.match(STALE_ASSET_URL_RE) || []) {
    try {
      const url = new URL(match, href);
      if (url.origin === new URL(href).origin) urls.add(url.href);
    } catch {
      // Ignore text that only looks like a URL.
    }
  }
  return [...urls].slice(0, MAX_STALE_ASSET_URLS);
};

// A missing chunk can be cached as SPA HTML or a 404 with the year-long asset header,
// and a page reload does not revalidate subresources. Refetching with cache: 'reload'
// replaces that entry. Best effort and bounded: callers reload either way.
export const refreshStaleChunkAssets = async (urls: string[], options: BootRecoveryOptions = {}): Promise<void> => {
  const fetchImpl =
    options.fetchImpl ||
    (typeof globalThis.fetch === 'function' ? (url: string, init: RequestInit) => globalThis.fetch(url, init) : null);
  if (!urls.length || !fetchImpl) return;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller?.abort();
      resolve();
    }, options.refreshTimeoutMs ?? STALE_ASSET_REFRESH_TIMEOUT_MS);
  });
  const refreshes = Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetchImpl(url, {
        cache: 'reload',
        credentials: 'same-origin',
        signal: controller?.signal,
      });
      await response.arrayBuffer?.();
    }),
  );
  try {
    await Promise.race([refreshes, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const refreshThenReload = (
  error: unknown,
  win: BootWindow | undefined,
  reload: () => void,
  options: BootRecoveryOptions,
) => {
  const urls = readStaleChunkAssetUrls(error, win);
  if (!urls.length) {
    reload();
    return;
  }
  void refreshStaleChunkAssets(urls, options).then(reload, reload);
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

  const storage = options.storage || win?.sessionStorage;
  const storageKey = options.storageKey || STALE_CHUNK_RELOAD_STORAGE_KEY;
  const reloadParam = options.reloadParam || STALE_CHUNK_RELOAD_PARAM;
  const reload = options.reload || (() => reloadWithCacheBuster(win, reloadParam));
  const now = Date.now();

  // Regression guard: at most one automatic reload per window, even after a route
  // commits; within it the error boundary stays up and "Try again" reloads by hand.
  if (hasReloadParam(win, reloadParam) || wasRecentlyAutoReloaded(storage, storageKey, now)) {
    return false;
  }

  try {
    storage?.setItem?.(storageKey, 'true');
    storage?.setItem?.(STALE_CHUNK_RELOAD_AT_STORAGE_KEY, String(now));
  } catch {
    // Best-effort loop guard; reloadWithCacheBuster also marks the URL.
  }
  refreshThenReload(error, win, reload, options);
  return true;
};

// React.lazy caches a rejected chunk import, so only a fresh page load can pick up a
// newer deploy. Callers use this for an explicit user action, so no window applies.
export const reloadForStaleChunk = (error?: unknown, options: BootRecoveryOptions = {}): void => {
  const win = options.window || globalThis.window;
  refreshThenReload(
    error,
    win,
    options.reload || (() => reloadWithCacheBuster(win, STALE_CHUNK_RELOAD_PARAM)),
    options,
  );
};

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
      if (staleChunk) {
        await clearCaches();
        const staleAssetUrls = readStaleChunkAssetUrls(error, win);
        if (staleAssetUrls.length) await refreshStaleChunkAssets(staleAssetUrls, options);
      }
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
