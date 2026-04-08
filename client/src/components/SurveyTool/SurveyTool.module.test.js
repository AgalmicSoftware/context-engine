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
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      minifiedMode: 'pile',
    });

    subject.state = {
      ...subject.state,
      submissionComplete: false,
      isSubmitting: false,
    };
    subject.props = {
      ...subject.props,
      minifiedMode: 'pile',
      account: '0xabc',
      loginComplete: true,
      displayAnswerMode: false,
      viewAddress: '',
      singleQuestionMode: false,
      responderAddress: '',
      refreshQuestionResponses: jest.fn().mockResolvedValue(undefined),
    };
    subject.getMissingRenderedResponseIdsForAccount = jest.fn().mockResolvedValue({
      missingIds: ['q1'],
      slug: 'edge',
      netId: '84532',
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();

    const fetched = await subject.ensurePriorResponsesForRenderedIds();

    expect(fetched).toBe(true);
    expect(subject.getMissingRenderedResponseIdsForAccount).toHaveBeenCalled();
    expect(subject.props.refreshQuestionResponses).toHaveBeenCalled();
  });

  it('groups pile prior-response backfill by question session slug under list scope', async () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {},
        },
      };
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      minifiedMode: 'pile',
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      submissionComplete: false,
      isSubmitting: false,
      pileQuestions: [
        { id: 'q1', sessionSlug: 'alpha', type: 'freeform', prompt: 'Alpha prompt' },
        { id: 'q2', sessionSlug: 'beta', type: 'freeform', prompt: 'Beta prompt' },
      ],
    };
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.props = {
      ...subject.props,
      minifiedMode: 'pile',
      account: '0xabc',
      loginComplete: true,
      displayAnswerMode: false,
      viewAddress: '',
      singleQuestionMode: false,
      responderAddress: '',
      refreshQuestionResponses: jest.fn().mockResolvedValue(undefined),
    };
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn();
    subject._localCacheSliceMemo = { key: 'stale', value: null, hasValue: true };
    subject._rehydrateLocalCacheLastSig = 'stale|sig';

    const fetched = await subject.ensurePriorResponsesForRenderedIds();

    expect(fetched).toBe(true);
    expect(subject.props.refreshQuestionResponses).toHaveBeenNthCalledWith(1, ['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(subject.props.refreshQuestionResponses).toHaveBeenNthCalledWith(2, ['q2'], {
      slug: 'beta',
      responder: '0xabc',
    });
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate local-cache responses for unresolved draft slugs without a resolved network id', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
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
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { value: 'wrong-cache-answer', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          },
        },
      },
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');
    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    peekSpy.mockClear();

    expect(subject.buildSliceFromLocalCache()).toBeNull();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('does not block retry when local-cache slice is missing', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };

    subject.getCurrentRenderedQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('stable|sig');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue(null);
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject._rehydrateLocalCacheLastSig = '';

    await subject.rehydrateLocalCacheAnswersForRenderedIds();
    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.ensurePriorResponsesForRenderedIds).toHaveBeenCalledTimes(2);
    expect(subject._rehydrateLocalCacheLastSig).toBe('');
  });

  it('does not remask decrypted empty additional comments during local-cache rehydrate', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      }],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      },
    };
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'enc-1',
          hash: 'hash-1',
        },
      },
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.value).toBe('');
  });

  it('replaces masked additional value with draft decrypted-empty value when envelope matches', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      }],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'enc-1',
            hash: 'hash-1',
          },
        },
      },
    };
    subject.loadDraft = jest.fn().mockReturnValue({
      answers: {
        q1: {
          value: 'anchor-answer',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          answerEncryptedPortion: 'ans-1',
          additional: '',
          additionalEncrypted: true,
          additionalEncryptionAudience: 'gate',
          additionalEncryptedPortion: 'enc-1',
          importance: null,
          conviction: null,
        },
      },
    });
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1|masked');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: 'enc-1',
          hash: 'hash-1',
        },
      },
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('enc-1');
    expect(subject.state.editBaseline?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('enc-1');
  });

  it('replaces masked additional value when both draft/cache envelopes are missing but encrypted is true', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: '',
            hash: 'hash-1',
          },
        },
      }],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: '',
            hash: 'hash-1',
          },
        },
      },
    };
    subject.loadDraft = jest.fn().mockReturnValue({
      answers: {
        q1: {
          value: 'anchor-answer',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          answerEncryptedPortion: 'ans-1',
          additional: '',
          additionalEncrypted: true,
          additionalEncryptionAudience: 'gate',
          additionalEncryptedPortion: '',
          importance: null,
          conviction: null,
        },
      },
    });
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.buildLocalCacheHydrationSignature = jest.fn().mockReturnValue('rehydrate|q1|masked-empty-env');
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {
        q1: {
          value: '*',
          encrypted: true,
          encryptedPortion: '',
          hash: 'hash-1',
        },
      },
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.value).toBe('');
    expect(subject.state.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('');
  });

  it('parses each survey responder payload once while building survey-mode views', async () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const surveyId = 'survey-parse-once';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Perf Survey',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            '0xAa': JSON.stringify({
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            }),
            '0xBb': JSON.stringify({
              timeStamp: 20,
              responses: [
                { questionID: 'q1', answer: { value: 'b1' } },
                { questionID: 'q2', answer: { value: 'b2' } },
              ],
            }),
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 7 },
        surveysLatestBlock: 9,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = new SurveyResults({
      provider: {},
      network: { id: 84532 },
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.responses).toHaveLength(2);
    expect(subject.state.aggregateQuestionResponses.q1).toHaveLength(2);
    expect(subject.state.aggregateQuestionResponses.q2).toHaveLength(1);
  });

  it('skips survey-mode rebuild when source signature is unchanged', async () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const surveyId = 'survey-noop-signature';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Stable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            '0xAa': JSON.stringify({
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            }),
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = new SurveyResults({
      provider: {},
      network: { id: 84532 },
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).not.toHaveBeenCalled();
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('rebuilds survey-mode responses when payload changes under same metadata', async () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const surveyId = 'survey-signature-payload-change';
    const responder = '0xAa';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Mutable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            },
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = new SurveyResults({
      provider: {},
      network: { id: 84532 },
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    surveyCache['84532'].surveyResponses[surveyId][responder] = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'b1' } }],
    };

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalled();
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('b1');
  });

  it('rebuilds survey-mode responses when payload mutates deeply in place under stable refs', async () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const surveyId = 'survey-signature-deep-mutation';
    const responder = '0xAa';
    const responderPayload = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
    };
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Mutable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: responderPayload,
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = new SurveyResults({
      provider: {},
      network: { id: 84532 },
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    responderPayload.responses[0].answer.value = 'b2';

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalled();
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('b2');
  });

  it('invalidates survey source signature when toggling away from survey mode', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      provider: {},
      network: { id: 84532 },
      surveyId: '0xabc',
      viewMode: 'survey',
      isOpen: false,
    });

    subject._isMounted = true;
    subject._surveyModeSourceSignature = 'edge::84532::0xabc::stable';
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '0xabc',
      filterState: {},
    };
    subject.requestFetchResponses = jest.fn();
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    const prevProps = { ...subject.props };
    const prevState = { ...subject.state, viewMode: 'survey' };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject._surveyModeSourceSignature).toBe('');
  });

  it('invalidates question-filter question memo on nonce ticks with stable refs', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    expect(SurveyResults).toBeDefined();

    const subject = new SurveyResults({
      questionResponsesNonce: 30,
      questionsCacheNonce: 40,
    });

    const sharedQuestionResponses = {
      q1: { '0x1': { response: true } },
    };
    const sharedNetworkQuestions = {
      q1: { id: 'q1', creator: '0x1', type: 'binary', prompt: 'Q1' },
    };

    subject.state = {
      ...subject.state,
      questionResponses: sharedQuestionResponses,
    };

    const first = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    const second = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    expect(second).toBe(first);

    subject.props = { ...subject.props, questionResponsesNonce: 31 };
    const third = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    expect(third).not.toBe(second);

    subject.props = { ...subject.props, questionsCacheNonce: 41 };
    const fourth = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    expect(fourth).not.toBe(third);
  });

  it('starts and stops local storage polling idempotently', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      network: { id: 84532 },
    });

    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    subject._isMounted = true;
    subject.isDocumentHidden = jest.fn(() => false);
    subject.pollLocalStorageForUpdates = jest.fn();

    subject.startLocalStoragePolling();
    subject.startLocalStoragePolling();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(subject._localStoragePollingIntervalId).toBeTruthy();

    subject.stopLocalStoragePolling();
    subject.stopLocalStoragePolling();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(subject._localStoragePollingIntervalId).toBeNull();
  });

  it('skips surveys cache reads during question-mode polling', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      network: { id: 84532 },
    });

    const questionBucket = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 7,
      questions: { q1: { id: 'q1' } },
      questionResponses: {},
    };

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'questionsCache') return { '84532': questionBucket };
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveyResponses: {},
            surveyResponsesLatestBlock: {},
          },
        };
      }
      return {};
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
      networkLatestBlock: 0,
      questionLocalBlock: 5,
      responseLocalBlock: 7,
      surveyLocalBlock: 0,
      cachedQuestionsCount: 1,
      cachedSurveyResponsesCount: 0,
    };
    subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
    subject._lastPolledQuestionsRef = questionBucket.questions;
    subject._lastPolledSurveyResponsesRef = null;
    subject._lastPolledQuestionRefVersion = 2;
    subject._lastPolledSurveyResponsesRefVersion = 0;
    subject._lastLocalStoragePollCoarseSignature = 'questions||5|7|0|2|0';
    subject._lastLocalStoragePollDetailedSignature = 'questions||5|7|0|2|0|1|0|0';

    const changed = subject.pollLocalStorageForUpdates();

    expect(changed).toBe(false);
    const surveyCacheCalls = peekSpy.mock.calls.filter((args) => args[0] === 'surveysCache');
    expect(surveyCacheCalls).toHaveLength(0);
    peekSpy.mockRestore();
  });

  it('suppresses no-op filter activity state writes', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({});
    subject.state = {
      ...subject.state,
      isFilterActive: true,
    };
    subject.setState = jest.fn();

    subject.handleFilterActivityChange(true);
    expect(subject.setState).not.toHaveBeenCalled();

    subject.handleFilterActivityChange(false);
    expect(subject.setState).toHaveBeenCalledTimes(1);
  });

  it('suppresses no-op filter-loading state writes while still notifying parent', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const parentSetFilterLoading = jest.fn();
    const subject = new SurveyResults({
      setFilterLoading: parentSetFilterLoading,
    });
    subject.state = {
      ...subject.state,
      filterLoading: true,
    };
    subject.setState = jest.fn();

    subject.setFilterLoading(true);
    expect(subject.setState).not.toHaveBeenCalled();
    expect(parentSetFilterLoading).toHaveBeenCalledWith(true);

    subject.setFilterLoading(false);
    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(parentSetFilterLoading).toHaveBeenCalledWith(false);
  });

  it('applies rapid filter-loading flips in call order before state commits', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const parentSetFilterLoading = jest.fn();
    const subject = new SurveyResults({
      setFilterLoading: parentSetFilterLoading,
    });
    subject.state = {
      ...subject.state,
      filterLoading: false,
    };
    const queuedStateOps = [];
    subject.setState = jest.fn((next, cb) => {
      queuedStateOps.push({ next, cb });
    });

    subject.setFilterLoading(true);
    subject.setFilterLoading(false);

    expect(subject.setState).toHaveBeenCalledTimes(2);
    expect(parentSetFilterLoading).toHaveBeenNthCalledWith(1, true);
    expect(parentSetFilterLoading).toHaveBeenNthCalledWith(2, false);

    queuedStateOps.forEach(({ next, cb }) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
    });

    expect(subject.state.filterLoading).toBe(false);
  });

  it('clears response parse memo when the modal closes', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: false,
      preventUrlChange: true,
    });
    subject._isMounted = true;
    subject._responseParseMemo.set('payload', { answer: 'cached' });
    subject.stopLocalStoragePolling = jest.fn();
    subject.resetLocalStoragePollingBackoff = jest.fn();
    subject.updateLocalStoragePollingState = jest.fn();
    subject.queueResultsRefresh = jest.fn();
    subject.handleNonceTick = jest.fn();
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    const prevProps = { ...subject.props, isOpen: true };
    const prevState = { ...subject.state };
    subject.componentDidUpdate(prevProps, prevState);

    expect(subject._responseParseMemo.size).toBe(0);
  });

  it('keeps polis report download behavior while using a single state patch', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({});
    jest.useFakeTimers();
    subject.scrollToPolisReport = jest.fn();
    subject.state = {
      ...subject.state,
      exportType: 'Polis Report',
      polisReportSelected: false,
      alertMessage: '',
    };
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.downloadCSV();

    expect(subject.state.alertMessage).toBe('Generated Polis Report below.');
    expect(subject.state.polisReportSelected).toBe(true);
    expect(subject.setState).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(300);
    expect(subject.scrollToPolisReport).toHaveBeenCalledTimes(1);
  });

  it('keeps latest-block retries active when coarse polling signature is unchanged', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      network: { id: 84532 },
    });

    const questionBucket = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 7,
      questions: { q1: { id: 'q1' } },
      questionResponses: {},
    };
    const surveyBucket = {
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'questionsCache') return { '84532': questionBucket };
      if (namespace === 'surveysCache') return { '84532': surveyBucket };
      return {};
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
      networkLatestBlock: 0,
      questionLocalBlock: 5,
      responseLocalBlock: 7,
      surveyLocalBlock: 0,
      cachedQuestionsCount: 1,
      cachedSurveyResponsesCount: 0,
    };
    subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
    subject._lastPolledQuestionsRef = questionBucket.questions;
    subject._lastPolledSurveyResponsesRef = surveyBucket.surveyResponses;
    subject._lastPolledQuestionRefVersion = 2;
    subject._lastPolledSurveyResponsesRefVersion = 3;
    subject._lastLocalStoragePollCoarseSignature = 'questions||5|7|0|2|3';
    subject._lastLocalStoragePollDetailedSignature = 'questions||5|7|0|2|3|1|0|0';

    const changed = subject.pollLocalStorageForUpdates();

    expect(changed).toBe(false);
    expect(subject.maybeRefreshNetworkLatestBlockFromPolling).toHaveBeenCalledTimes(1);
    peekSpy.mockRestore();
  });

  it('detects in-place question count mutations on forced stable-cycle rescans', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      network: { id: 84532 },
    });

    const questionBucket = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 7,
      questions: { q1: { id: 'q1' } },
      questionResponses: {},
    };
    const surveyBucket = {
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'questionsCache') return { '84532': questionBucket };
      if (namespace === 'surveysCache') return { '84532': surveyBucket };
      return {};
    });

    subject._isMounted = true;
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.queueResultsRefresh = jest.fn();
    subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
      networkLatestBlock: 0,
      questionLocalBlock: 5,
      responseLocalBlock: 7,
      surveyLocalBlock: 0,
      cachedQuestionsCount: 1,
      cachedSurveyResponsesCount: 0,
    };
    subject._lastPolledQuestionsRef = questionBucket.questions;
    subject._lastPolledSurveyResponsesRef = surveyBucket.surveyResponses;
    subject._lastPolledQuestionRefVersion = 2;
    subject._lastPolledSurveyResponsesRefVersion = 3;
    subject._localStoragePollingStableCycles = 6;
    subject._lastLocalStoragePollCoarseSignature = 'questions||5|7|0|2|3';
    subject._lastLocalStoragePollDetailedSignature = 'questions||5|7|0|2|3|1|0|0';

    questionBucket.questions.q2 = { id: 'q2' };
    const changed = subject.pollLocalStorageForUpdates();

    expect(changed).toBe(true);
    expect(subject.state.cachedQuestionsCount).toBe(2);
    expect(subject.queueResultsRefresh).toHaveBeenCalledWith('poll-local-storage-change');
    peekSpy.mockRestore();
  });

  it('polls question-mode results across list scope on /session routes', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);

      const edgeBucket = {
        questionsLatestBlock: 5,
        questionResponsesLatestBlock: 7,
        questions: { q1: { id: 'q1' } },
        questionResponses: {},
      };
      const alphaBucket = {
        questionsLatestBlock: 11,
        questionResponsesLatestBlock: 13,
        questions: { q2: { id: 'q2' } },
        questionResponses: {},
      };

      const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'questionsCache') {
          if (slug === 'edge') return { '84532': edgeBucket };
          if (slug === 'alpha') return { '84532': alphaBucket };
        }
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace === 'surveysCache') {
          return {
            '84532': {
              surveyResponses: {},
              surveyResponsesLatestBlock: {},
            },
          };
        }
        return {};
      });

      const subject = new SurveyResults({
        isOpen: true,
        activeSessionSlug: 'edge',
        network: { id: 84532 },
      });
      subject._isMounted = true;
      syncClassSetState(subject);
      subject.queueResultsRefresh = jest.fn();
      subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
        surveyId: '',
        networkLatestBlock: 0,
        questionLocalBlock: 5,
        responseLocalBlock: 7,
        surveyLocalBlock: 0,
        cachedQuestionsCount: 1,
        cachedSurveyResponsesCount: 0,
      };

      const changed = subject.pollLocalStorageForUpdates();

      expect(changed).toBe(true);
      expect(subject.state.questionLocalBlock).toBe(11);
      expect(subject.state.responseLocalBlock).toBe(13);
      expect(subject.state.cachedQuestionsCount).toBe(2);
      expect(subject.queueResultsRefresh).toHaveBeenCalledWith('poll-local-storage-change');
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy.mock.calls.filter((args) => args[0] === 'surveysCache')).toHaveLength(0);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('resolves locked-response gate labels against each question session in aggregated results', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const gateSbt = '0x9999999999999999999999999999999999999999';
    const displaySpy = jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel')
      .mockImplementation(({ preferredSlug, address }) => `${preferredSlug}:${address}`);

    const subject = new SurveyResults({
      activeSessionSlug: 'edge',
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
    };

    const details = subject.buildLockedGateDetails(
      [{ questionId: 'q2' }],
      {
        q2: {
          id: 'q2',
          sessionSlug: 'alpha',
          encryption: {
            enabled: true,
            gates: [{ label: 'Alpha Gate', sbtAddress: gateSbt }],
          },
        },
      }
    );

    expect(details).toEqual({
      gateDetails: [
        {
          address: gateSbt,
          label: `alpha:${gateSbt}`,
          href: buildSbtDetailPath(gateSbt, 'alpha'),
        },
      ],
      hasGenericGateMessage: false,
    });
    expect(displaySpy).toHaveBeenCalledWith(expect.objectContaining({
      address: gateSbt,
      preferredSlug: 'alpha',
      chainId: 84532,
      fallback: 'short',
    }));
  });

  it('coalesces queued results refreshes into one fetch request per tick', async () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      network: { id: 84532 },
    });
    subject._isMounted = true;
    subject.requestFetchResponses = jest.fn();
    subject.isDocumentHidden = jest.fn(() => true);

    subject.queueResultsRefresh('a');
    subject.queueResultsRefresh('b');
    subject.queueResultsRefresh('c');
    await Promise.resolve();

    expect(subject.requestFetchResponses).toHaveBeenCalledTimes(1);
  });

  it('drops queued RAF refresh when the results modal closes before frame flush', async () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      network: { id: 84532 },
    });
    const rafCallbacks = [];
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

    subject._isMounted = true;
    subject.requestFetchResponses = jest.fn();
    subject.shouldUseAnimationFrameForRefreshCoalescing = jest.fn(() => true);

    subject.queueResultsRefresh('queued-while-open');
    await Promise.resolve();

    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(rafCallbacks).toHaveLength(1);

    subject.props = { ...subject.props, isOpen: false };
    rafCallbacks[0]();

    expect(subject.requestFetchResponses).not.toHaveBeenCalled();
    expect(subject._queuedResultsRefreshReasons.size).toBe(0);
  });

  it('backs off polling from 2s to 4s to 12s and resets after a detected change', () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      network: { id: 84532 },
    });

    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    let pollCount = 0;
    subject._isMounted = true;
    subject.isDocumentHidden = jest.fn(() => false);
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      pollCount += 1;
      return pollCount === 3;
    });

    subject.startLocalStoragePolling(); // 2000
    jest.advanceTimersByTime(2000); // schedules 4000
    jest.advanceTimersByTime(4000); // schedules 12000
    jest.advanceTimersByTime(12000); // change detected -> schedules 2000

    const delays = setTimeoutSpy.mock.calls.map((args) => Number(args[1]));
    expect(delays).toContain(2000);
    expect(delays).toContain(4000);
    expect(delays).toContain(12000);
    expect(delays[delays.length - 1]).toBe(2000);
  });

  it('coalesces rapid nonce ticks to at most one queued rerun', async () => {
    const SurveyResults = ConnectedSurveyResults.WrappedComponent;
    const subject = new SurveyResults({
      isOpen: true,
      provider: {},
      network: { id: 84532 },
      questionResponsesNonce: 1,
    });

    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.pollLocalStorageForUpdates = jest.fn();
    subject.requestFetchResponses = jest.fn();
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    const first = createDeferred();
    let inFlight = 0;
    let maxInFlight = 0;
    const latestSpy = jest
      .spyOn(contractScripts, 'getLatestBlockNumber')
      .mockImplementationOnce(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return first.promise.finally(() => {
          inFlight -= 1;
        });
      })
      .mockImplementationOnce(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return Promise.resolve(102).finally(() => {
          inFlight -= 1;
        });
      });

    const firstRunPromise = subject.handleNonceTick();
    subject.handleNonceTick();
    subject.handleNonceTick();
    expect(latestSpy).toHaveBeenCalledTimes(1);

    first.resolve(101);
    await firstRunPromise;

    expect(latestSpy).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
    expect(subject.pollLocalStorageForUpdates).toHaveBeenCalledTimes(2);
    expect(subject.requestFetchResponses).toHaveBeenCalledTimes(2);
  });

  it('uses clone-free questions cache reads in SurveyQuestions.handleFilter', () => {
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questionResponses: {
              q1: {
                '0xaa': '{"type":"binary","answer":{"value":"yes"}}',
              },
            },
          },
        };
      }
      return {};
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: [],
      pileQuestions: [],
      activePileIndex: 0,
      filterState: {},
      hasHiddenGatedQuestions: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.handleFilter([{ id: 'q1', type: 'binary', prompt: 'Q1' }], {});

    const questionCacheCalls = peekSpy.mock.calls.filter((args) => args[0] === 'questionsCache');
    expect(questionCacheCalls.length).toBeGreaterThan(0);
    expect(questionCacheCalls.some((args) => args[2]?.clone === false)).toBe(true);
  });

  it('avoids redundant pile wrapper state updates when answering', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.handleAnswer = jest.fn();
    subject.setState = jest.fn();

    subject.handleAnswerPile('q1', 'value');

    expect(subject.handleAnswer).toHaveBeenCalledWith(0, 'q1', 'value', {});
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('passes cache-backed question responses into pile filters so responded status works in embedded pile mode', () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': { answer: { value: 'yes' } },
            },
          },
        },
      };
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      sessionSlug: 'edge',
      questionResponsesNonce: 2,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleQuestions = [
      { id: 'q1', type: 'binary', prompt: 'Q1' },
      { id: 'q2', type: 'binary', prompt: 'Q2' },
    ];

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: visibleQuestions,
      pileQuestions: visibleQuestions,
      activePileIndex: 0,
      filterModalOpen: true,
      loading: false,
      showHologramAssistant: false,
    };

    const tree = subject.render();
    const questionFilterNode = findElement(
      tree,
      (node) =>
        node?.props?.onFilter === subject.handleFilter &&
        node?.props?.currentViewModeForUrl === 'questions'
    );

    expect(questionFilterNode).toBeTruthy();
    expect(questionFilterNode.props.questionResponses).toEqual({
      q1: {
        '0xabc': { answer: { value: 'yes' } },
      },
    });

    const filterSubject = new RawQuestionFilter({
      ...questionFilterNode.props,
      account: '0xabc',
    });
    filterSubject.state = {
      ...filterSubject.state,
      filterByResponded: true,
      filterByNotResponded: false,
    };

    const filtered = filterSubject.getQuestionsSubsetBeforeAi();

    expect(filtered.map((question) => question.id)).toEqual(['q1']);
  });

  it('does not borrow general response or filter config in pile filters when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
      BLOCKED_QUESTION_IDS: ['q-blocked'],
      HIGHLIGHTED_QUESTION_IDS: ['q1'],
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
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': { answer: { value: 'yes' } },
            },
          },
        },
      };
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '0xabc',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      questionResponsesNonce: 2,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleQuestions = [
      { id: 'q2', type: 'binary', prompt: 'Q2' },
      { id: 'q1', type: 'binary', prompt: 'Q1' },
      { id: 'q_blocked', type: 'binary', prompt: 'Blocked Q' },
    ];

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: visibleQuestions,
      pileQuestions: visibleQuestions,
      activePileIndex: 0,
      filterModalOpen: true,
      loading: false,
      showHologramAssistant: false,
      filterState: {},
      hasHiddenGatedQuestions: false,
    };
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    syncClassSetState(subject);
    peekSpy.mockClear();

    const tree = subject.render();
    const questionFilterNode = findElement(
      tree,
      (node) =>
        node?.props?.onFilter === subject.handleFilter &&
        node?.props?.currentViewModeForUrl === 'questions'
    );

    expect(questionFilterNode).toBeTruthy();
    expect(questionFilterNode.props.questionResponses).toEqual({});
    expect(peekSpy).not.toHaveBeenCalled();

    subject.handleFilter(visibleQuestions, {});

    expect(subject.state.pileQuestions.map((question) => question.id)).toEqual(['q2', 'q1', 'q_blocked']);
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('clamps pile rating answers into the supported slider range and guards non-numeric values', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const question = { id: 'q1', type: 'rating', prompt: 'Rate this' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Rate this');
    subject.state = {
      ...subject.state,
      showComments: {},
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '7', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    let tree = subject.renderActiveQuestion(question);
    let slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(7);
    expect(nodeHasClassName(slider, styles.ratingSlider)).toBe(true);
    expect(typeof slider.props.onChangeComplete).toBe('function');
    expect(treeHasText(tree, '7')).toBe(true);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: { q1: { value: '14', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    tree = subject.renderActiveQuestion(question);
    slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(10);
    expect(treeHasText(tree, '10')).toBe(true);

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: { q1: { value: 'abc', encrypted: false } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    tree = subject.renderActiveQuestion(question);
    slider = findElement(tree, (node) => (
      node?.props?.min === 0 &&
      node?.props?.max === 10 &&
      node?.props?.step === 1 &&
      node?.props?.value !== undefined &&
      typeof node?.props?.onChange === 'function'
    ));
    expect(slider).not.toBeNull();
    expect(slider.props.value).toBe(0);
    expect(nodeHasClassName(slider, styles.ratingSlider)).toBe(true);
    expect(treeHasText(tree, '0')).toBe(true);
  });

  it('renders pile additional comments without the extra header and keeps the lock beside the field', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const question = { id: 'q1', type: 'freeform', prompt: 'Prompt' };

    subject.renderPromptWithManualDecrypt = jest.fn(() => 'Prompt');
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.state = {
      ...subject.state,
      showComments: { q1: true },
      showConviction: {},
      surveysResponseState: [
        {
          answers: { q1: { value: '', encrypted: false } },
          additionalComments: { q1: { value: '', encrypted: false, encryptionAudience: 'self' } },
          importance: {},
          conviction: {},
        },
      ],
    };

    const tree = subject.renderActiveQuestion(question);
    const inlineRow = findNodeByClassName(tree, styles.additionalCommentsInlineRow);
    const rowChildren = getElementChildren(inlineRow);
    const inputNode = findElement(
      rowChildren[0],
      (node) => node?.props?.dataTestId === E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT
    );

    expect(inlineRow).not.toBeNull();
    expect(findNodeByClassName(tree, styles.additionalCommentsHeader)).toBeNull();
    expect(treeHasText(tree, 'Additional comments')).toBe(false);
    expect(rowChildren).toHaveLength(2);
    expect(nodeHasClassName(rowChildren[0], styles.additionalCommentsInputWrap)).toBe(true);
    expect(nodeHasClassName(rowChildren[1], styles.additionalCommentsLockSlot)).toBe(true);
    expect(inputNode).not.toBeNull();
    expect(inputNode.props.placeholder).toBe('Additional comments...');
    expect(treeHasDataTestId(rowChildren[1], E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK)).toBe(true);
  });

  it('does not call getPendingEditStats during PileViewMode.render', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.getPendingEditStats = jest.fn(() => ({ total: 7, encrypted: 2 }));
    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      filterState: {},
      modifiedCount: 2,
      encryptedModifiedCount: 1,
      submittedSinceLastEdit: false,
      submissionComplete: false,
    };

    subject.render();

    expect(subject.getPendingEditStats).not.toHaveBeenCalled();
  });

  it('keeps the pile action container neutral while only the filter button gets the active class', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
      onViewAllClick: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.renderActiveQuestion = jest.fn(() => null);
    subject.isMaskedPromptText = jest.fn(() => false);
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: true,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

    const tree = subject.render();
    const actionsNode = findNodeByClassName(tree, 'pileActions');
    const filterButton = findElement(tree, (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_FILTER_TOGGLE);
    const createButton = findElement(tree, (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_CREATE_TOGGLE_PILE);
    const viewAllButton = findElement(tree, (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_VIEW_ALL);

    expect(actionsNode).not.toBeNull();
    expect(nodeHasClassName(actionsNode, 'pileActionsActive')).toBe(false);
    expect(filterButton).not.toBeNull();
    expect(nodeHasClassName(filterButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(filterButton, 'actionButtonActive')).toBe(true);
    expect(filterButton.props.style).toEqual(expect.objectContaining({
      color: '#4cd964',
      borderColor: '#4cd964',
      opacity: 0.75,
    }));
    expect(createButton).not.toBeNull();
    expect(nodeHasClassName(createButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(createButton, 'actionButtonActive')).toBe(false);
    expect(viewAllButton).not.toBeNull();
    expect(nodeHasClassName(viewAllButton, 'actionButton')).toBe(true);
    expect(nodeHasClassName(viewAllButton, 'actionButtonActive')).toBe(false);
  });

  it('renders the pile mini spinner as a sibling of the controls stack during background refresh', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
      onViewAllClick: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];

    subject.renderActiveQuestion = jest.fn(() => null);
    subject.isMaskedPromptText = jest.fn(() => false);
    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: visibleList,
      allQuestionsForFilter: visibleList,
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: false,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      isHydratingPriorResponses: false,
    };

    const tree = subject.render();
    const interactionNode = findNodeByClassName(tree, 'pileInteractionUnit');
    const controlsNode = findNodeByClassName(tree, 'pileControls');
    const spinnerNode = findNodeByClassName(tree, 'miniSpinnerWrapper');
    const interactionChildClasses = getElementChildren(interactionNode).map((child) => child?.props?.className);

    expect(interactionNode).not.toBeNull();
    expect(controlsNode).not.toBeNull();
    expect(spinnerNode).not.toBeNull();
    expect(interactionChildClasses).toEqual(expect.arrayContaining([
      'miniSpinnerWrapper',
      'pileCardContainer',
      'pileControls',
    ]));
    expect(findNodeByClassName(controlsNode?.props?.children, 'miniSpinnerWrapper')).toBeNull();
  });

  it('passes the delayed pile-entry mode toggle prop into the pile create panel', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      showCreate: true,
      filterModalOpen: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

    const tree = subject.render();
    const createSurveyNode = findElement(
      tree,
      (node) => node?.props?.hideSurveyQuestionToggleUntilAuthoring === true
    );

    expect(createSurveyNode).not.toBeNull();
  });

  it('keeps masked visibility memo hot when alternating stable pool references', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const poolA = [{ id: 'qa', prompt: 'A', promptDecrypted: false }];
    const poolB = [{ id: 'qb', prompt: 'B', promptDecrypted: false }];
    subject.isMaskedPromptText = jest.fn(() => false);

    const firstA = subject.getMemoizedMaskedQuestionVisibility(poolA, false);
    const firstB = subject.getMemoizedMaskedQuestionVisibility(poolB, false);
    const secondA = subject.getMemoizedMaskedQuestionVisibility(poolA, false);

    expect(firstA).toBe(secondA);
    expect(firstB).not.toBe(firstA);
    expect(subject.isMaskedPromptText).toHaveBeenCalledTimes(2);
  });

  it('reuses current pile signature path on repeated identical filters', () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questionResponses: {},
          },
        };
      }
      return {};
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);
    const visibleList = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];

    subject.state = {
      ...subject.state,
      allQuestionsForFilter: visibleList,
      pileQuestions: visibleList,
      activePileIndex: 0,
      filterState: {},
      hasHiddenGatedQuestions: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.syncCurrentPileQuestionsSignature(visibleList);
    const signatureSpy = jest.spyOn(subject, 'buildQuestionListSignature');
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.handleFilter(visibleList, {});
    subject.handleFilter(visibleList, {});

    expect(subject.setState).not.toHaveBeenCalled();
    expect(signatureSpy).toHaveBeenCalledTimes(2);
  });

  it('does not replay pile hydration on nonce-only ticks when question signatures are unchanged', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Q1' },
        },
        questionResponses: {
          q1: {},
        },
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();
    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);

    subject.props = {
      ...subject.props,
      questionResponsesNonce: subject.props.questionResponsesNonce + 1,
      questionsCacheNonce: subject.props.questionsCacheNonce + 1,
    };
    await subject.loadAndSortQuestions();

    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledTimes(1);
  });

  it('keeps pile loading active during early empty-cache settle before showing a definitive empty state', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(true);
    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalled();

    subject._emptyReadyProbeStartedAtMs = Date.now() - 25000;
    subject.scheduleLoadAndSortQuestions.mockClear();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();
  });

  it('keeps unanswered questions visible in pile mode when response map is empty', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Unanswered prompt' },
        },
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(Array.isArray(subject.state.pileQuestions)).toBe(true);
    expect(subject.state.pileQuestions.map((q) => String(q.id))).toEqual(['q1']);
    expect(subject.state.allQuestionsForFilter.map((q) => String(q.id))).toEqual(['q1']);
    expect(subject.state.hasHiddenGatedQuestions).toBe(false);
  });

  it('settles stuck hydrate 0/0 empty piles into deterministic no-questions state', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 0,
        hydratedQuestions: 0,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();

    const tree = subject.render();
    expect(treeHasText(tree, 'No questions available.')).toBe(true);
    expect(treeHasText(tree, 'Loading Metadata')).toBe(false);
  });

  it('settles scan 0/0 empty piles into deterministic no-questions state for newly created sessions', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 0,
        requestedTotalBlocks: 0,
        scannedBlocks: 0,
        remainingBlocks: 0,
        discoveredQuestions: 0,
        hydratedQuestions: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const PileViewModeClass = pileElement.type;
    const subject = new PileViewModeClass(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(false);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();

    const tree = subject.render();
    expect(treeHasText(tree, 'No questions available.')).toBe(true);
    expect(treeHasText(tree, 'Loading...')).toBe(false);
  });

  it('shows a filtered empty state instead of full loading when filters remove all visible pile cards', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
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
