import {
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsAnalysisEligibility,
  type SessionResultsAnalysisPayloadBuildResult,
  type SessionResultsExportFormat,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import {
  buildSurveyResultsAlertMessagePatch,
} from './surveyResultsHelpers';
import {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
} from './surveyResultsHtmlReportSelection';
import {
  buildSurveyResultsHtmlReportReadinessPlan,
} from './surveyResultsHtmlReportReadiness';
import type {
  SurveyResultsHtmlReportReadinessPlan,
  SurveyResultsHtmlReportSectionRow,
} from './surveyResultsHtmlReportReadiness';
import type {
  SurveyResultsHtmlReportDownloadStatePatch,
} from './surveyResultsHtmlReportStatePatches';
import type { ReactNode } from 'react';

export {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
  normalizeSurveyResultsHtmlReportSelectedSections,
} from './surveyResultsHtmlReportSelection';
export {
  SURVEY_RESULTS_HTML_REPORT_ANALYSIS_SECTION_KEYS,
  buildSurveyResultsHtmlReportReadinessPlan,
} from './surveyResultsHtmlReportReadiness';
export type {
  SurveyResultsHtmlReportReadinessPlan,
  SurveyResultsHtmlReportReadinessPlanInput,
  SurveyResultsHtmlReportSectionAvailability,
  SurveyResultsHtmlReportSectionKey,
  SurveyResultsHtmlReportSectionRow,
} from './surveyResultsHtmlReportReadiness';
export {
  buildSurveyResultsHtmlReportAnalysisDemoReadyPatch,
  buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch,
  buildSurveyResultsHtmlReportAnalysisErrorPatch,
  buildSurveyResultsHtmlReportAnalysisProgressPatch,
  buildSurveyResultsHtmlReportDemoModePatch,
  buildSurveyResultsHtmlReportFormatPatch,
  buildSurveyResultsHtmlReportModalClosePatch,
  buildSurveyResultsHtmlReportModalOpenPatch,
  buildSurveyResultsHtmlReportSectionTogglePatch,
} from './surveyResultsHtmlReportStatePatches';
export type {
  SurveyResultsHtmlReportDownloadStatePatch,
} from './surveyResultsHtmlReportStatePatches';

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
      | 'analysis-generating'
      | 'unavailable-selected-sections';
    statePatch: SurveyResultsHtmlReportDownloadStatePatch;
    status: 'blocked';
  };

export type SurveyResultsHtmlReportAnalysisPayload =
  Partial<SessionResultsAnalysisPayloadBuildResult> &
  Record<string, unknown> & {
    eligibility?: Partial<SessionResultsAnalysisEligibility>;
    inputSignature?: unknown;
  };

export type SurveyResultsHtmlReportExportModalDescriptorInput = {
  analysisGenerating?: unknown;
  analysisPayload?: SurveyResultsHtmlReportAnalysisPayload;
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
  analysisPayload: SurveyResultsHtmlReportAnalysisPayload;
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
  analysisGenerating = false,
  isAuthorized = false,
  readinessPlan,
}: {
  analysisGenerating?: unknown;
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
  if (analysisGenerating) {
    return {
      blockedReason: 'analysis-generating',
      statePatch: buildSurveyResultsAlertMessagePatch('Wait for analysis generation to finish before downloading the report.'),
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
