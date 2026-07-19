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
    fetchUserSubmittedSurveyIDs: jest.fn(),
    getSurveyDataById: jest.fn(),
    fetchAllSurveyResponses: jest.fn(),
    listenForSurveyEvents: jest.fn(),
    removeSurveyEventsListener: jest.fn(),
  },
  normalizeSessionSlug: jest.fn((s) => String(s || '')),
}));

jest.mock('../arweave/arweaveRetryHelpers.js', () => ({
  __esModule: true,
  normalizeArweaveFailureMeta: jest.fn(),
  shouldStopPendingMetadataRetry: jest.fn(),
}));

jest.mock('./metadataCacheEntryBuilders.js', () => ({
  __esModule: true,
  prepareSurveyMetadataCacheEntry: jest.fn(),
}));

jest.mock('../session/metadataSessionBinding.js', () => ({
  __esModule: true,
  resolveScopedMetadataSessionSlug: jest.fn(),
}));

const { createSessionSurveyCacheController } = require('./sessionSurveyCacheController.js');
const contractScriptsModule = require('../web3/chainGateway.js');
const contractScripts = contractScriptsModule.default;
const { normalizeSessionSlug } = contractScriptsModule;
const { normalizeArweaveFailureMeta, shouldStopPendingMetadataRetry } = require('../arweave/arweaveRetryHelpers.js');
const { prepareSurveyMetadataCacheEntry } = require('./metadataCacheEntryBuilders.js');
const { resolveScopedMetadataSessionSlug } = require('../session/metadataSessionBinding.js');

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

const createMockHost = (overrides = {}) => {
  const { initialState, initialStorage, mounted, activeSlug, chainId, sessionScanScope, ...rest } = overrides;

  const state = {
    surveyCacheInitializationError: false,
    ...deepClone(initialState || {}),
  };
  const storage = deepClone(initialStorage || {});
  let atomicUpdateTail = Promise.resolve();

  const updateSurveysCacheAtomic = jest.fn((slug, updater) => {
    const operation = atomicUpdateTail.then(async () => {
      await Promise.resolve();
      const current = storage.surveysCache?.[slug] ?? null;
      const next = await updater(deepClone(current));
      if (!storage.surveysCache) storage.surveysCache = {};
      storage.surveysCache[slug] = deepClone(next);
      return true;
    });
    atomicUpdateTail = operation.catch(() => undefined);
    return operation;
  });

  const updateUserCacheAtomic = jest.fn(async (slug, updater) => {
    const current = storage.userCache?.[slug] ?? null;
    const next = await updater(deepClone(current));
    if (!storage.userCache) storage.userCache = {};
    storage.userCache[slug] = deepClone(next);
    return true;
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
    dgWrite: jest.fn(async (key, slug, value) => {
      await Promise.resolve();
      if (!storage[key]) storage[key] = {};
      storage[key][slug] = deepClone(value);
      return true;
    }),
    updateSurveysCacheAtomic,
    updateUserCacheAtomic,
    getActiveSessionSlug: jest.fn(() => activeSlug || 'test-slug'),
    getSessionCfg: jest.fn((slug) => ({
      slug,
      networkChainId: 11155420,
      blockLimits: { start: 10, end: null },
    })),
    getSessionChainId: jest.fn(() =>
      Object.prototype.hasOwnProperty.call(overrides, 'chainId') ? chainId : '11155420',
    ),
    getSessionScanScope: jest.fn(() => sessionScanScope || 'session'),
    shouldSkipSessionScanForSlug: jest.fn(() => false),
    scanScopeNoop: jest.fn(() => false),
    onSurveyEventDetectedForGroup: jest.fn(),
    checkAllCachesReady: jest.fn(),
    mergeLegacyNumericNetworkKey: jest.fn(() => false),
    writeSurveyMetadataToCache: jest.fn(() => true),
    queueLocalRevisionUpdate: jest.fn(),
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

describe('createSessionSurveyCacheController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    normalizeSessionSlug.mockImplementation((s) => String(s || ''));
    contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 10, toBlock: 12 });
    contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([]);
    contractScripts.getSurveyDataById.mockResolvedValue(null);
    contractScripts.fetchAllSurveyResponses.mockResolvedValue([]);
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
    prepareSurveyMetadataCacheEntry.mockImplementation(({ surveyId, surveyData, slug, creationBlock }) => ({
      ...surveyData,
      surveyID: surveyId,
      creationBlock,
      slug,
      sessionSlugExplicit: true,
    }));
    resolveScopedMetadataSessionSlug.mockImplementation((surveyData, slug) => surveyData?.scopedSlug || slug);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isInitInFlight', () => {
    it('returns false when no init is running', () => {
      const controller = createSessionSurveyCacheController(createMockHost());

      expect(controller.isInitInFlight('alpha')).toBe(false);
    });
  });

  describe('startSurveyAndQuestionEventListenerForGroup', () => {
    it('removes any existing listener and attaches a scoped survey listener', () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);

      expect(controller.startSurveyAndQuestionEventListenerForGroup('alpha')).toBe(true);

      expect(contractScripts.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'alpha');
      expect(contractScripts.listenForSurveyEvents).toHaveBeenCalledWith('none', expect.any(Function), 'alpha');

      const handler = contractScripts.listenForSurveyEvents.mock.calls[0][1];
      const event = { type: 'SurveyAdded', surveyId: '0xsurvey' };
      handler(event);

      expect(host.onSurveyEventDetectedForGroup).toHaveBeenCalledWith('alpha', event);
    });

    it('uses an injected event stream port for survey listeners', () => {
      const surveyEventStreamsPort = {
        removeSurveyEventsListener: jest.fn(),
        listenForSurveyEvents: jest.fn(),
      };
      const host = createMockHost({ surveyEventStreamsPort });
      const controller = createSessionSurveyCacheController(host);

      expect(controller.startSurveyAndQuestionEventListenerForGroup('alpha')).toBe(true);

      expect(surveyEventStreamsPort.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'alpha');
      expect(surveyEventStreamsPort.listenForSurveyEvents).toHaveBeenCalledWith('none', expect.any(Function), 'alpha');
      expect(contractScripts.removeSurveyEventsListener).not.toHaveBeenCalled();
      expect(contractScripts.listenForSurveyEvents).not.toHaveBeenCalled();

      const handler = surveyEventStreamsPort.listenForSurveyEvents.mock.calls[0][1];
      const event = { type: 'SurveyAdded', surveyId: '0xinjected' };
      handler(event);

      expect(host.onSurveyEventDetectedForGroup).toHaveBeenCalledWith('alpha', event);
    });

    it('uses the active session slug for the unscoped listener entrypoint', () => {
      const host = createMockHost({ activeSlug: 'active-slug' });
      const controller = createSessionSurveyCacheController(host);

      expect(controller.startSurveyAndQuestionEventListener()).toBe(true);

      expect(contractScripts.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'active-slug');
      expect(contractScripts.listenForSurveyEvents).toHaveBeenCalledWith('none', expect.any(Function), 'active-slug');
    });

    it('does not attach a listener when scan policy skips the slug', () => {
      const host = createMockHost({
        shouldSkipSessionScanForSlug: jest.fn(() => true),
      });
      const controller = createSessionSurveyCacheController(host);

      expect(controller.startSurveyAndQuestionEventListenerForGroup('alpha')).toBe(false);

      expect(contractScripts.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'alpha');
      expect(contractScripts.listenForSurveyEvents).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('clears pending retry timers without throwing', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const host = createMockHost({ activeSlug: 'alpha' });
      const controller = createSessionSurveyCacheController(host);

      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([{ surveyId: 'SURV1', creationBlock: 11 }]);
      contractScripts.getSurveyDataById.mockRejectedValue(new Error('metadata missing'));

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(() => controller.destroy()).not.toThrow();
      expect(clearTimeoutSpy).toHaveBeenCalled();

      jest.advanceTimersByTime(5000);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
    });

    it('resets in-flight tracking', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValue(deferred.promise);

      const initPromise = controller.initializeSurveyCacheForGroup('alpha');

      expect(controller.isInitInFlight('alpha')).toBe(true);

      controller.destroy();

      expect(controller.isInitInFlight('alpha')).toBe(false);

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await initPromise;
    });
  });

  describe('initializeSurveyCacheForGroup', () => {
    it('short-circuits via scanScopeNoop and marks survey cache ready', async () => {
      const host = createMockHost({
        scanScopeNoop: jest.fn((slug, op, onSkipped) => {
          onSkipped();
          return true;
        }),
      });
      const controller = createSessionSurveyCacheController(host);

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(host.getStateSnapshot()).toMatchObject({ isSurveyCacheReady: true });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    });

    it('returns a thenable even when scanScopeNoop short-circuits', async () => {
      const host = createMockHost({
        scanScopeNoop: jest.fn((slug, op, onSkipped) => {
          onSkipped();
          return true;
        }),
      });
      const controller = createSessionSurveyCacheController(host);

      const result = controller.initializeSurveyCacheForGroup('alpha');

      expect(typeof result?.then).toBe('function');

      await result;
    });

    it('rejects the returned promise when synchronous setup throws before run starts', async () => {
      normalizeSessionSlug.mockImplementationOnce(() => {
        throw new Error('normalize failed');
      });
      const controller = createSessionSurveyCacheController(createMockHost());

      const result = controller.initializeSurveyCacheForGroup('alpha');

      expect(typeof result?.then).toBe('function');
      await expect(result).rejects.toThrow('normalize failed');
    });

    it('deduplicates concurrent calls for the same slug', async () => {
      jest.useFakeTimers();
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValue(deferred.promise);

      const firstPromise = controller.initializeSurveyCacheForGroup('alpha');
      const secondPromise = controller.initializeSurveyCacheForGroup('alpha');

      expect(firstPromise).toBe(secondPromise);
      expect(controller.isInitInFlight('alpha')).toBe(true);
      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await firstPromise;

      expect(controller.isInitInFlight('alpha')).toBe(false);
    });

    it('queues a pending init while one is already in flight and drains it after completion', async () => {
      jest.useFakeTimers();
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter
        .mockReturnValueOnce(deferred.promise)
        .mockResolvedValue({ fromBlock: 4, toBlock: 3 });

      const firstPromise = controller.initializeSurveyCacheForGroup('alpha');
      const secondPromise = controller.initializeSurveyCacheForGroup('alpha', { background: true });

      expect(secondPromise).toBe(firstPromise);
      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);

      deferred.resolve({ fromBlock: 2, toBlock: 1 });
      await firstPromise;

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);

      jest.runOnlyPendingTimers();

      expect(contractScripts.getRelevantBlockWindowForFilter.mock.calls.length).toBeGreaterThan(1);
    });

    it('initializes cache structure when no survey cache exists', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 5, toBlock: 5 });

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(host.getStored('surveysCache', 'alpha')).toEqual({
        11155420: {
          surveysLatestBlock: 5,
          surveys: {},
          surveyResponses: {},
          surveyResponsesLatestBlock: {},
          pendingSurveyMetadata: {},
        },
      });
    });

    it('handles an empty block window after reading the relevant filter window', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 8, toBlock: 7 });

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'alpha',
          blockLimits: { start: 10, end: null },
        }),
      );
      expect(contractScripts.fetchUserSubmittedSurveyIDs).not.toHaveBeenCalled();
      expect(host.getStateSnapshot()).toMatchObject({ isSurveyCacheReady: true });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
    });

    it('passes the resolved demo session config to survey block-window initialization', async () => {
      const demoCfg = {
        slug: 'demo-1',
        networkChainId: 11155420,
        blockLimits: { start: 44967477, end: null },
      };
      const host = createMockHost({
        activeSlug: 'demo-1',
        getSessionCfg: jest.fn((slug) => (slug === 'demo-1' ? demoCfg : null)),
      });
      const controller = createSessionSurveyCacheController(host);

      await controller.initializeSurveyCacheForGroup('demo-1');

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'demo-1',
          blockLimits: { start: 44967477, end: null },
        }),
      );
    });

    it('fetches survey IDs from the discovered block window', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(contractScripts.fetchUserSubmittedSurveyIDs).toHaveBeenCalledWith('none', 10, 12, 'alpha');
    });

    it('prepares survey metadata and persists it into the cache', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);

      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([{ surveyId: 'SURV1', creationBlock: 11 }]);
      contractScripts.getSurveyDataById.mockResolvedValue({
        creator: '0xCreator',
        title: 'Survey title',
      });

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(prepareSurveyMetadataCacheEntry).toHaveBeenCalledWith({
        surveyId: 'surv1',
        surveyData: {
          creator: '0xCreator',
          title: 'Survey title',
        },
        slug: 'alpha',
        creationBlock: 11,
        enforceScopedIsolation: true,
      });

      const storedCache = host.getStored('surveysCache', 'alpha');

      expect(storedCache['11155420'].surveys.surv1).toMatchObject({
        surveyID: 'surv1',
        creator: '0xCreator',
        title: 'Survey title',
        creationBlock: 11,
        sessionSlugExplicit: true,
      });
      expect(host.updateSurveysCacheAtomic).toHaveBeenCalled();
    });

    it('marks pending survey metadata when metadata fetching fails', async () => {
      jest.useFakeTimers();
      const host = createMockHost({ activeSlug: 'alpha' });
      const controller = createSessionSurveyCacheController(host);

      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([{ surveyId: 'SURV1', creationBlock: 11 }]);
      contractScripts.getSurveyDataById.mockRejectedValue(new Error('not found'));

      await controller.initializeSurveyCacheForGroup('alpha');

      const storedCache = host.getStored('surveysCache', 'alpha');
      const pendingEntry = storedCache['11155420'].pendingSurveyMetadata.surv1;

      expect(pendingEntry).toMatchObject({
        attempts: 1,
        creationBlock: 11,
        state: 'transient',
        lastStatus: 503,
        message: 'retry later',
      });
      expect(pendingEntry.nextRetryAtMs).toBeGreaterThan(0);

      controller.destroy();
    });

    it('processes survey responses and advances the response watermark on full success', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);
      const responsePayload = { choice: 'A' };

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 10, toBlock: 15 });
      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([{ surveyId: 'SURV1', creationBlock: 11 }]);
      contractScripts.getSurveyDataById.mockResolvedValue({
        creator: '0xCreator',
        title: 'Survey title',
      });
      contractScripts.fetchAllSurveyResponses.mockResolvedValue([{ responder: '0xBEEF', response: responsePayload }]);

      await controller.initializeSurveyCacheForGroup('alpha');

      const storedSurveyCache = host.getStored('surveysCache', 'alpha');
      const storedUserCache = host.getStored('userCache', 'alpha');

      expect(contractScripts.fetchAllSurveyResponses).toHaveBeenCalledWith('none', 'surv1', 11, 15, 'alpha');
      expect(storedSurveyCache['11155420'].surveyResponses.surv1).toEqual({
        '0xbeef': responsePayload,
      });
      expect(storedSurveyCache['11155420'].surveyResponsesLatestBlock.surv1).toBe(15);
      expect(storedUserCache['0xbeef']['11155420'].data.surveyResponses).toEqual([
        {
          surveyId: 'surv1',
          responder: '0xbeef',
          response: responsePayload,
        },
      ]);
    });

    it('continues hydrating later survey responses after one survey fetch rejects', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: {
                  surv1: { creationBlock: 5 },
                  surv2: { creationBlock: 6 },
                },
                surveyResponses: {
                  surv1: {
                    '0xold': { choice: 'old' },
                  },
                  surv2: {},
                },
                surveyResponsesLatestBlock: {
                  surv1: 4,
                  surv2: 6,
                },
                pendingSurveyMetadata: {},
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const secondResponse = { choice: 'B' };

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 12 });
      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([]);
      contractScripts.fetchAllSurveyResponses
        .mockRejectedValueOnce(new Error('survey rpc down'))
        .mockResolvedValueOnce([{ responder: '0xBEEF', response: secondResponse }]);

      await controller.initializeSurveyCacheForGroup('alpha');

      const storedSurveyCache = host.getStored('surveysCache', 'alpha');
      const storedUserCache = host.getStored('userCache', 'alpha');

      expect(contractScripts.fetchAllSurveyResponses).toHaveBeenCalledTimes(2);
      expect(contractScripts.fetchAllSurveyResponses).toHaveBeenNthCalledWith(1, 'none', 'surv1', 5, 12, 'alpha');
      expect(contractScripts.fetchAllSurveyResponses).toHaveBeenNthCalledWith(2, 'none', 'surv2', 7, 12, 'alpha');
      expect(storedSurveyCache['11155420'].surveyResponses.surv1).toEqual({
        '0xold': { choice: 'old' },
      });
      expect(storedSurveyCache['11155420'].surveyResponses.surv2).toEqual({
        '0xbeef': secondResponse,
      });
      expect(storedSurveyCache['11155420'].surveyResponsesLatestBlock.surv1).toBe(4);
      expect(storedSurveyCache['11155420'].surveyResponsesLatestBlock.surv2).toBe(12);
      expect(storedUserCache['0xbeef']['11155420'].data.surveyResponses).toEqual([
        {
          surveyId: 'surv2',
          responder: '0xbeef',
          response: secondResponse,
        },
      ]);
      expect(host.getStateSnapshot()).toMatchObject({
        surveyCacheInitializationError: false,
      });
    });

    it('sets surveyCacheInitializationError when initialization work fails', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);

      contractScripts.fetchUserSubmittedSurveyIDs.mockRejectedValue(new Error('rpc down'));

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(host.getStateSnapshot()).toMatchObject({
        surveyCacheInitializationError: true,
      });
      expect(host.updateSurveysCacheAtomic).toHaveBeenCalled();
    });

    it('atomically preserves survey metadata and responses written while metadata hydration is in flight', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 9,
                surveys: {},
                surveyResponses: {},
                surveyResponsesLatestBlock: {},
                pendingSurveyMetadata: {},
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const metadataStarted = createDeferred();
      const metadata = createDeferred();

      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([{ surveyId: 'NEW', creationBlock: 10 }]);
      contractScripts.getSurveyDataById.mockImplementation(() => {
        metadataStarted.resolve();
        return metadata.promise;
      });

      const initPromise = controller.initializeSurveyCacheForGroup('alpha');
      await metadataStarted.promise;
      host.setStored('surveysCache', 'alpha', {
        11155420: {
          surveysLatestBlock: 15,
          surveys: { concurrent: { surveyID: 'concurrent', creationBlock: 14 } },
          surveyResponses: { concurrent: { '0xwriter': { choice: 'kept' } } },
          surveyResponsesLatestBlock: { concurrent: 15 },
          pendingSurveyMetadata: {},
        },
      });
      metadata.resolve({ creator: '', title: 'New survey' });
      await initPromise;

      const stored = host.getStored('surveysCache', 'alpha')['11155420'];
      expect(stored.surveys.concurrent).toEqual(expect.objectContaining({ surveyID: 'concurrent' }));
      expect(stored.surveys.new).toEqual(expect.objectContaining({ surveyID: 'new' }));
      expect(stored.surveyResponses.concurrent['0xwriter']).toEqual({ choice: 'kept' });
      expect(stored.surveysLatestBlock).toBe(15);
      expect(host.updateSurveysCacheAtomic).toHaveBeenCalled();
    });

    it('does not replay an already-persisted survey metadata delta over a later concurrent update', async () => {
      const host = createMockHost();
      const controller = createSessionSurveyCacheController(host);
      const responsesStarted = createDeferred();
      const responses = createDeferred();

      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([{ surveyId: 'SURV1', creationBlock: 11 }]);
      contractScripts.getSurveyDataById.mockResolvedValue({ creator: '', title: 'Initial scan title' });
      contractScripts.fetchAllSurveyResponses.mockImplementation(() => {
        responsesStarted.resolve();
        return responses.promise;
      });

      const initPromise = controller.initializeSurveyCacheForGroup('alpha');
      await responsesStarted.promise;
      const concurrent = host.getStored('surveysCache', 'alpha');
      concurrent['11155420'].surveys.surv1.title = 'Concurrent event title';
      concurrent['11155420'].surveysLatestBlock = 20;
      host.setStored('surveysCache', 'alpha', concurrent);
      responses.resolve([]);
      await initPromise;

      const stored = host.getStored('surveysCache', 'alpha')['11155420'];
      expect(stored.surveys.surv1.title).toBe('Concurrent event title');
      expect(stored.surveysLatestBlock).toBe(20);
    });

    it('preserves independent concurrent user scan flags while adding a created survey', async () => {
      const host = createMockHost({
        initialStorage: {
          userCache: {
            alpha: {
              '0xcreator': {
                11155420: {
                  lastBlockScanned: 5,
                  lastScanTimestamp: 5,
                  scanIncomplete: false,
                  sbtLastBlockScanned: 5,
                  data: {
                    sbts: [],
                    createdSurveys: [],
                    createdQuestions: [],
                    surveyResponses: [],
                    questionResponses: [],
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const metadataStarted = createDeferred();
      const metadata = createDeferred();
      contractScripts.fetchUserSubmittedSurveyIDs.mockResolvedValue([{ surveyId: 'SURV1', creationBlock: 11 }]);
      contractScripts.getSurveyDataById.mockImplementation(() => {
        metadataStarted.resolve();
        return metadata.promise;
      });

      const initPromise = controller.initializeSurveyCacheForGroup('alpha');
      await metadataStarted.promise;
      const concurrentUserCache = host.getStored('userCache', 'alpha');
      concurrentUserCache['0xcreator']['11155420'].scanIncomplete = true;
      concurrentUserCache['0xcreator']['11155420'].sbtLastBlockScanned = 50;
      host.setStored('userCache', 'alpha', concurrentUserCache);
      metadata.resolve({ creator: '0xCreator', title: 'Survey' });
      await initPromise;

      const storedNode = host.getStored('userCache', 'alpha')['0xcreator']['11155420'];
      expect(storedNode.scanIncomplete).toBe(true);
      expect(storedNode.sbtLastBlockScanned).toBe(50);
      expect(storedNode.data.createdSurveys).toEqual([expect.objectContaining({ id: 'surv1' })]);
    });

    it('preserves a newer concurrent survey responder row in userCache', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 12,
                surveys: {
                  surv1: { surveyID: 'surv1', creationBlock: 10, sessionSlugExplicit: true },
                },
                surveyResponses: { surv1: {} },
                surveyResponsesLatestBlock: { surv1: 9 },
                pendingSurveyMetadata: {},
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const fetchStarted = createDeferred();
      const responses = createDeferred();
      contractScripts.fetchAllSurveyResponses.mockImplementation(() => {
        fetchStarted.resolve();
        return responses.promise;
      });

      const initPromise = controller.initializeSurveyCacheForGroup('alpha');
      await fetchStarted.promise;
      host.setStored('userCache', 'alpha', {
        '0xresponder': {
          11155420: {
            lastBlockScanned: 15,
            lastScanTimestamp: 15,
            data: {
              sbts: [],
              createdSurveys: [],
              createdQuestions: [],
              surveyResponses: [
                {
                  surveyId: 'surv1',
                  responder: '0xresponder',
                  response: { choice: 'newer' },
                  blockNumber: 15,
                },
              ],
              questionResponses: [],
            },
          },
        },
      });
      responses.resolve([
        {
          responder: '0xResponder',
          response: { choice: 'older' },
          blockNumber: 11,
        },
      ]);
      await initPromise;

      expect(host.getStored('userCache', 'alpha')['0xresponder']['11155420'].data.surveyResponses[0]).toEqual(
        expect.objectContaining({ response: { choice: 'newer' }, blockNumber: 15 }),
      );
    });

    it('updates an older survey responder row in userCache from a newer fetched event', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 12,
                surveys: { surv1: { surveyID: 'surv1', creationBlock: 10, sessionSlugExplicit: true } },
                surveyResponses: { surv1: {} },
                surveyResponsesLatestBlock: { surv1: 9 },
                pendingSurveyMetadata: {},
              },
            },
          },
          userCache: {
            alpha: {
              '0xresponder': {
                11155420: {
                  lastBlockScanned: 9,
                  lastScanTimestamp: 9,
                  data: {
                    sbts: [],
                    createdSurveys: [],
                    createdQuestions: [],
                    surveyResponses: [
                      {
                        surveyId: 'surv1',
                        responder: '0xresponder',
                        response: { choice: 'older' },
                        blockNumber: 9,
                      },
                    ],
                    questionResponses: [],
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      contractScripts.fetchAllSurveyResponses.mockResolvedValue([
        {
          responder: '0xResponder',
          response: { choice: 'newer' },
          blockNumber: 11,
        },
      ]);

      await controller.initializeSurveyCacheForGroup('alpha');

      expect(host.getStored('userCache', 'alpha')['0xresponder']['11155420'].data.surveyResponses[0]).toEqual(
        expect.objectContaining({ response: { choice: 'newer' }, blockNumber: 11 }),
      );
    });

    it('does not swallow a pending-metadata atomic persistence failure', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 12,
                surveys: {},
                surveyResponses: {},
                surveyResponsesLatestBlock: {},
                pendingSurveyMetadata: {
                  surv1: { attempts: 1, nextRetryAtMs: 0, creationBlock: 11 },
                },
              },
            },
          },
        },
      });
      const baseAtomicUpdate = host.updateSurveysCacheAtomic;
      host.updateSurveysCacheAtomic = jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockImplementation((...args) => baseAtomicUpdate(...args));
      const controller = createSessionSurveyCacheController(host);
      contractScripts.getSurveyDataById.mockResolvedValue({ creator: '', title: 'Recovered survey' });

      await expect(controller.initializeSurveyCacheForGroup('alpha')).rejects.toThrow(
        'Failed to persist surveys cache',
      );
      expect(host.getStateSnapshot().isSurveyCacheReady).not.toBe(true);
    });

    it('rejects when atomic survey persistence returns false', async () => {
      const host = createMockHost({
        updateSurveysCacheAtomic: jest.fn(async () => false),
      });
      const controller = createSessionSurveyCacheController(host);

      await expect(controller.initializeSurveyCacheForGroup('alpha')).rejects.toThrow(
        'Failed to persist surveys cache',
      );
      expect(host.getStateSnapshot()).toMatchObject({
        surveyCacheInitializationError: true,
      });
    });

    it('rejects when atomic survey persistence rejects even if a later retry could succeed', async () => {
      const host = createMockHost();
      const baseAtomicUpdate = host.updateSurveysCacheAtomic;
      host.updateSurveysCacheAtomic = jest
        .fn()
        .mockRejectedValueOnce(new Error('indexeddb unavailable'))
        .mockImplementation((...args) => baseAtomicUpdate(...args));
      const controller = createSessionSurveyCacheController(host);

      await expect(controller.initializeSurveyCacheForGroup('alpha')).rejects.toThrow(
        'Failed to persist surveys cache',
      );
      expect(host.getStateSnapshot()).toMatchObject({ surveyCacheInitializationError: true });
    });
  });

  describe('refreshSurveyResponsesByIDForGroup', () => {
    it('skips refresh when no chainId is available', async () => {
      const host = createMockHost({ chainId: null });
      const controller = createSessionSurveyCacheController(host);

      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');

      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
      expect(host.updateSurveysCacheAtomic).not.toHaveBeenCalled();
    });

    it('skips refresh when the local watermark is already ahead of the chain window', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 12,
                surveys: {
                  surv1: { creationBlock: 4 },
                },
                surveyResponses: {
                  surv1: {},
                },
                surveyResponsesLatestBlock: {
                  surv1: 12,
                },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);

      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');

      expect(contractScripts.fetchAllSurveyResponses).not.toHaveBeenCalled();
      expect(host.updateSurveysCacheAtomic).not.toHaveBeenCalled();
      expect(host.queueLocalRevisionUpdate).not.toHaveBeenCalled();
    });

    it('fetches and merges responses into the cache on success', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: {
                  surv1: { creationBlock: 5 },
                },
                surveyResponses: {
                  surv1: {
                    '0xold': { choice: 'old' },
                  },
                },
                surveyResponsesLatestBlock: {
                  surv1: 6,
                },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockResolvedValue([{ responder: '0xNEW', response: { choice: 'new' } }]);

      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');

      expect(contractScripts.fetchAllSurveyResponses).toHaveBeenCalledWith('none', 'surv1', 7, 10, 'alpha');
      expect(host.getStored('surveysCache', 'alpha')['11155420'].surveyResponses.surv1).toEqual({
        '0xold': { choice: 'old' },
        '0xnew': { choice: 'new' },
      });
      expect(host.getStored('surveysCache', 'alpha')['11155420'].surveyResponsesLatestBlock.surv1).toBe(10);
      expect(host.queueLocalRevisionUpdate).toHaveBeenCalledWith({
        needsQuestionResponsesNonce: true,
      });
    });

    it('uses a safe response watermark when the refresh batch reports a partial failure', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: {
                  surv1: { creationBlock: 5 },
                },
                surveyResponses: {
                  surv1: {},
                },
                surveyResponsesLatestBlock: {
                  surv1: 6,
                },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockResolvedValue({
        responses: [{ responder: '0xNEW', response: { choice: 'new' } }],
        hadPartialFailure: true,
        lowestFailedBlock: 9,
      });

      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');

      expect(host.getStored('surveysCache', 'alpha')['11155420'].surveyResponsesLatestBlock.surv1).toBe(8);
      expect(host.queueLocalRevisionUpdate).toHaveBeenCalledWith({
        needsQuestionResponsesNonce: true,
      });
    });

    it('preserves old, concurrent, and fetched responders across an interleaved refresh', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: {
                  surv1: {
                    '0xold': { choice: 'old' },
                  },
                },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const fetchStarted = createDeferred();
      const responseBatch = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockImplementation(() => {
        fetchStarted.resolve();
        return responseBatch.promise;
      });

      const refreshPromise = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await fetchStarted.promise;
      await host.updateSurveysCacheAtomic('alpha', (current) => {
        current['11155420'].surveyResponses.surv1['0xconcurrent'] = { choice: 'concurrent' };
        return current;
      });
      responseBatch.resolve([{ responder: '0xFETCHED', response: { choice: 'fetched' } }]);
      await refreshPromise;

      expect(host.getStored('surveysCache', 'alpha')['11155420'].surveyResponses.surv1).toEqual({
        '0xold': { choice: 'old' },
        '0xconcurrent': { choice: 'concurrent' },
        '0xfetched': { choice: 'fetched' },
      });
    });

    it('does not move a fresher concurrent response watermark backward after a successful refresh', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: { surv1: {} },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const fetchStarted = createDeferred();
      const responseBatch = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockImplementation(() => {
        fetchStarted.resolve();
        return responseBatch.promise;
      });

      const refreshPromise = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await fetchStarted.promise;
      await host.updateSurveysCacheAtomic('alpha', (current) => {
        current['11155420'].surveyResponsesLatestBlock.surv1 = 14;
        return current;
      });
      responseBatch.resolve([]);
      await refreshPromise;

      expect(host.getStored('surveysCache', 'alpha')['11155420'].surveyResponsesLatestBlock.surv1).toBe(14);
    });

    it('does not let an older overlapping refresh replace a newer response from the same responder', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: {
                  surv1: {
                    '0xsame': { choice: 'initial' },
                  },
                },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const olderFetchStarted = createDeferred();
      const olderResponseBatch = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter
        .mockResolvedValueOnce({ fromBlock: 1, toBlock: 10 })
        .mockResolvedValueOnce({ fromBlock: 1, toBlock: 14 });
      contractScripts.fetchAllSurveyResponses.mockImplementation((_provider, _surveyId, _startBlock, latestBlock) => {
        if (latestBlock === 10) {
          olderFetchStarted.resolve();
          return olderResponseBatch.promise;
        }
        return Promise.resolve([{ responder: '0xSAME', response: { choice: 'newer' } }]);
      });

      const olderRefresh = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await olderFetchStarted.promise;
      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      olderResponseBatch.resolve([{ responder: '0xSAME', response: { choice: 'older' } }]);
      await olderRefresh;

      const storedSurvey = host.getStored('surveysCache', 'alpha')['11155420'];
      expect(storedSurvey.surveyResponses.surv1['0xsame']).toEqual({ choice: 'newer' });
      expect(storedSurvey.surveyResponsesLatestBlock.surv1).toBe(14);
    });

    it('applies a newer in-flight scan after an older overlapping scan commits first', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: {
                  surv1: {
                    '0xsame': { choice: 'initial' },
                  },
                },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const newerFetchStarted = createDeferred();
      const newerResponseBatch = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter
        .mockResolvedValueOnce({ fromBlock: 1, toBlock: 14 })
        .mockResolvedValueOnce({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockImplementation((_provider, _surveyId, _startBlock, latestBlock) => {
        if (latestBlock === 14) {
          newerFetchStarted.resolve();
          return newerResponseBatch.promise;
        }
        return Promise.resolve([
          {
            responder: '0xSAME',
            response: { choice: 'older' },
            blockNumber: 10,
            transactionIndex: 1,
            logIndex: 2,
            timestamp: 100,
          },
        ]);
      });

      const newerRefresh = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await newerFetchStarted.promise;
      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      newerResponseBatch.resolve([
        {
          responder: '0xSAME',
          response: { choice: 'newer' },
          blockNumber: 14,
          transactionIndex: 2,
          logIndex: 3,
          timestamp: 140,
        },
      ]);
      await newerRefresh;

      const storedSurvey = host.getStored('surveysCache', 'alpha')['11155420'];
      expect(storedSurvey.surveyResponses.surv1['0xsame']).toMatchObject({
        choice: 'newer',
        blockNumber: 14,
        transactionIndex: 2,
        logIndex: 3,
        timestamp: 140,
      });
      expect(storedSurvey.surveyResponsesLatestBlock.surv1).toBe(14);
    });

    it('keeps a newer stamped post-submit response when an older fetched item arrives', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: {
                  surv1: {
                    '0xsame': { choice: 'initial' },
                  },
                },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const fetchStarted = createDeferred();
      const responseBatch = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockImplementation(() => {
        fetchStarted.resolve();
        return responseBatch.promise;
      });

      const refreshPromise = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await fetchStarted.promise;
      await host.updateSurveysCacheAtomic('alpha', (current) => {
        current['11155420'].surveyResponses.surv1['0xsame'] = {
          choice: 'submitted',
          blockNumber: 12,
          transactionIndex: 2,
          logIndex: 4,
          timestamp: 120,
        };
        return current;
      });
      responseBatch.resolve([
        {
          responder: '0xSAME',
          response: { choice: 'older-chain-value' },
          blockNumber: 10,
          transactionIndex: 1,
          logIndex: 2,
          timestamp: 100,
        },
      ]);
      await refreshPromise;

      const storedSurvey = host.getStored('surveysCache', 'alpha')['11155420'];
      expect(storedSurvey.surveyResponses.surv1['0xsame']).toMatchObject({
        choice: 'submitted',
        blockNumber: 12,
      });
      expect(storedSurvey.surveyResponsesLatestBlock.surv1).toBe(10);
    });

    it('keeps a pre-existing trusted response when an older fetched item arrives', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: {
                  surv1: {
                    '0xsame': {
                      choice: 'submitted',
                      blockNumber: 14,
                      transactionIndex: 2,
                      logIndex: 4,
                      timestamp: 140,
                    },
                  },
                },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockResolvedValue([
        {
          responder: '0xSAME',
          response: { choice: 'older-chain-value' },
          blockNumber: 10,
          transactionIndex: 1,
          logIndex: 2,
          timestamp: 100,
        },
      ]);

      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');

      const storedSurvey = host.getStored('surveysCache', 'alpha')['11155420'];
      expect(storedSurvey.surveyResponses.surv1['0xsame']).toMatchObject({
        choice: 'submitted',
        blockNumber: 14,
      });
      expect(storedSurvey.surveyResponsesLatestBlock.surv1).toBe(10);
    });

    it('keeps an unorderable concurrent response conflict retryable', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: {
                  surv1: {
                    '0xsame': { choice: 'initial' },
                  },
                },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const fetchStarted = createDeferred();
      const responseBatch = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockImplementation(() => {
        fetchStarted.resolve();
        return responseBatch.promise;
      });

      const refreshPromise = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await fetchStarted.promise;
      await host.updateSurveysCacheAtomic('alpha', (current) => {
        current['11155420'].surveyResponses.surv1['0xsame'] = { choice: 'submitted' };
        return current;
      });
      responseBatch.resolve([{ responder: '0xSAME', response: { choice: 'older-chain-value' } }]);
      await refreshPromise;

      const storedSurvey = host.getStored('surveysCache', 'alpha')['11155420'];
      expect(storedSurvey.surveyResponses.surv1['0xsame']).toEqual({ choice: 'submitted' });
      expect(storedSurvey.surveyResponsesLatestBlock.surv1).toBe(6);
    });

    it('does not replace a newer valid frontier with a partial-failure safe frontier', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: { surv1: {} },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
      });
      const controller = createSessionSurveyCacheController(host);
      const fetchStarted = createDeferred();
      const responseBatch = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 20 });
      contractScripts.fetchAllSurveyResponses.mockImplementation(() => {
        fetchStarted.resolve();
        return responseBatch.promise;
      });

      const refreshPromise = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await fetchStarted.promise;
      await host.updateSurveysCacheAtomic('alpha', (current) => {
        current['11155420'].surveyResponsesLatestBlock.surv1 = 15;
        return current;
      });
      responseBatch.resolve({
        responses: [{ responder: '0xFETCHED', response: { choice: 'fetched' } }],
        hadPartialFailure: true,
        lowestFailedBlock: 9,
      });
      await refreshPromise;

      expect(host.getStored('surveysCache', 'alpha')['11155420'].surveyResponsesLatestBlock.surv1).toBe(15);
    });

    it('queues the UI revision only after persistence succeeds', async () => {
      const persistenceStarted = createDeferred();
      const persistence = createDeferred();
      let host;
      host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: { surv1: {} },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
        dgWrite: jest.fn(async () => {
          persistenceStarted.resolve();
          await persistence.promise;
          return true;
        }),
        updateSurveysCacheAtomic: jest.fn(async (_slug, updater) => {
          const next = await updater(host.getStored('surveysCache', 'alpha'));
          persistenceStarted.resolve();
          await persistence.promise;
          return !!next;
        }),
      });
      const controller = createSessionSurveyCacheController(host);
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockResolvedValue([]);

      const refreshPromise = controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');
      await persistenceStarted.promise;
      const queuedBeforePersistence = host.queueLocalRevisionUpdate.mock.calls.length > 0;
      persistence.resolve();
      await refreshPromise;

      expect(queuedBeforePersistence).toBe(false);
      expect(host.queueLocalRevisionUpdate).toHaveBeenCalledWith({
        needsQuestionResponsesNonce: true,
      });
    });

    it('surfaces a false persistence result without queueing a success revision', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: { surv1: {} },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
        dgWrite: jest.fn(async () => false),
        updateSurveysCacheAtomic: jest.fn(async () => false),
      });
      const controller = createSessionSurveyCacheController(host);
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockResolvedValue([]);

      await expect(controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1')).rejects.toThrow(
        'Failed to persist survey responses',
      );
      expect(host.queueLocalRevisionUpdate).not.toHaveBeenCalled();
    });

    it('surfaces a rejected persistence operation without queueing a success revision', async () => {
      const host = createMockHost({
        initialStorage: {
          surveysCache: {
            alpha: {
              11155420: {
                surveysLatestBlock: 6,
                surveys: { surv1: { creationBlock: 5 } },
                surveyResponses: { surv1: {} },
                surveyResponsesLatestBlock: { surv1: 6 },
              },
            },
          },
        },
        updateSurveysCacheAtomic: jest.fn(async () => {
          throw new Error('managed cache unavailable');
        }),
      });
      const controller = createSessionSurveyCacheController(host);
      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 10 });
      contractScripts.fetchAllSurveyResponses.mockResolvedValue([]);

      await expect(controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1')).rejects.toThrow(
        'managed cache unavailable',
      );
      expect(host.queueLocalRevisionUpdate).not.toHaveBeenCalled();
    });
  });
});
