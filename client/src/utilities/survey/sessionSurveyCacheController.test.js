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
    dgWrite: jest.fn((key, slug, value) => {
      if (!storage[key]) storage[key] = {};
      storage[key][slug] = deepClone(value);
      return true;
    }),
    getActiveSessionSlug: jest.fn(() => activeSlug || 'test-slug'),
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

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith('alpha');
      expect(contractScripts.fetchUserSubmittedSurveyIDs).not.toHaveBeenCalled();
      expect(host.getStateSnapshot()).toMatchObject({ isSurveyCacheReady: true });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
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
      expect(host.dgWrite).toHaveBeenCalled();
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
      expect(host.dgWrite).toHaveBeenCalled();
    });
  });

  describe('refreshSurveyResponsesByIDForGroup', () => {
    it('skips refresh when no chainId is available', async () => {
      const host = createMockHost({ chainId: null });
      const controller = createSessionSurveyCacheController(host);

      await controller.refreshSurveyResponsesByIDForGroup('alpha', 'SURV1');

      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
      expect(host.dgWrite).not.toHaveBeenCalled();
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
      expect(host.dgWrite).not.toHaveBeenCalled();
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
  });
});
