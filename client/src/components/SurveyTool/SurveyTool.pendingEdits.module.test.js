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

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
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
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    const baseline = {
      answers: {
        q1: { value: 'base', encrypted: false, encryptionAudience: 'self' },
        orphan: { value: 'stale', encrypted: false, encryptionAudience: 'self' },
      },
      additionalComments: {
        q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        orphan: { value: '', encrypted: false, encryptionAudience: 'self' },
      },
      importance: {},
      conviction: {},
    };
    const current = {
      answers: {
        q1: { value: 'base', encrypted: false, encryptionAudience: 'self' },
      },
      additionalComments: {
        q1: { value: '', encrypted: false, encryptionAudience: 'self' },
      },
      importance: {},
      conviction: {},
    };

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [current],
      editBaseline: baseline,
      userAnswers: null,
      isLoadingResponse: false,
    };

    expect(subject.getPendingEditStats(0).total).toBe(0);

    subject.state.surveysResponseState[0].answers.q1 = {
      ...subject.state.surveysResponseState[0].answers.q1,
      value: 'base + edit',
    };
    subject._changedQidsAndFieldsCache = null;
    expect(subject.getPendingEditStats(0).total).toBe(1);

    subject.state.surveysResponseState[0].answers.q1 = {
      ...subject.state.surveysResponseState[0].answers.q1,
      value: 'base',
    };
    subject._changedQidsAndFieldsCache = null;
    expect(subject.getPendingEditStats(0).total).toBe(0);
  });

  it('uses pile question scope for pending diffs so one edit counts as one', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

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
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);

    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'same', encrypted: false, encryptionAudience: 'self' },
            q2: { value: 'other', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: { q1: { ...emptyField }, q2: { ...emptyField } },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: {
          q1: { value: 'same', encrypted: false, encryptionAudience: 'self' },
          q2: { value: 'other', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: { q1: { ...emptyField }, q2: { ...emptyField } },
        importance: {},
        conviction: {},
      },
      userAnswers: null,
      isLoadingResponse: false,
    };

    const unchanged = subject.getChangedQidsAndFields(0);
    expect(unchanged.changedQids.size).toBe(0);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          ...subject.state.surveysResponseState[0],
          answers: {
            ...subject.state.surveysResponseState[0].answers,
            q1: { value: 'edited-visible', encrypted: false, encryptionAudience: 'self' },
          },
        },
      ],
    };
    subject._changedQidsAndFieldsCache = null;
    const visibleEdit = subject.getChangedQidsAndFields(0);
    expect(visibleEdit.changedQids.has('q1')).toBe(true);
    expect(visibleEdit.changedQids.has('q2')).toBe(false);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          ...subject.state.surveysResponseState[0],
          answers: {
            ...subject.state.surveysResponseState[0].answers,
            q1: { value: 'same', encrypted: false, encryptionAudience: 'self' },
            q2: { value: 'edited-offscreen', encrypted: false, encryptionAudience: 'self' },
          },
        },
      ],
    };
    subject._changedQidsAndFieldsCache = null;
    const offscreenEdit = subject.getChangedQidsAndFields(0);
    expect(offscreenEdit.changedQids.has('q1')).toBe(false);
    expect(offscreenEdit.changedQids.has('q2')).toBe(true);
  });

  it('reuses changed-qids cache when slice refs churn but semantic content is unchanged', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    const baseline = {
      answers: { q1: { value: 'same', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };
    const current = {
      answers: { q1: { value: 'same', encrypted: false, encryptionAudience: 'self' } },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [current],
      editBaseline: baseline,
      userAnswers: null,
      isLoadingResponse: false,
    };

    const indexSpy = jest.spyOn(subject, 'getIndexedQuestionEntryKeys');
    const first = subject.getChangedQidsAndFields(0);
    expect(first.changedQids.size).toBe(0);
    expect(indexSpy).toHaveBeenCalled();

    indexSpy.mockClear();
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: { q1: { ...current.answers.q1 } },
        additionalComments: { q1: { ...current.additionalComments.q1 } },
        importance: {},
        conviction: {},
      }],
      editBaseline: {
        answers: { q1: { ...baseline.answers.q1 } },
        additionalComments: { q1: { ...baseline.additionalComments.q1 } },
        importance: {},
        conviction: {},
      },
    };

    const second = subject.getChangedQidsAndFields(0);
    expect(second).toBe(first);
    expect(indexSpy).not.toHaveBeenCalled();
  });

  it('recomputes changed-qids cache when a middle array value changes', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    const baseline = {
      answers: {
        q1: {
          value: ['A', 'B', 'C'],
          encrypted: false,
          encryptionAudience: 'self',
        },
      },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };
    const current = {
      answers: {
        q1: {
          value: ['A', 'B', 'C'],
          encrypted: false,
          encryptionAudience: 'self',
        },
      },
      additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
      importance: {},
      conviction: {},
    };

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [current],
      editBaseline: baseline,
      userAnswers: null,
      isLoadingResponse: false,
    };

    const first = subject.getChangedQidsAndFields(0);
    expect(first.changedQids.size).toBe(0);

    const indexSpy = jest.spyOn(subject, 'getIndexedQuestionEntryKeys');
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: {
            ...current.answers.q1,
            value: ['A', 'D', 'C'],
          },
        },
        additionalComments: { q1: { ...current.additionalComments.q1 } },
        importance: {},
        conviction: {},
      }],
      editBaseline: {
        answers: { q1: { ...baseline.answers.q1 } },
        additionalComments: { q1: { ...baseline.additionalComments.q1 } },
        importance: {},
        conviction: {},
      },
    };

    const second = subject.getChangedQidsAndFields(0);
    expect(second).not.toBe(first);
    expect(second.changedQids.has('q1')).toBe(true);
    expect(indexSpy).toHaveBeenCalled();
  });

  it('counts encrypted rating edits when baseline has missing plaintext rating', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.getDefaultResponseEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    subject.state = {
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: { q1: { value: '*', encrypted: true, encryptionAudience: 'self' } },
          additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
          importance: { q1: 7 },
          conviction: {},
        },
      ],
      editBaseline: {
        answers: { q1: { value: '*', encrypted: true, encryptionAudience: 'self' } },
        additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
        importance: {},
        conviction: {},
      },
      userAnswers: null,
      isLoadingResponse: false,
    };

    expect(subject.getPendingEditStats(0).total).toBe(1);
  });

  it('clears binary answer when selecting the same option again', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.getEffectiveRecipientsForQid = () => [];
    subject.resolveFieldEncryptionAudience = () => 'self';
    subject.isQuestionLockedForResponse = () => false;

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: { q1: { value: 'Agree', encrypted: false, encryptionAudience: 'self' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.handleAnswer(0, 'q1', 'Agree');
    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe('');
  });

  it('skips no-op answer updates for repeated freeform values with stable encryption state', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.setState = jest.fn();
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.getEffectiveRecipientsForQid = jest.fn(() => []);
    subject.resolveFieldEncryptionAudience = (field) => field?.encryptionAudience || 'self';
    subject.isQuestionLockedForResponse = () => false;

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'freeform' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'same',
              encrypted: false,
              encryptionAudience: 'self',
              hash: '0xabc',
            },
          },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.handleAnswer(0, 'q1', 'same');
    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.getEffectiveRecipientsForQid).not.toHaveBeenCalled();
  });

  it('defers draft persistence for slider-driven rating updates until the drag completes', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.scheduleJsonPreviewUpdate = jest.fn();
    subject.persistDraftSafely = jest.fn();
    subject.getEffectiveRecipientsForQid = jest.fn(() => []);
    subject.resolveFieldEncryptionAudience = (field) => field?.encryptionAudience || 'self';
    subject.isQuestionLockedForResponse = () => false;
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'rating' }],
      pileQuestions: [],
      surveysResponseState: [
        {
          answers: { q1: { value: 2, encrypted: false, encryptionAudience: 'self' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.handleAnswer(0, 'q1', 6, { persistDraft: false });

    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe(6);
    expect(subject.scheduleJsonPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).not.toHaveBeenCalled();

    subject.flushDraftPersistAfterSliderChange();
    expect(subject.persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('gates deferred json preview updates when response preview is hidden', () => {
    jest.useFakeTimers();
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.updateJsonPreview = jest.fn();
    subject.state = { ...subject.state, showResponseJson: false };

    subject.scheduleJsonPreviewUpdate(40);
    jest.advanceTimersByTime(50);
    expect(subject.updateJsonPreview).not.toHaveBeenCalled();

    subject.state = { ...subject.state, showResponseJson: true };
    subject.scheduleJsonPreviewUpdate(40);
    jest.advanceTimersByTime(50);
    expect(subject.updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('refreshes json preview immediately when response json panel is opened', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.updateJsonPreview = jest.fn();
    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    };
    subject.state = { ...subject.state, showResponseJson: false };

    subject.toggleShowResponseJson();

    expect(subject.state.showResponseJson).toBe(true);
    expect(subject.updateJsonPreview).toHaveBeenCalledWith(true);
  });

  it('does not inherit the general session name in single-question response json when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
      sessionName: 'General Session',
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      account: '0xabc',
      loginComplete: true,
      provider: {},
    });
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt without session name' }],
      surveysResponseState: [{
        answers: {
          q1: { value: 'hello', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
      }],
    };

    const json = subject.prepareJsonAndHash(0);

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
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
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
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const uploadSpy = jest.fn();
    subject.encryptAndUpload = uploadSpy;
    subject.getPendingEditStats = () => ({ total: 1, encrypted: 0 });
    subject.state = {
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      modifiedCount: 1,
    };

    subject.handlePrimarySubmitClick();
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('blocks rapid double submit clicks until encryptAndUpload releases the guard', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const deferred = createDeferred();
    const uploadSpy = jest.fn(() => deferred.promise);
    subject.encryptAndUpload = uploadSpy;
    subject.getPendingEditStats = () => ({ total: 1, encrypted: 0 });
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      modifiedCount: 1,
    };

    subject.handlePrimarySubmitClick();
    subject.handlePrimarySubmitClick();

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(subject._submitGuard).toBe(true);

    deferred.resolve();
    await flushAsyncCallbacks();
  });

  it('revert X only seeds empty structures for currently rendered ids', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: { q1: { value: 'dirty', encrypted: false, encryptionAudience: 'self' } },
          additionalComments: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: { q1: { value: 'saved', encrypted: false, encryptionAudience: 'self' } },
        additionalComments: { q1: { ...emptyField } },
        importance: {},
        conviction: {},
      },
    };
    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1', 'q2']);
    subject.clearDraft = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject.setState = (next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    };

    subject.handleRevertPendingChanges();

    const reverted = subject.state.surveysResponseState?.[0];
    expect(reverted?.answers?.q1?.value).toBe('saved');
    expect(reverted?.answers?.q2).toBeUndefined();
    expect(reverted?.additionalComments?.q2).toBeUndefined();
  });

  it('revert X re-latches submitted state when no pending edits remain', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: { q1: { value: 'dirty', encrypted: false, encryptionAudience: 'self' } },
          additionalComments: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: { q1: { value: 'saved', encrypted: false, encryptionAudience: 'self' } },
        additionalComments: { q1: { ...emptyField } },
        importance: {},
        conviction: {},
      },
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

    subject.handleRevertPendingChanges();

    expect(subject.state.pileDiscardedEdits).toBe(false);
    expect(subject.state.submittedSinceLastEdit).toBe(true);
    expect(subject.state.modifiedCount).toBe(0);
    expect(subject.state.isDirty).toBe(false);
  });

  it('restores the viewed-response slice when exiting edit mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 2,
      responderAddress: '0xdef',
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.state = {
      ...subject.state,
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

    subject.handleExitEditing();

    expect(subject.state.displayAnswerMode).toBe(true);
    expect(subject.state.isEditing).toBe(false);
    expect(subject.state.startFresh).toBe(false);
    expect(subject.state.submittedSinceLastEdit).toBe(false);
    expect(subject.state.surveysResponseState).toEqual([
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
    expect(subject.state.editBaseline).toEqual({
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
    expect(subject.buildSliceFromUserAnswers).toHaveBeenCalledWith({ answer: { value: 'viewed' } });
    expect(subject.clearDraft).toHaveBeenCalledTimes(1);
    expect(subject.recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledTimes(1);
    expect(subject.updateJsonPreview).toHaveBeenCalledTimes(1);
  });
});
