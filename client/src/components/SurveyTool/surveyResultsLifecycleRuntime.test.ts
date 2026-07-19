import type { SurveyResultsProps, SurveyResultsState } from './SurveyResults';
import {
  runSurveyResultsComponentDidMount,
  runSurveyResultsComponentDidUpdate,
  type SurveyResultsLifecycleInstance,
  type SurveyResultsLifecyclePorts,
} from './surveyResultsLifecycleRuntime';

type PatchCall = {
  afterApply?: () => void;
  patch: Record<string, unknown>;
};

const createProps = (patch: Record<string, unknown> = {}): SurveyResultsProps =>
  ({
    filterState: {},
    filteredQuestionsCount: 0,
    isOpen: false,
    isQuestionCacheReady: false,
    isResponsesCacheReady: false,
    isSurveyCacheReady: false,
    preventUrlChange: false,
    questionResponsesNonce: 0,
    surveyId: '',
    viewMode: 'questions',
    ...patch,
  }) as SurveyResultsProps;

const createState = (patch: Record<string, unknown> = {}): SurveyResultsState =>
  ({
    demoResultsAtlasNodeId: null,
    demoResultsViewMode: 'raw',
    filterState: {},
    filteredQuestionsCount: 0,
    networkLatestBlock: 0,
    questionLocalBlock: 0,
    questionResultsHydrated: false,
    refreshTargetQuestionBlock: 0,
    refreshTargetResponseBlock: 0,
    refreshTargetSurveyBlock: 0,
    responseLocalBlock: 0,
    surveyId: '',
    surveyLocalBlock: 0,
    surveyResultsHydrated: false,
    viewMode: 'questions',
    ...patch,
  }) as SurveyResultsState;

const createInstance = (): SurveyResultsLifecycleInstance => ({
  _lastNotifiedFilterStateSignature: 'already-notified',
  _responseParseMemo: { clear: jest.fn() },
  _surveyModeSourceSignature: 'memoized-source',
  _syncLoadingStartedAt: null,
});

const createHarness = () => {
  const patchCalls: PatchCall[] = [];
  const queuedRefreshes: string[] = [];
  const resetReasons: string[] = [];
  const events: string[] = [];
  const ports: SurveyResultsLifecyclePorts = {
    appendSessionHintToSurveyPath: (path) => `${path}?session=edge`,
    applyStatePatch: (patch, afterApply) => {
      patchCalls.push({ patch, afterApply });
      events.push('applyStatePatch');
      if (afterApply) afterApply();
    },
    buildQuestionReadScopeSignature: ({ props }) => String(props.sessionSlug || ''),
    handleNonceTick: () => {
      events.push('handleNonceTick');
    },
    queueResultsRefresh: (reason) => {
      queuedRefreshes.push(reason);
      events.push(`queue:${reason}`);
    },
    resetLocalStoragePollingBackoff: (reason) => {
      resetReasons.push(reason);
      events.push(`reset:${reason}`);
    },
    stopLocalStoragePolling: () => {
      events.push('stopPolling');
    },
    updateLocalStoragePollingState: () => {
      events.push('updatePolling');
    },
    updateParentWithCurrentFiltersForUrl: () => {
      events.push('updateParentFilters');
    },
  };
  return {
    events,
    patchCalls,
    ports,
    queuedRefreshes,
    resetReasons,
  };
};

describe('runSurveyResultsComponentDidUpdate', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/survey/old/results');
  });

  it('resets hydrated state and closes the results URL when the modal closes', () => {
    const instance = createInstance();
    const harness = createHarness();

    runSurveyResultsComponentDidUpdate({
      instance,
      ports: harness.ports,
      prevProps: createProps({ isOpen: true }),
      prevState: createState({ viewMode: 'survey', surveyId: 'survey-1' }),
      props: createProps({ isOpen: false }),
      state: createState({
        demoResultsAtlasNodeId: 'node-1',
        demoResultsViewMode: 'atlas',
        questionResultsHydrated: true,
        surveyId: 'survey-1',
        surveyResultsHydrated: true,
        viewMode: 'survey',
      }),
    });

    expect(window.location.pathname).toBe('/survey/survey-1');
    expect(window.location.search).toBe('?session=edge');
    expect(harness.patchCalls[0].patch).toMatchObject({
      demoResultsAtlasNodeId: null,
      demoResultsViewMode: 'raw',
      questionResultsHydrated: false,
      surveyResultsHydrated: false,
    });
    expect(harness.events).toContain('stopPolling');
    expect(harness.resetReasons).toContain('modal-closed');
    expect(instance._syncLoadingStartedAt).toBeNull();
    expect(instance._responseParseMemo?.clear).toHaveBeenCalledTimes(1);
  });

  it('applies changed filter props before running modal-open URL side effects', () => {
    window.history.replaceState({}, '', '/questions');
    const instance = createInstance();
    const harness = createHarness();

    runSurveyResultsComponentDidUpdate({
      instance,
      ports: harness.ports,
      prevProps: createProps({
        filterState: { type: 'old' },
        isOpen: false,
      }),
      prevState: createState({ viewMode: 'questions' }),
      props: createProps({
        filterState: { type: 'new' },
        isOpen: true,
      }),
      state: createState({
        demoResultsAtlasNodeId: 'atlas-node',
        demoResultsViewMode: 'atlas',
        filterState: { type: 'old' },
        questionResultsHydrated: true,
        viewMode: 'questions',
      }),
    });

    expect(harness.patchCalls[0].patch).toMatchObject({
      demoResultsAtlasNodeId: null,
      demoResultsViewMode: 'raw',
      filterState: { type: 'new' },
      questionResultsHydrated: false,
    });
    expect(harness.events.indexOf('applyStatePatch')).toBeLessThan(harness.events.indexOf('updateParentFilters'));
    expect(window.location.pathname).toBe('/questions/results');
    expect(window.location.search).toBe('?session=edge');
    expect(harness.queuedRefreshes).toContain('modal-open');
    expect(harness.resetReasons).toEqual(expect.arrayContaining(['modal-open', 'modal-open-state-change']));
    expect(instance._lastNotifiedFilterStateSignature).toBeNull();
  });

  it('resets view-mode cache state and queues a view-mode refresh', () => {
    const instance = createInstance();
    const harness = createHarness();

    runSurveyResultsComponentDidUpdate({
      instance,
      ports: harness.ports,
      prevProps: createProps(),
      prevState: createState({ viewMode: 'survey' }),
      props: createProps(),
      state: createState({
        questionResultsHydrated: true,
        surveyId: 'survey-1',
        surveyResultsHydrated: true,
        viewMode: 'questions',
      }),
    });

    expect(instance._surveyModeSourceSignature).toBe('');
    expect(harness.patchCalls[0].patch).toMatchObject({
      demoResultsAtlasNodeId: null,
      demoResultsViewMode: 'raw',
      questionLocalBlock: 0,
      questionResultsHydrated: false,
      responseLocalBlock: 0,
      surveyId: '',
    });
    expect(harness.resetReasons).toContain('view-mode-change');
    expect(harness.queuedRefreshes).toContain('view-mode-change');
  });

  it('queues question-scope reset patches before dispatching refresh reasons', () => {
    const instance = createInstance();
    const harness = createHarness();
    harness.ports.buildQuestionReadScopeSignature = ({ props }) => String(props.sessionSlug || '');

    runSurveyResultsComponentDidUpdate({
      instance,
      ports: harness.ports,
      prevProps: createProps({
        isOpen: true,
        sessionSlug: 'old',
      }),
      prevState: createState({ viewMode: 'questions' }),
      props: createProps({
        isOpen: true,
        sessionSlug: 'new',
      }),
      state: createState({
        aggregatorQuestionResponses: { q1: [] },
        filteredQuestionsCount: 1,
        filteredResponsesCount: 1,
        isOpen: true,
        questionResponses: { q1: {} },
        questionResultsHydrated: true,
        sbtFilteredAggregatorQuestionResponses: { q1: [] },
        totalQuestionsCount: 1,
        totalResponsesCount: 1,
        viewMode: 'questions',
      }),
    });

    expect(harness.patchCalls[0].patch).toMatchObject({
      aggregatorQuestionResponses: {},
      filteredQuestionsCount: 0,
      filteredResponsesCount: 0,
      questionResponses: {},
      questionResultsHydrated: false,
      sbtFilteredAggregatorQuestionResponses: {},
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
    });
    expect(harness.events.indexOf('applyStatePatch')).toBeLessThan(
      harness.events.indexOf('queue:question-scope-change'),
    );
    expect(harness.queuedRefreshes).toContain('question-scope-change');
  });
});

describe('runSurveyResultsComponentDidMount', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/questions');
  });

  it('initializes open question results and cleans up the results URL on unmount', () => {
    const instance = {
      ...createInstance(),
      _isMounted: false,
      _nonceTickInFlight: true,
      _nonceTickQueued: true,
      _pollLatestBlockFetchInFlight: true,
      _scrollMutationObserver: { disconnect: jest.fn() } as unknown as MutationObserver,
      _scrollToQuestionRetryTimer: setTimeout(() => {}, 1000),
      _unsubscribeCacheUpdates: null,
    };
    const unsubscribe = jest.fn();
    const refreshQuestionMetadata = jest.fn();
    const refreshQuestionResponses = jest.fn();
    const events: string[] = [];
    const patchCalls: PatchCall[] = [];
    const props = createProps({
      isOpen: true,
      refreshQuestionMetadata,
      refreshQuestionResponses,
      viewMode: 'questions',
    });
    const state = createState({
      viewMode: 'questions',
    });

    const cleanup = runSurveyResultsComponentDidMount({
      instance,
      ports: {
        appendSessionHintToSurveyPath: (path) => `${path}?session=edge`,
        applyStatePatch: (patch, afterApply) => {
          patchCalls.push({ patch, afterApply });
          events.push('applyStatePatch');
          if (afterApply) afterApply();
        },
        destroyFetchResponsesRuntime: () => events.push('destroyFetch'),
        destroyLocalStoragePollingRuntime: () => events.push('destroyPolling'),
        destroyQueuedResultsRefreshRuntime: () => events.push('destroyQueue'),
        getProps: () => props,
        getState: () => state,
        handleDocumentVisibilityChange: () => events.push('visibility'),
        handleManagedCacheUpdate: () => events.push('cacheUpdate'),
        handleManualRefresh: () => events.push('manualRefresh'),
        handleUrlBasedView: () => events.push('urlBasedView'),
        handleUrlChange: () => events.push('urlChange'),
        queueResultsRefresh: (reason) => events.push(`queue:${reason}`),
        subscribeCacheUpdates: () => unsubscribe,
        updateLocalStoragePollingState: () => events.push('updatePolling'),
        updateParentWithCurrentFiltersForUrl: () => events.push('updateParentFilters'),
      },
    });

    expect(instance._isMounted).toBe(true);
    expect(patchCalls[0].patch).toMatchObject({
      surveyId: '',
      viewMode: 'questions',
    });
    expect(refreshQuestionMetadata).toHaveBeenCalledTimes(1);
    expect(refreshQuestionResponses).toHaveBeenCalledTimes(1);
    expect(events).toEqual(
      expect.arrayContaining([
        'urlBasedView',
        'updatePolling',
        'manualRefresh',
        'queue:mount-open',
        'updateParentFilters',
      ]),
    );
    expect(window.location.pathname).toBe('/questions/results');
    expect(window.location.search).toBe('?session=edge');

    cleanup();

    expect(instance._isMounted).toBe(false);
    expect(instance._nonceTickInFlight).toBe(false);
    expect(instance._nonceTickQueued).toBe(false);
    expect(instance._pollLatestBlockFetchInFlight).toBe(false);
    expect(instance._responseParseMemo?.clear).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(instance._scrollMutationObserver).toBeNull();
    expect(instance._scrollToQuestionRetryTimer).toBeNull();
    expect(events).toEqual(expect.arrayContaining(['destroyFetch', 'destroyQueue', 'destroyPolling']));
    expect(window.location.pathname).toBe('/questions');
    expect(window.location.search).toBe('?session=edge');
  });

  it('reports a rejected detached survey refresh without leaking the rejection', async () => {
    const instance = createInstance();
    const error = new Error('atomic persistence failed');
    const refreshSurveyResponsesByID = jest.fn().mockRejectedValue(error);
    const reportDetachedRefreshError = jest.fn();
    const props = createProps({
      isOpen: true,
      refreshSurveyResponsesByID,
      surveyId: '0xABC',
      viewMode: 'survey',
    });
    const state = createState({
      surveyId: '0xABC',
      viewMode: 'survey',
    });

    const cleanup = runSurveyResultsComponentDidMount({
      instance,
      ports: {
        appendSessionHintToSurveyPath: (path) => path,
        applyStatePatch: (_patch, afterApply) => afterApply?.(),
        destroyFetchResponsesRuntime: jest.fn(),
        destroyLocalStoragePollingRuntime: jest.fn(),
        destroyQueuedResultsRefreshRuntime: jest.fn(),
        getProps: () => props,
        getState: () => state,
        handleDocumentVisibilityChange: jest.fn(),
        handleManagedCacheUpdate: jest.fn(),
        handleManualRefresh: jest.fn(),
        handleUrlBasedView: jest.fn(),
        handleUrlChange: jest.fn(),
        queueResultsRefresh: jest.fn(),
        reportDetachedRefreshError,
        subscribeCacheUpdates: jest.fn(),
        updateLocalStoragePollingState: jest.fn(),
        updateParentWithCurrentFiltersForUrl: jest.fn(),
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xabc');
    expect(reportDetachedRefreshError).toHaveBeenCalledWith('initial-survey-refresh', error);

    cleanup();
  });
});
