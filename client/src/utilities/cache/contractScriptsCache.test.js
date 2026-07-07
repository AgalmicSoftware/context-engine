import { ethers } from 'ethers';
import {
  ARWEAVE_TX_CACHE_MAX_ENTRIES,
  ARWEAVE_TX_FAILURE_CACHE_MAX_ENTRIES,
  buildHashReadInflightKey,
  buildHashReadMemoKey,
  createContractScriptsCache,
  getTimedMemoValue,
  markHashRevertLoggedOnce,
  setTimedMemoValue,
} from './contractScriptsCache.js';

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const buildTimestampedCacheEntries = (count, buildEntry) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`tx-${index}`, buildEntry(index)]));

const buildSubjectConfig = () => ({
  resolveSession: (groupKeyOrCfg) =>
    groupKeyOrCfg && typeof groupKeyOrCfg === 'object'
      ? groupKeyOrCfg
      : {
          slug: String(groupKeyOrCfg || ''),
          networkChainId: 84532,
          contracts: {},
        },
  normalizeSessionSlug: (slug) =>
    String(slug || '')
      .trim()
      .toLowerCase(),
  getSessionAddresses: () => ({
    sbtFactory: {
      address: '0x0000000000000000000000000000000000000001',
      chainId: 84532,
    },
  }),
  shouldBypassSessionScopeWindow: () => false,
  sessionRegistryStore: {
    getSessionConfig: jest.fn(() => null),
  },
  sessionRegistryUtils: {
    toRegistrySlug: (slug) => String(slug || ''),
    getRegistryContract: jest.fn(() => null),
    upsertSessionRegistryCache: jest.fn(),
  },
  DEFAULT_CHAIN_ID: 84532,
  contractsLog: {
    warn: jest.fn(),
  },
  parsePositiveBlockNumber: (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.max(1, Math.floor(n));
  },
  ethers,
});

const createSubject = (factory = createContractScriptsCache) => factory(buildSubjectConfig());

const loadIsolatedModule = ({
  readCacheValue = {},
  updateCacheAtomicImpl = async (_namespace, _slug, updater) => updater({}),
} = {}) => {
  jest.resetModules();
  const readCache = jest.fn(async () => deepClone(readCacheValue));
  const updateCacheAtomic = jest.fn(updateCacheAtomicImpl);
  let isolated = null;

  jest.doMock('./cacheScripts.js', () => ({
    readCache,
    updateCacheAtomic,
  }));

  jest.isolateModules(() => {
    isolated = require('./contractScriptsCache.js');
  });

  jest.dontMock('./cacheScripts.js');
  return {
    ...isolated,
    readCache,
    updateCacheAtomic,
  };
};

describe('contractScriptsCache helpers', () => {
  it('preserves hash memo key formats', () => {
    expect(buildHashReadMemoKey({ baseKey: '84532|edge', id: '0xabc' })).toBe('84532|edge|0xabc');
    expect(buildHashReadInflightKey({ baseKey: '84532|edge', id: '0xabc', throwOnError: true })).toBe(
      '84532|edge|0xabc|strict:1',
    );
    expect(buildHashReadInflightKey({ baseKey: '84532|edge', id: '0xabc', throwOnError: false })).toBe(
      '84532|edge|0xabc|strict:0',
    );
  });

  it('dedupes hash revert log keys and prunes oldest entries', () => {
    const logged = new Set();

    expect(markHashRevertLoggedOnce(logged, '')).toBe(false);
    expect(markHashRevertLoggedOnce(logged, 'q1', 2)).toBe(true);
    expect(markHashRevertLoggedOnce(logged, 'q1', 2)).toBe(false);
    expect(markHashRevertLoggedOnce(logged, 'q2', 2)).toBe(true);
    expect(markHashRevertLoggedOnce(logged, 'q3', 2)).toBe(true);

    expect(Array.from(logged)).toEqual(['q2', 'q3']);
  });

  it('stores timed memo entries with TTL expiry and LRU refresh', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const memo = new Map();

    try {
      setTimedMemoValue(memo, 'a', 'first', 2);
      setTimedMemoValue(memo, 'b', 'second', 2);
      expect(Array.from(memo.keys())).toEqual(['a', 'b']);

      nowSpy.mockReturnValue(1020);
      expect(getTimedMemoValue(memo, 'a', 100)).toBe('first');
      expect(Array.from(memo.keys())).toEqual(['b', 'a']);

      setTimedMemoValue(memo, 'c', 'third', 2);
      expect(Array.from(memo.keys())).toEqual(['a', 'c']);

      nowSpy.mockReturnValue(1200);
      expect(getTimedMemoValue(memo, 'a', 100)).toBeNull();
      expect(Array.from(memo.keys())).toEqual(['c']);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('coalesces inflight Arweave tx work by chain and tx id', async () => {
    const subject = createSubject();
    const task = jest.fn(async () => new Promise((resolve) => setTimeout(() => resolve('ok'), 10)));

    const [a, b] = await Promise.all([
      subject.runArweaveTxFetchCoalesced({ chainId: 84532, txId: 'tx-1', task }),
      subject.runArweaveTxFetchCoalesced({ chainId: 84532, txId: 'tx-1', task }),
    ]);

    expect(a).toBe('ok');
    expect(b).toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('keeps inflight Arweave tx work isolated per chain', async () => {
    const subject = createSubject();
    const task = jest.fn(async () => 'ok');

    await Promise.all([
      subject.runArweaveTxFetchCoalesced({ chainId: 84532, txId: 'tx-1', task }),
      subject.runArweaveTxFetchCoalesced({ chainId: 8453, txId: 'tx-1', task }),
    ]);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('keeps forced and non-forced Arweave tx work isolated', async () => {
    const subject = createSubject();
    const task = jest.fn(async () => new Promise((resolve) => setTimeout(() => resolve('ok'), 10)));

    const [a, b] = await Promise.all([
      subject.runArweaveTxFetchCoalesced({
        chainId: 84532,
        txId: 'tx-force-1',
        forceFetch: false,
        task,
      }),
      subject.runArweaveTxFetchCoalesced({
        chainId: 84532,
        txId: 'tx-force-1',
        forceFetch: true,
        task,
      }),
    ]);

    expect(a).toBe('ok');
    expect(b).toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('reads arweave tx cache entries only from the exact network key', async () => {
    const readCacheValue = {
      '084532': {
        arweaveTxCache: {
          'tx-1': {
            text: 'legacy payload',
            contentType: 'text/plain',
            savedAtMs: 1,
          },
        },
      },
    };
    const { createContractScriptsCache: isolatedFactory, readCache } = loadIsolatedModule({
      readCacheValue,
    });
    const subject = createSubject(isolatedFactory);

    await expect(subject.readArweaveTxCacheEntry({ groupKeyOrCfg: '', txId: 'tx-1' })).resolves.toBeNull();
    expect(readCache).toHaveBeenCalledWith('questionsCache', '');
  });

  it('writes arweave tx cache entries into the exact network key without merging numeric compat keys', async () => {
    const startingCache = {
      '084532': {
        arweaveTxCache: {
          legacy: {
            text: 'legacy payload',
            contentType: 'text/plain',
            savedAtMs: 1,
          },
        },
      },
    };
    let updatedCache = null;
    const { createContractScriptsCache: isolatedFactory, updateCacheAtomic } = loadIsolatedModule({
      updateCacheAtomicImpl: async (_namespace, _slug, updater) => {
        updatedCache = updater(deepClone(startingCache));
        return updatedCache;
      },
    });
    const subject = createSubject(isolatedFactory);

    await subject.writeArweaveTxCacheEntry({ groupKeyOrCfg: '', txId: 'tx-1', text: 'fresh payload' });

    expect(updateCacheAtomic).toHaveBeenCalledWith('questionsCache', '', expect.any(Function));
    expect(updatedCache['084532']).toEqual(startingCache['084532']);
    expect(updatedCache['84532'].arweaveTxCache['tx-1']).toMatchObject({
      text: 'fresh payload',
      contentType: 'application/json',
    });
  });

  it('keeps the bounded Arweave tx cache at max size and prunes the oldest saved row', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5000);
    const startingCache = {
      84532: {
        arweaveTxCache: buildTimestampedCacheEntries(ARWEAVE_TX_CACHE_MAX_ENTRIES, (index) => ({
          text: `payload-${index}`,
          contentType: 'text/plain',
          savedAtMs: index + 1,
        })),
      },
    };
    let updatedCache = null;
    const { createContractScriptsCache: isolatedFactory } = loadIsolatedModule({
      updateCacheAtomicImpl: async (_namespace, _slug, updater) => {
        updatedCache = updater(deepClone(startingCache));
        return updatedCache;
      },
    });
    const subject = createSubject(isolatedFactory);

    try {
      await subject.writeArweaveTxCacheEntry({
        groupKeyOrCfg: '',
        txId: 'tx-new',
        text: 'fresh payload',
        contentType: 'application/json',
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(Object.keys(updatedCache['84532'].arweaveTxCache)).toHaveLength(ARWEAVE_TX_CACHE_MAX_ENTRIES);
    expect(updatedCache['84532'].arweaveTxCache['tx-0']).toBeUndefined();
    expect(updatedCache['84532'].arweaveTxCache['tx-1']).toMatchObject({
      text: 'payload-1',
      savedAtMs: 2,
    });
    expect(updatedCache['84532'].arweaveTxCache['tx-new']).toMatchObject({
      text: 'fresh payload',
      contentType: 'application/json',
      savedAtMs: 5000,
    });
  });

  it('keeps the bounded Arweave tx failure cache at max size and prunes the oldest failure row', async () => {
    const startingCache = {
      84532: {
        arweaveTxFailureCache: buildTimestampedCacheEntries(ARWEAVE_TX_FAILURE_CACHE_MAX_ENTRIES, (index) => ({
          attempts: 1,
          firstFailedAtMs: index + 1,
          lastFailedAtMs: index + 1,
          nextRetryAtMs: index + 100,
          lastStatus: 503,
          state: 'transient',
          message: `failure-${index}`,
        })),
      },
    };
    let updatedCache = null;
    const { createContractScriptsCache: isolatedFactory } = loadIsolatedModule({
      updateCacheAtomicImpl: async (_namespace, _slug, updater) => {
        updatedCache = updater(deepClone(startingCache));
        return updatedCache;
      },
    });
    const subject = createSubject(isolatedFactory);

    await subject.writeArweaveTxFailureCacheEntry({
      groupKeyOrCfg: '',
      txId: 'tx-new',
      entry: {
        attempts: 2,
        firstFailedAtMs: 4000,
        lastFailedAtMs: 5000,
        nextRetryAtMs: 6000,
        lastStatus: 504,
        state: 'transient',
        message: 'new failure',
      },
    });

    expect(Object.keys(updatedCache['84532'].arweaveTxFailureCache)).toHaveLength(ARWEAVE_TX_FAILURE_CACHE_MAX_ENTRIES);
    expect(updatedCache['84532'].arweaveTxFailureCache['tx-0']).toBeUndefined();
    expect(updatedCache['84532'].arweaveTxFailureCache['tx-1']).toMatchObject({
      message: 'failure-1',
      lastFailedAtMs: 2,
    });
    expect(updatedCache['84532'].arweaveTxFailureCache['tx-new']).toMatchObject({
      attempts: 2,
      firstFailedAtMs: 4000,
      lastFailedAtMs: 5000,
      nextRetryAtMs: 6000,
      lastStatus: 504,
      state: 'transient',
      message: 'new failure',
    });
  });
});
