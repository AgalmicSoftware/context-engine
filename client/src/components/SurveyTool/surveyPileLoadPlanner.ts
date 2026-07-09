export type PileQuestionProgressLike =
  | {
      phase?: unknown;
      totalBlocks?: unknown;
      remainingBlocks?: unknown;
      discoveredQuestions?: unknown;
      hydratedQuestions?: unknown;
    }
  | null
  | undefined;

export type PileLoadProgressState = {
  scanTotalBlocks: number;
  scanRemainingBlocks: number;
  hydrateDiscovered: number;
  hydrateDone: number;
  hasScanOrHydrationWork: boolean;
  hydrationProgressSettled: boolean;
  canSettleUnreadyEmpty: boolean;
};

export type PileEmptyProbePlan = {
  action: 'continue-loading-immediately' | 'probe-loading' | 'settle-empty';
  nextProbeStartedAtMs: number;
  nextProbeDelayMs: number;
  progressIndicatesDefinitiveEmpty: boolean;
};

export const buildPileLoadFailureState = ({
  isQuestionCacheReady = false,
  recentRateLimit = false,
}: {
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
} = {}) => ({
  loading: !isQuestionCacheReady || !!recentRateLimit,
});

export const buildPileLoadProgressState = ({
  scopedProgress = null,
  cacheHasLoaded = true,
  isQuestionCacheReady = false,
  recentRateLimit = false,
}: {
  scopedProgress?: PileQuestionProgressLike;
  cacheHasLoaded?: boolean | null;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
} = {}): PileLoadProgressState => {
  const scanTotalBlocks = Math.max(0, Number(scopedProgress?.totalBlocks || 0));
  const scanRemainingBlocks = Math.max(0, Number(scopedProgress?.remainingBlocks || 0));
  const hydrateDiscovered = Math.max(0, Number(scopedProgress?.discoveredQuestions || 0));
  const hydrateDone = Math.max(0, Number(scopedProgress?.hydratedQuestions || 0));
  const phase = String(scopedProgress?.phase || '').toLowerCase();

  const hasScanOrHydrationWork =
    !!scopedProgress &&
    ((phase === 'scan' && scanRemainingBlocks > 0) || (phase === 'hydrate' && hydrateDone < hydrateDiscovered));
  const hydrationProgressSettled = !!scopedProgress && phase === 'hydrate' && hydrateDone >= hydrateDiscovered;
  const canSettleUnreadyEmpty =
    cacheHasLoaded !== false &&
    !isQuestionCacheReady &&
    !recentRateLimit &&
    !hasScanOrHydrationWork &&
    hydrationProgressSettled;

  return {
    scanTotalBlocks,
    scanRemainingBlocks,
    hydrateDiscovered,
    hydrateDone,
    hasScanOrHydrationWork,
    hydrationProgressSettled,
    canSettleUnreadyEmpty,
  };
};

export const buildPileEmptyProbePlan = ({
  cacheHasLoaded = true,
  isQuestionCacheReady = false,
  recentRateLimit = false,
  hasPendingMetadataRetries = false,
  hasScanOrHydrationWork = false,
  canSettleUnreadyEmpty = false,
  hydrationProgressSettled = false,
  scopedProgress = null,
  scanTotalBlocks,
  scanRemainingBlocks,
  hydrateDiscovered,
  hydrateDone,
  emptyReadyProbeStartedAtMs = 0,
  nowMs = Date.now(),
}: {
  cacheHasLoaded?: boolean | null;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
  hasPendingMetadataRetries?: boolean;
  hasScanOrHydrationWork?: boolean;
  canSettleUnreadyEmpty?: boolean;
  hydrationProgressSettled?: boolean;
  scopedProgress?: PileQuestionProgressLike;
  scanTotalBlocks?: number | null;
  scanRemainingBlocks?: number | null;
  hydrateDiscovered?: number | null;
  hydrateDone?: number | null;
  emptyReadyProbeStartedAtMs?: number | null;
  nowMs?: number | null;
} = {}): PileEmptyProbePlan => {
  const coldBootInProgress = cacheHasLoaded === false;
  const phase = String(scopedProgress?.phase || '').toLowerCase();
  const normalizedScanTotalBlocks = Math.max(0, Number(scanTotalBlocks ?? scopedProgress?.totalBlocks ?? 0));
  const normalizedScanRemainingBlocks = Math.max(
    0,
    Number(scanRemainingBlocks ?? scopedProgress?.remainingBlocks ?? 0),
  );
  const normalizedHydrateDiscovered = Math.max(
    0,
    Number(hydrateDiscovered ?? scopedProgress?.discoveredQuestions ?? 0),
  );
  const normalizedHydrateDone = Math.max(0, Number(hydrateDone ?? scopedProgress?.hydratedQuestions ?? 0));
  const probeStartedAtMs = Math.max(0, Number(emptyReadyProbeStartedAtMs || 0));
  const currentNowMs = Math.max(0, Number(nowMs || 0));

  const progressIndicatesDefinitiveEmpty =
    !hasPendingMetadataRetries &&
    !!scopedProgress &&
    ((phase === 'scan' &&
      normalizedScanTotalBlocks === 0 &&
      normalizedScanRemainingBlocks === 0 &&
      normalizedHydrateDiscovered === 0 &&
      normalizedHydrateDone === 0) ||
      (phase !== 'scan' &&
        phase !== 'hydrate' &&
        normalizedScanRemainingBlocks === 0 &&
        normalizedHydrateDiscovered === 0) ||
      hydrationProgressSettled);

  const shouldKeepLoadingImmediately =
    coldBootInProgress ||
    recentRateLimit ||
    hasPendingMetadataRetries ||
    hasScanOrHydrationWork ||
    (!isQuestionCacheReady && !canSettleUnreadyEmpty);

  if (shouldKeepLoadingImmediately) {
    return {
      action: 'continue-loading-immediately',
      nextProbeStartedAtMs: 0,
      nextProbeDelayMs: 0,
      progressIndicatesDefinitiveEmpty,
    };
  }

  const nextProbeStartedAtMs = probeStartedAtMs || currentNowMs;
  const emptyProbeWindowMs = progressIndicatesDefinitiveEmpty ? 0 : 20000;
  const probeAgeMs = Math.max(0, currentNowMs - nextProbeStartedAtMs);

  if (probeAgeMs < emptyProbeWindowMs) {
    return {
      action: 'probe-loading',
      nextProbeStartedAtMs,
      nextProbeDelayMs: Math.min(900, Math.max(160, emptyProbeWindowMs - probeAgeMs)),
      progressIndicatesDefinitiveEmpty,
    };
  }

  return {
    action: 'settle-empty',
    nextProbeStartedAtMs: 0,
    nextProbeDelayMs: 0,
    progressIndicatesDefinitiveEmpty,
  };
};
