import {
  buildSingleQuestionPreservedPoolState,
  buildSingleQuestionSourceRestoreContextPlan,
  buildSingleQuestionSeededHydrationState,
  resolveSingleQuestionCacheBootstrap,
  resolveSingleQuestionCacheBootstrapFlowPlan,
  resolveSingleQuestionCacheBootstrapStopHandlingPlan,
} from './surveyToolSingleQuestionCacheBootstrapController';

type TestQuestionsCache = Record<
  string,
  {
    questions: Record<string, Record<string, unknown>>;
  }
>;

const ensureQuestionsNet = (cache: unknown, netId: string): TestQuestionsCache => {
  const nextCache = {
    ...(cache && typeof cache === 'object' ? (cache as TestQuestionsCache) : {}),
  };

  nextCache[netId] = nextCache[netId] || { questions: {} };
  nextCache[netId].questions = nextCache[netId].questions || {};

  return nextCache;
};

describe('surveyToolSingleQuestionCacheBootstrapController', () => {
  it('plans missing route question ids without cache, retry, or state execution', () => {
    const getQuestionFetchCandidateSlugs = jest.fn(() => ['edge']);

    expect(
      buildSingleQuestionSourceRestoreContextPlan({
        bootstrapRetryAttempt: 2,
        getQuestionFetchCandidateSlugs,
        props: { questionID: '' },
        runId: 9,
      }),
    ).toEqual({
      status: 'missing-question-id',
      bootstrapRetryAttempt: 2,
      debugPayload: {
        phase: 'missing-question-id',
        runId: 9,
        bootstrapRetryAttempt: 2,
      },
      hasPendingRetryForQuestion: false,
      pendingRetryQuestionId: '',
      pendingRetrySig: '',
      questionId: '',
      retryCleanupAction: 'none',
      statePatch: { isLoadingResponse: false },
    });
    expect(getQuestionFetchCandidateSlugs).not.toHaveBeenCalled();
  });

  it('plans source slug candidates and retry cleanup without clearing retries in the helper', () => {
    const getQuestionFetchCandidateSlugs = jest.fn(() => ['edge', 'fallback', '']);

    expect(
      buildSingleQuestionSourceRestoreContextPlan({
        bootstrapRetryAttempt: 0,
        getQuestionFetchCandidateSlugs,
        maxCandidateSlugs: 2,
        pendingRetrySig: 'other-question:1',
        props: {
          questionID: 'Q1',
          sessionName: 'Edge',
          sessionSlug: 'edge',
          activeSessionSlug: 'edge',
          sessionSlugPinned: true,
          responderAddress: '0xABCD',
          questionResponsesNonce: 4,
          questionsCacheNonce: 7,
        },
        questionPool: [{ id: 'q1', sessionName: 'edge-from-pool' }],
        runId: 10,
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'ready',
        bootstrapRetryAttempt: 0,
        fetchCandidateSlugs: ['edge', 'fallback'],
        hasPendingRetryForQuestion: false,
        pendingRetryQuestionId: 'other-question',
        pendingRetrySig: 'other-question:1',
        questionId: 'q1',
        retryCleanupAction: 'clear-different-question',
        slugPinned: true,
        startDebugPayload: {
          phase: 'start',
          runId: 10,
          questionId: 'q1',
          responderAddress: '0xabcd',
          bootstrapRetryAttempt: 0,
          pendingRetrySig: 'other-question:1',
          hasPendingRetryForQuestion: false,
          questionResponsesNonce: 4,
          questionsCacheNonce: 7,
        },
      }),
    );
    expect(getQuestionFetchCandidateSlugs).toHaveBeenCalledWith('q1', expect.any(String), {
      allowPinnedFallback: true,
    });
  });

  it('plans blocked question state without applying parent mutations', () => {
    const getQuestionFetchCandidateSlugs = jest.fn(() => ['blocked-slug']);

    expect(
      buildSingleQuestionSourceRestoreContextPlan({
        getBlockedQuestionIds: jest.fn(() => new Set(['blocked-question'])),
        getQuestionFetchCandidateSlugs,
        maxCandidateSlugs: 3,
        props: {
          questionID: 'blocked-question',
          sessionSlug: 'blocked-slug',
          activeSessionSlug: 'blocked-slug',
        },
        runId: 11,
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'blocked-question',
        debugPayload: {
          phase: 'blocked-question',
          runId: 11,
          questionId: 'blocked-question',
          effectiveSingleSlug: 'blocked-slug',
        },
        statePatch: {
          questionPool: [],
          isLoadingResponse: false,
          noResponse: true,
          responseLookupWarning: '',
          displayAnswerMode: true,
        },
      }),
    );
  });

  it('plans ready cache bootstrap results as continuation without seeded hydration', () => {
    const cacheState = {
      netIdStr: '84532',
      questionsCache: {
        '84532': {
          questions: {
            q1: { id: 'q1', prompt: 'cached' },
          },
        },
      },
    };

    expect(
      resolveSingleQuestionCacheBootstrapFlowPlan({
        cacheBootstrapResult: {
          status: 'ready',
          cacheState,
          questionData: { id: 'q1', prompt: 'cached' },
          recentPayloadForAccount: null,
        },
      }),
    ).toEqual({
      action: 'continue',
      cacheState,
      questionData: { id: 'q1', prompt: 'cached' },
      recentPayloadForAccount: null,
      seededHydration: null,
    });
  });

  it('plans seeded recent payloads waiting on a viewed response as retry-only parent work', () => {
    expect(
      resolveSingleQuestionCacheBootstrapFlowPlan({
        cacheBootstrapResult: {
          status: 'seeded-from-recent',
          cacheState: null,
          questionData: { id: 'q1', prompt: 'recent' },
          recentPayloadForAccount: { id: 'q1', prompt: 'recent' },
          shouldBootstrapViewedResponse: true,
          fallbackNetId: '',
        },
      }),
    ).toEqual({
      action: 'stop',
      debugPhase: '',
      fallbackStatePatch: {},
      logMissingCacheState: false,
      preserveCurrentPoolPatch: null,
      retryPlan: {
        reason: 'recent-payload-waiting-for-response-bootstrap',
        retryingPhase: 'recent-payload-response-bootstrap-retrying',
        exhaustedPhase: 'recent-payload-response-bootstrap-exhausted',
        exhaustedStatePatch: {
          viewAddressAnswers: '',
          parsedViewAddressAnswers: null,
          noResponse: true,
          responseLookupWarning: '',
          isLoadingResponse: false,
        },
      },
      seededHydration: {
        questionData: { id: 'q1', prompt: 'recent' },
        isLoadingResponse: true,
      },
    });
  });

  it('plans seeded recent payloads without a fallback network as a parent stop', () => {
    expect(
      resolveSingleQuestionCacheBootstrapFlowPlan({
        cacheBootstrapResult: {
          status: 'seeded-from-recent',
          cacheState: null,
          questionData: { id: 'q1', prompt: 'recent' },
          recentPayloadForAccount: { id: 'q1', prompt: 'recent' },
          shouldBootstrapViewedResponse: false,
          fallbackNetId: '',
        },
      }),
    ).toEqual({
      action: 'stop',
      debugPhase: 'recent-payload-missing-network',
      fallbackStatePatch: { isLoadingResponse: false },
      logMissingCacheState: false,
      preserveCurrentPoolPatch: null,
      retryPlan: null,
      seededHydration: {
        questionData: { id: 'q1', prompt: 'recent' },
        isLoadingResponse: false,
      },
    });
  });

  it('plans missing cache state stops without creating parent side effects', () => {
    expect(
      resolveSingleQuestionCacheBootstrapFlowPlan({
        cacheBootstrapResult: { status: 'missing-cache-state' },
      }),
    ).toEqual({
      action: 'stop',
      debugPhase: 'missing-cache-state',
      fallbackStatePatch: { isLoadingResponse: false },
      logMissingCacheState: true,
      preserveCurrentPoolPatch: { isLoadingResponse: false },
      retryPlan: null,
      seededHydration: null,
    });
  });

  it('builds seeded hydration patches while delegating response-state merging to the parent', () => {
    const mergeSurveyResponseState = jest.fn((previous, questions, surveyIndex) => ({
      previous,
      questions,
      surveyIndex,
    }));

    expect(
      buildSingleQuestionSeededHydrationState({
        prevState: {
          surveysResponseState: [{ answers: { q1: { value: 'old' } } }],
        },
        questionData: { id: 'q1', prompt: 'recent' },
        isLoadingResponse: true,
        mergeSurveyResponseState,
      }),
    ).toEqual({
      questionPool: [{ id: 'q1', prompt: 'recent' }],
      surveysResponseState: {
        previous: [{ answers: { q1: { value: 'old' } } }],
        questions: [{ id: 'q1', prompt: 'recent' }],
        surveyIndex: 0,
      },
      viewAddressAnswers: '',
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: true,
    });
    expect(mergeSurveyResponseState).toHaveBeenCalledTimes(1);
  });

  it('plans preserved current question state by normalized question identity', () => {
    expect(
      buildSingleQuestionPreservedPoolState({
        questionId: 'Q1',
        questionPool: [
          { id: 'q-other', prompt: 'Other' },
          { questionID: 'Q1', prompt: 'Current shell', transient: true },
        ],
        extraState: { isLoadingResponse: false },
      }),
    ).toEqual({
      action: 'preserve',
      statePatch: {
        questionPool: [
          {
            questionID: 'Q1',
            id: 'q1',
            prompt: 'Current shell',
            transient: true,
          },
        ],
        isLoadingResponse: false,
      },
    });
  });

  it('skips preserved current question state when identity is missing', () => {
    expect(
      buildSingleQuestionPreservedPoolState({
        questionId: 'missing',
        questionPool: [{ id: 'q1', prompt: 'Current shell' }],
        extraState: { isLoadingResponse: false },
      }),
    ).toEqual({
      action: 'skip',
      statePatch: null,
    });

    expect(
      buildSingleQuestionPreservedPoolState({
        questionId: '',
        questionPool: [{ id: 'q1', prompt: 'Current shell' }],
      }),
    ).toEqual({
      action: 'skip',
      statePatch: null,
    });
  });

  it('plans retry stop handling without scheduling retries or applying state', () => {
    const cacheBootstrapPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: {
        status: 'seeded-from-recent',
        cacheState: null,
        questionData: { id: 'q1', prompt: 'recent' },
        recentPayloadForAccount: { id: 'q1', prompt: 'recent' },
        shouldBootstrapViewedResponse: true,
        fallbackNetId: '',
      },
    });

    expect(
      resolveSingleQuestionCacheBootstrapStopHandlingPlan({
        bootstrapRetryAttempt: 2,
        cacheBootstrapPlan,
        effectiveSingleSlug: 'edge',
        questionId: 'Q1',
        responderAddress: '0xABCD',
        runId: 17,
      }),
    ).toEqual({
      action: 'retry',
      retryRequest: {
        questionId: 'q1',
        attempt: 2,
        reason: 'recent-payload-waiting-for-response-bootstrap',
      },
      retryOutcome: null,
    });

    expect(
      resolveSingleQuestionCacheBootstrapStopHandlingPlan({
        bootstrapRetryAttempt: 2,
        cacheBootstrapPlan,
        didScheduleRetry: false,
        effectiveSingleSlug: 'edge',
        questionId: 'Q1',
        responderAddress: '0xABCD',
        runId: 17,
      }),
    ).toEqual({
      action: 'retry',
      retryRequest: {
        questionId: 'q1',
        attempt: 2,
        reason: 'recent-payload-waiting-for-response-bootstrap',
      },
      retryOutcome: {
        debugPayload: {
          phase: 'recent-payload-response-bootstrap-exhausted',
          runId: 17,
          questionId: 'q1',
          effectiveSingleSlug: 'edge',
          responderAddress: '0xabcd',
          retryAttempt: 2,
          didScheduleRetry: false,
        },
        exhaustedStatePatch: {
          viewAddressAnswers: '',
          parsedViewAddressAnswers: null,
          noResponse: true,
          responseLookupWarning: '',
          isLoadingResponse: false,
        },
        shouldClearRetry: true,
      },
    });
  });

  it('plans fallback stop handling without logging or mutating parent state', () => {
    const cacheBootstrapPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: {
        status: 'seeded-from-recent',
        cacheState: null,
        questionData: { id: 'q1', prompt: 'recent' },
        recentPayloadForAccount: { id: 'q1', prompt: 'recent' },
        shouldBootstrapViewedResponse: false,
        fallbackNetId: '',
      },
    });

    expect(
      resolveSingleQuestionCacheBootstrapStopHandlingPlan({
        bootstrapRetryAttempt: 3,
        cacheBootstrapPlan,
        effectiveSingleSlug: 'edge',
        questionId: 'Q1',
        runId: 18,
      }),
    ).toEqual({
      action: 'fallback',
      debugPayload: {
        phase: 'recent-payload-missing-network',
        runId: 18,
        questionId: 'q1',
        effectiveSingleSlug: 'edge',
        retryAttempt: 3,
      },
      fallbackStatePatch: { isLoadingResponse: false },
      logMissingCacheState: false,
      preserveCurrentPoolPatch: null,
      shouldApplyFallbackStatePatch: true,
    });
  });

  it("returns 'ready' when cache state resolves immediately and no recent payload exists", async () => {
    const questionData = { id: 'q1', prompt: 'test' };

    await expect(
      resolveSingleQuestionCacheBootstrap({
        questionId: 'q1',
        effectiveSingleSlug: 'edge',
        resolveCacheState: jest.fn().mockResolvedValue({
          netIdStr: '84532',
          questionsCache: {
            '84532': {
              questions: {
                q1: questionData,
              },
            },
          },
        }),
        readRecentPayload: jest.fn().mockReturnValue(null),
      }),
    ).resolves.toEqual({
      status: 'ready',
      cacheState: {
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {
              q1: questionData,
            },
          },
        },
      },
      questionData,
      recentPayloadForAccount: null,
      target: {
        account: '',
        effectiveSingleSlug: 'edge',
        questionId: 'q1',
        responderAddress: '',
      },
    });
  });

  it("returns 'ready' and merges recent payload into cached data when both exist", async () => {
    const writeQuestionsCache = jest.fn();

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      account: '0xabc',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'old' },
            },
          },
        },
      }),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'newer', creator: '0xabc' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      pickBetterQuestionPayload: jest.fn((_current, next) => next),
      areQuestionPayloadsEquivalent: jest.fn().mockReturnValue(false),
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData!.prompt).toBe('newer');
    expect(result.target).toEqual({
      account: '0xabc',
      effectiveSingleSlug: 'edge',
      questionId: 'q1',
      responderAddress: '',
    });
    expect(writeQuestionsCache).toHaveBeenCalledTimes(1);
  });

  it('keeps equivalent recent payloads read-only when cached question data is current', async () => {
    const writeQuestionsCache = jest.fn();
    const cachedQuestion = {
      id: 'q1',
      prompt: 'current',
      tags: ['stable'],
    };
    const pickBetterQuestionPayload = jest.fn((current) => current);
    const areQuestionPayloadsEquivalent = jest.fn(() => true);

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      account: '0xabc',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {
              q1: cachedQuestion,
            },
          },
        },
      }),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'current', tags: ['stable'] }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      pickBetterQuestionPayload,
      areQuestionPayloadsEquivalent,
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData).toEqual(cachedQuestion);
    expect(result.recentPayloadForAccount).toEqual({
      id: 'q1',
      prompt: 'current',
      tags: ['stable'],
    });
    expect(result.target).toEqual({
      account: '0xabc',
      effectiveSingleSlug: 'edge',
      questionId: 'q1',
      responderAddress: '',
    });
    expect(pickBetterQuestionPayload).toHaveBeenCalledWith(cachedQuestion, result.recentPayloadForAccount);
    expect(areQuestionPayloadsEquivalent).toHaveBeenCalledWith(cachedQuestion, cachedQuestion);
    expect(writeQuestionsCache).not.toHaveBeenCalled();
  });

  it('restores encrypted gated recent question payloads over stale cached shells', async () => {
    const writeQuestionsCache = jest.fn();
    const questionsCache = {
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: 'stale plaintext shell',
            tags: ['old-tag'],
          },
        },
      },
    };
    const recentPayload = {
      prompt: {
        value: '*',
        encrypted: true,
        encryptedPortion: 'cipher-prompt',
      },
      encryption: {
        enabled: true,
        gates: [{ id: 'gate-alpha', type: 'sbt' }],
      },
      tags: ['gated'],
    };

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      account: '0xabc',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache,
      }),
      readRecentPayload: jest.fn().mockReturnValue(recentPayload),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      pickBetterQuestionPayload: jest.fn((_current, next) => next),
      areQuestionPayloadsEquivalent: jest.fn().mockReturnValue(false),
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData).toEqual({
      ...recentPayload,
      id: 'q1',
    });
    expect(writeQuestionsCache).toHaveBeenCalledWith('edge', {
      '84532': {
        questions: {
          q1: {
            ...recentPayload,
            id: 'q1',
          },
        },
      },
    });
  });

  it("returns 'missing-cache-state' when no cache and no recent payload", async () => {
    await expect(
      resolveSingleQuestionCacheBootstrap({
        questionId: 'q1',
        effectiveSingleSlug: 'edge',
        resolveCacheState: jest.fn().mockResolvedValue(null),
        readRecentPayload: jest.fn().mockReturnValue(null),
      }),
    ).resolves.toEqual({
      status: 'missing-cache-state',
      target: {
        account: '',
        effectiveSingleSlug: 'edge',
        questionId: 'q1',
        responderAddress: '',
      },
    });
  });

  it("returns 'seeded-from-recent' with fallbackNetId when cache is missing but recent payload exists", async () => {
    const updateCacheAtomic = jest.fn(async (_key, _slug, updater) => updater({}));

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      responderAddress: '0xresp',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'from-recent', creator: '' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue('84532'),
      updateCacheAtomic,
      ensureQuestionsNet: jest.fn(ensureQuestionsNet),
    });

    expect(result.status).toBe('seeded-from-recent');
    if (result.status !== 'seeded-from-recent') {
      throw new Error(`expected seeded-from-recent, got ${result.status}`);
    }

    expect(result.shouldBootstrapViewedResponse).toBe(true);
    expect(result.fallbackNetId).toBe('84532');
    expect(result.cacheState).not.toBeNull();
    expect(result.target).toEqual({
      account: '',
      effectiveSingleSlug: 'edge',
      questionId: 'q1',
      responderAddress: '0xresp',
    });
  });

  it("returns 'seeded-from-recent' with null cacheState when fallbackNetId is empty", async () => {
    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'recent' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue(''),
    });

    expect(result.status).toBe('seeded-from-recent');
    if (result.status !== 'seeded-from-recent') {
      throw new Error(`expected seeded-from-recent, got ${result.status}`);
    }

    expect(result.fallbackNetId).toBe('');
    expect(result.cacheState).toBeNull();
    expect(result.target).toEqual({
      account: '',
      effectiveSingleSlug: 'edge',
      questionId: 'q1',
      responderAddress: '',
    });
  });

  it('seeds recent payload into cache when cached qData is missing for the questionId', async () => {
    const writeQuestionsCache = jest.fn();

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {},
          },
        },
      }),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'seeded' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData!.prompt).toBe('seeded');
    expect(writeQuestionsCache).toHaveBeenCalled();
  });

  it('normalizes creator and tags on seeded question data', async () => {
    const updateCacheAtomic = jest.fn(async (_key, _slug, updater) => updater({}));

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'test' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue('84532'),
      updateCacheAtomic,
      ensureQuestionsNet: jest.fn(ensureQuestionsNet),
    });

    expect(result.status).toBe('seeded-from-recent');
    if (result.status !== 'seeded-from-recent') {
      throw new Error(`expected seeded-from-recent, got ${result.status}`);
    }

    expect(result.questionData.creator).toBe('');
    expect(Array.isArray(result.questionData.tags)).toBe(true);
  });
});
