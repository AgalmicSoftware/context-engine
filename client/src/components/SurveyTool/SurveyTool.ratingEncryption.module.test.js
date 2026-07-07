import SurveyTool from './SurveyTool';
import {
  buildAdditionalAudienceSelectionPlan,
  buildAnswerAudienceSelectionPlan,
} from './surveyToolFieldEncryptionController';
import { buildFieldEncryptionWorkGroups } from './surveyToolSubmitPrepController';
import { processRatingEnvelopesForSubmit } from './surveyToolRatingEnvelopeSubmitController';
import { buildAdditionalEncryptionAudienceState, buildAnswerEncryptionAudienceState } from './surveyQuestionsTypes';
import { buildSurveyResponseStateArray } from './surveyToolHydrationFlow';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import { DeferredCommitSlider } from './DeferredCommitSlider';
import { QuestionFilter as RawQuestionFilter } from './QuestionFilter';
import TagModal from '../TagPage/TagModal';
import GatedPromptNotice from './GatedPromptNotice';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import contractScripts, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as portoFunctions from '../../utilities/web3/portoFunctions.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  countElements,
  findElement,
  findFirstNodeByType,
  findNodeByClassName,
  getElementChildren,
  nodeHasClassName,
  treeHasDataTestId,
  treeHasLabel,
  treeHasText,
} from './surveyToolTreeTestHelpers.js';

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
  return { promise, resolve, reject };
};

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
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

    subject.applyAnswerEncryptionAudience(0, 'q1', 'gate', { gateId: 'gate-b' });
    expect(subject.state.surveysResponseState[0].answers.q1.encryptionGateId).toBe('gate-b');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBe('gate-b');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('inherit');

    subject.applyAdditionalEncryptionAudience(0, 'q1', 'self');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionAudience).toBe('self');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('explicit');

    subject.applyAnswerEncryptionAudience(0, 'q1', 'gate', { gateId: 'gate-a' });
    expect(subject.state.surveysResponseState[0].answers.q1.encryptionGateId).toBe('gate-a');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionAudience).toBe('self');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBeNull();

    subject.applyAdditionalEncryptionAudience(0, 'q1', 'follow');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.audienceMode).toBe('inherit');
    expect(subject.state.surveysResponseState[0].additionalComments.q1.encryptionGateId).toBe('gate-a');
  });

  it('applies answer and additional audiences into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
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
    subject.invalidateDiffCaches = jest.fn();
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.getEffectiveRecipientsForQid = jest.fn(() => [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }]);
    subject.getResponseGateOptions = jest.fn(() => [
      {
        gateId: 'gate-a',
        label: 'Gate A',
        sbtAddresses: ['0x00000000000000000000000000000000000000a1'],
        sbtSummary: 'Gate A SBT',
        recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }],
      },
    ]);
    subject.state = {
      ...subject.state,
      surveysResponseState: [],
    };

    subject.applyAnswerEncryptionAudience(2, 'q1', 'gate', { gateId: 'gate-a' });
    expect(subject.state.surveysResponseState).toHaveLength(3);
    expect(subject.state.surveysResponseState[2].answers.q1.encryptionAudience).toBe('gate');
    expect(subject.state.surveysResponseState[2].answers.q1.encryptionGateId).toBe('gate-a');

    subject.applyAdditionalEncryptionAudience(2, 'q1', 'follow');
    expect(subject.state.surveysResponseState[2].additionalComments.q1.audienceMode).toBe('inherit');
    expect(subject.state.surveysResponseState[2].additionalComments.q1.encryptionGateId).toBe('gate-a');
  });

  it('groups answer and additional encryption work by field-specific gate recipients', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const gateARecipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const gateBRecipients = [{ accessControlConditions: [{ contractAddress: '0x2' }], chain: 'base' }];
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveFieldEncryptionAudience = (field) => field?.encryptionAudience || 'self';
    subject.resolveFieldEncryptionGateId = (field) => field?.encryptionGateId || null;
    subject.getEffectiveRecipientsForField = jest.fn(({ field }) => (
      field?.encryptionGateId === 'gate-b' ? gateBRecipients : gateARecipients
    ));

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
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const question = {
      id: 'q1',
      type: 'rating',
      question: 'How strongly do you agree?',
    };

    const withNumericString = {
      answers: { q1: { value: '8', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };
    let fullQuestionCard = subject.renderQuestion(question, 0, withNumericString);
    let ratingInput = renderFullQuestionResponseInput(fullQuestionCard);
    expect(ratingInput.type).toBe(FullQuestionRatingInput);
    expect(ratingInput.props.value).toBe(8);
    expect(ratingInput.props.disabled).toBe(false);
    expect(typeof ratingInput.props.onChange).toBe('function');
    expect(typeof ratingInput.props.onChangeComplete).toBe('function');
    expect(renderToStaticMarkup(ratingInput)).toContain('8');

    const withOverflowValue = {
      answers: { q1: { value: '18', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };
    fullQuestionCard = subject.renderQuestion(question, 0, withOverflowValue);
    ratingInput = renderFullQuestionResponseInput(fullQuestionCard);
    expect(ratingInput.type).toBe(FullQuestionRatingInput);
    expect(ratingInput.props.value).toBe(10);
    expect(renderToStaticMarkup(ratingInput)).toContain('10');

    const withNonNumericValue = {
      answers: { q1: { value: 'abc', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };
    fullQuestionCard = subject.renderQuestion(question, 0, withNonNumericValue);
    ratingInput = renderFullQuestionResponseInput(fullQuestionCard);
    expect(ratingInput.type).toBe(FullQuestionRatingInput);
    expect(ratingInput.props.value).toBe(0);
    expect(renderToStaticMarkup(ratingInput)).toContain('0');
  });

  it('persists keyboard-driven full-mode rating edits immediately', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
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

    const question = {
      id: 'q1',
      type: 'rating',
      question: 'How strongly do you agree?',
    };

    subject.state = {
      ...subject.state,
      questionPool: [question],
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

    const fullQuestionCard = subject.renderQuestion(question, 0, subject.state.surveysResponseState[0]);
    const ratingInput = renderFullQuestionResponseInput(fullQuestionCard);
    expect(ratingInput.type).toBe(FullQuestionRatingInput);

    ratingInput.props.onChange(6, { type: 'keydown' });

    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe(6);
    expect(subject.scheduleJsonPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledTimes(1);
  });

  it('uses the deferred slider wrapper for single-question rating cards', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const question = {
      id: 'q1',
      type: 'rating',
      question: 'How strongly do you agree?',
    };

    const currentSurveyResponseState = {
      answers: { q1: { value: '8', encrypted: false } },
      additionalComments: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
    };

    const fullQuestionCard = subject.renderQuestion(question, 0, currentSurveyResponseState);
    const deferredSlider = renderFullQuestionResponseInput(fullQuestionCard);
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
          importance: { q1: 7 },
          conviction: { q1: 3 },
        },
      ],
      userAnswers: null,
      hasher: { hash: jest.fn() },
    };
    subject.prepareJsonAndHash = jest.fn(() => ({
      questionID: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
      additional: { value: '', encrypted: false },
      importance: 7,
      conviction: 3,
    }));
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { importance: 1, conviction: 1 } },
    }));
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'gate');
    subject.getDefaultResponseEncryptionAudienceForQid = jest.fn(() => 'gate');
    const recipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const sharedLitOpts = { recipients, accessControlConditions: recipients[0].accessControlConditions, chain: 'base' };
    subject.getEffectiveRecipientsForQid = jest.fn(() => recipients);
    subject.buildLitEncryptionOptionsForRecipients = jest.fn(() => sharedLitOpts);

    const encryptSpy = jest
      .spyOn(cryptoUtils, 'encryptEnvelopeValue')
      .mockImplementation(async (_value, opts) => `env:${opts.qId}`);
    const submitSpy = jest
      .spyOn(contractScripts, 'submitResponses')
      .mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          transactionHash: `0x${'1'.repeat(64)}`,
        }),
      });

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
          importance: { q1: 7 },
          conviction: { q1: 3 },
        },
      ],
      userAnswers: null,
      hasher: { hash: jest.fn() },
    };
    subject.prepareJsonAndHash = jest.fn(() => ({
      questionID: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
      additional: { value: '', encrypted: false },
      importance: 7,
      conviction: 3,
    }));
    subject.getChangedQidsAndFields = jest.fn(() => ({
      changedQids: new Set(['q1']),
      changedMap: { q1: { importance: 1, conviction: 1 } },
    }));
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'gate');
    subject.getDefaultResponseEncryptionAudienceForQid = jest.fn(() => 'gate');
    const recipients = [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'base' }];
    const sharedLitOpts = { recipients, accessControlConditions: recipients[0].accessControlConditions, chain: 'base' };
    subject.getEffectiveRecipientsForQid = jest.fn(() => recipients);
    subject.buildLitEncryptionOptionsForRecipients = jest.fn(() => sharedLitOpts);

    const encryptSpy = jest
      .spyOn(cryptoUtils, 'encryptEnvelopeValue')
      .mockImplementation(async (_value, opts) => `env:${opts.qId}`);
    const submitSpy = jest
      .spyOn(contractScripts, 'submitResponses')
      .mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          transactionHash: `0x${'3'.repeat(64)}`,
        }),
      });

    await subject.submitSurveyResponse();

    expect(encryptSpy).toHaveBeenCalledTimes(2);
    expect(encryptSpy.mock.calls[0][1].chainId).toBe(84532);
    expect(encryptSpy.mock.calls[1][1].chainId).toBe(84532);
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
