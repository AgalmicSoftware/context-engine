import type { SessionResultsSectionSelection } from '../../utilities/sessionResultsExport';

export const SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS: Required<SessionResultsSectionSelection> =
  Object.freeze({
    argumentMap: false,
    atlas: false,
    report: true,
    riskMatrix: false,
    snapshotJson: true,
  });

export const normalizeSurveyResultsHtmlReportSelectedSections = (
  selectedSections: SessionResultsSectionSelection | null | undefined,
): Required<SessionResultsSectionSelection> => ({
  ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
  ...(selectedSections || {}),
});
