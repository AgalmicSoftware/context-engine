import {
  buildSurveyResultsAlertMessagePatch,
} from './surveyResultsHelpers';
import {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
} from './surveyResultsHtmlReportSelection';
import type {
  SurveyResultsHtmlReportReadinessPlan,
} from './surveyResultsHtmlReportReadiness';
import type {
  SurveyResultsHtmlReportDownloadStatePatch,
} from './surveyResultsHtmlReportStatePatches';

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
export {
  buildSurveyResultsHtmlReportExportModalDescriptor,
} from './surveyResultsHtmlReportModalDescriptor';
export type {
  SurveyResultsHtmlReportAnalysisPayload,
  SurveyResultsHtmlReportExportModalDescriptor,
  SurveyResultsHtmlReportExportModalDescriptorInput,
} from './surveyResultsHtmlReportModalDescriptor';

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
