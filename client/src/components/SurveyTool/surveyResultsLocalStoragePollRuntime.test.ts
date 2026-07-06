import {
  pollSurveyResultsLocalStorageForUpdates,
  type SurveyResultsLocalStoragePollInstance,
  type SurveyResultsLocalStoragePollPorts,
} from './surveyResultsLocalStoragePollRuntime';
import type {
  SurveyResultsProps,
  SurveyResultsState,
} from './SurveyResults';

const createInstance = (): SurveyResultsLocalStoragePollInstance => ({
  _isMounted: true,
  _lastLocalStoragePollCoarseSignature: '',
  _lastLocalStoragePollDetailedSignature: '',
  _lastPolledQuestionRefVersion: 0,
  _lastPolledQuestionsRef: null,
  _lastPolledSurveyResponsesRef: null,
  _lastPolledSurveyResponsesRefVersion: 0,
  _pollLatestBlockFetchInFlight: false,
  _pollLatestBlockLastAttemptAt: 0,
  _pollQuestionCountMemo: {
    count: 0,
    questionsRef: null,
  },
  _pollSurveyResponsesCountMemo: {
    count: 0,
    responsesRef: null,
    surveyId: '',
  },
});

const createProps = (): SurveyResultsProps => ({
  network: { id: 11155420 },
  networkChainId: 11155420,
  provider: 'provider',
} as SurveyResultsProps);

const createState = (patch: Record<string, unknown> = {}): SurveyResultsState => ({
  cachedQuestionsCount: 0,
  cachedSurveyResponsesCount: 0,
  networkLatestBlock: 20,
  questionLocalBlock: 0,
  responseLocalBlock: 0,
  surveyId: '',
  surveyLocalBlock: 0,
  viewMode: 'questions',
  ...patch,
} as SurveyResultsState);

describe('surveyResultsLocalStoragePollRuntime', () => {
  it('applies local question-cache block/count patches and queues a refresh', () => {
    const patchCalls: Record<string, unknown>[] = [];
    const queuedReasons: string[] = [];
    const state = createState();
    const ports: SurveyResultsLocalStoragePollPorts = {
      applyStatePatch: (patch, afterApply) => {
        patchCalls.push(patch as Record<string, unknown>);
        if (afterApply) afterApply();
      },
      getEffectiveSlug: () => 'session-one',
      getFetchRuntimeSnapshot: () => ({ inFlight: false }),
      getProps: createProps,
      getScopedQuestionNetworkDataSync: () => ({
        questions: {
          q1: { id: 'q1' },
          q2: { id: 'q2' },
        },
        questionResponses: {},
        questionResponsesLatestBlock: 11,
        questionsLatestBlock: 10,
      }),
      getStableCycles: () => 0,
      getState: () => state,
      logWarn: jest.fn(),
      queueResultsRefresh: (reason) => {
        queuedReasons.push(reason);
      },
      readLatestBlock: jest.fn(),
      readQuestionCacheSync: jest.fn(),
      readSurveyCacheSync: jest.fn(),
    };

    const changed = pollSurveyResultsLocalStorageForUpdates({
      config: {
        forceRescanEvery: 6,
        latestBlockPollThrottleMs: 8000,
      },
      instance: createInstance(),
      ports,
    });

    expect(changed).toBe(true);
    expect(patchCalls).toEqual([{
      cachedQuestionsCount: 2,
      cachedSurveyResponsesCount: 0,
      networkLatestBlock: 20,
      questionLocalBlock: 10,
      responseLocalBlock: 11,
      surveyLocalBlock: 0,
    }]);
    expect(queuedReasons).toEqual(['poll-local-storage-change']);
  });
});
