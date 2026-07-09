import { normalizeSurveyResultsBlockNumber } from './surveyResultsBlockNumbers.js';

export type SurveyResultsSyncStateLike = {
  networkLatestBlock?: unknown;
  questionLocalBlock?: unknown;
  refreshTargetQuestionBlock?: unknown;
  refreshTargetResponseBlock?: unknown;
  refreshTargetSurveyBlock?: unknown;
  responseLocalBlock?: unknown;
  surveyLocalBlock?: unknown;
  viewMode?: unknown;
};

export const isSurveyResultsSourceSynced = (
  localBlockValue: unknown,
  refreshTargetBlockValue: unknown,
  networkLatestBlockValue: unknown,
): boolean => {
  const localBlock = normalizeSurveyResultsBlockNumber(localBlockValue);
  const refreshTargetBlock = normalizeSurveyResultsBlockNumber(refreshTargetBlockValue);
  const networkLatestBlock = normalizeSurveyResultsBlockNumber(networkLatestBlockValue);
  if (localBlock === 0 || networkLatestBlock === 0) return false;
  const clampedLocalBlock = Math.min(localBlock, networkLatestBlock);
  const clampedTargetBlock = refreshTargetBlock > 0 ? Math.min(refreshTargetBlock, networkLatestBlock) : 0;
  return clampedTargetBlock > 0 ? clampedLocalBlock >= clampedTargetBlock : clampedLocalBlock >= networkLatestBlock;
};

export const isSurveyResultsStateSynced = (stateSnapshot: SurveyResultsSyncStateLike = {}): boolean => {
  if (stateSnapshot?.viewMode === 'questions') {
    return (
      isSurveyResultsSourceSynced(
        stateSnapshot.questionLocalBlock,
        stateSnapshot.refreshTargetQuestionBlock,
        stateSnapshot.networkLatestBlock,
      ) &&
      isSurveyResultsSourceSynced(
        stateSnapshot.responseLocalBlock,
        stateSnapshot.refreshTargetResponseBlock,
        stateSnapshot.networkLatestBlock,
      )
    );
  }

  return isSurveyResultsSourceSynced(
    stateSnapshot?.surveyLocalBlock,
    stateSnapshot?.refreshTargetSurveyBlock,
    stateSnapshot?.networkLatestBlock,
  );
};
