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

const clone = (value) => JSON.parse(JSON.stringify(value));

const applyStateUpdate = (stateRef, update) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  stateRef.current = { ...stateRef.current, ...(patch || {}) };
  return patch;
};

const ensureQuestionsNet = (cache, netId) => {
  const nextCache = {
    ...(cache && typeof cache === 'object' ? cache : {}),
  };
  nextCache[netId] = nextCache[netId] || {};
  nextCache[netId].questions = nextCache[netId].questions || {};
  nextCache[netId].questionResponses = nextCache[netId].questionResponses || {};
  nextCache[netId].questionResponsesMeta = nextCache[netId].questionResponsesMeta || {};
  return nextCache;
};

describe('SurveyTool single-question response bootstrap', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('stops single-question bootstrap before cache or network work when the route question id is missing', async () => {
    const getQuestionFetchCandidateSlugs = jest.fn(() => ['edge']);
    const plan = buildSingleQuestionSourceRestoreContextPlan({
      bootstrapRetryAttempt: 0,
      getQuestionFetchCandidateSlugs,
      props: {
        singleQuestionMode: true,
        questionID: '',
        account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
      },
      runId: 1,
    });

    expect(plan).toEqual(
      expect.objectContaining({
        status: 'missing-question-id',
        debugPayload: expect.objectContaining({
          phase: 'missing-question-id',
        }),
        statePatch: { isLoadingResponse: false },
      }),
    );
    expect(getQuestionFetchCandidateSlugs).not.toHaveBeenCalled();
  });

  it('hydrates a viewed response from a fresh persistent cache reread before falling back to hash-only retries', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const staleCache = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    };
    const freshCachedResponse = {
      questionID: 'q1',
      responder: responderAddress,
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
      additional: { value: '', encrypted: false },
      timestamp: 1700000000,
    };
    const freshCache = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache', creator: responderAddress },
        },
        questionResponses: {
          q1: {
            [responderAddress]: freshCachedResponse,
          },
        },
        questionResponsesMeta: {
          q1: {
            [responderAddress]: { bn: 12, txi: 0, li: 0, ts: 1700000000 },
          },
        },
      },
    };
    jest.spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce(staleCache)
      .mockResolvedValueOnce(freshCache);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(null);
    const getResponseHashSpy = jest.spyOn(contractScripts, 'getResponseHash').mockResolvedValue('tx-response-hash');

    await expect(
      executeViewedSingleQuestionResponseBootstrap({
        props: {
          provider: {},
          account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          responderAddress,
        },
        state: stateRef.current,
        questionId: 'q1',
        responderAddress,
        effectiveSingleSlug: 'edge',
        safeSetState,
        getResponse,
        getResponseHash,
        readCachedResponderResponse: jest.fn().mockReturnValue(null),
        readFreshCachedResponderResponse: jest.fn().mockResolvedValue(freshCachedResponse),
        normalizeViewedResponse: jest.fn((value) => value),
        mergeViewedResponse: jest.fn((_prev, latest) => latest),
        scheduleRetry,
        clearRetry: jest.fn(),
        writeResponseToCache: jest.fn(),
        prefillSingleQuestionResponse: jest.fn(),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        applied: true,
        reason: 'loaded',
        latest: freshCachedResponse,
      }),
    );

    expect(getResponse).toHaveBeenCalled();
    expect(getResponseHash).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(stateRef.current.noResponse).toBe(false);
    expect(stateRef.current.isLoadingResponse).toBe(false);
    expect(stateRef.current.parsedViewAddressAnswers).toEqual(
      expect.objectContaining({
        responder: responderAddress,
        answer: expect.objectContaining({
          encryptedPortion: 'cipher-answer',
        }),
      }),
    );
  });

  it('marks viewed response as no-response when recent payload bootstrap retries are exhausted', async () => {
    const recentPayload = {
      savedAtMs: Date.now(),
      creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      type: 'binary',
      prompt: 'Prompt from recent payload',
      tags: [],
    };
    const bootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'unknown-slug',
      responderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue(recentPayload),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue(''),
    });
    const flowPlan = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult: bootstrapResult,
    });
    const seededState = buildSingleQuestionSeededHydrationState({
      questionData: bootstrapResult.questionData,
      isLoadingResponse: flowPlan.seededHydration?.isLoadingResponse,
      mergeSurveyResponseState: (previous) => previous,
    });
    const retryPlan = resolveSingleQuestionCacheBootstrapStopHandlingPlan({
      bootstrapRetryAttempt: 0,
      cacheBootstrapPlan: flowPlan,
      didScheduleRetry: false,
      effectiveSingleSlug: bootstrapResult.target.effectiveSingleSlug,
      questionId: bootstrapResult.target.questionId,
      responderAddress: bootstrapResult.target.responderAddress,
      runId: 1,
    });

    expect(seededState.questionPool[0]).toEqual(expect.objectContaining({ id: 'q1' }));
    expect(retryPlan.action).toBe('retry');
    expect(retryPlan.retryOutcome).toEqual(
      expect.objectContaining({
        shouldClearRetry: true,
        exhaustedStatePatch: expect.objectContaining({
          noResponse: true,
          isLoadingResponse: false,
        }),
      }),
    );
  });

  it('writes recent payload into the slugged questions cache before viewed-response bootstrap retries', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const recentPayloadKey = 'dg:recentQuestionPayloads';
    sessionStorage.setItem(recentPayloadKey, JSON.stringify({
      q1: {
        savedAtMs: Date.now(),
        creator: account,
        type: 'binary',
        prompt: 'Prompt from recent payload',
        tags: [],
      },
    }));

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => (
      namespace === 'questionsCache' ? 'bad-cache-state' : {}
    ));
    const updateCacheAtomicSpy = jest
      .spyOn(cacheScripts, 'updateCacheAtomic')
      .mockImplementation(async (_namespace, _slug, updater) => updater(null));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress,
      account,
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    const retrySpy = jest
      .spyOn(subject, 'scheduleSingleQuestionBootstrapRetry')
      .mockReturnValue(true);

    try {
      await subject.fetchSingleQuestionData();

    expect(updateCacheAtomic).toHaveBeenCalledWith('questionsCache', 'edge', expect.any(Function));
    expect(bootstrapResult.status).toBe('seeded-from-recent');
    expect(bootstrapResult.cacheState?.questionsCache?.['84532']?.questions?.q1).toEqual(
      expect.objectContaining({
        id: 'q1',
        prompt: 'Prompt from recent payload',
      }),
    );
    expect(flowPlan.seededHydration).toEqual(
      expect.objectContaining({
        isLoadingResponse: true,
        questionData: expect.objectContaining({ id: 'q1' }),
      }),
    );
    expect(retryPlan).toEqual(
      expect.objectContaining({
        action: 'retry',
        retryOutcome: expect.objectContaining({
          debugPayload: expect.objectContaining({
            phase: 'recent-payload-response-bootstrap-retrying',
          }),
        }),
      }),
    );
  });

  it('does not bootstrap own single-question response from a borrowed general network when the slug is unresolved', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const recentPayloadKey = 'dg:recentQuestionPayloads';
    sessionStorage.setItem(recentPayloadKey, JSON.stringify({
      q1: {
        savedAtMs: Date.now(),
        creator: account,
        type: 'binary',
        prompt: 'Prompt from recent payload',
        tags: [],
      },
    }));

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
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => (
      namespace === 'questionsCache' ? 'bad-cache-state' : {}
    ));
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({
      answer: { value: 'should-not-load', encrypted: false },
      additional: { value: '', encrypted: false },
    });
    const writeCacheSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account,
      loginComplete: true,
      provider: {},
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: 'missing-session-slug',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      userHasResponse: false,
      userResponseEncrypted: false,
      userAnswers: null,
      startFresh: false,
      suppressPrefill: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.prefillSingleQuestionResponse = jest.fn();

    expect(bootstrapResult.status).toBe('seeded-from-recent');
    expect(bootstrapResult.cacheState).toBeNull();
    expect(seededState.questionPool[0]).toEqual(expect.objectContaining({ id: 'q1' }));
    expect(fallbackPlan).toEqual(
      expect.objectContaining({
        action: 'fallback',
        debugPayload: expect.objectContaining({
          phase: 'recent-payload-missing-network',
        }),
        fallbackStatePatch: { isLoadingResponse: false },
      }),
    );
    expect(getResponse).not.toHaveBeenCalled();
    expect(writeQuestionsCache).not.toHaveBeenCalled();
    expect(prefillSingleQuestionResponse).not.toHaveBeenCalled();
  });

  it('hydrates own response when recent payload exists and cache state is unavailable', async () => {
    const account = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const recentPayloadKey = 'dg:recentQuestionPayloads';
    const latestResponse = {
      answer: { value: 'Agree', encrypted: false },
      additional: { value: '', encrypted: false },
      blockNumber: 12,
      logIndex: 1,
    };
    sessionStorage.setItem(recentPayloadKey, JSON.stringify({
      q1: {
        savedAtMs: Date.now(),
        creator: account,
        type: 'binary',
        prompt: 'Prompt from recent payload',
        tags: [],
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));
    const getResponse = jest.fn().mockResolvedValue(latestResponse);
    const prefillSingleQuestionResponse = jest.fn();

    expect(flowPlan.action).toBe('continue');
    await expect(
      executeOwnSingleQuestionResponseBootstrap({
        props: {
          provider: {},
          account,
        },
        state: stateRef.current,
        questionId: 'q1',
        effectiveSingleSlug: 'unknown-slug',
        safeSetState,
        getResponse,
        writeResponseToCache: jest.fn(),
        areResponsesConsistent: jest.fn(),
        prefillSingleQuestionResponse,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        applied: true,
        reason: 'loaded',
        latest: latestResponse,
      }),
    );

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(null);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => (
      namespace === 'questionsCache' ? 'bad-cache-state' : {}
    ));
    jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue(latestResponse);

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account,
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
      sessionSlug: 'unknown-slug',
      activeSessionSlug: 'unknown-slug',
      sessionSlugPinned: true,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      parsedViewAddressAnswers: null,
      noResponse: false,
      isLoadingResponse: false,
      userHasResponse: false,
      userResponseEncrypted: false,
      userAnswers: null,
      startFresh: false,
      suppressPrefill: false,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    };
    let callbackRun = Promise.resolve();
    subject.setState = jest.fn((update, cb) => {
      const prevState = subject.state;
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      const diffInputsChanged = subject.didEditDiffInputsChange(subject.props, prevState);
      if (diffInputsChanged && !subject._responseHydrationStateUpdateDepth) {
        subject.invalidateResponseHydrationRuns();
      }
      if (typeof cb === 'function') {
        const maybePromise = cb();
        if (maybePromise && typeof maybePromise.then === 'function') {
          callbackRun = callbackRun.then(() => maybePromise);
        }
      }
      return patch;
    });
    subject.prefillSingleQuestionResponse = jest.fn();

    try {
      await subject.fetchSingleQuestionData();
      await callbackRun;
      expect(getResponseSpy).toHaveBeenCalledWith(
        subject.props.provider,
        account,
        'q1',
        expect.any(String)
      );
      expect(subject.prefillSingleQuestionResponse).toHaveBeenCalledWith(latestResponse);
      expect(subject.state.userHasResponse).toBe(true);
      expect(subject.state.noResponse).toBe(false);
    } finally {
      sessionStorage.removeItem(recentPayloadKey);
      subject.clearSingleQuestionBootstrapRetry();
    }
  });

});
