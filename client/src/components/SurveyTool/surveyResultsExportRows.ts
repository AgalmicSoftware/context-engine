type SurveyResultsQuestionRecord = {
  id?: unknown;
  options?: unknown;
  prompt?: unknown;
  tags?: unknown;
  type?: unknown;
};

type SurveyResultsResponseRecord = {
  questionID?: unknown;
  questionId?: unknown;
  responses?: unknown;
};

type SurveyResultsFilteredResponseRow = {
  response?: unknown;
};

export type SurveyResultsQuestionExportRecord = {
  id: unknown;
  options: unknown[];
  prompt: unknown;
  tags: unknown[];
  type: unknown;
};

export type BuildSurveyResultsFilteredQuestionIdsForExportArgs = {
  aggregatorQuestionResponses?: Record<string, unknown> | null;
  filteredResponses?: SurveyResultsFilteredResponseRow[] | null;
  getResponseQuestionId: (response: SurveyResultsResponseRecord | null | undefined) => string;
  parseResponse: (response: unknown) => SurveyResultsResponseRecord | null | undefined;
};

export type BuildSurveyResultsFilteredQuestionsForExportArgs = {
  networkQuestions?: Record<string, SurveyResultsQuestionRecord | undefined> | null;
  questionIds?: string[] | null;
};

export const buildSurveyResultsFilteredQuestionIdsForExport = ({
  aggregatorQuestionResponses = null,
  filteredResponses = [],
  getResponseQuestionId,
  parseResponse,
}: BuildSurveyResultsFilteredQuestionIdsForExportArgs): string[] => {
  const questionIds = new Set<string>();

  Object.keys(aggregatorQuestionResponses || {}).forEach((qId) => {
    const normalized = String(qId || '')
      .trim()
      .toLowerCase();
    if (normalized) questionIds.add(normalized);
  });

  (Array.isArray(filteredResponses) ? filteredResponses : []).forEach((response) => {
    const parsedResponse = parseResponse(response?.response);
    const responseRows = Array.isArray(parsedResponse?.responses) ? parsedResponse.responses : [];
    responseRows.forEach((answer) => {
      const normalized = getResponseQuestionId(answer as SurveyResultsResponseRecord);
      if (normalized) questionIds.add(String(normalized).toLowerCase());
    });
  });

  return Array.from(questionIds);
};

export const buildSurveyResultsFilteredQuestionsForExport = ({
  networkQuestions = null,
  questionIds = [],
}: BuildSurveyResultsFilteredQuestionsForExportArgs): SurveyResultsQuestionExportRecord[] => {
  const questions = networkQuestions || {};
  return (Array.isArray(questionIds) ? questionIds : []).map((qId) => {
    const normalizedQuestionId = String(qId || '').toLowerCase();
    const questionData = questions[normalizedQuestionId] || questions[String(qId || '')] || {};

    return {
      id: questionData.id || qId,
      prompt: questionData.prompt || '',
      type: questionData.type || '',
      tags: Array.isArray(questionData.tags) ? [...questionData.tags] : [],
      options: Array.isArray(questionData.options) ? [...questionData.options] : [],
    };
  });
};
