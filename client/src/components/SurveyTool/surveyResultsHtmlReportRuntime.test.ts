import {
  createSurveyResultsHtmlReportRuntime,
  type SurveyResultsHtmlReportProps,
  type SurveyResultsHtmlReportRuntimeArgs,
  type SurveyResultsHtmlReportState,
} from './surveyResultsHtmlReportRuntime';
import type { SurveyResultsGateRecord, SurveyResultsResponseRecord } from './surveyResultsLockedFieldHelpers';
import { renderSessionResultsHtmlReport } from '../../utilities/sessionResultsExport';

const fixedNowIso = (): string => '2026-05-28T10:00:00.000Z';

const createRuntime = ({
  props = {},
  state = {},
  networkQuestions = {},
  getFilteredQuestionsForExport,
  applyDecryptedOverride = (response) => response,
}: {
  props?: SurveyResultsHtmlReportProps;
  state?: SurveyResultsHtmlReportState;
  networkQuestions?: unknown;
  getFilteredQuestionsForExport?: SurveyResultsHtmlReportRuntimeArgs['getFilteredQuestionsForExport'];
  applyDecryptedOverride?: SurveyResultsHtmlReportRuntimeArgs['applyDecryptedOverride'];
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
    applyDecryptedOverride,
    getEffectiveSlug: () => 'runtime-session',
    getFilteredQuestionsForExport:
      getFilteredQuestionsForExport ||
      (() => [
        {
          id: 'q1',
          options: [],
          prompt: 'Runtime question?',
          tags: [],
          type: 'binary',
        },
      ]),
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
  describe('what the exporter can see', () => {
    const gatedPrompt = 'Decrypted gated prompt';
    const responder = '0x1111111111111111111111111111111111111111';
    const lockedResponder = '0x2222222222222222222222222222222222222222';
    const gatedRuntime = () =>
      createRuntime({
        networkQuestions: {
          q1: { id: 'q1', prompt: 'Runtime question?', type: 'binary' },
          q2: {
            id: 'q2',
            prompt: gatedPrompt,
            promptDecrypted: true,
            promptEncrypted: { ciphertext: 'fixture' },
            tags: ['gated-tag'],
            type: 'binary',
          },
        },
        getFilteredQuestionsForExport: () => [
          { id: 'q1', options: [], prompt: 'Runtime question?', tags: [], type: 'binary' },
          { id: 'q2', options: [], prompt: gatedPrompt, tags: ['gated-tag'], type: 'binary' },
        ],
        state: {
          sbtFilteredAggregatorQuestionResponses: {
            q1: [{ responder, response: { answer: { value: 'Agree' }, questionID: 'q1' } }],
            q2: [
              { responder, response: { answer: { value: 'Disagree' }, questionID: 'q2' } },
              {
                responder: lockedResponder,
                response: { answer: { encrypted: true, value: '*' }, questionID: 'q2' },
              },
            ],
          },
        },
      });

    it('puts decrypted questions, answers and responders in the report, stamped with the exporter', () => {
      const { runtime } = gatedRuntime();
      const snapshot = runtime.buildSessionResultsHtmlReportSnapshot(undefined, { withAnswers: true });
      const html = renderSessionResultsHtmlReport(snapshot);

      expect(html).toContain('Runtime question?');
      expect(html).toContain(gatedPrompt);
      expect(html).toContain('gated-tag');
      expect(html).not.toContain('Encrypted question');
      expect(snapshot.sections.report.answers).toEqual([
        { answer: 'Agree', comment: '', questionId: 'q1', responder },
        { answer: 'Disagree', comment: '', questionId: 'q2', responder },
      ]);
      expect(html).toContain('Disagree');
      expect(html).toContain(responder);
      // An answer this reader can't see stays locked.
      expect(html).not.toContain(lockedResponder);
    });

    it('adds an answer once this reader has decrypted it', () => {
      const { runtime } = createRuntime({
        networkQuestions: { q1: { id: 'q1', prompt: 'Runtime question?', type: 'binary' } },
        state: {
          sbtFilteredAggregatorQuestionResponses: {
            q1: [
              {
                responder: lockedResponder,
                response: { answer: { encrypted: true, value: '*' }, questionID: 'q1' },
              },
            ],
          },
        },
        applyDecryptedOverride: (response, responderAddress, questionId) => {
          expect([responderAddress, questionId]).toEqual([lockedResponder, 'q1']);
          return { ...response, answer: { encrypted: true, value: 'Agree' } };
        },
      });

      expect(
        runtime.buildSessionResultsHtmlReportSnapshot(undefined, { withAnswers: true }).sections.report.answers,
      ).toEqual([{ answer: 'Agree', comment: '', questionId: 'q1', responder: lockedResponder }]);
    });

    it('reads answers only for a download, as the modal renders on every state change', () => {
      const applyDecryptedOverride = jest.fn((response) => response);
      const { runtime } = createRuntime({ applyDecryptedOverride });
      expect(runtime.buildSessionResultsHtmlReportSnapshot().sections.report.answers).toEqual([]);
      expect(applyDecryptedOverride).not.toHaveBeenCalled();
      expect(
        runtime.buildSessionResultsHtmlReportSnapshot(undefined, { withAnswers: true }).sections.report.answers,
      ).toHaveLength(1);
    });

    it('still keeps author-encrypted questions and their answers out of the AI input', () => {
      const { runtime } = gatedRuntime();
      const aiInput = JSON.stringify(runtime.buildSessionResultsAnalysisPayloadForAi());

      expect(aiInput).not.toContain(gatedPrompt);
      expect(aiInput).not.toContain('gated-tag');
      expect(aiInput).not.toContain('Disagree');
      expect(aiInput).not.toContain('"q2"');
      expect(aiInput).toContain('Runtime question?');
    });
  });

  it('names the exporter by full address', () => {
    const account = '0x1234567890123456789012345678901234567890';
    const { runtime } = createRuntime({ props: { account, loginComplete: true } });
    expect(runtime.getHtmlReportExporterMetadata()).toEqual(
      expect.objectContaining({ address: account, displayAddress: account }),
    );
  });

  it('distinguishes an empty completed filter from the initial unhydrated state', () => {
    const { runtime, mutableState } = createRuntime({
      getFilteredQuestionsForExport: () => [],
      state: {
        filteredQuestionsCount: 0,
        filteredResponsesCount: 0,
        totalQuestionsCount: 17,
        totalResponsesCount: 105,
        sbtFilteredAggregatorQuestionResponses: {},
        sbtFilteredResponses: [],
      },
    });
    const filtered = runtime.buildSessionResultsHtmlReportSnapshot();
    expect(filtered.counts).toMatchObject({ questions: 0, responses: 0 });
    expect(filtered.sections.report.available).toBe(false);
    mutableState.filteredQuestionsCount = null;
    const hydrating = runtime.buildSessionResultsHtmlReportSnapshot();
    expect(hydrating.counts).toMatchObject({ questions: 17, responses: 105 });
    expect(hydrating.sections.report.available).toBe(true);
  });

  it('omits generated analysis when the current filtered inputs have changed', () => {
    const { runtime, mutableState } = createRuntime();
    mutableState.htmlReportAnalysisArtifact = {
      ...runtime.buildHtmlReportDemoAnalysisArtifact(),
      inputSignature: runtime.buildSessionResultsAnalysisPayloadForAi().inputSignature,
    };
    expect(runtime.getHtmlReportAnalysisArtifact()).not.toBeNull();
    mutableState.sbtFilteredAggregatorQuestionResponses = {};
    mutableState.filteredResponsesCount = 0;
    expect(runtime.getHtmlReportAnalysisArtifact()).toBeNull();
    const snapshot = runtime.buildSessionResultsHtmlReportSnapshot();
    expect(snapshot.sections.argumentMap.available).toBe(false);
  });

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
      displayAddress: '0x9999999999999999999999999999999999999999',
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
