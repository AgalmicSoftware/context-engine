import {
  buildSurveyLocalCacheSlice,
  executeSurveyResponsePrefill,
  executeSurveySingleQuestionPrefill,
  executeSurveyDraftHydration,
  executeSurveyLocalCacheRehydrate,
  executeSurveyPriorResponseBackfill,
  resolveSurveyMissingRenderedResponseLookup,
} from './surveyToolHydrationController';

type TestSlice = {
  answers: Record<string, { value: string }>;
  importance: Record<string, number>;
  conviction: Record<string, number>;
  additionalComments: Record<string, { value: string }>;
};

describe('surveyToolHydrationController', () => {
  it('reuses an in-flight prior-response backfill instead of starting a second one', async () => {
    const inFlight = Promise.resolve(true);
    const setCurrentInFlight = jest.fn();
    const runBackfillAttempt = jest.fn();

    await expect(
      executeSurveyPriorResponseBackfill({
        props: {
          loginComplete: true,
          account: '0xabc',
          displayAnswerMode: false,
          viewAddress: '',
          singleQuestionMode: false,
          responderAddress: '',
          refreshQuestionResponses: jest.fn(),
        },
        state: {
          submissionComplete: false,
          isSubmitting: false,
        },
        getCurrentInFlight: () => inFlight,
        setCurrentInFlight,
        runBackfillAttempt,
      }),
    ).resolves.toBe(true);

    expect(runBackfillAttempt).not.toHaveBeenCalled();
    expect(setCurrentInFlight).not.toHaveBeenCalled();
  });

  it('starts and clears tracked prior-response backfill promises around a successful run', async () => {
    let currentInFlight: Promise<boolean> | null = null;
    const setCurrentInFlight = jest.fn((value) => {
      currentInFlight = value;
    });
    const runBackfillAttempt = jest.fn().mockResolvedValue(true);

    await expect(
      executeSurveyPriorResponseBackfill({
        props: {
          loginComplete: true,
          account: '0xabc',
          displayAnswerMode: false,
          viewAddress: '',
          singleQuestionMode: false,
          responderAddress: '',
          refreshQuestionResponses: jest.fn(),
        },
        state: {
          submissionComplete: false,
          isSubmitting: false,
        },
        slug: 'edge',
        attemptedSet: new Set<string>(),
        getMissingRenderedResponseIdsForAccount: jest.fn().mockResolvedValue({
          missingIds: ['q1'],
          slug: 'edge',
          netId: '84532',
        }),
        setHydratingState: jest.fn(),
        isMounted: true,
        readQuestionsCacheAsync: jest.fn(),
        resetLocalCacheMemo: jest.fn(),
        triggerRehydrate: jest.fn(),
        getCurrentInFlight: () => currentInFlight,
        setCurrentInFlight,
        runBackfillAttempt,
      }),
    ).resolves.toBe(true);

    expect(runBackfillAttempt).toHaveBeenCalledTimes(1);
    expect(setCurrentInFlight).toHaveBeenNthCalledWith(1, expect.any(Promise));
    expect(setCurrentInFlight).toHaveBeenNthCalledWith(2, null);
    expect(currentInFlight).toBeNull();
  });

  it('reuses memoized local-cache slices without rebuilding them', () => {
    const loadLocalCacheSlice = jest.fn();

    expect(
      buildSurveyLocalCacheSlice({
        props: {
          account: '0xabc',
          minifiedMode: '',
          questionsCacheNonce: 1,
          questionResponsesNonce: 2,
        },
        rawSlug: 'edge',
        renderedIds: ['q1'],
        localCacheSliceMemo: {
          key: 'memo-key',
          value: { answers: { q1: { value: 'cached' } } },
          hasValue: true,
        },
        resolveLocalCacheSlice: () => ({
          scopeSlugs: ['edge'],
          networkIdStr: '84532',
          renderedIds: ['q1'],
          normalizedAccount: '0xabc',
          memoKey: 'memo-key',
          shouldUseMemo: true,
          memoizedValue: { answers: { q1: { value: 'cached' } } },
        }),
        loadLocalCacheSlice,
        setLocalCacheMemo: jest.fn(),
      }),
    ).toEqual({
      answers: { q1: { value: 'cached' } },
    });

    expect(loadLocalCacheSlice).not.toHaveBeenCalled();
  });

  it('stores built local-cache slices in the shared memo slot and resets memo state on errors', () => {
    const setLocalCacheMemo = jest.fn();

    expect(
      buildSurveyLocalCacheSlice({
        props: {
          account: '0xabc',
          minifiedMode: 'pile',
          questionsCacheNonce: 3,
          questionResponsesNonce: 4,
        },
        rawSlug: 'edge',
        renderedIds: ['q1'],
        localCacheSliceMemo: null,
        resolveLocalCacheSlice: () => ({
          scopeSlugs: ['edge', 'beta'],
          networkIdStr: '84532',
          renderedIds: ['q1'],
          normalizedAccount: '0xabc',
          memoKey: 'next-memo',
          shouldUseMemo: false,
          memoizedValue: null,
        }),
        loadLocalCacheSlice: () => ({
          answers: { q1: { value: '*' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        }),
        setLocalCacheMemo,
      }),
    ).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });

    expect(setLocalCacheMemo).toHaveBeenNthCalledWith(1, {
      key: 'next-memo',
      value: {
        answers: { q1: { value: '*' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      hasValue: true,
    });

    const onError = jest.fn();
    setLocalCacheMemo.mockClear();
    expect(
      buildSurveyLocalCacheSlice({
        props: { account: '0xabc' },
        rawSlug: 'edge',
        renderedIds: ['q1'],
        resolveLocalCacheSlice: () => {
          throw new Error('lookup failed');
        },
        setLocalCacheMemo,
        onError,
      }),
    ).toBeNull();

    expect(setLocalCacheMemo).toHaveBeenCalledWith({
      key: '',
      value: null,
      hasValue: false,
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('routes missing rendered-response lookups through the shared lookup helper', async () => {
    const resolveMissingLookup = jest.fn().mockResolvedValue({
      missingIds: ['q1'],
      slug: 'edge',
      netId: '84532',
    });

    await expect(
      resolveSurveyMissingRenderedResponseLookup({
        props: {
          account: '0xabc',
          minifiedMode: 'pile',
          surveyId: 'survey-a',
        },
        responder: '0xdef',
        slug: 'edge',
        fallbackSlug: 'fallback-edge',
        renderedIds: ['q1', 'Q2'],
        resolveQuestionSlugMapForIds: jest.fn(() => new Map([['q1', 'edge']])),
        resolveResponseHydrationContext: jest.fn(() => ({ sessionSlug: 'edge', networkIdStr: '84532' })),
        normalizeSessionSlugValue: jest.fn((value) => String(value || '').toLowerCase()),
        getExtraScopeSlugs: jest.fn(() => ['beta']),
        resolveScopeNetId: jest.fn(() => '84532'),
        readQuestionsCacheAsync: jest.fn(),
        ensureQuestionsNet: jest.fn(),
        resolveMissingLookup,
      }),
    ).resolves.toEqual({
      missingIds: ['q1'],
      slug: 'edge',
      netId: '84532',
    });

    expect(resolveMissingLookup).toHaveBeenCalledWith(
      expect.objectContaining({
        responderLower: '0xdef',
        rawSlug: 'edge',
        fallbackSlug: 'fallback-edge',
        renderedIds: ['q1', 'Q2'],
        minifiedMode: 'pile',
        surveyId: 'survey-a',
      }),
    );
  });

  it('hydrates draft updates through setState only when rendered ids and updates exist', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const updateJsonPreview = jest.fn();

    expect(
      executeSurveyDraftHydration({
        props: {
          isStandalone: false,
          singleQuestionMode: false,
          surveyIndex: 2,
        },
        state: {
          suppressPrefill: false,
          submissionError: '',
          modifiedCount: 0,
          isDirty: false,
          submittedSinceLastEdit: false,
          submissionComplete: false,
          surveysResponseState: [{}, {}, { answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
          editBaseline: null,
          pileQuestions: [],
        },
        loadDraft: () => ({ answers: { q1: { value: 'draft' } } }),
        getPendingEditStats: () => ({ total: 0 }),
        getHydrationQuestionIds: () => ['q1'],
        applyDraftHydrationEntryToSlice: jest.fn(),
        cloneBaseline: <T>(value: T): T => value,
        setState,
        updateJsonPreview,
        skipDraftHydrationRun: () => false,
        buildDraftSeedContext: () => ({
          surveyIndex: 2,
          prevSlice: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        }),
        buildDraftRunPlan: () => ({
          renderedQuestionIds: ['q1'],
          updates: {
            surveysResponseState: [{}, {}, { answers: { q1: { value: 'draft' } } }],
          },
        }),
      }),
    ).toEqual({
      reason: 'applied',
      applied: true,
      renderedQuestionIds: ['q1'],
    });

    expect(setState).toHaveBeenCalledWith(
      {
        surveysResponseState: [{}, {}, { answers: { q1: { value: 'draft' } } }],
      },
      expect.any(Function),
    );
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('applies multi-question prefill updates through shared state effects', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();

    expect(
      executeSurveyResponsePrefill({
        state: {},
        surveyIndex: 2,
        userAnswers: {
          responses: [{ questionID: 'q1' }],
        },
        buildSliceFromUserAnswers: jest.fn(),
        applyResponseHydrationListToSlice: jest.fn(),
        setState,
        updateJsonPreview,
        recalculateEditStats,
        buildUpdatePlan: () => ({
          updates: {
            surveysResponseState: [{}, {}, { answers: { q1: { value: 'prefilled' } } }],
          },
        }),
      }),
    ).toEqual({
      applied: true,
      reason: 'applied',
    });

    expect(setState).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
  });

  it('skips shared prefill orchestration when the payload is incomplete', () => {
    expect(
      executeSurveyResponsePrefill({
        surveyIndex: 0,
        userAnswers: null,
        setState: jest.fn(),
      }),
    ).toEqual({
      applied: false,
      reason: 'skip',
    });

    expect(
      executeSurveySingleQuestionPrefill({
        questionId: '',
        userAnswer: { answer: { value: 'x' } },
        setState: jest.fn(),
      }),
    ).toEqual({
      applied: false,
      reason: 'skip',
    });
  });

  it('applies single-question prefill updates through shared state effects', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();

    expect(
      executeSurveySingleQuestionPrefill({
        state: {},
        questionId: 'q1',
        userAnswer: { questionID: 'q1' },
        buildSliceFromUserAnswers: jest.fn(),
        applyResponseHydrationListToSlice: jest.fn(),
        setState,
        updateJsonPreview,
        recalculateEditStats,
        buildUpdatePlan: () => ({
          updates: {
            surveysResponseState: [{ answers: { q1: { value: 'prefilled' } } }],
          },
        }),
      }),
    ).toEqual({
      applied: true,
      reason: 'applied',
    });

    expect(setState).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
  });

  it('clears hydration signatures and retries prior responses when local-cache rehydrate misses', async () => {
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();
    const setLastHydrationSig = jest.fn();

    await expect(
      executeSurveyLocalCacheRehydrate({
        props: {
          isStandalone: false,
          singleQuestionMode: false,
          surveyIndex: 1,
        },
        state: {
          suppressPrefill: false,
          submissionError: '',
          submissionComplete: false,
          surveysResponseState: [{}, { answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
        },
        lastHydrationSig: 'stale|sig',
        getHydrationQuestionIds: () => ['q1'],
        buildHydrationSignature: () => 'next|sig',
        buildSliceFromLocalCache: async () => null,
        setLastHydrationSig,
        ensurePriorResponses,
        callback,
        prepareRehydrateRun: () => ({
          shouldSkip: false,
          shouldBumpNoop: false,
          hydrationSig: 'next|sig',
          baseSlice: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        }),
      }),
    ).resolves.toEqual({
      reason: 'cache-miss',
      applied: false,
      renderedQuestionIds: ['q1'],
      hydrationSig: '',
    });

    expect(setLastHydrationSig).toHaveBeenCalledWith('');
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('applies local-cache rehydrate updates and keeps the latest hydration signature', async () => {
    const stateRef: {
      current: {
        surveysResponseState: TestSlice[];
        editBaseline: TestSlice | null;
      };
    } = {
      current: {
        surveysResponseState: [
          {
            answers: {},
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
        editBaseline: null,
      },
    };
    const setState = jest.fn((update, callback) => {
      const patch = typeof update === 'function' ? update(stateRef.current) : update;
      if (patch && typeof patch === 'object') {
        stateRef.current = { ...stateRef.current, ...patch };
      }
      if (typeof callback === 'function') callback();
      return patch;
    });
    const setLastHydrationSig = jest.fn();
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();

    await expect(
      executeSurveyLocalCacheRehydrate({
        props: {
          isStandalone: false,
          singleQuestionMode: false,
          surveyIndex: 0,
        },
        state: {
          suppressPrefill: false,
          submissionError: '',
          submissionComplete: false,
          surveysResponseState: stateRef.current.surveysResponseState,
          editBaseline: stateRef.current.editBaseline,
        },
        lastHydrationSig: '',
        getHydrationQuestionIds: () => ['q1'],
        buildHydrationSignature: () => 'stable|sig',
        buildSliceFromLocalCache: async () => ({
          answers: { q1: { value: 'cached answer' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        }),
        setLastHydrationSig,
        loadDraft: () => ({ answers: {} }),
        buildDraftAnswersByQuestionId: () => ({}),
        cloneBaseline: <T>(value: T): T => JSON.parse(JSON.stringify(value)),
        buildDraftAwareCacheHydrationState: (args) => args,
        applyLocalCacheHydrationEntryToSlice: jest.fn(),
        setState,
        updateJsonPreview,
        recalculateEditStats,
        ensurePriorResponses,
        callback,
        prepareRehydrateRun: () => ({
          shouldSkip: false,
          shouldBumpNoop: false,
          hydrationSig: 'stable|sig',
          baseSlice: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        }),
        buildRehydrationUpdatePlan: () => ({
          changed: true,
          baselineChanged: false,
          updates: {
            surveysResponseState: [
              {
                answers: { q1: { value: 'cached answer' } },
                importance: {},
                conviction: {},
                additionalComments: {},
              },
            ],
            editBaseline: {
              answers: { q1: { value: 'cached answer' } },
              importance: {},
              conviction: {},
              additionalComments: {},
            },
          },
        }),
      }),
    ).resolves.toEqual({
      reason: 'applied',
      applied: true,
      renderedQuestionIds: ['q1'],
      hydrationSig: 'stable|sig',
    });

    expect(setLastHydrationSig).toHaveBeenCalledWith('stable|sig');
    expect(setState).toHaveBeenCalledTimes(1);
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
