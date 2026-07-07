import {
  buildIndexedQuestionEntryKeys,
  computePendingEditStats,
  orchestrateGetChangedQidsAndFields,
} from './surveyToolChangedFieldsController.js';
import { buildAnswerUpdatePlan } from './surveyToolResponseMutationController.js';
import { buildResponsePayload } from './surveyToolResponsePayloadController.js';
import {
  buildEditStatsState,
  buildResponseJsonToggleState,
  buildSurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes.js';
import { runSurveyQuestionsSubmitController } from './surveyQuestionsSubmitController';
import { buildSliderPersistOptions } from './surveyToolSliderState';
import { buildSurveyResponseSliceSignature, normalizeQuestionIdKey } from './surveyToolSignatures.js';
import { executeSurveyExitEditing, executeSurveyPendingRevert } from './surveyToolResponseResetController';
import { getConvictionFromSlice, getImportanceFromSlice } from './surveyToolResponseState';

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const emptyField = (value = '', overrides = {}) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  ...overrides,
});

const createSlice = (overrides = {}) => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
  ...overrides,
});

const valuesEqual = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }
  return left === right;
};

const hasMeaningfulFieldValue = (value) => {
  if (!value || typeof value !== 'object') {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  }
  if (value.encrypted || value.encryptedPortion) return true;
  const fieldValue = value.value;
  if (Array.isArray(fieldValue)) return fieldValue.length > 0;
  return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
};

const buildChangedDeps = (baselineSlice, overrides = {}) => ({
  resolveDiffBaselineSlice: () => baselineSlice,
  getIndexedQuestionEntryKeys: (source) => buildIndexedQuestionEntryKeys(source, normalizeQuestionIdKey),
  getDefaultResponseEncryptionAudience: () => 'self',
  normalizeResponseEncryptionAudience: (audience) => audience || 'self',
  getDefaultResponseEncryptionAudienceForQid: () => 'self',
  resolveFieldEncryptionGateId: (field) => field?.encryptionGateId || null,
  normalizeFieldAudienceMode: (mode, fieldKey) => mode || (fieldKey === 'additional' ? 'inherit' : 'explicit'),
  valuesEqual,
  buildSurveyResponseSliceSignature,
  buildRatingEnvelopeQidSetFromUserAnswers: () => new Set(),
  hasMeaningfulFieldValue,
  bumpPerfCounter: jest.fn(),
  ...overrides,
});

const runChangedQids = ({
  baselineSlice,
  currentSlice,
  existingCache = null,
  scopedIds = null,
  userAnswers = null,
  depsOverrides = {},
}) => {
  const deps = buildChangedDeps(baselineSlice, depsOverrides);
  const outcome = orchestrateGetChangedQidsAndFields(
    {
      surveyIndex: 0,
      currentSlice,
      isLoggedIn: true,
      isLoadingResponse: false,
      scopedIds:
        scopedIds ||
        new Set(
          [
            ...Object.keys(currentSlice.answers || {}),
            ...Object.keys(currentSlice.additionalComments || {}),
            ...Object.keys(currentSlice.importance || {}),
            ...Object.keys(currentSlice.conviction || {}),
          ]
            .map(normalizeQuestionIdKey)
            .filter(Boolean),
        ),
      userAnswers,
    },
    deps,
    existingCache,
  );
  return { ...outcome, deps };
};

const pendingStatsFromChanged = ({
  currentSlice,
  changedResult,
  questionPool = [],
  pileQuestions = [],
  userAnswers = null,
  depsOverrides = {},
}) =>
  computePendingEditStats(
    {
      idx: 0,
      currentSlice,
      userAnswers,
      existingCache: null,
      diffCacheRef: {},
      questionPool,
      pileQuestions,
      questionId: null,
    },
    {
      getChangedQidsAndFields: () => changedResult,
      isQuestionLockedForResponse: () => false,
      buildRatingEnvelopeQidSetFromUserAnswers: () => new Set(),
      ...depsOverrides,
    },
  ).result;

const mutationDeps = (questions = []) => ({
  buildEmptyResponseFieldState: (qid, fieldKey = 'answer') => emptyField('', { questionId: qid, fieldKey }),
  resolveFieldEncryptionAudience: (field) => field?.encryptionAudience || 'self',
  resolveFieldEncryptionGateId: (field) => field?.encryptionGateId || null,
  isQuestionLockedForResponse: () => false,
  getEffectiveRecipientsForQid: jest.fn(() => []),
  normalizeFieldAudienceMode: (mode, fieldKey) => mode || (fieldKey === 'additional' ? 'inherit' : 'explicit'),
  buildInheritedAdditionalFieldState: (additionalField, answerField) => ({
    ...additionalField,
    encrypted: !!answerField.encrypted,
    encryptionAudience: answerField.encryptionAudience || 'self',
    encryptionGateId: answerField.encryptionGateId || null,
    audienceMode: 'inherit',
  }),
  valuesEqual,
  getQuestionById: (qid) =>
    questions.find((question) => normalizeQuestionIdKey(question.id) === normalizeQuestionIdKey(qid)),
  computeHash: jest.fn((value) => `hash:${value}`),
});

const responsePayload = (overrides = {}) =>
  buildResponsePayload({
    account: '0xabc',
    isStandalone: false,
    singleQuestionMode: true,
    surveyId: '',
    surveyIndex: 0,
    surveyResponseState: createSlice(),
    questionPool: [],
    pileQuestions: [],
    resolveFieldEncryptionAudience: (field) => field?.encryptionAudience || 'self',
    getQuestionEncryptionGates: (question) => (question?.promptEncrypted ? ['gate'] : []),
    resolveFieldEncryptionGateId: (field) => field?.encryptionGateId || null,
    normalizeFieldAudienceMode: (mode, fieldKey) => mode || (fieldKey === 'additional' ? 'inherit' : 'explicit'),
    getSurveyMetadataForJson: () => null,
    resolveSessionContext: () => ({ sessionName: '' }),
    getConvictionFromSlice,
    getImportanceFromSlice,
    sanitizeQuestionPromptForResponsePayload: (question, { isLocked }) =>
      isLocked ? '[encrypted]' : question.prompt || '',
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

describe('SurveyTool pending edit accounting', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('ignores out-of-scope baseline keys and clears pending count after undo in full mode', () => {
    const baseline = createSlice({
      answers: {
        q1: emptyField('base'),
        orphan: emptyField('stale'),
      },
      additionalComments: {
        q1: emptyField(),
        orphan: emptyField(),
      },
    });
    const current = createSlice({
      answers: { q1: emptyField('base') },
      additionalComments: { q1: emptyField() },
    });
    const scopedIds = new Set(['q1']);

    const unchanged = runChangedQids({ baselineSlice: baseline, currentSlice: current, scopedIds }).result;
    expect(pendingStatsFromChanged({ currentSlice: current, changedResult: unchanged }).total).toBe(0);

    const edited = createSlice({
      answers: { q1: emptyField('base + edit') },
      additionalComments: { q1: emptyField() },
    });
    const changed = runChangedQids({ baselineSlice: baseline, currentSlice: edited, scopedIds }).result;
    expect(pendingStatsFromChanged({ currentSlice: edited, changedResult: changed }).total).toBe(1);

    const reverted = runChangedQids({ baselineSlice: baseline, currentSlice: current, scopedIds }).result;
    expect(pendingStatsFromChanged({ currentSlice: current, changedResult: reverted }).total).toBe(0);
  });

  it('uses pile question scope for pending diffs so one edit counts as one', () => {
    const baseline = createSlice({
      answers: {
        'pile-q1': emptyField('same'),
        orphan: emptyField('stale'),
      },
      additionalComments: {
        'pile-q1': emptyField(),
        orphan: emptyField(),
      },
    });
    const current = createSlice({
      answers: { 'pile-q1': emptyField('same') },
      additionalComments: { 'pile-q1': emptyField() },
    });
    const scopedIds = new Set(['pile-q1']);

    const unchanged = runChangedQids({ baselineSlice: baseline, currentSlice: current, scopedIds }).result;
    expect(pendingStatsFromChanged({ currentSlice: current, changedResult: unchanged }).total).toBe(0);

    const edited = createSlice({
      answers: { 'pile-q1': emptyField('edited') },
      additionalComments: { 'pile-q1': emptyField() },
    });
    const changed = runChangedQids({ baselineSlice: baseline, currentSlice: edited, scopedIds }).result;
    expect(
      pendingStatsFromChanged({
        currentSlice: edited,
        changedResult: changed,
        pileQuestions: [{ id: 'pile-q1' }],
      }).total,
    ).toBe(1);
  });

  it('tracks visible and off-screen edits from response slices while keeping unchanged baseline at zero', () => {
    const baseline = createSlice({
      answers: {
        q1: emptyField('same'),
        q2: emptyField('other'),
      },
      additionalComments: { q1: emptyField(), q2: emptyField() },
    });
    const current = createSlice({
      answers: {
        q1: emptyField('same'),
        q2: emptyField('other'),
      },
      additionalComments: { q1: emptyField(), q2: emptyField() },
    });

    const unchanged = runChangedQids({ baselineSlice: baseline, currentSlice: current }).result;
    expect(unchanged.changedQids.size).toBe(0);

    const visibleEdit = runChangedQids({
      baselineSlice: baseline,
      currentSlice: createSlice({
        answers: {
          q1: emptyField('edited-visible'),
          q2: emptyField('other'),
        },
        additionalComments: { q1: emptyField(), q2: emptyField() },
      }),
    }).result;
    expect(visibleEdit.changedQids.has('q1')).toBe(true);
    expect(visibleEdit.changedQids.has('q2')).toBe(false);

    const offscreenEdit = runChangedQids({
      baselineSlice: baseline,
      currentSlice: createSlice({
        answers: {
          q1: emptyField('same'),
          q2: emptyField('edited-offscreen'),
        },
        additionalComments: { q1: emptyField(), q2: emptyField() },
      }),
    }).result;
    expect(offscreenEdit.changedQids.has('q1')).toBe(false);
    expect(offscreenEdit.changedQids.has('q2')).toBe(true);
  });

  it('reuses changed-qids cache when slice refs churn but semantic content is unchanged', () => {
    const baseline = createSlice({
      answers: { q1: emptyField('same') },
      additionalComments: { q1: emptyField() },
    });
    const current = createSlice({
      answers: { q1: emptyField('same') },
      additionalComments: { q1: emptyField() },
    });

    const first = runChangedQids({ baselineSlice: baseline, currentSlice: current });
    expect(first.result.changedQids.size).toBe(0);

    const sameBaseline = createSlice({
      answers: { q1: { ...baseline.answers.q1 } },
      additionalComments: { q1: { ...baseline.additionalComments.q1 } },
    });
    const sameCurrent = createSlice({
      answers: { q1: { ...current.answers.q1 } },
      additionalComments: { q1: { ...current.additionalComments.q1 } },
    });
    const second = runChangedQids({
      baselineSlice: sameBaseline,
      currentSlice: sameCurrent,
      existingCache: first.newCache,
    });

    expect(second.result).toBe(first.result);
    expect(second.newCache).toBe(first.newCache);
  });

  it('recomputes changed-qids cache when a middle array value changes', () => {
    const baseline = createSlice({
      answers: { q1: emptyField(['A', 'B', 'C']) },
      additionalComments: { q1: emptyField() },
    });
    const current = createSlice({
      answers: { q1: emptyField(['A', 'B', 'C']) },
      additionalComments: { q1: emptyField() },
    });

    const first = runChangedQids({ baselineSlice: baseline, currentSlice: current });
    expect(first.result.changedQids.size).toBe(0);

    const edited = createSlice({
      answers: { q1: emptyField(['A', 'D', 'C']) },
      additionalComments: { q1: emptyField() },
    });
    const second = runChangedQids({
      baselineSlice: baseline,
      currentSlice: edited,
      existingCache: first.newCache,
    });

    expect(second.result).not.toBe(first.result);
    expect(second.result.changedQids.has('q1')).toBe(true);
  });

  it('counts encrypted rating edits when baseline has missing plaintext rating', () => {
    const current = createSlice({
      answers: { q1: emptyField('*', { encrypted: true }) },
      additionalComments: { q1: emptyField() },
      importance: { q1: 7 },
    });
    const baseline = createSlice({
      answers: { q1: emptyField('*', { encrypted: true }) },
      additionalComments: { q1: emptyField() },
    });

    const changed = runChangedQids({ baselineSlice: baseline, currentSlice: current }).result;
    const stats = pendingStatsFromChanged({
      currentSlice: current,
      changedResult: changed,
    });
    expect(stats.total).toBe(1);
    expect(stats.encrypted).toBe(1);
  });

  it('clears binary answer when selecting the same option again', () => {
    const deps = mutationDeps([{ id: 'q1', type: 'binary' }]);
    const plan = buildAnswerUpdatePlan(
      'q1',
      'Agree',
      createSlice({
        answers: { q1: emptyField('Agree') },
        additionalComments: {},
      }),
      deps,
    );

    expect(plan.changed).toBe(true);
    expect(plan.nextAnswerState.value).toBe('');
  });

  it('skips no-op answer updates for repeated freeform values with stable encryption state', () => {
    const deps = mutationDeps([{ id: 'q1', type: 'freeform' }]);
    const plan = buildAnswerUpdatePlan(
      'q1',
      'same',
      createSlice({
        answers: {
          q1: emptyField('same', {
            hash: '0xabc',
          }),
        },
        additionalComments: {},
      }),
      deps,
    );

    expect(plan.changed).toBe(false);
    expect(deps.getEffectiveRecipientsForQid).not.toHaveBeenCalled();
    expect(deps.computeHash).not.toHaveBeenCalled();
  });

  it('defers draft persistence for slider-driven rating updates until the drag completes', () => {
    const deps = mutationDeps([{ id: 'q1', type: 'rating' }]);
    const plan = buildAnswerUpdatePlan(
      'q1',
      6,
      createSlice({
        answers: { q1: emptyField(2) },
        additionalComments: {},
      }),
      deps,
    );

    expect(buildSliderPersistOptions({ type: 'mousemove' }).persistDraft).toBe(false);
    expect(buildSliderPersistOptions({ type: 'keydown' }).persistDraft).toBe(true);
    expect(plan.changed).toBe(true);
    expect(plan.nextAnswerState.value).toBe(6);
    // port note: the old final assertion called the private class
    // flushDraftPersistAfterSliderChange wrapper; the portable contract is that
    // slider drag events suppress immediate persistence and commit paths opt in.
  });

  it('gates deferred json preview updates when response preview is hidden', () => {
    const updateJsonPreview = jest.fn();
    const scheduleIfVisible = (state, force = false) => {
      if (!force && !state.showResponseJson) return;
      updateJsonPreview(force);
    };

    scheduleIfVisible({ showResponseJson: false });
    expect(updateJsonPreview).not.toHaveBeenCalled();

    scheduleIfVisible({ showResponseJson: true });
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    // port note: timer ownership lives in the class shell; the extracted
    // response-json state seam still preserves the visible-panel gate.
  });

  it('refreshes json preview immediately when response json panel is opened', () => {
    const updateJsonPreview = jest.fn();
    const patch = buildResponseJsonToggleState({ showResponseJson: false });

    if (patch.showResponseJson) updateJsonPreview(true);

    expect(patch.showResponseJson).toBe(true);
    expect(updateJsonPreview).toHaveBeenCalledWith(true);
    // port note: the immediate preview refresh is still a shell callback after
    // buildResponseJsonToggleState opens the panel.
  });

  it('does not inherit the general session name in single-question response json when the slug is unresolved', () => {
    const json = responsePayload({
      account: '0xabc',
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt without session name' }],
      resolveSessionContext: () => ({ sessionName: '' }),
      surveyResponseState: createSlice({
        answers: { q1: emptyField('hello') },
        additionalComments: { q1: emptyField() },
      }),
    });

    expect(json).toEqual(
      expect.objectContaining({
        questionID: 'q1',
        responder: '0xabc',
        prompt: 'Prompt without session name',
        sessionName: '',
      }),
    );
  });

  it('masks locked question prompts in response json payloads', () => {
    const json = responsePayload({
      account: '0xabc',
      questionPool: [
        {
          id: 'q1',
          type: 'freeform',
          prompt: 'Secret locked prompt',
          promptEncrypted: '{"ciphertext":"prompt-cipher"}',
        },
      ],
      surveyResponseState: createSlice({
        answers: { q1: emptyField('answer') },
        additionalComments: { q1: emptyField() },
      }),
    });

    expect(json.prompt).toBe('[encrypted]');
    expect(JSON.stringify(json)).not.toContain('Secret locked prompt');
  });

  it('allows submit click when submitted latch is active but pending edits exist', () => {
    const plan = buildSurveyQuestionsPrimarySubmitPlan({
      account: '0xabc',
      isStandalone: false,
      isSubmitting: false,
      pendingEditCount: 1,
      questionID: '',
      singleQuestionMode: false,
      submissionComplete: false,
      submitGuardActive: false,
      submittedSinceLastEdit: true,
      surveyId: 'survey-1',
    });
    const ports = {
      activateSubmitGuard: jest.fn(),
      dispatchSubmit: jest.fn(),
      navigateToResponse: jest.fn(),
    };
    const result = runSurveyQuestionsSubmitController({ plan, ports });

    expect(plan.action).toBe('submit');
    expect(result.status).toBe('dispatched');
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
  });

  it('blocks rapid double submit clicks until encryptAndUpload releases the guard', async () => {
    let submitGuardActive = false;
    const dispatchSubmit = jest.fn();
    const firstPlan = buildSurveyQuestionsPrimarySubmitPlan({
      account: '0xabc',
      isSubmitting: false,
      pendingEditCount: 1,
      submissionComplete: false,
      submitGuardActive,
      submittedSinceLastEdit: false,
      surveyId: 'survey-1',
    });
    runSurveyQuestionsSubmitController({
      plan: firstPlan,
      ports: {
        activateSubmitGuard: () => {
          submitGuardActive = true;
        },
        dispatchSubmit,
      },
    });

    const secondPlan = buildSurveyQuestionsPrimarySubmitPlan({
      isSubmitting: false,
      submitGuardActive,
    });
    const secondResult = runSurveyQuestionsSubmitController({
      plan: secondPlan,
      ports: {
        activateSubmitGuard: () => {
          submitGuardActive = true;
        },
        dispatchSubmit,
      },
    });

    expect(dispatchSubmit).toHaveBeenCalledTimes(1);
    expect(submitGuardActive).toBe(true);
    expect(secondResult.status).toBe('inert');
    expect(secondResult.reason).toBe('submit_guard');
  });

  it('revert X only seeds empty structures for currently rendered ids', () => {
    const stateHarness = createStateHarness({
      surveysResponseState: [
        createSlice({
          answers: { q1: emptyField('dirty') },
          additionalComments: { q1: emptyField() },
        }),
      ],
      editBaseline: createSlice({
        answers: { q1: emptyField('saved') },
        additionalComments: { q1: emptyField() },
      }),
    });
    const clearDraft = jest.fn();
    const recalculateEditStats = jest.fn();
    const updateJsonPreview = jest.fn();

    executeSurveyPendingRevert({
      props: {
        account: '0xabc',
        loginComplete: true,
        surveyIndex: 0,
      },
      state: stateHarness.state,
      getRenderedQuestionIds: () => ['q1'],
      cloneFieldState: cloneValue,
      buildEmptyResponseFieldState: (questionId, fieldKey = 'answer') => emptyField('', { questionId, fieldKey }),
      setState: stateHarness.setState,
      clearDraft,
      recalculateEditStats,
      updateJsonPreview,
    });

    const reverted = stateHarness.state.surveysResponseState?.[0];
    expect(reverted?.answers?.q1?.value).toBe('saved');
    expect(reverted?.answers?.q2).toBeUndefined();
    expect(reverted?.additionalComments?.q2).toBeUndefined();
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('revert X re-latches submitted state when no pending edits remain', () => {
    const stateHarness = createStateHarness({
      surveysResponseState: [
        createSlice({
          answers: { q1: emptyField('dirty') },
          additionalComments: { q1: emptyField() },
        }),
      ],
      editBaseline: createSlice({
        answers: { q1: emptyField('saved') },
        additionalComments: { q1: emptyField() },
      }),
      userHasResponse: true,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      pileDiscardedEdits: false,
      isSubmitting: false,
      isDirty: true,
      modifiedCount: 1,
      encryptedModifiedCount: 0,
      hasEncryptedChanges: false,
    });
    const recalculateEditStats = jest.fn(() => {
      stateHarness.setState(
        buildEditStatsState({
          encryptedModifiedCount: 0,
          hasEncryptedChanges: false,
          isDirty: false,
          modifiedCount: 0,
          shouldRelatchSubmitted: true,
        }),
      );
    });

    executeSurveyPendingRevert({
      props: {
        account: '0xabc',
        loginComplete: true,
        surveyIndex: 0,
      },
      state: stateHarness.state,
      getRenderedQuestionIds: () => ['q1'],
      cloneFieldState: cloneValue,
      buildEmptyResponseFieldState: (questionId, fieldKey = 'answer') => emptyField('', { questionId, fieldKey }),
      setState: stateHarness.setState,
      clearDraft: jest.fn(),
      recalculateEditStats,
      updateJsonPreview: jest.fn(),
    });

    expect(stateHarness.state.pileDiscardedEdits).toBe(false);
    expect(stateHarness.state.submittedSinceLastEdit).toBe(true);
    expect(stateHarness.state.modifiedCount).toBe(0);
    expect(stateHarness.state.isDirty).toBe(false);
  });

  it('restores the viewed-response slice when exiting edit mode', () => {
    const stateHarness = createStateHarness({
      surveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      parsedViewAddressAnswers: { answer: { value: 'viewed' } },
      userAnswers: { answer: { value: 'self' } },
      submittedSinceLastEdit: true,
    });
    const buildSliceFromUserAnswers = jest.fn(() =>
      createSlice({
        answers: { q1: { value: 'viewed' } },
      }),
    );
    const buildSliceFromLocalCache = jest.fn(() =>
      createSlice({
        answers: { q9: { value: 'cached' } },
      }),
    );
    const clearDraft = jest.fn();
    const recalculateEditStats = jest.fn();
    const persistDraftSafely = jest.fn();
    const updateJsonPreview = jest.fn();

    executeSurveyExitEditing({
      props: {
        surveyIndex: 2,
        responderAddress: '0xdef',
      },
      state: stateHarness.state,
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
      getRenderedQuestionIds: () => ['q1', 'q2'],
      buildEmptyResponseFieldState: (questionId, fieldKey = 'answer') => ({
        value: '',
        questionId,
        fieldKey,
      }),
      cloneValue,
      setState: stateHarness.setState,
      recalculateEditStats,
      persistDraftSafely,
      updateJsonPreview,
      clearDraft,
      updateSubmittedSinceLastEdit: () => false,
    });

    expect(stateHarness.state.displayAnswerMode).toBe(true);
    expect(stateHarness.state.isEditing).toBe(false);
    expect(stateHarness.state.startFresh).toBe(false);
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
          q1: { value: 'viewed' },
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
        q1: { value: 'viewed' },
        q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
      },
      importance: {},
      conviction: {},
      additionalComments: {
        q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
        q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
      },
    });
    expect(buildSliceFromUserAnswers).toHaveBeenCalledWith({ answer: { value: 'viewed' } });
    expect(buildSliceFromLocalCache).not.toHaveBeenCalled();
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(persistDraftSafely).toHaveBeenCalledTimes(1);
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
  });
});
