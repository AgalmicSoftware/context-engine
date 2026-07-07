const BOOT_RELOAD_PARAM = 'ceBootReload';
const STALE_CHUNK_RELOAD_PARAM = 'ceChunkReload';
export const STALE_CHUNK_RELOAD_STORAGE_KEY = 'ce:staleChunkReloadAttempted:v20260618b';

type BootStorage = {
  clear?: () => void;
  getItem?: (key: string) => string | null;
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

type BootWindow = {
  caches?: BootCacheApi;
  localStorage?: BootStorage;
  location?: BootLocation;
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
    message.includes('importing a module script failed') ||
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
    win?.localStorage?.clear?.();
  } catch {
    // Best-effort cleanup for broken cached app state.
  }

  try {
    win?.sessionStorage?.clear?.();
  } catch {
    // Best-effort cleanup for broken cached app state.
  }

  try {
    const cacheApi = win?.caches;
    const listCaches = cacheApi?.keys;
    const deleteCache = cacheApi?.delete;
    if (listCaches && deleteCache) {
      const cacheNames = await listCaches();
      await Promise.all(cacheNames.map((cacheName) => deleteCache(cacheName)));
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

export const recoverFromStaleChunkLoadError = (error: unknown, options: BootRecoveryOptions = {}): boolean => {
  if (!isStaleChunkLoadError(error)) {
    return false;
  }

  const win = options.window || globalThis.window;
  const storage = options.storage || win?.sessionStorage;
  const storageKey = options.storageKey || STALE_CHUNK_RELOAD_STORAGE_KEY;
  const reloadParam = options.reloadParam || STALE_CHUNK_RELOAD_PARAM;
  const reload = options.reload || (() => reloadWithCacheBuster(win, reloadParam));

  let alreadyAttempted = hasReloadParam(win, reloadParam);
  try {
    alreadyAttempted = alreadyAttempted || storage?.getItem?.(storageKey) === 'true';
  } catch {
    // URL param guard above still prevents reload loops when storage is unavailable.
  }
  if (alreadyAttempted) {
    return false;
  }

  try {
    storage?.setItem?.(storageKey, 'true');
  } catch {
    // Best-effort loop guard; reloadWithCacheBuster also marks the URL.
  }
  reload();
  return true;
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
      'border:1px solid rgba(147,170,255,0.55)',
      'border-radius:10px',
      'background:#2f67d3',
      'color:#f6f8ff',
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

  const reloadParam = options.reloadParam || BOOT_RELOAD_PARAM;
  const reload = options.reload || (() => reloadWithCacheBuster(win, reloadParam));
  const clearCaches = options.clearCaches || (() => clearBootCaches(win));
  const autoReloadDelayMs = typeof options.autoRefreshDelayMs === 'number' ? options.autoRefreshDelayMs : 3000;
  let refreshStarted = false;
  const refresh = async (button: HTMLButtonElement | null) => {
    if (refreshStarted) return;
    refreshStarted = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Refreshing...';
    }
    try {
      await clearCaches();
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
      'background:#202252',
      'color:#f6f8ff',
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
      'border:1px solid rgba(147,170,255,0.32)',
      'border-radius:18px',
      'background:rgba(33,36,90,0.92)',
      'box-shadow:0 24px 70px rgba(0,0,0,0.28)',
      'padding:32px',
    ].join(';'),
  );

  appendTextNode(
    doc,
    panel,
    'h1',
    'A new version of Context Engine is available',
    'margin:0 0 14px;font-size:28px;line-height:1.15;font-weight:800',
  );
  appendTextNode(
    doc,
    panel,
    'p',
    'Reloading clears cached app data and loads the latest version.',
    'margin:0 0 20px;color:#d7dbff;font-size:17px;line-height:1.45',
  );
  const countdownNode = appendTextNode(
    doc,
    panel,
    'p',
    '',
    'margin:0 0 20px;color:#f6f8ff;font-size:15px;font-weight:700;line-height:1.35',
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
