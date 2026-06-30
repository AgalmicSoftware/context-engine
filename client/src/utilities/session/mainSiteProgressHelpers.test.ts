import {
  SBT_PROGRESS_FINAL_TAIL_BLOCKS,
  buildQuestionReadyStatePatch,
  mapSbtWorkProgressToBlock,
  mergeSbtLiveProgressEntry,
  shouldClearQuestionProgressInFinalize,
  shouldCommitThrottledProgress,
  shouldEnableSessionRegistryRefresh,
  shouldFlushCoalescedRun,
} from './mainSiteProgressHelpers.js';

describe('mainSiteProgressHelpers', () => {
  it('flushes coalesced runs only when dirty and thresholds are met', () => {
    expect(shouldFlushCoalescedRun({ dirty: false, force: true })).toBe(false);
    expect(shouldFlushCoalescedRun({ dirty: true, force: true })).toBe(true);
    expect(shouldFlushCoalescedRun({
      dirty: true,
      nowMs: 600,
      lastFlushMs: 100,
      minIntervalMs: 400,
    })).toBe(true);
    expect(shouldFlushCoalescedRun({
      dirty: true,
      nowMs: 200,
      lastFlushMs: 100,
      minIntervalMs: 400,
      pendingOps: 4,
      maxPendingOps: 3,
    })).toBe(true);
    expect(shouldFlushCoalescedRun({
      dirty: true,
      nowMs: 200,
      lastFlushMs: 100,
      minIntervalMs: 400,
      pendingOps: 1,
      maxPendingOps: 3,
    })).toBe(false);
  });

  it('commits throttled progress on force or interval expiry', () => {
    expect(shouldCommitThrottledProgress({ force: true })).toBe(true);
    expect(shouldCommitThrottledProgress({
      nowMs: 550,
      lastCommitMs: 100,
      minIntervalMs: 400,
    })).toBe(true);
    expect(shouldCommitThrottledProgress({
      nowMs: 250,
      lastCommitMs: 100,
      minIntervalMs: 400,
    })).toBe(false);
  });

  it('maps work progress into the visible block window while reserving the tail', () => {
    expect(mapSbtWorkProgressToBlock({
      baseFrom: 100,
      baseTo: 110,
      completedUnits: 0,
      totalUnits: 100,
    })).toBe(99);

    expect(mapSbtWorkProgressToBlock({
      baseFrom: 100,
      baseTo: 110,
      completedUnits: 50,
      totalUnits: 100,
      reserveTailBlocks: SBT_PROGRESS_FINAL_TAIL_BLOCKS,
    })).toBe(104);

    expect(mapSbtWorkProgressToBlock({
      baseFrom: 100,
      baseTo: 110,
      completedUnits: 100,
      totalUnits: 100,
      reserveTailBlocks: 2,
    })).toBe(108);
  });

  it('merges live progress while clamping current and latest blocks forward', () => {
    expect(mergeSbtLiveProgressEntry({
      prevEntry: { currentBlock: 20, latestBlock: 30, updatedAtMs: 10 },
      nextPatch: { currentBlock: 15, latestBlock: 25, phase: 'scan' },
      nowMs: 99,
    })).toEqual({
      currentBlock: 20,
      latestBlock: 30,
      updatedAtMs: 99,
      phase: 'scan',
    });
  });

  it('builds question-ready state patches with optional nonce increments', () => {
    expect(buildQuestionReadyStatePatch({
      prevState: { questionResponsesNonce: 3, questionScanProgress: { phase: 'scan' } },
      ready: false,
      incrementNonce: true,
    })).toEqual({
      isQuestionCacheReady: false,
      questionScanProgress: { phase: 'scan' },
      questionResponsesNonce: 4,
    });

    expect(buildQuestionReadyStatePatch({
      prevState: { questionResponsesNonce: 3, questionScanProgress: { phase: 'scan' } },
      ready: true,
      incrementNonce: false,
    })).toEqual({
      isQuestionCacheReady: true,
      questionScanProgress: null,
      questionResponsesNonce: 3,
    });
  });

  it('clears question progress only after finalize conditions are satisfied', () => {
    expect(shouldClearQuestionProgressInFinalize({
      hasPendingRerun: true,
      isQuestionCacheReady: true,
    })).toBe(false);
    expect(shouldClearQuestionProgressInFinalize({
      isQuestionCacheReady: false,
    })).toBe(false);
    expect(shouldClearQuestionProgressInFinalize({
      isQuestionCacheReady: true,
      questionScanProgress: { phase: 'error' },
    })).toBe(false);
    expect(shouldClearQuestionProgressInFinalize({
      isQuestionCacheReady: true,
      questionScanProgress: { phase: 'hydrate', discoveredQuestions: 5, hydratedQuestions: 4 },
    })).toBe(false);
    expect(shouldClearQuestionProgressInFinalize({
      isQuestionCacheReady: true,
      questionScanProgress: { phase: 'hydrate', discoveredQuestions: 5, hydratedQuestions: 5 },
    })).toBe(true);
  });

  it('always enables session registry refresh', () => {
    expect(shouldEnableSessionRegistryRefresh()).toBe(true);
  });
});
