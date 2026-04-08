import SurveyTool from './SurveyTool';
import {
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  buildSurveyDraftSemanticSignature,
} from './surveyToolUtils.js';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import { QuestionsDashboard } from './SurveySelector';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
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

const syncClassSetState = (subject) => {
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

// Remaining broad SurveyTool module coverage owns shared response decrypt access and shared question decrypt helper behavior.
describe('SurveyTool module', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('treats sponsored access errors as uncertain when checking response decrypt access', async () => {
    const gateSpy = jest.spyOn(sponsoredAccess, 'checkSponsoredAccess')
      .mockResolvedValueOnce({
        status: 'error',
        gate: null,
        resourceKey: 'surveyResponses',
      })
      .mockResolvedValueOnce({
        status: 'denied',
        gate: null,
        resourceKey: 'default',
      });
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sbtCacheRevision: 0,
    });
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.getResponseGatePolicy = jest.fn(() => ({
      primaryResource: 'surveyResponses',
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({}));

    const canDecrypt = await subject.refreshCanDecryptOtherResponses();

    expect(canDecrypt).toBe(false);
    expect(gateSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.canDecryptOtherResponses).toBe(false);
    expect(subject.state.canDecryptOtherResponsesStatus).toBe('unknown');
  });

  it('marks response decrypt access as needs-wallet when auth is missing', async () => {
    const gateSpy = jest.spyOn(sponsoredAccess, 'checkSponsoredAccess');
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
      sbtCacheRevision: 0,
    });
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      canDecryptOtherResponses: true,
      canDecryptOtherResponsesStatus: 'granted',
    };
    subject.getResponseGatePolicy = jest.fn(() => ({
      primaryResource: 'surveyResponses',
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({}));
    subject._canDecryptOtherResponsesRunId = 4;
    subject._canDecryptOtherResponsesKey = 'stale-key';
    subject._canDecryptOtherResponsesInFlight = Promise.resolve(true);

    const canDecrypt = await subject.refreshCanDecryptOtherResponses();

    expect(canDecrypt).toBe(false);
    expect(gateSpy).not.toHaveBeenCalled();
    expect(subject.state.canDecryptOtherResponses).toBe(false);
    expect(subject.state.canDecryptOtherResponsesStatus).toBe('needs-wallet');
    expect(subject._canDecryptOtherResponsesRunId).toBe(5);
    expect(subject._canDecryptOtherResponsesKey).toBe('');
    expect(subject._canDecryptOtherResponsesInFlight).toBeNull();
  });

  it('marks response decrypt access as no-gate when no recipients are configured', async () => {
    const gateSpy = jest.spyOn(sponsoredAccess, 'checkSponsoredAccess');
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sbtCacheRevision: 0,
    });
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      canDecryptOtherResponses: true,
      canDecryptOtherResponsesStatus: 'granted',
    };
    subject.getResponseGatePolicy = jest.fn(() => ({
      primaryResource: 'surveyResponses',
      recipients: [],
    }));
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({}));
    subject._canDecryptOtherResponsesRunId = 11;
    subject._canDecryptOtherResponsesKey = 'stale-key';
    subject._canDecryptOtherResponsesInFlight = Promise.resolve(true);

    const canDecrypt = await subject.refreshCanDecryptOtherResponses();

    expect(canDecrypt).toBe(false);
    expect(gateSpy).not.toHaveBeenCalled();
    expect(subject.state.canDecryptOtherResponses).toBe(false);
    expect(subject.state.canDecryptOtherResponsesStatus).toBe('no-gate');
    expect(subject._canDecryptOtherResponsesRunId).toBe(12);
    expect(subject._canDecryptOtherResponsesKey).toBe('');
    expect(subject._canDecryptOtherResponsesInFlight).toBeNull();
  });

  it('deduplicates in-flight response decrypt access checks for the same snapshot', async () => {
    const deferred = createDeferred();
    const gateSpy = jest.spyOn(sponsoredAccess, 'checkSponsoredAccess')
      .mockImplementation(() => deferred.promise);
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sbtCacheRevision: 0,
    });
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'needs-wallet',
    };
    subject.getResponseGatePolicy = jest.fn(() => ({
      primaryResource: 'default',
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({}));

    const firstRun = subject.refreshCanDecryptOtherResponses();
    await Promise.resolve();

    expect(gateSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.canDecryptOtherResponsesStatus).toBe('checking');
    expect(subject._canDecryptOtherResponsesInFlight).toBeTruthy();

    const secondRun = subject.refreshCanDecryptOtherResponses();
    await Promise.resolve();

    expect(gateSpy).toHaveBeenCalledTimes(1);
    expect(subject._canDecryptOtherResponsesRunId).toBe(1);
    expect(subject._canDecryptOtherResponsesKey).toContain('0xabc');

    deferred.resolve({
      status: 'granted',
      gate: null,
      resourceKey: 'default',
    });

    await expect(firstRun).resolves.toBe(true);
    await expect(secondRun).resolves.toBe(true);
    expect(subject.state.canDecryptOtherResponses).toBe(true);
    expect(subject.state.canDecryptOtherResponsesStatus).toBe('granted');
    expect(subject._canDecryptOtherResponsesInFlight).toBeNull();
  });

  it('normalizes shared question field task keys and decrypt busy lookups', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      decryptingByKey: { 'q1:prompt': true, 'q1:additional': true },
    };

    expect(subject.getQuestionFieldTaskKey(' Q1 ', ' Prompt ')).toBe('q1:prompt');
    expect(subject.getQuestionFieldTaskKey('q1', 'additional')).toBe('q1:additional');
    expect(subject.getQuestionFieldTaskKey('', 'answer')).toBe('');
    expect(subject.getQuestionFieldTaskKeys(' Q1 ', {
      includeAnswer: true,
      includeAdditional: true,
    })).toEqual(['q1:answer', 'q1:additional']);
    expect(subject.markQuestionFieldBusyMap({
      'q1:prompt': true,
    }, ['q1:answer', '', 'q1:additional'])).toEqual({
      'q1:prompt': true,
      'q1:answer': true,
      'q1:additional': true,
    });
    expect(subject.isQuestionFieldBusy(' Q1 ', ' prompt ')).toBe(true);
    expect(subject.isQuestionFieldBusy('q1', 'additional')).toBe(true);
    expect(subject.isQuestionFieldBusy('q1', 'answer')).toBe(false);
    expect(subject.isQuestionFieldBusy('', 'prompt')).toBe(false);
    expect(subject.clearQuestionFieldBusyMap({
      'q1:answer': true,
      'q1:additional': true,
      'q1:prompt': true,
    }, ' Q1 ', 'additional')).toEqual({
      'q1:answer': true,
      'q1:additional': false,
      'q1:prompt': true,
    });
  });

  it('derives shared question field decrypt selection for answer and additional flows', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.getQuestionFieldDecryptSelection('q1', 'both', {
      answers: {
        q1: { value: '*', encrypted: true },
      },
      additionalComments: {
        q1: { value: '*', encryptedPortion: 'sealed' },
      },
    })).toEqual({
      maskedAnswer: true,
      maskedAdditional: true,
      hasMaskedField: true,
      clearMode: 'both',
      keysToMark: ['q1:answer', 'q1:additional'],
    });

    expect(subject.getQuestionFieldDecryptSelection('q1', 'additional', {
      answers: {
        q1: { value: '*', encrypted: true },
      },
      additionalComments: {
        q1: { value: 'plain', encrypted: true },
      },
    })).toEqual({
      maskedAnswer: false,
      maskedAdditional: false,
      hasMaskedField: false,
      clearMode: '',
      keysToMark: [],
    });
  });

  it('decrypts shared question rating envelopes into numeric values', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    const decryptEnvelopeValueSpy = jest
      .spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (env) => {
        if (env === 'importance-env') return '7';
        if (env === 'conviction-env') return 'not-a-number';
        return null;
      });

    await expect(subject.decryptQuestionRatingEnvelopes(
      {
        importanceEncrypted: 'importance-env',
        convictionEncrypted: 'conviction-env',
      },
      {
        account: '0xabc',
        chainId: 84532,
        lit: { getKey: jest.fn() },
        providerLike: { provider: true },
      },
    )).resolves.toEqual({
      decryptedImportance: 7,
      decryptedConviction: null,
    });

    expect(decryptEnvelopeValueSpy).toHaveBeenCalledTimes(2);
    decryptEnvelopeValueSpy.mockRestore();
  });

  it('builds shared question decrypt execution context from current props and state', () => {
    const getProviderKindSpy = jest
      .spyOn(cryptoUtils, 'getProviderKind')
      .mockReturnValue('browser');
    const litHooks = { getKey: jest.fn() };
    const provider = { provider: true };
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      provider,
      litHooks,
    });
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'pool-q' }],
      pileQuestions: [{ id: 'pile-q' }],
      hasher: 'hash-worker',
    };
    subject.resolveDecryptSurveyId = jest.fn(() => 'survey-1');

    expect(subject.buildQuestionDecryptExecutionContext(
      { answers: {} },
      'Q1',
    )).toEqual({
      providerKind: 'browser',
      chainId: 84532,
      surveyId: 'survey-1',
      questionPool: [{ id: 'pool-q' }],
      lit: { getKey: litHooks.getKey },
      opts: {
        providerKind: 'browser',
        provider,
        account: '0xabc',
        chainId: 84532,
        surveyId: 'survey-1',
        questionPool: [{ id: 'pool-q' }],
        lit: { getKey: litHooks.getKey },
        hasher: 'hash-worker',
        throwOnError: true,
      },
    });

    getProviderKindSpy.mockRestore();
  });

  it('applies shared decrypted question response values onto viewed response records', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.applyDecryptedQuestionResponseValues(
      {
        answer: { value: '*' },
        additional: { value: '*' },
        importance: 1,
        conviction: 2,
      },
      {
        questionId: 'Q1',
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer' } },
          additionalComments: { q1: { value: 'clear notes' } },
        },
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    )).toEqual({
      answer: { value: 'clear answer' },
      additional: { value: 'clear notes' },
      importance: 7,
      conviction: 9,
    });
  });

  it('applies shared decrypted question state onto survey response slices', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.applyDecryptedQuestionStateToSurveySlice(
      {
        answers: { q1: { value: '*', encrypted: true } },
        additionalComments: { q1: { value: '*', encrypted: true } },
        importance: { q1: 1 },
        conviction: { q1: 2 },
      },
      {
        questionId: 'Q1',
        baselineSlice: {
          answers: { q1: { value: '*', encryptedPortion: 'ans-env' } },
          additionalComments: { q1: { value: '*', encrypted: true } },
        },
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer', zkSalt: 'salt-a' } },
          additionalComments: { q1: { value: 'clear notes', zkSalt: 'salt-b' } },
        },
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    )).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
  });

  it('syncs shared decrypted question state back into the edit baseline', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.syncDecryptedQuestionIntoBaseline(
      null,
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q1: { value: 'clear answer', encrypted: true } },
        additionalComments: { q1: { value: 'clear notes', encrypted: true } },
        importance: { q1: 7 },
        conviction: { q1: 9 },
      },
      {
        questionId: 'Q1',
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer' } },
          additionalComments: { q1: { value: 'clear notes' } },
        },
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    )).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
  });

  it('merges latest encrypted question fields into the working decrypt slice', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.mergeLatestEncryptedQuestionFields(
      {
        answers: { q1: { value: '*', encrypted: false, hash: 'old-a' } },
        additionalComments: { q1: { value: '*', encrypted: true, hash: 'old-b' } },
      },
      'Q1',
      {
        answer: { encrypted: true, hash: 'new-a', encryptedPortion: 'ans-env' },
        additional: { encrypted: false, hash: 'new-b', encryptedPortion: 'add-env' },
      },
      {
        includeAnswer: true,
        includeAdditional: true,
      },
    )).toEqual({
      answers: { q1: { value: '*', encrypted: true, hash: 'new-a', encryptedPortion: 'ans-env' } },
      additionalComments: { q1: { value: '*', encrypted: true, hash: 'new-b', encryptedPortion: 'add-env' } },
    });
  });

  it('builds shared decrypt start and failure state updates', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.buildQuestionDecryptStartState(
      { decryptingByKey: { 'q1:prompt': true } },
      ['q1:answer', 'q1:additional'],
    )).toEqual({
      isDecrypting: true,
      submissionError: '',
      suppressPrefill: true,
      decryptingByKey: {
        'q1:prompt': true,
        'q1:answer': true,
        'q1:additional': true,
      },
    });

    expect(subject.buildQuestionDecryptFailureState(
      { decryptingByKey: { 'q1:answer': true, 'q1:additional': true, 'q1:prompt': true } },
      'Q1',
      'additional',
      'boom',
    )).toEqual({
      isDecrypting: false,
      submissionError: 'boom',
      decryptingByKey: {
        'q1:answer': true,
        'q1:additional': false,
        'q1:prompt': true,
      },
    });
  });

  it('merges question response overrides into the working decrypt slice', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.mergeQuestionResponseOverrideIntoDecryptSlice(
      {
        answers: { q1: { value: '*', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
      },
      'Q1',
      {
        answer: { value: '*', encryptedPortion: 'ans-env', hash: 'ans-hash' },
        additional: { value: 'notes', encrypted: true, hash: 'add-hash' },
      },
    )).toEqual({
      answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env', hash: 'ans-hash' } },
      additionalComments: { q1: { value: 'notes', encrypted: true, hash: 'add-hash' } },
    });
  });

  it('extracts and merges question rating envelope state across response sources', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    expect(subject.getQuestionRatingEnvelopes(
      {
        responses: [
          { questionID: 'q2', importanceEncrypted: 'skip-me' },
          { questionID: 'Q1', convictionEncrypted: 'conv-1' },
        ],
      },
      'q1',
    )).toEqual({
      importanceEncrypted: '',
      convictionEncrypted: 'conv-1',
    });

    expect(subject.mergeQuestionRatingEnvelopeState(
      { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
      { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
      'q1',
    )).toEqual({
      importanceEncrypted: 'imp-1',
      convictionEncrypted: 'conv-2',
    });
  });

  it('normalizes decrypt slice shape and builds viewed-response decrypt baselines', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      additionalComments: null,
    }));

    expect(subject.ensureQuestionDecryptSliceShape({
      answers: { q1: { value: '*' } },
      additionalComments: null,
    })).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });

    expect(subject.buildViewedResponseDecryptBaseline(
      { questionId: 'Q1', answer: { value: '*' } },
      'q1',
    )).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });
  });

  it('builds self-response decrypt baselines from current survey state or user answers', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [null],
      userAnswers: { responses: [] },
    };
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      additionalComments: { q1: { value: '' } },
    }));

    expect(subject.buildSelfQuestionDecryptBaseline(0)).toEqual({
      baselineSlice: {
        answers: { q1: { value: '*' } },
        additionalComments: { q1: { value: '' } },
      },
      baselineForDecrypt: {
        answers: { q1: { value: '*' } },
        additionalComments: { q1: { value: '' } },
        importance: {},
        conviction: {},
      },
    });
  });

  it('derives shared decrypt display state for answer and additional fields', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      decryptingByKey: { 'q1:additional': true },
    };

    const stateWithoutLogin = subject.getQuestionFieldDisplayState({
      questionId: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: '' },
      additional: { value: '*', encrypted: true, encryptedPortion: '' },
    });

    expect(stateWithoutLogin.answerDecryptState.masked).toBe(true);
    expect(stateWithoutLogin.answerDecryptState.allowDecrypt).toBe(false);
    expect(stateWithoutLogin.additionalDecryptState.masked).toBe(true);
    expect(stateWithoutLogin.additionalDecryptState.allowDecrypt).toBe(false);
    expect(stateWithoutLogin.additionalDecryptState.busy).toBe(true);
    expect(stateWithoutLogin.decryptTooltip).toBe('Login to decrypt this encrypted field.');

    subject.props = {
      ...subject.props,
      account: '0xabc',
      loginComplete: true,
    };

    const stateWithLogin = subject.getQuestionFieldDisplayState({
      questionId: 'q1',
      answer: { value: '*', encrypted: true, encryptedPortion: '' },
      additional: { value: 'notes', encrypted: true, encryptedPortion: '' },
    });

    expect(stateWithLogin.answerDecryptState.allowDecrypt).toBe(true);
    expect(stateWithLogin.additionalDecryptState.masked).toBe(false);
    expect(stateWithLogin.hasAdditionalContent).toBe(true);
    expect(stateWithLogin.glowAnswer).toBe(true);
    expect(stateWithLogin.glowAdditional).toBe(true);
  });

  it('derives shared question response display state for full and pile render setup', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    subject.getSliderMode = jest.fn(() => 'importance');

    const displayState = subject.getQuestionResponseDisplayState({
      questionId: 'q1',
      responseSlice: {
        answers: { q1: { value: 'answer', encrypted: false } },
        additionalComments: {},
        importance: { q1: 9 },
        conviction: { q1: 3 },
      },
    });

    expect(displayState.answer.value).toBe('answer');
    expect(displayState.additional.value).toBe('');
    expect(displayState.convictionValue).toBe(3);
    expect(displayState.importanceValue).toBe(9);
    expect(displayState.hasConvictionImportanceValue).toBe(true);
    expect(displayState.sliderMode).toBe('importance');
    expect(displayState.activeSliderValue).toBe(9);
  });

  it('derives combined question render display state for shared render branches', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      decryptingByKey: { 'q1:answer': true },
    };
    subject.getSliderMode = jest.fn(() => 'conviction');

    const displayState = subject.getQuestionRenderDisplayState({
      questionId: 'q1',
      responseSlice: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: '' } },
        additionalComments: { q1: { value: 'notes', encrypted: true } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
      },
    });

    expect(displayState.answer.value).toBe('*');
    expect(displayState.additional.value).toBe('notes');
    expect(displayState.maskedAnswer).toBe(true);
    expect(displayState.maskedAdditional).toBe(false);
    expect(displayState.allowDecryptAnswer).toBe(false);
    expect(displayState.isAnswerDecrypting).toBe(true);
    expect(displayState.hasAdditionalContent).toBe(true);
    expect(displayState.glowAnswer).toBe(true);
    expect(displayState.glowAdditional).toBe(true);
    expect(displayState.sliderMode).toBe('conviction');
    expect(displayState.activeSliderValue).toBe(7);
  });

  it('derives normalized gated prompt notice ids and copy for both single and multiple gates', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    subject.resolveGatedPromptGateNames = jest.fn(() => ['Gate Alpha', 'Gate Beta']);
    expect(subject.getGatedPromptNoticeState({
      question: { id: 'Q 1' },
      tooltipIdSuffix: 'pile',
    })).toEqual({
      tooltipId: 'ce-gated-prompt-tip-q-1-pile',
      tooltipText: `Required ${t('sbt')} ${t('gates')}: Gate Alpha, Gate Beta`,
    });

    subject.resolveGatedPromptGateNames = jest.fn(() => []);
    expect(subject.getGatedPromptNoticeState({
      question: { id: '' },
      tooltipIdSuffix: 'full',
      fallbackId: 'fallback id',
    })).toEqual({
      tooltipId: 'ce-gated-prompt-tip-fallback-id-full',
      tooltipText: `${t('sbt')} ${t('gate')} required`,
    });
  });

});
