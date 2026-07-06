import {
  createSurveyResultsDataExportRuntime,
  type SurveyResultsDataExportProps,
  type SurveyResultsDataExportRuntimeArgs,
  type SurveyResultsDataExportState,
} from './surveyResultsDataExportRuntime';
import type {
  SurveyResultsResponseRecord,
} from './surveyResultsLockedFieldHelpers';

const fixedNowIso = (): string => '2026-05-28T10:00:00.000Z';

const createRuntime = ({
  props = {},
  state = {},
  hasEffectiveNetworkId = true,
  networkQuestions = {},
  downloadFile = jest.fn(),
}: {
  props?: SurveyResultsDataExportProps;
  state?: SurveyResultsDataExportState;
  hasEffectiveNetworkId?: boolean;
  networkQuestions?: unknown;
  downloadFile?: SurveyResultsDataExportRuntimeArgs['downloadFile'];
} = {}) => {
  const patches: Record<string, unknown>[] = [];
  const writtenCsvFileNames: string[] = [];
  const mutableState: SurveyResultsDataExportState = {
    alertMessage: '',
    exportType: 'json-questions',
    filterState: {},
    filteredQuestionsCount: 1,
    filteredResponsesCount: 1,
    sbtFilteredAggregatorQuestionResponses: {
      q1: [{ answer: { value: 'Yes' } }],
    },
    sbtFilteredResponses: [],
    surveyId: 'survey-1234567890',
    surveyTitle: 'Export survey',
    surveyViewMode: 'aggregate',
    totalQuestionsCount: 2,
    totalResponsesCount: 3,
    viewMode: 'questions',
    ...state,
  };
  const runtime = createSurveyResultsDataExportRuntime({
    applyStatePatch: (patch) => {
      patches.push(patch);
      Object.assign(mutableState, patch);
    },
    downloadFile,
    getEffectiveSlug: () => 'export-session',
    getNetworkQuestionsForCurrentContext: () => networkQuestions,
    getProps: () => props,
    getResponseQuestionId: (response) => String(response?.questionID || response?.questionId || ''),
    getState: () => mutableState,
    hasEffectiveNetworkId: () => hasEffectiveNetworkId,
    nowIso: fixedNowIso,
    parseResponse: (response) => (
      response && typeof response === 'object'
        ? response as SurveyResultsResponseRecord
        : null
    ),
    writeCsvFileName: (filename) => {
      writtenCsvFileNames.push(filename);
    },
  });
  return {
    downloadFile,
    mutableState,
    patches,
    runtime,
    writtenCsvFileNames,
  };
};

describe('surveyResultsDataExportRuntime', () => {
  it('writes the same response CSV filename patch from the live session name', () => {
    const { patches, runtime, writtenCsvFileNames } = createRuntime({
      props: {
        sessionName: 'Alpha Session',
      },
      networkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Question one?',
          type: 'single_choice',
        },
      },
      state: {
        sbtFilteredAggregatorQuestionResponses: {
          q1: [
            {
              responder: '0x1111111111111111111111111111111111111111',
              response: {
                answer: { value: 'Yes' },
                questionID: 'q1',
              },
            },
          ],
        },
      },
    });

    const csv = runtime.generateResponsesCSV();

    expect(writtenCsvFileNames).toEqual([
      'contextEngine_questionResponses_2026-05-28T10_00_00_000Z_AlphaSession.csv',
    ]);
    expect(patches).toContainEqual({
      csvFileName: 'contextEngine_questionResponses_2026-05-28T10_00_00_000Z_AlphaSession.csv',
    });
    expect(csv).toContain('Question one?');
  });

  it('blocks question CSV generation when network identity is unavailable', () => {
    const { patches, runtime } = createRuntime({
      hasEffectiveNetworkId: false,
    });

    expect(runtime.generateQuestionsCSV()).toBe('');
    expect(patches).toContainEqual({
      alertMessage: 'Network not available for fetching question data.',
    });
  });

  it('builds filtered question JSON from aggregate and row response question ids', () => {
    const { runtime } = createRuntime({
      networkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Aggregate question?',
          tags: ['aggregate'],
          type: 'binary',
        },
        q2: {
          id: 'q2',
          options: ['A', 'B'],
          prompt: 'Row question?',
          type: 'choice',
        },
      },
      state: {
        sbtFilteredAggregatorQuestionResponses: {
          q1: [],
        },
        sbtFilteredResponses: [
          {
            response: {
              responses: [
                { questionID: 'q2' },
              ],
            },
          },
        ],
      },
    });

    const exported = JSON.parse(runtime.generateQuestionsJSON()) as {
      filteredQuestions?: Array<{ id: string; prompt: string }>;
      sessionSlug?: string;
    };

    expect(exported.sessionSlug).toBe('export-session');
    expect(exported.filteredQuestions).toEqual([
      expect.objectContaining({
        id: 'q1',
        prompt: 'Aggregate question?',
      }),
      expect.objectContaining({
        id: 'q2',
        prompt: 'Row question?',
      }),
    ]);
  });
});
