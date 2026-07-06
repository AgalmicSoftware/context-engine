import type {
  SessionResultsExportFormat,
  SessionResultsGeneratedAnalysisArtifact,
  SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
  normalizeSurveyResultsHtmlReportSelectedSections,
} from './surveyResultsHtmlReportSelection';

type SurveyResultsHtmlReportSectionKey = keyof Required<SessionResultsSectionSelection>;

export type SurveyResultsHtmlReportDownloadStatePatch = {
  alertMessage?: string;
  htmlReportAnalysisArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  htmlReportAnalysisError?: string;
  htmlReportAnalysisInputSignature?: string;
  htmlReportAnalysisProgress?: string;
  htmlReportDemoMode?: boolean;
  htmlReportExportedAt?: string;
  htmlReportExportFormat?: SessionResultsExportFormat;
  htmlReportModalOpen?: boolean;
  htmlReportSelectedSections?: Required<SessionResultsSectionSelection>;
};

export const buildSurveyResultsHtmlReportModalOpenPatch = (
  exportedAt: unknown
) => ({
  htmlReportModalOpen: true,
  htmlReportExportedAt: String(exportedAt || ''),
  htmlReportAnalysisError: '',
  alertMessage: '',
});

export const buildSurveyResultsHtmlReportModalClosePatch = () => ({
  htmlReportModalOpen: false,
});

export const buildSurveyResultsHtmlReportSectionTogglePatch = ({
  currentSections = {},
  sectionKey,
}: {
  currentSections?: SessionResultsSectionSelection | null;
  sectionKey?: SurveyResultsHtmlReportSectionKey | string;
} = {}) => {
  const normalizedSections = normalizeSurveyResultsHtmlReportSelectedSections(currentSections);
  const key = String(sectionKey || '') as SurveyResultsHtmlReportSectionKey;
  if (!(key in normalizedSections)) {
    return {
      htmlReportSelectedSections: normalizedSections,
    };
  }
  return {
    htmlReportSelectedSections: {
      ...normalizedSections,
      [key]: !normalizedSections[key],
    },
  };
};

export const buildSurveyResultsHtmlReportDemoModePatch = ({
  currentArtifact = null,
  demoArtifact = null,
  nextDemoMode = false,
}: {
  currentArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  demoArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  nextDemoMode?: unknown;
} = {}) => {
  const enabled = !!nextDemoMode;
  return {
    htmlReportDemoMode: enabled,
    htmlReportAnalysisArtifact: enabled
      ? demoArtifact
      : currentArtifact?.model === 'demo-preview'
        ? null
        : currentArtifact,
    htmlReportAnalysisError: '',
    htmlReportSelectedSections: enabled
      ? {
        argumentMap: true,
        atlas: true,
        report: true,
        riskMatrix: true,
        snapshotJson: true,
      }
      : { ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS },
  };
};

export const buildSurveyResultsHtmlReportFormatPatch = (
  format: SessionResultsExportFormat
) => ({
  htmlReportExportFormat: format,
});

export const buildSurveyResultsHtmlReportAnalysisDemoReadyPatch = (
  artifact: SessionResultsGeneratedAnalysisArtifact
) => ({
  htmlReportAnalysisArtifact: artifact,
  htmlReportAnalysisError: '',
});

export const buildSurveyResultsHtmlReportAnalysisErrorPatch = (
  htmlReportAnalysisError: unknown
) => ({
  htmlReportAnalysisError: String(htmlReportAnalysisError || ''),
});

export const buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch = ({
  inputSignature = '',
  reason = '',
}: {
  inputSignature?: unknown;
  reason?: unknown;
} = {}) => ({
  htmlReportAnalysisError: String(reason || ''),
  htmlReportAnalysisInputSignature: String(inputSignature || ''),
});

export const buildSurveyResultsHtmlReportAnalysisProgressPatch = (
  htmlReportAnalysisProgress: unknown
) => ({
  htmlReportAnalysisProgress: String(htmlReportAnalysisProgress || ''),
});
