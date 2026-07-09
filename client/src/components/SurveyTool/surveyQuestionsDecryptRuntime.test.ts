import { createSurveyQuestionsDecryptRuntime } from './surveyQuestionsDecryptRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  buildAutoDecryptMaskedFieldSignatureHelper: jest.fn((field) => `masked:${field}`),
  buildClearedQuestionDecryptBusyTokensHelper: jest.fn(({ busyTokens, keysToClear, token }) => {
    const next = { ...(busyTokens || {}) };
    keysToClear.forEach((key: string) => {
      if (token == null || next[key] === token) delete next[key];
    });
    return next;
  }),
  buildDecryptContextKeyFromContext: jest.fn(
    (snapshot) =>
      `${snapshot.account}|${snapshot.providerKind}|${snapshot.sessionSlug}|${snapshot.networkID}|${snapshot.responder}`,
  ),
  buildDecryptTaskKeyHelper: jest.fn(() => 'task:q1:answer'),
  buildQuestionDecryptBusyTokenRegistrationHelper: jest.fn(({ tokenSeq, busyTokens, keysToMark }) => {
    const token = Number(tokenSeq || 0) + 1;
    const next = { ...(busyTokens || {}) };
    keysToMark.forEach((key: string) => {
      next[key] = token;
    });
    return { busyTokens: next, token };
  }),
  buildQuestionDecryptExecutionContextHelper: jest.fn((value) => value),
  buildQuestionDecryptFailureStateHelper: jest.fn(() => ({ submissionError: 'failed' })),
  buildQuestionDecryptOwnedClearStateHelper: jest.fn(({ busyTokens, keysToClear, token, extraPatch }) => {
    const next = { ...(busyTokens || {}) };
    (keysToClear || []).forEach((key: string) => {
      if (token == null || next[key] === token) delete next[key];
    });
    return { busyTokens: next, statePatch: { ...extraPatch, decryptingByKey: next } };
  }),
  buildQuestionDecryptStartStateHelper: jest.fn(() => ({ isDecrypting: true })),
  buildSelfQuestionDecryptBaselineHelper: jest.fn(() => ({ answers: { q1: { value: 'self' } } })),
  buildSelfQuestionDecryptSuccessStateHelper: jest.fn(() => ({ self: true })),
  buildSliceFromUserAnswers: jest.fn(() => ({ answers: { q1: { value: 'draft' } } })),
  buildSurveyDecryptExecutionContextHelper: jest.fn((value) => value),
  buildSurveyDecryptSourceStateHelper: jest.fn(() => ({ answers: { q1: { value: 'source' } } })),
  buildSurveyDecryptSuccessStateHelper: jest.fn(() => ({ survey: true })),
  buildViewedResponseDecryptBaselineHelper: jest.fn(() => ({ answers: { q1: { value: 'viewed' } } })),
  buildViewedResponseDecryptSuccessStateHelper: jest.fn(() => ({ viewed: true })),
  cryptoUtils: {
    decryptEnvelopeValue: jest.fn(),
    decryptMultipleAnswers: jest.fn(),
    decryptSingleField: jest.fn(),
    getProviderKind: jest.fn(() => 'injected'),
  },
  decryptQuestionRatingEnvelopeMapHelper: jest.fn(async () => ({ q1: { rating: true } })),
  decryptQuestionRatingEnvelopesHelper: jest.fn(async () => ({ rating: true })),
  deepClone: jest.fn((value) => JSON.parse(JSON.stringify(value))),
  finalizeQuestionDecryptAttemptHelper: jest.fn(async () => ({ didUpdate: true })),
  finalizeSurveyDecryptAttemptHelper: jest.fn(async () => ({ didUpdate: true })),
  getLatestQuestionResponse: jest.fn(async () => ({ answer: { value: 'latest' } })),
  getQuestionFieldDecryptSelectionHelper: jest.fn(() => ({ answer: { encrypted: true } })),
  getQuestionFieldTaskKeyHelper: jest.fn((qid, field) => `${qid}:${field}`),
  getSurveyResponse: jest.fn(async () => ({ responses: [{ questionID: 'q1' }] })),
  getViewedResponseOverrideForQuestion: jest.fn(() => null),
  hydrateLatestQuestionDecryptStateHelper: jest.fn(async () => ({ hydrated: true })),
  inst: {
    _activeSurveyDecryptAttemptSeq: 0,
    _decryptFieldTaskInFlight: new Map(),
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _isMounted: true,
    _questionDecryptBusyTokenSeq: 0,
    _questionDecryptBusyTokens: {},
    _queuedAutoDecryptSweepReasons: new Set(),
    _surveyDecryptAttemptSeq: 0,
  },
  isAutoDecryptBlocked: jest.fn(() => false),
  maybeAutoDecryptVisibleFields: jest.fn(),
  mergeLatestEncryptedQuestionFieldsHelper: jest.fn(() => ({ merged: true })),
  mergeQuestionRatingEnvelopeStateHelper: jest.fn(() => ({ ratingMerged: true })),
  mergeQuestionResponseOverrideIntoDecryptSliceHelper: jest.fn(() => ({ override: true })),
  normalizeBulkDecryptedSliceForSurveyStateHelper: jest.fn(() => ({ normalized: true })),
  normalizeSessionSlugValue: jest.fn((value) =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
  normalizeSingleQuestionViewedResponseHelper: jest.fn((value) => value || null),
  ownsQuestionDecryptBusyTokensHelper: jest.fn(({ busyTokens, keysToCheck, token }) =>
    keysToCheck.every((key: string) => busyTokens?.[key] === token),
  ),
  prepareQuestionDecryptAttemptHelper: jest.fn(() => ({ prepared: true })),
  prepareSelfQuestionDecryptStateHelper: jest.fn(() => ({ selfPrepared: true })),
  prepareSurveyDecryptAttemptHelper: jest.fn(async () => ({ surveyPrepared: true })),
  prepareViewedQuestionDecryptStateHelper: jest.fn(async () => ({ viewedPrepared: true })),
  propsRef: {
    current: {
      account: '0xabc',
      isStandalone: false,
      lit: { saveKey: jest.fn() },
      loginComplete: true,
      network: { chainId: 11155420 },
      provider: { id: 'provider' },
      questionID: 'q1',
      responderAddress: '0xdef',
      singleQuestionMode: false,
      surveyId: 'survey-1',
      surveyIndex: 3,
      viewAddress: '',
    },
  },
  readQuestionsCache: jest.fn(() => ({ cached: true })),
  resolveDecryptHydrationContext: jest.fn(() => ({
    networkIdStr: '11155420',
    sessionSlug: 'edge',
  })),
  resolveDecryptSurveyId: jest.fn(() => 'survey-1'),
  resolveEffectiveSlug: jest.fn(() => 'edge'),
  resolveLatestSurveyDecryptResponseHelper: jest.fn(async (_options, ports) => ({
    latestQuestion: await ports.getLatestQuestionResponse({ provider: true }, '0xabc', 'q1', 'edge'),
    latestSurvey: await ports.getLatestSurveyResponse('0xabc', 'survey-1'),
  })),
  resolveQuestionDecryptHandlingModeHelper: jest.fn(() => 'self'),
  runDedupedDecryptTaskHelper: jest.fn((_map, _key, runner) => runner()),
  scheduleMicrotask: jest.fn((cb) => cb()),
  stateRef: {
    current: {
      decryptingByKey: {
        'q1:answer': true,
      },
      hasher: { id: 'hasher' },
      pileQuestions: [],
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [{ answers: { q1: { value: 'Yes' } } }],
      userAnswers: { responses: [] },
    },
  },
  surveyLog: {
    warn: jest.fn(),
  },
  surveyQuestionReadsPort: {
    getResponse: jest.fn(async () => ({ answer: { value: 'latest' } })),
  },
  syncDecryptedQuestionIntoBaselineHelper: jest.fn(() => ({ synced: true })),
  ...overrides,
});

describe('surveyQuestionsDecryptRuntime', () => {
  it('builds decrypt context snapshots and keys from current props', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDecryptRuntime(context);

    const snapshot = runtime.buildDecryptContextSnapshot();

    expect(snapshot).toEqual(
      expect.objectContaining({
        account: '0xabc',
        networkID: '11155420',
        providerKind: 'injected',
        responder: '0xdef',
        sessionSlug: 'edge',
        surveyIndex: 3,
      }),
    );
    expect(runtime.buildDecryptContextKey(snapshot)).toBe('0xabc|injected|edge|11155420|0xdef');
    expect(runtime.isDecryptContextCurrent(snapshot)).toBe(true);
  });

  it('tracks question decrypt busy tokens by owner', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDecryptRuntime(context);

    const token = runtime.registerQuestionDecryptBusyTokens(['q1:answer']);

    expect(token).toBe(1);
    expect(context.inst._questionDecryptBusyTokens).toEqual({ 'q1:answer': 1 });
    expect(runtime.ownsQuestionDecryptBusyTokens(['q1:answer'], 1)).toBe(true);
    runtime.clearQuestionDecryptBusyTokens(['q1:answer'], 2);
    expect(context.inst._questionDecryptBusyTokens).toEqual({ 'q1:answer': 1 });
    runtime.clearQuestionDecryptBusyTokens(['q1:answer'], 1);
    expect(context.inst._questionDecryptBusyTokens).toEqual({});
  });

  it('builds task keys with responder and decrypt context ownership', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDecryptRuntime(context);

    expect(runtime.getQuestionFieldTaskKey('q1', 'answer')).toBe('q1:answer');
    expect(runtime.isQuestionFieldBusy('q1', 'answer')).toBe(true);
    expect(runtime.buildDecryptTaskKey('self', 'q1', 'answer')).toBe(
      'task:q1:answer|0xabc|injected|edge|11155420|0xdef',
    );
    expect(context.buildDecryptTaskKeyHelper).toHaveBeenCalledWith('self', 'q1', 'answer', null, '0xdef');
  });

  it('delegates rating envelope decrypt helpers with crypto and warning ports', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDecryptRuntime(context);

    await expect(runtime.decryptQuestionRatingEnvelopes({ q1: { encrypted: true } })).resolves.toEqual({
      rating: true,
    });

    expect(context.decryptQuestionRatingEnvelopesHelper).toHaveBeenCalledWith(
      { q1: { encrypted: true } },
      {},
      expect.objectContaining({
        decryptEnvelopeValue: context.cryptoUtils.decryptEnvelopeValue,
        logWarn: expect.any(Function),
      }),
    );
  });

  it('resolves latest survey decrypt responses through injected read ports', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDecryptRuntime(context);

    await expect(runtime.resolveLatestSurveyDecryptResponse({ questionId: 'q1' })).resolves.toEqual({
      latestQuestion: { answer: { value: 'latest' } },
      latestSurvey: { responses: [{ questionID: 'q1' }] },
    });
    expect(context.resolveLatestSurveyDecryptResponseHelper).toHaveBeenCalled();
    expect(context.surveyQuestionReadsPort.getResponse).toHaveBeenCalledWith({ provider: true }, '0xabc', 'q1', 'edge');
    expect(context.getSurveyResponse).toHaveBeenCalledWith('0xabc', 'survey-1');
  });
});
