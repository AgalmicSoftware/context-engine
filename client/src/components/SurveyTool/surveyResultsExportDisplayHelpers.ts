import {
  SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
  SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsAnalysisPayloadBuildResult,
  type SessionResultsExportFormat,
  type SessionResultsGeneratedAnalysisArtifact,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import type { ReactNode } from 'react';
import {
  buildSurveyResultsAlertMessagePatch,
} from './surveyResultsHelpers';

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

export const buildSurveyResultsExportBaseFileName = ({
  exportType = '',
  surveyIdShort = 'all',
  viewMode = '',
}: {
  exportType?: unknown;
  surveyIdShort?: unknown;
  viewMode?: unknown;
} = {}): string => {
  const questionsOnly =
    exportType === SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS ||
    exportType === SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS;

  if (viewMode === 'survey') {
    return questionsOnly
      ? `contextEngine_surveyQuestions_${String(surveyIdShort || 'all')}`
      : `contextEngine_surveyResults_${String(surveyIdShort || 'all')}`;
  }

  return questionsOnly ? 'contextEngine_filteredQuestions' : 'contextEngine_questionResults';
};

export type SurveyResultsHtmlReportSectionAvailability = {
  argumentMap: boolean;
  atlas: boolean;
  report: boolean;
  riskMatrix: boolean;
  snapshotJson: boolean;
};

export type SurveyResultsHtmlReportSectionKey = keyof SurveyResultsHtmlReportSectionAvailability;

export type SurveyResultsHtmlReportSectionRow = {
  available: boolean;
  key: SurveyResultsHtmlReportSectionKey;
  label: string;
  reason: string;
};

export type SurveyResultsHtmlReportReadinessPlan = {
  availability: SurveyResultsHtmlReportSectionAvailability;
  canDownload: boolean;
  hasExportableSections: boolean;
  hasUnavailableSelectedSections: boolean;
  needsAnalysisGeneration: boolean;
  sectionRows: SurveyResultsHtmlReportSectionRow[];
  selectedSections: Required<SessionResultsSectionSelection>;
};

export type SurveyResultsHtmlReportDownloadStatePatch = {
  alertMessage?: string;
  htmlReportModalOpen?: boolean;
};

export type SurveyResultsHtmlReportDownloadAttemptPlan =
  | {
    blockedReason: '';
    statePatch: null;
    status: 'ready';
  }
  | {
    blockedReason:
      | 'not-authorized'
      | 'no-exportable-sections'
      | 'unavailable-selected-sections';
    statePatch: SurveyResultsHtmlReportDownloadStatePatch;
    status: 'blocked';
  };

export type SurveyResultsHtmlReportReadinessPlanInput = {
  analysisGenerating?: unknown;
  isAuthorized?: unknown;
  selectedSections?: SessionResultsSectionSelection | null;
  snapshot: SessionResultsHtmlSnapshot;
};

export type SurveyResultsHtmlReportExportModalDescriptorInput = {
  analysisGenerating?: unknown;
  analysisPayload?: SessionResultsAnalysisPayloadBuildResult | Record<string, unknown>;
  analysisProgress?: unknown;
  exportFormat?: SessionResultsExportFormat | null;
  htmlReportAnalysisError?: ReactNode;
  isAuthorized?: unknown;
  isDemoMode?: unknown;
  isDemoSession?: unknown;
  isOpen?: unknown;
  selectedSections?: SessionResultsSectionSelection | null;
  snapshot: SessionResultsHtmlSnapshot;
};

export type SurveyResultsHtmlReportExportModalDescriptor = {
  analysisGenerating: boolean;
  analysisPayload: SessionResultsAnalysisPayloadBuildResult | Record<string, unknown>;
  analysisProgress: string;
  canDownload: boolean;
  exportFormat: SessionResultsExportFormat;
  htmlReportAnalysisError: ReactNode;
  isAuthorized: boolean;
  isDemoMode: boolean;
  isDemoSession: boolean;
  isOpen: boolean;
  needsAnalysisGeneration: boolean;
  sectionRows: SurveyResultsHtmlReportSectionRow[];
  selectedSections: Required<SessionResultsSectionSelection>;
  snapshot: SessionResultsHtmlSnapshot;
};

export const SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS: Required<SessionResultsSectionSelection> = Object.freeze({
  argumentMap: false,
  atlas: false,
  report: true,
  riskMatrix: false,
  snapshotJson: true,
});

export const SURVEY_RESULTS_HTML_REPORT_ANALYSIS_SECTION_KEYS: readonly SurveyResultsHtmlReportSectionKey[] = Object.freeze([
  'argumentMap',
  'riskMatrix',
  'atlas',
]);

const HTML_REPORT_SECTION_LABELS: Record<SurveyResultsHtmlReportSectionKey, string> = Object.freeze({
  argumentMap: 'Argument Map',
  atlas: 'Atlas Nodes',
  report: 'Report',
  riskMatrix: 'Risk Matrix',
  snapshotJson: 'Embedded Snapshot JSON',
});

const normalizeSurveyResultsHtmlReportSelectedSections = (
  selectedSections: SessionResultsSectionSelection | null | undefined
): Required<SessionResultsSectionSelection> => ({
  ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
  ...(selectedSections || {}),
});

const buildSurveyResultsHtmlReportSectionAvailability = (
  snapshot: SessionResultsHtmlSnapshot
): SurveyResultsHtmlReportSectionAvailability => ({
  report: !!snapshot.sections.report.available,
  argumentMap: !!snapshot.sections.argumentMap.available,
  riskMatrix: !!snapshot.sections.riskMatrix.available,
  atlas: !!snapshot.sections.atlas.available,
  snapshotJson: true,
});

const getSurveyResultsHtmlReportSectionReason = ({
  availability,
  key,
}: {
  availability: SurveyResultsHtmlReportSectionAvailability;
  key: SurveyResultsHtmlReportSectionKey;
}): string => {
  if (availability[key]) return key === 'snapshotJson' ? 'Always available' : 'Ready';
  if (key === 'report') return 'No hydrated results';
  return 'Needs analysis';
};

export const buildSurveyResultsHtmlReportReadinessPlan = ({
  analysisGenerating = false,
  isAuthorized = false,
  selectedSections,
  snapshot,
}: SurveyResultsHtmlReportReadinessPlanInput): SurveyResultsHtmlReportReadinessPlan => {
  const normalizedSelectedSections = normalizeSurveyResultsHtmlReportSelectedSections(selectedSections);
  const availability = buildSurveyResultsHtmlReportSectionAvailability(snapshot);
  const sectionRows: SurveyResultsHtmlReportSectionRow[] = ([
    'report',
    'argumentMap',
    'riskMatrix',
    'atlas',
    'snapshotJson',
  ] as SurveyResultsHtmlReportSectionKey[]).map((key) => ({
    available: availability[key],
    key,
    label: HTML_REPORT_SECTION_LABELS[key],
    reason: getSurveyResultsHtmlReportSectionReason({ availability, key }),
  }));
  const hasExportableSections = (
    (normalizedSelectedSections.report && availability.report) ||
    (normalizedSelectedSections.argumentMap && availability.argumentMap) ||
    (normalizedSelectedSections.riskMatrix && availability.riskMatrix) ||
    (normalizedSelectedSections.atlas && availability.atlas) ||
    normalizedSelectedSections.snapshotJson
  );
  const hasUnavailableSelectedSections = (
    (normalizedSelectedSections.report && !availability.report) ||
    (normalizedSelectedSections.argumentMap && !availability.argumentMap) ||
    (normalizedSelectedSections.riskMatrix && !availability.riskMatrix) ||
    (normalizedSelectedSections.atlas && !availability.atlas)
  );
  const needsAnalysisGeneration = SURVEY_RESULTS_HTML_REPORT_ANALYSIS_SECTION_KEYS.some(
    (key) => normalizedSelectedSections[key] && !availability[key]
  );

  return {
    availability,
    canDownload: !!isAuthorized &&
      hasExportableSections &&
      !hasUnavailableSelectedSections &&
      !analysisGenerating,
    hasExportableSections,
    hasUnavailableSelectedSections,
    needsAnalysisGeneration,
    sectionRows,
    selectedSections: normalizedSelectedSections,
  };
};

export const buildSurveyResultsHtmlReportExportModalDescriptor = ({
  analysisGenerating = false,
  analysisPayload = {},
  analysisProgress = '',
  exportFormat = SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  htmlReportAnalysisError = '',
  isAuthorized = false,
  isDemoMode = false,
  isDemoSession = false,
  isOpen = false,
  selectedSections,
  snapshot,
}: SurveyResultsHtmlReportExportModalDescriptorInput): SurveyResultsHtmlReportExportModalDescriptor => {
  const generating = !!analysisGenerating;
  const authorized = !!isAuthorized;
  const readinessPlan = buildSurveyResultsHtmlReportReadinessPlan({
    analysisGenerating: generating,
    isAuthorized: authorized,
    selectedSections,
    snapshot,
  });

  return {
    analysisGenerating: generating,
    analysisPayload,
    analysisProgress: String(analysisProgress || ''),
    canDownload: readinessPlan.canDownload,
    exportFormat: exportFormat || SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
    htmlReportAnalysisError,
    isAuthorized: authorized,
    isDemoMode: !!isDemoMode,
    isDemoSession: !!isDemoSession,
    isOpen: !!isOpen,
    needsAnalysisGeneration: readinessPlan.needsAnalysisGeneration,
    sectionRows: readinessPlan.sectionRows,
    selectedSections: readinessPlan.selectedSections,
    snapshot,
  };
};

export const buildSurveyResultsHtmlReportDownloadAttemptPlan = ({
  isAuthorized = false,
  readinessPlan,
}: {
  isAuthorized?: boolean;
  readinessPlan: Pick<
    SurveyResultsHtmlReportReadinessPlan,
    'hasExportableSections' | 'hasUnavailableSelectedSections'
  >;
}): SurveyResultsHtmlReportDownloadAttemptPlan => {
  if (!isAuthorized) {
    return {
      blockedReason: 'not-authorized',
      statePatch: buildSurveyResultsAlertMessagePatch('Connect a wallet with permission to view these results before export.'),
      status: 'blocked',
    };
  }
  if (!readinessPlan.hasExportableSections) {
    return {
      blockedReason: 'no-exportable-sections',
      statePatch: buildSurveyResultsAlertMessagePatch('Select at least one available report section before export.'),
      status: 'blocked',
    };
  }
  if (readinessPlan.hasUnavailableSelectedSections) {
    return {
      blockedReason: 'unavailable-selected-sections',
      statePatch: buildSurveyResultsAlertMessagePatch('Generate selected analysis views before downloading the report.'),
      status: 'blocked',
    };
  }

  return {
    blockedReason: '',
    statePatch: null,
    status: 'ready',
  };
};

export const buildSurveyResultsHtmlReportDownloadSuccessPatch = (): SurveyResultsHtmlReportDownloadStatePatch => ({
  alertMessage: '',
  htmlReportModalOpen: false,
});

export const buildSurveyResultsHtmlReportDownloadFailurePatch = (): SurveyResultsHtmlReportDownloadStatePatch => (
  buildSurveyResultsAlertMessagePatch('Unable to export the HTML report.')
);

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
