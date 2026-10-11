import {
  STALE_CHUNK_RELOAD_WINDOW_MS,
  clearBootReloadMarker,
  clearBootCaches,
  clearStaleChunkReloadMarker,
  isStaleChunkLoadError,
  reloadForStaleChunk,
  reloadWithCacheBuster,
  recoverFromStaleChunkLoadError,
  renderBootFailure,
} from './bootRecovery.js';

const createMemoryStorage = () => {
  const values = new Map();
  return {
    getItem: jest.fn((key) => (values.has(key) ? values.get(key) : null)),
    setItem: jest.fn((key, value) => values.set(key, String(value))),
    removeItem: jest.fn((key) => values.delete(key)),
  };
};

const screenButton = (label) =>
  Array.from(document.querySelectorAll('button')).find((button) => button.textContent === label);

describe('bootRecovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears only the entry-module boot marker without dropping other recovery state', () => {
    const replaceState = jest.fn();
    const removeItem = jest.fn();
    const historyState = { idx: 2, usr: { from: 'docs' } };
    const fakeWindow = {
      history: { replaceState, state: historyState },
      location: {
        href: 'https://contextengine.example.test/ce/docs?ceBootReload=123&ceChunkReload=456&session=alpha#guide',
      },
      sessionStorage: { clear: jest.fn(), removeItem },
    };

    expect(clearBootReloadMarker(fakeWindow)).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(historyState, '', '/ce/docs?ceChunkReload=456&session=alpha#guide');
    expect(removeItem).not.toHaveBeenCalled();
    expect(fakeWindow.sessionStorage.clear).not.toHaveBeenCalled();
  });

  it('clears stale-chunk recovery state only after a primary route commits', () => {
    const replaceState = jest.fn();
    const historyState = { idx: 2 };
    const sessionStorage = { ...createMemoryStorage(), clear: jest.fn() };
    const fakeWindow = {
      history: { replaceState, state: historyState },
      location: {
        href: 'https://contextengine.example.test/docs?ceBootReload=123&ceChunkReload=456&session=alpha#guide',
      },
      sessionStorage,
    };

    expect(clearStaleChunkReloadMarker(fakeWindow)).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(historyState, '', '/docs?ceBootReload=123&session=alpha#guide');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('ce:staleChunkReloadAttempted:v20260618b');
    // The marked reload time moves into storage before the URL marker goes away.
    expect(sessionStorage.getItem('ce:staleChunkReloadAt:v20261011')).toBe('456');
    expect(sessionStorage.clear).not.toHaveBeenCalled();
  });

  it('clears only the stale-chunk sentinel when its URL marker is absent', () => {
    const replaceState = jest.fn();
    const removeItem = jest.fn();
    const fakeWindow = {
      history: { replaceState },
      location: { href: 'https://contextengine.example.test/docs?session=alpha' },
      sessionStorage: { clear: jest.fn(), removeItem },
    };

    expect(clearStaleChunkReloadMarker(fakeWindow)).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith('ce:staleChunkReloadAttempted:v20260618b');
    expect(fakeWindow.sessionStorage.clear).not.toHaveBeenCalled();
  });

  it('renders a visible startup failure instead of leaving the root blank', async () => {
    const reload = jest.fn();
    const clearCaches = jest.fn().mockResolvedValue(undefined);

    expect(
      renderBootFailure(new Error('stale app chunk'), {
        reload,
        clearCaches,
        autoRefreshDelayMs: -1,
      }),
    ).toBe(true);

    expect(document.body).toHaveTextContent('Context Engine could not start');
    expect(document.body).toHaveTextContent('Your drafts and settings will be preserved.');
    expect(document.body).not.toHaveTextContent('stale app chunk');
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')).toHaveAttribute('data-boot-error', 'stale app chunk');
    expect(document.querySelector('h1')).toHaveAttribute(
      'style',
      expect.stringContaining('color:var(--ce-panel-text,CanvasText)'),
    );
    expect(document.querySelectorAll('button')).toHaveLength(1);
    expect(document.querySelector('button')).toHaveTextContent('Reload');

    document.querySelector('button').click();
    await Promise.resolve();

    expect(clearCaches).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clears cached app data before reloading when requested', async () => {
    const reload = jest.fn();
    const clearCaches = jest.fn().mockResolvedValue(undefined);

    renderBootFailure('Failed to fetch dynamically imported module', {
      reload,
      clearCaches,
      autoRefreshDelayMs: -1,
    });

    const refreshButton = screenButton('Reload');
    refreshButton.click();
    await Promise.resolve();

    expect(clearCaches).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders a countdown and automatically clears cached app data before reloading', async () => {
    jest.useFakeTimers();
    const reload = jest.fn();
    const clearCaches = jest.fn().mockResolvedValue(undefined);

    renderBootFailure(new TypeError("'text/html' is not a valid JavaScript MIME type."), {
      reload,
      clearCaches,
    });

    expect(document.body).toHaveTextContent('A new version of Context Engine is available');
    expect(document.querySelectorAll('button')).toHaveLength(1);
    expect(document.querySelector('button')).toHaveTextContent('Reload');
    expect(document.body).toHaveTextContent('Reloading and clearing cached app data in 3s...');
    expect(clearCaches).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(document.body).toHaveTextContent('Reloading and clearing cached app data in 2s...');
    jest.advanceTimersByTime(1000);
    expect(document.body).toHaveTextContent('Reloading and clearing cached app data in 1s...');
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(clearCaches).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stops automatic retries when the boot reload URL marker is already present', async () => {
    jest.useFakeTimers();
    const reload = jest.fn();
    const clearCaches = jest.fn().mockResolvedValue(undefined);
    const fakeWindow = {
      location: {
        href: 'https://contextengine.xyz/?ceBootReload=123',
      },
      setTimeout,
    };

    renderBootFailure(new Error('still failing'), {
      window: fakeWindow,
      clearCaches,
      reload,
    });

    expect(document.body).toHaveTextContent(
      'Automatic reload paused after the previous attempt. Fix the startup issue, then select Reload.',
    );
    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(clearCaches).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('returns false when there is no root node to recover into', () => {
    document.body.innerHTML = '';

    expect(renderBootFailure(new Error('missing root'))).toBe(false);
  });

  it('reloads through a cache-busted URL', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123456);
    const assign = jest.fn();
    const fakeWindow = {
      location: {
        href: 'http://localhost:3000/session/demo-1?existing=1',
        assign,
      },
    };

    reloadWithCacheBuster(fakeWindow);

    expect(assign).toHaveBeenCalledWith('http://localhost:3000/session/demo-1?existing=1&ceBootReload=123456');

    Date.now.mockRestore();
  });

  it('clears Cache API entries while preserving drafts, settings, and recovery sentinels', async () => {
    const fakeWindow = {
      localStorage: { clear: jest.fn() },
      sessionStorage: { clear: jest.fn() },
      caches: {
        keys: jest.fn(function () {
          expect(this).toBe(fakeWindow.caches);
          return Promise.resolve(['app-v1', 'app-v2']);
        }),
        delete: jest.fn(function () {
          expect(this).toBe(fakeWindow.caches);
          return Promise.resolve(true);
        }),
      },
    };

    await clearBootCaches(fakeWindow);

    expect(fakeWindow.localStorage.clear).not.toHaveBeenCalled();
    expect(fakeWindow.sessionStorage.clear).not.toHaveBeenCalled();
    expect(fakeWindow.caches.keys).toHaveBeenCalledTimes(1);
    expect(fakeWindow.caches.delete).toHaveBeenCalledWith('app-v1');
    expect(fakeWindow.caches.delete).toHaveBeenCalledWith('app-v2');
  });

  it('recognizes stale chunk MIME errors from SPA fallback HTML responses', () => {
    expect(isStaleChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isStaleChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isStaleChunkLoadError(new Error('Kaboom'))).toBe(false);
  });

  it('recognizes Vite CSS preload and Firefox dynamic import failures as stale chunks', () => {
    expect(isStaleChunkLoadError(new Error('Unable to preload CSS for /assets/OnePageSession-00000000.css'))).toBe(
      true,
    );
    expect(
      isStaleChunkLoadError(
        new TypeError('error loading dynamically imported module: https://app.example.test/assets/Report-00000000.js'),
      ),
    ).toBe(true);
  });

  it('leaves an offline chunk failure to the error boundary instead of reloading', () => {
    const reload = jest.fn();
    const storage = createMemoryStorage();
    const fakeWindow = {
      location: { href: 'https://app.example.test/session/alpha' },
      navigator: { onLine: false },
      sessionStorage: storage,
    };

    expect(
      recoverFromStaleChunkLoadError(new TypeError('Failed to fetch dynamically imported module'), {
        window: fakeWindow,
        storage,
        reload,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('reloads automatically at most once per window, even after the reloaded route commits', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const reload = jest.fn();
    const storage = createMemoryStorage();
    const fakeWindow = {
      history: { replaceState: jest.fn() },
      location: { href: 'https://app.example.test/session/alpha' },
      sessionStorage: storage,
    };
    const recover = (chunk) =>
      recoverFromStaleChunkLoadError(
        new TypeError(`Failed to fetch dynamically imported module: https://app.example.test/assets/${chunk}.js`),
        { window: fakeWindow, storage, reload },
      );

    try {
      expect(recover('First-1')).toBe(true);
      // The reloaded page commits its route, then another chunk fails.
      clearStaleChunkReloadMarker(fakeWindow);
      now.mockReturnValue(1_000_000 + STALE_CHUNK_RELOAD_WINDOW_MS - 1);
      expect(recover('Second-2')).toBe(false);
      now.mockReturnValue(1_000_000 + STALE_CHUNK_RELOAD_WINDOW_MS);
      expect(recover('Second-2')).toBe(true);
      expect(reload).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });

  it('never reloads automatically twice in one tab for the same failure', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const reload = jest.fn();
    const storage = createMemoryStorage();
    const fakeWindow = {
      history: { replaceState: jest.fn() },
      location: { href: 'https://app.example.test/session/alpha' },
      sessionStorage: storage,
    };
    const recover = (message) =>
      recoverFromStaleChunkLoadError(new TypeError(message), { window: fakeWindow, storage, reload });
    const blocked = 'Failed to fetch dynamically imported module: https://app.example.test/assets/Blocked-1.js';

    try {
      expect(recover(blocked)).toBe(true);
      clearStaleChunkReloadMarker(fakeWindow);
      // Long after the window, a content blocker keeps failing the same chunk.
      now.mockReturnValue(1_000_000 + 10 * STALE_CHUNK_RELOAD_WINDOW_MS);
      expect(recover(blocked)).toBe(false);
      expect(recover('Failed to fetch dynamically imported module: https://app.example.test/assets/Other-2.js')).toBe(
        true,
      );
      expect(reload).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });

  describe('when a deploy changes the running build', () => {
    // One tab whose session storage survives reloads; each reload lands on the live build.
    const createTab = (entry) => {
      const storage = createMemoryStorage();
      const reload = jest.fn();
      const fakeWindow = {
        document,
        history: {
          replaceState: jest.fn((state, title, url) => {
            fakeWindow.location.href = new URL(url, fakeWindow.location.href).href;
          }),
        },
        location: { href: 'https://app.example.test/session/alpha' },
        sessionStorage: storage,
      };
      const runBuild = (src) => {
        document.head.innerHTML = `<script type="module" crossorigin src="${src}"></script>`;
      };
      runBuild(entry);
      return {
        reload,
        fail: (message) => recoverFromStaleChunkLoadError(new TypeError(message), { window: fakeWindow, reload }),
        reloadInto: (src) => {
          runBuild(src);
          fakeWindow.location.href = 'https://app.example.test/session/alpha?ceChunkReload=123';
          clearStaleChunkReloadMarker(fakeWindow);
        },
      };
    };
    const HOUR_MS = 60 * 60 * 1000;
    let now;

    beforeEach(() => {
      now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    });

    afterEach(() => {
      now.mockRestore();
      document.head.innerHTML = '';
    });

    it('reloads once per deploy for a WebKit failure that names no chunk', () => {
      const webkitFailure = 'Importing a module script failed.';
      const tab = createTab('/assets/index-aaaa1111.js');

      expect(tab.fail(webkitFailure)).toBe(true);
      tab.reloadInto('/assets/index-bbbb2222.js');
      // A day later another deploy lands while the tab stays open.
      now.mockReturnValue(1_000_000 + 26 * HOUR_MS);
      expect(tab.fail(webkitFailure)).toBe(true);
      // No new deploy this time, so the same failure in the same build shows the panel.
      tab.reloadInto('/assets/index-bbbb2222.js');
      now.mockReturnValue(1_000_000 + 27 * HOUR_MS);
      expect(tab.fail(webkitFailure)).toBe(false);
      expect(tab.reload).toHaveBeenCalledTimes(2);
    });

    it('reloads again for a chunk that failed before a rollback and a fix-forward', () => {
      const chunkFailure = (chunk) =>
        `Failed to fetch dynamically imported module: https://app.example.test/assets/${chunk}.js`;
      const tab = createTab('/assets/index-aaaa1111.js');

      expect(tab.fail(chunkFailure('Route-aaaa1111'))).toBe(true);
      tab.reloadInto('/assets/index-bbbb2222.js');
      now.mockReturnValue(1_000_000 + HOUR_MS);
      expect(tab.fail(chunkFailure('Other-bbbb2222'))).toBe(true);
      // The rollback serves the first build again; a fix-forward then replaces its route chunk.
      tab.reloadInto('/assets/index-aaaa1111.js');
      now.mockReturnValue(1_000_000 + 2 * HOUR_MS);
      expect(tab.fail(chunkFailure('Route-aaaa1111'))).toBe(true);
      expect(tab.reload).toHaveBeenCalledTimes(3);
    });
  });

  it('keeps the URL marker as the loop guard when session storage is unavailable', () => {
    const replaceState = jest.fn();
    const fakeWindow = {
      history: { replaceState },
      location: { href: 'https://app.example.test/session/alpha?ceChunkReload=123' },
    };
    Object.defineProperty(fakeWindow, 'sessionStorage', {
      get() {
        throw new Error('Storage is disabled');
      },
    });

    expect(clearStaleChunkReloadMarker(fakeWindow)).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('keeps the reload marker as the guard when session storage cannot save the reload time', () => {
    const reload = jest.fn();
    const storage = {
      getItem: jest.fn(() => null),
      removeItem: jest.fn(),
      setItem: jest.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    };
    const fakeWindow = {
      history: { replaceState: jest.fn() },
      location: { href: 'https://app.example.test/session/alpha' },
      sessionStorage: storage,
    };
    const recover = () =>
      recoverFromStaleChunkLoadError(new TypeError('Failed to fetch dynamically imported module'), {
        window: fakeWindow,
        reload,
      });

    expect(recover()).toBe(true);
    // The reload lands on the marked URL and its route commits.
    fakeWindow.location.href = 'https://app.example.test/session/alpha?ceChunkReload=123';
    expect(clearStaleChunkReloadMarker(fakeWindow)).toBe(false);
    expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
    expect(recover()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('recovers without throwing when reading session storage throws', () => {
    const reload = jest.fn();
    const fakeWindow = {
      history: { replaceState: jest.fn() },
      location: { href: 'https://app.example.test/session/alpha' },
    };
    Object.defineProperty(fakeWindow, 'sessionStorage', {
      get() {
        throw new Error('SecurityError: site data is blocked');
      },
    });
    const recover = () =>
      recoverFromStaleChunkLoadError(new TypeError('Failed to fetch dynamically imported module'), {
        window: fakeWindow,
        reload,
      });

    expect(recover()).toBe(true);
    fakeWindow.location.href = 'https://app.example.test/session/alpha?ceChunkReload=123';
    expect(clearStaleChunkReloadMarker(fakeWindow)).toBe(false);
    expect(recover()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads a stale route through the chunk recovery marker', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123456);
    const assign = jest.fn();

    reloadForStaleChunk({ location: { href: 'http://localhost:3000/session/demo-1?existing=1', assign } });

    expect(assign).toHaveBeenCalledWith('http://localhost:3000/session/demo-1?existing=1&ceChunkReload=123456');
    Date.now.mockRestore();
  });

  it('recovers from stale chunk errors with a single cache-busted reload', () => {
    const reload = jest.fn();
    const storage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    };
    const fakeWindow = {
      location: {
        href: 'https://contextengine.xyz/about',
      },
      sessionStorage: storage,
    };

    expect(
      recoverFromStaleChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type."), {
        window: fakeWindow,
        storage,
        reload,
      }),
    ).toBe(true);

    expect(storage.setItem).toHaveBeenCalledWith('ce:staleChunkReloadAttempted:v20260618b', 'true');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not loop stale chunk recovery after a prior reload attempt', () => {
    const reload = jest.fn();
    const storage = {
      getItem: jest.fn(() => 'true'),
      removeItem: jest.fn(),
      setItem: jest.fn(),
    };
    const fakeWindow = {
      location: {
        href: 'https://contextengine.xyz/about?ceChunkReload=123',
      },
      sessionStorage: storage,
    };

    expect(
      recoverFromStaleChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type."), {
        window: fakeWindow,
        storage,
        reload,
      }),
    ).toBe(false);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

for (const error of [new Error('configuration missing'), new TypeError('Cannot read properties of undefined')]) {
  it(`preserves browser state and uses a plain manual reload for ${error.message}`, async () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="root"></div>';
    const fakeWindow = {
      location: { href: 'https://app.example/session/fixture?draft=1#question', reload: jest.fn(), assign: jest.fn() },
      localStorage: { clear: jest.fn() },
      sessionStorage: { clear: jest.fn() },
      caches: { keys: jest.fn(), delete: jest.fn() },
      setTimeout,
    };
    renderBootFailure(error, { window: fakeWindow });
    jest.advanceTimersByTime(10000);
    expect(fakeWindow.location.reload).not.toHaveBeenCalled();
    screenButton('Reload').click();
    await Promise.resolve();
    expect(fakeWindow.location.reload).toHaveBeenCalledTimes(1);
    expect(fakeWindow.location.assign).not.toHaveBeenCalled();
    expect(fakeWindow.localStorage.clear).not.toHaveBeenCalled();
    expect(fakeWindow.sessionStorage.clear).not.toHaveBeenCalled();
    expect(fakeWindow.caches.keys).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
}
