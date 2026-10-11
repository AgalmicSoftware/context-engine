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
    _draftPersistDeferred: false,
    _draftRestorePending: false,
    _draftRestoredQids: new Set<string>(),
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
  persistDraftSafely: jest.fn(),
  propsRef: {
    current: {
      isStandalone: false,
      surveyIndex: 0,
    },
  },
  readQuestionsCache: jest.fn(),
  recalculateEditStats: jest.fn(),
  rehydrateDraftForRenderedIds: jest.fn(),
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

  it('restores a waiting draft over saved answers once a load finishes, never from a superseded load', async () => {
    const callbacks: Array<() => void> = [];
    const context = createContext({
      executeSurveyLocalCacheRehydrate: jest.fn(async ({ callback }) => {
        callbacks.push(callback);
      }),
    });
    const runtime = createSurveyQuestionsResponseStateRuntime(context);

    await runtime.rehydrateSavedAnswersThenDraft();
    expect(context.inst._draftRestorePending).toBe(true);
    // The load is not an edit either, so its own update cannot cancel other hydration.
    context.executeSurveyLocalCacheRehydrate.mock.calls[0][0].setState({});
    expect(context.setResponseHydrationState).toHaveBeenCalledTimes(1);
    expect(context.setState).not.toHaveBeenCalled();
    // A readiness change starts a newer load before the first one finishes.
    await runtime.rehydrateLocalCacheAnswersForRenderedIds();
    callbacks[0]();
    expect(context.rehydrateDraftForRenderedIds).not.toHaveBeenCalled();
    expect(context.inst._draftRestorePending).toBe(true);

    context.inst._draftPersistDeferred = true;
    callbacks[1]();
    expect(context.rehydrateDraftForRenderedIds).toHaveBeenCalledWith({
      forceOverwrite: true,
      responseHydrationOwned: true,
      questionIds: ['q1'],
    });
    expect(context.inst._draftRestorePending).toBe(false);
    // An edit skipped while the draft waited is saved now.
    expect(context.persistDraftSafely).toHaveBeenCalledTimes(1);
    expect(context.inst._draftPersistDeferred).toBe(false);

    // A later question-list change restores only questions that joined it.
    context.getHydrationQuestionIds.mockReturnValue(['q1', 'Q2']);
    await runtime.rehydrateSavedAnswersThenDraft();
    callbacks[2]();
    expect(context.rehydrateDraftForRenderedIds).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionIds: ['q2'] }),
    );
    // A reset form needs every draft again.
    await runtime.rehydrateSavedAnswersThenDraft({ restoreAll: true });
    callbacks[3]();
    expect(context.rehydrateDraftForRenderedIds).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionIds: ['q1', 'q2'] }),
    );
  });

  it('retries questions whose draft a submission error held back', async () => {
    const callbacks: Array<() => void> = [];
    const context = createContext({
      executeSurveyLocalCacheRehydrate: jest.fn(async ({ callback }) => {
        callbacks.push(callback);
      }),
    });
    const state = context.stateRef.current as Record<string, unknown>;
    state.submissionError = 'Upload failed';
    const runtime = createSurveyQuestionsResponseStateRuntime(context);

    await runtime.rehydrateSavedAnswersThenDraft();
    callbacks[0]();
    expect(context.inst._draftRestorePending).toBe(false);
    expect(context.inst._draftRestoredQids.has('q1')).toBe(false);

    state.submissionError = '';
    await runtime.rehydrateSavedAnswersThenDraft();
    callbacks[1]();
    expect(context.rehydrateDraftForRenderedIds).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionIds: ['q1'] }),
    );
    expect(context.inst._draftRestoredQids.has('q1')).toBe(true);
  });
});
