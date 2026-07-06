import type {
  SessionResultsAnalysisResponseInput,
} from '../../utilities/sessionResultsExport';

type SurveyResultsAnalysisRecord = Record<string, unknown>;

export type SurveyResultsAnalysisParsePort = (response: unknown) => unknown;
export type SurveyResultsAnalysisQuestionIdPort = (response: unknown) => string;
export type SurveyResultsAnalysisQuestionMetadataPort = (
  response: unknown,
  questionData?: SurveyResultsAnalysisRecord | null
) => unknown;

export type BuildSurveyResultsAnalysisResponsesArgs = {
  aggregatorQuestionResponses?: unknown;
  filteredResponses?: unknown;
  getResponseQuestionId?: SurveyResultsAnalysisQuestionIdPort | null;
  getResponseQuestionPrompt?: SurveyResultsAnalysisQuestionMetadataPort | null;
  getResponseQuestionType?: SurveyResultsAnalysisQuestionMetadataPort | null;
  networkQuestions?: unknown;
  parseResponse?: SurveyResultsAnalysisParsePort | null;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

const isRecord = (value: unknown): value is SurveyResultsAnalysisRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const toRecord = (value: unknown): SurveyResultsAnalysisRecord => (
  isRecord(value) ? value : {}
);

const defaultParseResponse = (response: unknown): unknown => {
  if (isRecord(response)) return response;
  if (typeof response !== 'string') return null;
  const trimmed = response.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const defaultGetQuestionId = (response: unknown): string => {
  const record = toRecord(response);
  return String(record.questionID || record.questionId || '').trim();
};

const defaultGetQuestionPrompt = (response: unknown, questionData: SurveyResultsAnalysisRecord | null = null): unknown => {
  const responseRecord = toRecord(response);
  const questionRecord = toRecord(questionData);
  return responseRecord.prompt || questionRecord.prompt || '';
};

const defaultGetQuestionType = (response: unknown, questionData: SurveyResultsAnalysisRecord | null = null): unknown => {
  const responseRecord = toRecord(response);
  const questionRecord = toRecord(questionData);
  return responseRecord.type || questionRecord.type || questionRecord.questionType || '';
};

const isSurveyIndividualsMode = (viewMode: unknown, surveyViewMode: unknown): boolean => (
  viewMode === 'survey' && surveyViewMode === 'individuals'
);

export const readSurveyResultsAnalysisTextField = (field: unknown): string => {
  if (field === null || field === undefined) return '';
  if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
    return String(field).trim();
  }
  const record = toRecord(field);
  const value = record.value ?? record.text ?? record.answer;
  if (value === null || value === undefined || value === '*') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
};

export const buildSurveyResultsAnalysisResponsesForExport = ({
  aggregatorQuestionResponses = {},
  filteredResponses = [],
  getResponseQuestionId = defaultGetQuestionId,
  getResponseQuestionPrompt = defaultGetQuestionPrompt,
  getResponseQuestionType = defaultGetQuestionType,
  networkQuestions = {},
  parseResponse = defaultParseResponse,
  surveyViewMode = '',
  viewMode = '',
}: BuildSurveyResultsAnalysisResponsesArgs = {}): SessionResultsAnalysisResponseInput[] => {
  const rows: SessionResultsAnalysisResponseInput[] = [];
  const questions = toRecord(networkQuestions);
  const parsePort = typeof parseResponse === 'function' ? parseResponse : defaultParseResponse;
  const questionIdPort = typeof getResponseQuestionId === 'function'
    ? getResponseQuestionId
    : defaultGetQuestionId;
  const questionPromptPort = typeof getResponseQuestionPrompt === 'function'
    ? getResponseQuestionPrompt
    : defaultGetQuestionPrompt;
  const questionTypePort = typeof getResponseQuestionType === 'function'
    ? getResponseQuestionType
    : defaultGetQuestionType;
  const pushRow = (
    response: unknown,
    responder: unknown,
    questionIdFallback: unknown = ''
  ): void => {
    if (!isRecord(response)) return;
    const questionId = questionIdPort(response) || String(questionIdFallback || '').trim();
    if (!questionId) return;
    const questionData = toRecord(questions[questionId.toLowerCase()] || questions[questionId]);
    const answer = readSurveyResultsAnalysisTextField(response.answer);
    const additional = readSurveyResultsAnalysisTextField(response.additional);
    if (!answer && !additional) return;
    rows.push({
      additional,
      answer,
      participantAddress: responder,
      questionId,
      questionPrompt: questionPromptPort(response, questionData),
      questionType: questionTypePort(response, questionData),
    });
  };

  if (isSurveyIndividualsMode(viewMode, surveyViewMode)) {
    const responseRows = Array.isArray(filteredResponses) ? filteredResponses : [];
    responseRows.forEach((responseRow) => {
      const row = toRecord(responseRow);
      const parsedResponse = parsePort(row.response);
      const answers = isRecord(parsedResponse) && Array.isArray(parsedResponse.responses)
        ? parsedResponse.responses
        : [];
      answers.forEach((answer) => pushRow(answer, row.responder));
    });
    return rows;
  }

  Object.entries(toRecord(aggregatorQuestionResponses)).forEach(([questionId, responsesArray]) => {
    if (!Array.isArray(responsesArray)) return;
    responsesArray.forEach((responseRow) => {
      const row = toRecord(responseRow);
      pushRow(parsePort(row.response), row.responder, questionId);
    });
  });
  return rows;
};
