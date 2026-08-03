const mockLogger = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('utilities/logging', () => ({
  __esModule: true,
  createLogger: jest.fn(() => mockLogger),
}));

jest.mock(
  '../../utilities/cache/cacheScripts.js',
  () => ({
    __esModule: true,
    peekCacheSync: jest.fn(),
    removeCache: jest.fn(),
    writeCacheOptimistic: jest.fn(),
  }),
  { virtual: true },
);

jest.mock('./sessionCacheEviction', () => ({
  __esModule: true,
  evictOldDgEntries: jest.fn(),
  removeDgMetaTimestamp: jest.fn(),
  trimLargeArrays: jest.fn(),
  updateDgMetaTimestamp: jest.fn(),
}));

jest.mock('../../components/MainSite/mainSiteUtils', () => ({
  __esModule: true,
  bumpMainSitePerfCounter: jest.fn(),
  getMainSitePerfNow: jest.fn(),
  isMainSitePerfCountersEnabled: jest.fn(),
}));

const { createMainSiteDgStorage } = require('./mainSiteDgStorage.js');
const cacheScripts = require('../../utilities/cache/cacheScripts.js');
const storageEviction = require('../../components/MainSite/storageEviction');
const mainSiteUtils = require('../../components/MainSite/mainSiteUtils');

describe('createMainSiteDgStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    cacheScripts.peekCacheSync.mockReturnValue(null);
    cacheScripts.removeCache.mockResolvedValue(undefined);
    cacheScripts.writeCacheOptimistic.mockResolvedValue(true);
    storageEviction.evictOldDgEntries.mockReturnValue(0);
    storageEviction.removeDgMetaTimestamp.mockImplementation(() => undefined);
    storageEviction.trimLargeArrays.mockImplementation(() => undefined);
    storageEviction.updateDgMetaTimestamp.mockImplementation(() => undefined);
    mainSiteUtils.bumpMainSitePerfCounter.mockImplementation(() => undefined);
    mainSiteUtils.getMainSitePerfNow.mockReturnValue(100);
    mainSiteUtils.isMainSitePerfCountersEnabled.mockReturnValue(false);
  });

  it('delegates managed namespaces to cacheScripts and preserves the storage key format', async () => {
    const storage = createMainSiteDgStorage();
    const managedValue = { ok: true };
    cacheScripts.peekCacheSync.mockReturnValueOnce(managedValue);

    expect(storage.key('questionsCache', 'edge')).toBe('dg:questionsCache:edge');
    expect(storage.read('questionsCache', 'edge', { clone: false })).toBe(managedValue);
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });

    await expect(storage.write('questionsCache', 'edge', { value: 1 })).resolves.toBe(true);
    expect(cacheScripts.writeCacheOptimistic).toHaveBeenCalledWith('questionsCache', 'edge', { value: 1 });

    await expect(storage.remove('questionsCache', 'edge')).resolves.toBeUndefined();
    expect(cacheScripts.removeCache).toHaveBeenCalledWith('questionsCache', 'edge');

    await expect(storage.write('analysisCache', 'edge', { summary: 'cached' })).resolves.toBe(true);
    expect(cacheScripts.writeCacheOptimistic).toHaveBeenCalledWith('analysisCache', 'edge', { summary: 'cached' });
    expect(localStorage.getItem('dg:analysisCache:edge')).toBeNull();
  });

  it('deduplicates non-managed writes by persisted storage match and by last-written snapshot', async () => {
    const storage = createMainSiteDgStorage();
    const payload = { value: 1 };
    const storageKey = 'dg:viewState:edge';
    localStorage.setItem(storageKey, JSON.stringify(payload));
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');

    await expect(storage.write('viewState', 'edge', payload)).resolves.toBe(true);
    expect(setSpy).not.toHaveBeenCalled();
    expect(storageEviction.updateDgMetaTimestamp).toHaveBeenCalledWith(storageKey);

    storageEviction.updateDgMetaTimestamp.mockClear();
    await expect(storage.write('viewState', 'edge', payload)).resolves.toBe(true);
    expect(setSpy).not.toHaveBeenCalled();
    expect(storageEviction.updateDgMetaTimestamp).toHaveBeenCalledWith(storageKey);

    setSpy.mockRestore();
  });

  it('rewrites a non-managed value when the dedupe snapshot exists but localStorage was cleared externally', async () => {
    const storage = createMainSiteDgStorage();
    const payload = { value: 1 };
    const storageKey = 'dg:viewState:edge';

    await expect(storage.write('viewState', 'edge', payload)).resolves.toBe(true);
    localStorage.removeItem(storageKey);
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');

    await expect(storage.write('viewState', 'edge', payload)).resolves.toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify(payload));

    setSpy.mockRestore();
  });

  it('retries quota failures for non-managed writes after eviction and trim while emitting perf counters', async () => {
    const storage = createMainSiteDgStorage();
    const payload = { items: [1, 2, 3, 4] };
    const storageKey = 'dg:viewState:edge';
    const originalSetItem = Storage.prototype.setItem;
    let attempts = 0;

    mainSiteUtils.isMainSitePerfCountersEnabled.mockReturnValue(true);
    mainSiteUtils.getMainSitePerfNow.mockReturnValueOnce(10).mockReturnValue(16);
    storageEviction.trimLargeArrays.mockImplementation((obj) => {
      if (Array.isArray(obj?.items)) {
        obj.items = obj.items.slice(-2);
      }
    });

    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === storageKey && attempts === 0) {
        attempts += 1;
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        error.code = 22;
        throw error;
      }
      attempts += 1;
      return originalSetItem.call(localStorage, key, value);
    });

    await expect(storage.write('viewState', 'edge', payload)).resolves.toBe(true);

    expect(storageEviction.evictOldDgEntries).toHaveBeenCalledTimes(1);
    expect(storageEviction.trimLargeArrays).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(storageKey))).toEqual({ items: [3, 4] });
    expect(mainSiteUtils.bumpMainSitePerfCounter).toHaveBeenCalledWith('dgWriteNonManagedCalls');
    expect(mainSiteUtils.bumpMainSitePerfCounter).toHaveBeenCalledWith(
      'dgWriteNonManagedSerializedBytes',
      expect.any(Number),
    );
    expect(mainSiteUtils.bumpMainSitePerfCounter).toHaveBeenCalledWith('dgWriteNonManagedQuotaRetryCount');
    expect(mainSiteUtils.bumpMainSitePerfCounter).toHaveBeenCalledWith('dgWriteNonManagedQuotaRetrySuccess');
    expect(mainSiteUtils.bumpMainSitePerfCounter).toHaveBeenCalledWith('dgWriteNonManagedDurationSamples', 1);

    setSpy.mockRestore();
  });

  it('removes non-managed localStorage entries and DG metadata timestamps', async () => {
    const storage = createMainSiteDgStorage();
    const storageKey = 'dg:viewState:edge';
    localStorage.setItem(storageKey, JSON.stringify({ value: 1 }));

    await expect(storage.remove('viewState', 'edge')).resolves.toBeUndefined();

    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(storageEviction.removeDgMetaTimestamp).toHaveBeenCalledWith(storageKey);
  });
});
