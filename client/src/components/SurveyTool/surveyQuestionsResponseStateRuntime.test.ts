import * as workerHydration from '../../utilities/survey/workerResponseHydration';
import { createSurveyQuestionsResponseStateRuntime } from './surveyQuestionsResponseStateRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  DEBUG_PREFILL: false,
  areEnvelopesEquivalent: jest.fn(() => true),
  buildDraftAnswersByQuestionId: jest.fn(() => ({})),
  buildDraftAwareCacheHydrationState: jest.fn((args) => args),
  buildEmptyResponseFieldState: jest.fn(() => ({})),
  buildHydratedResponseSlice: jest.fn(({ userAnswers }) => ({
    answers: userAnswers || {},
  })),
  buildLocalCacheHydrationSignature: jest.fn(() => 'sig'),
  buildSurveyLocalCacheSlice: jest.fn(({ setLocalCacheMemo }) => {
    setLocalCacheMemo({ hasValue: true, key: 'edge:q1', value: { answers: { q1: { value: 'cached' } } } });
    return {
      answers: {
        q1: {
          value: 'cached',
        },
      },
    };
  }),
  bumpSurveyPerfCounter: jest.fn(),
  clearDraft: jest.fn(),
  engine: {},
  ensurePriorResponsesForRenderedIds: jest.fn(),
  executeSurveyFormStateReset: jest.fn(),
  executeSurveyLocalCacheRehydrate: jest.fn(),
  executeSurveyPendingRevert: jest.fn(),
  executeSurveyResponsePrefill: jest.fn(),
  getCurrentRenderedQuestionIds: jest.fn(() => ['q1']),
  getEditTrackingQuestionIds: jest.fn(() => new Set<string>()),
  getExtraQuestionReadSlugs: jest.fn(() => []),
  getHydrationQuestionIds: jest.fn(() => ['q1']),
  initializeSurveyResponseState: jest.fn(),
  inst: {
    _viewAllSync: null as { loaded: Set<string>; restored: Set<string> } | null,
    _applyCachedResponseEntryToSlice: jest.fn(),
    _applyLocalCacheHydrationEntryToSlice: jest.fn(),
    _applyResponseHydrationListToSlice: jest.fn(),
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _localCacheRehydrateRunId: 0,
    _localCacheSliceMemo: { hasValue: false, key: '', value: null },
    _isMounted: true,
  },
  loadDraft: jest.fn(() => null),
  mergeQuestionResponses: jest.fn(),
  normalizeQuestionIdKey: jest.fn((value) =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
  normalizeSessionSlugValue: jest.fn((value) => String(value || '').toLowerCase()),
  persistDraft: jest.fn(),
  propsRef: {
    current: {
      isStandalone: false,
      surveyIndex: 0,
    },
  },
  readQuestionsCache: jest.fn(),
  recalculateEditStats: jest.fn(),
  resolveResponseHydrationContext: jest.fn(() => ({ sessionSlug: 'edge' })),
  resolveSurveyBaselineSourceSlice: jest.fn(() => ({
    baselineSlice: { answers: {} },
    nextUserAnswersSliceCache: null,
  })),
  setResponseHydrationState: jest.fn(),
  setState: jest.fn(),
  stateRef: {
    current: {
      editBaseline: { answers: {} },
      surveysResponseState: [{ answers: {} }],
      userAnswers: {},
    },
  },
  surveyLog: {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  },
  updateJsonPreview: jest.fn(),
  updateSubmittedSinceLastEdit: jest.fn(),
  ...overrides,
});

describe('surveyQuestionsResponseStateRuntime', () => {
  it('preserves value equality semantics for empty, numeric, and array answers', () => {
    const runtime = createSurveyQuestionsResponseStateRuntime(createContext());

    expect(runtime.valuesEqual('', null)).toBe(true);
    for (const empty of ['', null, undefined]) {
      expect(runtime.valuesEqual(empty, 0)).toBe(false);
      expect(runtime.valuesEqual(0, empty)).toBe(false);
    }
    expect(runtime.valuesEqual('0', 0)).toBe(true);
    expect(runtime.valuesEqual('4', 4)).toBe(true);
    expect(runtime.valuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(runtime.valuesEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('builds local-cache slices with rendered ids and memo updates', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsResponseStateRuntime(context);

    expect(runtime.buildSliceFromLocalCache()).toEqual({
      answers: {
        q1: {
          value: 'cached',
        },
      },
    });
    expect(context.buildSurveyLocalCacheSlice).toHaveBeenCalledWith(
      expect.objectContaining({
        rawSlug: 'edge',
        renderedIds: ['q1'],
      }),
    );
    expect(context.inst._localCacheSliceMemo).toEqual({
      hasValue: true,
      key: 'edge:q1',
      value: {
        answers: {
          q1: {
            value: 'cached',
          },
        },
      },
    });
  });

  // View all: the cache holds a saved answer for q1, the draft a comment typed in the pile.
  const viewAllContext = (state: Record<string, unknown> = {}) => {
    const context = createContext({
      buildDraftAwareCacheHydrationState: jest.fn(({ cachedAnswer, cachedAdditional }) => ({
        effectiveAnswerState: cachedAnswer,
        effectiveAdditionalState: cachedAdditional,
      })),
      loadDraft: jest.fn(() => ({ answers: { q1: { additional: 'Draft comment' } }, baseline: {} })),
      propsRef: { current: { isStandalone: true, isResponsesCacheReady: true, sessionConfig: null } },
    });
    context.inst._viewAllSync = { loaded: new Set<string>(), restored: new Set<string>() };
    // Minimal appliers: saved answers fill empty fields; the draft writes its comment.
    context.inst._applyLocalCacheHydrationEntryToSlice = jest.fn(({ targetSlice, questionId, cachedAnswer }) => {
      if (!cachedAnswer || targetSlice.answers[questionId]?.value) return false;
      targetSlice.answers[questionId] = { ...targetSlice.answers[questionId], ...cachedAnswer };
      return true;
    });
    Object.assign(context.inst, {
      _applyDraftHydrationEntryToSlice: jest.fn(({ targetSlice, questionId, draftEntry }) => {
        targetSlice.additionalComments[questionId] = { value: draftEntry.additional };
        return true;
      }),
    });
    Object.assign(context.stateRef.current, {
      editBaseline: { answers: {}, additionalComments: {} },
      surveysResponseState: [{ answers: { q1: { value: '' } }, additionalComments: { q1: { value: '' } } }],
      ...state,
    });
    return context;
  };
  const applySync = (context: ReturnType<typeof viewAllContext>) => {
    const [update] = context.setResponseHydrationState.mock.calls.at(-1) as [(prev: unknown) => any];
    return update(context.stateRef.current);
  };

  it('loads a question new to View all and restores its draft over it, even after a Submit', () => {
    const context = viewAllContext({ submissionComplete: true });

    createSurveyQuestionsResponseStateRuntime(context).syncViewAllQuestions();

    const next = applySync(context);
    expect(next.surveysResponseState[0].answers.q1.value).toBe('cached');
    expect(next.surveysResponseState[0].additionalComments.q1.value).toBe('Draft comment');
    expect(next.editBaseline.answers.q1.value).toBe('cached');
    expect([...context.inst._viewAllSync!.loaded]).toEqual(['q1']);
    expect([...context.inst._viewAllSync!.restored]).toEqual(['q1']);
  });

  it('leaves loaded questions alone while a Submit result holds the form, and forgets questions that left', () => {
    const context = viewAllContext({ submissionComplete: true });
    context.inst._viewAllSync = { loaded: new Set(['q1', 'q9']), restored: new Set(['q1', 'q9']) };

    createSurveyQuestionsResponseStateRuntime(context).syncViewAllQuestions();

    expect(context.setResponseHydrationState).not.toHaveBeenCalled();
    expect([...context.inst._viewAllSync!.loaded]).toEqual(['q1']);
    expect([...context.inst._viewAllSync!.restored]).toEqual(['q1']);
  });

  it('counts saved answers as loaded only once the Worker listing has loaded', () => {
    jest.spyOn(workerHydration, 'isWorkerCanonicalSessionConfig').mockReturnValue(true);
    const context = viewAllContext();
    const props = context.propsRef.current as Record<string, unknown>;
    props.isResponsesCacheReady = false;
    const runtime = createSurveyQuestionsResponseStateRuntime(context);

    runtime.syncViewAllQuestions();
    expect([...context.inst._viewAllSync!.loaded]).toEqual([]);
    expect([...context.inst._viewAllSync!.restored]).toEqual(['q1']);

    // Once the listing is complete, a held form still gets the saved answers it never loaded.
    props.isResponsesCacheReady = true;
    (context.stateRef.current as Record<string, unknown>).suppressPrefill = true;
    runtime.syncViewAllQuestions();
    expect(applySync(context).surveysResponseState[0].answers.q1.value).toBe('cached');
    expect([...context.inst._viewAllSync!.loaded]).toEqual(['q1']);
  });
});
