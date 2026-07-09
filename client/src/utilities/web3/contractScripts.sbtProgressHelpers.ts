/**
 * @module contractScriptsSbtProgressHelpers
 * @description Helpers for tracking SBT event scan progress across holder refresh passes.
 */

type SbtScanProgressRecord = Record<string, unknown>;
type SbtScanProgressEvent = SbtScanProgressRecord & {
  phase?: unknown;
  fromBlock?: unknown;
  toBlock?: unknown;
  totalBlocks?: number;
  scannedBlocks?: number;
  remainingBlocks?: number;
  completionRatio?: number;
};
type SbtScanProgressState = SbtScanProgressRecord & {
  phase: unknown;
  fromBlock: number;
  toBlock: number;
  totalBlocks: number;
  scannedBlocks: number;
  maxConcurrency: number | null;
  onLogs: ((payload: SbtScanProgressRecord) => Promise<unknown> | unknown) | null;
  onProgress: ((progress?: SbtScanProgressEvent) => void) | null;
};

// One holder refresh scans a single chronological SBTActivity stream. Keep progress
// monotonic within that phase so UI consumers do not see 100%, then 0%, during a
// single holders refresh.
export const createSbtEventScanProgressState = ({
  onProgress,
  onLogs,
  phase,
  fromBlock,
  toBlock,
  scanTotalBlocks,
  phaseTotalBlocks = scanTotalBlocks,
  passOffsetBlocks = 0,
  initialScannedBlocks = 0,
  maxConcurrency = null,
}: {
  onProgress?: ((payload: SbtScanProgressEvent) => unknown) | null;
  onLogs?: ((payload: SbtScanProgressRecord) => Promise<unknown> | unknown) | null;
  phase?: unknown;
  fromBlock?: unknown;
  toBlock?: unknown;
  scanTotalBlocks?: unknown;
  phaseTotalBlocks?: unknown;
  passOffsetBlocks?: unknown;
  initialScannedBlocks?: unknown;
  maxConcurrency?: unknown;
} = {}): SbtScanProgressState | null => {
  if (typeof onProgress !== 'function' && typeof onLogs !== 'function') return null;

  const normalizedScanTotalBlocks = Math.max(0, Math.floor(Number(scanTotalBlocks || 0)));
  const normalizedPhaseTotalBlocks = Math.max(normalizedScanTotalBlocks, Math.floor(Number(phaseTotalBlocks || 0)));
  const normalizedPassOffsetBlocks = Math.max(0, Math.floor(Number(passOffsetBlocks || 0)));
  const normalizedInitialScannedBlocks = Math.max(
    0,
    Math.min(normalizedPhaseTotalBlocks, normalizedPassOffsetBlocks + Math.floor(Number(initialScannedBlocks || 0))),
  );
  const baseFromBlock = Number(fromBlock);
  const baseToBlock = Number(toBlock);
  const normalizedMaxConcurrency =
    Number.isFinite(Number(maxConcurrency)) && Number(maxConcurrency) > 0
      ? Math.max(1, Math.floor(Number(maxConcurrency)))
      : null;

  return {
    phase,
    fromBlock: baseFromBlock,
    toBlock: baseToBlock,
    totalBlocks: normalizedScanTotalBlocks,
    scannedBlocks: normalizedInitialScannedBlocks,
    maxConcurrency: normalizedMaxConcurrency,
    onLogs: typeof onLogs === 'function' ? onLogs : null,
    onProgress:
      typeof onProgress === 'function'
        ? (progress: SbtScanProgressEvent = {}) => {
            const passScannedBlocks = Math.max(
              0,
              Math.min(normalizedScanTotalBlocks, Math.floor(Number(progress?.scannedBlocks || 0))),
            );
            const scannedBlocks = Math.max(
              0,
              Math.min(normalizedPhaseTotalBlocks, normalizedInitialScannedBlocks + passScannedBlocks),
            );
            const remainingBlocks = Math.max(0, normalizedPhaseTotalBlocks - scannedBlocks);
            const completionRatio =
              normalizedPhaseTotalBlocks > 0 ? Math.max(0, Math.min(1, scannedBlocks / normalizedPhaseTotalBlocks)) : 1;

            onProgress({
              ...progress,
              phase,
              fromBlock: Number.isFinite(Number(progress?.fromBlock)) ? Number(progress.fromBlock) : baseFromBlock,
              toBlock: Number.isFinite(Number(progress?.toBlock)) ? Number(progress.toBlock) : baseToBlock,
              totalBlocks: normalizedPhaseTotalBlocks,
              scannedBlocks,
              remainingBlocks,
              completionRatio,
            });
          }
        : null,
  };
};
