import { clearTokenCache, readTokenCache, writeTokenCache } from './workerAuthTokenCache';

const CACHE_KEY = 'ce:workerToken:v1:https://worker.example:edge:0x00000000000000000000000000000000000000aa';

describe('workerAuthTokenCache', () => {
  afterEach(() => {
    clearTokenCache(CACHE_KEY);
    localStorage.clear();
  });

  it('reads cached tokens from page memory without a storage call per read', () => {
    writeTokenCache(CACHE_KEY, { token: 'memory-token' });
    localStorage.setItem(CACHE_KEY, JSON.stringify({ token: 'persisted-token' }));
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem');

    try {
      expect(readTokenCache(CACHE_KEY)).toEqual({ token: 'memory-token' });
      expect(readTokenCache(CACHE_KEY)).toEqual({ token: 'memory-token' });
      expect(removeItem).not.toHaveBeenCalled();
    } finally {
      removeItem.mockRestore();
    }
  });

  it('never treats a record persisted by an older tab as a cached token', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ token: 'persisted-token' }));

    expect(readTokenCache(CACHE_KEY)).toBeNull();
    clearTokenCache(CACHE_KEY);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });
});
