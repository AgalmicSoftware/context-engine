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

jest.mock('ethers', () => ({
  __esModule: true,
  ethers: {
    utils: {
      isHexString: jest.fn((value, size) => size === 32 && /^0x[0-9a-fA-F]{64}$/.test(String(value || ''))),
      id: jest.fn((value) => {
        const suffix = String(value || '')
          .slice(0, 2)
          .padEnd(2, '0')
          .toLowerCase();
        return `0x${'0'.repeat(62)}${suffix}`;
      }),
    },
  },
}));

jest.mock('../web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    getSessionConfigBySlug: jest.fn(),
    getDemoSessionConfigBySlug: jest.fn(),
    getRelevantBlockWindowForFilter: jest.fn(),
    getQuestionResponsesChunkedWithCallback: jest.fn(),
    getResponse: jest.fn(),
  },
  normalizeSessionSlug: jest.fn((s) => String(s || '')),
}));

jest.mock('../crypto/cryptography.js', () => ({
  __esModule: true,
  cryptoUtils: {
    hashIdentifier: jest.fn(),
  },
}));

jest.mock('../arweave/arweaveRetryHelpers.js', () => ({
  __esModule: true,
  ensureQuestionArweaveCacheBranches: jest.fn(),
  mergeQuestionArweaveCacheBranches: jest.fn(),
}));

jest.mock('./questionResponsesWatermark.js', () => ({
  __esModule: true,
  resolvePersistedQuestionResponsesWatermark: jest.fn(),
}));

jest.mock('../session/mainSiteProgressHelpers.js', () => ({
  __esModule: true,
  shouldFlushCoalescedRun: jest.fn(),
}));

const { createSessionResponseHydrationController } = require('./sessionResponseHydrationController.js');
const { ethers } = require('ethers');
const contractScriptsModule = require('../web3/chainGateway.js');
const contractScripts = contractScriptsModule.default;
const { normalizeSessionSlug } = contractScriptsModule;
const { cryptoUtils } = require('../crypto/cryptography.js');
const {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
} = require('../arweave/arweaveRetryHelpers.js');
const { resolvePersistedQuestionResponsesWatermark } = require('./questionResponsesWatermark.js');
const { shouldFlushCoalescedRun } = require('../session/mainSiteProgressHelpers.js');
const { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } = require('../session/sessionModeProfile.js');
const { resolveWorkerCanonicalCacheIdentity } = require('./workerCanonicalCacheIdentity.js');

const NETWORK_ID = '11155420';
const SESSION_SLUG = 'alpha';
const RESPONDER = '0xResponder';
const RESPONDER_LOWER = RESPONDER.toLowerCase();
const QUESTION_ID_A = `0x${'a'.repeat(64)}`;
const QUESTION_ID_B = `0x${'b'.repeat(64)}`;
const WORKER_SESSION_ID = `0x${'5'.repeat(32)}`;

const createWorkerCanonicalSessionConfig = ({
  sessionId = WORKER_SESSION_ID,
  slug = SESSION_SLUG,
  workerUrl = 'https://alpha-response-worker.example.test',
} = {}) => ({
  slug,
  sessionId,
  corsWorkerUrl: workerUrl,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: {
      questions: 'active',
      surveys: 'active',
      responses: 'active',
    },
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      mode: 'worker_sbt_gate',
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
  questionResponsesLatestBlock: 9,
  pendingQuestionMetadata: {},
  arweaveTxCache: {},
  arweaveTxFailureCache: {},
  questionHydrationMeta: {},
  ...deepClone(overrides),
});

const createMockHost = (overrides = {}) => {
  const {
    initialState,
    initialStorage,
    mounted,
    activeSlug,
    chainId,
    account,
    providerLike,
    shouldPersistWrite,
    onWriteAttempt,
    ...rest
  } = overrides;

  const state = {
    questionResponsesNonce: 0,
    isQuestionCacheReady: false,
    isResponsesCacheReady: false,
    ...deepClone(initialState || {}),
  };
  const storage = deepClone(initialStorage || {});
  let writeAttemptCount = 0;

  const dgWrite = jest.fn((key, slug, value) => {
    writeAttemptCount += 1;
    const nextValue = deepClone(value);
    const shouldPersist =
      typeof shouldPersistWrite === 'function'
        ? shouldPersistWrite({
            key,
            slug,
            value: nextValue,
            writeAttemptCount,
            storage: deepClone(storage),
          })
        : true;

    if (typeof onWriteAttempt === 'function') {
      onWriteAttempt({
        key,
        slug,
        value: nextValue,
        writeAttemptCount,
        shouldPersist,
      });
    }
    if (!shouldPersist) return false;

    if (!storage[key]) storage[key] = {};
    storage[key][slug] = nextValue;
    return true;
  });

  const createAtomicUpdater = (key) =>
    jest.fn(async (slug, updater) => {
      const current = storage[key]?.[slug] ?? null;
      const next = await updater(deepClone(current));
      return dgWrite(key, slug, next);
    });

  return {
    setState: jest.fn((updater, cb) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      if (patch) Object.assign(state, patch);
      if (typeof cb === 'function') cb();
    }),
    isMounted: jest.fn(() => mounted !== false),
    dgRead: jest.fn((key, slug) => {
      const bucket = storage[key];
      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, slug)) {
        return null;
      }
      return deepClone(bucket[slug]);
    }),
    dgWrite,
    updateQuestionsCacheAtomic: createAtomicUpdater('questionsCache'),
    updateUserCacheAtomic: createAtomicUpdater('userCache'),
    getActiveSessionSlug: jest.fn(() => activeSlug || SESSION_SLUG),
    getSessionChainId: jest.fn(() =>
      Object.prototype.hasOwnProperty.call(overrides, 'chainId') ? chainId : NETWORK_ID,
    ),
    getAccount: jest.fn(() => (Object.prototype.hasOwnProperty.call(overrides, 'account') ? account : RESPONDER)),
    getProviderLike: jest.fn(() =>
      Object.prototype.hasOwnProperty.call(overrides, 'providerLike') ? providerLike : 'provider-like',
    ),
    scanScopeNoop: jest.fn(() => false),
    setReadinessStateIfChanged: jest.fn((patch) => {
      if (patch) Object.assign(state, patch);
    }),
    checkAllCachesReady: jest.fn(),
    mergeLegacyNumericNetworkKey: jest.fn(() => false),
    queueLocalRevisionUpdate: jest.fn(),
    getStateSnapshot: () => deepClone(state),
    getWriteAttemptCount: () => writeAttemptCount,
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

describe('createSessionResponseHydrationController', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    normalizeSessionSlug.mockImplementation((s) => String(s || ''));
    ethers.utils.isHexString.mockImplementation(
      (value, size) => size === 32 && /^0x[0-9a-fA-F]{64}$/.test(String(value || '')),
    );
    ethers.utils.id.mockImplementation((value) => {
      const suffix = String(value || '')
        .slice(0, 2)
        .padEnd(2, '0')
        .toLowerCase();
      return `0x${'0'.repeat(62)}${suffix}`;
    });
    cryptoUtils.hashIdentifier.mockImplementation((value) => {
      const suffix = String(value || '')
        .slice(0, 2)
        .padEnd(2, '0')
        .toLowerCase();
      return `0x${'0'.repeat(62)}${suffix}`;
    });
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
    resolvePersistedQuestionResponsesWatermark.mockImplementation(({ floorBlock, processedToBlock } = {}) =>
      Math.max(Number(floorBlock) || 0, Number(processedToBlock) || 0),
    );
    shouldFlushCoalescedRun.mockImplementation(({ force }) => !!force);
    contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 10, toBlock: 12 });
    contractScripts.getSessionConfigBySlug.mockReturnValue(null);
    contractScripts.getDemoSessionConfigBySlug.mockReturnValue(null);
    contractScripts.getQuestionResponsesChunkedWithCallback.mockResolvedValue(undefined);
    contractScripts.getResponse.mockResolvedValue(null);
  });

  it('hydrates fresh worker-canonical question responses without starting an EVM scan', async () => {
    const sessionConfig = createWorkerCanonicalSessionConfig({ slug: 'demo-sh' });
    const loadWorkerResponses = jest.fn().mockResolvedValue([
      {
        questionId: QUESTION_ID_A,
        responder: RESPONDER_LOWER,
        response: {
          questionID: QUESTION_ID_A,
          responder: RESPONDER,
          prompt: 'Worker-backed question',
          type: 'binary',
          answer: { value: true },
        },
        storageRefId: 'worker-response-ref',
        timestamp: Math.floor(Date.parse('2026-07-22T12:00:00.000Z') / 1000),
      },
    ]);
    const host = createMockHost({
      chainId: null,
      getSessionCfg: jest.fn(() => sessionConfig),
      scanScopeNoop: jest.fn(() => true),
      loadWorkerResponses,
    });
    const controller = createSessionResponseHydrationController(host);

    await controller.fetchQuestionResponsesChunkedForGroup('demo-sh');

    expect(loadWorkerResponses).toHaveBeenCalledWith(
      expect.objectContaining({
        account: RESPONDER,
        providerLike: 'provider-like',
        sessionSlug: 'demo-sh',
        sessionConfig: expect.objectContaining({ slug: 'demo-sh' }),
      }),
    );
    expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    expect(contractScripts.getQuestionResponsesChunkedWithCallback).not.toHaveBeenCalled();
    expect(host.getStored('questionsCache', 'demo-sh')).toMatchObject({
      worker: {
        questionResponses: {
          [QUESTION_ID_A]: {
            [RESPONDER_LOWER]: expect.objectContaining({ answer: { value: true } }),
          },
        },
        workerResponseStorageRefs: {
          'worker-response-ref': Math.floor(Date.parse('2026-07-22T12:00:00.000Z') / 1000),
        },
      },
    });
    expect(host.getStateSnapshot()).toMatchObject({
      isResponsesCacheReady: true,
      questionResponsesNonce: 1,
    });
  });

  it('starts same-slug Worker B independently, clears empty B, and discards delayed Worker A responses', async () => {
    const sessionConfigA = createWorkerCanonicalSessionConfig();
    const sessionConfigB = createWorkerCanonicalSessionConfig({
      sessionId: `0x${'8'.repeat(32)}`,
      workerUrl: 'https://alpha-response-worker-b.example.test',
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
    const loadWorkerResponses = jest.fn(({ sessionConfig }) => {
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
                  [QUESTION_ID_A]: {
                    id: QUESTION_ID_A,
                    prompt: 'Cached Session A question',
                  },
                },
                questionResponses: {
                  [QUESTION_ID_A]: {
                    [RESPONDER_LOWER]: { answer: { value: true } },
                  },
                },
              }),
              workerCanonicalIdentity: identityA,
            },
          },
        },
        userCache: {
          [SESSION_SLUG]: {
            [RESPONDER_LOWER]: {
              worker: {
                lastBlockScanned: 0,
                lastScanTimestamp: 1,
                data: {
                  sbts: [],
                  createdSurveys: [],
                  createdQuestions: [],
                  surveyResponses: [],
                  questionResponses: [{ questionId: QUESTION_ID_A }],
                },
                workerCanonicalIdentity: identityA,
              },
            },
          },
        },
      },
      getSessionCfg: jest.fn(() => currentSessionConfig),
      loadWorkerResponses,
    });
    const controller = createSessionResponseHydrationController(host);

    const runA = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);
    await workerALoaderStarted.promise;
    expect(controller.isInitInFlight(SESSION_SLUG)).toBe(true);

    currentSessionConfig = sessionConfigB;
    const runB = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);
    await workerBLoaderStarted.promise;

    expect(loadWorkerResponses).toHaveBeenCalledTimes(2);
    expect(host.getStored('questionsCache', SESSION_SLUG).worker).toMatchObject({
      questions: {},
      questionResponses: {},
      workerCanonicalIdentity: identityB,
    });
    expect(host.getStored('userCache', SESSION_SLUG)[RESPONDER_LOWER].worker).toBeUndefined();

    delayedB.resolve([]);
    await runB;
    delayedA.resolve([
      {
        questionId: QUESTION_ID_B,
        responder: RESPONDER_LOWER,
        response: {
          questionID: QUESTION_ID_B,
          prompt: 'Delayed Session A question',
          answer: { value: false },
        },
        storageRefId: 'worker-response-a-delayed',
        timestamp: 2,
      },
    ]);
    await runA;

    expect(host.getStored('questionsCache', SESSION_SLUG).worker).toMatchObject({
      questions: {},
      questionResponses: {},
      workerCanonicalIdentity: identityB,
    });
    expect(host.getStored('userCache', SESSION_SLUG)[RESPONDER_LOWER].worker).toBeUndefined();
    expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('isInitInFlight', () => {
    it('returns false when no hydration is running', () => {
      const controller = createSessionResponseHydrationController(createMockHost());

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);
    });
  });

  describe('destroy', () => {
    it('marks as destroyed and clears continuation timers', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const firstRun = createDeferred();

      contractScripts.getQuestionResponsesChunkedWithCallback
        .mockImplementationOnce(() => firstRun.promise)
        .mockResolvedValueOnce(undefined);

      const firstPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);
      const secondPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG, {
        forceArweaveFetch: true,
      });

      firstRun.resolve();
      await Promise.all([firstPromise, secondPromise]);

      controller.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      jest.runOnlyPendingTimers();
      await flushMicrotasks();

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
      expect(contractScripts.getQuestionResponsesChunkedWithCallback).toHaveBeenCalledTimes(1);
    });

    it('resets in-flight tracking', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValue(deferred.promise);

      const hydrationPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(true);

      controller.destroy();

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await hydrationPromise;
    });
  });

  describe('fetchQuestionResponsesChunkedForGroup', () => {
    it('short-circuits via scanScopeNoop and marks responses ready', async () => {
      const host = createMockHost({
        scanScopeNoop: jest.fn((slug, op, onSkipped) => {
          onSkipped();
          return true;
        }),
      });
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 1,
      });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent calls for the same slug', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValueOnce(deferred.promise);

      const firstPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);
      const secondPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(true);

      deferred.resolve({ fromBlock: 12, toBlock: 11 });
      await Promise.all([firstPromise, secondPromise]);

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);
    });

    it('settles concurrent calls after the shared in-flight run completes', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const deferred = createDeferred();
      const firstSettled = jest.fn();
      const secondSettled = jest.fn();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValueOnce(deferred.promise);

      const firstPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);
      const secondPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);
      firstPromise.then(firstSettled);
      secondPromise.then(secondSettled);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(true);
      await flushMicrotasks();
      expect(firstSettled).not.toHaveBeenCalled();
      expect(secondSettled).not.toHaveBeenCalled();

      deferred.resolve({ fromBlock: 12, toBlock: 11 });
      await Promise.all([firstPromise, secondPromise]);

      expect(controller.isInitInFlight(SESSION_SLUG)).toBe(false);
      expect(firstSettled).toHaveBeenCalledTimes(1);
      expect(secondSettled).toHaveBeenCalledTimes(1);
    });

    it('queues pending hydration when one is already in flight', async () => {
      jest.useFakeTimers();
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter
        .mockReturnValueOnce(deferred.promise)
        .mockResolvedValueOnce({ fromBlock: 10, toBlock: 12 });

      const firstPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);
      const secondPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG, {
        forceArweaveFetch: true,
      });

      deferred.resolve({ fromBlock: 12, toBlock: 11 });
      await Promise.all([firstPromise, secondPromise]);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);

      jest.runOnlyPendingTimers();
      await flushMicrotasks();

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(2);
      expect(contractScripts.getQuestionResponsesChunkedWithCallback).toHaveBeenCalledTimes(1);
      expect(contractScripts.getQuestionResponsesChunkedWithCallback.mock.calls[0][6]).toEqual({
        forceArweaveFetch: true,
      });
    });

    it('aborts when no chainId is available', async () => {
      const host = createMockHost({ chainId: null });
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 1,
      });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
    });

    it('handles empty block window when fromBlock is greater than toBlock', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({ fromBlock: 12, toBlock: 11 });

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: SESSION_SLUG,
          blockLimits: { start: 10, end: null },
        }),
      );
      expect(contractScripts.getQuestionResponsesChunkedWithCallback).not.toHaveBeenCalled();
      expect(resolvePersistedQuestionResponsesWatermark).not.toHaveBeenCalled();
      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 1,
      });
    });

    it('skips when already up-to-date', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: {
              [NETWORK_ID]: createQuestionCacheNetworkNode({
                questionResponsesLatestBlock: 12,
              }),
            },
          },
        },
      });
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(contractScripts.getQuestionResponsesChunkedWithCallback).not.toHaveBeenCalled();
      expect(host.dgWrite).not.toHaveBeenCalled();
      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 1,
      });
    });

    it('initializes cache structure on first run and calls getQuestionResponsesChunkedWithCallback', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG, {
        forceArweaveFetch: true,
      });

      expect(contractScripts.getQuestionResponsesChunkedWithCallback).toHaveBeenCalledWith(
        'none',
        10,
        12,
        expect.any(Function),
        expect.any(Function),
        SESSION_SLUG,
        { forceArweaveFetch: true },
      );

      const stored = host.getStored('questionsCache', SESSION_SLUG);

      expect(stored?.[NETWORK_ID]).toEqual(
        expect.objectContaining({
          questionsLatestBlock: 9,
          questionsDiscoveryCheckpointBlock: 9,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},
          questionResponsesLatestBlock: 12,
          pendingQuestionMetadata: {},
          arweaveTxCache: {},
          arweaveTxFailureCache: {},
          questionHydrationMeta: {},
        }),
      );
      expect(ensureQuestionArweaveCacheBranches).toHaveBeenCalled();
    });

    it('keeps response payloads for the active session name and filters explicit foreign sessions', async () => {
      contractScripts.getSessionConfigBySlug.mockReturnValue({
        slug: SESSION_SLUG,
        sessionName: 'Alpha Session',
      });
      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: RESPONDER,
                  response: {
                    type: 'binary',
                    sessionName: 'Alpha Session',
                    answer: { value: 'Agree', encrypted: false },
                  },
                  blockNumber: 10,
                  transactionIndex: 0,
                  logIndex: 0,
                },
                {
                  responder: '0xForeign',
                  response: {
                    type: 'binary',
                    sessionName: 'Beta Session',
                    answer: { value: 'Disagree', encrypted: false },
                  },
                  blockNumber: 11,
                  transactionIndex: 0,
                  logIndex: 0,
                },
                {
                  responder: '0xStringForeign',
                  response: JSON.stringify({
                    type: 'binary',
                    sessionSlug: 'beta',
                    answer: { value: 'Unsure', encrypted: false },
                  }),
                  blockNumber: 11,
                  transactionIndex: 1,
                  logIndex: 0,
                },
                {
                  responder: '0xLegacy',
                  response: {
                    type: 'binary',
                    answer: { value: 'Agree', encrypted: false },
                  },
                  blockNumber: 12,
                  transactionIndex: 0,
                  logIndex: 0,
                },
              ],
            },
            12,
          );
        },
      );
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      const questionResponses =
        host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponses?.[QUESTION_ID_A] || {};
      expect(questionResponses[RESPONDER_LOWER]).toEqual(
        expect.objectContaining({
          sessionName: 'Alpha Session',
        }),
      );
      expect(questionResponses['0xlegacy']).toEqual(
        expect.objectContaining({
          type: 'binary',
        }),
      );
      expect(questionResponses['0xforeign']).toBeUndefined();
      expect(questionResponses['0xstringforeign']).toBeUndefined();
      expect(
        host.getStored('userCache', SESSION_SLUG)?.['0xforeign']?.[NETWORK_ID]?.data?.questionResponses,
      ).toBeUndefined();
    });

    it('keeps historical built-in demo responses when the route writes to the legacy general bucket', async () => {
      contractScripts.getDemoSessionConfigBySlug.mockImplementation((slug, opts = {}) => {
        if (slug === '' && opts?.allowDemoFallback === true) {
          return {
            slug: '',
            sessionName: 'Context Engine',
          };
        }
        return null;
      });
      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: '0xContext',
                  response: {
                    type: 'binary',
                    sessionName: 'Context Engine',
                    answer: { value: 'yes', encrypted: false },
                  },
                  blockNumber: 10,
                  transactionIndex: 0,
                  logIndex: 0,
                },
                {
                  responder: '0xDemoSlug',
                  response: JSON.stringify({
                    type: 'binary',
                    sessionSlug: 'demo',
                    answer: { value: 'no', encrypted: false },
                  }),
                  blockNumber: 11,
                  transactionIndex: 0,
                  logIndex: 0,
                },
                {
                  responder: '0xForeign',
                  response: {
                    type: 'binary',
                    sessionName: 'Beta Session',
                    answer: { value: 'Agree', encrypted: false },
                  },
                  blockNumber: 12,
                  transactionIndex: 0,
                  logIndex: 0,
                },
              ],
            },
            12,
          );
        },
      );
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup('');

      const questionResponses =
        host.getStored('questionsCache', '')?.[NETWORK_ID]?.questionResponses?.[QUESTION_ID_A] || {};
      expect(questionResponses['0xcontext']).toEqual(
        expect.objectContaining({
          sessionName: 'Context Engine',
        }),
      );
      expect(questionResponses['0xdemoslug']).toEqual(expect.stringContaining('"sessionSlug":"demo"'));
      expect(questionResponses['0xforeign']).toBeUndefined();
      expect(host.getStored('userCache', '')?.['0xforeign']?.[NETWORK_ID]?.data?.questionResponses).toBeUndefined();
    });

    it('splits broad response scans into bounded persisted windows', async () => {
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({
        fromBlock: 10,
        toBlock: 20015,
      });
      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementation(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb({}, toBlock);
        },
      );
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(contractScripts.getQuestionResponsesChunkedWithCallback).toHaveBeenCalledTimes(3);
      expect(
        contractScripts.getQuestionResponsesChunkedWithCallback.mock.calls.map((call) => [call[1], call[2]]),
      ).toEqual([
        [10, 10009],
        [10010, 20009],
        [20010, 20015],
      ]);
      expect(resolvePersistedQuestionResponsesWatermark).toHaveBeenCalledWith({
        floorBlock: 9,
        processedToBlock: 20015,
      });
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponsesLatestBlock).toBe(20015);
    });

    it('advances the response watermark when a completed scan emits no partial data callback', async () => {
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({
        fromBlock: 10,
        toBlock: 12,
      });
      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(async () => {
        // Some reader implementations resolve an empty window without invoking
        // the partial-data callback. The controller still owns the scan watermark.
      });
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(resolvePersistedQuestionResponsesWatermark).toHaveBeenCalledWith({
        floorBlock: 9,
        processedToBlock: 12,
      });
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponsesLatestBlock).toBe(12);
    });

    it('scans the first historical response window before recent prefetch', async () => {
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({
        fromBlock: 10,
        toBlock: 140010,
      });
      let callCount = 0;
      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementation(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          callCount += 1;
          if (callCount === 1) {
            dataCb(
              {
                [QUESTION_ID_A]: [
                  {
                    responder: RESPONDER,
                    response: 'early-live-response',
                    blockNumber: toBlock,
                    transactionIndex: 0,
                    logIndex: 0,
                    timestamp: 120,
                  },
                ],
              },
              toBlock,
            );
            return;
          }
          if (callCount === 2) {
            throw new Error('stop recent prefetch after first attempted window');
          }
          throw new Error('stop historical scan after first persisted window');
        },
      );
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(contractScripts.getQuestionResponsesChunkedWithCallback.mock.calls[0].slice(1, 3)).toEqual([10, 10009]);
      expect(contractScripts.getQuestionResponsesChunkedWithCallback.mock.calls[1].slice(1, 3)).toEqual([20011, 30010]);
      expect(contractScripts.getQuestionResponsesChunkedWithCallback.mock.calls[2].slice(1, 3)).toEqual([10010, 20009]);
      expect(resolvePersistedQuestionResponsesWatermark).toHaveBeenCalledWith({
        floorBlock: 9,
        processedToBlock: 10009,
      });
      expect(
        host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponses?.[QUESTION_ID_A]?.[
          RESPONDER_LOWER
        ],
      ).toBe('early-live-response');
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponsesLatestBlock).toBe(10009);
      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 2,
      });
    });

    it('calls resolvePersistedQuestionResponsesWatermark to clamp the final watermark', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: RESPONDER,
                  response: 'yes',
                  blockNumber: 12,
                },
              ],
            },
            12,
          );
        },
      );

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(resolvePersistedQuestionResponsesWatermark).toHaveBeenCalledWith({
        floorBlock: 9,
        processedToBlock: 12,
      });
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponsesLatestBlock).toBe(12);
    });

    it('flushes intermediate partial chunks and preserves merged cache state across later chunks', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const deferred = createDeferred();
      let partialFlushChecks = 0;
      let intermediateWriteKeys = [];

      shouldFlushCoalescedRun.mockImplementation(({ force }) => {
        if (force) return true;
        partialFlushChecks += 1;
        return partialFlushChecks === 2;
      });
      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: RESPONDER,
                  response: 'chunk-one',
                  blockNumber: 10,
                  transactionIndex: 0,
                  logIndex: 0,
                  timestamp: 100,
                },
              ],
            },
            10,
          );
          dataCb(
            {
              [QUESTION_ID_B]: [
                {
                  responder: RESPONDER,
                  response: 'chunk-two',
                  blockNumber: 11,
                  transactionIndex: 0,
                  logIndex: 0,
                  timestamp: 101,
                },
              ],
            },
            11,
          );
          intermediateWriteKeys = host.dgWrite.mock.calls.map(([key]) => key);
          await deferred.promise;
        },
      );

      const hydrationPromise = controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      await flushMicrotasks();

      expect(intermediateWriteKeys).toEqual(['questionsCache', 'userCache']);

      deferred.resolve();
      await hydrationPromise;

      const storedQuestionsCache = host.getStored('questionsCache', SESSION_SLUG);
      const storedUserCache = host.getStored('userCache', SESSION_SLUG);

      expect(storedQuestionsCache?.[NETWORK_ID]?.questionResponses).toMatchObject({
        [QUESTION_ID_A]: {
          [RESPONDER_LOWER]: 'chunk-one',
        },
        [QUESTION_ID_B]: {
          [RESPONDER_LOWER]: 'chunk-two',
        },
      });
      expect(storedQuestionsCache?.[NETWORK_ID]?.questionResponsesLatestBlock).toBe(12);
      expect(storedUserCache?.[RESPONDER_LOWER]?.[NETWORK_ID]?.data?.questionResponses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            questionId: QUESTION_ID_A,
            responder: RESPONDER_LOWER,
            response: 'chunk-one',
          }),
          expect.objectContaining({
            questionId: QUESTION_ID_B,
            responder: RESPONDER_LOWER,
            response: 'chunk-two',
          }),
        ]),
      );
      expect(storedQuestionsCache?.[NETWORK_ID]?.pendingQuestionMetadata?.[QUESTION_ID_A]).toEqual(
        expect.objectContaining({ state: 'discovered-from-response' }),
      );
      expect(storedQuestionsCache?.[NETWORK_ID]?.questions?.[QUESTION_ID_A]).toBeUndefined();
    });

    it('seeds provisional question metadata from live response payloads with prompt and type', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const responsePayload = {
        type: 'binary',
        prompt: 'AI development should pause until safety challenges are resolved.',
        answer: { value: 'Agree', encrypted: false },
      };

      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: RESPONDER,
                  response: responsePayload,
                  blockNumber: 10,
                  transactionIndex: 0,
                  logIndex: 0,
                  timestamp: 100,
                },
              ],
            },
            10,
          );
        },
      );

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      const storedNet = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];
      expect(storedNet?.questionResponses?.[QUESTION_ID_A]?.[RESPONDER_LOWER]).toEqual(responsePayload);
      expect(storedNet?.questions?.[QUESTION_ID_A]).toEqual(
        expect.objectContaining({
          id: QUESTION_ID_A,
          prompt: responsePayload.prompt,
          type: 'binary',
          questionType: 'binary',
          sessionSlug: SESSION_SLUG,
          sessionSlugExplicit: true,
          source: 'response-payload',
          __ceQuestionMetadataFromResponse: true,
        }),
      );
      expect(storedNet?.pendingQuestionMetadata?.[QUESTION_ID_A]).toBeUndefined();
    });

    it('marks response metadata from the general bucket as authoritative for legacy demo route reads', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const responsePayload = {
        type: 'binary',
        prompt: 'Historical demo response-backed prompt.',
        answer: { value: 'Unsure', encrypted: false },
      };

      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: RESPONDER,
                  response: responsePayload,
                  blockNumber: 10,
                  transactionIndex: 0,
                  logIndex: 0,
                  timestamp: 100,
                },
              ],
            },
            10,
          );
        },
      );

      await controller.fetchQuestionResponsesChunkedForGroup('');

      const storedNet = host.getStored('questionsCache', '')?.[NETWORK_ID];
      expect(storedNet?.questions?.[QUESTION_ID_A]).toEqual(
        expect.objectContaining({
          id: QUESTION_ID_A,
          prompt: responsePayload.prompt,
          type: 'binary',
          questionType: 'binary',
          sessionSlug: '',
          sessionSlugExplicit: true,
          source: 'response-payload',
          __ceQuestionMetadataFromResponse: true,
        }),
      );
      expect(storedNet?.pendingQuestionMetadata?.[QUESTION_ID_A]).toBeUndefined();
    });

    it('keeps responses ready and clamps the final watermark when a managed questionsCache write returns false', async () => {
      let partialFlushChecks = 0;
      let failedQuestionsWrites = 0;
      const host = createMockHost({
        shouldPersistWrite: ({ key, value }) => {
          const shouldFail = key === 'questionsCache' && value?.[NETWORK_ID]?.questionResponsesLatestBlock === 12;
          if (shouldFail) failedQuestionsWrites += 1;
          return !shouldFail;
        },
      });
      const controller = createSessionResponseHydrationController(host);

      shouldFlushCoalescedRun.mockImplementation(({ force }) => {
        if (force) return true;
        partialFlushChecks += 1;
        return partialFlushChecks === 1;
      });
      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: RESPONDER,
                  response: 'persisted-chunk',
                  blockNumber: 10,
                  transactionIndex: 0,
                  logIndex: 0,
                  timestamp: 100,
                },
              ],
            },
            10,
          );
          dataCb(
            {
              [QUESTION_ID_B]: [
                {
                  responder: RESPONDER,
                  response: 'failed-chunk',
                  blockNumber: 12,
                  transactionIndex: 0,
                  logIndex: 0,
                  timestamp: 101,
                },
              ],
            },
            12,
          );
        },
      );

      await expect(controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG)).rejects.toThrow(
        'Failed to persist questions cache',
      );

      expect(failedQuestionsWrites).toBeGreaterThanOrEqual(1);
      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 2,
      });
      expect(resolvePersistedQuestionResponsesWatermark).toHaveBeenCalledWith({
        floorBlock: 9,
        processedToBlock: 10,
      });
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponsesLatestBlock).toBe(10);
    });

    it('marks responses ready when chunk fetching rejects after emitting partial data', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementationOnce(
        async (mode, fromBlock, toBlock, progressCb, dataCb) => {
          dataCb(
            {
              [QUESTION_ID_A]: [
                {
                  responder: RESPONDER,
                  response: 'partial-before-error',
                  blockNumber: 12,
                  transactionIndex: 1,
                  logIndex: 0,
                  timestamp: 111,
                },
              ],
            },
            12,
          );
          throw new Error('partial failure');
        },
      );

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 1,
      });
      expect(resolvePersistedQuestionResponsesWatermark).toHaveBeenCalledWith({
        floorBlock: 9,
        processedToBlock: 12,
      });
      expect(host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponsesLatestBlock).toBe(12);
      expect(
        host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID]?.questionResponses?.[QUESTION_ID_A]?.[
          RESPONDER_LOWER
        ],
      ).toBe('partial-before-error');
    });

    it('sets isResponsesCacheReady true and bumps nonce on completion', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG);

      expect(host.getStateSnapshot()).toMatchObject({
        isResponsesCacheReady: true,
        questionResponsesNonce: 1,
      });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
    });

    it('notifies on background completion when notifyOnCompletion is set', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({ fromBlock: 12, toBlock: 11 });

      await controller.fetchQuestionResponsesChunkedForGroup(SESSION_SLUG, {
        background: true,
        notifyOnCompletion: true,
      });

      expect(host.queueLocalRevisionUpdate).toHaveBeenCalledWith({
        needsQuestionResponsesNonce: true,
      });
      expect(host.setState).not.toHaveBeenCalled();
      expect(host.checkAllCachesReady).not.toHaveBeenCalled();
    });
  });

  describe('refreshQuestionResponses', () => {
    it('falls back to full refresh when forceFull is true', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.refreshQuestionResponses([QUESTION_ID_A], {
        forceFull: true,
        responder: RESPONDER,
      });

      expect(host.setReadinessStateIfChanged).toHaveBeenCalledWith({
        isQuestionCacheReady: false,
        isResponsesCacheReady: false,
      });
      expect(contractScripts.getResponse).not.toHaveBeenCalled();
      expect(contractScripts.getQuestionResponsesChunkedWithCallback).toHaveBeenCalledTimes(1);
    });

    it('falls back to full refresh when no responder is available', async () => {
      const host = createMockHost({ account: '' });
      const controller = createSessionResponseHydrationController(host);

      await controller.refreshQuestionResponses([QUESTION_ID_A]);

      expect(host.setReadinessStateIfChanged).toHaveBeenCalledWith({
        isQuestionCacheReady: false,
        isResponsesCacheReady: false,
      });
      expect(contractScripts.getResponse).not.toHaveBeenCalled();
      expect(contractScripts.getQuestionResponsesChunkedWithCallback).toHaveBeenCalledTimes(1);
    });

    it('falls back to full refresh when no questionIds are provided', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      await controller.refreshQuestionResponses([]);

      expect(host.setReadinessStateIfChanged).toHaveBeenCalledWith({
        isQuestionCacheReady: false,
        isResponsesCacheReady: false,
      });
      expect(contractScripts.getResponse).not.toHaveBeenCalled();
      expect(contractScripts.getQuestionResponsesChunkedWithCallback).toHaveBeenCalledTimes(1);
    });

    it('runs targeted refresh when canTarget conditions are met and bumps questionResponsesNonce', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);

      contractScripts.getResponse.mockResolvedValueOnce('targeted-answer');

      await controller.refreshQuestionResponses([QUESTION_ID_A], {
        responder: RESPONDER,
      });

      expect(contractScripts.getResponse).toHaveBeenCalledWith('none', RESPONDER_LOWER, QUESTION_ID_A, SESSION_SLUG);
      expect(contractScripts.getQuestionResponsesChunkedWithCallback).not.toHaveBeenCalled();
      expect(host.queueLocalRevisionUpdate).toHaveBeenCalledWith({
        needsQuestionResponsesNonce: true,
        checkAllCachesReady: true,
      });
      expect(host.getStateSnapshot()).toMatchObject({
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
      });
    });

    it('normalizes raw ids via ethers.utils.id, filters invalid hashes, and deduplicates mixed-case ids before targeted queries', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const upperCaseQuestionIdA = `0x${'A'.repeat(64)}`;
      cryptoUtils.hashIdentifier
        .mockReset()
        .mockImplementationOnce(() => {
          throw new Error('fallback to ethers.utils.id');
        })
        .mockReturnValueOnce('not-a-hex-hash')
        .mockImplementationOnce(() => {
          throw new Error('fallback to ethers.utils.id');
        });

      contractScripts.getResponse.mockImplementation(async (mode, responder, qId) => `response-for:${qId.slice(-4)}`);

      await controller.refreshQuestionResponses(
        [upperCaseQuestionIdA, QUESTION_ID_A, 'ab-topic-1', 'bad-id', 'ab-topic-1'],
        { responder: RESPONDER },
      );

      expect(cryptoUtils.hashIdentifier).toHaveBeenCalledWith('ab-topic-1');
      expect(cryptoUtils.hashIdentifier).toHaveBeenCalledWith('bad-id');
      expect(contractScripts.getResponse).toHaveBeenCalledTimes(2);
      const targetedQuestionIds = contractScripts.getResponse.mock.calls.map((args) => args[2]);
      expect(targetedQuestionIds[0]).toBe(QUESTION_ID_A);
      expect(targetedQuestionIds[1]).toMatch(/^0x[0-9a-f]{64}$/);
      expect(targetedQuestionIds[1]).not.toBe(QUESTION_ID_A);
      expect(targetedQuestionIds).not.toContain('not-a-hex-hash');
      expect(new Set(targetedQuestionIds).size).toBe(2);
    });

    it('writes updated responses to questionsCache and userCache', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const responseValue = { choice: 'A' };

      contractScripts.getResponse.mockResolvedValueOnce(responseValue);

      await controller.refreshQuestionResponses([QUESTION_ID_A], {
        responder: RESPONDER,
      });

      const storedQuestionsCache = host.getStored('questionsCache', SESSION_SLUG);
      const storedUserCache = host.getStored('userCache', SESSION_SLUG);
      const userResponses = storedUserCache?.[RESPONDER_LOWER]?.[NETWORK_ID]?.data?.questionResponses || [];

      expect(storedQuestionsCache?.[NETWORK_ID]?.questionResponses?.[QUESTION_ID_A]?.[RESPONDER_LOWER]).toEqual(
        responseValue,
      );
      expect(storedQuestionsCache?.[NETWORK_ID]?.pendingQuestionMetadata?.[QUESTION_ID_A]).toEqual(
        expect.objectContaining({ state: 'discovered-from-response' }),
      );
      expect(storedQuestionsCache?.[NETWORK_ID]?.questions?.[QUESTION_ID_A]).toBeUndefined();
      expect(userResponses).toContainEqual({
        questionId: QUESTION_ID_A,
        responder: RESPONDER_LOWER,
        response: responseValue,
        blockNumber: 0,
        transactionIndex: 0,
        logIndex: 0,
        timestamp: 0,
      });
    });

    it('seeds provisional question metadata from targeted response refresh payloads', async () => {
      const host = createMockHost();
      const controller = createSessionResponseHydrationController(host);
      const responseValue = {
        type: 'binary',
        prompt: 'Open-source frontier AI models should be encouraged.',
        answer: { value: 'Unsure', encrypted: false },
      };

      contractScripts.getResponse.mockResolvedValueOnce(responseValue);

      await controller.refreshQuestionResponses([QUESTION_ID_A], {
        responder: RESPONDER,
      });

      const storedNet = host.getStored('questionsCache', SESSION_SLUG)?.[NETWORK_ID];
      expect(storedNet?.questions?.[QUESTION_ID_A]).toEqual(
        expect.objectContaining({
          id: QUESTION_ID_A,
          prompt: responseValue.prompt,
          type: 'binary',
          questionType: 'binary',
          sessionSlug: SESSION_SLUG,
          sessionSlugExplicit: true,
          source: 'response-payload',
          __ceQuestionMetadataFromResponse: true,
        }),
      );
      expect(storedNet?.pendingQuestionMetadata?.[QUESTION_ID_A]).toBeUndefined();
      expect(storedNet?.questionResponses?.[QUESTION_ID_A]?.[RESPONDER_LOWER]).toEqual(responseValue);
    });

    it('clamps legacy synthetic logIndex values', async () => {
      const host = createMockHost({
        initialStorage: {
          questionsCache: {
            [SESSION_SLUG]: {
              [NETWORK_ID]: createQuestionCacheNetworkNode({
                questionResponses: {
                  [QUESTION_ID_B]: {
                    [RESPONDER_LOWER]: 'stale-response',
                  },
                },
                questionResponsesMeta: {
                  [QUESTION_ID_B]: {
                    [RESPONDER_LOWER]: {
                      bn: 50,
                      txi: 4,
                      li: 1005,
                      ts: 99,
                    },
                  },
                },
              }),
            },
          },
        },
      });
      const controller = createSessionResponseHydrationController(host);

      contractScripts.getResponse.mockResolvedValueOnce('fresh-response');

      await controller.refreshQuestionResponses([QUESTION_ID_B], {
        responder: RESPONDER,
      });

      const storedQuestionsCache = host.getStored('questionsCache', SESSION_SLUG);
      const storedUserCache = host.getStored('userCache', SESSION_SLUG);
      const storedMeta = storedQuestionsCache?.[NETWORK_ID]?.questionResponsesMeta?.[QUESTION_ID_B]?.[RESPONDER_LOWER];
      const userEntry = storedUserCache?.[RESPONDER_LOWER]?.[NETWORK_ID]?.data?.questionResponses?.[0];

      expect(storedMeta).toEqual({ bn: 0, txi: 0, li: 0, ts: 0 });
      expect(userEntry).toMatchObject({
        questionId: QUESTION_ID_B,
        responder: RESPONDER_LOWER,
        response: 'fresh-response',
        blockNumber: 0,
        transactionIndex: 0,
        logIndex: 0,
        timestamp: 0,
      });
    });
  });
});
