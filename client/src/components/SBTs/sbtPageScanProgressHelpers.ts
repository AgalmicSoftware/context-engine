export type SbtPageScanProgressRecord = Record<string, unknown> & {
  currentBlock?: unknown;
  latestBlock?: unknown;
  totalBlocks?: unknown;
  scannedBlocks?: unknown;
  remainingBlocks?: unknown;
  phase?: unknown;
};

type BuildSbtPageParentSessionScanProgressArgs = {
  progress?: unknown;
  sessionConfig?: Record<string, unknown> | null;
  sessionLabel?: unknown;
  sessionSlug?: unknown;
};
type BuildSbtPageEffectiveHolderScanProgressArgs = {
  getParentProgress?: (() => unknown) | null;
  getSessionLabel?: (() => unknown) | null;
  getSessionSlug?: (() => unknown) | null;
  localProgress?: unknown;
};
type ResolveSbtPageHolderScanActiveArgs = {
  hasActiveScanProgress?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  sbtScanInProgress?: unknown;
  sbtScanPending?: unknown;
};
type ResolveSbtPageScanProgressPercentArgs = {
  progress?: unknown;
  showScanProgress?: unknown;
};
type ResolveSbtPageScanProgressFillStyleArgs = {
  percent?: unknown;
};
type ResolveSbtPageScanProgressDisplayArgs = {
  phaseLabel?: unknown;
  rawRemainingBlocksCount?: unknown;
  sessionLabel?: unknown;
  showScanProgress?: unknown;
};
type ShouldShowSbtPageScanProgressArgs = {
  effectiveLoading?: unknown;
  hasActiveScanProgress?: unknown;
  rawRemainingBlocksCount?: unknown;
};
type SbtPageScanProgressDisplay = {
  remainingBlocksCount: number;
  scanProgressSessionText: string | null;
  scanProgressText: string | null;
};

const isSbtPageScanRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const hasUsableSbtPageScanProgress = (progress: unknown): boolean => {
  const record = isSbtPageScanRecord(progress) ? progress : null;
  if (!record) return false;
  const totalBlocks = Number(record.totalBlocks || 0);
  const currentBlock = Number(record.currentBlock || 0);
  const latestBlock = Number(record.latestBlock || 0);
  const remainingBlocks = Number(record.remainingBlocks);
  return (
    (Number.isFinite(totalBlocks) && totalBlocks > 0) ||
    (Number.isFinite(currentBlock) &&
      currentBlock >= 0 &&
      Number.isFinite(latestBlock) &&
      latestBlock > 0 &&
      latestBlock >= currentBlock) ||
    (Number.isFinite(remainingBlocks) && remainingBlocks >= 0)
  );
};

export const isActiveSbtPageScanProgress = (progress: unknown): boolean => {
  if (!hasUsableSbtPageScanProgress(progress)) return false;
  const record = isSbtPageScanRecord(progress) ? progress : {};
  const remainingBlocks = Number(record.remainingBlocks);
  if (Number.isFinite(remainingBlocks)) return remainingBlocks > 0;

  const totalBlocks = Number(record.totalBlocks || 0);
  const scannedBlocks = Number(record.scannedBlocks);
  if (Number.isFinite(totalBlocks) && totalBlocks > 0 && Number.isFinite(scannedBlocks)) {
    return scannedBlocks < totalBlocks;
  }

  const currentBlock = Number(record.currentBlock || 0);
  const latestBlock = Number(record.latestBlock || 0);
  return (
    Number.isFinite(currentBlock) && currentBlock >= 0 && Number.isFinite(latestBlock) && latestBlock > currentBlock
  );
};

export const resolveSbtPageHolderScanActive = ({
  hasActiveScanProgress = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  sbtScanInProgress = false,
  sbtScanPending = false,
}: ResolveSbtPageHolderScanActiveArgs = {}): boolean =>
  Boolean(hasActiveScanProgress || loadingMintersBurners || loadingMintedFilter || sbtScanInProgress || sbtScanPending);

export const formatSbtPageBlockCount = (value: unknown): string =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '-';

export const resolveSbtPageRemainingBlocksCount = (progress: unknown): number => {
  const record = isSbtPageScanRecord(progress) ? progress : {};
  const remainingBlocks = Number(record.remainingBlocks);
  return Math.max(
    0,
    Number.isFinite(remainingBlocks)
      ? remainingBlocks
      : Number(record.totalBlocks || 0) - Number(record.scannedBlocks || 0),
  );
};

export const shouldShowSbtPageScanProgress = ({
  effectiveLoading = false,
  hasActiveScanProgress = false,
  rawRemainingBlocksCount = 0,
}: ShouldShowSbtPageScanProgressArgs = {}): boolean =>
  !!hasActiveScanProgress && (!!effectiveLoading || Number(rawRemainingBlocksCount) > 0);

export const resolveSbtPageScanProgressPercent = ({
  progress = null,
  showScanProgress = false,
}: ResolveSbtPageScanProgressPercentArgs = {}): number => {
  if (!showScanProgress) return 0;
  const record = isSbtPageScanRecord(progress) ? progress : {};
  return Number.isFinite(Number(record.totalBlocks)) &&
    Number(record.totalBlocks) > 0 &&
    Number.isFinite(Number(record.scannedBlocks))
    ? Math.max(
        0,
        Math.min(100, Math.round((Number(record.scannedBlocks || 0) / Number(record.totalBlocks || 1)) * 100)),
      )
    : 0;
};

export const resolveSbtPageScanProgressFillStyle = ({
  percent = 0,
}: ResolveSbtPageScanProgressFillStyleArgs = {}): Record<string, string> => ({
  width: `${Number(percent || 0) || 0}%`,
});

export const resolveSbtPageScanProgressDisplay = ({
  phaseLabel = 'Scanning mint/burn history',
  rawRemainingBlocksCount = 0,
  sessionLabel = '',
  showScanProgress = false,
}: ResolveSbtPageScanProgressDisplayArgs = {}): SbtPageScanProgressDisplay => {
  if (!showScanProgress) {
    return {
      remainingBlocksCount: 0,
      scanProgressSessionText: null,
      scanProgressText: null,
    };
  }
  const remainingBlocksCount = rawRemainingBlocksCount == null ? 0 : Number(rawRemainingBlocksCount);
  return {
    remainingBlocksCount,
    scanProgressSessionText: `Session: ${String(sessionLabel || '').trim()}`,
    scanProgressText: `${String(phaseLabel || '')}: ${formatSbtPageBlockCount(remainingBlocksCount)} blocks remaining`,
  };
};

export const buildSbtPageParentSessionScanProgress = ({
  progress: progressRaw = null,
  sessionConfig = null,
  sessionLabel = '',
  sessionSlug = '',
}: BuildSbtPageParentSessionScanProgressArgs = {}): SbtPageScanProgressRecord | null => {
  const progress = isSbtPageScanRecord(progressRaw) ? progressRaw : null;
  if (!progress) return null;

  const currentBlock = Math.max(0, Math.floor(Number(progress?.currentBlock || 0)));
  const latestBlock = Math.max(currentBlock, Math.floor(Number(progress?.latestBlock || 0)));
  if (!Number.isFinite(currentBlock) || !Number.isFinite(latestBlock) || latestBlock <= 0) {
    return null;
  }

  const blockLimits = isSbtPageScanRecord(sessionConfig?.blockLimits) ? sessionConfig.blockLimits : {};
  const startCandidate = Math.floor(Number(blockLimits.start || 0));
  const hasStartBlock = Number.isFinite(startCandidate) && startCandidate > 0;
  const startBlock = hasStartBlock ? Math.min(startCandidate, latestBlock) : 0;
  const totalBlocks = hasStartBlock ? Math.max(1, latestBlock - startBlock + 1) : null;
  const scannedBlocks = totalBlocks != null ? Math.max(0, Math.min(totalBlocks, currentBlock - startBlock + 1)) : null;

  return {
    ...progress,
    source: 'session',
    phase: progress.phase || 'activity',
    currentBlock,
    latestBlock,
    fromBlock: hasStartBlock ? startBlock : undefined,
    toBlock: latestBlock,
    totalBlocks: totalBlocks != null ? totalBlocks : undefined,
    scannedBlocks: scannedBlocks != null ? scannedBlocks : undefined,
    remainingBlocks: Math.max(0, latestBlock - currentBlock),
    sessionSlug,
    sessionLabel,
  };
};

export const buildSbtPageEffectiveHolderScanProgress = ({
  getParentProgress = null,
  getSessionLabel = null,
  getSessionSlug = null,
  localProgress: localProgressRaw = null,
}: BuildSbtPageEffectiveHolderScanProgressArgs = {}): SbtPageScanProgressRecord | null => {
  const localProgress = isSbtPageScanRecord(localProgressRaw) ? localProgressRaw : null;
  if (hasUsableSbtPageScanProgress(localProgress)) {
    return {
      sessionSlug: getSessionSlug ? getSessionSlug() : '',
      sessionLabel: getSessionLabel ? getSessionLabel() : '',
      ...localProgress,
    };
  }
  const parentProgress = getParentProgress ? getParentProgress() : null;
  if (hasUsableSbtPageScanProgress(parentProgress)) {
    return parentProgress as SbtPageScanProgressRecord;
  }
  return null;
};
