import { formatTsForCsv, pickTimestampMs } from './surveyResultsHelpers.js';

export type SurveyResultsExportOption = {
  label: string;
  value: string;
};

type SurveyResultsRecord = Record<string, unknown>;

type SurveyResultsJsonExportCounts = {
  filteredQuestions?: unknown;
  filteredResponses?: unknown;
  totalQuestions?: unknown;
  totalResponses?: unknown;
};

export type SurveyResultsQuestionsJsonExportArgs = {
  counts?: SurveyResultsJsonExportCounts;
  exportedAt?: unknown;
  filteredQuestions?: unknown;
  filterState?: unknown;
  sessionSlug?: unknown;
  surveyId?: unknown;
  surveyTitle?: unknown;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsResponsesJsonExportArgs = SurveyResultsQuestionsJsonExportArgs & {
  filteredQuestionResponses?: unknown;
  filteredResponses?: unknown;
};

export type SurveyResultsQuestionCsvExportRecord = {
  id?: unknown;
  options?: unknown;
  prompt?: unknown;
  tags?: unknown;
  type?: unknown;
};

export type SurveyResultsResponseCsvParsePort = (response: unknown) => unknown;

export type SurveyResultsResponsesCsvExportArgs = {
  aggregatorQuestionResponses?: unknown;
  filteredResponses?: unknown;
  networkQuestions?: unknown;
  parseResponse?: SurveyResultsResponseCsvParsePort | null;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

type SurveyResultsCsvLatestEntry = {
  ms: number;
  row: string;
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
  'questions-csv' | 'questions-json' | 'questions-responses-csv' | 'questions-responses-json';

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
  SurveyResultsExportGenerationPlanInvalid | SurveyResultsExportGenerationPlanReady;

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
  SurveyResultsExportDownloadPlanEmpty | SurveyResultsExportDownloadPlanReady;

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

const quoteCsvCell = (value: unknown): string =>
  `"${String(value !== undefined && value !== null ? value : '').replace(/"/g, '""')}"`;

const quoteResponseCsvCell = (value: unknown): string => {
  const cellValue = Array.isArray(value) ? value.join(', ') : value;
  return quoteCsvCell(cellValue);
};

const isSurveyResultsRecord = (value: unknown): value is SurveyResultsRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const toSurveyResultsRecord = (value: unknown): SurveyResultsRecord => (isSurveyResultsRecord(value) ? value : {});

const defaultParseResponseForCsv = (response: unknown): unknown => {
  if (isSurveyResultsRecord(response)) return response;
  if (typeof response !== 'string') return null;
  const trimmed = response.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isSurveyResultsRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getResponseQuestionIdForCsv = (response: SurveyResultsRecord): string =>
  String(response.questionID || response.questionId || '').trim();

const getResponseQuestionPromptForCsv = (response: SurveyResultsRecord, questionData: SurveyResultsRecord): unknown =>
  response.prompt || questionData.prompt || '';

const getResponseQuestionTypeForCsv = (response: SurveyResultsRecord, questionData: SurveyResultsRecord): unknown =>
  response.type || questionData.type || '';

const getConvictionValueForCsv = (response: SurveyResultsRecord): unknown => {
  if (response.conviction !== undefined && response.conviction !== null) return response.conviction;
  if (response.importance !== undefined && response.importance !== null) return response.importance;
  return '';
};

const getResponseFieldValueForCsv = (
  response: SurveyResultsRecord,
  fieldName: 'additional' | 'answer',
  key: 'encrypted' | 'hash' | 'value',
): unknown => toSurveyResultsRecord(response[fieldName])[key];

const readResponderAddressForCsv = (value: unknown): unknown => {
  if (typeof value === 'string') return value;
  const record = toSurveyResultsRecord(value);
  if (typeof record.address === 'string') return record.address;
  return value || '';
};

const readQuestionDataForCsv = (networkQuestions: unknown, questionId: string): SurveyResultsRecord => {
  const questionLookup = toSurveyResultsRecord(networkQuestions);
  return toSurveyResultsRecord(questionLookup[questionId.toLowerCase()] ?? questionLookup[questionId]);
};

const readQuestionOptionsForCsv = (questionData: SurveyResultsRecord): string =>
  questionData.type === 'multichoice' && Array.isArray(questionData.options) ? questionData.options.join(';') : '';

export const buildSurveyResultsQuestionsCsvExport = (
  filteredQuestions: readonly SurveyResultsQuestionCsvExportRecord[] = [],
): string => {
  const header = '"questionID","prompt","type","tags","options"\n';
  const csvRows = filteredQuestions.map((question) => {
    const tags = Array.isArray(question?.tags) ? question.tags.join(';') : '';
    const options = Array.isArray(question?.options) ? question.options.join(';') : '';
    return [
      quoteCsvCell(question?.id),
      quoteCsvCell(question?.prompt),
      quoteCsvCell(question?.type),
      quoteCsvCell(tags),
      quoteCsvCell(options),
    ].join(',');
  });

  return header + csvRows.join('\n');
};

export const buildSurveyResultsResponsesCsvExport = ({
  aggregatorQuestionResponses = {},
  filteredResponses = [],
  networkQuestions = {},
  parseResponse = defaultParseResponseForCsv,
  surveyViewMode = '',
  viewMode = '',
}: SurveyResultsResponsesCsvExportArgs = {}): string => {
  const parsePort = typeof parseResponse === 'function' ? parseResponse : defaultParseResponseForCsv;
  const csvRows: string[] = [];

  if (viewMode === 'survey' && surveyViewMode === 'individuals') {
    const header =
      'responderAddress,questionID,questionPrompt,type,options,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp\n';
    const latest = new Map<string, SurveyResultsCsvLatestEntry>();
    const passthroughRows: string[] = [];
    const rows = Array.isArray(filteredResponses) ? filteredResponses : [];

    rows.forEach((responseRow) => {
      const responseRecord = toSurveyResultsRecord(responseRow);
      const parsedValue = parsePort(responseRecord.response);
      if (!isSurveyResultsRecord(parsedValue) || !Array.isArray(parsedValue.responses)) return;

      parsedValue.responses.forEach((answerValue) => {
        const answer = toSurveyResultsRecord(answerValue);
        const qid = getResponseQuestionIdForCsv(answer);
        const responderAddress = readResponderAddressForCsv(responseRecord.responder);
        const questionData = readQuestionDataForCsv(networkQuestions, qid);
        const optionsString = readQuestionOptionsForCsv(questionData);
        const ms = pickTimestampMs(answer, parsedValue, responseRecord);
        const row = [
          responderAddress,
          qid,
          getResponseQuestionPromptForCsv(answer, questionData),
          getResponseQuestionTypeForCsv(answer, questionData),
          optionsString,
          getConvictionValueForCsv(answer),
          getResponseFieldValueForCsv(answer, 'answer', 'value'),
          getResponseFieldValueForCsv(answer, 'answer', 'hash'),
          getResponseFieldValueForCsv(answer, 'additional', 'value'),
          getResponseFieldValueForCsv(answer, 'answer', 'encrypted'),
          getResponseFieldValueForCsv(answer, 'additional', 'encrypted'),
          getResponseFieldValueForCsv(answer, 'additional', 'hash'),
          formatTsForCsv(ms),
        ]
          .map(quoteResponseCsvCell)
          .join(',');

        if (!responderAddress || !qid) {
          passthroughRows.push(row);
          return;
        }

        const key = `${String(responderAddress).toLowerCase()}|${qid.toLowerCase()}`;
        const prev = latest.get(key);
        if (!prev || ms > prev.ms) {
          latest.set(key, { ms, row });
        }
      });
    });

    csvRows.push(...passthroughRows, ...Array.from(latest.values()).map((entry) => entry.row));
    return header + csvRows.join('\n');
  }

  const header =
    'questionID,questionPrompt,type,options,responderAddress,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp\n';
  const latest = new Map<string, SurveyResultsCsvLatestEntry>();
  const passthroughRows: string[] = [];

  Object.entries(toSurveyResultsRecord(aggregatorQuestionResponses)).forEach(
    ([questionIdFromBucket, responsesArray]) => {
      const rows = Array.isArray(responsesArray) ? responsesArray : [];
      rows.forEach((responseRow) => {
        const responseRecord = toSurveyResultsRecord(responseRow);
        const parsedValue = parsePort(responseRecord.response);
        if (!isSurveyResultsRecord(parsedValue)) return;

        const responderAddress = readResponderAddressForCsv(responseRecord.responder);
        const qid = getResponseQuestionIdForCsv(parsedValue) || String(questionIdFromBucket || '');
        const questionData = readQuestionDataForCsv(networkQuestions, qid);
        const optionsString = readQuestionOptionsForCsv(questionData);
        const ms = pickTimestampMs(parsedValue, null, responseRecord);
        const row = [
          qid,
          getResponseQuestionPromptForCsv(parsedValue, questionData),
          getResponseQuestionTypeForCsv(parsedValue, questionData),
          optionsString,
          responderAddress,
          getConvictionValueForCsv(parsedValue),
          getResponseFieldValueForCsv(parsedValue, 'answer', 'value'),
          getResponseFieldValueForCsv(parsedValue, 'answer', 'hash'),
          getResponseFieldValueForCsv(parsedValue, 'additional', 'value'),
          getResponseFieldValueForCsv(parsedValue, 'answer', 'encrypted'),
          getResponseFieldValueForCsv(parsedValue, 'additional', 'encrypted'),
          getResponseFieldValueForCsv(parsedValue, 'additional', 'hash'),
          formatTsForCsv(ms),
        ]
          .map(quoteResponseCsvCell)
          .join(',');

        if (!responderAddress || !qid) {
          passthroughRows.push(row);
          return;
        }

        const key = `${String(responderAddress).toLowerCase()}|${String(qid).toLowerCase()}`;
        const prev = latest.get(key);
        if (!prev || ms > prev.ms) {
          latest.set(key, { ms, row });
        }
      });
    },
  );

  csvRows.push(...passthroughRows, ...Array.from(latest.values()).map((entry) => entry.row));
  return header + csvRows.join('\n');
};

const buildCommonSurveyResultsJsonExport = ({
  counts = {},
  exportedAt = '',
  filteredQuestions = [],
  filterState = {},
  sessionSlug = '',
  surveyId = null,
  surveyTitle = '',
  surveyViewMode = '',
  viewMode = '',
}: SurveyResultsQuestionsJsonExportArgs = {}) => ({
  exportedAt,
  sessionSlug: String(sessionSlug || ''),
  viewMode,
  surveyViewMode,
  surveyId: surveyId || null,
  surveyTitle: surveyTitle || '',
  counts: {
    totalQuestions: counts.totalQuestions,
    filteredQuestions: counts.filteredQuestions,
    totalResponses: counts.totalResponses,
    filteredResponses: counts.filteredResponses,
  },
  filterState: filterState || {},
  filteredQuestions,
});

export const buildSurveyResultsQuestionsJsonExport = (args: SurveyResultsQuestionsJsonExportArgs = {}): string =>
  JSON.stringify(buildCommonSurveyResultsJsonExport(args), null, 2);

export const buildSurveyResultsResponsesJsonExport = ({
  filteredQuestionResponses = {},
  filteredResponses = [],
  ...args
}: SurveyResultsResponsesJsonExportArgs = {}): string =>
  JSON.stringify(
    {
      ...buildCommonSurveyResultsJsonExport(args),
      filteredQuestionResponses: filteredQuestionResponses || {},
      filteredResponses: filteredResponses || [],
    },
    null,
    2,
  );
