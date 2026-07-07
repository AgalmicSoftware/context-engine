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

const hydrateWithLatestQuestionResponse =
  ({ getLatestQuestionResponse, readQuestionsCache = jest.fn(() => ({ cached: true })) } = {}) =>
  (args) =>
    hydrateLatestQuestionDecryptState(args, {
      getQuestionFieldDecryptSelection,
      readQuestionsCache,
      getLatestQuestionResponse,
      mergeLatestEncryptedQuestionFields,
      mergeQuestionRatingEnvelopeState,
      logWarn: jest.fn(),
    });

const writeFetchedQuestionToCache = async ({
  effectiveSlug = 'edge',
  netIdStr = '84532',
  questionId = 'q1',
  questionData = null,
  updateCacheAtomic = cacheScripts.updateCacheAtomic,
} = {}) =>
  updateCacheAtomic('questionsCache', effectiveSlug, (current) => {
    const nextCache = ensureQuestionsNet(current, netIdStr);
    const qid = String(questionId || '').toLowerCase();
    nextCache[netIdStr].questions[qid] = {
      ...(nextCache[netIdStr].questions[qid] || {}),
      ...(questionData || {}),
      id: qid,
    };
    return nextCache;
  });

const applySurveyToolCachePatch = ({
  props = {},
  slug = '',
  cacheState = {},
  updater,
  readSurveysCache = () => ({}),
  writeSurveysCache = jest.fn(),
} = {}) => {
  const updateCacheContext = resolveUpdateCacheContext(props, slug);
  const effectiveSlug = updateCacheContext.sessionSlug || normalizeSessionSlugValue(slug);
  const netIdStr = updateCacheContext.networkIdStr;
  const newCache = typeof updater === 'function' ? updater(cacheState || {}) : {};
  if (netIdStr) {
    const global = mergeSurveyToolCachePatchIntoSurveysCache(readSurveysCache(effectiveSlug), netIdStr, newCache);
    writeSurveysCache(effectiveSlug, global);
  }
  return {
    cache: newCache,
    effectiveSlug,
    netIdStr,
  };
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

describe('SurveyTool single-question cache writes and decrypts', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('re-reads fresh cache before ensureQuestionCached write-through to avoid clobbering parallel inserts', async () => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const staleCache = {
      84532: {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
        questionResponsesLatestBlock: 0,
      },
    };
    const freshCache = {
      84532: {
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
    const atomicSpy = jest
      .spyOn(cacheScripts, 'updateCacheAtomic')
      .mockImplementation(async (_namespace, _slug, updater) => updater(clone(freshCache)));

    await writeFetchedQuestionToCache({
      questionData: {
        id: 'q1',
        type: 'freeform',
        prompt: 'Fetched question',
        creator: '0xaaa',
        tags: ['tag-1'],
      },
      updateCacheAtomic: atomicSpy,
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

      expect(decryptPlan.opts).toEqual(
        expect.objectContaining({
          chainId: 84532,
          lit: { getKey: litHooks.getKey },
        }),
      );
      expect(decryptPlan.lit).toEqual({ getKey: litHooks.getKey });
      // port note: direct `getQuestionData` call-shape inspection is a SurveyTool shell detail; the exported decrypt plan pins global Lit hook propagation.
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
    const strictLookup = (slug) =>
      String(slug || '')
        .trim()
        .toLowerCase() === ''
        ? generalCfg
        : null;
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
      .mockImplementation((slug) => strictLookup(slug) || generalCfg);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const ensureContext = resolveEnsureQuestionCachedContext(
      {
        activeSessionSlug: 'missing-session-slug',
        sessionSlug: 'missing-session-slug',
        cacheHasLoaded: true,
      },
      'missing-session-slug',
    );
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache');
    const atomicSpy = jest.spyOn(cacheScripts, 'updateCacheAtomic');

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
    const strictLookup = (slug) =>
      String(slug || '')
        .trim()
        .toLowerCase() === ''
        ? generalCfg
        : null;
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
      .mockImplementation((slug) => strictLookup(slug) || generalCfg);

    const subject = new SurveyTool({
      activeSessionSlug: 'missing-session-slug',
      sessionSlug: 'missing-session-slug',
      cacheHasLoaded: true,
    });
    syncClassSetState(subject);

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      84532: {
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

    expect(result.cache.surveys.q1).toEqual(
      expect.objectContaining({
        id: 'q1',
        title: 'Pinned unresolved survey',
      }),
    );
    expect(result.netIdStr).toBe('');
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
      fetchedQuestions.map((questionData) =>
        writeFetchedQuestionToCache({
          questionId: questionData.id,
          questionData,
        }),
      ),
    );

    const persistedCache = await cacheScripts.readCache('questionsCache', 'edge');
    expect(Object.keys(persistedCache?.['84532']?.questions || {})).toHaveLength(10);
    expect(persistedCache['84532'].questions.q10).toEqual(expect.objectContaining({ id: 'q10' }));
  });

  it('re-reads fresh cache before getLatestQuestionResponse write-through to keep parallel responder data', async () => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const staleCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: { q1: {} },
        questionResponsesMeta: { q1: {} },
        questionResponsesLatestBlock: 0,
      },
    };
    const freshCache = {
      84532: {
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
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => (
      namespace === 'questionsCache' ? clone(freshCache) : null
    ));
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({
      answer: { value: 'latest-response' },
      blockNumber: 8,
      logIndex: 3,
    });

    const subject = new SurveyQuestions({
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'edge');

    await subject.getLatestQuestionResponse('0xAAA', 'q1', '84532', clone(staleCache));

    expect(writeSpy).toHaveBeenCalled();
    const latestCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
    const written = latestCall[2];
    expect(written['84532'].questionResponses.q1['0xbbb']).toEqual(
      expect.objectContaining({ answer: { value: 'existing-response' } }),
    );
    expect(written['84532'].questionResponses.q1['0xaaa']).toEqual(
      expect.objectContaining({ answer: { value: 'latest-response' } }),
    );
  });

  it('does not hydrate decrypt envelopes from a borrowed general network when the draft slug is unresolved', async () => {
    const readQuestionsCache = jest.fn();
    const getLatestQuestionResponse = jest.fn();

    await expect(
      hydrateLatestQuestionDecryptState(
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
      ),
    ).resolves.toEqual({
      baselineForDecrypt: {
        answers: {
          q1: { value: '*', encrypted: true, encryptedPortion: '' },
        },
        additionalComments: {},
      },
      ratingEnvelopes: null,
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: 'missing-session-slug',
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      answer: { encryptedPortion: 'borrowed-env', encrypted: true, value: '*' },
      additional: { value: '', encrypted: false },
    });
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: '',
            hash: '',
          },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: {
            value: '',
            encrypted: false,
            encryptedPortion: '',
            hash: '',
          },
        },
      }],
      userAnswers: null,
      decryptingByKey: {},
      hasher: {},
    };
    peekSpy.mockClear();

    const didUpdate = await subject.handleDecryptQuestionAnswerInternal('q1', 'answer');

    expect(didUpdate).toBe(false);
    expect(subject.getLatestQuestionResponse).not.toHaveBeenCalled();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('routes viewed single-question decrypts through the viewed response payload instead of self-response fallback reads', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      responderAddress: '0xbbb',
      loginComplete: true,
      provider: {},
      sessionSlug: 'viewed-session',
      activeSessionSlug: 'viewed-session',
    });
    syncClassSetState(subject);
    subject.handleDecryptViewedResponseField = jest.fn().mockResolvedValue(true);
    subject.getLatestQuestionResponse = jest.fn();
    subject.state = {
      ...subject.state,
      parsedViewAddressAnswers: {
        questionID: 'q1',
        answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
      },
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      decryptingByKey: {},
    };

    await expect(
      prepareViewedQuestionDecryptState(
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
          buildViewedResponseDecryptBaseline: (payload, qid) =>
            buildViewedResponseDecryptBaseline(payload, qid, buildViewedSliceFromPayload),
          hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptStateMock,
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        questionId: 'q1',
        baselineForDecrypt: expect.objectContaining({
          answers: expect.objectContaining({
            q1: expect.objectContaining({ encryptedPortion: 'cipher-answer' }),
          }),
        }),
      }),
    );

    expect(hydrateLatestQuestionDecryptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        responderForLatest: '0xbbb',
      }),
    );
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

    expect(getLatestQuestionResponse).toHaveBeenCalledWith('0xaaa', 'q1', '84532', { cached: true });
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
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'self-session',
      activeSessionSlug: 'self-session',
    });
    syncClassSetState(subject);
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject._getEffectiveDraftSlug = jest.fn(() => 'self-session');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xaaa',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-fresh' },
    });
    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {
          q1: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
        },
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      userAnswers: null,
      decryptingByKey: {},
      hasher: {},
    };

    const didUpdate = await subject.handleDecryptQuestionAnswerInternal('q1', 'answer');

    expect(didUpdate).toBe(true);
    expect(subject.getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xaaa',
      'q1',
      '84532',
      expect.any(Object),
    );
    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe('Choice 2');
    decryptSpy.mockRestore();
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
        buildViewedResponseDecryptBaseline: (payload, qid) =>
          buildViewedResponseDecryptBaseline(payload, qid, buildViewedSliceFromPayload),
        hydrateLatestQuestionDecryptState: hydrateWithLatestQuestionResponse({
          getLatestQuestionResponse,
        }),
      },
    );

    expect(getLatestQuestionResponse).toHaveBeenCalledWith('0xbbb', 'q1', '84532', { cached: true });
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
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      responderAddress: '0xbbb',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'viewed-session',
      activeSessionSlug: 'viewed-session',
    });
    syncClassSetState(subject);
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject._getEffectiveDraftSlug = jest.fn(() => 'viewed-session');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xbbb',
      additional: { value: '*', encrypted: true, encryptedPortion: 'cipher-add' },
    });
    subject.state = {
      ...subject.state,
      parsedViewAddressAnswers: {
        questionID: 'q1',
        responder: '0xbbb',
        responderAddress: '0xbbb',
        answer: { value: '8', encrypted: false, encryptedPortion: '' },
        additional: { value: '*', encrypted: true, encryptedPortion: '' },
      },
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      decryptingByKey: {},
      hasher: {},
    };

    const didUpdate = await subject.handleDecryptViewedResponseFieldInternal('q1', 'additional', {
      questionID: 'q1',
      responder: '0xbbb',
      responderAddress: '0xbbb',
      answer: { value: '8', encrypted: false, encryptedPortion: '' },
      additional: { value: '*', encrypted: true, encryptedPortion: '' },
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
        buildViewedResponseDecryptBaseline: (payload, qid) =>
          buildViewedResponseDecryptBaseline(payload, qid, buildViewedSliceFromPayload),
        hydrateLatestQuestionDecryptState: hydrateWithLatestQuestionResponse({
          getLatestQuestionResponse,
        }),
      },
    );

    expect(getLatestQuestionResponse).toHaveBeenCalledWith('0xbbb', 'q1', '84532', { cached: true });
    expect(prepared.baselineForDecrypt.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');

  it('prefers the latest viewed-response answer envelope when the route payload is stale', async () => {
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptSingleField').mockImplementation(async (slice) => {
      expect(slice.answers.q1.encryptedPortion).toBe('cipher-answer-fresh');
      return {
        answers: {
          q1: { value: 'Choice 2' },
        },
        additionalComments: {},
      };
    });
    jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xaaa',
      responderAddress: '0xbbb',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      sessionSlug: 'viewed-session',
      activeSessionSlug: 'viewed-session',
    });
    syncClassSetState(subject);
    subject.resolveDecryptSurveyId = jest.fn(() => '0xsurvey');
    subject.persistDraftSafely = jest.fn();
    subject.updateJsonPreview = jest.fn();
    subject._getEffectiveDraftSlug = jest.fn(() => 'viewed-session');
    subject.getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      responder: '0xbbb',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-fresh' },
    });
    subject.state = {
      ...subject.state,
      parsedViewAddressAnswers: {
        questionID: 'q1',
        responder: '0xbbb',
        responderAddress: '0xbbb',
        answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
        additional: { value: '', encrypted: false, encryptedPortion: '' },
      },
      surveysResponseState: [{
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }],
      decryptingByKey: {},
      hasher: {},
    };

    const didUpdate = await subject.handleDecryptViewedResponseFieldInternal('q1', 'answer', {
      questionID: 'q1',
      responder: '0xbbb',
      responderAddress: '0xbbb',
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer-stale' },
      additional: { value: '', encrypted: false, encryptedPortion: '' },
    });

    expect(didUpdate).toBe(true);
    expect(subject.getLatestQuestionResponse).toHaveBeenCalledWith(
      '0xbbb',
      'q1',
      '84532',
      expect.any(Object),
    );
    expect(subject.state.parsedViewAddressAnswers.answer.value).toBe('Choice 2');
    decryptSpy.mockRestore();
  });

  it('re-reads fresh cache before single-question responder write-through to preserve concurrent responders', async () => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const baseQuestion = {
      id: 'q1',
      type: 'freeform',
      prompt: 'Question 1',
      creator: '0xcreator',
      tags: [],
    };
    const staleCache = {
      '84532': {
        questionsLatestBlock: 0,
        questions: { q1: { ...baseQuestion } },
        questionResponses: { q1: {} },
        questionResponsesMeta: { q1: {} },
        questionResponsesLatestBlock: 0,
      },
    };
    const freshCache = {
      84532: {
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
    let readCount = 0;
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace !== 'questionsCache') return null;
      readCount += 1;
      return readCount === 1 ? clone(staleCache) : clone(freshCache);
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({
      answer: { value: 'latest' },
      additional: { value: '' },
      blockNumber: 5,
      transactionIndex: 0,
      logIndex: 2,
      timestamp: 12,
    });
    jest.spyOn(contractScripts, 'getQuestionData').mockResolvedValue(null);
    jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue(null);

    await expect(
      executeViewedSingleQuestionResponseBootstrap({
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
        writeResponseToCache: (responder, respObj) =>
          writeSingleQuestionResponseToCache({
            responder,
            respObj,
            questionId: 'q1',
            effectiveSingleSlug: 'edge',
            netIdStr: '84532',
            readQuestionsCacheAsync,
            ensureQuestionsNet,
            writeQuestionsCache,
          }),
        prefillSingleQuestionResponse: jest.fn(),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        applied: true,
        reason: 'loaded',
        latest,
      }),
    );

    await subject.fetchSingleQuestionData();
    await callbackRun;

    expect(writeSpy).toHaveBeenCalled();
    const latestCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
    const written = latestCall[2];
    expect(written['84532'].questionResponses.q1['0xbbb']).toEqual(
      expect.objectContaining({ answer: { value: 'existing' } }),
    );
    expect(written['84532'].questionResponses.q1['0xaaa']).toEqual(
      expect.objectContaining({ answer: { value: 'latest' } }),
    );
    expect(stateRef.current).toEqual(
      expect.objectContaining({
        noResponse: false,
        isLoadingResponse: false,
        parsedViewAddressAnswers: latest,
      }),
    );
  });

  it('persists fetched surveys through optimistic survey cache writes', async () => {
    jest
      .spyOn(cacheScripts, 'readCache')
      .mockImplementation(async (namespace) => (namespace === 'surveysCache' ? {} : null));
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

    expect(surveyData).toEqual(
      expect.objectContaining({
        id: '0xsurvey',
        surveyID: '0xsurvey',
        title: 'Fetched survey',
      }),
    );
    expect(writeSpy).toHaveBeenCalledWith(
      'surveysCache',
      'edge',
      expect.objectContaining({
        84532: expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({
              id: '0xsurvey',
              surveyID: '0xsurvey',
              title: 'Fetched survey',
            }),
          }),
        }),
      }),
    );
  });

  it('uses an explicit SurveyTool session prop for fetched survey reads and cache writes', async () => {
    jest
      .spyOn(cacheScripts, 'readCache')
      .mockImplementation(async (namespace) => (namespace === 'surveysCache' ? {} : null));
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

    expect(surveyData).toEqual(
      expect.objectContaining({
        id: '0xsurvey',
        surveyID: '0xsurvey',
        title: 'Fetched survey',
      }),
    );
    expect(getSurveySpy).toHaveBeenCalledWith({}, '0xsurvey', 'rxc');
    expect(writeSpy).toHaveBeenCalledWith(
      'surveysCache',
      'rxc',
      expect.objectContaining({
        84532: expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({
              id: '0xsurvey',
              surveyID: '0xsurvey',
              title: 'Fetched survey',
            }),
          }),
        }),
      }),
    );
  });

  it('does not read survey list/data from a borrowed general network when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) =>
      String(slug || '')
        .trim()
        .toLowerCase() === ''
        ? generalCfg
        : null;
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
      .mockImplementation((slug) => strictLookup(slug) || generalCfg);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace) => {
      if (namespace === 'surveysCache') {
        return {
          84532: {
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
    };
    const surveyReadContext = resolveSurveyReadContext(props, 'missing-session-slug');
    const listPatch = buildSurveyToolSurveyListStatePatch();

    readCacheSpy.mockClear();

    expect(surveyReadContext.networkIdStr).toBe('');
    expect(listPatch).toEqual(
      expect.objectContaining({
        surveys: [],
        loading: false,
      }),
    );
    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(subject.state.surveys).toEqual([]);
    expect(subject.state.loading).toBe(false);
    expect(subject.updateSelectedSurvey).not.toHaveBeenCalled();

    readCacheSpy.mockClear();

    await expect(
      getSurveyDataThroughPorts({
        props,
        surveyID: '0xSurvey',
        readSurveysCacheAsync: (slug) => cacheScripts.readCache('surveysCache', slug),
        findSurveyInAllCaches,
      }),
    ).resolves.toBeNull();
    expect(findSurveyInAllCaches).toHaveBeenCalledWith('0xsurvey');
    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(getSurveyDataByIdSpy).not.toHaveBeenCalled();
  });});
