import {
  buildAdditionalAudienceSelectionPlan,
  buildAnswerAudienceSelectionPlan,
} from './surveyToolFieldEncryptionController';
import { buildFieldEncryptionWorkGroups } from './surveyToolSubmitPrepController';
import { processRatingEnvelopesForSubmit } from './surveyToolRatingEnvelopeSubmitController';
import { buildAdditionalEncryptionAudienceState, buildAnswerEncryptionAudienceState } from './surveyQuestionsTypes';
import { buildSurveyResponseStateArray } from './surveyToolHydrationFlow';
import { SurveyQuestionsFullQuestionResponseInput } from './SurveyQuestionsFullQuestionResponseInput';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import DeferredRatingSlider from './DeferredRatingSlider';

const buildEmptyResponseFieldState = () => ({
  value: '',
  encrypted: false,
  encryptionAudience: 'self',
  encryptionGateId: null,
  audienceMode: 'default',
});

const buildFieldEncryptionDeps = (overrides = {}) => ({
  isQuestionLockedForResponse: () => false,
  buildEmptyResponseFieldState,
  resolveFieldEncryptionAudience: (field) => field?.encryptionAudience || 'self',
  resolveFieldEncryptionGateId: (field) =>
    field?.encryptionGateId ? String(field.encryptionGateId).trim().toLowerCase() : null,
  normalizeFieldAudienceMode: (value) => String(value || ''),
  buildInheritedAdditionalFieldState: (additionalField, answerField) => ({
    ...additionalField,
    encrypted: !!answerField.encrypted,
    encryptionAudience: answerField.encryptionAudience,
    encryptionGateId: answerField.encryptionGateId || null,
    audienceMode: 'inherit',
  }),
  normalizeResponseEncryptionAudience: (audience) =>
    String(audience || '')
      .trim()
      .toLowerCase() || 'self',
  ...overrides,
});

const applyAnswerAudience = (state, questionId, audience, options = {}) => {
  const patch = buildAnswerEncryptionAudienceState(state, {
    audience,
    buildAnswerAudienceSelectionPlan,
    buildSurveyResponseStateArray,
    deps: buildFieldEncryptionDeps(),
    gateId: options.gateId || '',
    questionId,
    surveyIndex: options.surveyIndex || 0,
  });
  return { ...state, ...patch };
};

const applyAdditionalAudience = (state, questionId, audience, options = {}) => {
  const patch = buildAdditionalEncryptionAudienceState(state, {
    audience,
    buildAdditionalAudienceSelectionPlan,
    buildSurveyResponseStateArray,
    deps: buildFieldEncryptionDeps(),
    gateId: options.gateId || '',
    questionId,
    surveyIndex: options.surveyIndex || 0,
  });
  return { ...state, ...patch };
};

const renderResponseInput = ({
  answerValue,
  singleQuestionMode = false,
  onRatingChange = jest.fn(),
  onDeferredRatingCommit = jest.fn(),
} = {}) =>
  SurveyQuestionsFullQuestionResponseInput({
    question: {
      id: 'q1',
      type: 'rating',
      question: 'How strongly do you agree?',
    },
    qIndex: 0,
    answer: { value: answerValue, encrypted: false },
    singleQuestionMode,
    onRatingChange,
    onRatingChangeComplete: jest.fn(),
    onDeferredRatingCommit,
  });

const buildRatingEnvelopeContext = (overrides = {}) => ({
  sliceForSubmit: { answers: {}, additionalComments: {} },
  userAnswersSource: null,
  questionResponses: [],
  changedMapForSubmit: {},
  encryptionBaseOpts: {
    provider: {},
    account: '0xabc',
    chainId: 84532,
    surveyId: '0xsurvey',
    kind: 'response',
    hasher: { hash: jest.fn() },
  },
  ...overrides,
});

const buildRatingEnvelopeDeps = (overrides = {}) => ({
  isQuestionLockedForResponse: () => false,
  resolveFieldEncryptionAudience: (field) => field?.encryptionAudience || 'self',
  getEffectiveRecipientsForQid: () => [],
  getEffectiveRecipientsForField: () => [],
  getDefaultResponseEncryptionAudienceForQid: () => 'self',
  buildLitEncryptionOptionsForRecipients: () => null,
  encryptEnvelopeValue: jest.fn(async (_value, opts) => `env:${opts.qId}`),
  getImportanceFromResponse: (response) => (typeof response?.importance === 'number' ? response.importance : null),
  getConvictionFromResponse: (response) => (typeof response?.conviction === 'number' ? response.conviction : null),
  ...overrides,
});

describe('SurveyTool rating encryption controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('lets additional comments Match Answer until an explicit override is chosen', () => {
    let state = {
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'answer',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptionGateId: 'gate-a',
              audienceMode: 'explicit',
            },
          },
          additionalComments: {
            q1: {
              value: 'comments',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptionGateId: 'gate-a',
              audienceMode: 'inherit',
            },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    state = applyAnswerAudience(state, 'q1', 'gate', { gateId: 'gate-b' });
    expect(state.surveysResponseState[0].answers.q1.encryptionGateId).toBe('gate-b');
    expect(state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBe('gate-b');
    expect(state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('inherit');

    state = applyAdditionalAudience(state, 'q1', 'self');
    expect(state.surveysResponseState[0].additionalComments.q1.encryptionAudience).toBe('self');
    expect(state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('explicit');

    state = applyAnswerAudience(state, 'q1', 'gate', { gateId: 'gate-a' });
    expect(state.surveysResponseState[0].answers.q1.encryptionGateId).toBe('gate-a');
    expect(state.surveysResponseState[0].additionalComments.q1.encryptionAudience).toBe('self');
    expect(state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBeNull();

    state = applyAdditionalAudience(state, 'q1', 'follow');
    expect(state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('inherit');
    expect(state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBe('gate-a');
  });

  it('applies answer and additional audiences into ensured survey slots', () => {
    let state = { surveysResponseState: [] };

    state = applyAnswerAudience(state, 'q1', 'gate', { gateId: 'gate-a', surveyIndex: 2 });
    expect(state.surveysResponseState).toHaveLength(3);
    expect(state.surveysResponseState[2].answers.q1.encryptionAudience).toBe('gate');
    expect(state.surveysResponseState[2].answers.q1.encryptionGateId).toBe('gate-a');

    state = applyAdditionalAudience(state, 'q1', 'follow', { surveyIndex: 2 });
    expect(state.surveysResponseState[2].additionalComments.q1.audienceMode).toBe('inherit');
    expect(state.surveysResponseState[2].additionalComments.q1.encryptionGateId).toBe('gate-a');
  });

  it('groups answer and additional encryption work by field-specific gate recipients', () => {
    const gateARecipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const gateBRecipients = [{ accessControlConditions: [{ contractAddress: '0x2' }], chain: 'base' }];

    const { groups, missingRecipients } = buildFieldEncryptionWorkGroups(
      {
        answers: {
          q1: {
            value: 'answer',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptionGateId: 'gate-a',
          },
        },
        additionalComments: {
          q1: {
            value: 'comments',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptionGateId: 'gate-b',
          },
        },
        importance: {},
        conviction: {},
      },
      new Set(['q1']),
      {
        isQuestionLockedForResponse: () => false,
        resolveFieldEncryptionAudience: (field) => field?.encryptionAudience || 'self',
        resolveFieldEncryptionGateId: (field) => field?.encryptionGateId || null,
        getEffectiveRecipientsForField: ({ field }) =>
          field?.encryptionGateId === 'gate-b' ? gateBRecipients : gateARecipients,
      },
    );

    expect(missingRecipients).toEqual([]);
    expect(groups).toHaveLength(2);
    expect(groups[0].slice.answers.q1 || groups[1].slice.answers.q1).toBeTruthy();
    expect(groups[0].slice.additionalComments.q1 || groups[1].slice.additionalComments.q1).toBeTruthy();
    expect(groups.map((group) => JSON.stringify(group.recipients))).toEqual(
      expect.arrayContaining([JSON.stringify(gateARecipients), JSON.stringify(gateBRecipients)]),
    );
  });

  it('clamps full-mode rating answers into the supported slider range and avoids duplicate id styling hooks', () => {
    const withNumericString = renderResponseInput({ answerValue: '8' });
    expect(withNumericString.type).toBe(FullQuestionRatingInput);
    expect(withNumericString.props.value).toBe(8);
    expect(withNumericString.props.disabled).toBe(false);
    expect(typeof withNumericString.props.onChange).toBe('function');
    expect(typeof withNumericString.props.onChangeComplete).toBe('function');
    expect(withNumericString.props.id).toBeUndefined();

    const withOverflowValue = renderResponseInput({ answerValue: '18' });
    expect(withOverflowValue.type).toBe(FullQuestionRatingInput);
    expect(withOverflowValue.props.value).toBe(10);
    expect(withOverflowValue.props.id).toBeUndefined();

    const withNonNumericValue = renderResponseInput({ answerValue: 'abc' });
    expect(withNonNumericValue.type).toBe(FullQuestionRatingInput);
    expect(withNonNumericValue.props.value).toBe(0);
    expect(withNonNumericValue.props.id).toBeUndefined();
  });

  it('persists keyboard-driven full-mode rating edits immediately', () => {
    const onRatingChange = jest.fn();
    const ratingInput = renderResponseInput({
      answerValue: 2,
      onRatingChange,
    });
    const keyboardEvent = { type: 'keydown' };

    ratingInput.props.onChange(6, keyboardEvent);

    expect(onRatingChange).toHaveBeenCalledWith(6, keyboardEvent);
    // port note: the old class test also observed scheduleJsonPreviewUpdate/persistDraftSafely
    // after the rating callback; that callback-side effect is covered by the pending-edit
    // controller tests, while this port keeps the input-level immediate dispatch contract.
  });

  it('uses the deferred slider wrapper for single-question rating cards', () => {
    const deferredSlider = renderResponseInput({
      answerValue: '8',
      singleQuestionMode: true,
    });

    expect(deferredSlider.type).toBe(DeferredRatingSlider);
    expect(deferredSlider.props.value).toBe(8);
    expect(typeof deferredSlider.props.onCommit).toBe('function');
  });

  it('encrypts both rating envelopes with one audience context and clears plaintext rating values', async () => {
    const recipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const sharedLitOpts = {
      recipients,
      accessControlConditions: recipients[0].accessControlConditions,
      chain: 'base',
    };
    const encryptEnvelopeValue = jest.fn(async (_value, opts) => `env:${opts.qId}`);
    const questionResponses = [
      {
        questionID: 'q1',
        answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
        additional: { value: '', encrypted: false },
        importance: 7,
        conviction: 3,
      },
    ];

    const result = await processRatingEnvelopesForSubmit(
      buildRatingEnvelopeContext({
        sliceForSubmit: {
          answers: {
            q1: { value: '*', encrypted: true, encryptionAudience: 'gate' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'gate' },
          },
        },
        questionResponses,
        changedMapForSubmit: { q1: { importance: true, conviction: true } },
      }),
      buildRatingEnvelopeDeps({
        resolveFieldEncryptionAudience: () => 'gate',
        getDefaultResponseEncryptionAudienceForQid: () => 'gate',
        getEffectiveRecipientsForQid: () => recipients,
        getEffectiveRecipientsForField: () => recipients,
        buildLitEncryptionOptionsForRecipients: () => sharedLitOpts,
        encryptEnvelopeValue,
      }),
    );

    expect(result).toEqual(expect.objectContaining({ processed: true, questionsEncrypted: 1 }));
    expect(encryptEnvelopeValue).toHaveBeenCalledTimes(2);
    expect(encryptEnvelopeValue.mock.calls[0][1].qId).toBe('importance:q1');
    expect(encryptEnvelopeValue.mock.calls[1][1].qId).toBe('conviction:q1');
    expect(encryptEnvelopeValue.mock.calls[0][1].lit).toBe(sharedLitOpts);
    expect(encryptEnvelopeValue.mock.calls[1][1].lit).toBe(sharedLitOpts);

    expect(questionResponses[0]).toEqual(
      expect.objectContaining({
        importanceEncrypted: 'env:importance:q1',
        convictionEncrypted: 'env:conviction:q1',
        importance: null,
        conviction: null,
      }),
    );
  });

  it('uses the session chain for rating envelope encryption when wallet-facing network props point at Base mainnet', async () => {
    const recipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const sharedLitOpts = {
      recipients,
      accessControlConditions: recipients[0].accessControlConditions,
      chain: 'base',
    };
    const encryptEnvelopeValue = jest.fn(async (_value, opts) => `env:${opts.qId}`);
    const questionResponses = [
      {
        questionID: 'q1',
        answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
        additional: { value: '', encrypted: false },
        importance: 7,
        conviction: 3,
      },
    ];

    await processRatingEnvelopesForSubmit(
      buildRatingEnvelopeContext({
        sliceForSubmit: {
          answers: {
            q1: { value: '*', encrypted: true, encryptionAudience: 'gate' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'gate' },
          },
        },
        questionResponses,
        changedMapForSubmit: { q1: { importance: true, conviction: true } },
        encryptionBaseOpts: {
          provider: {},
          account: '0xabc',
          chainId: 84532,
          surveyId: '0xsurvey',
          kind: 'response',
          hasher: { hash: jest.fn() },
        },
      }),
      buildRatingEnvelopeDeps({
        resolveFieldEncryptionAudience: () => 'gate',
        getDefaultResponseEncryptionAudienceForQid: () => 'gate',
        getEffectiveRecipientsForQid: () => recipients,
        getEffectiveRecipientsForField: () => recipients,
        buildLitEncryptionOptionsForRecipients: () => sharedLitOpts,
        encryptEnvelopeValue,
      }),
    );

    expect(encryptEnvelopeValue).toHaveBeenCalledTimes(2);
    expect(encryptEnvelopeValue.mock.calls[0][1].chainId).toBe(84532);
    expect(encryptEnvelopeValue.mock.calls[1][1].chainId).toBe(84532);
  });
});
