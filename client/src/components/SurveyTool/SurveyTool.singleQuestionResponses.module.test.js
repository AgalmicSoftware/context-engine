import {
  buildSingleQuestionSeededHydrationState,
  buildSingleQuestionSourceRestoreContextPlan,
  resolveSingleQuestionCacheBootstrap,
  resolveSingleQuestionCacheBootstrapFlowPlan,
  resolveSingleQuestionCacheBootstrapStopHandlingPlan,
} from './surveyToolSingleQuestionCacheBootstrapController';
import {
  executeOwnSingleQuestionResponseBootstrap,
  executeViewedSingleQuestionResponseBootstrap,
} from './surveyToolSingleQuestionController';

const clone = (value) => JSON.parse(JSON.stringify(value));

const applyStateUpdate = (stateRef, update) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  stateRef.current = { ...stateRef.current, ...(patch || {}) };
  return patch;
};

const ensureQuestionsNet = (cache, netId) => {
  const nextCache = {
    ...(cache && typeof cache === 'object' ? cache : {}),
  };
  nextCache[netId] = nextCache[netId] || {};
  nextCache[netId].questions = nextCache[netId].questions || {};
  nextCache[netId].questionResponses = nextCache[netId].questionResponses || {};
  nextCache[netId].questionResponsesMeta = nextCache[netId].questionResponsesMeta || {};
  return nextCache;
};

describe('SurveyTool single-question response bootstrap', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('stops single-question bootstrap before cache or network work when the route question id is missing', async () => {
    const getQuestionFetchCandidateSlugs = jest.fn(() => ['edge']);
    const plan = buildSingleQuestionSourceRestoreContextPlan({
      bootstrapRetryAttempt: 0,
      getQuestionFetchCandidateSlugs,
      props: {
        singleQuestionMode: true,
        questionID: '',
        account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
      },
      runId: 1,
    });

    expect(plan).toEqual(
      expect.objectContaining({
        status: 'missing-question-id',
        debugPayload: expect.objectContaining({
          phase: 'missing-question-id',
        }),
        statePatch: { isLoadingResponse: false },
      }),
    );
    expect(getQuestionFetchCandidateSlugs).not.toHaveBeenCalled();
  });

  it('hydrates a viewed response from a fresh persistent cache reread before falling back to hash-only retries', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const freshCachedResponse = {
      questionID: 'q1',
      responder: responderAddress,
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
      additional: { value: '', encrypted: false },
      timestamp: 1700000000,
    };
    const stateRef = {
      current: {
        parsedViewAddressAnswers: null,
        noResponse: false,
        responseLookupWarning: '',
        isLoadingResponse: false,
        startFresh: false,
        suppressPrefill: false,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));
    const getResponse = jest.fn().mockResolvedValue(null);
    const getResponseHash = jest.fn().mockResolvedValue('tx-response-hash');
    const scheduleRetry = jest.fn();

    await expect(
      executeViewedSingleQuestionResponseBootstrap({
        props: {
          provider: {},
          account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          responderAddress,
        },
        state: stateRef.current,
        questionId: 'q1',
        responderAddress,
        effectiveSingleSlug: 'edge',
        safeSetState,
        getResponse,
        getResponseHash,
        readCachedResponderResponse: jest.fn().mockReturnValue(null),
        readFreshCachedResponderResponse: jest.fn().mockResolvedValue(freshCachedResponse),
        normalizeViewedResponse: jest.fn((value) => value),
        mergeViewedResponse: jest.fn((_prev, latest) => latest),
        scheduleRetry,
        clearRetry: jest.fn(),
        writeResponseToCache: jest.fn(),
        prefillSingleQuestionResponse: jest.fn(),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        applied: true,
        reason: 'loaded',
        latest: freshCachedResponse,
      }),
    );

    expect(getResponse).toHaveBeenCalled();
    expect(getResponseHash).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(stateRef.current.noResponse).toBe(false);
    expect(stateRef.current.isLoadingResponse).toBe(false);
    expect(stateRef.current.parsedViewAddressAnswers).toEqual(
      expect.objectContaining({
        responder: responderAddress,
        answer: expect.objectContaining({
          encryptedPortion: 'cipher-answer',
        }),
      }),
    );
  });

  it('marks viewed response as no-response when recent payload bootstrap retries are exhausted', async () => {
    const recentPayload = {
      savedAtMs: Date.now(),
      creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      type: 'binary',
      prompt: 'Prompt from recent payload',
      tags: [],
    };
    const bootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'unknown-slug',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue(recentPayload),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue(''),
    });
    const flowPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: bootstrapResult,
    });
    const seededState = buildSingleQuestionSeededHydrationState({
      questionData: bootstrapResult.questionData,
      isLoadingResponse: flowPlan.seededHydration?.isLoadingResponse,
      mergeSurveyResponseState: (previous) => previous,
    });
    const retryPlan = resolveSingleQuestionCacheBootstrapStopHandlingPlan({
      bootstrapRetryAttempt: 0,
      cacheBootstrapPlan: flowPlan,
      didScheduleRetry: false,
      effectiveSingleSlug: bootstrapResult.target.effectiveSingleSlug,
      questionId: bootstrapResult.target.questionId,
      responderAddress: bootstrapResult.target.responderAddress,
      runId: 1,
    });

    expect(seededState.questionPool[0]).toEqual(expect.objectContaining({ id: 'q1' }));
    expect(retryPlan.action).toBe('retry');
    expect(retryPlan.retryOutcome).toEqual(
      expect.objectContaining({
        shouldClearRetry: true,
        exhaustedStatePatch: expect.objectContaining({
          noResponse: true,
          isLoadingResponse: false,
        }),
      }),
    );
  });

  it('writes recent payload into the slugged questions cache before viewed-response bootstrap retries', async () => {
    const recentPayload = {
      savedAtMs: Date.now(),
      creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      type: 'binary',
      prompt: 'Prompt from recent payload',
      tags: [],
    };
    const updateCacheAtomic = jest.fn(async (_namespace, _slug, updater) => updater(null));

    const bootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue(recentPayload),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue('84532'),
      updateCacheAtomic,
      ensureQuestionsNet,
    });
    const flowPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: bootstrapResult,
    });
    const retryPlan = resolveSingleQuestionCacheBootstrapStopHandlingPlan({
      bootstrapRetryAttempt: 0,
      cacheBootstrapPlan: flowPlan,
      didScheduleRetry: true,
      effectiveSingleSlug: bootstrapResult.target.effectiveSingleSlug,
      questionId: bootstrapResult.target.questionId,
      responderAddress: bootstrapResult.target.responderAddress,
      runId: 1,
    });

    expect(updateCacheAtomic).toHaveBeenCalledWith('questionsCache', 'edge', expect.any(Function));
    expect(bootstrapResult.status).toBe('seeded-from-recent');
    expect(bootstrapResult.cacheState?.questionsCache?.['84532']?.questions?.q1).toEqual(
      expect.objectContaining({
        id: 'q1',
        prompt: 'Prompt from recent payload',
      }),
    );
    expect(flowPlan.seededHydration).toEqual(
      expect.objectContaining({
        isLoadingResponse: true,
        questionData: expect.objectContaining({ id: 'q1' }),
      }),
    );
    expect(retryPlan).toEqual(
      expect.objectContaining({
        action: 'retry',
        retryOutcome: expect.objectContaining({
          debugPayload: expect.objectContaining({
            phase: 'recent-payload-response-bootstrap-retrying',
          }),
        }),
      }),
    );
  });

  it('does not bootstrap own single-question response from a borrowed general network when the slug is unresolved', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const recentPayload = {
      savedAtMs: Date.now(),
      creator: account,
      type: 'binary',
      prompt: 'Prompt from recent payload',
      tags: [],
    };
    const getResponse = jest.fn().mockResolvedValue({
      answer: { value: 'should-not-load', encrypted: false },
      additional: { value: '', encrypted: false },
    });
    const writeQuestionsCache = jest.fn();
    const prefillSingleQuestionResponse = jest.fn();

    const bootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'missing-session-slug',
      account,
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue(recentPayload),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue(''),
      writeQuestionsCache,
    });
    const flowPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: bootstrapResult,
    });
    const seededState = buildSingleQuestionSeededHydrationState({
      questionData: bootstrapResult.questionData,
      isLoadingResponse: flowPlan.seededHydration?.isLoadingResponse,
      mergeSurveyResponseState: (previous) => previous,
    });
    const fallbackPlan = resolveSingleQuestionCacheBootstrapStopHandlingPlan({
      bootstrapRetryAttempt: 0,
      cacheBootstrapPlan: flowPlan,
      effectiveSingleSlug: bootstrapResult.target.effectiveSingleSlug,
      questionId: bootstrapResult.target.questionId,
      responderAddress: bootstrapResult.target.responderAddress,
      runId: 1,
    });

    expect(bootstrapResult.status).toBe('seeded-from-recent');
    expect(bootstrapResult.cacheState).toBeNull();
    expect(seededState.questionPool[0]).toEqual(expect.objectContaining({ id: 'q1' }));
    expect(fallbackPlan).toEqual(
      expect.objectContaining({
        action: 'fallback',
        debugPayload: expect.objectContaining({
          phase: 'recent-payload-missing-network',
        }),
        fallbackStatePatch: { isLoadingResponse: false },
      }),
    );
    expect(getResponse).not.toHaveBeenCalled();
    expect(writeQuestionsCache).not.toHaveBeenCalled();
    expect(prefillSingleQuestionResponse).not.toHaveBeenCalled();
  });

  it('hydrates own response when recent payload exists and cache state is unavailable', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const latestResponse = {
      answer: { value: 'Agree', encrypted: false },
      additional: { value: '', encrypted: false },
      blockNumber: 12,
      logIndex: 1,
    };
    const recentPayload = {
      savedAtMs: Date.now(),
      creator: account,
      type: 'binary',
      prompt: 'Prompt from recent payload',
      tags: [],
    };
    const updateCacheAtomic = jest.fn(async (_namespace, _slug, updater) => updater(null));
    const bootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'unknown-slug',
      account,
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue(recentPayload),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue('84532'),
      updateCacheAtomic,
      ensureQuestionsNet,
    });
    const flowPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: bootstrapResult,
    });
    const stateRef = {
      current: {
        submissionComplete: false,
        startFresh: false,
        suppressPrefill: false,
        isLoadingResponse: true,
        userHasResponse: false,
        userResponseEncrypted: false,
        userAnswers: null,
        displayAnswerMode: true,
        isEditing: false,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));
    const getResponse = jest.fn().mockResolvedValue(latestResponse);
    const prefillSingleQuestionResponse = jest.fn();

    expect(flowPlan.action).toBe('continue');
    await expect(
      executeOwnSingleQuestionResponseBootstrap({
        props: {
          provider: {},
          account,
        },
        state: stateRef.current,
        questionId: 'q1',
        effectiveSingleSlug: 'unknown-slug',
        safeSetState,
        getResponse,
        writeResponseToCache: jest.fn(),
        areResponsesConsistent: jest.fn(),
        prefillSingleQuestionResponse,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        applied: true,
        reason: 'loaded',
        latest: latestResponse,
      }),
    );

    expect(getResponse).toHaveBeenCalledWith({
      provider: {},
      responderAddress: account,
      questionId: 'q1',
      effectiveSingleSlug: 'unknown-slug',
      forceArweaveFetch: false,
    });
    expect(prefillSingleQuestionResponse).toHaveBeenCalledWith(latestResponse);
    expect(stateRef.current.userHasResponse).toBe(true);
    expect(stateRef.current.noResponse).toBeUndefined();
  });
});
