import {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
  normalizeSurveyResultsHtmlReportSelectedSections,
} from './surveyResultsHtmlReportSelection';

describe('surveyResultsHtmlReportSelection', () => {
  it('normalizes missing selected sections to the report and snapshot defaults', () => {
    expect(normalizeSurveyResultsHtmlReportSelectedSections(null)).toEqual({
      argumentMap: false,
      atlas: false,
      report: true,
      riskMatrix: false,
      snapshotJson: true,
    });
  });

  it('overlays caller-provided selected sections without mutating the shared defaults', () => {
    const normalized = normalizeSurveyResultsHtmlReportSelectedSections({
      argumentMap: true,
      report: false,
    });

    expect(normalized).toEqual({
      ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
      argumentMap: true,
      report: false,
    });
    expect(SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS).toEqual({
      argumentMap: false,
      atlas: false,
      report: true,
      riskMatrix: false,
      snapshotJson: true,
    });
  });
});
