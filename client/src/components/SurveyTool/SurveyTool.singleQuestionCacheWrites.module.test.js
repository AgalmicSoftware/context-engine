import SurveyTool from './SurveyTool';
import {
  executeViewedSingleQuestionResponseBootstrap,
  writeSingleQuestionResponseToCache,
} from './surveyToolSingleQuestionController';
import {
  buildViewedResponseDecryptBaseline,
  buildViewedResponseDecryptSuccessState,
  finalizeQuestionDecryptAttempt,
  getQuestionFieldDecryptSelection,
  hydrateLatestQuestionDecryptState,
  mergeLatestEncryptedQuestionFields,
  mergeQuestionRatingEnvelopeState,
  prepareSelfQuestionDecryptState,
  prepareViewedQuestionDecryptState,
  resolveQuestionDecryptHandlingMode,
} from './surveyToolDecryptFlow';
import contractScripts, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

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

const clone = (value) => JSON.parse(JSON.stringify(value));

const applyStateUpdate = (stateRef, update) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  stateRef.current = { ...stateRef.current, ...(patch || {}) };
  return patch;
};

const ensureQuestionsNetForTest = (cache, netId) => {
  const next = clone(cache || {});
  next[netId] = next[netId] || {};
  return next;
};

const buildViewedSliceFromPayload = (payload) => ({
  answers: {
    q1: payload?.answer || {},
  },
  additionalComments: {
    q1: payload?.additional || {},
  },
  importance: {},
  conviction: {},
});

const hydrateWithLatestQuestionResponse = ({
  getLatestQuestionResponse,
  readQuestionsCache = jest.fn(() => ({ cached: true })),
} = {}) => (args) => hydrateLatestQuestionDecryptState(args, {
  getQuestionFieldDecryptSelection,
  readQuestionsCache,
  getLatestQuestionResponse,
  mergeLatestEncryptedQuestionFields,
  mergeQuestionRatingEnvelopeState,
  logWarn: jest.fn(),
});

describe('SurveyTool single-question cache writes and decrypts', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('re-reads fresh cache before ensureQuestionCached write-through to avoid clobbering parallel inserts', async () => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const staleCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    };
    const freshCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {
          q2: { id: 'q2', type: 'freeform', prompt: 'Already cached', creator: '0xbbb', tags: [] },
        },
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    };
    let readCount = 0;
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace !== 'questionsCache') return null;
      readCount += 1;
      return readCount === 1 ? clone(staleCache) : clone(freshCache);
    });
    const atomicSpy = jest.spyOn(cacheScripts, 'updateCacheAtomic').mockImplementation(async (_namespace, _slug, updater) => (
      updater(clone(freshCache))
    ));
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'freeform',
      prompt: 'Fetched question',
      creator: '0xaaa',
      tags: ['tag-1'],
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
    });
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await subject.ensureQuestionCached('q1');

    expect(atomicSpy).toHaveBeenCalled();
    const written = await atomicSpy.mock.results[0].value;
    expect(written['84532'].questions.q2).toEqual(expect.objectContaining({ id: 'q2' }));
    expect(written['84532'].questions.q1).toEqual(expect.objectContaining({ id: 'q1' }));
  });

  it('uses global Lit hooks when ensureQuestionCached builds decrypt context without scoped props', async () => {
    const litHooks = { getKey: jest.fn() };
    const previousLitHooks = window.__litHooks;
    window.__litHooks = litHooks;
    const emptyQuestionsCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    };
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'questionsCache' ? emptyQuestionsCache : null
    ));
    jest.spyOn(cacheScripts, 'updateCacheAtomic').mockImplementation(async (_namespace, _slug, updater) => (
      updater(emptyQuestionsCache)
    ));
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'freeform',
      prompt: 'Fetched question',
      creator: '0xaaa',
      tags: [],
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
    });
    syncClassSetState(subject);

    try {
      await subject.ensureQuestionCached('q1');

      expect(getQuestionDataSpy).toHaveBeenCalledWith(
        {},
        'q1',
        'edge',
        {
          decryptContext: expect.objectContaining({
            chainId: 84532,
            litHooks,
            litOpts: { getKey: litHooks.getKey },
          }),
        }
      );
    } finally {
      if (previousLitHooks === undefined) {
        delete window.__litHooks;
      } else {
        window.__litHooks = previousLitHooks;
      }
    }
  });

  it('does not write ensureQuestionCached payloads into a borrowed general network cache when the slug is unresolved', async () => {
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          qGeneral: { id: 'qGeneral', type: 'freeform', prompt: 'Borrowed general prompt' },
        },
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    });
    const atomicSpy = jest.spyOn(cacheScripts, 'updateCacheAtomic');
    const getQuestionDataSpy = jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue({
      id: 'q1',
      type: 'freeform',
      prompt: 'Fetched question',
      creator: '0xaaa',
      tags: ['tag-1'],
    });

    const subject = new SurveyTool({
      provider: {},
      activeSessionSlug: 'missing-session-slug',
      sessionSlug: 'missing-session-slug',
      cacheHasLoaded: true,
    });
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await subject.ensureQuestionCached('q1');

    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(getQuestionDataSpy).not.toHaveBeenCalled();
    expect(atomicSpy).not.toHaveBeenCalled();
  });

  it('does not write updateCache state into a borrowed general network cache when the slug is unresolved', () => {
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

    const subject = new SurveyTool({
      activeSessionSlug: 'missing-session-slug',
      sessionSlug: 'missing-session-slug',
      cacheHasLoaded: true,
    });
    syncClassSetState(subject);

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        surveysLatestBlock: 0,
        surveys: {
          surveyGeneral: {
            id: 'surveyGeneral',
            title: 'Borrowed general survey',
            questionIDs: [],
          },
        },
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
      },
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(undefined);

    subject.updateCache((prevCache) => ({
      ...prevCache,
      surveys: {
        ...(prevCache.surveys || {}),
        q1: {
          id: 'q1',
          title: 'Pinned unresolved survey',
          questionIDs: ['question-1'],
        },
      },
    }));

    expect(subject.state.cache.surveys.q1).toEqual(expect.objectContaining({
      id: 'q1',
      title: 'Pinned unresolved survey',
    }));
    expect(peekSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('keeps all parallel ensureQuestionCached writes when a survey route hydrates many question ids at once', async () => {
    await cacheScripts.removeCache('questionsCache', 'edge').catch(() => null);
    jest.spyOn(contractScripts, 'getQuestionData').mockImplementation(async (_provider, questionId) => ({
      id: String(questionId).toLowerCase(),
      type: 'freeform',
      prompt: `Prompt ${questionId}`,
      creator: '0xabc',
      tags: [],
    }));

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
    });
    subject.setState = jest.fn((update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      return patch;
    });

    await Promise.all(
      Array.from({ length: 10 }, (_, index) => subject.ensureQuestionCached(`q${index + 1}`))
    );

    const persistedCache = await cacheScripts.readCache('questionsCache', 'edge');
    expect(Object.keys(persistedCache?.['84532']?.questions || {})).toHaveLength(10);
    expect(persistedCache['84532'].questions.q10).toEqual(expect.objectContaining({ id: 'q10' }));
  });

  it('re-reads fresh cache before getLatestQuestionResponse write-through to keep parallel responder data', async () => {
    const freshCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {
          q1: {
            '0xbbb': {
              answer: { value: 'existing-response' },
              blockNumber: 7,
              logIndex: 2,
            },
          },
        },
        questionResponsesMeta: {
          q1: {
            '0xbbb': { bn: 7, li: 2 },
          },
        },
        questionResponsesLatestBlock: 0,
      },
    };
    const readQuestionsCacheAsync = jest.fn().mockResolvedValue(clone(freshCache));
    const writeQuestionsCache = jest.fn().mockResolvedValue(true);

    // port note: the class wrapper also fetched from chain; the write-through freshness contract lives in writeSingleQuestionResponseToCache.
    await writeSingleQuestionResponseToCache({
      responder: '0xAAA',
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      netIdStr: '84532',
      respObj: {
        answer: { value: 'latest-response' },
        blockNumber: 8,
        logIndex: 3,
      },
      readQuestionsCacheAsync,
      ensureQuestionsNet: ensureQuestionsNetForTest,
      writeQuestionsCache,
    });

    expect(readQuestionsCacheAsync).toHaveBeenCalledWith('edge');
    expect(writeQuestionsCache).toHaveBeenCalled();
    const written = writeQuestionsCache.mock.calls[0][1];
    expect(written['84532'].questionResponses.q1['0xbbb']).toEqual(
      expect.objectContaining({ answer: { value: 'existing-response' } })
    );
    expect(written['84532'].questionResponses.q1['0xaaa']).toEqual(
      expect.objectContaining({ answer: { value: 'latest-response' } })
    );
  });

  it('does not hydrate decrypt envelopes from a borrowed general network when the draft slug is unresolved', async () => {
    const readQuestionsCache = jest.fn();
    const getLatestQuestionResponse = jest.fn();

    await expect(hydrateLatestQuestionDecryptState(
      {
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        baselineForDecrypt: {
          answers: {
            q1: { value: '*', encrypted: true, encryptedPortion: '' },
          },
          additionalComments: {},
        },
        account: '0xabc',
        sessionSlug: 'missing-session-slug',
        networkID: '',
      },
      {
        getQuestionFieldDecryptSelection,
        readQuestionsCache,
        getLatestQuestionResponse,
        mergeLatestEncryptedQuestionFields,
        mergeQuestionRatingEnvelopeState,
        logWarn: jest.fn(),
      },
    )).resolves.toEqual({
      baselineForDecrypt: {
        answers: {
          q1: { value: '*', encrypted: true, encryptedPortion: '' },
        },
        additionalComments: {},
      },
      ratingEnvelopes: null,
    });

    expect(readQuestionsCache).not.toHaveBeenCalled();
    expect(getLatestQuestionResponse).not.toHaveBeenCalled();
  });

  it('routes viewed single-question decrypts through the viewed response payload instead of self-response fallback reads', async () => {
    const viewedPayload = {
      questionID: 'q1',
      responder: '0xbbb',
      responderAddress: '0xbbb',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
    };
    const getViewedResponseOverrideForQuestion = jest.fn(() => viewedPayload);

    const mode = resolveQuestionDecryptHandlingMode(
      {
        questionId: 'q1',
        responseOverride: null,
        viewerAccount: '0xaaa',
        viewedResponder: '0xbbb',
      },
      {
        getViewedResponseOverrideForQuestion,
      },
    );

    expect(mode).toEqual({
      viewerLower: '0xaaa',
      viewedResponderLower: '0xbbb',
      effectiveResponseOverride: viewedPayload,
      hasResponseOverride: true,
      isViewedResponseMode: true,
    });

    const hydrateLatestQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineForDecrypt: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' } },
        additionalComments: { q1: {} },
        importance: {},
        conviction: {},
      },
      ratingEnvelopes: null,
    });

    await expect(prepareViewedQuestionDecryptState(
      {
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        responseOverride: mode.effectiveResponseOverride,
        account: '0xaaa',
        responderForLatest: '0xbbb',
        sessionSlug: 'viewed-session',
        networkID: '84532',
      },
      {
        buildViewedResponseDecryptBaseline: (payload, qid) => (
          buildViewedResponseDecryptBaseline(payload, qid, buildViewedSliceFromPayload)
        ),
        hydrateLatestQuestionDecryptState,
      },
    )).resolves.toEqual(expect.objectContaining({
      questionId: 'q1',
      baselineForDecrypt: expect.objectContaining({
        answers: expect.objectContaining({
          q1: expect.objectContaining({ encryptedPortion: 'cipher-answer' }),
        }),
      }),
    }));

    expect(hydrateLatestQuestionDecryptState).toHaveBeenCalledWith(expect.objectContaining({
      responderForLatest: '0xbbb',
    }));
  });

  it('prefers the latest self-response answer envelope when local response state is stale', async () => {
    const getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      blockNumber: 8,
      logIndex: 3,
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-fresh' },
    });
    const result = await prepareSelfQuestionDecryptState(
      {
        surveyIndex: 0,
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        responseOverride: null,
        userAnswers: null,
        account: '0xaaa',
        sessionSlug: 'self-session',
        networkID: '84532',
      },
      {
        buildSelfQuestionDecryptBaseline: jest.fn(() => ({
          baselineSlice: {
            answers: {
              q1: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
            },
            additionalComments: {},
            importance: {},
            conviction: {},
          },
          baselineForDecrypt: {
            answers: {
              q1: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
            },
            additionalComments: {},
            importance: {},
            conviction: {},
          },
        })),
        mergeQuestionResponseOverrideIntoDecryptSlice: jest.fn((slice) => slice),
        mergeQuestionRatingEnvelopeState,
        hydrateLatestQuestionDecryptState: hydrateWithLatestQuestionResponse({
          getLatestQuestionResponse,
        }),
        logWarn: jest.fn(),
      },
    );

    expect(getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xaaa',
      'q1',
      '84532',
      { cached: true },
    );
    expect(result.baselineForDecrypt.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');

    const decryptSingleField = jest.fn(async (slice) => {
      expect(slice.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');
      return {
        answers: {
          q1: { value: 'Choice 2' },
        },
        additionalComments: {},
      };
    });
    const finalized = await finalizeQuestionDecryptAttempt(
      {
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        baselineForDecrypt: result.baselineForDecrypt,
        ratingEnvelopes: result.ratingEnvelopes,
        account: '0xaaa',
        providerLike: {},
        chainId: 84532,
        lit: undefined,
        opts: {},
      },
      {
        decryptSingleField,
        decryptQuestionRatingEnvelopes: jest.fn().mockResolvedValue({}),
      },
    );

    expect(finalized.didUpdate).toBe(true);
    expect(finalized.decryptedStateSlice.answers.q1.value).toBe('Choice 2');
  });

  it('hydrates missing viewed-response additional envelopes from the responder latest payload before decrypting', async () => {
    const responseOverride = {
      questionID: 'q1',
      responder: '0xbbb',
      responderAddress: '0xbbb',
      answer: { value: '8', encrypted: false, encryptedPortion: '' },
      additional: { value: '*', encrypted: true, encryptedPortion: '' },
    };
    const getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xbbb',
      additional: { value: '*', encrypted: true, encryptedPortion: 'cipher-add' },
    });
    const prepared = await prepareViewedQuestionDecryptState(
      {
        questionId: 'q1',
        fieldToDecrypt: 'additional',
        responseOverride,
        account: '0xaaa',
        responderForLatest: '0xbbb',
        sessionSlug: 'viewed-session',
        networkID: '84532',
      },
      {
        buildViewedResponseDecryptBaseline: (payload, qid) => (
          buildViewedResponseDecryptBaseline(payload, qid, buildViewedSliceFromPayload)
        ),
        hydrateLatestQuestionDecryptState: hydrateWithLatestQuestionResponse({
          getLatestQuestionResponse,
        }),
      },
    );

    expect(getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xbbb',
      'q1',
      '84532',
      { cached: true },
    );
    expect(prepared.baselineForDecrypt.additionalComments.q1.encryptedPortion).toBe('cipher-add');

    const decryptSingleField = jest.fn(async (slice) => {
      expect(slice.additionalComments.q1.encryptedPortion).toBe('cipher-add');
      return {
        answers: {},
        additionalComments: {
          q1: { value: 'decrypted additional comment' },
        },
      };
    });
    const finalized = await finalizeQuestionDecryptAttempt(
      {
        questionId: 'q1',
        fieldToDecrypt: 'additional',
        baselineForDecrypt: prepared.baselineForDecrypt,
        ratingEnvelopes: prepared.ratingEnvelopes,
        account: '0xaaa',
        providerLike: {},
        chainId: 84532,
        lit: undefined,
        opts: {},
      },
      {
        decryptSingleField,
        decryptQuestionRatingEnvelopes: jest.fn().mockResolvedValue({}),
      },
    );
    const successState = buildViewedResponseDecryptSuccessState(
      { parsedViewAddressAnswers: responseOverride, decryptingByKey: {} },
      {
        questionId: 'q1',
        clearMode: 'additional',
        didUpdate: finalized.didUpdate,
        decryptedStateSlice: finalized.decryptedStateSlice,
      },
    );

    expect(finalized.didUpdate).toBe(true);
    expect(successState.parsedViewAddressAnswers.additional.value).toBe('decrypted additional comment');
  });

  it('prefers the latest viewed-response answer envelope when the route payload is stale', async () => {
    const responseOverride = {
      questionID: 'q1',
      responder: '0xbbb',
      responderAddress: '0xbbb',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
      additional: { value: '', encrypted: false, encryptedPortion: '' },
    };
    const getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xbbb',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-fresh' },
    });
    const prepared = await prepareViewedQuestionDecryptState(
      {
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        responseOverride,
        account: '0xaaa',
        responderForLatest: '0xbbb',
        sessionSlug: 'viewed-session',
        networkID: '84532',
      },
      {
        buildViewedResponseDecryptBaseline: (payload, qid) => (
          buildViewedResponseDecryptBaseline(payload, qid, buildViewedSliceFromPayload)
        ),
        hydrateLatestQuestionDecryptState: hydrateWithLatestQuestionResponse({
          getLatestQuestionResponse,
        }),
      },
    );

    expect(getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xbbb',
      'q1',
      '84532',
      { cached: true },
    );
    expect(prepared.baselineForDecrypt.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');

    const decryptSingleField = jest.fn(async (slice) => {
      expect(slice.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');
      return {
        answers: {
          q1: { value: 'Choice 2' },
        },
        additionalComments: {},
      };
    });
    const finalized = await finalizeQuestionDecryptAttempt(
      {
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        baselineForDecrypt: prepared.baselineForDecrypt,
        ratingEnvelopes: prepared.ratingEnvelopes,
        account: '0xaaa',
        providerLike: {},
        chainId: 84532,
        lit: undefined,
        opts: {},
      },
      {
        decryptSingleField,
        decryptQuestionRatingEnvelopes: jest.fn().mockResolvedValue({}),
      },
    );
    const successState = buildViewedResponseDecryptSuccessState(
      { parsedViewAddressAnswers: responseOverride, decryptingByKey: {} },
      {
        questionId: 'q1',
        clearMode: 'answer',
        didUpdate: finalized.didUpdate,
        decryptedStateSlice: finalized.decryptedStateSlice,
      },
    );

    expect(finalized.didUpdate).toBe(true);
    expect(successState.parsedViewAddressAnswers.answer.value).toBe('Choice 2');
  });

  it('re-reads fresh cache before single-question responder write-through to preserve concurrent responders', async () => {
    const baseQuestion = {
      id: 'q1',
      type: 'freeform',
      prompt: 'Question 1',
      creator: '0xcreator',
      tags: [],
    };
    const freshCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: { q1: { ...baseQuestion } },
        questionResponses: {
          q1: {
            '0xbbb': {
              answer: { value: 'existing' },
              additional: { value: '' },
              blockNumber: 4,
              logIndex: 1,
            },
          },
        },
        questionResponsesMeta: {
          q1: {
            '0xbbb': { bn: 4, txi: 0, li: 1, ts: 11 },
          },
        },
        questionResponsesLatestBlock: 0,
      },
    };
    const latest = {
      answer: { value: 'latest' },
      additional: { value: '' },
      blockNumber: 5,
      transactionIndex: 0,
      logIndex: 2,
      timestamp: 12,
    };
    const readQuestionsCacheAsync = jest.fn().mockResolvedValue(clone(freshCache));
    const writeQuestionsCache = jest.fn().mockResolvedValue(true);
    const stateRef = {
      current: {
        parsedViewAddressAnswers: null,
        startFresh: false,
        suppressPrefill: false,
        isLoadingResponse: false,
        responseLookupWarning: '',
        viewAddressAnswers: '',
        userAnswers: null,
        userHasResponse: false,
        userResponseEncrypted: false,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));

    await expect(executeViewedSingleQuestionResponseBootstrap({
      props: {
        provider: {},
        account: '0xccc',
      },
      state: stateRef.current,
      questionId: 'q1',
      responderAddress: '0xAAA',
      effectiveSingleSlug: 'edge',
      safeSetState,
      getResponse: jest.fn().mockResolvedValue(latest),
      getResponseHash: jest.fn(),
      readCachedResponderResponse: jest.fn().mockReturnValue(null),
      readFreshCachedResponderResponse: jest.fn().mockResolvedValue(null),
      normalizeViewedResponse: jest.fn((value) => value),
      mergeViewedResponse: jest.fn((_prev, next) => next),
      scheduleRetry: jest.fn(),
      clearRetry: jest.fn(),
      writeResponseToCache: (responder, respObj) => writeSingleQuestionResponseToCache({
        responder,
        respObj,
        questionId: 'q1',
        effectiveSingleSlug: 'edge',
        netIdStr: '84532',
        readQuestionsCacheAsync,
        ensureQuestionsNet: ensureQuestionsNetForTest,
        writeQuestionsCache,
      }),
      prefillSingleQuestionResponse: jest.fn(),
    })).resolves.toEqual(expect.objectContaining({
      applied: true,
      reason: 'loaded',
      latest,
    }));

    expect(writeQuestionsCache).toHaveBeenCalled();
    const written = writeQuestionsCache.mock.calls[0][1];
    expect(written['84532'].questionResponses.q1['0xbbb']).toEqual(
      expect.objectContaining({ answer: { value: 'existing' } })
    );
    expect(written['84532'].questionResponses.q1['0xaaa']).toEqual(
      expect.objectContaining({ answer: { value: 'latest' } })
    );
    expect(stateRef.current).toEqual(expect.objectContaining({
      noResponse: false,
      isLoadingResponse: false,
      parsedViewAddressAnswers: latest,
    }));
  });

  it('persists fetched surveys through optimistic survey cache writes', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'surveysCache' ? {} : null
    ));
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      title: 'Fetched survey',
      questionIDs: ['q1'],
      creator: '0xcreator',
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.findSurveyInAllCaches = jest.fn(() => null);

    const surveyData = await subject.getSurveyData('0xSurvey');

    expect(surveyData).toEqual(expect.objectContaining({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      title: 'Fetched survey',
    }));
    expect(writeSpy).toHaveBeenCalledWith(
      'surveysCache',
      'edge',
      expect.objectContaining({
        '84532': expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({
              id: '0xsurvey',
              surveyID: '0xsurvey',
              title: 'Fetched survey',
            }),
          }),
        }),
      })
    );
  });

  it('uses an explicit SurveyTool session prop for fetched survey reads and cache writes', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'surveysCache' ? {} : null
    ));
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    const getSurveySpy = jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      title: 'Fetched survey',
      questionIDs: ['q1'],
      creator: '0xcreator',
    });

    const subject = new SurveyTool({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'rxc',
    });
    subject.findSurveyInAllCaches = jest.fn(() => null);

    const surveyData = await subject.getSurveyData('0xSurvey');

    expect(surveyData).toEqual(expect.objectContaining({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      title: 'Fetched survey',
    }));
    expect(getSurveySpy).toHaveBeenCalledWith({}, '0xsurvey', 'rxc');
    expect(writeSpy).toHaveBeenCalledWith(
      'surveysCache',
      'rxc',
      expect.objectContaining({
        '84532': expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({
              id: '0xsurvey',
              surveyID: '0xsurvey',
              title: 'Fetched survey',
            }),
          }),
        }),
      })
    );
  });

  it('does not read survey list/data from a borrowed general network when the slug is unresolved', async () => {
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                title: 'Borrowed Survey',
                questionIDs: ['q1'],
              },
            },
          },
        };
      }
      return null;
    });
    const getSurveyDataByIdSpy = jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      title: 'Borrowed Survey',
      questionIDs: ['q1'],
    });

    const subject = new SurveyTool({
      provider: {},
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });
    subject.findSurveyInAllCaches = jest.fn(() => null);
    subject.updateSelectedSurvey = jest.fn();
    subject.state = {
      ...subject.state,
      surveys: [{ id: 'stale-survey', title: 'Stale Survey', questionIDs: ['q1'] }],
      loading: false,
    };
    syncClassSetState(subject);
    readCacheSpy.mockClear();

    await subject.fetchSurveys();

    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(subject.state.surveys).toEqual([]);
    expect(subject.state.loading).toBe(false);
    expect(subject.updateSelectedSurvey).not.toHaveBeenCalled();

    readCacheSpy.mockClear();

    await expect(subject.getSurveyData('0xSurvey')).resolves.toBeNull();
    expect(subject.findSurveyInAllCaches).toHaveBeenCalledWith('0xsurvey');
    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(getSurveyDataByIdSpy).not.toHaveBeenCalled();
  });});
