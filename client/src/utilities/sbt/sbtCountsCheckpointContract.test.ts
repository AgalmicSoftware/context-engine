import { buildSbtCountsResumePlan } from './sbtCountsCheckpointContract.js';
import type { SbtCountsScanCheckpoint } from './sbtCountHelpers.js';

const checkpointAt = (blockNumber: number): SbtCountsScanCheckpoint => ({
  phase: 'activity',
  blockNumber,
  scanStartBlock: 10,
  scanToBlock: 20,
  mintedCountByAddress: {},
  burnedCountByAddress: {},
  mintedEventCount: 0,
  burnedEventCount: 0,
});

describe('sbtCountsCheckpointContract', () => {
  it('resumes a checkpoint inside the requested scan window', () => {
    expect(
      buildSbtCountsResumePlan({
        countsLoaded: false,
        resumeCheckpoint: checkpointAt(14),
        startBlock: 10,
        toBlock: 20,
      }),
    ).toEqual({
      canResumeFromCheckpoint: true,
      checkpointAlreadyCoversWindow: false,
      initialProgressSeedBlock: 14,
    });
  });

  it('treats a covering checkpoint as complete rather than resumable', () => {
    expect(
      buildSbtCountsResumePlan({
        countsLoaded: false,
        resumeCheckpoint: checkpointAt(20),
        startBlock: 10,
        toBlock: 20,
      }),
    ).toEqual({
      canResumeFromCheckpoint: false,
      checkpointAlreadyCoversWindow: true,
      initialProgressSeedBlock: 20,
    });
  });

  it('rejects stale checkpoints below the scan floor', () => {
    expect(
      buildSbtCountsResumePlan({
        countsLoaded: false,
        resumeCheckpoint: checkpointAt(8),
        startBlock: 10,
        toBlock: 20,
      }),
    ).toEqual({
      canResumeFromCheckpoint: false,
      checkpointAlreadyCoversWindow: false,
      initialProgressSeedBlock: 8,
    });
  });

  it('prefers the finalized block when counts are already loaded', () => {
    expect(
      buildSbtCountsResumePlan({
        countsLoaded: true,
        existingBlock: 17,
        resumeCheckpoint: checkpointAt(12),
        startBlock: 10,
        toBlock: 20,
      }),
    ).toEqual({
      canResumeFromCheckpoint: false,
      checkpointAlreadyCoversWindow: false,
      initialProgressSeedBlock: 17,
    });
  });
});
