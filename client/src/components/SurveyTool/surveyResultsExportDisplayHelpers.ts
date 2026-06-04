import {
  SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
  SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  type SessionResultsAnalysisPayloadBuildResult,
  type SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

export type SurveyResultsExportOption = {
  label: string;
  value: string;
};

export const SURVEY_RESULTS_EXPORT_TYPES = Object.freeze({
  CSV_QUESTIONS: 'csv-questions',
  CSV_QUESTIONS_AND_RESPONSES: 'csv-questions-and-responses',
  JSON_QUESTIONS: 'json-questions',
  JSON_QUESTIONS_AND_RESPONSES: 'json-questions-and-responses',
});

export const SURVEY_RESULTS_EXPORT_TYPE_LABELS: Record<string, string> = Object.freeze({
  [SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS]: 'CSV: Questions',
  [SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES]: 'CSV: Questions + Responses',
  [SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS]: 'JSON: Questions',
  [SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES]: 'JSON: Questions + Responses',
});

export const SURVEY_RESULTS_EXPORT_OPTIONS: readonly SurveyResultsExportOption[] = Object.freeze([
  {
    value: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS,
    label: SURVEY_RESULTS_EXPORT_TYPE_LABELS[SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS],
  },
  {
    value: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
    label: SURVEY_RESULTS_EXPORT_TYPE_LABELS[SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES],
  },
  {
    value: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS,
    label: SURVEY_RESULTS_EXPORT_TYPE_LABELS[SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS],
  },
  {
    value: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES,
    label: SURVEY_RESULTS_EXPORT_TYPE_LABELS[SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES],
  },
]);

export type SurveyResultsExportGeneratorKey =
  | 'questions-csv'
  | 'questions-json'
  | 'questions-responses-csv'
  | 'questions-responses-json';

export type SurveyResultsExportGenerationPlanInvalid = {
  alertMessage: string;
  filename: '';
  generatorKey: null;
  isCsv: false;
  mimeType: '';
  status: 'invalid';
};

export type SurveyResultsExportGenerationPlanReady = {
  alertMessage: '';
  filename: string;
  generatorKey: SurveyResultsExportGeneratorKey;
  isCsv: boolean;
  mimeType: string;
  status: 'ready';
};

export type SurveyResultsExportGenerationPlan =
  | SurveyResultsExportGenerationPlanInvalid
  | SurveyResultsExportGenerationPlanReady;

export type SurveyResultsExportDownloadPlanEmpty = {
  alertMessage: string;
  fileContent: '';
  filename: '';
  mimeType: '';
  status: 'empty';
};

export type SurveyResultsExportDownloadPlanReady = {
  alertMessage: '';
  fileContent: string;
  filename: string;
  mimeType: string;
  status: 'download';
};

export type SurveyResultsExportDownloadPlan =
  | SurveyResultsExportDownloadPlanEmpty
  | SurveyResultsExportDownloadPlanReady;

const NO_SURVEY_RESULTS_EXPORT_DATA_MESSAGE = 'No data available to download for this export type.';

const buildReadySurveyResultsExportGenerationPlan = ({
  baseFileName,
  extension,
  generatorKey,
  isCsv,
  mimeType,
  timestamp,
}: {
  baseFileName: unknown;
  extension: string;
  generatorKey: SurveyResultsExportGeneratorKey;
  isCsv: boolean;
  mimeType: string;
  timestamp: unknown;
}): SurveyResultsExportGenerationPlanReady => ({
  alertMessage: '',
  filename: `${String(baseFileName || '')}_${String(timestamp || '')}.${extension}`,
  generatorKey,
  isCsv,
  mimeType,
  status: 'ready',
});

export const buildSurveyResultsExportGenerationPlan = ({
  baseFileName = '',
  exportType = '',
  timestamp = '',
}: {
  baseFileName?: unknown;
  exportType?: unknown;
  timestamp?: unknown;
} = {}): SurveyResultsExportGenerationPlan => {
  switch (exportType) {
    case SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS:
      return buildReadySurveyResultsExportGenerationPlan({
        baseFileName,
        extension: 'csv',
        generatorKey: 'questions-csv',
        isCsv: true,
        mimeType: 'text/csv;charset=utf-8;',
        timestamp,
      });
    case SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES:
      return buildReadySurveyResultsExportGenerationPlan({
        baseFileName,
        extension: 'csv',
        generatorKey: 'questions-responses-csv',
        isCsv: true,
        mimeType: 'text/csv;charset=utf-8;',
        timestamp,
      });
    case SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS:
      return buildReadySurveyResultsExportGenerationPlan({
        baseFileName,
        extension: 'json',
        generatorKey: 'questions-json',
        isCsv: false,
        mimeType: 'application/json;charset=utf-8;',
        timestamp,
      });
    case SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES:
      return buildReadySurveyResultsExportGenerationPlan({
        baseFileName,
        extension: 'json',
        generatorKey: 'questions-responses-json',
        isCsv: false,
        mimeType: 'application/json;charset=utf-8;',
        timestamp,
      });
    default:
      return {
        alertMessage: 'Invalid export type selected.',
        filename: '',
        generatorKey: null,
        isCsv: false,
        mimeType: '',
        status: 'invalid',
      };
  }
};

export const buildSurveyResultsExportDownloadPlan = ({
  fileContent = '',
  generationPlan,
}: {
  fileContent?: unknown;
  generationPlan?: SurveyResultsExportGenerationPlan | null;
} = {}): SurveyResultsExportDownloadPlan => {
  const content = typeof fileContent === 'string' ? fileContent : '';
  if (!generationPlan || generationPlan.status !== 'ready') {
    return {
      alertMessage: generationPlan?.alertMessage || 'Invalid export type selected.',
      fileContent: '',
      filename: '',
      mimeType: '',
      status: 'empty',
    };
  }
  if (!content || !content.trim()) {
    return {
      alertMessage: NO_SURVEY_RESULTS_EXPORT_DATA_MESSAGE,
      fileContent: '',
      filename: '',
      mimeType: '',
      status: 'empty',
    };
  }
  if (generationPlan.isCsv && content.split('\n').length < 2) {
    return {
      alertMessage: NO_SURVEY_RESULTS_EXPORT_DATA_MESSAGE,
      fileContent: '',
      filename: '',
      mimeType: '',
      status: 'empty',
    };
  }
  return {
    alertMessage: '',
    fileContent: content,
    filename: generationPlan.filename,
    mimeType: generationPlan.mimeType,
    status: 'download',
  };
};

export const getSurveyResultsExportTypeLabel = (value: unknown = ''): string => {
  const key = String(value || '').trim();
  return SURVEY_RESULTS_EXPORT_TYPE_LABELS[key] || key;
};

export type SurveyResultsExportControlsDisplayDescriptor = {
  exportAreaOpen: boolean;
  exportOptions: readonly SurveyResultsExportOption[];
  exportTypeLabel: string;
};

export const buildSurveyResultsExportControlsDisplayDescriptor = ({
  exportAreaOpen = false,
  exportType = '',
}: {
  exportAreaOpen?: unknown;
  exportType?: unknown;
} = {}): SurveyResultsExportControlsDisplayDescriptor => ({
  exportAreaOpen: !!exportAreaOpen,
  exportOptions: SURVEY_RESULTS_EXPORT_OPTIONS,
  exportTypeLabel: getSurveyResultsExportTypeLabel(exportType),
});

export const buildSurveyResultsDemoAnalysisArtifact = ({
  analysisPayload,
  generatedAt,
  inputSignature,
}: {
  analysisPayload: SessionResultsAnalysisPayloadBuildResult;
  generatedAt: string;
  inputSignature: string;
}): SessionResultsGeneratedAnalysisArtifact => {
  const questions = analysisPayload.aiPayload.questions;
  const responseCounts = new Map<string, number>();
  analysisPayload.aiPayload.responses.forEach((response) => {
    const key = String(response.questionId || '').trim();
    if (!key) return;
    responseCounts.set(key, (responseCounts.get(key) || 0) + 1);
  });
  const questionModels = questions.length > 0
    ? questions.slice(0, 6)
    : [{ id: 'demo-results', prompt: 'Demo results', type: 'demo', options: [], tags: [] }];
  const groups = questionModels.slice(0, 4).map((question, index) => ({
    id: `demo_group_${index + 1}`,
    label: question.prompt || `Demo theme ${index + 1}`,
    questionIds: [question.id],
    responseCount: responseCounts.get(question.id) || 0,
    summary: `Demo preview theme derived from ${responseCounts.get(question.id) || 0} visible response${(responseCounts.get(question.id) || 0) === 1 ? '' : 's'}.`,
  }));
  const nodes = questionModels.map((question, index) => ({
    id: `demo_atlas_${index + 1}`,
    label: question.prompt || `Demo node ${index + 1}`,
    path: ['Demo Session', question.prompt || `Question ${index + 1}`],
    questionIds: [question.id],
    responseCount: responseCounts.get(question.id) || 0,
    summary: 'Demo preview node generated from hydrated results.',
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    source: nodes[0]?.id || 'demo_atlas_1',
    target: node.id,
    label: index % 2 === 0 ? 'related theme' : 'adjacent concern',
  }));

  return {
    generatedAt,
    inputSignature: `demo-preview-${inputSignature}`,
    kind: SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
    model: 'demo-preview',
    participants: analysisPayload.participants,
    sections: {
      argumentMap: {
        available: true,
        debates: questionModels.slice(0, 3).map((question, index) => ({
          id: `demo_debate_${index + 1}`,
          title: question.prompt || `Demo debate ${index + 1}`,
          claims: [
            {
              id: `demo_claim_${index + 1}`,
              label: `Participants surface tradeoffs around ${question.prompt || 'this result'}.`,
              questionIds: [question.id],
              responseCount: responseCounts.get(question.id) || 0,
              stance: 'mixed',
            },
          ],
        })),
      },
      atlas: {
        available: true,
        edges,
        nodes,
      },
      breakdown: {
        available: true,
        dimensions: [],
        groups,
        summary: {
          overview: 'Demo preview analysis generated locally from currently hydrated results.',
        },
      },
      riskMatrix: {
        available: true,
        categories: questionModels.slice(0, 4).map((question, index) => ({
          id: `demo_risk_${index + 1}`,
          label: question.prompt || `Demo risk ${index + 1}`,
          description: 'Demo preview category for PDF/HTML layout testing.',
        })),
        comments: questionModels.slice(0, 4).map((question, index) => ({
          id: `demo_risk_comment_${index + 1}`,
          categoryId: `demo_risk_${index + 1}`,
          questionIds: [question.id],
          summary: `Demo preview signal from ${responseCounts.get(question.id) || 0} visible response${(responseCounts.get(question.id) || 0) === 1 ? '' : 's'}.`,
        })),
        heatmap: questionModels.slice(0, 4).reduce<Record<string, unknown>>((acc, question, index) => {
          acc[`demo_risk_${index + 1}`] = {
            impact: index % 2 === 0 ? 'medium' : 'high',
            likelihood: (responseCounts.get(question.id) || 0) > 1 ? 'medium' : 'low',
          };
          return acc;
        }, {}),
        scenarioLinks: [],
      },
    },
    source: 'ai-generated',
    version: SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  };
};
