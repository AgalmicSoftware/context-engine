import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import type { SbtListHelperRecord } from './sbtListCardDetailsHelpers';
import type { SbtCacheMetaSnapshot } from './sbtListItemNormalizationHelpers';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export type SbtListLiveProgressSnapshot = SbtListHelperRecord & {
  currentBlock?: unknown;
  latestBlock?: unknown;
  updatedAtMs?: unknown;
};

export type SbtListSessionProgressSnapshot = {
  cacheMeta: SbtCacheMetaSnapshot | null;
  cfg: SbtListHelperRecord | null;
  deferred: boolean;
  displayCurrentBlock: number;
  hasCache: boolean;
  hasLatest: boolean;
  lastBlock: number;
  latestForGroup: number | null;
  liveCurrentBlock: number | null;
  liveLatestBlock: number | null;
  liveProgress: SbtListLiveProgressSnapshot | null;
  remainingBlocks: number | null;
  sbtCount: number;
  scanInProgress: boolean;
  slug: string;
  startBlock: number | null;
};

export type SbtListSessionLoadingStatusSnapshot = {
  cfg?: SbtListHelperRecord | null;
  deferred?: boolean;
  displayCurrentBlock?: number;
  hasCache?: boolean;
  hasLatest?: boolean;
  lastBlock?: number;
  latestForGroup?: number | null;
  remainingBlocks?: number | null;
  scanInProgress?: boolean;
  slug?: string;
  startBlock?: number | null;
};

export type SbtListSessionLoadingStatus = {
  chipBlockProgressText: string;
  chipRemainingText: string;
  deferred: boolean;
  displayCurrentBlock: number;
  displayName: string;
  hasLatest: boolean;
  lastBlock: number;
  latestForGroup: number | null;
  progressPct: number;
  progressText: string;
  remainingBlocks: number | null;
  scanInProgress: boolean;
  slug: string;
  slugLabel: string;
  statusLabel: string;
};

export type SbtListSessionChipState = {
  hasCards: boolean;
  hasLoadedOnce: boolean;
  isLoaded: boolean;
  isLoading: boolean;
};

export type SbtListSessionChipStateBySlug = Record<string, SbtListSessionChipState | undefined>;

type BuildSbtListSessionLoadingStatusArgs = {
  allSessionsMode?: boolean;
  alwaysShow?: boolean;
  forceShow?: boolean;
  formatBlockCount?: (value: unknown) => string;
  loading?: boolean;
  snapshot?: SbtListSessionLoadingStatusSnapshot | null;
};

type BuildSbtListSessionChipStateBySlugArgs = {
  allSessionsMode?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  getSessionProgressSnapshot?: (slug: string) => {
    deferred?: unknown;
    scanInProgress?: unknown;
  } | null;
  hasNoSessionCards?: unknown;
  readSbtCacheMeta?: (slug: string) => unknown;
  refreshing?: unknown;
  sbtListBySlug?: Record<string, unknown>;
  sessionHasLoadedOnceBySlug?: Record<string, unknown>;
  sessionLoadStateBySlug?: Record<string, unknown>;
};

type BuildSbtListSessionProgressSnapshotArgs = {
  allSessionsMode?: unknown;
  bridgeMs?: unknown;
  bridgeTailBlocks?: unknown;
  bridgedLiveProgress?: SbtListLiveProgressSnapshot | null;
  cacheMeta?: SbtCacheMetaSnapshot | null;
  cfg?: SbtListHelperRecord | null;
  deferredRaw?: unknown;
  latestBlock?: unknown;
  liveProgressFromProps?: SbtListLiveProgressSnapshot | null;
  recentLiveProgressNowMs?: unknown;
  scanInProgressRaw?: unknown;
  slug?: unknown;
};

export const buildSbtListSessionLoadingStatus = ({
  allSessionsMode = false,
  alwaysShow = false,
  forceShow = false,
  formatBlockCount = (value) => String(value ?? ''),
  loading = false,
  snapshot = null,
}: BuildSbtListSessionLoadingStatusArgs = {}): SbtListSessionLoadingStatus | null => {
  if (!snapshot) return null;
  const {
    cfg = null,
    lastBlock = 0,
    hasCache = false,
    startBlock = null,
    latestForGroup = null,
    hasLatest = false,
    displayCurrentBlock = 0,
    remainingBlocks = null,
    scanInProgress = false,
    deferred = false,
  } = snapshot;
  const slug = normalizeSessionSlug(snapshot.slug || '');
  const sessionLabel = String(cfg?.sessionName || (slug || 'General'));
  const slugLabel = slug || 'general';
  const displayName =
    sessionLabel && sessionLabel.toLowerCase() !== slugLabel.toLowerCase()
      ? `${sessionLabel} (${slugLabel})`
      : sessionLabel;
  const numericLatestForGroup = Number(latestForGroup || 0);
  const numericStartBlock = Number(startBlock || 0);
  const numericRemainingBlocks = Number(remainingBlocks || 0);
  const totalBlocks = hasLatest ? Math.max(1, numericLatestForGroup - numericStartBlock + 1) : null;
  const scannedBlocks = hasLatest
    ? Math.max(0, Math.min(totalBlocks || 0, displayCurrentBlock - numericStartBlock + 1))
    : 0;
  const progressPct = hasLatest
    ? Math.max(0, Math.min(100, Math.round((scannedBlocks / (totalBlocks || 1)) * 100)))
    : 0;
  const progressText = hasLatest
    ? (numericRemainingBlocks === 0
      ? `In Sync (Current: ${formatBlockCount(displayCurrentBlock)} / Latest: ${formatBlockCount(numericLatestForGroup)})`
      : `Remaining Blocks: ${formatBlockCount(numericRemainingBlocks)} (Current: ${formatBlockCount(displayCurrentBlock)} / Latest: ${formatBlockCount(numericLatestForGroup)})`)
    : `Loading latest block... (Current: ${formatBlockCount(displayCurrentBlock)})`;
  const chipRemainingText = hasLatest
    ? (numericRemainingBlocks > 0
      ? `${formatBlockCount(numericRemainingBlocks)} remaining`
      : 'Synced')
    : 'Syncing';
  const chipBlockProgressText = hasLatest
    ? `${formatBlockCount(displayCurrentBlock)} / ${formatBlockCount(latestForGroup)}`
    : `Current ${formatBlockCount(displayCurrentBlock)}`;
  const statusLabel = scanInProgress ? 'Scanning' : deferred ? 'Queued' : 'Loading';
  const shouldShow = alwaysShow || forceShow || (allSessionsMode
    ? (scanInProgress || deferred || (!hasCache && loading))
    : true);

  if (!shouldShow) return null;
  return {
    slug,
    slugLabel,
    displayName,
    statusLabel,
    progressText,
    chipRemainingText,
    chipBlockProgressText,
    progressPct,
    hasLatest,
    latestForGroup,
    lastBlock,
    displayCurrentBlock,
    remainingBlocks,
    scanInProgress,
    deferred,
  };
};

export const buildSbtListSessionChipStateBySlug = ({
  allSessionsMode = false,
  displayedSessionUniverseSlugs = [],
  getSessionProgressSnapshot = () => null,
  hasNoSessionCards = false,
  readSbtCacheMeta = () => null,
  refreshing = false,
  sbtListBySlug = {},
  sessionHasLoadedOnceBySlug = {},
  sessionLoadStateBySlug = {},
}: BuildSbtListSessionChipStateBySlugArgs = {}): SbtListSessionChipStateBySlug => {
  if (!allSessionsMode) return {};
  const out: SbtListSessionChipStateBySlug = {};
  (Array.isArray(displayedSessionUniverseSlugs) ? displayedSessionUniverseSlugs : []).forEach((slugRaw) => {
    const slug = normalizeSessionSlug(slugRaw || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) {
      const hasLoadedOnce = Object.values(sessionHasLoadedOnceBySlug).some(Boolean);
      const anySessionLoading = Object.values(sessionLoadStateBySlug).some((state) => state === 'loading');
      const hasCards = !!hasNoSessionCards;
      const isLoading = !!refreshing || (!hasCards && (!hasLoadedOnce || anySessionLoading));
      const isLoaded = hasCards || (hasLoadedOnce && !isLoading);
      out[slug] = { isLoaded, isLoading, hasLoadedOnce, hasCards };
      return;
    }
    const cacheMeta = readSbtCacheMeta(slug);
    const snapshot = getSessionProgressSnapshot(slug);
    const hasCacheSnapshot = cacheMeta != null;
    const hasLoadedOnce = !!sessionHasLoadedOnceBySlug[slug];
    const listForSlug = sbtListBySlug[slug];
    const hasCards = Array.isArray(listForSlug) && listForSlug.length > 0;
    const loadState = sessionLoadStateBySlug[slug] || 'idle';
    const scanInProgress = !!snapshot?.scanInProgress;
    const deferred = !!snapshot?.deferred;
    const isLoading = (
      loadState === 'loading' ||
      scanInProgress ||
      deferred ||
      !!refreshing ||
      (!hasCacheSnapshot && !hasLoadedOnce)
    );
    const isLoaded = (hasLoadedOnce || hasCacheSnapshot) && !scanInProgress && !deferred && loadState !== 'loading';
    out[slug] = { isLoaded, isLoading, hasLoadedOnce, hasCards };
  });
  return out;
};

export const buildSbtListSessionProgressSnapshot = ({
  allSessionsMode = false,
  bridgeMs = 0,
  bridgeTailBlocks = 0,
  bridgedLiveProgress = null,
  cacheMeta = null,
  cfg = null,
  deferredRaw = false,
  latestBlock = 0,
  liveProgressFromProps = null,
  recentLiveProgressNowMs = 0,
  scanInProgressRaw = false,
  slug: slugIn = '',
}: BuildSbtListSessionProgressSnapshotArgs = {}): SbtListSessionProgressSnapshot => {
  const slug = normalizeSessionSlug(slugIn || '');
  const lastBlock = Number(cacheMeta?.lastBlock || 0);
  const sbtCount = Number(cacheMeta?.sbtCount || 0);
  const hasCache = lastBlock > 0 || sbtCount > 0;
  const bridgedAgeMs = bridgedLiveProgress
    ? Math.max(0, Number(recentLiveProgressNowMs || 0) - Number(bridgedLiveProgress.updatedAtMs || 0))
    : Number.POSITIVE_INFINITY;
  const bridgedRemainingBlocks = Math.max(
    0,
    Number(bridgedLiveProgress?.latestBlock || 0) - Number(bridgedLiveProgress?.currentBlock || 0)
  );
  // Regression guard: after a scan completes, live progress can clear before the
  // cache watermark catches up. Keep only a fresh tail bridge to avoid a false restart.
  const liveProgress = liveProgressFromProps || (
    !scanInProgressRaw &&
    !deferredRaw &&
    bridgedLiveProgress &&
    bridgedAgeMs <= Number(bridgeMs || 0) &&
    bridgedRemainingBlocks <= Number(bridgeTailBlocks || 0) &&
    Number(bridgedLiveProgress.currentBlock || 0) > lastBlock
      ? bridgedLiveProgress
      : null
  );
  const liveCurrentCandidate = Number(liveProgress?.currentBlock || 0);
  const liveCurrentBlock = Number.isFinite(liveCurrentCandidate) && liveCurrentCandidate > 0
    ? liveCurrentCandidate
    : null;
  const liveLatestCandidate = Number(liveProgress?.latestBlock || 0);
  const liveLatestBlock = Number.isFinite(liveLatestCandidate) && liveLatestCandidate > 0
    ? liveLatestCandidate
    : null;
  const cfgRecord = (cfg && typeof cfg === 'object') ? cfg : null;
  const blockLimits = (cfgRecord?.blockLimits && typeof cfgRecord.blockLimits === 'object')
    ? cfgRecord.blockLimits as SbtListHelperRecord
    : {};
  const startRaw = Number(blockLimits.start);
  const startBlock = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : null;
  const latestCandidate = Math.max(
    Number(latestBlock || 0),
    Number(liveLatestBlock || 0)
  );
  const latestForGroup = Number.isFinite(latestCandidate) && latestCandidate > 0
    ? latestCandidate
    : null;
  const hasLatest = latestForGroup != null && latestForGroup > 0 && startBlock != null;
  const currentBlockBaseline = liveCurrentBlock != null
    ? Math.max(lastBlock, liveCurrentBlock)
    : lastBlock;
  const displayCurrentBlock = hasLatest
    ? Math.max(Number(startBlock || 0), currentBlockBaseline)
    : currentBlockBaseline;
  const remainingBlocks = hasLatest ? Math.max(0, latestForGroup - displayCurrentBlock) : null;
  const scanFlagNeedsAttention = !hasCache || !hasLatest || Number(remainingBlocks || 0) > 0;
  const useRawScanFlags = !allSessionsMode || scanFlagNeedsAttention;

  return {
    slug,
    cfg: cfgRecord,
    cacheMeta,
    lastBlock,
    sbtCount,
    hasCache,
    liveProgress: liveProgress || null,
    liveCurrentBlock,
    liveLatestBlock,
    startBlock,
    latestForGroup,
    hasLatest,
    displayCurrentBlock,
    remainingBlocks,
    scanInProgress: !!scanInProgressRaw && useRawScanFlags,
    deferred: !!deferredRaw && useRawScanFlags,
  };
};
