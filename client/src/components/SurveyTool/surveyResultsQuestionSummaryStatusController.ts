export type SurveyResultsQuestionSummaryDisplayPlanArgs = {
  question?: unknown;
  questionId?: unknown;
};

export type SurveyResultsQuestionSummaryDisplayPlan = {
  metadataMissing: boolean;
  questionPrompt: unknown;
};

export type SurveyResultsQuestionSummariesListDisplayPlanArgs = {
  emptyMessage?: unknown;
  entries?: unknown;
  errorMessage?: unknown;
  filterLoading?: unknown;
};

export type SurveyResultsQuestionListDisplayPlanArgs = {
  aggregatorEntriesCount?: unknown;
  filterLoading?: unknown;
};

export type SurveyResultsAggregatorEntry = [string, unknown];

export type SurveyResultsQuestionSummariesListDisplayPlan = {
  emptyMessage: string;
  entries: SurveyResultsAggregatorEntry[];
  errorMessage: unknown;
  isInert: boolean;
  showEmptyState: boolean;
  showError: boolean;
  showSummaries: boolean;
};

export type SurveyResultsQuestionListDisplayPlan = {
  isInert: boolean;
  shouldRenderQuestionTable: boolean;
  showEmptyState: boolean;
};

export const buildSurveyResultsQuestionSummaryDisplayPlan = ({
  question = null,
  questionId = '',
}: SurveyResultsQuestionSummaryDisplayPlanArgs = {}): SurveyResultsQuestionSummaryDisplayPlan => {
  const questionRecord = question && typeof question === 'object' ? (question as { prompt?: unknown }) : null;
  const questionIdText = String(questionId || '');
  return {
    metadataMissing: !questionRecord,
    questionPrompt: questionRecord?.prompt || `Unknown question: ${questionIdText}`,
  };
};

export const getSurveyResultsQuestionCardDomId = (questionId: string = ''): string =>
  `questionCard-${questionId.toLowerCase()}`;

export const buildSurveyResultsQuestionSummariesListDisplayPlan = ({
  emptyMessage = 'No results yet.',
  entries = [],
  errorMessage = '',
  filterLoading = false,
}: SurveyResultsQuestionSummariesListDisplayPlanArgs = {}): SurveyResultsQuestionSummariesListDisplayPlan => {
  const normalizedEntries = Array.isArray(entries) ? (entries as SurveyResultsAggregatorEntry[]) : [];
  const loading = !!filterLoading;
  const normalizedErrorMessage = errorMessage ?? '';
  const showError = !!normalizedErrorMessage && !loading;
  const showSummaries = normalizedEntries.length > 0;
  const showEmptyState = !showError && !showSummaries && !loading;

  return {
    emptyMessage: String(emptyMessage || 'No results yet.'),
    entries: normalizedEntries,
    errorMessage: normalizedErrorMessage,
    isInert: loading || showError || !showSummaries,
    showEmptyState,
    showError,
    showSummaries,
  };
};

export const buildSurveyResultsQuestionListDisplayPlan = ({
  aggregatorEntriesCount = 0,
  filterLoading = false,
}: SurveyResultsQuestionListDisplayPlanArgs = {}): SurveyResultsQuestionListDisplayPlan => {
  const hasQuestionRows = Math.max(0, Number(aggregatorEntriesCount) || 0) > 0;
  const loading = !!filterLoading;
  return {
    isInert: loading || !hasQuestionRows,
    shouldRenderQuestionTable: hasQuestionRows || loading,
    showEmptyState: !hasQuestionRows && !loading,
  };
};
