import type { SurveyResultsCacheReadinessDisplayPlanArgs } from './surveyResultsCacheReadinessDisplayPlan';

type SurveyResultsRecord = Record<string, unknown>;
export type SurveyResultsCacheFilterState = SurveyResultsRecord & {
  sbtFilter?: unknown;
};

export type SurveyResultsCacheFilterInput = {
  activeSessionSlug: string;
  currentSurveyIdForUrl: string | null;
  currentViewModeForUrl: string;
  filterLoading: boolean;
  filterState: SurveyResultsCacheFilterState;
  isQuestionCacheReady: boolean;
  isSBTCacheReady: boolean;
  questionResponsesNonce: unknown;
  questionsCacheNonce: unknown;
  sbtCacheRevision: unknown;
  showQuestionFilter: boolean;
  storageKeyPrefix: string;
};

export type SurveyResultsCacheControllerSnapshotArgs = {
  activeSessionSlug?: unknown;
  aggregatorEntriesCount?: unknown;
  currentSurveyId?: unknown;
  currentSurveyIdForUrl?: string | null;
  currentViewModeForUrl?: string;
  filterLoading?: unknown;
  filterState?: SurveyResultsCacheFilterState;
  filteredQuestionsCount?: unknown;
  filteredResponsesCount?: unknown;
  hasRefreshQuestionMetadata?: unknown;
  hasRefreshQuestionResponses?: unknown;
  hasRefreshSurveyResponsesByID?: unknown;
  isQuestionCacheReady?: boolean;
  isSBTCacheReady?: boolean;
  networkLatestBlock?: unknown;
  nowMs?: unknown;
  questionLocalBlock?: unknown;
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  questionResultsHydrated?: unknown;
  refreshTargetQuestionBlock?: unknown;
  refreshTargetResponseBlock?: unknown;
  refreshTargetSurveyBlock?: unknown;
  responseLocalBlock?: unknown;
  sbtCacheRevision?: unknown;
  showQuestionFilter?: unknown;
  storageKeyPrefix?: unknown;
  surveyLocalBlock?: unknown;
  surveyResultsHydrated?: unknown;
  surveyViewMode?: unknown;
  syncLoadingStartedAt?: unknown;
  totalQuestionsCount?: unknown;
  totalResponsesCount?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsCacheControllerSnapshot = {
  cacheReadinessInput: SurveyResultsCacheReadinessDisplayPlanArgs;
  filterInput: SurveyResultsCacheFilterInput;
  manualRefreshInput: {
    canDispatch: boolean;
    canRefreshQuestions: boolean;
    canRefreshSurvey: boolean;
    status: 'inert' | 'questions' | 'survey';
    surveyId: string;
    viewMode: string;
  };
  pollingInput: {
    networkLatestBlock: unknown;
    questionLocalBlock: unknown;
    refreshTargetQuestionBlock: unknown;
    refreshTargetResponseBlock: unknown;
    refreshTargetSurveyBlock: unknown;
    responseLocalBlock: unknown;
    surveyLocalBlock: unknown;
  };
  selectedIdentityInput: {
    activeSessionSlug: string;
    currentSurveyId: string;
    currentSurveyIdForUrl: unknown;
    currentViewModeForUrl: unknown;
    viewMode: string;
  };
  selectedResultInput: {
    activeSessionSlug: string;
    currentSurveyId: string;
    questionResponsesNonce: unknown;
    questionsCacheNonce: unknown;
    sbtCacheRevision: unknown;
  };
};

export const buildSurveyResultsCacheControllerSnapshot = ({
  activeSessionSlug = '',
  aggregatorEntriesCount = 0,
  currentSurveyId = '',
  currentSurveyIdForUrl = null,
  currentViewModeForUrl = '',
  filterLoading = false,
  filterState = {},
  filteredQuestionsCount = null,
  filteredResponsesCount = 0,
  hasRefreshQuestionMetadata = false,
  hasRefreshQuestionResponses = false,
  hasRefreshSurveyResponsesByID = false,
  isQuestionCacheReady = false,
  isSBTCacheReady = false,
  networkLatestBlock = 0,
  nowMs = 0,
  questionLocalBlock = 0,
  questionResponsesNonce = undefined,
  questionsCacheNonce = undefined,
  questionResultsHydrated = false,
  refreshTargetQuestionBlock = 0,
  refreshTargetResponseBlock = 0,
  refreshTargetSurveyBlock = 0,
  responseLocalBlock = 0,
  sbtCacheRevision = undefined,
  showQuestionFilter = false,
  storageKeyPrefix = '',
  surveyLocalBlock = 0,
  surveyResultsHydrated = false,
  surveyViewMode = '',
  syncLoadingStartedAt = null,
  totalQuestionsCount = 0,
  totalResponsesCount = 0,
  viewMode = '',
}: SurveyResultsCacheControllerSnapshotArgs = {}): SurveyResultsCacheControllerSnapshot => {
  const normalizedActiveSessionSlug = String(activeSessionSlug || '');
  const normalizedCurrentSurveyId = String(currentSurveyId || '');
  const normalizedViewMode = String(viewMode || '');
  const canRefreshQuestions =
    normalizedViewMode === 'questions' && (!!hasRefreshQuestionMetadata || !!hasRefreshQuestionResponses);
  const canRefreshSurvey =
    normalizedViewMode === 'survey' && !!normalizedCurrentSurveyId && !!hasRefreshSurveyResponsesByID;
  const manualRefreshStatus = canRefreshQuestions ? 'questions' : canRefreshSurvey ? 'survey' : 'inert';
  const pollingInput = {
    networkLatestBlock,
    questionLocalBlock,
    refreshTargetQuestionBlock,
    refreshTargetResponseBlock,
    refreshTargetSurveyBlock,
    responseLocalBlock,
    surveyLocalBlock,
  };

  return {
    cacheReadinessInput: {
      aggregatorEntriesCount,
      filteredQuestionsCount,
      filteredResponsesCount,
      filterLoading,
      networkLatestBlock,
      nowMs,
      questionLocalBlock,
      questionResultsHydrated,
      refreshTargetQuestionBlock,
      refreshTargetResponseBlock,
      refreshTargetSurveyBlock,
      responseLocalBlock,
      surveyLocalBlock,
      surveyResultsHydrated,
      surveyViewMode,
      syncLoadingStartedAt,
      totalQuestionsCount,
      totalResponsesCount,
      viewMode: normalizedViewMode,
    },
    filterInput: {
      activeSessionSlug: normalizedActiveSessionSlug,
      currentSurveyIdForUrl,
      currentViewModeForUrl,
      filterLoading: !!filterLoading,
      filterState,
      isQuestionCacheReady,
      isSBTCacheReady,
      questionResponsesNonce,
      questionsCacheNonce,
      sbtCacheRevision,
      showQuestionFilter: !!showQuestionFilter,
      storageKeyPrefix: String(storageKeyPrefix || ''),
    },
    manualRefreshInput: {
      canDispatch: canRefreshQuestions || canRefreshSurvey,
      canRefreshQuestions,
      canRefreshSurvey,
      status: manualRefreshStatus,
      surveyId: normalizedCurrentSurveyId,
      viewMode: normalizedViewMode,
    },
    pollingInput,
    selectedIdentityInput: {
      activeSessionSlug: normalizedActiveSessionSlug,
      currentSurveyId: normalizedCurrentSurveyId,
      currentSurveyIdForUrl,
      currentViewModeForUrl,
      viewMode: normalizedViewMode,
    },
    selectedResultInput: {
      activeSessionSlug: normalizedActiveSessionSlug,
      currentSurveyId: normalizedCurrentSurveyId,
      questionResponsesNonce,
      questionsCacheNonce,
      sbtCacheRevision,
    },
  };
};
