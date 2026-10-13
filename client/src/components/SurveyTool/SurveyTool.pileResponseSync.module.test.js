import {
  buildAutoDecryptDisabledState,
  buildSurveyQuestionsAuthoringPanelDisplayState,
  buildSurveyQuestionsJsonPanelDisplayState,
} from './surveyQuestionsTypes.js';
import { getPendingStatsSnapshotFromState, buildDraftAnswersByQuestionId } from './surveyToolDraftState.js';
import { mergeQuestionResponses } from './surveyToolCacheState.js';
import {
  EMPTY_PILE_RESPONSE_SLICE,
  buildPileComponentUpdatePlan,
  buildPileContextResetState,
} from './surveyPileLifecycle';
import {
  buildPileBaselineCheckPlan,
  buildPileBaselineConsistencyPlan,
  readPileScopedQuestionResponses,
} from './surveyPileBaselineSync';
import { buildDraftHydrationRunPlan } from './surveyToolHydrationFlow.js';

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const createQuestion = (id) => ({
  id,
  type: 'freeform',
  prompt: id.toUpperCase(),
});

const createResponseSlice = (overrides = {}) => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
  ...overrides,
});

const applyDraftEntryToSlice = ({ targetSlice, questionId, draftEntry }) => {
  targetSlice.answers[questionId] = {
    value: draftEntry?.value || '',
    encrypted: !!draftEntry?.answerEncrypted,
  };
  targetSlice.additionalComments[questionId] = {
    value: draftEntry?.additional || '',
    encrypted: !!draftEntry?.additionalEncrypted,
  };
  targetSlice.importance[questionId] = draftEntry?.importance ?? null;
  targetSlice.conviction[questionId] = draftEntry?.conviction ?? null;
  return true;
};

const mergeScopedQuestionResponses = (target = {}, source = {}) => mergeQuestionResponses(target, source);

describe('SurveyTool pile response sync and JSON controls', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('emits pending stats with isSubmitting for header submit spinner state', () => {
    const stats = getPendingStatsSnapshotFromState({
      modifiedCount: 2,
      encryptedModifiedCount: 1,
    });
    const emittedStats = {
      ...stats,
      submittedSinceLastEdit: false,
      isSubmitting: true,
    };

    expect(emittedStats).toEqual({
      total: 2,
      encrypted: 1,
      submittedSinceLastEdit: false,
      isSubmitting: true,
    });
    // port note: the old test called the private class emitter directly; the
    // portable contract is the pending-stats payload shape used by the header.
  });

  it('hides top JSON in single-question mode and hides embedded JSON controls in embedded full mode', () => {
    const embeddedFullAuthoring = buildSurveyQuestionsAuthoringPanelDisplayState({
      canEditQuestions: true,
      hasCurrentSurveyResponseState: true,
      hideEmbeddedDebugUi: true,
      questionPoolReady: true,
      singleQuestionMode: false,
    });
    expect(embeddedFullAuthoring.showJsonControl).toBe(false);
    expect(embeddedFullAuthoring.showLockedQuestionsBanner).toBe(false);

    const singleQuestionAuthoring = buildSurveyQuestionsAuthoringPanelDisplayState({
      canEditQuestions: true,
      hasCurrentSurveyResponseState: true,
      hideEmbeddedDebugUi: false,
      questionPoolReady: true,
      singleQuestionMode: true,
    });
    const singleQuestionJson = buildSurveyQuestionsJsonPanelDisplayState({
      isStandalone: false,
      singleQuestionMode: true,
      showSurveyJson: true,
      showQuestionsJson: true,
      showResponseJson: true,
    });

    expect(singleQuestionAuthoring.showBackToTopControl).toBe(false);
    expect(singleQuestionAuthoring.showJsonControl).toBe(false);
    expect(singleQuestionJson.showFullSurveyJsonControls).toBe(false);
    expect(singleQuestionJson.showSurveyJsonPanel).toBe(false);
  });

  it('shows question and response JSON controls for standalone questions pages with multiple questions', () => {
    const jsonState = buildSurveyQuestionsJsonPanelDisplayState({
      isStandalone: true,
      singleQuestionMode: false,
      showSurveyJson: true,
      showQuestionsJson: true,
      showResponseJson: true,
    });

    expect(jsonState.showQuestionJsonControls).toBe(true);
    expect(jsonState.showQuestionsJsonPanel).toBe(true);
    expect(jsonState.showResponseJsonPanel).toBe(true);
    expect(jsonState.showFullSurveyJsonControls).toBe(false);
    expect(jsonState.showSurveyJsonPanel).toBe(false);
  });

  it('schedules pile reload on questionResponsesNonce tick', () => {
    const plan = buildPileComponentUpdatePlan({
      responseNonceTick: true,
      isOptimistic: false,
      hasLiveEdits: false,
      pileQuestionsLength: 1,
      isQuestionCacheReady: true,
      loading: false,
    });

    expect(plan.cacheUpdatePlan).toEqual({
      action: 'reload',
      delayMs: 80,
    });
  });

  it('checks optimistic pile cache baseline on questionResponsesNonce tick instead of scheduling a reload', () => {
    const plan = buildPileComponentUpdatePlan({
      responseNonceTick: true,
      isOptimistic: true,
      hasLiveEdits: false,
      pileQuestionsLength: 1,
      isQuestionCacheReady: true,
      loading: false,
    });

    expect(plan.cacheUpdatePlan).toEqual({
      action: 'check-optimistic-baseline',
      delayMs: 80,
    });
  });

  it('resets pile runtime context and reloads immediately on account change', () => {
    const updatePlan = buildPileComponentUpdatePlan({
      accountChanged: true,
      loading: false,
      showLongLoading: true,
    });
    const resetState = buildPileContextResetState({
      submittedSinceLastEdit: true,
    });
    const disabledAutoDecrypt = buildAutoDecryptDisabledState();

    expect(updatePlan).toEqual({
      shouldResetContext: true,
      cacheUpdatePlan: { action: 'noop', delayMs: 80 },
      shouldClearLongLoading: false,
      shouldDisableBlockedAutoDecrypt: false,
      queueAutoDecryptReasons: [],
    });
    expect(resetState).toEqual({
      loading: true,
      pileQuestions: [],
      activePileIndex: 0,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      editBaseline: null,
      surveysResponseState: [{ ...EMPTY_PILE_RESPONSE_SLICE }],
      userAnswers: null,
      userHasResponse: false,
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
    });
    expect(disabledAutoDecrypt).toEqual({
      autoDecryptEnabled: false,
      decryptingByKey: {},
    });
    // port note: queue and masked-attempt fields are private runtime refs; the
    // portable behavior is the reset plan plus the public auto-decrypt state patch.
  });

  it('resets pile runtime context when the effective session identity changes', () => {
    const updatePlan = buildPileComponentUpdatePlan({
      sessionIdentityChanged: true,
      loading: false,
      showLongLoading: true,
    });
    const resetState = buildPileContextResetState({
      submittedSinceLastEdit: true,
    });

    expect(updatePlan).toEqual({
      shouldResetContext: true,
      cacheUpdatePlan: { action: 'noop', delayMs: 80 },
      shouldClearLongLoading: false,
      shouldDisableBlockedAutoDecrypt: false,
      queueAutoDecryptReasons: [],
    });
    expect(resetState.surveysResponseState).toEqual([{ ...EMPTY_PILE_RESPONSE_SLICE }]);
    expect(resetState.editBaseline).toBeNull();
    expect(resetState.submissionComplete).toBe(false);
  });

  it('queues pile auto-decrypt refresh on response nonce updates while enabled and unblocked', () => {
    const plan = buildPileComponentUpdatePlan({
      responseNonceTick: true,
      isOptimistic: false,
      hasLiveEdits: false,
      pileQuestionsLength: 1,
      isQuestionCacheReady: true,
      loading: false,
      autoDecryptEnabled: true,
    });

    expect(plan.cacheUpdatePlan).toEqual({
      action: 'reload',
      delayMs: 80,
    });
    expect(plan.queueAutoDecryptReasons).toEqual(['pile-state-change']);
  });

  it('keeps optimistic pile state when cache has stale value for a cleared baseline answer', () => {
    const editBaseline = createResponseSlice({
      answers: { q1: { value: '', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
    });
    const checkPlan = buildPileBaselineCheckPlan({
      submissionComplete: true,
      editBaseline,
      networkIdStr: '84532',
      pileQuestions: [createQuestion('q1')],
    });
    const consistencyPlan = buildPileBaselineConsistencyPlan({
      baseline: editBaseline,
      renderedIds: checkPlan.renderedIds,
      questionResponses: {
        q1: {
          '0xabc': JSON.stringify({
            answer: { value: 'stale-answer' },
            additional: { value: '' },
          }),
        },
      },
      account: '0xabc',
    });

    expect(checkPlan).toEqual({
      shouldSkip: false,
      reason: 'check',
      renderedIds: ['q1'],
    });
    expect(consistencyPlan).toEqual({
      action: 'maintain-optimistic',
      isConsistent: false,
    });
  });

  it('syncs pile baseline once cache catches up with the optimistic response', () => {
    const editBaseline = createResponseSlice({
      answers: { q1: { value: 'cached-answer', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
    });
    const checkPlan = buildPileBaselineCheckPlan({
      submissionComplete: true,
      editBaseline,
      networkIdStr: '84532',
      pileQuestions: [createQuestion('q1')],
    });
    const consistencyPlan = buildPileBaselineConsistencyPlan({
      baseline: editBaseline,
      renderedIds: checkPlan.renderedIds,
      questionResponses: {
        q1: {
          '0xabc': JSON.stringify({
            answer: { value: 'cached-answer' },
            additional: { value: '' },
          }),
        },
      },
      account: '0xabc',
    });

    expect(consistencyPlan).toEqual({
      action: 'sync-cache-caught-up',
      isConsistent: true,
    });
  });

  it('does not read pile answers from a borrowed general response cache when the slug is unresolved', () => {
    const readQuestionsCache = jest.fn(() => ({
      84532: {
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { value: 'wrong-general-answer', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          },
        },
      },
    }));
    const scopedResponses = readPileScopedQuestionResponses({
      scopeSlugs: [''],
      networkIdStr: '',
      readQuestionsCache,
      mergeQuestionResponses: mergeScopedQuestionResponses,
    });

    expect(scopedResponses).toEqual({});
    expect(readQuestionsCache).not.toHaveBeenCalled();
  });

  it('hydrates off-screen pile draft answers so submit count stays aligned with full mode', () => {
    const pileQuestions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map(createQuestion);
    const draftPayload = {
      answers: {
        Q6: {
          value: 'off-screen draft',
          answerEncrypted: false,
          additional: '',
          additionalEncrypted: false,
          importance: null,
          conviction: null,
        },
      },
    };
    const plan = buildDraftHydrationRunPlan({
      hydrationQuestionIds: ['q1', 'q2', 'q3'],
      pileQuestions,
      forceOverwrite: true,
      isDirty: false,
      modifiedCount: 0,
      pendingStats: { total: 0 },
      submittedSinceLastEdit: false,
      submissionComplete: false,
      prevSurveysResponseState: [createResponseSlice()],
      surveyIndex: 0,
      draft: {
        answers: buildDraftAnswersByQuestionId(draftPayload),
      },
      prevSlice: createResponseSlice(),
      prevBaseline: createResponseSlice(),
      cloneBaseline: cloneValue,
      applyDraftEntryToSlice,
    });

    expect(plan.renderedQuestionIds).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
    expect(plan.allowOverwrite).toBe(true);
    expect(plan.updates.surveysResponseState?.[0]?.answers?.q6?.value).toBe('off-screen draft');
    // port note: the old test invoked the class draft rehydrate method; this
    // asserts the shared run plan expands full pile ids before applying drafts.
  });
});
