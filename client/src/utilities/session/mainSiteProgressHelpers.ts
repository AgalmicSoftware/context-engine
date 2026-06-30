/**
 * @module utilities/session/mainSiteProgressHelpers
 */

export const SBT_PROGRESS_MIN_INTERVAL_MS = 250;
export const SBT_PROGRESS_FINAL_TAIL_BLOCKS = 1;
export const SBT_LIGHT_DISCOVERY_SCAN_UNITS = 7000;
export const SBT_LIGHT_DISCOVERY_HYDRATION_UNITS = 3000;
export const SBT_FULL_SCAN_DISCOVERY_UNITS = 2500;
export const SBT_FULL_SCAN_PROCESS_UNITS = 7500;

type CoalescedRunArgs = {
  force?: boolean;
  dirty?: boolean;
  nowMs?: number;
  lastFlushMs?: number;
  minIntervalMs?: number;
  pendingOps?: number;
  maxPendingOps?: number;
};

type ThrottledProgressArgs = {
  force?: boolean;
  nowMs?: number;
  lastCommitMs?: number;
  minIntervalMs?: number;
};

type WorkProgressArgs = {
  baseFrom?: number;
  baseTo?: number;
  completedUnits?: number;
  totalUnits?: number;
  reserveTailBlocks?: number;
};

type SbtLiveProgressEntry = {
  currentBlock?: number;
  latestBlock?: number;
  updatedAtMs?: number;
  [key: string]: unknown;
};

type MergeSbtLiveProgressArgs = {
  prevEntry?: SbtLiveProgressEntry | null;
  nextPatch?: SbtLiveProgressEntry | null;
  nowMs?: number;
};

type QuestionReadyPrevState = {
  questionResponsesNonce?: number;
  questionScanProgress?: QuestionScanProgressLike | null;
  [key: string]: unknown;
};

type BuildQuestionReadyArgs = {
  prevState?: QuestionReadyPrevState;
  ready?: boolean;
  incrementNonce?: boolean;
};

export type QuestionScanProgressLike = {
  phase?: string;
  pendingMetadataCount?: number;
  discoveredQuestions?: number;
  hydratedQuestions?: number;
  [key: string]: unknown;
};

type FinalizeQuestionProgressArgs = {
  hasPendingRerun?: boolean;
  isQuestionCacheReady?: boolean;
  questionScanProgress?: QuestionScanProgressLike | null;
};

export const shouldFlushCoalescedRun = ({
  force = false,
  dirty = false,
  nowMs = Date.now(),
  lastFlushMs = 0,
  minIntervalMs = 0,
  pendingOps = 0,
  maxPendingOps = 1,
}: CoalescedRunArgs = {}) => {
  if (!dirty) return false;
  if (force) return true;
  const elapsedMs = Number(nowMs || 0) - Number(lastFlushMs || 0);
  const byInterval = elapsedMs >= Math.max(0, Number(minIntervalMs || 0));
  const byCount = Number(pendingOps || 0) >= Math.max(1, Number(maxPendingOps || 1));
  return byInterval || byCount;
};

export const shouldCommitThrottledProgress = ({
  force = false,
  nowMs = Date.now(),
  lastCommitMs = 0,
  minIntervalMs = 0,
}: ThrottledProgressArgs = {}) => {
  if (force) return true;
  return (Number(nowMs || 0) - Number(lastCommitMs || 0)) >= Math.max(0, Number(minIntervalMs || 0));
};

export const mapSbtWorkProgressToBlock = ({
  baseFrom = 0,
  baseTo = 0,
  completedUnits = 0,
  totalUnits = 0,
  reserveTailBlocks = SBT_PROGRESS_FINAL_TAIL_BLOCKS,
}: WorkProgressArgs = {}) => {
  const fromBlock = Math.max(0, Math.floor(Number(baseFrom) || 0));
  const toBlock = Math.max(fromBlock, Math.floor(Number(baseTo) || 0));
  const totalBlocks = Math.max(1, toBlock - fromBlock + 1);
  const safeTotalUnits = Math.max(0, Number(totalUnits || 0));
  const safeCompletedUnits = Math.max(0, Math.min(safeTotalUnits, Number(completedUnits || 0)));
  const safeReserveTail = Math.max(
    0,
    Math.min(totalBlocks - 1, Math.floor(Number(reserveTailBlocks || 0)))
  );
  const visibleProgressSpan = Math.max(0, totalBlocks - safeReserveTail);
  const ratio = safeTotalUnits > 0 ? (safeCompletedUnits / safeTotalUnits) : 0;
  const advancedBlocks = Math.min(
    visibleProgressSpan,
    Math.max(0, Math.floor(ratio * visibleProgressSpan))
  );
  return Math.max(
    0,
    Math.min(toBlock - safeReserveTail, (fromBlock - 1) + advancedBlocks)
  );
};

export const mergeSbtLiveProgressEntry = ({
  prevEntry = null,
  nextPatch = null,
  nowMs = Date.now(),
}: MergeSbtLiveProgressArgs = {}) => {
  const prev: SbtLiveProgressEntry = (prevEntry && typeof prevEntry === 'object') ? prevEntry : {};
  const patch: SbtLiveProgressEntry = (nextPatch && typeof nextPatch === 'object') ? nextPatch : {};
  const rawCurrentBlock = Number(
    patch.currentBlock != null ? patch.currentBlock : prev.currentBlock
  );
  const rawLatestBlock = Number(
    patch.latestBlock != null ? patch.latestBlock : prev.latestBlock
  );
  const currentBlock = Math.max(
    Math.floor(Number(prev.currentBlock || 0)),
    Number.isFinite(rawCurrentBlock) ? Math.floor(rawCurrentBlock) : 0
  );
  const latestBlock = Math.max(
    currentBlock,
    Math.floor(Number(prev.latestBlock || 0)),
    Number.isFinite(rawLatestBlock) ? Math.floor(rawLatestBlock) : 0
  );
  return {
    ...prev,
    ...patch,
    currentBlock,
    latestBlock,
    updatedAtMs: Math.max(0, Math.floor(Number(patch.updatedAtMs || nowMs) || 0)),
  };
};

export const buildQuestionReadyStatePatch = ({
  prevState = {},
  ready = false,
  incrementNonce = false,
}: BuildQuestionReadyArgs = {}) => {
  const prev: QuestionReadyPrevState = (prevState && typeof prevState === 'object') ? prevState : {};
  const nextNonce = Number(prev.questionResponsesNonce || 0) + (incrementNonce ? 1 : 0);
  return {
    isQuestionCacheReady: !!ready,
    // Keep progress visible while cache is still not ready.
    questionScanProgress: ready ? null : (prev.questionScanProgress || null),
    questionResponsesNonce: nextNonce,
  };
};

export const shouldClearQuestionProgressInFinalize = ({
  hasPendingRerun = false,
  isQuestionCacheReady = false,
  questionScanProgress = null,
}: FinalizeQuestionProgressArgs = {}) => {
  if (hasPendingRerun || !isQuestionCacheReady) return false;
  const phase = String(questionScanProgress?.phase || '').toLowerCase();
  if (phase === 'error') return false;
  const pendingMetadataCount = Math.max(0, Number(questionScanProgress?.pendingMetadataCount || 0));
  if (pendingMetadataCount > 0) return false;
  const discoveredQuestions = Math.max(0, Number(questionScanProgress?.discoveredQuestions || 0));
  const hydratedQuestions = Math.max(0, Number(questionScanProgress?.hydratedQuestions || 0));
  if (phase === 'hydrate' && hydratedQuestions < discoveredQuestions) return false;
  return true;
};

export const shouldEnableSessionRegistryRefresh = () => true;
