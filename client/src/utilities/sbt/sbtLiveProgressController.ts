import { normalizeSessionSlug } from '../session/sessionNaming.js';
import {
  mergeSbtLiveProgressEntry,
  SBT_PROGRESS_MIN_INTERVAL_MS,
  shouldCommitThrottledProgress,
} from '../session/mainSiteProgressHelpers.js';

interface BuildSbtCountsInitialProgressOptions {
  startBlock?: unknown;
  toBlock?: unknown;
  seedBlock?: unknown;
}

interface SbtCountsInitialProgress {
  phase: 'activity';
  fromBlock: number;
  toBlock: number;
  totalBlocks: number;
  scannedBlocks: number;
  remainingBlocks: number;
  completionRatio: number;
  scanFrom: number;
  scanTo: number;
  lastScannedBlock: number;
}

type MergeProgressEntry = typeof mergeSbtLiveProgressEntry;
type ShouldCommitProgress = typeof shouldCommitThrottledProgress;
type MergeProgressArgs = Parameters<MergeProgressEntry>[0];
type SbtLiveProgressEntry = NonNullable<NonNullable<MergeProgressArgs>['nextPatch']>;

interface SbtLiveProgressState {
  sbtScanProgressBySlug?: Record<string, SbtLiveProgressEntry>;
}

type SbtLiveProgressStatePatch = {
  sbtScanProgressBySlug: Record<string, SbtLiveProgressEntry>;
} | null;

type SbtLiveProgressStateUpdater = (prev: SbtLiveProgressState | null | undefined) => SbtLiveProgressStatePatch;

interface SbtLiveProgressControllerOptions {
  mergeProgressEntry?: MergeProgressEntry;
  setState?: ((updater: SbtLiveProgressStateUpdater, cb?: unknown) => unknown) | null;
  shouldCommitProgress?: ShouldCommitProgress;
  minIntervalMs?: number;
}

interface SbtLiveProgressMeta {
  token: number;
  lastCommitMs: number;
}

export const buildSbtCountsInitialProgress = ({
  startBlock,
  toBlock,
  seedBlock,
}: BuildSbtCountsInitialProgressOptions = {}): SbtCountsInitialProgress | null => {
  const scanStartBlock = Number(startBlock);
  const scanToBlock = Number(toBlock);
  const progressSeedBlock = Number(seedBlock);
  if (!Number.isFinite(scanStartBlock) || !Number.isFinite(scanToBlock) || !Number.isFinite(progressSeedBlock)) {
    return null;
  }

  const nextScanFrom = Math.max(progressSeedBlock + 1, scanStartBlock);
  if (nextScanFrom > scanToBlock) return null;

  const totalBlocks = Math.max(0, scanToBlock - scanStartBlock + 1);
  const scannedBlocks = Math.max(0, Math.min(totalBlocks, progressSeedBlock - scanStartBlock + 1));
  const lastScannedBlock =
    scannedBlocks > 0 ? Math.min(scanToBlock, scanStartBlock + scannedBlocks - 1) : scanStartBlock - 1;

  return {
    phase: 'activity',
    fromBlock: scanStartBlock,
    toBlock: scanToBlock,
    totalBlocks,
    scannedBlocks,
    remainingBlocks: Math.max(0, totalBlocks - scannedBlocks),
    completionRatio: totalBlocks > 0 ? scannedBlocks / totalBlocks : 1,
    scanFrom: scanStartBlock,
    scanTo: lastScannedBlock,
    lastScannedBlock,
  };
};

export const createSbtLiveProgressController = ({
  mergeProgressEntry = mergeSbtLiveProgressEntry,
  setState = null,
  shouldCommitProgress = shouldCommitThrottledProgress,
  minIntervalMs = SBT_PROGRESS_MIN_INTERVAL_MS,
}: SbtLiveProgressControllerOptions = {}) => {
  const progressMetaBySlug = new Map<string, SbtLiveProgressMeta>();

  const applyState = (updater: SbtLiveProgressStateUpdater, cb?: unknown): void => {
    if (typeof setState === 'function') {
      setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };

  const beginSbtLiveProgress = (slugIn: unknown, initialPatch: unknown = {}): number => {
    const slug = normalizeSessionSlug(slugIn || '');
    const token = Number(progressMetaBySlug.get(slug)?.token || 0) + 1;
    const nowMs = Date.now();
    progressMetaBySlug.set(slug, {
      token,
      lastCommitMs: nowMs,
    });
    applyState((prev) => ({
      sbtScanProgressBySlug: {
        ...(prev?.sbtScanProgressBySlug || {}),
        [slug]: mergeProgressEntry({
          prevEntry: null,
          nextPatch: {
            slug,
            ...(initialPatch as Record<string, unknown>),
            updatedAtMs: nowMs,
          },
          nowMs,
        }),
      },
    }));
    return token;
  };

  const updateSbtLiveProgress = (
    slugIn: unknown,
    token: unknown,
    nextPatch: unknown = {},
    options: unknown = {},
  ): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    const meta = progressMetaBySlug.get(slug);
    if (!meta || Number(meta.token || 0) !== Number(token || 0)) return false;
    const nowMs = Date.now();
    if (
      !shouldCommitProgress({
        force: (options as { force?: unknown } | null | undefined)?.force === true,
        nowMs,
        lastCommitMs: Number(meta.lastCommitMs || 0),
        minIntervalMs,
      })
    ) {
      return false;
    }
    meta.lastCommitMs = nowMs;
    progressMetaBySlug.set(slug, meta);
    applyState((prev) => {
      const prevEntry = prev?.sbtScanProgressBySlug?.[slug] || null;
      const nextEntry = mergeProgressEntry({
        prevEntry,
        nextPatch: {
          slug,
          ...(nextPatch as Record<string, unknown>),
          updatedAtMs: nowMs,
        },
        nowMs,
      });
      if (
        prevEntry &&
        Number(prevEntry.currentBlock || 0) === Number(nextEntry.currentBlock || 0) &&
        Number(prevEntry.latestBlock || 0) === Number(nextEntry.latestBlock || 0)
      ) {
        return null;
      }
      return {
        sbtScanProgressBySlug: {
          ...(prev?.sbtScanProgressBySlug || {}),
          [slug]: nextEntry,
        },
      };
    });
    return true;
  };

  const clearSbtLiveProgress = (slugIn: unknown, token: unknown = null): void => {
    const slug = normalizeSessionSlug(slugIn || '');
    const meta = progressMetaBySlug.get(slug);
    if (token != null && Number(meta?.token || 0) !== Number(token || 0)) return;
    progressMetaBySlug.delete(slug);
    applyState((prev) => {
      const current = prev?.sbtScanProgressBySlug || {};
      if (!Object.prototype.hasOwnProperty.call(current, slug)) return null;
      const next = { ...current };
      delete next[slug];
      return { sbtScanProgressBySlug: next };
    });
  };

  const destroy = () => {
    progressMetaBySlug.clear();
  };

  return {
    beginSbtLiveProgress,
    updateSbtLiveProgress,
    clearSbtLiveProgress,
    destroy,
  };
};
