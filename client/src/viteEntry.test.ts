import { STALE_CHUNK_RELOAD_STORAGE_KEY } from './bootRecovery';

jest.mock('./index', () => ({}));

describe('viteEntry', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('leaves a failed preload to retry helpers and error boundaries instead of reloading', async () => {
    jest.isolateModules(() => {
      require('./viteEntry');
    });
    await Promise.resolve();

    const preloadError = Object.assign(new Event('vite:preloadError', { cancelable: true }), {
      payload: new Error('Unable to preload CSS for /assets/OnePageSession-00000000.css'),
    });
    window.dispatchEvent(preloadError);

    expect(window.sessionStorage.getItem(STALE_CHUNK_RELOAD_STORAGE_KEY)).toBeNull();
    expect(preloadError.defaultPrevented).toBe(false);
  });
});
