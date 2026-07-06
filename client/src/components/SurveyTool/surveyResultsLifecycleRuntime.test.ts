import type {
  SurveyResultsProps,
  SurveyResultsState,
} from './SurveyResults';
import {
  runSurveyResultsComponentDidUpdate,
  type SurveyResultsLifecycleInstance,
  type SurveyResultsLifecyclePorts,
} from './surveyResultsLifecycleRuntime';

type PatchCall = {
  afterApply?: () => void;
  patch: Record<string, unknown>;
};

const createProps = (patch: Record<string, unknown> = {}): SurveyResultsProps => ({
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
} as SurveyResultsProps);

const createState = (patch: Record<string, unknown> = {}): SurveyResultsState => ({
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
} as SurveyResultsState);

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
    expect(harness.events.indexOf('applyStatePatch')).toBeLessThan(
      harness.events.indexOf('updateParentFilters')
    );
    expect(window.location.pathname).toBe('/questions/results');
    expect(window.location.search).toBe('?session=edge');
    expect(harness.queuedRefreshes).toContain('modal-open');
    expect(harness.resetReasons).toEqual(
      expect.arrayContaining(['modal-open', 'modal-open-state-change'])
    );
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
      harness.events.indexOf('queue:question-scope-change')
    );
    expect(harness.queuedRefreshes).toContain('question-scope-change');
  });
});
