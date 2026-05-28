import {
  SURVEY_RESULTS_EXPORT_OPTIONS,
  SURVEY_RESULTS_EXPORT_TYPES,
  buildSurveyResultsExportControlsDisplayDescriptor,
  getSurveyResultsExportTypeLabel,
} from './surveyResultsExportDisplayHelpers.js';

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
});
