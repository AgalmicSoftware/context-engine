import {
  fetchSurveyResultsQuestionModeResponses,
  fetchSurveyResultsSurveyModeResponses,
  type SurveyResultsHydrationInstance,
  type SurveyResultsHydrationPorts,
} from './surveyResultsHydrationRuntime';
import type {
  SurveyResultsProps,
  SurveyResultsState,
} from './SurveyResults';

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

const createProps = (patch: Record<string, unknown> = {}): SurveyResultsProps => ({
  isQuestionCacheReady: true,
  network: { id: 11155420 },
  networkChainId: 11155420,
  ...patch,
} as SurveyResultsProps);

const createState = (patch: Record<string, unknown> = {}): SurveyResultsState => ({
  filteredQuestionsCount: 0,
  filteredResponsesCount: 0,
  isFilterActive: false,
  sbtFilteredAggregatorQuestionResponses: {},
  surveyId: '',
  viewMode: 'questions',
  ...patch,
} as SurveyResultsState);

const parseResponse = <T,>(responseData: T): T | Record<string, unknown> | null => {
  if (typeof responseData !== 'string') return responseData;
  return JSON.parse(responseData) as Record<string, unknown>;
};

const createPorts = ({
  props = createProps(),
  state = createState(),
  surveyCache = {},
  questionNetworkData = { questions: {}, questionResponses: {} },
}: {
  props?: SurveyResultsProps;
  state?: SurveyResultsState;
  surveyCache?: Record<string, unknown>;
  questionNetworkData?: Record<string, unknown>;
} = {}) => {
  const patchCalls: PatchCall[] = [];
  const reapplyQuestionFilters = jest.fn();
  const ports: SurveyResultsHydrationPorts = {
    applyStatePatch: (patch, afterApply) => {
      patchCalls.push({ patch: patch as Record<string, unknown>, afterApply });
      if (afterApply) afterApply();
    },
    getEffectiveSlug: () => 'session-one',
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
});
