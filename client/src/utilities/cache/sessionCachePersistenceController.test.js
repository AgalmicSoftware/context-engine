jest.mock('utilities/logging', () => ({
  __esModule: true,
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock(
  '../../utilities/cache/cacheScripts.js',
  () => ({
    __esModule: true,
    readCache: jest.fn(),
  }),
  { virtual: true },
);

jest.mock('./sessionCacheConstants', () => ({
  __esModule: true,
  DG_PRIMARY_ROUTE_CACHE_NAMES: ['surveysCache', 'questionsCache', 'sbtCache'],
}));

jest.mock(
  '../../utilities/web3/contractScripts.js',
  () => ({
    __esModule: true,
    normalizeSessionSlug: jest.fn(),
  }),
  { virtual: true },
);

const { createSessionCachePersistenceController } = require('./sessionCachePersistenceController.js');
const { readCache } = require('../../utilities/cache/cacheScripts.js');
const contractScriptsModule = require('../../utilities/web3/contractScripts.js');

const createMockHost = (opts = {}) => {
  const state = { cacheHasLoaded: false, ...opts.initialState };
  return {
    dgRead: jest.fn(() => null),
    dgWrite: jest.fn(() => Promise.resolve(true)),
    isMounted: jest.fn(() => opts.mounted !== false),
    getActiveSlug: jest.fn(() => opts.activeSlug || 'test'),
    setState: jest.fn((updater, cb) => {
      const p = typeof updater === 'function' ? updater(state) : updater;
      if (p) Object.assign(state, p);
      if (typeof cb === 'function') cb();
    }),
  };
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createSessionCachePersistenceController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contractScriptsModule.normalizeSessionSlug.mockImplementation((slug) =>
      String(slug || '')
        .trim()
        .toLowerCase(),
    );
  });

  describe('readFlag', () => {
    it('returns false when host.dgRead throws', () => {
      const host = createMockHost();
      host.dgRead.mockImplementation(() => {
        throw new Error('boom');
      });
      const controller = createSessionCachePersistenceController(host);

      expect(controller.readFlag('cacheHasLoaded', 'test')).toBe(false);
    });

    it('returns the coerced dgRead result', () => {
      const host = createMockHost();
      const controller = createSessionCachePersistenceController(host);

      host.dgRead.mockReturnValueOnce('yes');
      expect(controller.readFlag('cacheHasLoaded', 'test')).toBe(true);

      host.dgRead.mockReturnValueOnce(0);
      expect(controller.readFlag('cacheHasLoaded', 'test')).toBe(false);
    });
  });

  describe('writeFlag', () => {
    it('calls dgWrite with a boolean-coerced value', () => {
      const host = createMockHost();
      const controller = createSessionCachePersistenceController(host);

      controller.writeFlag('cacheHasLoaded', 'test', 'truthy');
      controller.writeFlag('cacheHasLoaded', 'test', 0);

      expect(host.dgWrite).toHaveBeenNthCalledWith(1, 'cacheHasLoaded', 'test', true);
      expect(host.dgWrite).toHaveBeenNthCalledWith(2, 'cacheHasLoaded', 'test', false);
    });
  });

  describe('hasPersistedManagedCacheData', () => {
    it('returns true when any managed cache entry is persisted', async () => {
      readCache.mockResolvedValueOnce(null).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(null);
      const controller = createSessionCachePersistenceController(createMockHost());

      await expect(controller.hasPersistedManagedCacheData(' Test ')).resolves.toBe(true);
      expect(contractScriptsModule.normalizeSessionSlug).toHaveBeenCalledWith(' Test ');
      expect(readCache).toHaveBeenCalledTimes(3);
      expect(readCache.mock.calls.map(([namespace]) => namespace)).toEqual([
        'surveysCache',
        'questionsCache',
        'sbtCache',
      ]);
    });

    it('returns false when all managed cache entries are null', async () => {
      readCache.mockResolvedValue(null);
      const controller = createSessionCachePersistenceController(createMockHost());

      await expect(controller.hasPersistedManagedCacheData('test')).resolves.toBe(false);
    });

    it('returns false when a cache read errors', async () => {
      readCache.mockRejectedValue(new Error('read failed'));
      const controller = createSessionCachePersistenceController(createMockHost());

      await expect(controller.hasPersistedManagedCacheData('test')).resolves.toBe(false);
    });
  });

  describe('syncCacheHasLoadedFlagFromPersistent', () => {
    it('deduplicates in-flight calls for the same slug', async () => {
      const deferred = createDeferred();
      readCache.mockImplementation(() => deferred.promise);
      const controller = createSessionCachePersistenceController(createMockHost());

      const first = controller.syncCacheHasLoadedFlagFromPersistent(' Test ');
      const second = controller.syncCacheHasLoadedFlagFromPersistent('test');

      expect(second).toBe(first);
      expect(readCache).toHaveBeenCalledTimes(3);

      deferred.resolve(null);
      await expect(first).resolves.toBe(false);
    });

    it('starts a new run when force is true and only applies the latest run', async () => {
      const firstDeferred = createDeferred();
      const secondDeferred = createDeferred();
      readCache
        .mockImplementationOnce(() => firstDeferred.promise)
        .mockImplementationOnce(() => firstDeferred.promise)
        .mockImplementationOnce(() => firstDeferred.promise)
        .mockImplementationOnce(() => secondDeferred.promise)
        .mockImplementationOnce(() => secondDeferred.promise)
        .mockImplementationOnce(() => secondDeferred.promise);
      const host = createMockHost({ activeSlug: 'test' });
      const controller = createSessionCachePersistenceController(host);

      const first = controller.syncCacheHasLoadedFlagFromPersistent('test');
      const second = controller.syncCacheHasLoadedFlagFromPersistent('test', { force: true });

      expect(second).not.toBe(first);
      expect(readCache).toHaveBeenCalledTimes(6);

      firstDeferred.resolve({ persisted: true });
      await expect(first).resolves.toBe(true);
      expect(host.dgWrite).not.toHaveBeenCalled();
      expect(host.setState).not.toHaveBeenCalled();

      secondDeferred.resolve(null);
      await expect(second).resolves.toBe(false);
      expect(host.dgWrite).toHaveBeenCalledTimes(1);
      expect(host.dgWrite.mock.calls[0][0]).toBe('cacheHasLoaded');
      expect(host.dgWrite.mock.calls[0][2]).toBe(false);
      expect(host.setState).toHaveBeenCalledTimes(1);
    });

    it('writes the cacheHasLoaded flag and updates state when mounted on the active slug', async () => {
      readCache.mockResolvedValueOnce(null).mockResolvedValueOnce({ persisted: true }).mockResolvedValueOnce(null);
      const host = createMockHost({ initialState: { cacheHasLoaded: false } });
      const controller = createSessionCachePersistenceController(host);

      await expect(controller.syncCacheHasLoadedFlagFromPersistent('test')).resolves.toBe(true);

      expect(host.dgWrite.mock.calls[0][0]).toBe('cacheHasLoaded');
      expect(host.dgWrite.mock.calls[0][2]).toBe(true);
      expect(host.setState).toHaveBeenCalledTimes(1);
    });

    it('skips state updates when the active slug does not match', async () => {
      readCache.mockResolvedValueOnce(null).mockResolvedValueOnce({ persisted: true }).mockResolvedValueOnce(null);
      const host = createMockHost({ activeSlug: 'other-slug' });
      const controller = createSessionCachePersistenceController(host);

      await expect(controller.syncCacheHasLoadedFlagFromPersistent('test')).resolves.toBe(true);

      expect(host.dgWrite.mock.calls[0][0]).toBe('cacheHasLoaded');
      expect(host.dgWrite.mock.calls[0][2]).toBe(true);
      expect(host.setState).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('clears in-flight dedupe without cancelling an already-running writeFlag update', async () => {
      const firstDeferred = createDeferred();
      const secondDeferred = createDeferred();
      const host = createMockHost({ mounted: false });
      readCache
        .mockImplementationOnce(() => firstDeferred.promise)
        .mockImplementationOnce(() => firstDeferred.promise)
        .mockImplementationOnce(() => firstDeferred.promise)
        .mockImplementationOnce(() => secondDeferred.promise)
        .mockImplementationOnce(() => secondDeferred.promise)
        .mockImplementationOnce(() => secondDeferred.promise);
      const controller = createSessionCachePersistenceController(host);

      const first = controller.syncCacheHasLoadedFlagFromPersistent('test');
      controller.destroy();

      expect(readCache).toHaveBeenCalledTimes(3);

      firstDeferred.resolve({ persisted: true });
      await expect(first).resolves.toBe(true);
      expect(host.dgWrite).toHaveBeenCalledTimes(1);
      expect(host.dgWrite.mock.calls[0][0]).toBe('cacheHasLoaded');
      expect(host.dgWrite.mock.calls[0][2]).toBe(true);
      expect(host.setState).not.toHaveBeenCalled();

      const second = controller.syncCacheHasLoadedFlagFromPersistent('test');

      expect(second).not.toBe(first);
      expect(readCache).toHaveBeenCalledTimes(6);

      secondDeferred.resolve(null);
      await expect(second).resolves.toBe(false);
      expect(host.dgWrite).toHaveBeenCalledTimes(2);
      expect(host.dgWrite.mock.calls[1][0]).toBe('cacheHasLoaded');
      expect(host.dgWrite.mock.calls[1][2]).toBe(false);
    });
  });
});
