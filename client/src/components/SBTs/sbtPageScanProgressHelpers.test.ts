import {
  buildSbtPageEffectiveHolderScanProgress,
  buildSbtPageParentSessionScanProgress,
  formatSbtPageBlockCount,
  hasUsableSbtPageScanProgress,
  isActiveSbtPageScanProgress,
  resolveSbtPageHolderScanActive,
  resolveSbtPageRemainingBlocksCount,
  resolveSbtPageScanProgressDisplay,
  resolveSbtPageScanProgressFillStyle,
  resolveSbtPageScanProgressPercent,
  shouldShowSbtPageScanProgress,
} from './sbtPageScanProgressHelpers';

describe('sbtPageScanProgressHelpers', () => {
  it('classifies usable and active scan progress', () => {
    expect(hasUsableSbtPageScanProgress(null)).toBe(false);
    expect(hasUsableSbtPageScanProgress({ totalBlocks: 10 })).toBe(true);
    expect(hasUsableSbtPageScanProgress({ currentBlock: 5, latestBlock: 5 })).toBe(true);
    expect(hasUsableSbtPageScanProgress({ remainingBlocks: 0 })).toBe(true);
    expect(isActiveSbtPageScanProgress({ remainingBlocks: 2 })).toBe(true);
    expect(isActiveSbtPageScanProgress({ remainingBlocks: 0 })).toBe(false);
    expect(isActiveSbtPageScanProgress({ totalBlocks: 10, scannedBlocks: 9 })).toBe(true);
    expect(isActiveSbtPageScanProgress({ totalBlocks: 10, scannedBlocks: 10 })).toBe(false);
    expect(resolveSbtPageHolderScanActive()).toBe(false);
    expect(resolveSbtPageHolderScanActive({ hasActiveScanProgress: true })).toBe(true);
  });

  it('formats progress counts, percentages, and display copy', () => {
    expect(formatSbtPageBlockCount(12345.6)).toBe('12,345.6');
    expect(formatSbtPageBlockCount('bad')).toBe('-');
    expect(resolveSbtPageRemainingBlocksCount({ remainingBlocks: 12.5 })).toBe(12.5);
    expect(resolveSbtPageRemainingBlocksCount({ totalBlocks: 20, scannedBlocks: 7 })).toBe(13);
    expect(shouldShowSbtPageScanProgress({
      effectiveLoading: false,
      hasActiveScanProgress: true,
      rawRemainingBlocksCount: 2,
    })).toBe(true);
    expect(resolveSbtPageScanProgressPercent({
      progress: { totalBlocks: 10, scannedBlocks: 4 },
      showScanProgress: true,
    })).toBe(40);
    expect(resolveSbtPageScanProgressFillStyle({ percent: 25 })).toEqual({
      width: '25%',
    });
    expect(resolveSbtPageScanProgressDisplay({
      phaseLabel: 'Loading holders',
      rawRemainingBlocksCount: 1200,
      sessionLabel: ' Alpha ',
      showScanProgress: true,
    })).toEqual({
      remainingBlocksCount: 1200,
      scanProgressSessionText: 'Session: Alpha',
      scanProgressText: 'Loading holders: 1,200 blocks remaining',
    });
    expect(resolveSbtPageScanProgressDisplay({ showScanProgress: false })).toEqual({
      remainingBlocksCount: 0,
      scanProgressSessionText: null,
      scanProgressText: null,
    });
  });

  it('builds parent and effective holder scan progress records', () => {
    expect(buildSbtPageParentSessionScanProgress({
      progress: { currentBlock: 15, latestBlock: 20, phase: 'holders' },
      sessionConfig: { blockLimits: { start: 11 } },
      sessionLabel: 'Alpha',
      sessionSlug: 'alpha',
    })).toEqual({
      currentBlock: 15,
      latestBlock: 20,
      phase: 'holders',
      source: 'session',
      fromBlock: 11,
      toBlock: 20,
      totalBlocks: 10,
      scannedBlocks: 5,
      remainingBlocks: 5,
      sessionSlug: 'alpha',
      sessionLabel: 'Alpha',
    });
    expect(buildSbtPageParentSessionScanProgress({ progress: null })).toBeNull();
    expect(buildSbtPageEffectiveHolderScanProgress({
      getSessionLabel: () => 'Local Session',
      getSessionSlug: () => 'local',
      localProgress: { totalBlocks: 3, scannedBlocks: 1 },
    })).toMatchObject({
      sessionSlug: 'local',
      sessionLabel: 'Local Session',
      totalBlocks: 3,
    });
    expect(buildSbtPageEffectiveHolderScanProgress({
      getParentProgress: () => ({ currentBlock: 1, latestBlock: 2 }),
      localProgress: null,
    })).toEqual({ currentBlock: 1, latestBlock: 2 });
  });
});
