import {
  applyDecryptedQuestionResponseValues,
  applyDecryptedQuestionStateToSurveySlice,
  buildQuestionDecryptExecutionContext,
  buildQuestionDecryptFailureState,
  buildQuestionDecryptStartState,
  buildSelfQuestionDecryptBaseline,
  buildViewedResponseDecryptBaseline,
  clearQuestionFieldBusyMap,
  decryptQuestionRatingEnvelopes,
  ensureQuestionDecryptSliceShape,
  getQuestionFieldDecryptSelection,
  getQuestionFieldTaskKey,
  getQuestionFieldTaskKeys,
  getQuestionRatingEnvelopes,
  markQuestionFieldBusyMap,
  mergeLatestEncryptedQuestionFields,
  mergeQuestionRatingEnvelopeState,
  mergeQuestionResponseOverrideIntoDecryptSlice,
  syncDecryptedQuestionIntoBaseline,
} from './surveyToolDecryptFlow.js';
import {
  buildCanDecryptContext,
  evaluateCanDecryptPreCheck,
  resolveCanDecryptGateAccess,
} from './surveyToolCanDecryptController';
import { buildCanDecryptOtherResponsesState } from './surveyQuestionsTypes.js';
import { buildGatedPromptNoticeState } from './surveyToolViewState';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { t } from '../../utilities/ui/terminology.js';

const makeCanDecryptInputs = (overrides = {}) => ({
  getEffectiveDraftSlug: () => 'edge',
  resolveEffectiveSlugFromProps: jest.fn(() => 'fallback'),
  resolveEffectiveResponseGateConfig: jest.fn(() => ({})),
  getResponseGatePolicy: jest.fn(() => ({
    primaryResource: 'surveyResponses',
    recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
  })),
  account: '0xabc',
  loginComplete: true,
  singleQuestionMode: false,
  isStandalone: true,
  sbtCacheRevision: 0,
  ...overrides,
});

const buildViewedSliceFromPayload = (payload) => ({
  answers: { q1: payload?.answer || payload?.answers?.q1 || { value: '*' } },
  additionalComments: payload?.additionalComments || {},
});

// Remaining broad SurveyTool module coverage owns shared response decrypt access and shared question decrypt helper behavior.
describe('SurveyTool module', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('treats sponsored access errors as uncertain when checking response decrypt access', async () => {
    const checkAccess = jest
      .fn()
      .mockResolvedValueOnce({ status: 'error' })
      .mockResolvedValueOnce({ status: 'denied' });

    await expect(
      resolveCanDecryptGateAccess(
        {
          cfg: {},
          slug: 'edge',
          account: '0xabc',
          resourceKeysToCheck: ['surveyResponses', 'default'],
        },
        checkAccess,
      ),
    ).resolves.toEqual({
      canDecrypt: false,
      status: 'unknown',
    });

    expect(checkAccess).toHaveBeenCalledTimes(2);
    expect(buildCanDecryptOtherResponsesState({ status: 'unknown' })).toEqual({
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'unknown',
    });
  });

  it('marks response decrypt access as needs-wallet when auth is missing', async () => {
    const checkAccess = jest.fn();
    const { snapshot } = buildCanDecryptContext(
      makeCanDecryptInputs({
        account: '',
        loginComplete: false,
      }),
    );
    const preCheck = evaluateCanDecryptPreCheck(snapshot);

    expect(preCheck).toEqual({ earlyExit: true, status: 'needs-wallet' });
    expect(checkAccess).not.toHaveBeenCalled();
    expect(buildCanDecryptOtherResponsesState({ status: preCheck.status })).toEqual({
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'needs-wallet',
    });
    // port note: direct run-id/key/in-flight invalidation fields are class-private;
    // the portable contract is the early needs-wallet verdict before any gate call.
  });

  it('marks response decrypt access as no-gate when no recipients are configured', async () => {
    const checkAccess = jest.fn();
    const { snapshot } = buildCanDecryptContext(
      makeCanDecryptInputs({
        getResponseGatePolicy: jest.fn(() => ({
          primaryResource: 'surveyResponses',
          recipients: [],
        })),
      }),
    );
    const preCheck = evaluateCanDecryptPreCheck(snapshot);

    expect(preCheck).toEqual({ earlyExit: true, status: 'no-gate' });
    expect(checkAccess).not.toHaveBeenCalled();
    expect(buildCanDecryptOtherResponsesState({ status: preCheck.status })).toEqual({
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'no-gate',
    });
    // port note: direct run-id/key/in-flight invalidation fields are class-private;
    // the portable contract is the early no-gate verdict before any gate call.
  });

  it('deduplicates in-flight response decrypt access checks for the same snapshot', async () => {
    const inputs = makeCanDecryptInputs();
    const firstContext = buildCanDecryptContext(inputs);
    const secondContext = buildCanDecryptContext(inputs);

    expect(firstContext.snapshot.key).toBe(secondContext.snapshot.key);
    expect(firstContext.snapshot.key).toContain('0xabc');
    expect(evaluateCanDecryptPreCheck(firstContext.snapshot)).toEqual({ earlyExit: false });
    // port note: the old assertion inspected class-private in-flight promise fields.
    // Hooks conversion keeps the stable snapshot key as the observable dedupe input;
    // lower-level sponsoredAccessState tests own same-key in-flight request sharing.
  });

  it('normalizes shared question field task keys and decrypt busy lookups', () => {
    const busyMap = { 'q1:prompt': true, 'q1:additional': true };

    expect(getQuestionFieldTaskKey(' Q1 ', ' Prompt ')).toBe('q1:prompt');
    expect(getQuestionFieldTaskKey('q1', 'additional')).toBe('q1:additional');
    expect(getQuestionFieldTaskKey('', 'answer')).toBe('');
    expect(
      getQuestionFieldTaskKeys(' Q1 ', {
        includeAnswer: true,
        includeAdditional: true,
      }),
    ).toEqual(['q1:answer', 'q1:additional']);
    expect(
      markQuestionFieldBusyMap(
        {
          'q1:prompt': true,
        },
        ['q1:answer', '', 'q1:additional'],
      ),
    ).toEqual({
      'q1:prompt': true,
      'q1:answer': true,
      'q1:additional': true,
    });
    expect(!!busyMap[getQuestionFieldTaskKey(' Q1 ', ' prompt ')]).toBe(true);
    expect(!!busyMap[getQuestionFieldTaskKey('q1', 'additional')]).toBe(true);
    expect(!!busyMap[getQuestionFieldTaskKey('q1', 'answer')]).toBe(false);
    expect(!!busyMap[getQuestionFieldTaskKey('', 'prompt')]).toBe(false);
    expect(
      clearQuestionFieldBusyMap(
        {
          'q1:answer': true,
          'q1:additional': true,
          'q1:prompt': true,
        },
        ' Q1 ',
        'additional',
      ),
    ).toEqual({
      'q1:answer': true,
      'q1:additional': false,
      'q1:prompt': true,
    });
  });

  it('derives shared question field decrypt selection for answer and additional flows', () => {
    expect(
      getQuestionFieldDecryptSelection('q1', 'both', {
        answers: {
          q1: { value: '*', encrypted: true },
        },
        additionalComments: {
          q1: { value: '*', encryptedPortion: 'sealed' },
        },
      }),
    ).toEqual({
      maskedAnswer: true,
      maskedAdditional: true,
      hasMaskedField: true,
      clearMode: 'both',
      keysToMark: ['q1:answer', 'q1:additional'],
    });

    expect(
      getQuestionFieldDecryptSelection('q1', 'additional', {
        answers: {
          q1: { value: '*', encrypted: true },
        },
        additionalComments: {
          q1: { value: 'plain', encrypted: true },
        },
      }),
    ).toEqual({
      maskedAnswer: false,
      maskedAdditional: false,
      hasMaskedField: false,
      clearMode: '',
      keysToMark: [],
    });
  });

  it('decrypts shared question rating envelopes into numeric values', async () => {
    const decryptEnvelopeValueSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockImplementation(async (env) => {
      if (env === 'importance-env') return '7';
      if (env === 'conviction-env') return 'not-a-number';
      return null;
    });

    await expect(
      decryptQuestionRatingEnvelopes(
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
        { decryptEnvelopeValue: cryptoUtils.decryptEnvelopeValue },
      ),
    ).resolves.toEqual({
      decryptedImportance: 7,
      decryptedConviction: null,
    });

    expect(decryptEnvelopeValueSpy).toHaveBeenCalledTimes(2);
    decryptEnvelopeValueSpy.mockRestore();
  });

  it('builds shared question decrypt execution context from current props and state', () => {
    const getProviderKindSpy = jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
    const litHooks = { getKey: jest.fn() };
    const provider = { provider: true };

    expect(
      buildQuestionDecryptExecutionContext({
        baselineForDecrypt: { answers: {} },
        questionId: 'Q1',
        provider,
        account: '0xabc',
        network: { id: 84532 },
        questionPool: [{ id: 'pool-q' }],
        pileQuestions: [{ id: 'pile-q' }],
        litHooks,
        hasher: 'hash-worker',
        resolveDecryptSurveyId: () => 'survey-1',
        getProviderKind: cryptoUtils.getProviderKind,
      }),
    ).toEqual({
      providerKind: 'browser',
      chainId: 84532,
      surveyId: 'survey-1',
      questionPool: [{ id: 'pool-q' }],
      target: {
        providerKind: 'browser',
        chainId: 84532,
        surveyId: 'survey-1',
        questionId: 'q1',
        fieldToDecrypt: 'both',
      },
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
    expect(
      applyDecryptedQuestionResponseValues(
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
      ),
    ).toEqual({
      answer: { value: 'clear answer' },
      additional: { value: 'clear notes' },
      importance: 7,
      conviction: 9,
    });
  });

  it('applies shared decrypted question state onto survey response slices', () => {
    expect(
      applyDecryptedQuestionStateToSurveySlice(
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
      ),
    ).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
  });

  it('syncs shared decrypted question state back into the edit baseline', () => {
    expect(
      syncDecryptedQuestionIntoBaseline(
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
      ),
    ).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
  });

  it('merges latest encrypted question fields into the working decrypt slice', () => {
    expect(
      mergeLatestEncryptedQuestionFields(
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
      ),
    ).toEqual({
      answers: { q1: { value: '*', encrypted: true, hash: 'new-a', encryptedPortion: 'ans-env' } },
      additionalComments: { q1: { value: '*', encrypted: true, hash: 'new-b', encryptedPortion: 'add-env' } },
    });
  });

  it('builds shared decrypt start and failure state updates', () => {
    expect(
      buildQuestionDecryptStartState({ decryptingByKey: { 'q1:prompt': true } }, ['q1:answer', 'q1:additional']),
    ).toEqual({
      isDecrypting: true,
      submissionError: '',
      suppressPrefill: true,
      decryptingByKey: {
        'q1:prompt': true,
        'q1:answer': true,
        'q1:additional': true,
      },
    });

    expect(
      buildQuestionDecryptFailureState(
        { decryptingByKey: { 'q1:answer': true, 'q1:additional': true, 'q1:prompt': true } },
        'Q1',
        'additional',
        'boom',
      ),
    ).toEqual({
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
    expect(
      mergeQuestionResponseOverrideIntoDecryptSlice(
        {
          answers: { q1: { value: '*', encrypted: false } },
          additionalComments: { q1: { value: '', encrypted: false } },
        },
        'Q1',
        {
          answer: { value: '*', encryptedPortion: 'ans-env', hash: 'ans-hash' },
          additional: { value: 'notes', encrypted: true, hash: 'add-hash' },
        },
      ),
    ).toEqual({
      answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env', hash: 'ans-hash' } },
      additionalComments: { q1: { value: 'notes', encrypted: true, hash: 'add-hash' } },
    });
  });

  it('extracts and merges question rating envelope state across response sources', () => {
    expect(
      getQuestionRatingEnvelopes(
        {
          responses: [
            { questionID: 'q2', importanceEncrypted: 'skip-me' },
            { questionID: 'Q1', convictionEncrypted: 'conv-1' },
          ],
        },
        'q1',
      ),
    ).toEqual({
      importanceEncrypted: '',
      convictionEncrypted: 'conv-1',
    });

    expect(
      mergeQuestionRatingEnvelopeState(
        { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
        { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
        'q1',
      ),
    ).toEqual({
      importanceEncrypted: 'imp-1',
      convictionEncrypted: 'conv-2',
    });
  });

  it('normalizes decrypt slice shape and builds viewed-response decrypt baselines', () => {
    expect(
      ensureQuestionDecryptSliceShape({
        answers: { q1: { value: '*' } },
        additionalComments: null,
      }),
    ).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });

    expect(
      buildViewedResponseDecryptBaseline(
        { questionId: 'Q1', answer: { value: '*' } },
        'q1',
        buildViewedSliceFromPayload,
      ),
    ).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });
  });

  it('builds self-response decrypt baselines from current survey state or user answers', () => {
    expect(
      buildSelfQuestionDecryptBaseline(
        0,
        [null],
        { responses: [] },
        () => ({
          answers: { q1: { value: '*' } },
          additionalComments: { q1: { value: '' } },
        }),
        (value) => JSON.parse(JSON.stringify(value)),
      ),
    ).toEqual({
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

  it('derives normalized gated prompt notice ids and copy for both single and multiple gates', () => {
    expect(
      buildGatedPromptNoticeState({
        questionId: 'Q 1',
        tooltipIdSuffix: 'pile',
        gateNames: ['Gate Alpha', 'Gate Beta'],
        sbtLabel: t('sbt'),
        gateLabel: t('gate'),
        gatesLabel: t('gates'),
      }),
    ).toEqual({
      tooltipId: 'ce-gated-prompt-tip-q-1-pile',
      tooltipText: `Required ${t('sbt')} ${t('gates')}: Gate Alpha, Gate Beta`,
    });

    expect(
      buildGatedPromptNoticeState({
        questionId: '',
        tooltipIdSuffix: 'full',
        fallbackId: 'fallback id',
        gateNames: [],
        sbtLabel: t('sbt'),
        gateLabel: t('gate'),
        gatesLabel: t('gates'),
      }),
    ).toEqual({
      tooltipId: 'ce-gated-prompt-tip-fallback-id-full',
      tooltipText: `${t('sbt')} ${t('gate')} required`,
    });
  });
});
