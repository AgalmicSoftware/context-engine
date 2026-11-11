import {
  adoptTokenCaches,
  buildTokenCacheEnvelope,
  clearTokenCache,
  readScopedTokenCache,
  readTokenCache,
  resetTokenCaches,
  writeTokenCache,
} from './workerAuthTokenCache';

const ADDRESS = '0x00000000000000000000000000000000000000aa';
const OTHER = '0x00000000000000000000000000000000000000bb';
const CACHE_KEY = `ce:workerToken:v1:https://worker.example:edge:${ADDRESS}`;
const OTHER_KEY = `ce:workerToken:v1:https://worker.example:edge:${OTHER}`;
const SECOND_KEY = `ce:workerToken:v1:https://worker.example:salon:${ADDRESS}`;

// A reload: the same tab's storage, with page memory starting empty.
const reload = (): typeof import('./workerAuthTokenCache') => {
  let page: typeof import('./workerAuthTokenCache') | undefined;
  jest.isolateModules(() => {
    page = jest.requireActual('./workerAuthTokenCache');
  });
  if (!page) throw new Error('The cache module did not load.');
  return page;
};

describe('workerAuthTokenCache', () => {
  afterEach(() => {
    clearTokenCache(CACHE_KEY);
    localStorage.clear();
    sessionStorage.clear();
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

  it('purges a legacy persisted record when a token for that key is cached', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ token: 'persisted-token' }));

    writeTokenCache(CACHE_KEY, { token: 'memory-token' });

    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(readTokenCache(CACHE_KEY)).toEqual({ token: 'memory-token' });
  });

  it('never treats a record persisted by an older tab as a cached token', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ token: 'persisted-token' }));

    expect(readTokenCache(CACHE_KEY)).toBeNull();
    clearTokenCache(CACHE_KEY);
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('keeps this tab’s sign-ins across a reload once the page knows who is signed in, never in localStorage', () => {
    adoptTokenCaches(ADDRESS);
    writeTokenCache(CACHE_KEY, { token: 'tab-token' });
    expect(Object.keys(localStorage).some((key) => key.startsWith('ce:workerToken:v1:'))).toBe(false);
    const page = reload();
    page.adoptTokenCaches(ADDRESS);
    expect(page.readTokenCache(CACHE_KEY)).toEqual({ token: 'tab-token' });
  });

  it('keeps a sign-in in page memory only until the page knows who is signed in', () => {
    const page = reload();
    page.writeTokenCache(CACHE_KEY, { token: 'early-token' });
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    expect(page.readTokenCache(CACHE_KEY)).toEqual({ token: 'early-token' });
  });

  it('never brings a sign-in back after a sign-out or account switch in another tab', () => {
    adoptTokenCaches(ADDRESS);
    writeTokenCache(CACHE_KEY, { token: 'tab-token' });
    // Another tab's sign-out changes only the storage tabs share; this page keeps its sign-in until it reloads.
    localStorage.setItem('ce:workerSignIns:v1', 'after-another-tab-signed-out');
    expect(readTokenCache(CACHE_KEY)).toEqual({ token: 'tab-token' });
    // One this page makes before it reloads doesn't come back either.
    writeTokenCache(SECOND_KEY, { token: 'unaware-token' });
    const page = reload();
    page.adoptTokenCaches(ADDRESS);
    expect(page.readTokenCache(CACHE_KEY)).toBeNull();
    expect(page.readTokenCache(SECOND_KEY)).toBeNull();
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('ends every saved sign-in when a sign-out can’t store a new generation', () => {
    adoptTokenCaches(ADDRESS);
    writeTokenCache(CACHE_KEY, { token: 'tab-token' });
    // Another tab signed in as the same person keeps this copy in its own sessionStorage.
    const otherTab = String(sessionStorage.getItem(CACHE_KEY));
    const setItem = Storage.prototype.setItem;
    const full = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (this === localStorage) throw new DOMException('Storage is full.', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    try {
      resetTokenCaches('');
    } finally {
      full.mockRestore();
    }
    sessionStorage.setItem(CACHE_KEY, otherTab);
    const page = reload();
    page.adoptTokenCaches(ADDRESS);
    expect(page.readTokenCache(CACHE_KEY)).toBeNull();
  });

  it('keeps signing in from page memory when storage is blocked or full', () => {
    const blocked = () => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    };
    // Typed as just its storage: jest's types can't spy on getters of the whole window.
    const storageHost: { localStorage: Storage; sessionStorage: Storage } = window;
    const spies = [
      jest.spyOn(storageHost, 'localStorage', 'get').mockImplementation(blocked),
      jest.spyOn(storageHost, 'sessionStorage', 'get').mockImplementation(blocked),
    ];
    try {
      adoptTokenCaches(ADDRESS);
      writeTokenCache(CACHE_KEY, { token: 'memory-token' });
      expect(readTokenCache(CACHE_KEY)).toEqual({ token: 'memory-token' });
      resetTokenCaches('');
      expect(readTokenCache(CACHE_KEY)).toBeNull();
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
    const full = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full.', 'QuotaExceededError');
    });
    try {
      adoptTokenCaches(ADDRESS);
      writeTokenCache(CACHE_KEY, { token: 'memory-token' });
      expect(readTokenCache(CACHE_KEY)).toEqual({ token: 'memory-token' });
    } finally {
      full.mockRestore();
    }
  });

  it('ends the sign-ins other tabs saved, once they reload, on a sign-out or account switch here', () => {
    ['', OTHER].forEach((nextAddress) => {
      adoptTokenCaches(ADDRESS);
      writeTokenCache(CACHE_KEY, { token: 'tab-token' });
      // Another tab signed in as the same person keeps this copy in its own sessionStorage.
      const otherTab = String(sessionStorage.getItem(CACHE_KEY));
      resetTokenCaches(nextAddress);
      sessionStorage.setItem(CACHE_KEY, otherTab);
      const page = reload();
      page.adoptTokenCaches(ADDRESS);
      expect(page.readTokenCache(CACHE_KEY)).toBeNull();
    });
  });

  it('drops a saved sign-in once it has expired', () => {
    adoptTokenCaches(ADDRESS);
    const scope = { workerUrl: 'https://worker.example', sessionSlug: 'edge', address: ADDRESS };
    const exp = Math.floor(Date.now() / 1000) - 60;
    writeTokenCache(CACHE_KEY, buildTokenCacheEnvelope({ ...scope, token: 'old-token', exp }));
    expect(readScopedTokenCache(CACHE_KEY, scope)).toBeNull();
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('ends this tab’s saved sign-ins on its own sign-out or account switch', () => {
    adoptTokenCaches(ADDRESS);
    writeTokenCache(CACHE_KEY, { token: 'tab-token' });
    resetTokenCaches(OTHER);
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    writeTokenCache(OTHER_KEY, { token: 'other-token' });
    const page = reload();
    page.adoptTokenCaches(OTHER);
    expect(page.readTokenCache(OTHER_KEY)).toEqual({ token: 'other-token' });
    page.resetTokenCaches('');
    page.writeTokenCache(OTHER_KEY, { token: 'signed-out-token' });
    expect(sessionStorage.getItem(OTHER_KEY)).toBeNull();
  });

  it('drops another account’s saved sign-ins, and unreadable ones, when the page learns who is signed in', () => {
    adoptTokenCaches(OTHER);
    writeTokenCache(OTHER_KEY, { token: 'other-token' });
    sessionStorage.setItem(CACHE_KEY, '{not json');
    const page = reload();
    page.adoptTokenCaches(ADDRESS);
    expect(sessionStorage.getItem(OTHER_KEY)).toBeNull();
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    expect(page.readTokenCache(CACHE_KEY)).toBeNull();
  });
});
