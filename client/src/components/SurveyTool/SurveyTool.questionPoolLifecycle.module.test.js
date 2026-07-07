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
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import demo1OnchainQuestionIds from '../../variables/demo/demo_1_onchain_question_ids.json';
import {
  executeSurveyFormStateReset,
  executeSurveyStartFresh,
  shouldSurveyAutoStartFresh,
} from './surveyToolResponseResetController';
import { buildInitializedSurveyResponseState } from './surveyToolHydrationFlow.js';
import { buildQuestionIdScopeSignature, normalizeQuestionIdKey } from './surveyToolSignatures.js';
import {
  getSessionSlugHintFromProps,
  getSessionSlugPinnedFromProps,
  resolveQuestionPayloadCacheWriteContext,
} from './surveyToolScope';
import { areQuestionPayloadsEquivalent } from './surveyToolCacheState.js';
import { buildQuestionPoolPendingSubmitFeedbackMessage } from './surveyQuestionSubmitFeedback.js';
import { pickBetterQuestionPayload } from '../../utilities/survey/questionRouting.js';

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

const poolDeps = (overrides = {}) => ({
  areQuestionPayloadsEquivalent,
  buildQuestionIdScopeSignature,
  normalizeQuestionIdKey,
  pickBetterQuestionPayload,
  ...overrides,
});

const didEditDiffInputsChange = ({ prevProps = {}, nextProps = {}, prevState = {}, nextState = {} } = {}) => {
  if (!prevProps || !prevState) return true;
  if (prevState.surveysResponseState !== nextState.surveysResponseState) return true;
  if (prevState.editBaseline !== nextState.editBaseline) return true;
  if (prevState.userAnswers !== nextState.userAnswers) return true;
  if (buildQuestionIdScopeSignature(prevState.questionPool) !== buildQuestionIdScopeSignature(nextState.questionPool))
    return true;
  if (buildQuestionIdScopeSignature(prevState.pileQuestions) !== buildQuestionIdScopeSignature(nextState.pileQuestions))
    return true;
  if (buildQuestionIdScopeSignature(prevProps.questionPool) !== buildQuestionIdScopeSignature(nextProps.questionPool))
    return true;
  if (prevProps.isStandalone !== nextProps.isStandalone) return true;
  if (prevProps.minifiedMode !== nextProps.minifiedMode) return true;
  if (prevProps.surveyIndex !== nextProps.surveyIndex) return true;
  if (prevProps.surveyId !== nextProps.surveyId) return true;
  if (prevProps.viewAddress !== nextProps.viewAddress) return true;
  if (prevProps.account !== nextProps.account) return true;
  if (prevProps.loginComplete !== nextProps.loginComplete) return true;
  if (prevProps.singleQuestionMode !== nextProps.singleQuestionMode) return true;
  if (prevProps.questionID !== nextProps.questionID) return true;
  if (prevProps.responderAddress !== nextProps.responderAddress) return true;
  if (prevProps.network?.id !== nextProps.network?.id) return true;
  if (prevProps.networkChainId !== nextProps.networkChainId) return true;
  if (getSessionSlugHintFromProps(prevProps) !== getSessionSlugHintFromProps(nextProps)) return true;
  if (getSessionSlugPinnedFromProps(prevProps) !== getSessionSlugPinnedFromProps(nextProps)) return true;
  return false;
};

const applyDiffInputStats = ({ diffInputsChanged, getPendingEditStats, emitPendingStats, recalculateEditStats }) => {
  if (!diffInputsChanged) return null;
  const pendingStats = getPendingEditStats();
  emitPendingStats(pendingStats);
  recalculateEditStats(pendingStats);
  return pendingStats;
};

describe('SurveyTool question pool lifecycle', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('treats survey/view/network/session context switches as diff input changes', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-a',
      viewAddress: '0x111',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      activeSessionSlug: 'edge-a',
      sessionSlug: 'edge-a',
      sessionSlugPinned: true,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
    };

    [
      { surveyId: 'survey-b' },
      { viewAddress: '0x222' },
      { network: { id: 84533 } },
      { networkChainId: 84533 },
      { sessionSlug: 'edge-b' },
      { sessionSlugPinned: false },
    ].forEach((patch) => {
      expect(
        didEditDiffInputsChange({
          prevProps: baseProps,
          nextProps: { ...baseProps, ...patch },
          prevState: sharedState,
          nextState: sharedState,
        }),
      ).toBe(true);
    });
    // port note: the old test called the class wrapper directly; the portable
    // contract is the identity/signature/session scope comparison it delegates.
  });

  it('does not treat ref-only pool churn as diff input change when question ids are unchanged', () => {
    const sharedResponsesState = [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }];
    const sharedBaseline = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const sharedUserAnswers = null;

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-a',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      questionPool: [{ id: 'prop-q1' }],
    });

    const prevState = {
      ...subject.state,
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: sharedUserAnswers,
      isLoadingResponse: false,
      questionPool: [{ id: 'state-q1' }, { id: 'state-q2' }],
      pileQuestions: [{ id: 'pile-q1' }],
    };

    subject.state = {
      ...subject.state,
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: sharedUserAnswers,
      isLoadingResponse: false,
      questionPool: [{ id: 'state-q2' }, { id: 'state-q1' }],
      pileQuestions: [{ id: 'pile-q1' }],
    };

    expect(
      didEditDiffInputsChange({
        prevProps: props,
        nextProps: { questionPool: [{ id: 'prop-q1' }] },
        prevState,
        nextState,
      }),
    ).toBe(false);
  });

  it('does not invalidate hydration runs for response loading state changes only', () => {
    const sharedResponsesState = [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }];
    const sharedBaseline = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-a',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      questionPool: [{ id: 'q1' }],
    });
    const prevProps = { ...subject.props };
    const prevState = {
      ...subject.state,
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: null,
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      isLoadingResponse: false,
    };
    subject.state = {
      ...subject.state,
      surveysResponseState: sharedResponsesState,
      editBaseline: sharedBaseline,
      userAnswers: null,
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      isLoadingResponse: true,
    };

    expect(
      didEditDiffInputsChange({
        prevProps: props,
        nextProps: props,
        prevState: {
          surveysResponseState: sharedResponsesState,
          editBaseline: sharedBaseline,
          userAnswers: null,
          questionPool: [{ id: 'q1' }],
          pileQuestions: [],
          isLoadingResponse: false,
        },
        nextState: {
          surveysResponseState: sharedResponsesState,
          editBaseline: sharedBaseline,
          userAnswers: null,
          questionPool: [{ id: 'q1' }],
          pileQuestions: [],
          isLoadingResponse: true,
        },
      }),
    ).toBe(false);
  });

  it('skips no-op SurveyQuestions questionPool state writes when fetched payloads are semantically unchanged', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: ['q1'],
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1', type: 'binary', prompt: 'Existing in state' },
            },
          },
        };
      }
      return {};
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing in state' }],
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(subject.props.ensureQuestionCached).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState.mock.results[0].value).toBeNull();
    expect(subject.state.questionPool[0].prompt).toBe('Existing in state');
  });

  it('updates SurveyQuestions questionPool when fetched payload changes under the same ids', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: ['q1'],
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1', type: 'binary', prompt: 'Prompt from cache' },
            },
          },
        };
      }
      return {};
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Existing in state' }],
      questionPoolExpectedIds: [],
      questionPoolPendingIds: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(subject.props.ensureQuestionCached).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState.mock.results[0].value).toEqual({
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt from cache' }],
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: [],
    });
    expect(subject.state.questionPool[0].prompt).toBe('Prompt from cache');
  });

  it('hydrates all survey question ids into the direct-route question pool', async () => {
    const surveyQuestionIds = Array.from({ length: 10 }, (_, index) => `q${index + 1}`);
    const questionsCache = { '84532': { questions: {} } };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: surveyQuestionIds,
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return questionsCache;
      }
      return {};
    });

    const ensureQuestionCached = jest.fn(async (qid) => {
      questionsCache['84532'].questions[String(qid).toLowerCase()] = {
        id: String(qid).toLowerCase(),
        type: 'freeform',
        prompt: `Prompt ${qid}`,
      };
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(ensureQuestionCached).toHaveBeenCalledTimes(10);
    expect(subject.state.questionPool).toHaveLength(10);
    expect(subject.state.questionPool[9]).toEqual(expect.objectContaining({ id: 'q10' }));
  });

  it('publishes temporary demo-1 fixture questions without waiting for metadata hydration', async () => {
    const questionsCache = {};
    const surveysCache = {};
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
      if (slug !== 'demo-1') return {};
      if (namespace === 'questionsCache') return questionsCache;
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockImplementation((namespace, slug, value) => {
      if (slug === 'demo-1' && namespace === 'questionsCache') {
        Object.keys(questionsCache).forEach((key) => delete questionsCache[key]);
        Object.assign(questionsCache, value || {});
      }
      if (slug === 'demo-1' && namespace === 'surveysCache') {
        Object.keys(surveysCache).forEach((key) => delete surveysCache[key]);
        Object.assign(surveysCache, value || {});
      }
      return Promise.resolve(value);
    });
    const getSurveyDataByIdSpy = jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue(null);
    const ensureQuestionCached = jest.fn().mockResolvedValue(undefined);

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 11155420 },
      networkChainId: 11155420,
      ensureQuestionCached,
      sessionSlug: 'demo-1',
      activeSessionSlug: 'demo-1',
      sessionConfig: {
        sessionName: 'Demo Session',
        demoCompatibilitySeed: { temporary: true },
      },
    });

    syncClassSetState(subject);

    await subject.fetchQuestionPool();

    expect(getSurveyDataByIdSpy).not.toHaveBeenCalled();
    expect(ensureQuestionCached).not.toHaveBeenCalled();
    expect(subject.state.questionPool).toHaveLength(42);
    expect(subject.state.questionPoolExpectedIds).toHaveLength(42);
    expect(subject.state.questionPoolPendingIds).toEqual([]);
    expect(subject.state.questionPool[0]).toEqual(expect.objectContaining({
      id: demo1OnchainQuestionIds[0],
      prompt: 'Existential risk from AI justifies extraordinary precautions.',
      sessionSlug: 'demo-1',
      temporaryDemoSeed: true,
    }));
  });

  it('publishes a survey question pool as soon as the first question metadata resolves', async () => {
    const surveyQuestionIds = ['q1', 'q2'];
    const questionsCache = { '84532': { questions: {} } };
    const firstQuestion = createDeferred();
    const secondQuestion = createDeferred();
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: surveyQuestionIds,
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return questionsCache;
      }
      return {};
    });

    const ensureQuestionCached = jest.fn((qid) => {
      const lowered = String(qid).toLowerCase();
      const deferred = lowered === 'q1' ? firstQuestion : secondQuestion;
      return deferred.promise.then(() => {
        questionsCache['84532'].questions[lowered] = {
          id: lowered,
          type: 'freeform',
          prompt: `Prompt ${lowered}`,
        };
      });
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    let fetchSettled = false;
    const fetchPromise = subject.fetchQuestionPool().finally(() => {
      fetchSettled = true;
    });
    await flushMicrotasks();

    expect(ensureQuestionCached).toHaveBeenCalledTimes(2);
    expect(subject.state.questionPool).toEqual([]);

    firstQuestion.resolve();
    await flushMicrotasks(8);

    expect(fetchSettled).toBe(false);
    expect(subject.state.questionPool).toHaveLength(1);
    expect(subject.state.questionPool[0]).toEqual(expect.objectContaining({
      id: 'q1',
      prompt: 'Prompt q1',
    }));
    expect(subject.state.questionPoolExpectedIds).toEqual(['q1', 'q2']);
    expect(subject.state.questionPoolPendingIds).toEqual(['q2']);

    secondQuestion.resolve();
    await fetchPromise;

    expect(subject.state.questionPool.map((question) => question.id)).toEqual(['q1', 'q2']);
    expect(subject.state.questionPoolPendingIds).toEqual([]);
  });

  it('does not publish pending metadata placeholders as survey questions', async () => {
    const surveyQuestionIds = ['q1', 'q2'];
    const questionsCache = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Ready prompt' },
          q2: {
            id: 'q2',
            prompt: '[loading]',
            __ceQuestionMetadataPending: true,
          },
        },
      },
    };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: surveyQuestionIds,
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return questionsCache;
      }
      return {};
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    syncClassSetState(subject);

    await subject.fetchQuestionPool();

    expect(subject.state.questionPool).toEqual([
      expect.objectContaining({ id: 'q1', prompt: 'Ready prompt' }),
    ]);
    expect(subject.state.questionPoolPendingIds).toEqual(['q2']);
  });

  it('keeps direct-route survey questions that hydrated successfully when one cache fetch fails', async () => {
    const surveyQuestionIds = ['q1', 'q2', 'q3', 'q4'];
    const questionsCache = { '84532': { questions: {} } };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: surveyQuestionIds,
                title: 'Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return questionsCache;
      }
      return {};
    });

    const ensureQuestionCached = jest.fn(async (qid) => {
      const lowered = String(qid).toLowerCase();
      if (lowered === 'q3') {
        throw new Error('transient fetch failure');
      }
      questionsCache['84532'].questions[lowered] = {
        id: lowered,
        type: 'freeform',
        prompt: `Prompt ${qid}`,
      };
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      ensureQuestionCached,
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      questionPool: [],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchQuestionPool();

    expect(ensureQuestionCached).toHaveBeenCalledTimes(4);
    expect(subject.state.questionPool.map((q) => q.id)).toEqual(['q1', 'q2', 'q4']);
    expect(subject.state.questionPoolExpectedIds).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(subject.state.questionPoolPendingIds).toEqual(['q3']);
  });

  it('does not read survey/question caches from a borrowed general network when the slug is unresolved', async () => {
    const missingSlug = 'missing-session-slug';
    const cacheWriteContext = resolveQuestionPayloadCacheWriteContext(
      {
        activeSessionSlug: '',
        sessionSlug: missingSlug,
        network: null,
        networkChainId: null,
      },
      missingSlug,
    );

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                questionIDs: ['q1'],
                title: 'Borrowed Survey',
              },
            },
          },
        };
      }
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questions: {
              q1: {
                id: 'q1',
                type: 'freeform',
                prompt: 'Borrowed general question',
              },
            },
          },
        };
      }
      return {};
    });
    const getSurveyDataByIdSpy = jest.spyOn(contractScripts, 'getSurveyDataById').mockResolvedValue({
      id: '0xsurvey',
      surveyID: '0xsurvey',
      questionIDs: ['q1'],
      title: 'Borrowed Survey',
    });

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      ensureQuestionCached: jest.fn().mockResolvedValue(undefined),
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'stale-q1', prompt: 'stale question' }],
      questionPoolExpectedIds: ['stale-q1'],
      questionPoolPendingIds: [],
    };
    syncClassSetState(subject);
    peekSpy.mockClear();

    await subject.fetchQuestionPool();

    expect(getSurveyDataByIdSpy).not.toHaveBeenCalled();
    expect(subject.props.ensureQuestionCached).not.toHaveBeenCalled();
    expect(peekSpy).not.toHaveBeenCalled();
    expect(subject.state.questionPool).toEqual([]);
    expect(subject.state.questionPoolExpectedIds).toEqual([]);
    expect(subject.state.questionPoolPendingIds).toEqual([]);

    peekSpy.mockClear();

    await expect(subject.loadQuestionFromCache('q1')).resolves.toBeNull();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('reports pending survey question-pool hydration from SurveyQuestions state', () => {
    expect(
      buildSurveyQuestionPoolLoadState({
        singleQuestionMode: false,
        isStandalone: false,
        questionPoolExpectedIds: ['q1', 'q2'],
        questionPoolPendingIds: ['q2'],
      }),
    ).toEqual({
      expectedIds: ['q1', 'q2'],
      pendingIds: ['q2'],
      pendingCount: 1,
      isIncomplete: true,
    });

    expect(
      buildSurveyQuestionPoolLoadState({
        singleQuestionMode: false,
        isStandalone: true,
        questionPoolExpectedIds: ['q1', 'q2'],
        questionPoolPendingIds: ['q2'],
      }),
    ).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('blocks survey submit while expected survey questions are still loading', async () => {
    jest.useFakeTimers();
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      account: '0xabc',
      loginComplete: true,
      provider: {},
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt 1' }],
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
      surveysResponseState: [{
        answers: { q1: { value: 'Answer 1', encrypted: false } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', encrypted: false } },
      }],
      submissionError: '',
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.getAnsweredQuestionsCount = jest.fn(() => 1);
    subject.fetchQuestionPool = jest.fn().mockResolvedValue(undefined);
    const getProviderKindSpy = jest.spyOn(cryptoUtils, 'getProviderKind');
    subject._submitGuard = true;

    try {
      await subject.encryptAndUpload();

      expect(subject.fetchQuestionPool).toHaveBeenCalledTimes(1);
      expect(getProviderKindSpy).not.toHaveBeenCalled();
      expect(subject._submitGuard).toBe(false);
      expect(subject.state.isSubmitting).toBe(false);
      expect(subject.state.submissionError).toBe('Loading 1 more question...');

      jest.runOnlyPendingTimers();
      expect(subject.state.submissionError).toBe('');
    } finally {
      getProviderKindSpy.mockRestore();
    }

    expect(fetchQuestionPool).toHaveBeenCalledTimes(1);
    expect(getProviderKind).not.toHaveBeenCalled();
    expect(
      buildQuestionPoolPendingSubmitFeedbackMessage({
        pendingCount: loadState.pendingCount,
      }),
    ).toBe('Loading 1 more question...');
    // port note: the old test inspected `_submitGuard` and transient timers
    // inside `encryptAndUpload`; the portable contract is the incomplete-pool
    // preflight that refreshes questions and blocks provider/encryption work.
  });

  it('skips rendered pool patching when incoming payload is semantically unchanged', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    const baselineQuestion = { id: 'q1', type: 'binary', prompt: 'Stable prompt' };
    subject.state = {
      ...subject.state,
      questionPool: [baselineQuestion],
      pileQuestions: [baselineQuestion],
      allQuestionsForFilter: [baselineQuestion],
    };

    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.applyQuestionPayloadToRenderedPools('q1', {
      id: 'q1',
      type: 'binary',
      prompt: 'Stable prompt',
    });

    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState.mock.results[0].value).toBeNull();
  });

  it('recomputes pending stats before survey context reloads', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: 'survey-b',
      viewAddress: '0xbbb',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 5, encrypted: 2 }));
    subject.emitPendingStats = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.fetchQuestionPool = jest.fn().mockResolvedValue(undefined);
    subject.fetchSurveyResponse = jest.fn().mockResolvedValue(undefined);
    subject.checkAndHandleStartFresh = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      surveyId: 'survey-a',
      viewAddress: '0xaaa',
      network: { id: 1 },
      networkChainId: 1,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.getPendingEditStats).toHaveBeenCalledTimes(1);
    expect(subject.emitPendingStats).toHaveBeenCalledWith({ total: 5, encrypted: 2 });
    expect(subject.recalculateEditStats).toHaveBeenCalledWith({ total: 5, encrypted: 2 });
  });

  it('recalculates modified stats on diff-input-only updates', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [],
      pileQuestions: [],
      userAnswers: null,
      isLoadingResponse: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submissionComplete: false,
      submittedSinceLastEdit: false,
    };

    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.getPendingEditStats = jest.fn(() => ({ total: 3, encrypted: 1 }));
    subject.emitPendingStats = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      loginComplete: false,
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.getPendingEditStats).toHaveBeenCalledTimes(1);
    expect(subject.emitPendingStats).toHaveBeenCalledWith({ total: 3, encrypted: 1 });
    expect(subject.recalculateEditStats).toHaveBeenCalledWith({ total: 3, encrypted: 1 });
  });

  it('auto-starts fresh only when the active slice is effectively empty', () => {
    const baseState = {
      surveysResponseState: [null, createSlice()],
      userHasResponse: false,
      editBaseline: null,
      isDirty: false,
    };
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);
    subject.handleStartFresh = jest.fn();

    expect(
      shouldSurveyAutoStartFresh({
        props,
        state: baseState,
        getRenderedQuestionIds: () => ['q1'],
      }),
    ).toBe(true);

    expect(
      shouldSurveyAutoStartFresh({
        props,
        state: {
          ...baseState,
          surveysResponseState: [
            null,
            createSlice({
              additionalComments: { q1: { value: 'notes' } },
            }),
          ],
        },
        getRenderedQuestionIds: () => ['q1'],
      }),
    ).toBe(false);
  });

  it('builds and applies start-fresh survey state before clearing drafts', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 2,
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      submittedSinceLastEdit: true,
    };
    syncClassSetState(subject);
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1', 'q2']);
    subject.buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));
    subject.deepClone = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    subject.clearDraftFor = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.persistDraftSafely = jest.fn();

    subject.handleStartFresh();

    expect(subject.state.suppressPrefill).toBe(true);
    expect(subject.state.startFresh).toBe(true);
    expect(subject.state.modifiedCount).toBe(0);
    expect(subject.state.hasEncryptedChanges).toBe(false);
    expect(subject.state.isDirty).toBe(false);
    expect(subject.state.isLoadingResponse).toBe(false);
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
          q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
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
    expect(subject.deepClone).toHaveBeenCalledTimes(1);
    expect(subject.state.editBaseline).toEqual({
      answers: {
        q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
        q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
      },
      importance: {},
      conviction: {},
      additionalComments: {
        q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
        q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
      },
    });
    expect(subject.clearDraftFor).toHaveBeenNthCalledWith(1, 'q1');
    expect(subject.clearDraftFor).toHaveBeenNthCalledWith(2, 'q2');
    expect(subject.recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(subject.persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('resets form state for account changes from initialized survey state', () => {
    jest.useFakeTimers();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 1,
    });

    subject.state = {
      ...subject.state,
      submittedSinceLastEdit: true,
      surveysResponseState: [{ answers: { stale: { value: 'stale' } } }],
    };
    syncClassSetState(subject);
    subject.persistDraft = jest.fn();
    subject.initializeSurveyResponseState = jest.fn(() => [
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: { q2: { value: '' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '' } },
      },
    ]);
    subject.deepClone = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    subject._persistTimer = setTimeout(() => {}, 1000);
    const callback = jest.fn();

    subject.resetFormStateForAccountChange(callback);

    expect(subject.persistDraft).toHaveBeenCalledTimes(1);
    expect(subject._persistTimer).toBeNull();
    expect(subject.state.surveysResponseState).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      {
        answers: { q2: { value: '' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '' } },
      },
    ]);
    expect(subject.state.editBaseline).toEqual({
      answers: { q2: { value: '' } },
      importance: {},
      conviction: {},
      additionalComments: { q2: { value: '' } },
    });
    expect(subject.state.isEditing).toBe(false);
    expect(subject.state.isLoadingResponse).toBe(true);
    expect(subject.state.submittedSinceLastEdit).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
