import { normalizeRatingScale, type RatingScale } from '../../utilities/survey/ratingValue';

type SurveyResultsQuestionRecord = Record<string, unknown>;

type SurveyResultsResponseRecord = {
  questionID?: unknown;
  questionId?: unknown;
  responses?: unknown;
};

type SurveyResultsFilteredResponseRow = {
  response?: unknown;
};

const PUBLIC_SOURCE_FIELDS = [
  'order',
  'benchmarkQuestionId',
  'sourceCommentId',
  'sourceType',
  'aiFuturesCommentId',
] as const;

export type SurveyResultsQuestionExportRecord = Partial<
  Record<(typeof PUBLIC_SOURCE_FIELDS)[number], string | number>
> & {
  id: unknown;
  options: unknown[];
  prompt: unknown;
  tags: unknown[];
  type: unknown;
  voiceCredits?: unknown;
  scale?: RatingScale;
  singleSelect?: boolean;
  maxSelections?: number;
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
      ...(questionData.type === 'quadratic' ? { voiceCredits: questionData.voiceCredits ?? 99 } : {}),
      ...(questionData.type === 'rating' ? { scale: normalizeRatingScale(questionData) } : {}),
      ...(questionData.type === 'multichoice'
        ? {
            singleSelect: Boolean(
              questionData.singleSelect || questionData.oneSelectionOnly || questionData.singleChoice,
            ),
            ...(typeof questionData.maxSelections === 'number' &&
            Number.isSafeInteger(questionData.maxSelections) &&
            questionData.maxSelections > 0
              ? { maxSelections: questionData.maxSelections }
              : {}),
          }
        : {}),
      ...Object.fromEntries(
        PUBLIC_SOURCE_FIELDS.filter((key) => ['string', 'number'].includes(typeof questionData[key])).map((key) => [
          key,
          questionData[key],
        ]),
      ),
      tags: Array.isArray(questionData.tags) ? [...questionData.tags] : [],
      options: Array.isArray(questionData.options) ? [...questionData.options] : [],
    };
  });
};
