jest.mock('utilities/logging.js', () => ({
  __esModule: true,
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    getRelevantBlockWindowForFilter: jest.fn(),
    fetchUserSubmittedQuestionIDs: jest.fn(),
    getAllQuestionIDsChunkedWithCallback: jest.fn(),
    getQuestionDataById: jest.fn(),
    getQuestionData: jest.fn(),
    getQuestionResponsesChunkedWithCallback: jest.fn(),
    decryptQuestionPayloadInPlace: jest.fn(),
  },
  normalizeSessionSlug: jest.fn((s) => String(s || '')),
}));

jest.mock('../arweave/arweaveRetryHelpers.js', () => ({
  __esModule: true,
  ensureQuestionArweaveCacheBranches: jest.fn(),
  mergeQuestionArweaveCacheBranches: jest.fn(),
  normalizeArweaveFailureMeta: jest.fn(),
  shouldStopPendingMetadataRetry: jest.fn(),
}));

jest.mock('../session/sessionScanScope.js', () => ({
  __esModule: true,
  DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE: 50000,
  readSessionScanMaxBlockRange: jest.fn(),
  resolveValidatedSessionScanWindow: jest.fn(),
}));

jest.mock('../session/demoSessionQuestionFixtures.js', () => ({
  __esModule: true,
  getTemporaryDemoSessionQuestionFixtures: jest.fn(() => []),
}));

jest.mock('../crypto/litProtocol.js', () => ({
  __esModule: true,
  getGlobalLitHooks: jest.fn(),
}));

jest.mock('../session/sessionQuestionDecryption.js', () => ({
  __esModule: true,
  buildQuestionDecryptContextForSession: jest.fn(),
  hasMaskedQuestionPayloadImproved: jest.fn(),
}));

jest.mock('../session/mainSiteProgressHelpers.js', () => ({
  __esModule: true,
  buildQuestionReadyStatePatch: jest.fn(),
  shouldClearQuestionProgressInFinalize: jest.fn(),
  shouldCommitThrottledProgress: jest.fn(),
  shouldFlushCoalescedRun: jest.fn(() => false),
}));

jest.mock('../cache/sessionCacheConstants.js', () => ({
  __esModule: true,
  MASKED_Q_DECRYPT_BACKOFF_MAX: 12,
  MASKED_Q_DECRYPT_BACKOFF_TTL_MS: 30000,
}));

jest.mock('./questionRouting.js', () => ({
  __esModule: true,
  isMaskedQuestionPayload: jest.fn(),
  pickBetterQuestionPayload: jest.fn(),
}));

const { createSessionQuestionCacheController } = require('./sessionQuestionCacheController.js');
const contractScriptsModule = require('../web3/chainGateway.js');
const contractScripts = contractScriptsModule.default;
const { normalizeSessionSlug } = contractScriptsModule;
const {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
  normalizeArweaveFailureMeta,
  shouldStopPendingMetadataRetry,
} = require('../arweave/arweaveRetryHelpers.js');
const {
  DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE,
  readSessionScanMaxBlockRange,
  resolveValidatedSessionScanWindow,
} = require('../session/sessionScanScope.js');
const { getTemporaryDemoSessionQuestionFixtures } = require('../session/demoSessionQuestionFixtures.js');
const { getGlobalLitHooks } = require('../crypto/litProtocol.js');
const {
  buildQuestionDecryptContextForSession,
  hasMaskedQuestionPayloadImproved,
} = require('../session/sessionQuestionDecryption.js');
const {
  buildQuestionReadyStatePatch,
  shouldClearQuestionProgressInFinalize,
  shouldCommitThrottledProgress,
  shouldFlushCoalescedRun,
} = require('../session/mainSiteProgressHelpers.js');
const { isMaskedQuestionPayload, pickBetterQuestionPayload } = require('./questionRouting.js');
const { resolveWorkerCanonicalCacheIdentity } = require('./workerCanonicalCacheIdentity.js');

const NETWORK_ID = '11155420';
const SESSION_SLUG = 'alpha';
const ACCOUNT = '0xUser';
const PROVIDER_LIKE = 'provider-like';
const WORKER_SESSION_ID = `0x${'3'.repeat(32)}`;

const createWorkerCanonicalSessionConfig = ({
  hybrid = false,
  sessionId = WORKER_SESSION_ID,
  workerUrl = 'https://alpha-worker.example.test',
} = {}) => ({
  slug: SESSION_SLUG,
  sessionId,
  corsWorkerUrl: workerUrl,
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: hybrid ? 11155420 : null },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: hybrid ? 'worker_envelope' : 'none' },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: hybrid
      ? {
          mode: 'worker_envelope',
          keyProvider: 'worker_secret',
          accessConditions: {
            match: 'any',
            conditions: [
              {
                kind: 'sbt_onchain',
                chainId: 11155420,
                contract: '0x1111111111111111111111111111111111111111',
                anyOrAll: 'any',
              },
            ],
          },
        }
      : { mode: 'none' },
    surfaces: {
      web: true,
      telegram: false,
      miniApp: false,
      agentHttp: false,
      mcp: false,
      ceCc: false,
    },
    results: {
      visibility: 'public_full_if_storage_public',
      exposure: {
        aggregateResultsEnabled: true,
        anonymizedGroupsEnabled: false,
        minGroupSize: 2,
      },
    },
    export: { scope: 'all_session' },
  },
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active' },
    payloadAccessControl: {
      gate: 'none',
      encryption: 'none',
      mode: 'public_read',
    },
  },
});

const deepClone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async (count = 6) => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

const createQuestionCacheNetworkNode = (overrides = {}) => ({
  questionsLatestBlock: 9,
  questionsDiscoveryCheckpointBlock: 9,
  questions: {},
  questionResponses: {},
  questionResponsesMeta: {},
  pendingQuestionMetadata: {},
  questionResponsesLatestBlock: 9,
  arweaveTxCache: {},
  arweaveTxFailureCache: {},
  questionHydrationMeta: {},
  ...deepClone(overrides),
});

const createMaskedQuestion = (id, overrides = {}) => ({
  id,
  prompt: '[encrypted]',
  masked: true,
  promptDecrypted: false,
  ...deepClone(overrides),
});

const createPlainQuestion = (id, overrides = {}) => ({
  id,
  prompt: 'Open question',
  masked: false,
  promptDecrypted: true,
  ...deepClone(overrides),
});

const createQuestionsCacheEnvelope = (questions = {}, overrides = {}) => ({
  [NETWORK_ID]: createQuestionCacheNetworkNode({
    questions,
    ...overrides,
  }),
});

const createMockHost = (overrides = {}) => {
  const {
    initialState,
    initialStorage,
    mounted,
    activeSlug,
    chainId,
    sessionCfg,
    sessionScanScope,
    account,
    providerLike,
    network,
    ...rest
  } = overrides;

  const state = {
    questionCacheInitializationError: false,
    questionResponsesNonce: 0,
    isQuestionCacheReady: false,
    ...(initialState || {}),
  };
  const storage = deepClone(initialStorage || {});
  let atomicUpdateTail = Promise.resolve();

  const createAtomicUpdater = (key) =>
    jest.fn((slug, updater) => {
      const operation = atomicUpdateTail.then(async () => {
        const current = storage[key]?.[slug] ?? null;
        const next = await updater(deepClone(current));
        if (!storage[key]) storage[key] = {};
        storage[key][slug] = deepClone(next);
        return true;
      });
      atomicUpdateTail = operation.catch(() => undefined);
      return operation;
    });

  const updateQuestionsCacheAtomic = createAtomicUpdater('questionsCache');
  const updateUserCacheAtomic = createAtomicUpdater('userCache');

  return {
    setState: jest.fn((updater, cb) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      if (patch) Object.assign(state, patch);
      if (typeof cb === 'function') cb();
    }),
    getState: jest.fn(() => state),
    isMounted: jest.fn(() => mounted !== false),
    dgRead: jest.fn((key, slug) => {
      const bucket = storage[key];
      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, slug)) {
        return null;
      }
      return deepClone(bucket[slug]);
    }),
    dgWrite: jest.fn((key, slug, value) => {
      if (!storage[key]) storage[key] = {};
      storage[key][slug] = deepClone(value);
      return true;
    }),
    updateQuestionsCacheAtomic,
    updateUserCacheAtomic,
    getActiveSessionSlug: jest.fn(() => activeSlug || SESSION_SLUG),
    getSessionCfg: jest.fn(() =>
      Object.prototype.hasOwnProperty.call(overrides, 'sessionCfg')
        ? sessionCfg
        : { networkChainId: NETWORK_ID, blockLimits: null },
    ),
    getSessionChainId: jest.fn(() =>
      Object.prototype.hasOwnProperty.call(overrides, 'chainId') ? chainId : NETWORK_ID,
    ),
    getSessionScanScope: jest.fn(() => sessionScanScope || 'session'),
    getAccount: jest.fn(() => (Object.prototype.hasOwnProperty.call(overrides, 'account') ? account : ACCOUNT)),
    getProviderLike: jest.fn(() =>
      Object.prototype.hasOwnProperty.call(overrides, 'providerLike') ? providerLike : PROVIDER_LIKE,
    ),
    getNetwork: jest.fn(() => (Object.prototype.hasOwnProperty.call(overrides, 'network') ? network : { id: 84532 })),
    scanScopeNoop: jest.fn(() => false),
    setReadinessStateIfChanged: jest.fn((patch) => {
      if (patch) Object.assign(state, patch);
    }),
    checkAllCachesReady: jest.fn(),
    mergeLegacyNumericNetworkKey: jest.fn(() => false),
    queueLocalRevisionUpdate: jest.fn(),
    writeQuestionMetadataToCache: jest.fn(() => true),
    getStateSnapshot: () => deepClone(state),
    getStored: (key, slug) => {
      const bucket = storage[key];
      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, slug)) {
        return null;
      }
      return deepClone(bucket[slug]);
    },
    setStored: (key, slug, value) => {
      if (!storage[key]) storage[key] = {};
      storage[key][slug] = deepClone(value);
    },
    ...rest,
  };
};

let globalLitHooks;

describe('createSessionQuestionCacheController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    normalizeSessionSlug.mockImplementation((s) => String(s || ''));
    contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 10, toBlock: 12 });
    contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([]);
    contractScripts.getAllQuestionIDsChunkedWithCallback.mockImplementation(
      async (mode, fromBlock, toBlock, progressCb, partialCb, slug) => {
        if (typeof progressCb === 'function') {
          progressCb({
            totalRangeBlocks: Math.max(1, Number(toBlock) - Number(fromBlock) + 1),
            doneSoFarBlocks: Math.max(0, Number(toBlock) - Number(fromBlock) + 1),
            chunkFrom: fromBlock,
            chunkTo: toBlock,
            chunkEventCount: 0,
          });
        }
        const rows = await contractScripts.fetchUserSubmittedQuestionIDs(mode, fromBlock, toBlock, slug);
        if (typeof partialCb === 'function') partialCb(rows, toBlock);
        return (rows || []).map((row) => String(row?.questionId || '').toLowerCase()).filter(Boolean);
      },
    );
    contractScripts.getQuestionDataById.mockResolvedValue(null);
    contractScripts.getQuestionData.mockImplementation((mode, qId, slug, opts) =>
      contractScripts.getQuestionDataById(mode, qId, slug, opts),
    );
    contractScripts.decryptQuestionPayloadInPlace.mockImplementation(async () => undefined);
    ensureQuestionArweaveCacheBranches.mockImplementation((node) => {
      if (!node || typeof node !== 'object') return;
      if (!node.arweaveTxCache || typeof node.arweaveTxCache !== 'object') node.arweaveTxCache = {};
      if (!node.arweaveTxFailureCache || typeof node.arweaveTxFailureCache !== 'object') {
        node.arweaveTxFailureCache = {};
      }
    });
    mergeQuestionArweaveCacheBranches.mockImplementation((target, source) => {
      if (!target || typeof target !== 'object' || !source || typeof source !== 'object') return;
      target.arweaveTxCache = {
        ...(source.arweaveTxCache || {}),
        ...(target.arweaveTxCache || {}),
      };
      target.arweaveTxFailureCache = {
        ...(source.arweaveTxFailureCache || {}),
        ...(target.arweaveTxFailureCache || {}),
      };
    });
    normalizeArweaveFailureMeta.mockImplementation(() => ({
      state: 'transient',
      status: 503,
      message: 'retry later',
      nextRetryAtMs: 0,
    }));
    shouldStopPendingMetadataRetry.mockImplementation(() => ({
      stop: false,
      terminal: false,
      reachedMaxAttempts: false,
    }));
    readSessionScanMaxBlockRange.mockImplementation((fallback) => fallback);
    resolveValidatedSessionScanWindow.mockImplementation(({ resolvedWindow, maxBlockRange }) => {
      const fromBlock = Number(resolvedWindow?.fromBlock || 0);
      const toBlock = Number(resolvedWindow?.toBlock || 0);
      return {
        ok: true,
        fromBlock,
        toBlock,
        requestedToBlock: toBlock,
        requestedRangeBlocks: fromBlock <= toBlock ? toBlock - fromBlock + 1 : 0,
        maxBlockRange: maxBlockRange || DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE,
        wasCapped: false,
      };
    });
    globalLitHooks = { getKey: jest.fn(() => 'lit-key') };
    getGlobalLitHooks.mockReturnValue(globalLitHooks);
    buildQuestionDecryptContextForSession.mockImplementation(
      ({ cfg = null, account = '', providerLike = '', litHooks = null, fallbackChainId = null } = {}) => ({
        account,
        providerLike,
        chainId: Number(cfg?.networkChainId || fallbackChainId || 0) || null,
        litHooks: litHooks || null,
        litOpts: litHooks && typeof litHooks.getKey === 'function' ? { getKey: litHooks.getKey } : null,
      }),
    );
    hasMaskedQuestionPayloadImproved.mockImplementation((prev, next) => !!prev?.masked && !next?.masked);
    buildQuestionReadyStatePatch.mockImplementation(({ prevState, ready, incrementNonce }) => ({
      isQuestionCacheReady: ready,
      questionResponsesNonce: Number(prevState?.questionResponsesNonce || 0) + (incrementNonce ? 1 : 0),
    }));
    shouldClearQuestionProgressInFinalize.mockImplementation(() => false);
    shouldCommitThrottledProgress.mockImplementation(({ force }) => !!force);
    shouldFlushCoalescedRun.mockImplementation(({ force }) => !!force);
    getTemporaryDemoSessionQuestionFixtures.mockReturnValue([]);
    isMaskedQuestionPayload.mockImplementation(
      (question) =>
        !!question?.masked || String(question?.prompt || '') === '[encrypted]' || question?.promptDecrypted === false,
    );
    pickBetterQuestionPayload.mockImplementation((prev, next) => next);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('isInitInFlight', () => {
    it('returns false when no init is running', () => {
      const controller = createSessionQuestionCacheController(createMockHost());

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);
    });
  });

  describe('destroy', () => {
    it('clears timers and prevents queued continuation runs', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter
        .mockReturnValueOnce(deferred.promise)
        .mockResolvedValueOnce({ fromBlock: 4, toBlock: 3 });

      const firstPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      const secondPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG, {
        background: true,
      });

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await Promise.all([firstPromise, secondPromise]);

      controller.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      jest.runOnlyPendingTimers();
      await flushMicrotasks();

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
    });

    it('resets all in-flight tracking', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValue(deferred.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(true);

      controller.destroy();

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await initPromise;
    });
  });

  describe('initializeQuestionCacheForGroup', () => {
    it('hydrates fresh Worker/SBT question metadata before the chain-scan no-op without RPC calls', async () => {
      const sessionCfg = createWorkerCanonicalSessionConfig({ hybrid: true });
      const loadQuestions = jest.fn().mockResolvedValue([
        {
          id: '0xworkerquestion',
          createdAtMs: 123,
          storageRefId: 'cf_question_fresh',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_question_fresh',
            resource: 'questions',
          },
          payload: {
            id: '0xworkerquestion',
            prompt: 'Fresh Worker question',
            sessionId: WORKER_SESSION_ID,
            sessionSlug: SESSION_SLUG,
          },
        },
      ]);
      const host = createMockHost({
        sessionCfg,
        chainId: null,
        scanScopeNoop: jest.fn(() => true),
        workerCanonicalMetadataHydrationPort: { loadQuestions },
      });
      const controller = createSessionQuestionCacheController(host);

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(loadQuestions).toHaveBeenCalledWith({
        account: ACCOUNT,
        providerLike: PROVIDER_LIKE,
        sessionSlug: SESSION_SLUG,
        sessionConfig: sessionCfg,
      });
      expect(host.scanScopeNoop).not.toHaveBeenCalled();
      expect(host.getSessionChainId).not.toHaveBeenCalled();
      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
      expect(contractScripts.getAllQuestionIDsChunkedWithCallback).not.toHaveBeenCalled();
      expect(contractScripts.getQuestionData).not.toHaveBeenCalled();
      expect(host.getStored('questionsCache', SESSION_SLUG)).toEqual(
        expect.objectContaining({
          worker: expect.objectContaining({
            questions: {
              '0xworkerquestion': expect.objectContaining({
                id: '0xworkerquestion',
                prompt: 'Fresh Worker question',
              }),
            },
          }),
        }),
      );
      expect(host.getStateSnapshot()).toMatchObject({ isQuestionCacheReady: true });
    });

    it('starts same-slug Worker B independently, clears empty B, and discards delayed Worker A metadata', async () => {
      const sessionConfigA = createWorkerCanonicalSessionConfig();
      const sessionConfigB = createWorkerCanonicalSessionConfig({
        sessionId: `0x${'6'.repeat(32)}`,
        workerUrl: 'https://alpha-worker-b.example.test',
      });
      const identityA = resolveWorkerCanonicalCacheIdentity({
        sessionConfig: sessionConfigA,
        sessionSlug: SESSION_SLUG,
      });
      const identityB = resolveWorkerCanonicalCacheIdentity({
        sessionConfig: sessionConfigB,
        sessionSlug: SESSION_SLUG,
      });
      const delayedA = createDeferred();
      const delayedB = createDeferred();
      const workerALoaderStarted = createDeferred();
      const workerBLoaderStarted = createDeferred();
      let currentSessionConfig = sessionConfigA;
      const loadQuestions = jest.fn(({ sessionConfig }) => {
        if (sessionConfig === sessionConfigA) {
          workerALoaderStarted.resolve();
          return delayedA.promise;
        }
        workerBLoaderStarted.resolve();
        return delayedB.promise;
      });
      const host = createMockHost({
        chainId: null,
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: {
              worker: {
                ...createQuestionCacheNetworkNode({
                  questions: {
                    'question-a-cached': {
                      id: 'question-a-cached',
                      prompt: 'Cached Session A question',
                    },
                  },
                }),
                workerCanonicalIdentity: identityA,
              },
            },
          },
        },
        getSessionCfg: jest.fn(() => currentSessionConfig),
        workerCanonicalMetadataHydrationPort: { loadQuestions },
      });
      const controller = createSessionQuestionCacheController(host);

      const runA = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      await workerALoaderStarted.promise;
      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(true);

      currentSessionConfig = sessionConfigB;
      const runB = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      await workerBLoaderStarted.promise;

      expect(loadQuestions).toHaveBeenCalledTimes(2);
      expect(host.getStored('questionsCache', SESSION_SLUG).worker).toMatchObject({
        questions: {},
        workerCanonicalIdentity: identityB,
      });

      delayedB.resolve([]);
      await runB;
      delayedA.resolve([
        {
          id: 'question-a-delayed',
          createdAtMs: 789,
          storageRefId: 'cf_question_a_delayed',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_question_a_delayed',
            resource: 'questions',
          },
          payload: {
            id: 'question-a-delayed',
            prompt: 'Delayed Session A question',
            sessionId: sessionConfigA.sessionId,
            sessionSlug: SESSION_SLUG,
          },
        },
      ]);
      await runA;

      expect(host.getStored('questionsCache', SESSION_SLUG).worker).toMatchObject({
        questions: {},
        workerCanonicalIdentity: identityB,
      });
      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);
    });

    it('short-circuits via scanScopeNoop and marks question cache ready', async () => {
      const host = createMockHost({
        scanScopeNoop: jest.fn((slug, op, onSkipped) => {
          onSkipped();
          return true;
        }),
      });
      const controller = createSessionQuestionCacheController(host);

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(host.getStateSnapshot()).toMatchObject({ isQuestionCacheReady: true });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent calls for the same slug', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValueOnce(deferred.promise);

      const firstPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      const secondPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(true);

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await Promise.all([firstPromise, secondPromise]);

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);
    });

    it('queues pending init when one is already in flight', async () => {
      jest.useFakeTimers();
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter
        .mockReturnValueOnce(deferred.promise)
        .mockResolvedValueOnce({ fromBlock: 4, toBlock: 3 });

      const firstPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      const secondPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG, {
        background: true,
      });

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await Promise.all([firstPromise, secondPromise]);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);

      jest.runOnlyPendingTimers();
      await flushMicrotasks();

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(2);
    });

    it('handles empty block window', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({
        fromBlock: 8,
        toBlock: 7,
      });

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith(
        expect.objectContaining({ slug: SESSION_SLUG, networkChainId: NETWORK_ID }),
      );
      expect(contractScripts.getAllQuestionIDsChunkedWithCallback).not.toHaveBeenCalled();
      expect(host.getStateSnapshot()).toMatchObject({ isQuestionCacheReady: true });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
    });

    it('initializes cache structure on first run', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      const stored = host.getStored('questionsCache', SESSION_SLUG);

      expect(stored?.[NETWORK_ID]).toEqual(
        expect.objectContaining({
          questionsLatestBlock: 12,
          questionsDiscoveryCheckpointBlock: 12,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},
          pendingQuestionMetadata: {},
          questionResponsesLatestBlock: 9,
          arweaveTxCache: {},
          arweaveTxFailureCache: {},
          questionHydrationMeta: {},
        }),
      );
    });

    it('resets empty discovery watermarks when a gated empty recovery forces a rescan', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(
              {},
              {
                questionsLatestBlock: 12,
                questionsDiscoveryCheckpointBlock: 12,
              },
            ),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG, { forceDiscoveryRescan: true });

      expect(contractScripts.fetchUserSubmittedQuestionIDs).toHaveBeenCalledWith('none', 10, 12, SESSION_SLUG);
    });

    it('fetches question IDs via contractScripts.fetchUserSubmittedQuestionIDs', async () => {
      const controller = createSessionQuestionCacheController(createMockHost());

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(contractScripts.fetchUserSubmittedQuestionIDs).toHaveBeenCalledWith('none', 10, 12, SESSION_SLUG);
    });

    it('handles question metadata fetch success', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockResolvedValue({
        creator: '0xCreator',
        prompt: 'Prompt text',
      });

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(contractScripts.getQuestionDataById).toHaveBeenCalledWith(
        'none',
        'q1',
        SESSION_SLUG,
        expect.objectContaining({
          skipDecrypt: true,
          throwOnFailure: true,
          arweaveRetries: 0,
          arweaveGatewayTimeoutMs: 4500,
        }),
      );
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questions?.q1).toMatchObject({
        id: 'q1',
        creator: '0xCreator',
        prompt: 'Prompt text',
      });
    });

    it('publishes temporary demo fixtures before block window resolution settles', async () => {
      const windowDeferred = createDeferred();
      const host = createMockHost({
        activeSlug: 'demo-1',
        sessionCfg: {
          networkChainId: NETWORK_ID,
          blockLimits: { start: 44967477, end: null },
          demoCompatibilitySeed: { temporary: true },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      getTemporaryDemoSessionQuestionFixtures.mockReturnValue([
        {
          id: '0xABCDEF',
          type: 'binary',
          prompt: 'Fixture prompt',
          sessionSlug: 'demo-1',
          temporaryDemoSeed: true,
        },
      ]);
      contractScripts.getRelevantBlockWindowForFilter.mockReturnValueOnce(windowDeferred.promise);

      const initPromise = controller.initializeQuestionCacheForGroup('demo-1');
      await flushMicrotasks(6);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('demo-1');
      expect(host.getStored('questionsCache', 'demo-1')?.[NETWORK_ID]?.questions?.['0xabcdef']).toMatchObject({
        id: '0xabcdef',
        prompt: 'Fixture prompt',
        sessionSlug: 'demo-1',
        temporaryDemoSeed: true,
      });
      expect(host.getStateSnapshot()).toMatchObject({
        isQuestionCacheReady: true,
        questionResponsesNonce: 1,
      });

      windowDeferred.resolve({
        fromBlock: 44967477,
        toBlock: 44967476,
      });
      await initPromise;
      controller.destroy();
    });

    it('publishes temporary demo fixtures before chain discovery settles', async () => {
      const discoveryDeferred = createDeferred();
      const host = createMockHost({
        activeSlug: 'demo-1',
        sessionCfg: {
          networkChainId: NETWORK_ID,
          blockLimits: { start: 44967477, end: null },
          demoCompatibilitySeed: { temporary: true },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      getTemporaryDemoSessionQuestionFixtures.mockReturnValue([
        {
          id: '0xABCDEF',
          type: 'binary',
          prompt: 'Fixture prompt',
          sessionSlug: 'demo-1',
          temporaryDemoSeed: true,
        },
      ]);
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({
        fromBlock: 44967477,
        toBlock: 44967477,
      });
      resolveValidatedSessionScanWindow.mockReturnValueOnce({
        ok: true,
        fromBlock: 44967477,
        toBlock: 44967477,
        requestedToBlock: 44967477,
        requestedRangeBlocks: 1,
        maxBlockRange: DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE,
        wasCapped: false,
      });
      contractScripts.getAllQuestionIDsChunkedWithCallback.mockReturnValueOnce(discoveryDeferred.promise);

      const initPromise = controller.initializeQuestionCacheForGroup('demo-1');
      await flushMicrotasks(10);

      expect(getTemporaryDemoSessionQuestionFixtures).toHaveBeenCalledWith(
        'demo-1',
        expect.objectContaining({
          demoCompatibilitySeed: { temporary: true },
        }),
      );
      expect(host.getStored('questionsCache', 'demo-1')?.[NETWORK_ID]?.questions?.['0xabcdef']).toMatchObject({
        id: '0xabcdef',
        prompt: 'Fixture prompt',
        sessionSlug: 'demo-1',
        temporaryDemoSeed: true,
      });
      expect(
        host.getStored('questionsCache', 'demo-1')?.[NETWORK_ID]?.pendingQuestionMetadata?.['0xabcdef'],
      ).toBeUndefined();
      expect(host.getStateSnapshot()).toMatchObject({
        isQuestionCacheReady: true,
        questionResponsesNonce: 1,
      });

      discoveryDeferred.resolve([]);
      await initPromise;
      controller.destroy();
    });

    it('persists discovered question IDs as pending before slow metadata hydration completes', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);
      const metadataDeferred = createDeferred();

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockReturnValue(metadataDeferred.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      await flushMicrotasks(10);

      const pendingDuringHydration = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]
        ?.pendingQuestionMetadata?.q1;

      expect(pendingDuringHydration).toMatchObject({
        attempts: 0,
        nextRetryAtMs: 0,
        state: 'discovered',
        lastStatus: null,
      });
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionsLatestBlock).toBe(12);

      metadataDeferred.resolve({
        creator: '0xCreator',
        prompt: 'Late prompt',
      });
      await initPromise;

      const stored = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];
      expect(stored?.pendingQuestionMetadata?.q1).toBeUndefined();
      expect(stored?.questions?.q1).toMatchObject({
        id: 'q1',
        creator: '0xCreator',
        prompt: 'Late prompt',
      });
    });

    it('publishes the first hydrated question before the rest of the metadata batch settles', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);
      const firstMetadata = createDeferred();
      const secondMetadata = createDeferred();

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([
        { questionId: 'Q1', creationBlock: 11 },
        { questionId: 'Q2', creationBlock: 12 },
      ]);
      contractScripts.getQuestionDataById.mockImplementation((_mode, qId) => {
        if (qId === 'q1') return firstMetadata.promise;
        if (qId === 'q2') return secondMetadata.promise;
        return Promise.resolve(null);
      });

      let initSettled = false;
      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      initPromise.finally(() => {
        initSettled = true;
      });

      await flushMicrotasks(10);

      firstMetadata.resolve({
        creator: '0xCreatorA',
        prompt: 'First prompt',
      });
      await flushMicrotasks(12);

      const storedDuringBatch = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];
      expect(storedDuringBatch?.questions?.q1).toMatchObject({
        id: 'q1',
        creator: '0xCreatorA',
        prompt: 'First prompt',
      });
      expect(storedDuringBatch?.questions?.q2).toBeUndefined();
      expect(storedDuringBatch?.pendingQuestionMetadata?.q1).toBeUndefined();
      expect(storedDuringBatch?.pendingQuestionMetadata?.q2).toMatchObject({
        state: 'discovered',
      });
      expect(host.getStateSnapshot()).toMatchObject({
        isQuestionCacheReady: true,
        questionResponsesNonce: 1,
      });
      expect(initSettled).toBe(false);

      secondMetadata.resolve({
        creator: '0xCreatorB',
        prompt: 'Second prompt',
      });
      await initPromise;

      const storedAfterBatch = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];
      expect(storedAfterBatch?.questions?.q2).toMatchObject({
        id: 'q2',
        creator: '0xCreatorB',
        prompt: 'Second prompt',
      });

      controller.destroy();
    });

    it('handles question metadata fetch failure by marking the question pending', async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const host = createMockHost({ activeSlug: SESSION_SLUG });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockRejectedValue(new Error('metadata missing'));

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      const pendingEntry = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.pendingQuestionMetadata?.q1;

      expect(pendingEntry).toMatchObject({
        attempts: 1,
        state: 'transient',
        lastStatus: 503,
        message: 'retry later',
      });
      expect(pendingEntry.nextRetryAtMs).toBe(2000);
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questions?.q1).toMatchObject({
        id: 'q1',
        prompt: '[encrypted]',
        sessionName: SESSION_SLUG,
        __ceQuestionMetadataPending: true,
      });
      expect(host.getStateSnapshot()).toMatchObject({
        isQuestionCacheReady: false,
      });

      controller.destroy();
    });

    it('keeps the higher persisted question responses watermark during a stale whole-cache write', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(
              {},
              {
                questionResponsesLatestBlock: 11,
              },
            ),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);
      const metadataDeferred = createDeferred();

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockReturnValue(metadataDeferred.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      await flushMicrotasks();

      host.setStored(
        'questionsCache',
        SESSION_SLUG,
        createQuestionsCacheEnvelope(
          {},
          {
            questionResponsesLatestBlock: 17,
          },
        ),
      );

      metadataDeferred.resolve({
        creator: '0xConcurrent',
        prompt: 'Recovered after concurrent write',
      });
      await initPromise;

      const stored = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];

      expect(stored?.questionResponsesLatestBlock).toBe(17);
      expect(stored?.questions?.q1).toMatchObject({
        id: 'q1',
        creator: '0xConcurrent',
        prompt: 'Recovered after concurrent write',
      });
    });

    it('atomically preserves a concurrent hydrated question at the terminal write boundary', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);
      const metadata = createDeferred();

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockReturnValue(metadata.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      await flushMicrotasks();
      host.setStored(
        'questionsCache',
        SESSION_SLUG,
        createQuestionsCacheEnvelope({
          concurrent: createPlainQuestion('concurrent', { prompt: 'Concurrent event question' }),
        }),
      );
      metadata.resolve({ creator: '0xCreator', prompt: 'Hydrated question' });
      await initPromise;

      const stored = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];
      expect(stored?.questions?.concurrent).toEqual(expect.objectContaining({ prompt: 'Concurrent event question' }));
      expect(stored?.questions?.q1).toEqual(expect.objectContaining({ prompt: 'Hydrated question' }));
      expect(host.updateQuestionsCacheAtomic).toHaveBeenCalled();
    });

    it('does not restore stale metadata for a hydrated question the active scan did not produce', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              existing: createPlainQuestion('existing', {
                prompt: 'Metadata before the scan',
                sessionSlugExplicit: true,
              }),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);
      const metadata = createDeferred();

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockReturnValue(metadata.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      await flushMicrotasks();
      host.setStored(
        'questionsCache',
        SESSION_SLUG,
        createQuestionsCacheEnvelope({
          existing: createPlainQuestion('existing', {
            prompt: 'Concurrently refreshed metadata',
            sessionSlugExplicit: true,
          }),
        }),
      );
      metadata.resolve({ creator: '0xCreator', prompt: 'Hydrated question' });
      await initPromise;

      const stored = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];
      expect(stored?.questions?.existing).toEqual(
        expect.objectContaining({ prompt: 'Concurrently refreshed metadata' }),
      );
      expect(stored?.questions?.q1).toEqual(expect.objectContaining({ prompt: 'Hydrated question' }));
    });

    it('preserves a concurrently added network branch at the terminal write boundary', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);
      const metadata = createDeferred();
      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockReturnValue(metadata.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      await flushMicrotasks();
      const concurrent = host.getStored('questionsCache', SESSION_SLUG);
      concurrent['84532'] = createQuestionCacheNetworkNode({
        questions: { other: createPlainQuestion('other', { prompt: 'Other network question' }) },
      });
      host.setStored('questionsCache', SESSION_SLUG, concurrent);
      metadata.resolve({ creator: '0xCreator', prompt: 'Hydrated question' });
      await initPromise;

      expect(host.getStored('questionsCache', SESSION_SLUG)['84532'].questions.other).toEqual(
        expect.objectContaining({ prompt: 'Other network question' }),
      );
    });

    it('preserves concurrent question hydration metadata at the terminal write boundary', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);
      const metadata = createDeferred();
      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockReturnValue(metadata.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      await flushMicrotasks();
      const concurrent = host.getStored('questionsCache', SESSION_SLUG);
      concurrent[NETWORK_ID].questionHydrationMeta = { concurrent: { status: 'ready' } };
      host.setStored('questionsCache', SESSION_SLUG, concurrent);
      metadata.resolve({ creator: '0xCreator', prompt: 'Hydrated question' });
      await initPromise;

      expect(host.getStored('questionsCache', SESSION_SLUG)[NETWORK_ID].questionHydrationMeta).toEqual({
        concurrent: { status: 'ready' },
      });
    });

    it('does not overwrite unrelated concurrent user-cache fields while adding a created question', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);
      const metadata = createDeferred();
      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockReturnValue(metadata.promise);

      const initPromise = controller.initializeQuestionCacheForGroup(SESSION_SLUG);
      await flushMicrotasks();
      host.setStored('userCache', SESSION_SLUG, {
        '0xcreator': {
          [NETWORK_ID]: {
            lastBlockScanned: 15,
            lastScanTimestamp: 15,
            data: {
              sbts: [{ address: '0xsbt' }],
              createdSurveys: [{ id: 'survey-kept' }],
              createdQuestions: [],
              surveyResponses: [],
              questionResponses: [],
            },
          },
        },
      });
      metadata.resolve({ creator: '0xCreator', prompt: 'Hydrated question' });
      await initPromise;

      const userData = host.getStored('userCache', SESSION_SLUG)['0xcreator'][NETWORK_ID].data;
      expect(userData.sbts).toEqual([{ address: '0xsbt' }]);
      expect(userData.createdSurveys).toEqual([{ id: 'survey-kept' }]);
      expect(userData.createdQuestions).toEqual([expect.objectContaining({ id: 'q1' })]);
    });

    it('does not publish question readiness when atomic persistence fails', async () => {
      const host = createMockHost({
        updateQuestionsCacheAtomic: jest.fn(async () => false),
      });
      const controller = createSessionQuestionCacheController(host);

      await expect(controller.initializeQuestionCacheForGroup(SESSION_SLUG)).rejects.toThrow(
        'Failed to persist questions cache',
      );
      expect(host.getStateSnapshot().isQuestionCacheReady).toBe(false);
      expect(host.getStateSnapshot().questionResponsesNonce).toBe(0);
    });

    it('persists incremental questionsDiscoveryCheckpointBlock frontiers before the final discovery write', async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const host = createMockHost();
      const checkpointSnapshots = [];
      const baseAtomicUpdate = host.updateQuestionsCacheAtomic;
      host.updateQuestionsCacheAtomic = jest.fn((slug, updater) => {
        return baseAtomicUpdate(slug, async (current) => {
          const value = await updater(current);
          checkpointSnapshots.push({ slug, value: deepClone(value) });
          return value;
        });
      });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.getAllQuestionIDsChunkedWithCallback.mockImplementation(
        async (mode, fromBlock, toBlock, progressCb) => {
          nowRef.value = 2000;
          progressCb({
            totalRangeBlocks: 3,
            doneSoFarBlocks: 1,
            chunkFrom: fromBlock,
            chunkTo: fromBlock,
            chunkEventCount: 0,
          });
          nowRef.value = 3301;
          progressCb({
            totalRangeBlocks: 3,
            doneSoFarBlocks: 2,
            chunkFrom: fromBlock + 1,
            chunkTo: fromBlock + 1,
            chunkEventCount: 0,
          });
          nowRef.value = 4602;
          progressCb({
            totalRangeBlocks: 3,
            doneSoFarBlocks: 3,
            chunkFrom: toBlock,
            chunkTo: toBlock,
            chunkEventCount: 0,
          });
          return [];
        },
      );

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      const checkpointWrites = checkpointSnapshots
        .filter(({ slug }) => slug === SESSION_SLUG)
        .map(({ value }) => Number(value?.[NETWORK_ID]?.questionsDiscoveryCheckpointBlock))
        .filter(Number.isFinite);

      expect(checkpointWrites).toEqual(expect.arrayContaining([10, 11, 12]));
      expect(checkpointWrites.indexOf(10)).toBeLessThan(checkpointWrites.indexOf(11));
      expect(checkpointWrites.indexOf(11)).toBeLessThan(checkpointWrites.indexOf(12));
      expect(
        host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionsDiscoveryCheckpointBlock,
      ).toBeUndefined();
    });

    it('retries pending metadata once nextRetryAtMs has passed during a skipDiscoveryScan rerun', async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const host = createMockHost({ activeSlug: SESSION_SLUG });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockRejectedValueOnce(new Error('metadata missing')).mockResolvedValueOnce({
        creator: '0xRecovered',
        prompt: 'Recovered prompt',
      });

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      const firstPending = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.pendingQuestionMetadata?.q1;

      expect(firstPending).toMatchObject({
        attempts: 1,
        nextRetryAtMs: 2000,
      });
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questions?.q1).toMatchObject({
        id: 'q1',
        prompt: '[encrypted]',
        __ceQuestionMetadataPending: true,
      });

      nowRef.value = firstPending.nextRetryAtMs + 1;
      await controller.initializeQuestionCacheForGroup(SESSION_SLUG, {
        skipDiscoveryScan: true,
      });

      const stored = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];

      expect(contractScripts.fetchUserSubmittedQuestionIDs).toHaveBeenCalledTimes(1);
      expect(contractScripts.getQuestionDataById).toHaveBeenCalledTimes(2);
      expect(stored?.questions?.q1).toMatchObject({
        id: 'q1',
        creator: '0xRecovered',
        prompt: 'Recovered prompt',
      });
      expect(stored?.questions?.q1?.__ceQuestionMetadataPending).toBeUndefined();
      expect(stored?.pendingQuestionMetadata?.q1).toBeUndefined();

      controller.destroy();
    });

    it('does not swallow a pending-metadata atomic persistence failure', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(
              {},
              {
                questionsLatestBlock: 12,
                questionsDiscoveryCheckpointBlock: 12,
                pendingQuestionMetadata: {
                  q1: { attempts: 1, nextRetryAtMs: 0, state: 'transient' },
                },
              },
            ),
          },
        },
      });
      const baseAtomicUpdate = host.updateQuestionsCacheAtomic;
      host.updateQuestionsCacheAtomic = jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockImplementation((...args) => baseAtomicUpdate(...args));
      const controller = createSessionQuestionCacheController(host);
      contractScripts.getQuestionDataById.mockResolvedValue({ creator: '0xRecovered', prompt: 'Recovered prompt' });

      await expect(controller.initializeQuestionCacheForGroup(SESSION_SLUG)).rejects.toThrow(
        'Failed to persist questions cache',
      );
      expect(host.getStateSnapshot().isQuestionCacheReady).toBe(false);
    });

    it('does not swallow a cross-slug pending-metadata persistence rejection', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(
              {},
              {
                questionsLatestBlock: 12,
                questionsDiscoveryCheckpointBlock: 12,
                pendingQuestionMetadata: {
                  q1: { attempts: 1, nextRetryAtMs: 0, state: 'transient' },
                },
              },
            ),
          },
        },
        buildMetadataSessionCacheEnvelope: jest.fn((questionData) => ({
          metadata: questionData,
          targetSlug: 'other',
        })),
        writeQuestionMetadataToCache: jest.fn().mockRejectedValue(new Error('indexeddb unavailable')),
      });
      const controller = createSessionQuestionCacheController(host);
      contractScripts.getQuestionDataById.mockResolvedValue({ creator: '0xRecovered', prompt: 'Recovered prompt' });

      await expect(controller.initializeQuestionCacheForGroup(SESSION_SLUG)).rejects.toThrow(
        'Failed to persist questions cache for other',
      );
      expect(host.getStateSnapshot().isQuestionCacheReady).toBe(false);
    });

    it('locks terminal pending metadata entries when retry policy stops further attempts', async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const host = createMockHost({ activeSlug: SESSION_SLUG });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.fetchUserSubmittedQuestionIDs.mockResolvedValue([{ questionId: 'Q1', creationBlock: 11 }]);
      contractScripts.getQuestionDataById.mockRejectedValue(new Error('gone'));
      shouldStopPendingMetadataRetry.mockReturnValue({
        stop: true,
        terminal: true,
        reachedMaxAttempts: false,
      });
      normalizeArweaveFailureMeta.mockReturnValue({
        state: 'terminal_not_found',
        status: 404,
        message: 'permanent miss',
        nextRetryAtMs: 9000,
      });

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      const pendingEntry = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.pendingQuestionMetadata?.q1;

      expect(pendingEntry).toBeDefined();
      expect(pendingEntry).toMatchObject({
        attempts: 1,
        nextRetryAtMs: 9000,
        state: 'terminal_not_found',
        lastStatus: 404,
        message: 'permanent miss',
      });

      controller.destroy();
    });

    it('sets questionCacheInitializationError on failure', async () => {
      const host = createMockHost();
      const controller = createSessionQuestionCacheController(host);

      contractScripts.getAllQuestionIDsChunkedWithCallback.mockRejectedValue(new Error('rpc down'));

      await controller.initializeQuestionCacheForGroup(SESSION_SLUG);

      expect(host.getStateSnapshot()).toMatchObject({
        questionCacheInitializationError: true,
      });
      expect(host.updateQuestionsCacheAtomic).toHaveBeenCalled();
    });
  });

  describe('refreshEncryptedQuestionPayloadsForGroup', () => {
    it('skips when no masked payloads exist', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createPlainQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG);

      expect(buildQuestionDecryptContextForSession).not.toHaveBeenCalled();
      expect(contractScripts.decryptQuestionPayloadInPlace).not.toHaveBeenCalled();
      expect(host.dgWrite).not.toHaveBeenCalled();
    });

    it('respects decrypt backoff timing', async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createMaskedQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.decryptQuestionPayloadInPlace.mockRejectedValue(new Error('decrypt failed'));

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG);

      nowRef.value = 5001;
      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG);

      expect(contractScripts.decryptQuestionPayloadInPlace).toHaveBeenCalledTimes(1);
    });

    it('calls buildQuestionDecryptContextForSession with the expected params', async () => {
      const host = createMockHost({
        network: { id: 777 },
        initialState: { litHooks: globalLitHooks },
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createMaskedQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.decryptQuestionPayloadInPlace.mockImplementation(async (question) => {
        question.masked = false;
        question.prompt = 'Open';
        question.promptDecrypted = true;
      });

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG, { force: true });

      expect(buildQuestionDecryptContextForSession).toHaveBeenCalledWith(
        expect.objectContaining({
          cfg: { networkChainId: NETWORK_ID, blockLimits: null },
          account: ACCOUNT,
          providerLike: PROVIDER_LIKE,
          litHooks: globalLitHooks,
          fallbackChainId: 777,
        }),
      );
    });

    it('skips entries that have not improved', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createMaskedQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      hasMaskedQuestionPayloadImproved.mockReturnValue(false);

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG, { force: true });

      expect(pickBetterQuestionPayload).not.toHaveBeenCalled();
      expect(host.dgWrite).not.toHaveBeenCalled();
      expect(host.queueLocalRevisionUpdate).not.toHaveBeenCalled();
    });

    it('writes improved masked payloads and queues a local revision update', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createMaskedQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      hasMaskedQuestionPayloadImproved.mockReturnValue(true);
      contractScripts.decryptQuestionPayloadInPlace.mockImplementation(async (question) => {
        question.masked = false;
        question.prompt = 'Decrypted prompt';
        question.promptDecrypted = true;
      });

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG, { force: true });

      expect(pickBetterQuestionPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'q1',
          masked: true,
          prompt: '[encrypted]',
        }),
        expect.objectContaining({
          id: 'q1',
          masked: false,
          prompt: 'Decrypted prompt',
          promptDecrypted: true,
        }),
      );
      expect(host.getStored('questionsCache', SESSION_SLUG)).toEqual(
        expect.objectContaining({
          [NETWORK_ID]: expect.objectContaining({
            questions: expect.objectContaining({
              q1: expect.objectContaining({
                id: 'q1',
                masked: false,
                prompt: 'Decrypted prompt',
                promptDecrypted: true,
              }),
            }),
          }),
        }),
      );
      expect(host.queueLocalRevisionUpdate).toHaveBeenCalledWith({
        needsQuestionResponsesNonce: true,
      });
    });

    it('preserves backoff entries created across multiple refresh batches', async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const questions = {};
      for (let index = 1; index <= 5; index += 1) {
        questions[`q${index}`] = createMaskedQuestion(`q${index}`);
      }
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(questions),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.decryptQuestionPayloadInPlace.mockRejectedValue(new Error('decrypt failed'));

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG, { force: true });

      contractScripts.decryptQuestionPayloadInPlace.mockClear();
      nowRef.value = 2000;
      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG);

      expect(contractScripts.decryptQuestionPayloadInPlace).not.toHaveBeenCalled();
    });
  });

  describe('hasMaskedQuestionPayloadInCache', () => {
    it('returns false when no masked payloads exist', () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createPlainQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      expect(controller.hasMaskedQuestionPayloadInCache(SESSION_SLUG)).toBe(false);
    });

    it('returns true when masked payloads are in the cache', () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createMaskedQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      expect(controller.hasMaskedQuestionPayloadInCache(SESSION_SLUG)).toBe(true);
    });
  });

  describe('pruneMaskedQuestionDecryptBackoff', () => {
    const seedStaggeredBackoffEntries = async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope({
              q1: createMaskedQuestion('q1'),
            }),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.decryptQuestionPayloadInPlace.mockRejectedValue(new Error('decrypt failed'));

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG, { force: true });

      host.setStored(
        'questionsCache',
        SESSION_SLUG,
        createQuestionsCacheEnvelope({
          q1: createMaskedQuestion('q1'),
          q2: createMaskedQuestion('q2'),
        }),
      );

      nowRef.value = 10000;
      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG);

      controller.pruneMaskedQuestionDecryptBackoff(32001);
      nowRef.value = 32001;
      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG);

      return contractScripts.decryptQuestionPayloadInPlace.mock.calls.map(([question]) => question.id);
    };

    it('removes expired backoff entries', async () => {
      const callIds = await seedStaggeredBackoffEntries();

      expect(callIds).toEqual(['q1', 'q2', 'q1']);
    });

    it('preserves non-expired backoff entries', async () => {
      const callIds = await seedStaggeredBackoffEntries();

      expect(callIds.filter((id) => id === 'q2')).toEqual(['q2']);
    });

    it('evicts the oldest backoff entries once the memo exceeds MASKED_Q_DECRYPT_BACKOFF_MAX', async () => {
      const nowRef = { value: 1000 };
      jest.spyOn(Date, 'now').mockImplementation(() => nowRef.value);
      const questions = {};
      for (let index = 1; index <= 15; index += 1) {
        questions[`q${index}`] = createMaskedQuestion(`q${index}`);
      }

      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: createQuestionsCacheEnvelope(questions),
          },
        },
      });
      const controller = createSessionQuestionCacheController(host);

      contractScripts.decryptQuestionPayloadInPlace.mockRejectedValue(new Error('decrypt failed'));

      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG, { force: true });

      controller.pruneMaskedQuestionDecryptBackoff(nowRef.value);
      contractScripts.decryptQuestionPayloadInPlace.mockClear();

      nowRef.value = 6000;
      await controller.refreshEncryptedQuestionPayloadsForGroup(SESSION_SLUG);

      expect(contractScripts.decryptQuestionPayloadInPlace.mock.calls.map(([question]) => question.id)).toEqual([
        'q1',
        'q2',
        'q3',
      ]);
    });
  });

  describe('buildQuestionDecryptContext', () => {
    it('delegates to buildQuestionDecryptContextForSession with correct params', () => {
      const litHooks = { getKey: jest.fn(() => 'local-lit-key') };
      const host = createMockHost({
        initialState: { litHooks },
        sessionCfg: { networkChainId: '84532', blockLimits: null },
        network: { chainId: 777 },
      });
      const controller = createSessionQuestionCacheController(host);

      const result = controller.buildQuestionDecryptContext(SESSION_SLUG);

      expect(getGlobalLitHooks).not.toHaveBeenCalled();
      expect(buildQuestionDecryptContextForSession).toHaveBeenCalledWith({
        cfg: { networkChainId: '84532', blockLimits: null },
        account: ACCOUNT,
        providerLike: PROVIDER_LIKE,
        litHooks,
        fallbackChainId: 777,
      });
      expect(result).toMatchObject({
        account: ACCOUNT,
        providerLike: PROVIDER_LIKE,
        chainId: 84532,
        litHooks,
      });
    });
  });
});
