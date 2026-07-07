import { __test__contractScriptsSbtProgress } from './chainGateway.js';

describe('contractScripts SBT scan progress', () => {
  const { createSbtEventScanProgressState } = __test__contractScriptsSbtProgress;

  it('tracks activity scan progress within a single unified history pass', () => {
    const progressEvents = [];
    const activityProgress = createSbtEventScanProgressState({
      onProgress: (progress) => progressEvents.push(progress),
      phase: 'activity',
      fromBlock: 100,
      toBlock: 109,
      scanTotalBlocks: 10,
    });

    activityProgress.onProgress({
      phase: 'activity',
      fromBlock: 100,
      toBlock: 109,
      totalBlocks: 10,
      scannedBlocks: 4,
      remainingBlocks: 6,
      scanFrom: 100,
      scanTo: 103,
      lastScannedBlock: 103,
    });
    activityProgress.onProgress({
      phase: 'activity',
      fromBlock: 100,
      toBlock: 109,
      totalBlocks: 10,
      scannedBlocks: 10,
      remainingBlocks: 0,
      scanFrom: 100,
      scanTo: 109,
      lastScannedBlock: 109,
    });

    expect(progressEvents).toEqual([
      expect.objectContaining({
        phase: 'activity',
        totalBlocks: 10,
        scannedBlocks: 4,
        remainingBlocks: 6,
        completionRatio: 0.4,
      }),
      expect.objectContaining({
        phase: 'activity',
        totalBlocks: 10,
        scannedBlocks: 10,
        remainingBlocks: 0,
        completionRatio: 1,
      }),
    ]);
  });

  it('clamps reported scan progress to the phase total', () => {
    const progressEvents = [];
    const activityProgress = createSbtEventScanProgressState({
      onProgress: (progress) => progressEvents.push(progress),
      phase: 'activity',
      fromBlock: 500,
      toBlock: 509,
      scanTotalBlocks: 10,
      phaseTotalBlocks: 10,
      passOffsetBlocks: 0,
    });

    activityProgress.onProgress({
      phase: 'activity',
      fromBlock: 500,
      toBlock: 509,
      totalBlocks: 10,
      scannedBlocks: 50,
      remainingBlocks: 0,
      scanFrom: 500,
      scanTo: 509,
      lastScannedBlock: 509,
    });

    expect(progressEvents).toEqual([
      expect.objectContaining({
        phase: 'activity',
        totalBlocks: 10,
        scannedBlocks: 10,
        remainingBlocks: 0,
        completionRatio: 1,
      }),
    ]);
  });
});
