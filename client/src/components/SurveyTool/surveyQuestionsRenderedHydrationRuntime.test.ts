import { createSurveyQuestionsRenderedHydrationRuntime } from './surveyQuestionsRenderedHydrationRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  buildDraftHydrationRunPlan: jest.fn(),
  buildHydratingPriorResponsesState: jest.fn((active) => ({ hydratingPriorResponses: active })),
  buildNormalizedRenderedQuestionIds: jest.fn((ids) => ids),
  buildRenderedQuestionIdsFromQuestionPools: jest.fn(() => ['q1', 'q2']),
  buildSubmissionGroupContext: jest.fn((input) => input),
  deepClone: jest.fn((value) => value),
  engine: {},
  ensureQuestionsNet: jest.fn(),
  executeSurveyDraftHydration: jest.fn(),
  executeSurveyPriorResponseBackfill: jest.fn(),
  getExtraQuestionReadSlugs: jest.fn(() => ['edge-extra']),
  getPendingEditStats: jest.fn(() => null),
  getRuntimeStrategy: jest.fn(() => ({})),
  getSessionSlugByName: jest.fn(),
  inst: {
    _applyDraftHydrationEntryToSlice: jest.fn(),
    _currentRenderedQuestionIdsCache: null,
    _isMounted: () => true,
    _localCacheSliceMemo: { hasValue: false, key: '', value: null },
    _priorResponseBackfillAttempted: new Set<string>(),
    _priorResponseBackfillInFlight: null,
    _rehydrateLocalCacheLastSig: '',
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
  },
  loadDraft: jest.fn(() => null),
  normalizeSessionSlugValue: jest.fn((value) =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
  propsRef: {
    current: {
      account: '0xabc',
      minifiedMode: 'pile',
      questionID: 'q1',
      questionResponsesNonce: 3,
      questionsCacheNonce: 2,
      singleQuestionMode: false,
      surveyId: 'survey-1',
    },
  },
  readQuestionsCacheAsync: jest.fn(),
  readRenderedQuestionIds: jest.fn(({ getRenderedQuestionIds }) => getRenderedQuestionIds()),
  rehydrateLocalCacheAnswersForRenderedIds: jest.fn(),
  resolveEffectiveSlug: jest.fn(() => 'edge'),
  resolveLocalCacheHydrationSignatureLookup: jest.fn(() => 'sig'),
  resolveQuestionSlugMapLookup: jest.fn(() => ({ q1: 'edge' })),
  resolveResponseHydrationContext: jest.fn(() => ({
    networkIdStr: '11155420',
    sessionSlug: 'edge',
  })),
  resolveSlugForIds: jest.fn(),
  resolveSurveyMissingRenderedResponseLookup: jest.fn(() => []),
  setResponseHydrationState: jest.fn(),
  setState: jest.fn(),
  stateRef: {
    current: {
      pileQuestions: [{ id: 'q2' }],
      questionPool: [{ id: 'q1' }],
      submissionComplete: false,
      submissionError: null,
      suppressPrefill: false,
    },
  },
  surveyLog: {
    warn: jest.fn(),
  },
  updateJsonPreview: jest.fn(),
  ...overrides,
});

describe('surveyQuestionsRenderedHydrationRuntime', () => {
  it('caches rendered question ids for stable pool inputs', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRenderedHydrationRuntime(context);

    expect(runtime.getCurrentRenderedQuestionIds()).toEqual(['q1', 'q2']);
    expect(runtime.getCurrentRenderedQuestionIds()).toEqual(['q1', 'q2']);
    expect(context.buildRenderedQuestionIdsFromQuestionPools).toHaveBeenCalledTimes(1);
  });

  it('builds local-cache hydration signatures from rendered scope inputs', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRenderedHydrationRuntime(context);

    expect(runtime.buildLocalCacheHydrationSignature(0, ['q1'])).toBe('sig');
    expect(context.resolveLocalCacheHydrationSignatureLookup).toHaveBeenCalledWith(
      expect.objectContaining({
        account: '0xabc',
        minifiedMode: 'pile',
        questionResponsesNonce: 3,
        questionsCacheNonce: 2,
        rawSlug: 'edge',
        renderedIds: ['q1'],
        surveyIndex: 0,
      }),
    );

    const signatureInput = context.resolveLocalCacheHydrationSignatureLookup.mock.calls[0][0];
    expect(signatureInput.getExtraScopeSlugs('edge')).toEqual(['edge-extra']);
    expect(signatureInput.resolveResponseHydrationContext('edge')).toEqual({
      networkIdStr: '11155420',
      sessionSlug: 'edge',
    });
  });
});
