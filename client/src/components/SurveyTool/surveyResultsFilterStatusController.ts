export type SurveyResultsFilterSummaryDisplayPlanArgs = {
  aggregatorEntriesCount?: unknown;
  areSummaryCountsHydrated?: unknown;
  filteredQuestionsCount?: unknown;
  filteredResponsesCount?: unknown;
  filterLoading?: unknown;
  surveyViewMode?: unknown;
  totalQuestionsCount?: unknown;
  totalResponsesCount?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsFilterSummaryDisplayPlan = {
  displayedTotalQuestionsCount: number;
  displayedTotalResponsesCount: number;
  normalizedFilteredQuestionsCount: number;
  normalizedFilteredResponsesCount: number;
  showFilteredCountSpinner: boolean;
};

export type SurveyResultsStatusMessagesDisplayPlanArgs = {
  alertMessage?: unknown;
  filterLoading?: unknown;
};

export type SurveyResultsStatusMessagesDisplayPlan = {
  alertMessage: unknown;
  showAlert: boolean;
  showFilterLoading: boolean;
};

const toNonNegativeNumber = (value: unknown): number => Math.max(0, Number(value) || 0);

const clampCount = (value: unknown, max: number): number => Math.min(max, toNonNegativeNumber(value));

export const buildSurveyResultsStatusMessagesDisplayPlan = ({
  alertMessage = '',
  filterLoading = false,
}: SurveyResultsStatusMessagesDisplayPlanArgs = {}): SurveyResultsStatusMessagesDisplayPlan => {
  const showFilterLoading = !!filterLoading;
  const normalizedAlertMessage = alertMessage ?? '';
  return {
    alertMessage: normalizedAlertMessage,
    showAlert: !!normalizedAlertMessage && !showFilterLoading,
    showFilterLoading,
  };
};

export const buildSurveyResultsFilterSummaryDisplayPlan = ({
  aggregatorEntriesCount = 0,
  areSummaryCountsHydrated = false,
  filteredQuestionsCount = null,
  filteredResponsesCount = 0,
  filterLoading = false,
  surveyViewMode = '',
  totalQuestionsCount = 0,
  totalResponsesCount = 0,
  viewMode = '',
}: SurveyResultsFilterSummaryDisplayPlanArgs = {}): SurveyResultsFilterSummaryDisplayPlan => {
  const displayedTotalQuestionsCount = toNonNegativeNumber(totalQuestionsCount);
  const displayedTotalResponsesCount = toNonNegativeNumber(totalResponsesCount);
  const normalizedAggregatorEntriesCount = toNonNegativeNumber(aggregatorEntriesCount);
  const normalizedViewMode = String(viewMode || '')
    .trim()
    .toLowerCase();
  const normalizedSurveyViewMode = String(surveyViewMode || '')
    .trim()
    .toLowerCase();

  let displayedFilteredQuestionsCount: unknown;
  if (normalizedViewMode === 'survey') {
    if (normalizedSurveyViewMode === 'aggregate') {
      displayedFilteredQuestionsCount = normalizedAggregatorEntriesCount || displayedTotalQuestionsCount;
    } else {
      displayedFilteredQuestionsCount = displayedTotalQuestionsCount;
    }
  } else {
    displayedFilteredQuestionsCount =
      filteredQuestionsCount !== null && filteredQuestionsCount !== undefined
        ? filteredQuestionsCount
        : normalizedAggregatorEntriesCount;
  }

  return {
    displayedTotalQuestionsCount,
    displayedTotalResponsesCount,
    normalizedFilteredQuestionsCount: clampCount(displayedFilteredQuestionsCount, displayedTotalQuestionsCount),
    normalizedFilteredResponsesCount: clampCount(filteredResponsesCount, displayedTotalResponsesCount),
    showFilteredCountSpinner: !!filterLoading || !areSummaryCountsHydrated,
  };
};
