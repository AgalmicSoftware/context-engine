import {
  createSurveyResultsHtmlReportRuntime,
  type SurveyResultsHtmlReportProps,
  type SurveyResultsHtmlReportRuntimeArgs,
  type SurveyResultsHtmlReportState,
} from './surveyResultsHtmlReportRuntime';
import type { SurveyResultsGateRecord, SurveyResultsResponseRecord } from './surveyResultsLockedFieldHelpers';

const fixedNowIso = (): string => '2026-05-28T10:00:00.000Z';

const createRuntime = ({
  props = {},
  state = {},
  networkQuestions = {},
}: {
  props?: SurveyResultsHtmlReportProps;
  state?: SurveyResultsHtmlReportState;
  networkQuestions?: unknown;
} = {}) => {
  const mutableState: SurveyResultsHtmlReportState = {
    filterState: {},
    filteredQuestionsCount: 1,
    filteredResponsesCount: 1,
    htmlReportAnalysisArtifact: null,
    htmlReportDemoMode: false,
    htmlReportSelectedSections: null,
    networkLatestBlock: 42,
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
    sbtFilteredResponses: [],
    surveyId: 'survey-1',
    surveyTitle: 'Runtime survey',
    surveyViewMode: 'aggregate',
    totalQuestionsCount: 1,
    totalResponsesCount: 1,
    viewMode: 'questions',
    ...state,
  };
  const runtime = createSurveyResultsHtmlReportRuntime({
    getEffectiveSlug: () => 'runtime-session',
    getFilteredQuestionsForExport: () => [
      {
        id: 'q1',
        options: [],
        prompt: 'Runtime question?',
        tags: [],
        type: 'binary',
      },
    ],
    getNetworkQuestionsForCurrentContext: () => networkQuestions,
    getProps: () => props,
    getQuestionEncryptionGates: () => [] as SurveyResultsGateRecord[],
    getResponseQuestionId: (response) => String(response?.questionID || response?.questionId || ''),
    getResponseQuestionPrompt: (response, questionData) => response?.prompt || questionData?.prompt || '',
    getResponseQuestionType: (response, questionData) => response?.type || questionData?.type || '',
    getState: () => mutableState,
    normalizeGateSbtEntries: () => [],
    nowIso: fixedNowIso,
    parseResponse: (response) =>
      response && typeof response === 'object' ? (response as SurveyResultsResponseRecord) : null,
    readAnalysisCache: async () => ({}),
    readAnalysisCacheSync: () => ({}),
    resolveSbtDisplayLabel: ({ address }) => `SBT ${address.slice(0, 6)}`,
    writeAnalysisArtifact: async () => undefined,
  } satisfies SurveyResultsHtmlReportRuntimeArgs);

  return {
    mutableState,
    runtime,
  };
};

describe('surveyResultsHtmlReportRuntime', () => {
  it('resolves chain labels and exporter metadata from injected props', () => {
    const { runtime } = createRuntime({
      props: {
        account: '0x9999999999999999999999999999999999999999',
        loginComplete: true,
        network: {
          id: 11155420,
        },
      },
    });

    expect(runtime.getHtmlReportChainId()).toBe(11155420);
    expect(runtime.getHtmlReportNetworkLabel()).toBe('OP Sepolia');
    expect(runtime.getHtmlReportExporterMetadata()).toMatchObject({
      address: '0x9999999999999999999999999999999999999999',
      chainId: 11155420,
      displayAddress: '0x9999...9999',
    });
  });

  it('maps selected report sections to analysis sections in stable order', () => {
    const { runtime } = createRuntime();

    expect(
      runtime.getHtmlReportAnalysisSectionsToGenerate({
        argumentMap: true,
        atlas: false,
        report: true,
        riskMatrix: true,
        snapshotJson: true,
      }),
    ).toEqual(['breakdown', 'argumentMap', 'riskMatrix']);
  });

  it('builds snapshots with filtered questions and response counts', () => {
    const { runtime } = createRuntime({
      networkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Runtime question?',
          type: 'binary',
        },
      },
      props: {
        account: '0x9999999999999999999999999999999999999999',
        loginComplete: true,
        network: {
          label: 'Custom net',
        },
      },
    });

    const snapshot = runtime.buildSessionResultsHtmlReportSnapshot();

    expect(snapshot.session).toMatchObject({
      latestKnownBlock: 42,
      name: 'Runtime survey',
      networkLabel: 'Custom net',
      slug: 'runtime-session',
    });
    expect(snapshot.counts.responses).toBe(1);
    expect(snapshot.sections.report.questions).toEqual([
      expect.objectContaining({
        id: 'q1',
        prompt: 'Runtime question?',
        responseCount: 1,
      }),
    ]);
  });
});
