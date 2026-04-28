import {
  executeSurveyDraftHydration,
  executeSurveyLocalCacheRehydrate,
  executeSurveyPriorResponseBackfill,
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

    await expect(executeSurveyPriorResponseBackfill({
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
    })).resolves.toBe(true);

    expect(runBackfillAttempt).not.toHaveBeenCalled();
    expect(setCurrentInFlight).not.toHaveBeenCalled();
  });

  it('starts and clears tracked prior-response backfill promises around a successful run', async () => {
    let currentInFlight: Promise<boolean> | null = null;
    const setCurrentInFlight = jest.fn((value) => {
      currentInFlight = value;
    });
    const runBackfillAttempt = jest.fn().mockResolvedValue(true);

    await expect(executeSurveyPriorResponseBackfill({
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
    })).resolves.toBe(true);

    expect(runBackfillAttempt).toHaveBeenCalledTimes(1);
    expect(setCurrentInFlight).toHaveBeenNthCalledWith(1, expect.any(Promise));
    expect(setCurrentInFlight).toHaveBeenNthCalledWith(2, null);
    expect(currentInFlight).toBeNull();
  });

  it('hydrates draft updates through setState only when rendered ids and updates exist', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const updateJsonPreview = jest.fn();

    expect(executeSurveyDraftHydration({
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
      cloneBaseline: <T,>(value: T): T => value,
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
    })).toEqual({
      reason: 'applied',
      applied: true,
      renderedQuestionIds: ['q1'],
    });

    expect(setState).toHaveBeenCalledWith({
      surveysResponseState: [{}, {}, { answers: { q1: { value: 'draft' } } }],
    }, expect.any(Function));
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('clears hydration signatures and retries prior responses when local-cache rehydrate misses', async () => {
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();
    const setLastHydrationSig = jest.fn();

    await expect(executeSurveyLocalCacheRehydrate({
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
    })).resolves.toEqual({
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
        surveysResponseState: [{
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        }],
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

    await expect(executeSurveyLocalCacheRehydrate({
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
      cloneBaseline: <T,>(value: T): T => JSON.parse(JSON.stringify(value)),
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
          surveysResponseState: [{
            answers: { q1: { value: 'cached answer' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          }],
          editBaseline: {
            answers: { q1: { value: 'cached answer' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        },
      }),
    })).resolves.toEqual({
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
