import type {
  SessionResultsReportQuestion,
} from '../../utilities/sessionResultsExport';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsHtmlReportParsePort = (response: unknown) => unknown;
export type SurveyResultsHtmlReportQuestionIdPort = (response: unknown) => string;

export type SurveyResultsHtmlReportQuestionRecord = {
  id?: unknown;
  options?: unknown;
  prompt?: unknown;
  tags?: unknown;
  type?: unknown;
};

export type BuildSurveyResultsHtmlReportResponseCountsArgs = {
  aggregatorQuestionResponses?: unknown;
  filteredResponses?: unknown;
  getResponseQuestionId?: SurveyResultsHtmlReportQuestionIdPort | null;
  parseResponse?: SurveyResultsHtmlReportParsePort | null;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

export type BuildSurveyResultsHtmlReportParticipantCountArgs = {
  aggregatorQuestionResponses?: unknown;
  filteredResponses?: unknown;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

export type BuildSurveyResultsHtmlReportQuestionsArgs = {
  filteredQuestions?: readonly SurveyResultsHtmlReportQuestionRecord[] | null;
  responseCountsByQuestion?: Map<string, number> | null;
};

const isRecord = (value: unknown): value is SurveyResultsRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const toRecord = (value: unknown): SurveyResultsRecord => (
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

const defaultQuestionId = (response: unknown): string => {
  const record = toRecord(response);
  return String(record.questionID || record.questionId || '').trim();
};

const normalizeKey = (value: unknown): string => (
  String(value || '').trim().toLowerCase()
);

const isSurveyIndividualsMode = (viewMode: unknown, surveyViewMode: unknown): boolean => (
  viewMode === 'survey' && surveyViewMode === 'individuals'
);

const normalizeStringList = (value: unknown): string[] => (
  Array.isArray(value) ? value.map((entry: unknown) => String(entry || '').trim()).filter(Boolean) : []
);

export const buildSurveyResultsHtmlReportResponseCountsByQuestion = ({
  aggregatorQuestionResponses = {},
  filteredResponses = [],
  getResponseQuestionId = defaultQuestionId,
  parseResponse = defaultParseResponse,
  surveyViewMode = '',
  viewMode = '',
}: BuildSurveyResultsHtmlReportResponseCountsArgs = {}): Map<string, number> => {
  const counts = new Map<string, number>();
  const addCount = (questionId: unknown, amount = 1): void => {
    const normalized = normalizeKey(questionId);
    if (!normalized) return;
    counts.set(normalized, (counts.get(normalized) || 0) + amount);
  };
  const parsePort = typeof parseResponse === 'function' ? parseResponse : defaultParseResponse;
  const questionIdPort = typeof getResponseQuestionId === 'function'
    ? getResponseQuestionId
    : defaultQuestionId;

  if (isSurveyIndividualsMode(viewMode, surveyViewMode)) {
    const rows = Array.isArray(filteredResponses) ? filteredResponses : [];
    rows.forEach((responseRow) => {
      const parsedResponse = parsePort(toRecord(responseRow).response);
      const responseRows = isRecord(parsedResponse) && Array.isArray(parsedResponse.responses)
        ? parsedResponse.responses
        : [];
      responseRows.forEach((answer) => {
        addCount(questionIdPort(answer));
      });
    });
    return counts;
  }

  Object.entries(toRecord(aggregatorQuestionResponses)).forEach(([questionId, rows]) => {
    addCount(questionId, Array.isArray(rows) ? rows.length : 0);
  });
  return counts;
};

const readParticipantAddress = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  const record = toRecord(value);
  return String(record.address || record.walletAddress || '').trim();
};

export const buildSurveyResultsHtmlReportParticipantCount = ({
  aggregatorQuestionResponses = {},
  filteredResponses = [],
  surveyViewMode = '',
  viewMode = '',
}: BuildSurveyResultsHtmlReportParticipantCountArgs = {}): number => {
  const participants = new Set<string>();
  const addParticipant = (value: unknown): void => {
    const address = readParticipantAddress(value);
    if (address) participants.add(address.toLowerCase());
  };

  if (isSurveyIndividualsMode(viewMode, surveyViewMode)) {
    const rows = Array.isArray(filteredResponses) ? filteredResponses : [];
    rows.forEach((responseRow) => addParticipant(toRecord(responseRow).responder));
    return participants.size;
  }

  Object.values(toRecord(aggregatorQuestionResponses)).forEach((rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => addParticipant(toRecord(row).responder));
  });
  return participants.size;
};

export const buildSurveyResultsHtmlReportQuestionsForExport = ({
  filteredQuestions = [],
  responseCountsByQuestion = new Map<string, number>(),
}: BuildSurveyResultsHtmlReportQuestionsArgs = {}): SessionResultsReportQuestion[] => (
  (Array.isArray(filteredQuestions) ? filteredQuestions : []).map((question) => {
    const id = String(question.id || '').trim();
    const countKey = id.toLowerCase();
    return {
      id,
      prompt: String(question.prompt || '').trim(),
      type: String(question.type || '').trim(),
      tags: normalizeStringList(question.tags),
      options: normalizeStringList(question.options),
      responseCount: responseCountsByQuestion?.get(countKey) || 0,
    };
  })
);
