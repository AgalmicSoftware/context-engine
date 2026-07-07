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

const mergeScopedQuestionResponses = (target = {}, source = {}) => mergeQuestionResponses(target, source);

describe('SurveyTool pile response sync and JSON controls', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('emits pending stats with isSubmitting for header submit spinner state', () => {
    const onPendingStatsChange = jest.fn();
    const subject = new SurveyQuestions({
      onPendingStatsChange,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      questionPool: [],
      isStandalone: true,
    });
    subject.state = {
      ...subject.state,
      isSubmitting: true,
      submittedSinceLastEdit: false,
    };

    subject.emitPendingStats({ total: 2, encrypted: 1 });

    expect(onPendingStatsChange).toHaveBeenCalledWith({
      total: 2,
      encrypted: 1,
      submittedSinceLastEdit: false,
      isSubmitting: true,
    });
  });

  it('hides top JSON in single-question mode and hides embedded JSON controls in embedded full mode', () => {
    const questionPool = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }];
    const baseStateSlice = {
      answers: { q1: { value: '', encrypted: false } },
      importance: {},
      conviction: {},
      additionalComments: { q1: { value: '', encrypted: false } },
    };

    const embeddedFull = new SurveyQuestions({
      hideEmbeddedDebugUi: true,
      useHeaderSubmit: true,
      isStandalone: true,
      singleQuestionMode: false,
      questionPool,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    embeddedFull.state = {
      ...embeddedFull.state,
      questionPool,
      surveysResponseState: [baseStateSlice],
      displayAnswerMode: false,
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
    };
    embeddedFull.renderQuestion = jest.fn(() => null);
    const embeddedTree = embeddedFull.render();
    expect(treeHasLabel(embeddedTree, '.json')).toBe(false);

    const singleQuestion = new SurveyQuestions({
      hideEmbeddedDebugUi: false,
      useHeaderSubmit: true,
      isStandalone: false,
      singleQuestionMode: true,
      questionPool,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    singleQuestion.state = {
      ...singleQuestion.state,
      questionPool,
      surveysResponseState: [baseStateSlice],
      displayAnswerMode: false,
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
    };
    singleQuestion.renderQuestion = jest.fn(() => null);
    const singleQuestionTree = singleQuestion.render();
    expect(treeHasLabel(singleQuestionTree, '.json')).toBe(false);
    expect(treeHasLabel(singleQuestionTree, 'Back to top')).toBe(false);
  });

  it('shows question and response JSON controls for standalone questions pages with multiple questions', () => {
    const questionPool = [
      { id: 'q1', type: 'freeform', prompt: 'Q1' },
      { id: 'q2', type: 'freeform', prompt: 'Q2' },
    ];
    const baseStateSlice = {
      answers: {
        q1: { value: '', encrypted: false },
        q2: { value: '', encrypted: false },
      },
      importance: {},
      conviction: {},
      additionalComments: {
        q1: { value: '', encrypted: false },
        q2: { value: '', encrypted: false },
      },
    };

    const standaloneQuestions = new SurveyQuestions({
      hideEmbeddedDebugUi: false,
      useHeaderSubmit: true,
      isStandalone: true,
      singleQuestionMode: false,
      questionPool,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    standaloneQuestions.state = {
      ...standaloneQuestions.state,
      questionPool,
      surveysResponseState: [baseStateSlice],
      displayAnswerMode: false,
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
    };
    standaloneQuestions.renderQuestion = jest.fn(() => null);

    const standaloneTree = standaloneQuestions.render();

    expect(treeHasLabel(standaloneTree, 'question .json')).toBe(true);
    expect(treeHasLabel(standaloneTree, 'response .json')).toBe(true);
    expect(treeHasLabel(standaloneTree, 'View Survey .json')).toBe(false);
  });

  it('schedules pile reload on questionResponsesNonce tick', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      submissionComplete: false,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: false,
      decryptingByKey: {},
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };
    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 6,
    };
    const prevState = { ...subject.state };
    subject.props = {
      ...subject.props,
      questionResponsesNonce: 7,
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalledWith(80);
  });

  it('checks optimistic pile cache baseline on questionResponsesNonce tick instead of scheduling a reload', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      submissionComplete: true,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: false,
      decryptingByKey: {},
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };
    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 6,
    };
    const prevState = { ...subject.state };
    subject.props = {
      ...subject.props,
      questionResponsesNonce: 7,
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.checkCacheAgainstBaseline).toHaveBeenCalledTimes(1);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();
  });

  it('resets pile runtime context and reloads immediately on account change', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._isMounted = true;
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      submissionComplete: true,
      submittedSinceLastEdit: true,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: true,
      decryptingByKey: { 'q1:answer': true },
      surveysResponseState: [{ answers: { q1: { value: 'draft' } }, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: { q1: { value: 'draft' } }, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };
    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.persistDraft = jest.fn();
    subject.loadAndSortQuestions = jest.fn();
    subject.clearAutoDecryptSweepScheduling = jest.fn();
    subject._autoDecQueue = [{ qid: 'q1', field: 'answer' }];
    subject._autoDecProcessing = true;
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': 'masked-sig' };

    const prevProps = {
      ...subject.props,
      account: '',
      loginComplete: false,
    };
    const prevState = { ...subject.state };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.persistDraft).toHaveBeenCalledTimes(1);
    expect(subject.loadAndSortQuestions).toHaveBeenCalledTimes(1);
    expect(subject.clearAutoDecryptSweepScheduling).toHaveBeenCalledTimes(1);
    expect(subject.state.loading).toBe(true);
    expect(subject.state.pileQuestions).toEqual([]);
    expect(subject.state.activePileIndex).toBe(0);
    expect(subject.state.submissionComplete).toBe(false);
    expect(subject.state.submittedSinceLastEdit).toBe(false);
    expect(subject.state.editBaseline).toBeNull();
    expect(subject.state.surveysResponseState).toEqual([
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
    ]);
    expect(subject.state.autoDecryptEnabled).toBe(false);
    expect(subject.state.decryptingByKey).toEqual({});
    expect(subject._autoDecQueue).toEqual([]);
    expect(subject._autoDecProcessing).toBe(false);
    expect(subject._autoDecryptMaskedAttemptSignature).toEqual({});
  });

  it('queues pile auto-decrypt refresh on response nonce updates while enabled and unblocked', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      allQuestionsForFilter: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      activePileIndex: 0,
      submissionComplete: false,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: true,
      decryptingByKey: {},
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };
    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();
    subject.isAutoDecryptBlocked = jest.fn(() => false);
    subject.queueAutoDecryptVisibleSweep = jest.fn();

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 6,
    };
    const prevState = { ...subject.state };
    subject.props = {
      ...subject.props,
      questionResponsesNonce: 7,
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalledWith(80);
    expect(subject.queueAutoDecryptVisibleSweep).toHaveBeenCalledWith('pile-state-change');
  });

  it('keeps optimistic pile state when cache has stale value for a cleared baseline answer', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      submissionComplete: true,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      editBaseline: {
        answers: { q1: { value: '', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      },
    };
    subject.loadAndSortQuestions = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': JSON.stringify({
                answer: { value: 'stale-answer' },
                additional: { value: '' },
              }),
            },
          },
        },
      };
    });

    subject.checkCacheAgainstBaseline();

    expect(subject.state.submissionComplete).toBe(true);
    expect(subject.loadAndSortQuestions).not.toHaveBeenCalled();
  });

  it('syncs pile baseline once cache catches up with the optimistic response', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      submissionComplete: true,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      editBaseline: {
        answers: { q1: { value: 'cached-answer', encrypted: false } },
        additionalComments: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
      },
    };
    syncClassSetState(subject);
    subject.loadAndSortQuestions = jest.fn();

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': JSON.stringify({
                answer: { value: 'cached-answer' },
                additional: { value: '' },
              }),
            },
          },
        },
      };
    });

    subject.checkCacheAgainstBaseline();

    expect(subject.state.submissionComplete).toBe(false);
    expect(subject.loadAndSortQuestions).toHaveBeenCalledTimes(1);
  });

  it('does not prefill pile answers from a borrowed general response cache when the slug is unresolved', () => {
    const prefillPlan = buildPilePrefillReadPlan({
      account: '0xabc',
      networkIdStr: '',
      pileQuestions: [createQuestion('q1')],
    });
    const readQuestionsCache = jest.fn(() => ({
      84532: {
        questionResponses: {
          q1: {
            '0xabc': {
              answer: { value: 'wrong-general-answer', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          },
        },
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      isDirty: false,
      modifiedCount: 0,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: null,
    };
    subject.updateJsonPreview = jest.fn();
    syncClassSetState(subject);
    peekSpy.mockClear();

    subject.prefillUserAnswersFromCache();

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.state.surveysResponseState?.[0]?.answers?.q1).toBeUndefined();
    expect(subject.state.editBaseline).toBeNull();
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('patches live pile survey state from cache prefill without overwriting an existing edit baseline', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      isDirty: false,
      modifiedCount: 0,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: {
        answers: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', encrypted: false } },
      },
    };
    subject.updateJsonPreview = jest.fn();
    syncClassSetState(subject);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': {
                answer: { value: 'cached-answer', encrypted: false },
                additional: { value: '', encrypted: false },
              },
            },
          },
        },
      };
    });

    subject.prefillUserAnswersFromCache();

    expect(subject.state.surveysResponseState?.[0]?.answers?.q1?.value).toBe('cached-answer');
    expect(subject.state.editBaseline?.answers?.q1?.value).toBe('');
  });

  it('seeds an empty pile baseline from cache prefill when no edit baseline exists yet', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      isDirty: false,
      modifiedCount: 0,
      pileQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: null,
      baselineResponses: null,
    };
    subject.updateJsonPreview = jest.fn();
    syncClassSetState(subject);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questionResponses: {
            q1: {
              '0xabc': {
                answer: { value: 'cached-answer', encrypted: false },
                additional: { value: '', encrypted: false },
              },
            },
          },
        },
      };
    });

    subject.prefillUserAnswersFromCache();

    expect(subject.state.surveysResponseState?.[0]?.answers?.q1?.value).toBe('cached-answer');
    expect(subject.state.editBaseline?.answers?.q1?.value).toBe('cached-answer');
    expect(subject.state.baselineResponses?.answers?.q1?.value).toBe('cached-answer');
    expect(subject.state.modifiedCount).toBe(0);
    expect(subject.state.isDirty).toBe(false);
  });

  it('hydrates off-screen pile draft answers so submit count stays aligned with full mode', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionResponsesNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      pileQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Q1' },
        { id: 'q2', type: 'freeform', prompt: 'Q2' },
        { id: 'q3', type: 'freeform', prompt: 'Q3' },
        { id: 'q4', type: 'freeform', prompt: 'Q4' },
        { id: 'q5', type: 'freeform', prompt: 'Q5' },
        { id: 'q6', type: 'freeform', prompt: 'Q6' },
      ],
      activePileIndex: 0,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      isDirty: false,
      modifiedCount: 0,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
    };

    subject.loadDraft = jest.fn(() => ({
      answers: {
        q6: {
          value: 'off-screen draft',
          answerEncrypted: false,
          additional: '',
          additionalEncrypted: false,
          importance: null,
          conviction: null,
        },
      },
    }));
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1', 'q2', 'q3']);
    subject.setState = (updater, callback) => {
      const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof callback === 'function') callback();
    };

    subject.rehydrateDraftForRenderedIds(true);

    expect(subject.state.surveysResponseState?.[0]?.answers?.q6?.value).toBe('off-screen draft');
  });});
