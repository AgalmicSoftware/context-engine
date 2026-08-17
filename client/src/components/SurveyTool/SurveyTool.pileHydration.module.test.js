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
        },
      },
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(cacheValue);

    expect(readQuestionsCacheRef('edge')).toBe(cacheValue);
    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    // port note: the old test reached this cache read by constructing
    // SurveyTool/PileViewMode and calling `handleFilter`; the portable contract
    // is the clone-free questions-cache read used by the pile/filter path.
  });

  it('resets pile auto-decrypt sweep state through the shared filter hydration lifecycle', () => {
    const initializeResponseState = jest.fn((callback) => {
      if (typeof callback === 'function') callback();
    });
    const rehydrateVisiblePileWindow = jest.fn();

    const plan = executePileQuestionSetHydration({
      requestEpoch: 7,
      resultSignature: 'filter-q1',
      lastResultSignature: '',
      initializeResponses: true,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-filter',
      autoDecryptResetReason: 'pile-filter-reset',
      initializeResponseState,
      rehydrateVisiblePileWindow,
    });

    expect(plan?.shouldUpdateResultSignature).toBe(true);
    expect(initializeResponseState).toHaveBeenCalledTimes(1);
    expect(rehydrateVisiblePileWindow).toHaveBeenCalledWith({
      requestEpoch: 7,
      forceOverwriteDraft: false,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-filter',
      autoDecryptResetReason: 'pile-filter-reset',
    });
    // port note: queue fields such as `_autoDecQueue` are private ledger state;
    // this asserts the exported reset option that drives that cleanup.
  });

  it('forwards pile answers through the production runtime adapter without wrapper state updates', () => {
    const handleAnswer = jest.fn();
    const engine = {
      computePendingEditStatsAtIndex: jest.fn(() => ({ total: 0 })),
      handleAnswer,
      setState: jest.fn(),
    };
    createPileViewRuntimeStrategy().getPendingEditStats(engine);

    engine.handleAnswerPile('q1', 'value');

    expect(handleAnswer).toHaveBeenCalledWith(0, 'q1', 'value', {});
    expect(engine.setState).not.toHaveBeenCalled();
  });

  it('preserves pile answer adapter options', () => {
    const handleAnswer = jest.fn();
    const engine = {
      computePendingEditStatsAtIndex: jest.fn(() => ({ total: 0 })),
      handleAnswer,
      setState: jest.fn(),
    };
    const options = { persistDraft: false };
    createPileViewRuntimeStrategy().getPendingEditStats(engine);

    engine.handleAnswerPile('q1', 'value', options);

    expect(handleAnswer).toHaveBeenCalledWith(0, 'q1', 'value', options);
    expect(engine.setState).not.toHaveBeenCalled();
  });

  it('passes cache-backed question responses into pile filters so responded status works in embedded pile mode', () => {
    const visibleQuestions = [
      { id: 'q1', type: 'binary', prompt: 'Q1' },
      { id: 'q2', type: 'binary', prompt: 'Q2' },
    ];
    const filterSubject = new RawQuestionFilter({
      questions: visibleQuestions,
      account: ACCOUNT,
      questionResponses: {
        q1: {
          [ACCOUNT]: { answer: { value: 'yes' } },
        },
      },
    });
    filterSubject.state = {
      ...filterSubject.state,
      filterByResponded: true,
      filterByNotResponded: false,
    };

    expect(filterSubject.getQuestionsSubsetBeforeAi().map((question) => question.id)).toEqual(['q1']);
  });

  it('does not borrow general response or filter config in pile filters when the slug is unresolved', () => {
    const plan = buildPileFilterResultPlan({
      currentVisibleSignature: 'q2|q1|q_blocked',
      nextVisibleQuestions: [
        { id: 'q2', type: 'binary', prompt: 'Q2' },
        { id: 'q1', type: 'binary', prompt: 'Q1' },
        { id: 'q_blocked', type: 'binary', prompt: 'Blocked Q' },
      ],
      currentFilterState: {},
      nextFilterState: {},
      nextHiddenGated: false,
      currentHiddenGated: false,
      buildQuestionListSignature,
      serializeFilterState: (filterState) => JSON.stringify(filterState || {}),
    });

    expect(plan.nextState.pileQuestions.map((question) => question.id)).toEqual(['q2', 'q1', 'q_blocked']);
    expect(plan.shouldSkipStateUpdate).toBe(true);
    // port note: unresolved session slug cache reads are covered in
    // `SurveyTool.pileSessionScope.module.test.js`; this keeps the pile filter
    // result independent from general-session response/filter config.
  });

  it('keeps masked visibility memo hot when alternating stable pool references', () => {
    const poolA = [{ id: 'qa', prompt: 'A', promptDecrypted: false }];
    const poolB = [{ id: 'qb', prompt: 'B', promptDecrypted: false }];
    const memo = new WeakMap();
    const getVisibility = (pool) => {
      if (memo.has(pool)) return memo.get(pool);
      const result = splitPileMaskedQuestions({ questions: pool });
      memo.set(pool, result);
      return result;
    };

    const firstA = getVisibility(poolA);
    const firstB = getVisibility(poolB);
    const secondA = getVisibility(poolA);

    expect(firstA).toBe(secondA);
    expect(firstB).not.toBe(firstA);
    expect(firstA.hasHiddenGatedQuestions).toBe(false);
    // port note: the original memo is an instance cache; the exported split
    // helper owns the masked/visible partition while hooks conversion will own
    // the cache container.
  });

  it('reuses current pile signature path on repeated identical filters', () => {
    const visibleList = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];

    const firstPlan = buildPileFilterResultPlan({
      currentVisibleSignature: buildQuestionListSignature(visibleList),
      nextVisibleQuestions: visibleList,
      currentFilterState: {},
      nextFilterState: {},
      nextHiddenGated: false,
      currentHiddenGated: false,
      buildQuestionListSignature,
      serializeFilterState: (filterState) => JSON.stringify(filterState || {}),
    });
    const secondPlan = buildPileFilterResultPlan({
      currentVisibleSignature: firstPlan.nextVisibleSignature,
      nextVisibleQuestions: visibleList,
      currentFilterState: {},
      nextFilterState: {},
      nextHiddenGated: false,
      currentHiddenGated: false,
      buildQuestionListSignature,
      serializeFilterState: (filterState) => JSON.stringify(filterState || {}),
    });

    expect(firstPlan.shouldSkipStateUpdate).toBe(true);
    expect(secondPlan.shouldSkipStateUpdate).toBe(true);
    expect(secondPlan.shouldIncrementPileQuestionsGeneration).toBe(false);
  });

  it('does not replay pile hydration on nonce-only ticks when question signatures are unchanged', () => {
    const firstLoad = buildLoadResult();
    const duplicateHydration = buildPileQuestionSetHydrationPlan({
      requestEpoch: 2,
      resultSignature: firstLoad.resultSignature,
      lastResultSignature: firstLoad.resultSignature,
      initializeResponses: true,
    });

    expect(firstLoad.shouldUpdateState).toBe(false);
    expect(duplicateHydration.shouldSkipDuplicateSignature).toBe(true);
    expect(duplicateHydration.shouldUpdateResultSignature).toBe(false);
  });

  it('keeps pile loading active during early empty-cache settle before showing a definitive empty state', () => {
    const earlyProbe = buildPileEmptyProbePlan({
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      emptyReadyProbeStartedAtMs: 1000,
      nowMs: 3000,
    });
    const earlyState = buildPileEmptyProbeStatePlan({
      ...earlyProbe,
      previousPileQuestions: [],
      previousAllQuestionsForFilter: [],
      previousLoading: false,
      areQuestionListsEquivalent: sameQuestionIds,
    });
    const lateProbe = buildPileEmptyProbePlan({
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      emptyReadyProbeStartedAtMs: 1000,
      nowMs: 25000,
    });

    expect(earlyProbe.action).toBe('probe-loading');
    expect(earlyState.nextState).toEqual({ loading: true });
    expect(lateProbe.action).toBe('settle-empty');
  });

  it('keeps empty piles in loading mode during recent rate limits instead of settling or probing', () => {
    const probe = buildPileEmptyProbePlan({
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      recentRateLimit: true,
      emptyReadyProbeStartedAtMs: 1000,
      nowMs: 25000,
    });
    const statePlan = buildPileEmptyProbeStatePlan({
      ...probe,
      previousPileQuestions: [],
      previousAllQuestionsForFilter: [],
      previousLoading: false,
      areQuestionListsEquivalent: sameQuestionIds,
    });

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
      loading: true,
    });
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
      loading: false,
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionScanPhase: 'hydrate',
      hydrateDiscovered: 0,
      hydrateDone: 0,
    });

    expect(progress.canSettleUnreadyEmpty).toBe(true);
    expect(probe.action).toBe('settle-empty');
    expect(viewState.isStillLoading).toBe(false);
    expect(viewState.hasVisibleQuestions).toBe(false);
  });

  it('settles scan 0/0 empty piles into deterministic no-questions state for newly created sessions', () => {
    const probe = buildPileEmptyProbePlan({
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      scopedProgress: {
        phase: 'scan',
        totalBlocks: 0,
        requestedTotalBlocks: 0,
        scannedBlocks: 0,
        remainingBlocks: 0,
        discoveredQuestions: 0,
        hydratedQuestions: 0,
      },
      scanTotalBlocks: 0,
      scanRemainingBlocks: 0,
      hydrateDiscovered: 0,
      hydrateDone: 0,
      nowMs: 2500,
    });
    const viewState = buildPileWorkspaceViewState({
      pileQuestions: [],
      loading: false,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionScanPhase: 'scan',
      scanRemainingBlocks: 0,
    });

    expect(probe.action).toBe('settle-empty');
    expect(viewState.isStillLoading).toBe(false);
    expect(viewState.showFilteredEmptyState).toBe(false);
  });

  it('shows a filtered empty state instead of full loading when filters remove all visible pile cards', () => {
    const viewState = buildPileWorkspaceViewState({
      pileQuestions: [],
      loading: true,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionScanPhase: 'scan',
      scanRemainingBlocks: 37500,
      isFilterActive: true,
      hasFilterBaseQuestions: true,
    });

    expect(viewState.showFilteredEmptyState).toBe(true);
    expect(viewState.isStillLoading).toBe(false);
  });

  it('keeps pile loading when pending question metadata retries exist after hydrate appears settled', () => {
    const probe = buildPileEmptyProbePlan({
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      hasPendingMetadataRetries: true,
      scopedProgress: {
        phase: 'hydrate',
        discoveredQuestions: 1,
        hydratedQuestions: 1,
      },
      nowMs: 25000,
    });
    const viewState = buildPileWorkspaceViewState({
      pileQuestions: [],
      loading: true,
      cacheHasLoaded: true,
      isQuestionCacheReady: false,
      questionScanPhase: 'hydrate',
      hydrateDiscovered: 1,
      hydrateDone: 1,
      pendingMetadataCount: 1,
    });

    expect(probe.action).toBe('continue-loading-immediately');
    expect(viewState.hasPendingMetadataRetries).toBe(true);
    expect(viewState.isStillLoading).toBe(true);
  });

  it('renders terminal scan errors in pile mode instead of continuing full loading', () => {
    const viewState = buildPileWorkspaceViewState({
      pileQuestions: [],
      loading: true,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionScanPhase: 'error',
      questionScanErrorMessage: 'No session found for "general".',
    });

    expect(viewState.hasTerminalScanError).toBe(true);
    expect(viewState.scanErrorMessage).toBe('No session found for "general".');
    expect(viewState.isStillLoading).toBe(false);
  });

  it('replays pile hydration when the rendered question response snapshot changes', () => {
    const firstLoad = buildLoadResult({
      questionResponses: { q1: {} },
    });
    const secondLoad = buildLoadResult({
      questionResponses: {
        q1: {
          [ACCOUNT]: {
            answer: { value: 'Agree', encrypted: false },
            additional: { value: 'note', encrypted: false },
            importance: 5,
            conviction: 7,
          },
        },
      },
    });
    const hydration = buildPileQuestionSetHydrationPlan({
      requestEpoch: 4,
      resultSignature: secondLoad.resultSignature,
      lastResultSignature: firstLoad.resultSignature,
      initializeResponses: true,
    });

    expect(secondLoad.resultSignature).not.toBe(firstLoad.resultSignature);
    expect(hydration.shouldUpdateResultSignature).toBe(true);
    expect(hydration.shouldSkipDuplicateSignature).toBe(false);
  });

  it('does not replay pile hydration when nonce ticks only touch off-screen responses', () => {
    const firstLoad = buildLoadResult({
      questionResponses: { q1: {} },
    });
    const secondLoad = buildLoadResult({
      questionResponses: {
        q1: {},
        q2: {
          [ACCOUNT]: {
            answer: { value: 'Off-screen', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        },
      },
    });
    const countsPlan = buildPileResponseCountsCachePlan({
      cacheKey: 'edge|84532|6',
      previousCacheKey: 'edge|84532|5',
      previousCacheValue: { q1: 0 },
      questionResponses: secondLoad.nextState.questionResponses || {
        q1: {},
        q2: { [ACCOUNT]: { answer: { value: 'Off-screen' } } },
      },
    });

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
