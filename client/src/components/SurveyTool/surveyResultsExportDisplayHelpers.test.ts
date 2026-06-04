import {
  SURVEY_RESULTS_EXPORT_OPTIONS,
  SURVEY_RESULTS_EXPORT_TYPES,
  buildSurveyResultsDemoAnalysisArtifact,
  buildSurveyResultsExportControlsDisplayDescriptor,
  buildSurveyResultsExportDownloadPlan,
  buildSurveyResultsExportGenerationPlan,
  getSurveyResultsExportTypeLabel,
} from './surveyResultsExportDisplayHelpers.js';
import type {
  SessionResultsAnalysisPayloadBuildResult,
} from '../../utilities/sessionResultsExport';

const buildAnalysisPayload = ({
  questions = [
    { id: 'q1', prompt: 'First prompt', type: 'freeform', options: [], tags: [] },
    { id: 'q2', prompt: 'Second prompt', type: 'binary', options: ['Yes', 'No'], tags: ['tag'] },
  ],
  responses = [
    { answer: 'A', participantId: 'p1', questionId: 'q1' },
    { answer: 'B', participantId: 'p2', questionId: 'q1' },
    { answer: 'Yes', participantId: 'p1', questionId: 'q2' },
  ],
}: Partial<SessionResultsAnalysisPayloadBuildResult['aiPayload']> = {}): SessionResultsAnalysisPayloadBuildResult => ({
  aiPayload: {
    counts: {
      participants: 2,
      questions: questions.length,
      responses: responses.length,
    },
    inputLimits: {
      maxOptionsPerQuestion: 12,
      maxQuestionPromptChars: 900,
      maxQuestions: 80,
      maxResponseAdditionalChars: 900,
      maxResponseAnswerChars: 1400,
      maxResponses: 420,
      maxSegmentDimensions: 12,
      maxSegmentValuesPerDimension: 60,
      maxTagsPerQuestion: 16,
    },
    questions,
    responses,
    segmentDimensions: [],
    session: {
      name: 'Demo session',
      slug: 'demo',
    },
  },
  participants: [
    { displayAddress: '0x111...1111', syntheticId: 'p1' },
    { displayAddress: '0x222...2222', syntheticId: 'p2' },
  ],
});

describe('surveyResultsExportDisplayHelpers', () => {
  it('keeps export options in the existing render order', () => {
    expect(SURVEY_RESULTS_EXPORT_OPTIONS).toEqual([
      { value: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS, label: 'CSV: Questions' },
      {
        value: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
        label: 'CSV: Questions + Responses',
      },
      { value: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS, label: 'JSON: Questions' },
      {
        value: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES,
        label: 'JSON: Questions + Responses',
      },
    ]);
  });

  it('formats known and legacy export labels without mutating options', () => {
    const before = JSON.stringify(SURVEY_RESULTS_EXPORT_OPTIONS);

    expect(getSurveyResultsExportTypeLabel('csv-questions')).toBe('CSV: Questions');
    expect(getSurveyResultsExportTypeLabel(' json-questions-and-responses ')).toBe('JSON: Questions + Responses');
    expect(getSurveyResultsExportTypeLabel('Legacy Removed Export')).toBe('Legacy Removed Export');
    expect(getSurveyResultsExportTypeLabel(null)).toBe('');

    expect(JSON.stringify(SURVEY_RESULTS_EXPORT_OPTIONS)).toBe(before);
  });

  it('builds export controls display descriptors from shell state', () => {
    expect(buildSurveyResultsExportControlsDisplayDescriptor({
      exportAreaOpen: 1,
      exportType: ' json-questions-and-responses ',
    })).toEqual({
      exportAreaOpen: true,
      exportOptions: SURVEY_RESULTS_EXPORT_OPTIONS,
      exportTypeLabel: 'JSON: Questions + Responses',
    });

    expect(buildSurveyResultsExportControlsDisplayDescriptor()).toEqual({
      exportAreaOpen: false,
      exportOptions: SURVEY_RESULTS_EXPORT_OPTIONS,
      exportTypeLabel: '',
    });
  });

  it('plans export generation without invoking download side effects', () => {
    expect(buildSurveyResultsExportGenerationPlan({
      baseFileName: 'contextEngine_surveyResults_alpha',
      exportType: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
      timestamp: '2026_05_28T10_00_00_000Z',
    })).toEqual({
      alertMessage: '',
      filename: 'contextEngine_surveyResults_alpha_2026_05_28T10_00_00_000Z.csv',
      generatorKey: 'questions-responses-csv',
      isCsv: true,
      mimeType: 'text/csv;charset=utf-8;',
      status: 'ready',
    });

    expect(buildSurveyResultsExportGenerationPlan({
      baseFileName: 'contextEngine_filteredQuestions',
      exportType: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS,
      timestamp: '2026_05_28T10_00_00_000Z',
    })).toEqual({
      alertMessage: '',
      filename: 'contextEngine_filteredQuestions_2026_05_28T10_00_00_000Z.json',
      generatorKey: 'questions-json',
      isCsv: false,
      mimeType: 'application/json;charset=utf-8;',
      status: 'ready',
    });

    expect(buildSurveyResultsExportGenerationPlan({
      exportType: ' csv-questions ',
    })).toEqual({
      alertMessage: 'Invalid export type selected.',
      filename: '',
      generatorKey: null,
      isCsv: false,
      mimeType: '',
      status: 'invalid',
    });
  });

  it('plans export download inert states before Blob creation', () => {
    const csvGenerationPlan = buildSurveyResultsExportGenerationPlan({
      baseFileName: 'contextEngine_filteredQuestions',
      exportType: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS,
      timestamp: '2026_05_28T10_00_00_000Z',
    });

    expect(buildSurveyResultsExportDownloadPlan({
      fileContent: '"questionID","prompt","type","tags","options"',
      generationPlan: csvGenerationPlan,
    })).toEqual({
      alertMessage: 'No data available to download for this export type.',
      fileContent: '',
      filename: '',
      mimeType: '',
      status: 'empty',
    });

    expect(buildSurveyResultsExportDownloadPlan({
      fileContent: '"questionID","prompt","type","tags","options"\n"q1","Prompt","freeform","",""',
      generationPlan: csvGenerationPlan,
    })).toEqual({
      alertMessage: '',
      fileContent: '"questionID","prompt","type","tags","options"\n"q1","Prompt","freeform","",""',
      filename: 'contextEngine_filteredQuestions_2026_05_28T10_00_00_000Z.csv',
      mimeType: 'text/csv;charset=utf-8;',
      status: 'download',
    });

    expect(buildSurveyResultsExportDownloadPlan({
      fileContent: '   ',
      generationPlan: buildSurveyResultsExportGenerationPlan({
        exportType: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES,
      }),
    })).toMatchObject({
      alertMessage: 'No data available to download for this export type.',
      status: 'empty',
    });
  });

  it('builds a demo analysis artifact from passed-in payload data without download side effects', () => {
    const artifact = buildSurveyResultsDemoAnalysisArtifact({
      analysisPayload: buildAnalysisPayload(),
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'payload-signature',
    });

    expect(artifact).toMatchObject({
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'demo-preview-payload-signature',
      kind: 'ce_session_results_analysis_artifact',
      model: 'demo-preview',
      source: 'ai-generated',
      version: 1,
    });
    expect(artifact.participants).toHaveLength(2);
    expect(artifact.sections.breakdown.groups).toEqual([
      expect.objectContaining({ id: 'demo_group_1', questionIds: ['q1'], responseCount: 2 }),
      expect.objectContaining({ id: 'demo_group_2', questionIds: ['q2'], responseCount: 1 }),
    ]);
    expect(artifact.sections.atlas.nodes).toHaveLength(2);
    expect(artifact.sections.riskMatrix.heatmap).toMatchObject({
      demo_risk_1: { impact: 'medium', likelihood: 'medium' },
      demo_risk_2: { impact: 'high', likelihood: 'low' },
    });
  });

  it('uses the fallback demo question when payload questions are empty', () => {
    const artifact = buildSurveyResultsDemoAnalysisArtifact({
      analysisPayload: buildAnalysisPayload({ questions: [], responses: [] }),
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'empty-payload',
    });

    expect(artifact.sections.breakdown.groups).toEqual([
      expect.objectContaining({
        id: 'demo_group_1',
        label: 'Demo results',
        questionIds: ['demo-results'],
        responseCount: 0,
      }),
    ]);
    expect(artifact.sections.argumentMap.debates[0]).toMatchObject({
      id: 'demo_debate_1',
      title: 'Demo results',
    });
  });
});
