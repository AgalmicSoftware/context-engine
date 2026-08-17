import {
  fetchSurveyResultsQuestionModeResponses,
  fetchSurveyResultsSurveyModeResponses,
  type SurveyResultsHydrationInstance,
  type SurveyResultsHydrationPorts,
} from './surveyResultsHydrationRuntime';
import { buildSimulatedDemoResultsNetworkData } from './surveyPolisDemoResultsData';
import type { SurveyResultsProps, SurveyResultsState } from './SurveyResults';

type PatchCall = {
  afterApply?: () => void;
  patch: Record<string, unknown>;
};

const createInstance = (): SurveyResultsHydrationInstance => ({
  _surveyModeSourceCacheNonce: 0,
  _surveyModeSourceCoarseSignature: '',
  _surveyModeSourcePayloadRefSignature: '',
  _surveyModeSourceSignature: '',
  _surveysCacheChangeNonce: 0,
});

const createProps = (patch: Record<string, unknown> = {}): SurveyResultsProps =>
  ({
    isQuestionCacheReady: true,
    network: { id: 11155420 },
    networkChainId: 11155420,
    ...patch,
  }) as SurveyResultsProps;

const createState = (patch: Record<string, unknown> = {}): SurveyResultsState =>
  ({
    filteredQuestionsCount: 0,
    filteredResponsesCount: 0,
    isFilterActive: false,
    sbtFilteredAggregatorQuestionResponses: {},
    surveyId: '',
    viewMode: 'questions',
    ...patch,
  }) as SurveyResultsState;

const parseResponse = <T>(responseData: T): T | Record<string, unknown> | null => {
  if (typeof responseData !== 'string') return responseData;
  return JSON.parse(responseData) as Record<string, unknown>;
};

const createPorts = ({
  props = createProps(),
  state = createState(),
  surveyCache = {},
  questionNetworkData = { questions: {}, questionResponses: {} },
  effectiveSlug = 'session-one',
}: {
  props?: SurveyResultsProps;
  state?: SurveyResultsState;
  surveyCache?: Record<string, unknown>;
  questionNetworkData?: Record<string, unknown>;
  effectiveSlug?: string;
} = {}) => {
  const patchCalls: PatchCall[] = [];
  const reapplyQuestionFilters = jest.fn();
  const ports: SurveyResultsHydrationPorts = {
    applyStatePatch: (patch, afterApply) => {
      patchCalls.push({ patch: patch as Record<string, unknown>, afterApply });
      if (afterApply) afterApply();
    },
    getEffectiveSlug: () => effectiveSlug,
    getNetworkQuestionsForCurrentContext: () => ({
      q1: { id: 'q1', type: 'text' },
      q2: { id: 'q2', type: 'text' },
    }),
    getProps: () => props,
    getScopedQuestionNetworkData: async () => questionNetworkData as never,
    getState: () => state,
    logWarn: jest.fn(),
    parseResponse,
    readSurveyCache: async () => surveyCache,
    readSurveyCacheSync: () => surveyCache,
    reapplyQuestionFilters,
  };
  return {
    patchCalls,
    ports,
    reapplyQuestionFilters,
  };
};

describe('surveyResultsHydrationRuntime', () => {
  it('hydrates survey-mode cache once per source signature', async () => {
    const instance = createInstance();
    const state = createState({
      surveyId: '0xABC',
      viewMode: 'survey',
    });
    const surveyCache = {
      11155420: {
        surveyResponses: {
          '0xabc': {
            '0xResponder': JSON.stringify({
              responses: [
                {
                  answer: { value: 'Yes' },
                  questionID: 'Q1',
                  timeStamp: 123,
                },
              ],
            }),
          },
        },
        surveyResponsesLatestBlock: {
          '0xabc': 12,
        },
        surveys: {
          '0xabc': {
            documentURLs: ['https://example.test/doc'],
            questionIDs: ['Q1', 'Q2'],
            title: 'Session pulse',
          },
        },
        surveysLatestBlock: 15,
      },
    };
    const harness = createPorts({ state, surveyCache });

    await fetchSurveyResultsSurveyModeResponses({
      instance,
      ports: harness.ports,
    });
    await fetchSurveyResultsSurveyModeResponses({
      instance,
      ports: harness.ports,
    });

    expect(harness.patchCalls).toHaveLength(1);
    expect(harness.patchCalls[0].patch).toMatchObject({
      filteredResponsesCount: 1,
      surveyDocumentURLs: ['https://example.test/doc'],
      surveyResultsHydrated: true,
      surveyTitle: 'Session pulse',
      totalQuestionsCount: 2,
      totalResponsesCount: 1,
    });
    expect(harness.patchCalls[0].patch.aggregateQuestionResponses).toHaveProperty('q1');
    expect(harness.patchCalls[0].patch.aggregateQuestionResponses).toHaveProperty('q2');
    expect(instance._surveyModeSourceSignature).toContain('0xabc');
  });

  it('applies question-mode patch before reapplying active filters', async () => {
    const state = createState({
      filteredQuestionsCount: 1,
      filteredResponsesCount: 1,
      isFilterActive: true,
      sbtFilteredAggregatorQuestionResponses: { q1: [{ responder: '0xOld' }] },
      viewMode: 'questions',
    });
    const harness = createPorts({
      state,
      questionNetworkData: {
        questions: {
          Q1: { id: 'Q1', prompt: 'Question one' },
        },
        questionResponses: {
          Q1: {
            '0xResponder': JSON.stringify({
              answer: { value: 'Yes' },
              sessionSlug: 'session-one',
              timeStamp: 9,
            }),
          },
        },
      },
    });

    await fetchSurveyResultsQuestionModeResponses({
      instance: createInstance(),
      ports: harness.ports,
    });

    expect(harness.patchCalls).toHaveLength(1);
    expect(harness.patchCalls[0].patch).toMatchObject({
      filteredQuestionsCount: 1,
      filteredResponsesCount: 1,
      questionResultsHydrated: true,
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
    });
    expect(harness.reapplyQuestionFilters).toHaveBeenCalledTimes(1);
  });

  it('uses the latest filter state after async question cache reads', async () => {
    let currentState = createState({
      isFilterActive: false,
      viewMode: 'questions',
    });
    const activeState = createState({
      filteredQuestionsCount: 1,
      filteredResponsesCount: 1,
      isFilterActive: true,
      sbtFilteredAggregatorQuestionResponses: { q1: [{ responder: '0xFiltered' }] },
      viewMode: 'questions',
    });
    const questionNetworkData = {
      questions: {
        Q1: { id: 'Q1', prompt: 'Question one' },
      },
      questionResponses: {
        Q1: {
          '0xResponder': JSON.stringify({
            answer: { value: 'Yes' },
            sessionSlug: 'session-one',
            timeStamp: 9,
          }),
        },
      },
    };
    const harness = createPorts({
      state: currentState,
      questionNetworkData,
    });

    await fetchSurveyResultsQuestionModeResponses({
      instance: createInstance(),
      ports: {
        ...harness.ports,
        getScopedQuestionNetworkData: async () => {
          currentState = activeState;
          return questionNetworkData as never;
        },
        getState: () => currentState,
      },
    });

    expect(harness.patchCalls).toHaveLength(1);
    expect(harness.patchCalls[0].patch).toMatchObject({
      filteredQuestionsCount: 1,
      filteredResponsesCount: 1,
      questionResultsHydrated: true,
      sbtFilteredAggregatorQuestionResponses: activeState.sbtFilteredAggregatorQuestionResponses,
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
    });
    expect(harness.reapplyQuestionFilters).toHaveBeenCalledTimes(1);
  });

  it('strips cache-sourced demo rows outside simulated demo sessions', async () => {
    const harness = createPorts({
      questionNetworkData: {
        questions: {
          q1: { id: 'q1', prompt: 'Question one' },
        },
        questionResponses: {
          q1: {
            '0xdemo': {
              answer: { value: 'Agree' },
              source: 'demo-polis-data',
            },
            '0xlive': {
              answer: { value: 'Yes' },
              sessionSlug: 'session-one',
            },
          },
        },
      },
    });

    await fetchSurveyResultsQuestionModeResponses({
      instance: createInstance(),
      ports: harness.ports,
    });

    const patch = harness.patchCalls[0].patch;
    const rows = (patch.aggregatorQuestionResponses as Record<string, Array<{ responder: string }>>).q1;
    expect(rows.map((row) => row.responder)).toEqual(['0xlive']);
    expect(patch.questionResponses).toEqual({
      q1: {
        '0xlive': {
          answer: { value: 'Yes' },
          sessionSlug: 'session-one',
        },
      },
    });
  });

  it('adds demo-2 responses to display copies while live rows win without losing numeric zero', async () => {
    const simulated = buildSimulatedDemoResultsNetworkData('demo-2');
    expect(simulated).not.toBeNull();
    const [questionId, fixtureResponders] = Object.entries(simulated?.questionResponses || {}).find(
      ([, responders]) => Object.keys(responders || {}).length > 0,
    ) as [string, Record<string, unknown>];
    const [fixtureResponder] = Object.keys(fixtureResponders);
    const liveResponderKey = fixtureResponder.toUpperCase();
    const staleQuestionId = '0xstale-cache-question';
    const questionNetworkData = {
      questions: {
        [questionId]: {
          id: questionId,
          prompt: 'Live metadata wins',
          sessionSlug: 'demo-2',
          sessionSlugExplicit: true,
          type: 'rating',
        },
        [staleQuestionId]: {
          id: staleQuestionId,
          prompt: 'Stale fixture metadata',
          source: 'demo-polis-data',
        },
      },
      questionResponses: {
        [questionId]: {
          [liveResponderKey]: {
            answer: { encrypted: false, value: 0 },
            questionId,
            sessionSlug: 'demo-2',
            timeStamp: 0,
            type: 'rating',
          },
          '0xstale-cache-responder': {
            answer: { value: 'Disagree' },
            source: 'demo-polis-data',
          },
        },
        [staleQuestionId]: {
          '0xstale-only': {
            answer: { value: 'Agree' },
            source: 'demo-polis-data',
          },
        },
      },
    };
    const cacheSnapshot = JSON.parse(JSON.stringify(questionNetworkData));
    const harness = createPorts({
      effectiveSlug: 'demo-2',
      questionNetworkData,
    });

    await fetchSurveyResultsQuestionModeResponses({
      instance: createInstance(),
      ports: harness.ports,
    });

    expect(questionNetworkData).toEqual(cacheSnapshot);
    expect(Object.keys(questionNetworkData.questions)).toHaveLength(2);

    const patch = harness.patchCalls[0].patch;
    expect(patch.totalQuestionsCount).toBe(Object.keys(simulated?.questions || {}).length);
    const questionResponses = patch.questionResponses as Record<string, Record<string, unknown>>;
    expect(questionResponses[questionId]).toHaveProperty(liveResponderKey);
    expect(questionResponses[questionId]).not.toHaveProperty('0xstale-cache-responder');
    expect(questionResponses).not.toHaveProperty(staleQuestionId);

    const aggregator = patch.aggregatorQuestionResponses as Record<
      string,
      Array<{ responder: string; response: { answer?: { value?: unknown }; source?: unknown } }>
    >;
    const liveRows = aggregator[questionId].filter((row) => row.responder === fixtureResponder.toLowerCase());
    expect(liveRows).toHaveLength(1);
    expect(liveRows[0].response.answer?.value).toBe(0);
    expect(liveRows[0].response.source).not.toBe('demo-polis-data');
    expect(
      Object.values(aggregator)
        .flat()
        .some((row) => row.responder === '0xstale-cache-responder'),
    ).toBe(false);
    expect(aggregator).not.toHaveProperty(staleQuestionId);
  });
});
