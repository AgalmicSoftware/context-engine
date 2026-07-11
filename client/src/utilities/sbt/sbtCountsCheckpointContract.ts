import type { SbtCountsScanCheckpoint } from './sbtCountHelpers.js';

export { normalizeSbtCountsScanCheckpoint } from './sbtCountHelpers.js';

export interface SbtCountsResumePlanInput {
  countsLoaded?: boolean;
  existingBlock?: unknown;
  resumeCheckpoint?: SbtCountsScanCheckpoint | null;
  startBlock: unknown;
  toBlock: unknown;
}

export interface SbtCountsResumePlan {
  canResumeFromCheckpoint: boolean;
  checkpointAlreadyCoversWindow: boolean;
  initialProgressSeedBlock: number;
}

export const buildSbtCountsResumePlan = ({
  countsLoaded = false,
  existingBlock,
  resumeCheckpoint = null,
  startBlock,
  toBlock,
}: SbtCountsResumePlanInput): SbtCountsResumePlan => {
  const scanStartBlock = Number(startBlock);
  const scanToBlock = Number(toBlock);
  const checkpointBlock = Number(resumeCheckpoint?.blockNumber);
  const hasCheckpointBlock = Number.isFinite(checkpointBlock);
  const checkpointAlreadyCoversWindow =
    !countsLoaded && resumeCheckpoint?.phase === 'activity' && hasCheckpointBlock && checkpointBlock >= scanToBlock;
  const canResumeFromCheckpoint =
    !countsLoaded && hasCheckpointBlock && checkpointBlock >= scanStartBlock - 1 && checkpointBlock < scanToBlock;
  const initialProgressSeedBlock =
    countsLoaded && Number.isFinite(Number(existingBlock))
      ? Number(existingBlock)
      : hasCheckpointBlock
        ? checkpointBlock
        : scanStartBlock - 1;

  return {
    canResumeFromCheckpoint,
    checkpointAlreadyCoversWindow,
    initialProgressSeedBlock,
  };
};
