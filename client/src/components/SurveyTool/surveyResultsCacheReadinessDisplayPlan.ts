import {
  buildSurveyResultsFilterSummaryDisplayPlan,
  type SurveyResultsFilterSummaryDisplayPlan,
} from './surveyResultsFilterStatusController';
import {
  buildSurveyResultsQuestionListDisplayPlan,
  type SurveyResultsQuestionListDisplayPlan,
} from './surveyResultsQuestionSummaryStatusController';
import {
  buildSurveyResultsSyncStatusDisplayPlan,
  type SurveyResultsSyncStatusDisplayPlan,
} from './surveyResultsSyncStatusController';

export type SurveyResultsCacheReadinessDisplayPlanArgs = {
  aggregatorEntriesCount?: unknown;
  filteredQuestionsCount?: unknown;
  filteredResponsesCount?: unknown;
  filterLoading?: unknown;
  networkLatestBlock?: unknown;
  nowMs?: unknown;
  questionLocalBlock?: unknown;
  questionResultsHydrated?: unknown;
  refreshTargetQuestionBlock?: unknown;
  refreshTargetResponseBlock?: unknown;
  refreshTargetSurveyBlock?: unknown;
  responseLocalBlock?: unknown;
  surveyLocalBlock?: unknown;
  surveyResultsHydrated?: unknown;
  surveyViewMode?: unknown;
  syncLoadingStartedAt?: unknown;
  totalQuestionsCount?: unknown;
  totalResponsesCount?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsCacheReadinessMode = 'questions' | 'survey' | 'unknown';

export type SurveyResultsCacheReadinessDescriptor = {
  areSummaryCountsHydrated: boolean;
  filterLoading: boolean;
  mode: SurveyResultsCacheReadinessMode;
  summaryCountsSource: 'question-results' | 'survey-results';
};

export type SurveyResultsCacheReadinessDisplayPlan = {
  areSummaryCountsHydrated: boolean;
  filterSummaryDisplay: SurveyResultsFilterSummaryDisplayPlan;
  questionListDisplay: SurveyResultsQuestionListDisplayPlan;
  readinessDescriptor: SurveyResultsCacheReadinessDescriptor;
  syncStatusDisplay: SurveyResultsSyncStatusDisplayPlan;
};

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const buildSurveyResultsCacheReadinessDisplayPlan = ({
  aggregatorEntriesCount = 0,
  filteredQuestionsCount = null,
  filteredResponsesCount = 0,
  filterLoading = false,
  networkLatestBlock = 0,
  nowMs = 0,
  questionLocalBlock = 0,
  questionResultsHydrated = false,
  refreshTargetQuestionBlock = 0,
  refreshTargetResponseBlock = 0,
  refreshTargetSurveyBlock = 0,
  responseLocalBlock = 0,
  surveyLocalBlock = 0,
  surveyResultsHydrated = false,
  surveyViewMode = '',
  syncLoadingStartedAt = null,
  totalQuestionsCount = 0,
  totalResponsesCount = 0,
  viewMode = '',
}: SurveyResultsCacheReadinessDisplayPlanArgs = {}): SurveyResultsCacheReadinessDisplayPlan => {
  const normalizedViewMode = String(viewMode || '');
  const mode: SurveyResultsCacheReadinessMode =
    normalizedViewMode === 'questions' || normalizedViewMode === 'survey' ? normalizedViewMode : 'unknown';
  const summaryCountsSource = mode === 'survey' ? 'survey-results' : 'question-results';
  const areSummaryCountsHydrated =
    normalizedViewMode === 'survey' ? !!surveyResultsHydrated : !!questionResultsHydrated;
  const startedAt = toFiniteNumberOrNull(syncLoadingStartedAt);
  const currentTime = toFiniteNumberOrNull(nowMs);
  const showLongSyncNotice = startedAt !== null && currentTime !== null && currentTime - startedAt >= 15000;

  const questionListDisplay = buildSurveyResultsQuestionListDisplayPlan({
    aggregatorEntriesCount,
    filterLoading,
  });
  const filterSummaryDisplay = buildSurveyResultsFilterSummaryDisplayPlan({
    aggregatorEntriesCount,
    areSummaryCountsHydrated,
    filteredQuestionsCount,
    filteredResponsesCount,
    filterLoading,
    surveyViewMode,
    totalQuestionsCount,
    totalResponsesCount,
    viewMode: normalizedViewMode,
  });
  const syncStatusDisplay = buildSurveyResultsSyncStatusDisplayPlan({
    networkLatestBlock,
    questionLocalBlock,
    refreshTargetQuestionBlock,
    refreshTargetResponseBlock,
    refreshTargetSurveyBlock,
    responseLocalBlock,
    showLongSyncNotice,
    surveyLocalBlock,
    viewMode: normalizedViewMode,
  });

  return {
    areSummaryCountsHydrated,
    filterSummaryDisplay,
    questionListDisplay,
    readinessDescriptor: {
      areSummaryCountsHydrated,
      filterLoading: !!filterLoading,
      mode,
      summaryCountsSource,
    },
    syncStatusDisplay,
  };
};
