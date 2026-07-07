import { normalizeSurveyResultsBlockNumber } from './surveyResultsBlockNumbers.js';

export type SurveyResultsSyncStatusTrackPlan = {
  color: 'info' | 'success';
  label: string;
  progress: number;
  remainingBlocks: number;
  showRemainingSpinner: boolean;
  showSpinner: boolean;
};

export type SurveyResultsSyncStatusDisplayPlanArgs = {
  networkLatestBlock?: unknown;
  questionLocalBlock?: unknown;
  refreshTargetQuestionBlock?: unknown;
  refreshTargetResponseBlock?: unknown;
  refreshTargetSurveyBlock?: unknown;
  responseLocalBlock?: unknown;
  showLongSyncNotice?: unknown;
  surveyLocalBlock?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsSyncStatusDisplayPlan = {
  isSynced: boolean;
  isSyncingOrLoading: boolean;
  question: SurveyResultsSyncStatusTrackPlan;
  response: SurveyResultsSyncStatusTrackPlan;
  showLongSyncNotice: boolean;
  showQuickRefresh: boolean;
  syncStatusText: 'Loading...' | 'In Sync' | 'Syncing...';
  viewMode: string;
};

const buildLoadingTrack = (): SurveyResultsSyncStatusTrackPlan => ({
  color: 'info',
  label: '',
  progress: 0,
  remainingBlocks: 0,
  showRemainingSpinner: false,
  showSpinner: true,
});

const buildIdleTrack = (): SurveyResultsSyncStatusTrackPlan => ({
  color: 'info',
  label: '',
  progress: 0,
  remainingBlocks: 0,
  showRemainingSpinner: false,
  showSpinner: false,
});

const buildSyncStatusTrackPlan = ({
  localBlock,
  networkLatestBlock,
  refreshTargetBlock,
}: {
  localBlock: unknown;
  networkLatestBlock: unknown;
  refreshTargetBlock: unknown;
}): SurveyResultsSyncStatusTrackPlan => {
  const latestBlock = normalizeSurveyResultsBlockNumber(networkLatestBlock);
  const localBlockNumber = normalizeSurveyResultsBlockNumber(localBlock);
  const refreshTargetBlockNumber = normalizeSurveyResultsBlockNumber(refreshTargetBlock);
  const clampedLocalBlock = Math.min(localBlockNumber, latestBlock);
  const clampedRefreshTargetBlock = refreshTargetBlockNumber > 0 ? Math.min(refreshTargetBlockNumber, latestBlock) : 0;

  if (clampedLocalBlock === 0 || latestBlock === 0) {
    return buildLoadingTrack();
  }

  if (clampedRefreshTargetBlock > 0 && clampedLocalBlock >= clampedRefreshTargetBlock) {
    return {
      color: 'success',
      label: `In Sync (Current: ${clampedLocalBlock} / Latest: ${clampedRefreshTargetBlock})`,
      progress: 100,
      remainingBlocks: 0,
      showRemainingSpinner: false,
      showSpinner: false,
    };
  }

  const denominator = clampedRefreshTargetBlock > 0 ? clampedRefreshTargetBlock : latestBlock;

  if (clampedRefreshTargetBlock === 0) {
    if (clampedLocalBlock >= latestBlock) {
      return {
        color: 'success',
        label: `In Sync (Current: ${clampedLocalBlock} / Latest: ${latestBlock})`,
        progress: 100,
        remainingBlocks: 0,
        showRemainingSpinner: false,
        showSpinner: false,
      };
    }

    const remainingBlocks = latestBlock - clampedLocalBlock;
    return {
      color: 'info',
      label: `Remaining Blocks: ${remainingBlocks} (Current: ${clampedLocalBlock} / Latest: ${latestBlock})`,
      progress: Math.floor((clampedLocalBlock / latestBlock) * 100),
      remainingBlocks,
      showRemainingSpinner: false,
      showSpinner: false,
    };
  }

  const remainingBlocks = clampedRefreshTargetBlock - clampedLocalBlock;
  const progress = denominator ? Math.floor((clampedLocalBlock / denominator) * 100) : 0;
  return {
    color: progress < 100 ? 'info' : 'success',
    label: `Remaining Blocks: ${remainingBlocks}`,
    progress,
    remainingBlocks,
    showRemainingSpinner: true,
    showSpinner: false,
  };
};

export const buildSurveyResultsSyncStatusDisplayPlan = ({
  networkLatestBlock = 0,
  questionLocalBlock = 0,
  refreshTargetQuestionBlock = 0,
  refreshTargetResponseBlock = 0,
  refreshTargetSurveyBlock = 0,
  responseLocalBlock = 0,
  showLongSyncNotice = false,
  surveyLocalBlock = 0,
  viewMode = '',
}: SurveyResultsSyncStatusDisplayPlanArgs = {}): SurveyResultsSyncStatusDisplayPlan => {
  const normalizedViewMode = String(viewMode || '');
  const isQuestionView = normalizedViewMode === 'questions';
  const isSurveyView = normalizedViewMode === 'survey';
  const question = isQuestionView
    ? buildSyncStatusTrackPlan({
        localBlock: questionLocalBlock,
        networkLatestBlock,
        refreshTargetBlock: refreshTargetQuestionBlock,
      })
    : buildIdleTrack();
  const response = buildSyncStatusTrackPlan({
    localBlock: isSurveyView ? surveyLocalBlock : responseLocalBlock,
    networkLatestBlock,
    refreshTargetBlock: isSurveyView ? refreshTargetSurveyBlock : refreshTargetResponseBlock,
  });

  const isSynced = isQuestionView
    ? question.color === 'success' && response.color === 'success'
    : response.color === 'success';
  const isLoading = question.showSpinner || response.showSpinner;
  const isSyncingOrLoading = isLoading || !isSynced;
  const syncStatusText = isLoading ? 'Loading...' : isSynced ? 'In Sync' : 'Syncing...';

  return {
    isSynced,
    isSyncingOrLoading,
    question,
    response,
    showLongSyncNotice: !!showLongSyncNotice && isSyncingOrLoading,
    showQuickRefresh: !isSynced,
    syncStatusText,
    viewMode: normalizedViewMode,
  };
};
