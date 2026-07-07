import {
  clearBootCaches,
  isStaleChunkLoadError,
  reloadWithCacheBuster,
  recoverFromStaleChunkLoadError,
  renderBootFailure,
} from './bootRecovery.js';

const screenButton = (label) =>
  Array.from(document.querySelectorAll('button')).find((button) => button.textContent === label);

describe('bootRecovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
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

    expect(document.body).toHaveTextContent('A new version of Context Engine is available');
    expect(document.body).toHaveTextContent('Reloading clears cached app data and loads the latest version.');
    expect(document.body).not.toHaveTextContent('stale app chunk');
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')).toHaveAttribute('data-boot-error', 'stale app chunk');
    expect(document.querySelectorAll('button')).toHaveLength(1);
    expect(document.querySelector('button')).toHaveTextContent('Reload');

    document.querySelector('button').click();
    await Promise.resolve();

    expect(clearCaches).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clears cached app data before reloading when requested', async () => {
    const reload = jest.fn();
    const clearCaches = jest.fn().mockResolvedValue(undefined);

    renderBootFailure('module import failed', {
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

  it('still auto-reloads the visible fallback when the boot reload URL marker is present', async () => {
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

    expect(document.body).toHaveTextContent('Reloading and clearing cached app data in 3s...');
    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(clearCaches).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
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

  it('clears storage and Cache API entries on a best-effort basis', async () => {
    const fakeWindow = {
      localStorage: { clear: jest.fn() },
      sessionStorage: { clear: jest.fn() },
      caches: {
        keys: jest.fn().mockResolvedValue(['app-v1', 'app-v2']),
        delete: jest.fn().mockResolvedValue(true),
      },
    };

    await clearBootCaches(fakeWindow);

    expect(fakeWindow.localStorage.clear).toHaveBeenCalledTimes(1);
    expect(fakeWindow.sessionStorage.clear).toHaveBeenCalledTimes(1);
    expect(fakeWindow.caches.keys).toHaveBeenCalledTimes(1);
    expect(fakeWindow.caches.delete).toHaveBeenCalledWith('app-v1');
    expect(fakeWindow.caches.delete).toHaveBeenCalledWith('app-v2');
  });

  it('recognizes stale chunk MIME errors from SPA fallback HTML responses', () => {
    expect(isStaleChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isStaleChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isStaleChunkLoadError(new Error('Kaboom'))).toBe(false);
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
    expect(reload).not.toHaveBeenCalled();
  });
});
