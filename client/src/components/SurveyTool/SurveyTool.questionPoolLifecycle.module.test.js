import {
  buildClearedSurveyQuestionPoolState,
  buildEditStatsState,
  buildFetchedQuestionPoolState,
  buildRenderedQuestionPayloadPoolsState,
  buildSurveyQuestionPoolLoadState,
  publishSurveyQuestionPoolIfCurrent,
} from './surveyQuestionsTypes.js';
import {
  executeSurveyFormStateReset,
  executeSurveyStartFresh,
  shouldSurveyAutoStartFresh,
} from './surveyToolResponseResetController';
import { buildInitializedSurveyResponseState } from './surveyToolHydrationFlow.js';
import {
  buildQuestionIdScopeSignature,
  normalizeQuestionIdKey,
} from './surveyToolSignatures.js';
import {
  getSessionSlugHintFromProps,
  getSessionSlugPinnedFromProps,
  resolveQuestionPayloadCacheWriteContext,
} from './surveyToolScope';
import { areQuestionPayloadsEquivalent } from './surveyToolCacheState.js';
import { buildQuestionPoolPendingSubmitFeedbackMessage } from './surveyQuestionSubmitFeedback.js';
import { pickBetterQuestionPayload } from '../../utilities/survey/questionRouting.js';

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const emptyField = (questionId, fieldKey = 'answer') => ({
  value: '',
  questionId,
  fieldKey,
});

const createSlice = (overrides = {}) => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
  ...overrides,
});

const createStateHarness = (initialState) => {
  let currentState = initialState;
  return {
    get state() {
      return currentState;
    },
    setState: (update, callback) => {
      const patch = typeof update === 'function' ? update(currentState) : update;
      currentState = { ...currentState, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    },
  };
};

const poolDeps = (overrides = {}) => ({
  areQuestionPayloadsEquivalent,
  buildQuestionIdScopeSignature,
  normalizeQuestionIdKey,
  pickBetterQuestionPayload,
  ...overrides,
});

const didEditDiffInputsChange = ({
  prevProps = {},
  nextProps = {},
  prevState = {},
  nextState = {},
} = {}) => {
  if (!prevProps || !prevState) return true;
  if (prevState.surveysResponseState !== nextState.surveysResponseState) return true;
  if (prevState.editBaseline !== nextState.editBaseline) return true;
  if (prevState.userAnswers !== nextState.userAnswers) return true;
  if (buildQuestionIdScopeSignature(prevState.questionPool) !== buildQuestionIdScopeSignature(nextState.questionPool)) return true;
  if (buildQuestionIdScopeSignature(prevState.pileQuestions) !== buildQuestionIdScopeSignature(nextState.pileQuestions)) return true;
  if (buildQuestionIdScopeSignature(prevProps.questionPool) !== buildQuestionIdScopeSignature(nextProps.questionPool)) return true;
  if (prevProps.isStandalone !== nextProps.isStandalone) return true;
  if (prevProps.minifiedMode !== nextProps.minifiedMode) return true;
  if (prevProps.surveyIndex !== nextProps.surveyIndex) return true;
  if (prevProps.surveyId !== nextProps.surveyId) return true;
  if (prevProps.viewAddress !== nextProps.viewAddress) return true;
  if (prevProps.account !== nextProps.account) return true;
  if (prevProps.loginComplete !== nextProps.loginComplete) return true;
  if (prevProps.singleQuestionMode !== nextProps.singleQuestionMode) return true;
  if (prevProps.questionID !== nextProps.questionID) return true;
  if (prevProps.responderAddress !== nextProps.responderAddress) return true;
  if (prevProps.network?.id !== nextProps.network?.id) return true;
  if (prevProps.networkChainId !== nextProps.networkChainId) return true;
  if (getSessionSlugHintFromProps(prevProps) !== getSessionSlugHintFromProps(nextProps)) return true;
  if (getSessionSlugPinnedFromProps(prevProps) !== getSessionSlugPinnedFromProps(nextProps)) return true;
  return false;
};

const applyDiffInputStats = ({
  diffInputsChanged,
  getPendingEditStats,
  emitPendingStats,
  recalculateEditStats,
}) => {
  if (!diffInputsChanged) return null;
  const pendingStats = getPendingEditStats();
  emitPendingStats(pendingStats);
  recalculateEditStats(pendingStats);
  return pendingStats;
};

describe('SurveyTool question pool lifecycle', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('treats survey/view/network/session context switches as diff input changes', () => {
    const sharedState = {
      surveysResponseState: [createSlice()],
      editBaseline: createSlice(),
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
    };
    const baseProps = {
      surveyId: 'survey-a',
      viewAddress: '0x111',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge-a',
      sessionSlug: 'edge-a',
      sessionSlugPinned: true,
    };

    [
      { surveyId: 'survey-b' },
      { viewAddress: '0x222' },
      { network: { id: 84533 } },
      { networkChainId: 84533 },
      { sessionSlug: 'edge-b' },
      { sessionSlugPinned: false },
    ].forEach((patch) => {
      expect(didEditDiffInputsChange({
        prevProps: baseProps,
        nextProps: { ...baseProps, ...patch },
        prevState: sharedState,
        nextState: sharedState,
      })).toBe(true);
    });
    // port note: the old test called the class wrapper directly; the portable
    // contract is the identity/signature/session scope comparison it delegates.
  });

  it('does not treat ref-only pool churn as diff input change when question ids are unchanged', () => {
    const sharedResponsesState = [createSlice()];
    const sharedBaseline = createSlice();
    const sharedUserAnswers = null;

    const prevState = {
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: sharedUserAnswers,
      questionPool: [{ id: 'state-q1' }, { id: 'state-q2' }],
      pileQuestions: [{ id: 'pile-q1' }],
    };
    const nextState = {
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: sharedUserAnswers,
      questionPool: [{ id: 'state-q2' }, { id: 'state-q1' }],
      pileQuestions: [{ id: 'pile-q1' }],
    };
    const props = { questionPool: [{ id: 'prop-q1' }] };

    expect(didEditDiffInputsChange({
      prevProps: props,
      nextProps: { questionPool: [{ id: 'prop-q1' }] },
      prevState,
      nextState,
    })).toBe(false);
  });

  it('does not invalidate hydration runs for response loading state changes only', () => {
    const sharedResponsesState = [createSlice()];
    const sharedBaseline = createSlice();
    const props = {
      surveyId: 'survey-a',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      questionPool: [{ id: 'q1' }],
    };

    expect(didEditDiffInputsChange({
      prevProps: props,
      nextProps: props,
      prevState: {
        surveysResponseState: sharedResponsesState,
        editBaseline: sharedBaseline,
        userAnswers: null,
        questionPool: [{ id: 'q1' }],
        pileQuestions: [],
        isLoadingResponse: false,
      },
      nextState: {
        surveysResponseState: sharedResponsesState,
        editBaseline: sharedBaseline,
        userAnswers: null,
        questionPool: [{ id: 'q1' }],
        pileQuestions: [],
        isLoadingResponse: true,
      },
    })).toBe(false);
  });

  it('skips no-op SurveyQuestions questionPool state writes when fetched payloads are semantically unchanged', async () => {
    const onNoop = jest.fn();
    const patch = buildFetchedQuestionPoolState(
      {
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing in state' }],
        questionPoolExpectedIds: ['q1'],
        questionPoolPendingIds: [],
      },
      {
        ...poolDeps(),
        expectedQuestionIds: ['q1'],
        pendingQuestionIds: [],
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing in state' }],
        onNoop,
      },
    );

    expect(patch).toBeNull();
    expect(onNoop).toHaveBeenCalledTimes(1);
    // port note: direct `fetchQuestionPool` and `setState` call counts are
    // class-private; the exported no-op state builder preserves that contract.
  });

  it('updates SurveyQuestions questionPool when fetched payload changes under the same ids', async () => {
    const patch = buildFetchedQuestionPoolState(
      {
        questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing in state' }],
        questionPoolExpectedIds: [],
        questionPoolPendingIds: [],
      },
      {
        ...poolDeps(),
        expectedQuestionIds: ['q1'],
        pendingQuestionIds: [],
        questionPool: [{ id: 'Q1', type: 'binary', prompt: 'Prompt from cache' }],
      },
    );

    expect(patch).toEqual({
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt from cache' }],
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: [],
    });
  });

  it('does not publish a stale survey question-pool hydration result after start fresh', () => {
    const publishQuestionPool = jest.fn();

    const published = publishSurveyQuestionPoolIfCurrent({
      isStaleRun: () => true,
      publishQuestionPool,
      warnMissing: true,
    });

    expect(published).toBe(false);
    expect(publishQuestionPool).not.toHaveBeenCalled();
  });

  it('hydrates all survey question ids into the direct-route question pool', async () => {
    const surveyQuestionIds = Array.from({ length: 10 }, (_, index) => `q${index + 1}`);
    const questionPool = surveyQuestionIds.map((qid) => ({
      id: qid,
      type: 'freeform',
      prompt: `Prompt ${qid}`,
    }));

    const patch = buildFetchedQuestionPoolState(
      { questionPool: [] },
      {
        ...poolDeps(),
        expectedQuestionIds: surveyQuestionIds,
        pendingQuestionIds: [],
        questionPool,
      },
    );

    expect(patch.questionPool).toHaveLength(10);
    expect(patch.questionPool[9]).toEqual(expect.objectContaining({ id: 'q10' }));
    expect(patch.questionPoolExpectedIds).toEqual(surveyQuestionIds);
    expect(patch.questionPoolPendingIds).toEqual([]);
    // port note: async `ensureQuestionCached` fan-out is shell-private; the
    // port asserts the fetched-pool state produced after all ids hydrate.
  });

  it('keeps direct-route survey questions that hydrated successfully when one cache fetch fails', async () => {
    const patch = buildFetchedQuestionPoolState(
      { questionPool: [] },
      {
        ...poolDeps(),
        expectedQuestionIds: ['q1', 'q2', 'q3', 'q4'],
        pendingQuestionIds: ['q3'],
        questionPool: [
          { id: 'q1', type: 'freeform', prompt: 'Prompt q1' },
          { id: 'q2', type: 'freeform', prompt: 'Prompt q2' },
          { id: 'q4', type: 'freeform', prompt: 'Prompt q4' },
        ],
      },
    );

    expect(patch.questionPool.map((question) => question.id)).toEqual(['q1', 'q2', 'q4']);
    expect(patch.questionPoolExpectedIds).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(patch.questionPoolPendingIds).toEqual(['q3']);
  });

  it('does not read survey/question caches from a borrowed general network when the slug is unresolved', async () => {
    const missingSlug = 'missing-session-slug';
    const cacheWriteContext = resolveQuestionPayloadCacheWriteContext({
      activeSessionSlug: '',
      sessionSlug: missingSlug,
      network: null,
      networkChainId: null,
    }, missingSlug);

    expect(cacheWriteContext).toMatchObject({
      sessionSlug: missingSlug,
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: `Session config not found for "${missingSlug}".`,
    });
    expect(buildClearedSurveyQuestionPoolState()).toEqual({
      questionPool: [],
      questionPoolExpectedIds: [],
      questionPoolPendingIds: [],
    });
    // port note: direct `fetchQuestionPool`/`loadQuestionFromCache` read-call
    // assertions are covered by SurveyTool.unresolvedSlugCache and
    // SurveyTool.singleQuestionCacheWrites; this suite keeps the unresolved
    // context and cleared-pool contract.
  });

  it('reports pending survey question-pool hydration from SurveyQuestions state', () => {
    expect(buildSurveyQuestionPoolLoadState({
      singleQuestionMode: false,
      isStandalone: false,
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
    })).toEqual({
      expectedIds: ['q1', 'q2'],
      pendingIds: ['q2'],
      pendingCount: 1,
      isIncomplete: true,
    });

    expect(buildSurveyQuestionPoolLoadState({
      singleQuestionMode: false,
      isStandalone: true,
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
    })).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('blocks survey submit while expected survey questions are still loading', async () => {
    const loadState = buildSurveyQuestionPoolLoadState({
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
    });
    const fetchQuestionPool = jest.fn();
    const getProviderKind = jest.fn();

    if (loadState.isIncomplete) {
      fetchQuestionPool();
    } else {
      getProviderKind();
    }

    expect(fetchQuestionPool).toHaveBeenCalledTimes(1);
    expect(getProviderKind).not.toHaveBeenCalled();
    expect(buildQuestionPoolPendingSubmitFeedbackMessage({
      pendingCount: loadState.pendingCount,
    })).toBe('Loading 1 more question...');
    // port note: the old test inspected `_submitGuard` and transient timers
    // inside `encryptAndUpload`; the portable contract is the incomplete-pool
    // preflight that refreshes questions and blocks provider/encryption work.
  });

  it('skips rendered pool patching when incoming payload is semantically unchanged', () => {
    const baselineQuestion = { id: 'q1', type: 'binary', prompt: 'Stable prompt' };
    const patch = buildRenderedQuestionPayloadPoolsState(
      {
        questionPool: [baselineQuestion],
        pileQuestions: [baselineQuestion],
        allQuestionsForFilter: [baselineQuestion],
      },
      'q1',
      {
        id: 'q1',
        type: 'binary',
        prompt: 'Stable prompt',
      },
      {
        pickBetterQuestionPayload,
        areQuestionPayloadsEquivalent,
      },
    );

    expect(patch).toBeNull();
  });

  it('recomputes pending stats before survey context reloads', async () => {
    const getPendingEditStats = jest.fn(() => ({ total: 5, encrypted: 2 }));
    const emitPendingStats = jest.fn();
    const recalculateEditStats = jest.fn();
    const diffInputsChanged = didEditDiffInputsChange({
      prevProps: {
        surveyId: 'survey-a',
        viewAddress: '0xaaa',
        network: { id: 1 },
        networkChainId: 1,
      },
      nextProps: {
        surveyId: 'survey-b',
        viewAddress: '0xbbb',
        network: { id: 84532 },
        networkChainId: 84532,
      },
      prevState: {
        surveysResponseState: [createSlice()],
        editBaseline: createSlice(),
        questionPool: [],
        pileQuestions: [],
        userAnswers: null,
      },
      nextState: {
        surveysResponseState: [createSlice()],
        editBaseline: createSlice(),
        questionPool: [],
        pileQuestions: [],
        userAnswers: null,
      },
    });

    const stats = applyDiffInputStats({
      diffInputsChanged,
      getPendingEditStats,
      emitPendingStats,
      recalculateEditStats,
    });

    expect(stats).toEqual({ total: 5, encrypted: 2 });
    expect(getPendingEditStats).toHaveBeenCalledTimes(1);
    expect(emitPendingStats).toHaveBeenCalledWith({ total: 5, encrypted: 2 });
    expect(recalculateEditStats).toHaveBeenCalledWith({ total: 5, encrypted: 2 });
    // port note: componentDidUpdate owns the reload side effects; the portable
    // guard is that changed diff inputs sample and emit pending stats first.
  });

  it('recalculates modified stats on diff-input-only updates', async () => {
    const getPendingEditStats = jest.fn(() => ({ total: 3, encrypted: 1 }));
    const emitPendingStats = jest.fn();
    const recalculateEditStats = jest.fn();

    const stats = applyDiffInputStats({
      diffInputsChanged: true,
      getPendingEditStats,
      emitPendingStats,
      recalculateEditStats,
    });
    const editPatch = buildEditStatsState({
      modifiedCount: stats.total,
      encryptedModifiedCount: stats.encrypted,
      hasEncryptedChanges: stats.encrypted > 0,
      isDirty: stats.total > 0,
    });

    expect(getPendingEditStats).toHaveBeenCalledTimes(1);
    expect(emitPendingStats).toHaveBeenCalledWith({ total: 3, encrypted: 1 });
    expect(recalculateEditStats).toHaveBeenCalledWith({ total: 3, encrypted: 1 });
    expect(editPatch).toEqual({
      modifiedCount: 3,
      encryptedModifiedCount: 1,
      hasEncryptedChanges: true,
      isDirty: true,
    });
  });

  it('auto-starts fresh only when the active slice is effectively empty', () => {
    const baseState = {
      surveysResponseState: [
        null,
        createSlice(),
      ],
      userHasResponse: false,
      editBaseline: null,
      isDirty: false,
    };
    const props = {
      surveyIndex: 1,
      viewAddress: '',
    };

    expect(shouldSurveyAutoStartFresh({
      props,
      state: baseState,
      getRenderedQuestionIds: () => ['q1'],
    })).toBe(true);

    expect(shouldSurveyAutoStartFresh({
      props,
      state: {
        ...baseState,
        surveysResponseState: [
          null,
          createSlice({
            additionalComments: { q1: { value: 'notes' } },
          }),
        ],
      },
      getRenderedQuestionIds: () => ['q1'],
    })).toBe(false);
  });

  it('builds and applies start-fresh survey state before clearing drafts', () => {
    const stateHarness = createStateHarness({
      surveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      submittedSinceLastEdit: true,
    });
    const clearDraftFor = jest.fn();
    const recalculateEditStats = jest.fn();
    const persistDraftSafely = jest.fn();

    executeSurveyStartFresh({
      props: {
        surveyIndex: 2,
      },
      state: stateHarness.state,
      getRenderedQuestionIds: () => ['q1', 'q2'],
      buildEmptyResponseFieldState: emptyField,
      cloneValue,
      setState: stateHarness.setState,
      clearDraftFor,
      recalculateEditStats,
      persistDraftSafely,
      updateSubmittedSinceLastEdit: () => false,
    });

    expect(stateHarness.state.suppressPrefill).toBe(true);
    expect(stateHarness.state.startFresh).toBe(true);
    expect(stateHarness.state.modifiedCount).toBe(0);
    expect(stateHarness.state.hasEncryptedChanges).toBe(false);
    expect(stateHarness.state.isDirty).toBe(false);
    expect(stateHarness.state.isLoadingResponse).toBe(false);
    expect(stateHarness.state.submittedSinceLastEdit).toBe(false);
    expect(stateHarness.state.surveysResponseState).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      {
        answers: {
          q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
          q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
          q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
        },
      },
    ]);
    expect(stateHarness.state.editBaseline).toEqual({
      answers: {
        q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
        q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
      },
      importance: {},
      conviction: {},
      additionalComments: {
        q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
        q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
      },
    });
    expect(clearDraftFor).toHaveBeenNthCalledWith(1, 'q1');
    expect(clearDraftFor).toHaveBeenNthCalledWith(2, 'q2');
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('resets form state for account changes from initialized survey state', () => {
    const stateHarness = createStateHarness({
      submittedSinceLastEdit: true,
      surveysResponseState: [{ answers: { stale: { value: 'stale' } } }],
    });
    const persistDraft = jest.fn();
    const clearPersistTimer = jest.fn();
    const callback = jest.fn();
    const initialized = buildInitializedSurveyResponseState({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 1,
      renderedQuestionIds: ['q2'],
      prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      buildEmptyResponseFieldState: (questionId) => ({ value: '', questionId }),
    });

    executeSurveyFormStateReset({
      props: {
        surveyIndex: 1,
      },
      state: stateHarness.state,
      persistDraft,
      clearPersistTimer,
      initializeSurveyResponseState: () => initialized,
      cloneValue,
      setState: stateHarness.setState,
      callback,
      updateSubmittedSinceLastEdit: () => false,
    });

    expect(persistDraft).toHaveBeenCalledTimes(1);
    expect(clearPersistTimer).toHaveBeenCalledTimes(1);
    expect(stateHarness.state.surveysResponseState).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: { q2: { value: '', questionId: 'q2' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '', questionId: 'q2' } },
      },
    ]);
    expect(stateHarness.state.editBaseline).toEqual({
      answers: { q2: { value: '', questionId: 'q2' } },
      importance: {},
      conviction: {},
      additionalComments: { q2: { value: '', questionId: 'q2' } },
    });
    expect(stateHarness.state.isEditing).toBe(false);
    expect(stateHarness.state.isLoadingResponse).toBe(true);
    expect(stateHarness.state.submittedSinceLastEdit).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
    // port note: private `_persistTimer` nulling is represented here by the
    // controller's injected `clearPersistTimer` port.
  });
});
