import {
  SURVEY_RESULTS_EXPORT_OPTIONS,
  SURVEY_RESULTS_EXPORT_TYPES,
  buildSurveyResultsExportBaseFileName,
  buildSurveyResultsExportControlsDisplayDescriptor,
  buildSurveyResultsExportDownloadPlan,
  buildSurveyResultsExportGenerationPlan,
  buildSurveyResultsQuestionsCsvExport,
  buildSurveyResultsQuestionsJsonExport,
  buildSurveyResultsResponsesJsonExport,
  getSurveyResultsExportTypeLabel,
} from './surveyResultsExportPlans';

describe('surveyResultsExportPlans', () => {
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

  it('builds export base filenames from mode and export type descriptors', () => {
    expect(buildSurveyResultsExportBaseFileName({
      exportType: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS,
      surveyIdShort: 'abc-def',
      viewMode: 'survey',
    })).toBe('contextEngine_surveyQuestions_abc-def');

    expect(buildSurveyResultsExportBaseFileName({
      exportType: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES,
      surveyIdShort: 'abc-def',
      viewMode: 'survey',
    })).toBe('contextEngine_surveyResults_abc-def');

    expect(buildSurveyResultsExportBaseFileName({
      exportType: SURVEY_RESULTS_EXPORT_TYPES.JSON_QUESTIONS,
      viewMode: 'questions',
    })).toBe('contextEngine_filteredQuestions');

    expect(buildSurveyResultsExportBaseFileName({
      exportType: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
      viewMode: 'questions',
    })).toBe('contextEngine_questionResults');

    expect(buildSurveyResultsExportBaseFileName({
      exportType: SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
      surveyIdShort: '',
      viewMode: 'survey',
    })).toBe('contextEngine_surveyResults_all');
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

  it('builds questions-only CSV with stable quoting and list separators', () => {
    expect(buildSurveyResultsQuestionsCsvExport([
      {
        id: 'q1',
        options: ['Alpha', 'Beta'],
        prompt: 'Question "One"',
        tags: ['tag-a', 'tag-b'],
        type: 'multichoice',
      },
    ])).toBe(
      '"questionID","prompt","type","tags","options"\n'
      + '"q1","Question ""One""","multichoice","tag-a;tag-b","Alpha;Beta"'
    );
  });

  it('builds questions JSON from an explicit export snapshot', () => {
    expect(buildSurveyResultsQuestionsJsonExport({
      counts: {
        filteredQuestions: 1,
        filteredResponses: 2,
        totalQuestions: 3,
        totalResponses: 4,
      },
      exportedAt: '2026-07-06T00:00:00.000Z',
      filteredQuestions: [{ id: 'q1' }],
      filterState: { search: 'alpha' },
      sessionSlug: 'demo-session',
      surveyId: 'survey-1',
      surveyTitle: 'Demo Survey',
      surveyViewMode: 'aggregate',
      viewMode: 'survey',
    })).toBe(JSON.stringify({
      exportedAt: '2026-07-06T00:00:00.000Z',
      sessionSlug: 'demo-session',
      viewMode: 'survey',
      surveyViewMode: 'aggregate',
      surveyId: 'survey-1',
      surveyTitle: 'Demo Survey',
      counts: {
        totalQuestions: 3,
        filteredQuestions: 1,
        totalResponses: 4,
        filteredResponses: 2,
      },
      filterState: { search: 'alpha' },
      filteredQuestions: [{ id: 'q1' }],
    }, null, 2));
  });

  it('builds responses JSON with filtered response payload branches', () => {
    expect(buildSurveyResultsResponsesJsonExport({
      counts: {
        filteredQuestions: 1,
        filteredResponses: 2,
        totalQuestions: 3,
        totalResponses: 4,
      },
      exportedAt: '2026-07-06T00:00:00.000Z',
      filteredQuestionResponses: { q1: [{ response: 'alpha' }] },
      filteredQuestions: [{ id: 'q1' }],
      filteredResponses: [{ responder: '0xabc' }],
      filterState: { search: 'alpha' },
      sessionSlug: 'demo-session',
      surveyId: 'survey-1',
      surveyTitle: 'Demo Survey',
      surveyViewMode: 'aggregate',
      viewMode: 'survey',
    })).toBe(JSON.stringify({
      exportedAt: '2026-07-06T00:00:00.000Z',
      sessionSlug: 'demo-session',
      viewMode: 'survey',
      surveyViewMode: 'aggregate',
      surveyId: 'survey-1',
      surveyTitle: 'Demo Survey',
      counts: {
        totalQuestions: 3,
        filteredQuestions: 1,
        totalResponses: 4,
        filteredResponses: 2,
      },
      filterState: { search: 'alpha' },
      filteredQuestions: [{ id: 'q1' }],
      filteredQuestionResponses: { q1: [{ response: 'alpha' }] },
      filteredResponses: [{ responder: '0xabc' }],
    }, null, 2));
  });
});
