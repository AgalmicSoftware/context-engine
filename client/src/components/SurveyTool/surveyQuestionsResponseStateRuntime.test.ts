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
});
