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
import { readQuestionsCacheRef } from './surveyToolCacheState';
import {
  buildPileEmptyProbePlan,
  buildPileLoadFailureState,
  buildPileLoadProgressState,
} from './surveyPileLoadPlanner';
import { buildPileEmptyProbeStatePlan, buildPileResponseCountsCachePlan } from './surveyPileLoadController';
import { buildPileQuestionSetHydrationPlan } from './surveyPileHydrationPlan';
import {
  buildPileFilterResultPlan,
  buildPileLoadResultPlan,
  buildPileQuestionPipelineState,
  splitPileMaskedQuestions,
} from './surveyPileQuestionFlow';
import { executePileQuestionSetHydration } from './surveyPileResponseController';
import { buildPileWorkspaceViewState } from './surveyPileViewState';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
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

const ACCOUNT = '0xabc';

const sameQuestionIds = (left, right) =>
  JSON.stringify((left || []).map((question) => String(question.id))) ===
  JSON.stringify((right || []).map((question) => String(question.id)));

const buildQuestionListSignature = (questions = []) =>
  Array.isArray(questions) && questions.length > 0
    ? questions.map((question) => String(question.id || '').toLowerCase()).join('|')
    : 'empty';

const getPileVisibleQuestionIds = (questions = []) =>
  Array.isArray(questions) ? questions.map((question) => String(question.id || '').toLowerCase()).filter(Boolean) : [];

const buildVisibleResponseSignature = (questionResponses = {}, visibleIds = [], account = '') => {
  const accountLower = String(account || '').toLowerCase();
  return visibleIds
    .map((questionId) => {
      const raw = questionResponses?.[questionId]?.[accountLower];
      if (!raw) return `${questionId}:none`;
      return `${questionId}:${JSON.stringify(raw)}`;
    })
    .join('|');
};

const buildLoadResult = ({
  previousAllQuestionsForFilter = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
  previousPileQuestions = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
  sortedQuestions = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
  sortedVisibleQuestions = [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
  questionResponses = { q1: {} },
  account = ACCOUNT,
  isFilterActive = false,
  filterSig = '',
} = {}) =>
  buildPileLoadResultPlan({
    previousAllQuestionsForFilter,
    previousPileQuestions,
    previousActivePileIndex: 0,
    previousHasHiddenGatedQuestions: false,
    previousLoading: false,
    sortedQuestions,
    sortedVisibleQuestions,
    hiddenQuestions: [],
    hasHiddenGatedQuestions: false,
    isFilterActive,
    filterSig,
    questionResponses,
    account,
    settleUnreadyEmpty: false,
    isQuestionCacheReady: true,
    recentRateLimit: false,
    areQuestionListsEquivalent: sameQuestionIds,
    buildQuestionListSignature,
    getPileVisibleQuestionIds,
    buildPileVisibleResponseSignature: buildVisibleResponseSignature,
  });

describe('SurveyTool pile hydration and loading', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('uses clone-free questions cache reads in SurveyQuestions.handleFilter', () => {
    const cacheValue = {
      84532: {
        questionResponses: {
          q1: {
            '0xaa': '{"type":"binary","answer":{"value":"yes"}}',
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
    const subject = new PileViewMode(pileElement.props);

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

  it('resets pile auto-decrypt sweep state through the shared filter hydration lifecycle', () => {
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
      account: '0xabc',
      questionResponsesNonce: 5,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      allQuestionsForFilter: [],
      pileQuestions: [],
      activePileIndex: 0,
      filterState: {},
      hasHiddenGatedQuestions: false,
      autoDecryptEnabled: true,
      autoDecryptAttempted: { 'q1:answer': true },
      decryptingByKey: { 'q1:answer': true },
    };
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();
    subject.queueAutoDecryptVisibleSweep = jest.fn();
    subject._autoDecQueue = [{ qid: 'q1', field: 'answer' }];
    subject._autoDecProcessing = true;
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': 'masked-sig' };

    subject.handleFilter([{ id: 'q1', type: 'binary', prompt: 'Q1' }], {});

    expect(subject.initializeResponseState).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(1);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledWith(true);
    expect(subject.state.autoDecryptAttempted).toEqual({});
    expect(subject.state.decryptingByKey).toEqual({});
    expect(subject._autoDecQueue).toEqual([]);
    expect(subject._autoDecProcessing).toBe(false);
    expect(subject._autoDecryptMaskedAttemptSignature).toEqual({});
    expect(subject.queueAutoDecryptVisibleSweep).toHaveBeenCalledWith('pile-filter-reset');
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
    const subject = new PileViewMode(pileElement.props);

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
    const subject = new PileViewMode(pileElement.props);
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

    expect(plan.nextState.pileQuestions.map((question) => question.id)).toEqual(['q2', 'q1', 'q_blocked']);
    expect(plan.shouldSkipStateUpdate).toBe(true);
    // port note: unresolved session slug cache reads are covered in
    // `SurveyTool.pileSessionScope.module.test.js`; this keeps the pile filter
    // result independent from general-session response/filter config.
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
    const subject = new PileViewMode(pileElement.props);
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
    const subject = new PileViewMode(pileElement.props);

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
    const subject = new PileViewMode(pileElement.props);

    expect(probe).toEqual(
      expect.objectContaining({
        action: 'continue-loading-immediately',
        nextProbeStartedAtMs: 0,
        nextProbeDelayMs: 0,
      }),
    );
    expect(statePlan.nextState).toEqual({
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

  it('keeps pile loading active after load failures while recent rate-limit warming is active', () => {
    expect(
      buildPileLoadFailureState({
        isQuestionCacheReady: true,
        recentRateLimit: true,
      }),
    ).toEqual({ loading: true });
  });

  it('keeps unanswered questions visible in pile mode when response map is empty', () => {
    const pipeline = buildPileQuestionPipelineState({
      questions: [{ id: 'q1', type: 'freeform', prompt: 'Unanswered prompt' }],
      questionResponses: {},
      responseCounts: {},
      highlightedQuestionIds: new Set(),
      account: '',
    });
    const loadResult = buildLoadResult({
      previousAllQuestionsForFilter: [],
      previousPileQuestions: [],
      sortedQuestions: pipeline.sortedQuestions,
      sortedVisibleQuestions: pipeline.visibleQuestions,
      questionResponses: {},
      account: '',
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    expect(pipeline.visibleQuestions.map((question) => question.id)).toEqual(['q1']);
    expect(loadResult.nextState).toEqual(
      expect.objectContaining({
        allQuestionsForFilter: [expect.objectContaining({ id: 'q1' })],
        pileQuestions: [expect.objectContaining({ id: 'q1' })],
        loading: false,
      }),
    );
  });

  it('settles stuck hydrate 0/0 empty piles into deterministic no-questions state', () => {
    const progress = buildPileLoadProgressState({
      scopedProgress: {
        phase: 'hydrate',
        discoveredQuestions: 0,
        hydratedQuestions: 0,
        remainingBlocks: 0,
      },
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      recentRateLimit: false,
    });
    const probe = buildPileEmptyProbePlan({
      ...progress,
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      recentRateLimit: false,
      scopedProgress: {
        phase: 'hydrate',
        discoveredQuestions: 0,
        hydratedQuestions: 0,
        remainingBlocks: 0,
      },
      nowMs: 1000,
    });
    const viewState = buildPileWorkspaceViewState({
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
    subject.isRecentRateLimit = jest.fn(() => true);
    subject._emptyReadyProbeStartedAtMs = Date.now() - 25000;

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(true);
    expect(subject.scheduleLoadAndSortQuestions).not.toHaveBeenCalled();
    expect(subject._emptyReadyProbeStartedAtMs).toBe(0);
  });

  it('keeps pile loading active after load failures while recent rate-limit warming is active', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockRejectedValue(new Error('boom'));

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
    const subject = new PileViewMode(pileElement.props);

    syncClassSetState(subject);
    subject.isRecentRateLimit = jest.fn(() => true);
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

    await subject.loadAndSortQuestions();

    expect(subject.state.loading).toBe(true);
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
    const subject = new PileViewMode(pileElement.props);

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
    const subject = new PileViewMode(pileElement.props);

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
    const subject = new PileViewMode(pileElement.props);

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
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 50000,
        requestedTotalBlocks: 50000,
        scannedBlocks: 12500,
        remainingBlocks: 37500,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [
        { id: 'q1', prompt: 'Q1', type: 'binary' },
      ],
      activePileIndex: 0,
      filterState: { questionTypes: ['freeform'] },
      isFilterActive: true,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
      loadingElapsedSec: 9,
    };

    const tree = subject.render();
    expect(treeHasText(tree, 'No questions match current filters.')).toBe(true);
    expect(treeHasText(tree, 'Loading...')).toBe(false);
  });

  it('keeps pile loading when pending question metadata retries exist after hydrate appears settled', async () => {
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {},
        questionResponses: {},
        pendingQuestionMetadata: {
          q_pending: {
            attempts: 2,
            nextRetryAtMs: Date.now() + 60_000,
          },
        },
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 1,
        pendingMetadataCount: 1,
        remainingBlocks: 0,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: false,
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

    expect(subject.state.loading).toBe(true);
    const tree = subject.render();
    expect(treeHasText(tree, 'Loading...')).toBe(true);
  });

  it('renders terminal scan errors in pile mode instead of continuing full loading', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionScanProgress: {
        slug: 'edge',
        phase: 'error',
        errorCode: 'session_not_found',
        errorMessage: 'No session found for "general".',
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

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

    const tree = subject.render();
    expect(treeHasText(tree, 'No session found for "general".')).toBe(true);
    expect(treeHasText(tree, 'Loading...')).toBe(false);
  });

  it('replays pile hydration when the rendered question response snapshot changes', async () => {
    const cacheState = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Q1' },
        },
        questionResponses: {
          q1: {},
        },
      },
    };
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async () => cacheState);

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

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

    cacheState['84532'].questionResponses.q1['0xabc'] = {
      answer: { value: 'Agree', encrypted: false },
      additional: { value: 'note', encrypted: false },
      importance: 5,
      conviction: 7,
    };
    subject.props = {
      ...subject.props,
      questionResponsesNonce: subject.props.questionResponsesNonce + 1,
      questionsCacheNonce: subject.props.questionsCacheNonce + 1,
    };
    await subject.loadAndSortQuestions();

    expect(subject.initializeResponseState).toHaveBeenCalledTimes(2);
    expect(subject.rehydrateLocalCacheAnswersForRenderedIds).toHaveBeenCalledTimes(2);
    expect(subject.rehydrateDraftForRenderedIds).toHaveBeenCalledTimes(2);
  });

  it('does not replay pile hydration when nonce ticks only touch off-screen responses', async () => {
    const cacheState = {
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Q1' },
        },
        questionResponses: {
          q1: {},
        },
      },
    };
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async () => cacheState);

    expect(secondLoad.resultSignature).toBe(firstLoad.resultSignature);
    expect(
      buildPileQuestionSetHydrationPlan({
        requestEpoch: 5,
        resultSignature: secondLoad.resultSignature,
        lastResultSignature: firstLoad.resultSignature,
        initializeResponses: true,
      }).shouldSkipDuplicateSignature,
    ).toBe(true);
    expect(countsPlan.responseCounts).toEqual({ q1: 0, q2: 1 });
  });
});
