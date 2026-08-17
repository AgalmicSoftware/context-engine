import { arweaveClient } from '../arweave/arweaveClient.js';
import { initCacheManager, removeCache, updateCacheAtomic } from '../cache/cacheScripts.js';
import contractScripts from './chainGateway.js';
import { __test__contractScriptsArweaveCache } from './chainGateway.js';

jest.mock('../arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: jest.fn(),
    hexToBase64url: jest.fn((v) => v),
    base64urlToHex: jest.fn((v) => v),
    base64DecodeURL: jest.fn(),
    base64urlToBase64: jest.fn(),
  },
}));

const TEST_SLUG = 'arweave-cache-test';
const TEST_SLUG_ALT = 'arweave-cache-test-alt';
const groupCtx = {
  slug: TEST_SLUG,
  networkChainId: 84532,
  contracts: {
    surveys: {
      chainId: 84532,
      address: '0x0000000000000000000000000000000000000001',
    },
  },
};
const groupCtxAlt = {
  ...groupCtx,
  slug: TEST_SLUG_ALT,
};

describe('contractScripts arweave tx cache + failure cache', () => {
  beforeAll(async () => {
    await initCacheManager();
  });

  beforeEach(async () => {
    arweaveClient.downloadDataFromArweave.mockReset();
    await removeCache('questionsCache', TEST_SLUG).catch(() => null);
    await removeCache('questionsCache', TEST_SLUG_ALT).catch(() => null);
  });

  afterAll(async () => {
    await removeCache('questionsCache', TEST_SLUG).catch(() => null);
    await removeCache('questionsCache', TEST_SLUG_ALT).catch(() => null);
  });

  it('returns cached tx payload without refetching', async () => {
    const resolved = __test__contractScriptsArweaveCache.resolveReadContext(groupCtx);
    expect(Number(resolved?.chainId || 0)).toBe(84532);

    await __test__contractScriptsArweaveCache.writeArweaveTxCacheEntry({
      txId: 'tx_cache_hit',
      text: '{"cached":true}',
      groupKeyOrCfg: groupCtx,
    });

    const seededEntry = await __test__contractScriptsArweaveCache.readArweaveTxCacheEntry({
      txId: 'tx_cache_hit',
      groupKeyOrCfg: groupCtx,
    });
    expect(seededEntry?.text).toBe('{"cached":true}');

    const text = await __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
      txId: 'tx_cache_hit',
      groupKeyOrCfg: groupCtx,
    });

    expect(text).toBe('{"cached":true}');
    expect(arweaveClient.downloadDataFromArweave).not.toHaveBeenCalled();
  });

  it('short-circuits during cooldown without network fetch', async () => {
    await __test__contractScriptsArweaveCache.writeArweaveTxFailureCacheEntry({
      txId: 'tx_cooldown',
      groupKeyOrCfg: groupCtx,
      entry: {
        attempts: 2,
        firstFailedAtMs: Date.now() - 10_000,
        lastFailedAtMs: Date.now() - 5_000,
        nextRetryAtMs: Date.now() + 60_000,
        lastStatus: 404,
        state: 'transient',
        message: 'retry later',
      },
    });

    await expect(
      __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
        txId: 'tx_cooldown',
        groupKeyOrCfg: groupCtx,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveTxFailureError',
      kind: 'cooldown',
      state: 'transient',
      retryable: true,
    });
    expect(arweaveClient.downloadDataFromArweave).not.toHaveBeenCalled();
  });

  it('short-circuits terminal failures', async () => {
    await __test__contractScriptsArweaveCache.writeArweaveTxFailureCacheEntry({
      txId: 'tx_terminal',
      groupKeyOrCfg: groupCtx,
      entry: {
        attempts: 9,
        firstFailedAtMs: Date.now() - 20 * 60 * 1000,
        lastFailedAtMs: Date.now() - 60_000,
        nextRetryAtMs: Date.now() + 60_000,
        lastStatus: 404,
        state: 'terminal_not_found',
        message: 'not found',
      },
    });

    await expect(
      __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
        txId: 'tx_terminal',
        groupKeyOrCfg: groupCtx,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveTxFailureError',
      state: 'terminal_not_found',
      retryable: false,
    });
    expect(arweaveClient.downloadDataFromArweave).not.toHaveBeenCalled();
  });

  it('revalidates memoized failure entries against persisted cache state', async () => {
    const txId = 'tx_memo_revalidate';
    await __test__contractScriptsArweaveCache.writeArweaveTxFailureCacheEntry({
      txId,
      groupKeyOrCfg: groupCtx,
      entry: {
        attempts: 5,
        firstFailedAtMs: Date.now() - 30_000,
        lastFailedAtMs: Date.now() - 10_000,
        nextRetryAtMs: Date.now() + 60_000,
        lastStatus: 404,
        state: 'terminal_not_found',
        message: 'cached terminal',
      },
    });

    const memoSeed = await __test__contractScriptsArweaveCache.readArweaveTxFailureCacheEntry({
      txId,
      groupKeyOrCfg: groupCtx,
      preferMemo: true,
    });
    expect(memoSeed).not.toBeNull();

    // Simulate another tab clearing the persistent failure entry while this tab keeps memo state.
    await updateCacheAtomic('questionsCache', TEST_SLUG, (current) => {
      const cache = current && typeof current === 'object' ? current : {};
      const netKey = String(groupCtx.networkChainId);
      const net = cache[netKey] && typeof cache[netKey] === 'object' ? cache[netKey] : {};
      const failureCache =
        net.arweaveTxFailureCache && typeof net.arweaveTxFailureCache === 'object' ? net.arweaveTxFailureCache : {};
      if (Object.prototype.hasOwnProperty.call(failureCache, txId)) {
        try {
          delete failureCache[txId];
        } catch (_) {}
      }
      net.arweaveTxFailureCache = failureCache;
      cache[netKey] = net;
      return cache;
    });

    const revalidated = await __test__contractScriptsArweaveCache.readArweaveTxFailureCacheEntry({
      txId,
      groupKeyOrCfg: groupCtx,
      preferMemo: true,
    });
    expect(revalidated).toBeNull();
  });

  it('rechecks terminal_not_found entries after cooldown expiry', async () => {
    await __test__contractScriptsArweaveCache.writeArweaveTxFailureCacheEntry({
      txId: 'tx_terminal_recheck',
      groupKeyOrCfg: groupCtx,
      entry: {
        attempts: 9,
        firstFailedAtMs: Date.now() - 20 * 60 * 1000,
        lastFailedAtMs: Date.now() - 60_000,
        nextRetryAtMs: 0,
        lastStatus: 404,
        state: 'terminal_not_found',
        message: 'retry window elapsed',
      },
    });
    arweaveClient.downloadDataFromArweave.mockResolvedValue('{"recovered":true}');

    const text = await __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
      txId: 'tx_terminal_recheck',
      groupKeyOrCfg: groupCtx,
    });

    expect(text).toBe('{"recovered":true}');
    expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledTimes(1);
    const failureEntry = await __test__contractScriptsArweaveCache.readArweaveTxFailureCacheEntry({
      txId: 'tx_terminal_recheck',
      groupKeyOrCfg: groupCtx,
      preferMemo: false,
    });
    expect(failureEntry).toBeNull();
  });

  it('writes success payload and clears failure entry', async () => {
    await __test__contractScriptsArweaveCache.writeArweaveTxFailureCacheEntry({
      txId: 'tx_success',
      groupKeyOrCfg: groupCtx,
      entry: {
        attempts: 3,
        firstFailedAtMs: Date.now() - 20_000,
        lastFailedAtMs: Date.now() - 5_000,
        nextRetryAtMs: 0,
        lastStatus: 503,
        state: 'transient',
        message: 'temporary',
      },
    });
    arweaveClient.downloadDataFromArweave.mockResolvedValue('{"ok":1}');

    const text = await __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
      txId: 'tx_success',
      groupKeyOrCfg: groupCtx,
    });

    expect(text).toBe('{"ok":1}');
    expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledTimes(1);

    const txCacheEntry = await __test__contractScriptsArweaveCache.readArweaveTxCacheEntry({
      txId: 'tx_success',
      groupKeyOrCfg: groupCtx,
    });
    expect(txCacheEntry?.text).toBe('{"ok":1}');

    const failureEntry = await __test__contractScriptsArweaveCache.readArweaveTxFailureCacheEntry({
      txId: 'tx_success',
      groupKeyOrCfg: groupCtx,
      preferMemo: false,
    });
    expect(failureEntry).toBeNull();
  });

  it('coalesces concurrent tx downloads to a single network fetch', async () => {
    arweaveClient.downloadDataFromArweave.mockImplementation(
      async () => new Promise((resolve) => setTimeout(() => resolve('{"ok":true}'), 20)),
    );

    const [a, b] = await Promise.all([
      __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
        txId: 'tx_inflight',
        groupKeyOrCfg: groupCtx,
      }),
      __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
        txId: 'tx_inflight',
        groupKeyOrCfg: groupCtx,
      }),
    ]);

    expect(a).toBe('{"ok":true}');
    expect(b).toBe('{"ok":true}');
    expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent tx downloads across slugs on the same chain', async () => {
    arweaveClient.downloadDataFromArweave.mockImplementation(
      async () => new Promise((resolve) => setTimeout(() => resolve('{"ok":true}'), 20)),
    );

    const [a, b] = await Promise.all([
      __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
        txId: 'tx_inflight_cross_slug',
        groupKeyOrCfg: groupCtx,
      }),
      __test__contractScriptsArweaveCache.downloadArweaveTextForGroup({
        txId: 'tx_inflight_cross_slug',
        groupKeyOrCfg: groupCtxAlt,
      }),
    ]);

    expect(a).toBe('{"ok":true}');
    expect(b).toBe('{"ok":true}');
    expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledTimes(1);
  });

  it('returns null without constructing a contract when surveys address is unresolved', async () => {
    const missingAddressGroup = {
      slug: TEST_SLUG,
      networkChainId: 84532,
      contracts: {
        surveys: {
          chainId: 84532,
          address: undefined,
        },
      },
    };

    await expect(
      contractScripts.getQuestionHash(
        'none',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        missingAddressGroup,
      ),
    ).resolves.toBeNull();
  });

  it('throws terminal_not_found metadata error when question hash is unavailable and throwOnFailure is set', async () => {
    const spy = jest.spyOn(contractScripts, 'getQuestionHash').mockResolvedValue(null);
    try {
      await expect(
        contractScripts.getQuestionData(
          'none',
          '0x1111111111111111111111111111111111111111111111111111111111111111',
          groupCtx,
          { throwOnFailure: true },
        ),
      ).rejects.toMatchObject({
        name: 'MetadataUnavailableError',
        arweaveFailure: expect.objectContaining({
          state: 'terminal_not_found',
          status: 404,
          retryable: false,
        }),
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps throwOnFailure behavior when concurrent soft and strict reads run', async () => {
    let releaseHashLookup = null;
    const hashLookupGate = new Promise((resolve) => {
      releaseHashLookup = resolve;
    });
    const spy = jest.spyOn(contractScripts, 'getQuestionHash').mockImplementation(async () => {
      await hashLookupGate;
      return null;
    });
    try {
      const qid = '0x2222222222222222222222222222222222222222222222222222222222222222';
      const softRead = contractScripts.getQuestionData('none', qid, groupCtx, { throwOnFailure: false });
      const strictRead = contractScripts.getQuestionData('none', qid, groupCtx, { throwOnFailure: true });

      releaseHashLookup();

      await expect(softRead).resolves.toBeNull();
      await expect(strictRead).rejects.toMatchObject({
        name: 'MetadataUnavailableError',
        arweaveFailure: expect.objectContaining({
          state: 'terminal_not_found',
          status: 404,
          retryable: false,
        }),
      });
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('passes strict hash lookup mode so transient hash errors propagate', async () => {
    const transientHashError = new Error('temporary hash RPC failure');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest
      .spyOn(contractScripts, 'getQuestionHash')
      .mockImplementation(async (_provider, _qid, _group, hashOpts = {}) => {
        if (hashOpts?.throwOnError) throw transientHashError;
        return null;
      });
    try {
      const qid = '0x3333333333333333333333333333333333333333333333333333333333333333';
      await expect(
        contractScripts.getQuestionData('none', qid, groupCtx, { throwOnFailure: false }),
      ).resolves.toBeNull();
      await expect(contractScripts.getQuestionData('none', qid, groupCtx, { throwOnFailure: true })).rejects.toBe(
        transientHashError,
      );
      expect(spy).toHaveBeenCalledWith('none', qid, groupCtx, expect.objectContaining({ throwOnError: false }));
      expect(spy).toHaveBeenCalledWith('none', qid, groupCtx, expect.objectContaining({ throwOnError: true }));
    } finally {
      consoleSpy.mockRestore();
      spy.mockRestore();
    }
  });

  it('bypasses stale survey metadata failure cache when forceArweaveFetch is set', async () => {
    const surveyId = '0x4444444444444444444444444444444444444444444444444444444444444444';
    const surveyTxId = 'force_recover_survey_tx';
    const hashSpy = jest.spyOn(contractScripts, 'getSurveyHash').mockResolvedValue(surveyTxId);
    arweaveClient.downloadDataFromArweave.mockResolvedValue('{"title":"Recovered survey","questionIDs":["q1"]}');

    try {
      await __test__contractScriptsArweaveCache.writeArweaveTxFailureCacheEntry({
        txId: surveyTxId,
        groupKeyOrCfg: groupCtx,
        entry: {
          attempts: 9,
          firstFailedAtMs: Date.now() - 60_000,
          lastFailedAtMs: Date.now() - 30_000,
          nextRetryAtMs: Date.now() + 60_000,
          lastStatus: 404,
          state: 'terminal_not_found',
          message: 'stale not found',
        },
      });

      await expect(
        contractScripts.getSurveyDataById('none', surveyId, groupCtx, {
          throwOnFailure: true,
          forceArweaveFetch: true,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          title: 'Recovered survey',
          questionIDs: ['q1'],
        }),
      );

      expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledWith(
        surveyTxId,
        expect.objectContaining({
          forceRetry: true,
          cacheBypass: true,
          bypassFailureCache: true,
        }),
      );
    } finally {
      hashSpy.mockRestore();
    }
  });

  it('isolates concurrent forced and non-forced survey metadata reads', async () => {
    const surveyId = '0x5555555555555555555555555555555555555555555555555555555555555555';
    const surveyTxId = 'force_inflight_survey_tx';
    const hashSpy = jest.spyOn(contractScripts, 'getSurveyHash').mockResolvedValue(surveyTxId);
    arweaveClient.downloadDataFromArweave.mockImplementation(
      (_txId, opts = {}) =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              JSON.stringify({
                title: opts?.forceRetry ? 'Forced survey' : 'Normal survey',
                questionIDs: [],
              }),
            );
          }, 20);
        }),
    );

    try {
      const [normalRead, forcedRead] = await Promise.all([
        contractScripts.getSurveyDataById('none', surveyId, groupCtx, {
          throwOnFailure: true,
        }),
        contractScripts.getSurveyDataById('none', surveyId, groupCtx, {
          throwOnFailure: true,
          forceArweaveFetch: true,
        }),
      ]);

      expect(normalRead).toEqual(
        expect.objectContaining({
          title: 'Normal survey',
          questionIDs: [],
        }),
      );
      expect(forcedRead).toEqual(
        expect.objectContaining({
          title: 'Forced survey',
          questionIDs: [],
        }),
      );
      expect(hashSpy).toHaveBeenCalledTimes(2);
      expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledTimes(2);
      expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledWith(
        surveyTxId,
        expect.objectContaining({
          forceRetry: false,
          cacheBypass: false,
          bypassFailureCache: false,
        }),
      );
      expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledWith(
        surveyTxId,
        expect.objectContaining({
          forceRetry: true,
          cacheBypass: true,
          bypassFailureCache: true,
        }),
      );
    } finally {
      hashSpy.mockRestore();
    }
  });
});
