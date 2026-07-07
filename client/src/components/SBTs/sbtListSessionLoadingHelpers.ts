import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import type { SbtListHelperRecord } from './sbtListCardDetailsHelpers';
import type { SbtCacheMetaSnapshot } from './sbtListItemNormalizationHelpers';
import { dedupeNormalizedSbtListSlugs, isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

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

export type SbtListSessionLoadingStatusBySlug = Record<string, SbtListSessionLoadingStatus | undefined>;

export type SbtListSessionLoadingStatusOptions = {
  alwaysShow?: boolean;
  forceShow?: boolean;
};

export type SbtListSessionLoadingStatusResolver = (
  slug: unknown,
  options?: SbtListSessionLoadingStatusOptions,
) => SbtListSessionLoadingStatus | null | undefined;

export type SbtListSessionChipState = {
  hasCards: boolean;
  hasLoadedOnce: boolean;
  isLoaded: boolean;
  isLoading: boolean;
};

export type SbtListSessionChipStateBySlug = Record<string, SbtListSessionChipState | undefined>;

export type SbtListSectionLoadingState = {
  refreshButtonBusy: boolean;
  sectionSessionDiscoveryPending: boolean;
  sectionSessionSearchFlag: boolean;
  shouldKeepSectionSpinnersOn: boolean;
};

export type SbtListReadinessDisplayPlan = {
  canShowSectionEmptyState: boolean;
  initialLoadingActive: boolean;
  sectionHeaderSpinnerVisible: boolean;
  sectionReadinessPending: boolean;
  shouldDeferInitialLoaderForUniverse: boolean;
  showExpiredSectionLoadingHint: boolean;
  showFeaturedSectionLoadingHint: boolean;
  showInitialLoader: boolean;
  showLiveSectionLoadingHint: boolean;
  showSectionBodyLoadingHint: boolean;
  showUniverseSpinner: boolean;
};

type BuildSbtListSessionLoadingStatusArgs = {
  allSessionsMode?: boolean;
  alwaysShow?: boolean;
  forceShow?: boolean;
  formatBlockCount?: (value: unknown) => string;
  loading?: boolean;
  snapshot?: SbtListSessionLoadingStatusSnapshot | null;
};

type BuildSbtListInitialLoaderStatusesArgs = {
  fallbackSlug?: unknown;
  loaderSessionSlugs?: unknown;
  resolveStatus?: SbtListSessionLoadingStatusResolver;
  windowAvailable?: boolean;
};

type BuildSbtListChipLoadingStatusBySlugArgs = {
  allSessionsMode?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  resolveStatus?: SbtListSessionLoadingStatusResolver;
  selectedSessionUniverseSlugs?: Set<unknown> | unknown[];
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

type ResolveSbtListSectionLoadingStateArgs = {
  getSessionProgressSnapshot?: (slug: string) => {
    deferred?: unknown;
    hasLatest?: unknown;
    remainingBlocks?: unknown;
    scanInProgress?: unknown;
  } | null;
  hasNoSessionCards?: unknown;
  isSBTCacheReady?: unknown;
  loading?: unknown;
  refreshing?: unknown;
  revisionSyncPending?: unknown;
  sbtListBySlug?: Record<string, unknown>;
  sectionSessionSlugs?: unknown;
  sessionHasLoadedOnceBySlug?: Record<string, unknown>;
  sessionLoadStateBySlug?: Record<string, unknown>;
  sessionUniverseRegistryPending?: unknown;
};

type ResolveSbtListReadinessDisplayPlanArgs = {
  allSessionsMode?: unknown;
  availableSessionSlugCount?: unknown;
  displayedFeaturedCount?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  emptySectionSpinnerActive?: unknown;
  expiredCount?: unknown;
  initialLoadCompleted?: unknown;
  isSBTCacheReady?: unknown;
  loading?: unknown;
  mintingLiveCount?: unknown;
  refreshing?: unknown;
  revisionSyncPending?: unknown;
  sectionSessionDiscoveryPending?: unknown;
  sectionSessionSearchFlag?: unknown;
  sessionUniverseRegistryPending?: unknown;
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

const normalizeSbtListStatusSlug = (slug: unknown): string => normalizeSessionSlug(slug || '');

const isSbtListLoadingStatus = (
  status: SbtListSessionLoadingStatus | null | undefined,
): status is SbtListSessionLoadingStatus => !!status;

const labelSbtListLoadingStatusBySlug = (status: SbtListSessionLoadingStatus): SbtListSessionLoadingStatus => ({
  ...status,
  slug: status.slugLabel,
});

const normalizeSbtListReadinessCount = (value: unknown): number => {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const countSbtListUniverseSlugs = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  return normalizeSbtListReadinessCount(value);
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
  const sessionLabel = String(cfg?.sessionName || slug || 'General');
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
    ? numericRemainingBlocks === 0
      ? `In Sync (Current: ${formatBlockCount(displayCurrentBlock)} / Latest: ${formatBlockCount(numericLatestForGroup)})`
      : `Remaining Blocks: ${formatBlockCount(numericRemainingBlocks)} (Current: ${formatBlockCount(displayCurrentBlock)} / Latest: ${formatBlockCount(numericLatestForGroup)})`
    : `Loading latest block... (Current: ${formatBlockCount(displayCurrentBlock)})`;
  const chipRemainingText = hasLatest
    ? numericRemainingBlocks > 0
      ? `${formatBlockCount(numericRemainingBlocks)} remaining`
      : 'Synced'
    : 'Syncing';
  const chipBlockProgressText = hasLatest
    ? `${formatBlockCount(displayCurrentBlock)} / ${formatBlockCount(latestForGroup)}`
    : `Current ${formatBlockCount(displayCurrentBlock)}`;
  const statusLabel = scanInProgress ? 'Scanning' : deferred ? 'Queued' : 'Loading';
  const shouldShow =
    alwaysShow || forceShow || (allSessionsMode ? scanInProgress || deferred || (!hasCache && loading) : true);

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

export const buildSbtListInitialLoaderStatuses = ({
  fallbackSlug = '',
  loaderSessionSlugs = [],
  resolveStatus = () => null,
  windowAvailable = true,
}: BuildSbtListInitialLoaderStatusesArgs = {}): SbtListSessionLoadingStatus[] => {
  if (!windowAvailable) return [];

  const statuses = (Array.isArray(loaderSessionSlugs) ? loaderSessionSlugs : [])
    .map((slug) => resolveStatus(slug))
    .filter(isSbtListLoadingStatus)
    .map(labelSbtListLoadingStatusBySlug);

  const normalizedFallbackSlug = normalizeSbtListStatusSlug(fallbackSlug);
  if (!statuses.length && normalizedFallbackSlug) {
    const fallback = resolveStatus(normalizedFallbackSlug, { forceShow: true });
    if (fallback) statuses.push(labelSbtListLoadingStatusBySlug(fallback));
  }

  return statuses;
};

export const buildSbtListChipLoadingStatusBySlug = ({
  allSessionsMode = false,
  displayedSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  resolveStatus = () => null,
  selectedSessionUniverseSlugs = [],
}: BuildSbtListChipLoadingStatusBySlugArgs = {}): SbtListSessionLoadingStatusBySlug => {
  if (!allSessionsMode) return {};

  const selectedSlugs =
    selectedSessionUniverseSlugs instanceof Set
      ? Array.from(selectedSessionUniverseSlugs)
      : Array.isArray(selectedSessionUniverseSlugs)
        ? selectedSessionUniverseSlugs
        : [];
  const selectedSlugSet = new Set(selectedSlugs.map(normalizeSbtListStatusSlug));
  const chipSlugs = dedupeNormalizedSbtListSlugs(
    Array.isArray(displayedSessionUniverseSlugs) ? displayedSessionUniverseSlugs : [],
  );
  const out: SbtListSessionLoadingStatusBySlug = {};

  chipSlugs.forEach((slug) => {
    const normalizedSlug = normalizeSbtListStatusSlug(slug);
    if (isListModeScopeEnabled && !selectedSlugSet.has(normalizedSlug)) return;

    const status = resolveStatus(normalizedSlug, { alwaysShow: true });
    if (!status) return;
    out[normalizedSlug] = status;
  });

  return out;
};

export const resolveSbtListSectionLoadingState = ({
  getSessionProgressSnapshot = () => null,
  hasNoSessionCards = false,
  isSBTCacheReady = false,
  loading = false,
  refreshing = false,
  revisionSyncPending = false,
  sbtListBySlug = {},
  sectionSessionSlugs = [],
  sessionHasLoadedOnceBySlug = {},
  sessionLoadStateBySlug = {},
  sessionUniverseRegistryPending = false,
}: ResolveSbtListSectionLoadingStateArgs = {}): SbtListSectionLoadingState => {
  const slugs = Array.isArray(sectionSessionSlugs) ? sectionSessionSlugs : [];
  const sectionSessionDiscoveryPending =
    slugs.length > 0 &&
    slugs.some((slugRaw) => {
      const slug = normalizeSbtListStatusSlug(slugRaw);
      if (isSbtListSyntheticNoSessionSlug(slug)) {
        const anySessionLoaded = Object.values(sessionHasLoadedOnceBySlug).some(Boolean);
        if (refreshing) return true;
        if (hasNoSessionCards) return false;
        if (!isSBTCacheReady) return true;
        if (sessionUniverseRegistryPending) return true;
        return !anySessionLoaded;
      }

      const hasLoadedOnce = !!sessionHasLoadedOnceBySlug[slug];
      const listForSlug = sbtListBySlug[slug];
      const hasCards = Array.isArray(listForSlug) && listForSlug.length > 0;
      const loadState = sessionLoadStateBySlug[slug] || 'idle';
      const snapshot = getSessionProgressSnapshot(slug);
      const scanInProgress = !!snapshot?.scanInProgress;
      const deferred = !!snapshot?.deferred;
      const hasKnownLatest = !!snapshot?.hasLatest;
      const blocksRemaining = Number(snapshot?.remainingBlocks || 0);

      if (loadState === 'loading') return true;
      if (refreshing) return true;
      if (!hasCards && !isSBTCacheReady) return true;
      if (
        !hasCards &&
        hasKnownLatest &&
        blocksRemaining > 0 &&
        (!isSBTCacheReady || scanInProgress || deferred || revisionSyncPending)
      )
        return true;
      if (!hasCards && sessionUniverseRegistryPending) return true;
      return !hasLoadedOnce && !hasCards;
    });
  const sectionSessionSearchFlag = slugs.some((slugRaw) => {
    const slug = normalizeSbtListStatusSlug(slugRaw);
    const snapshot = getSessionProgressSnapshot(slug);
    return !!(snapshot?.scanInProgress || snapshot?.deferred);
  });

  return {
    sectionSessionDiscoveryPending,
    sectionSessionSearchFlag,
    shouldKeepSectionSpinnersOn: !!(
      loading ||
      refreshing ||
      revisionSyncPending ||
      sectionSessionDiscoveryPending ||
      sectionSessionSearchFlag
    ),
    refreshButtonBusy: !!(refreshing || sectionSessionDiscoveryPending || sectionSessionSearchFlag),
  };
};

export const resolveSbtListReadinessDisplayPlan = ({
  allSessionsMode = false,
  availableSessionSlugCount = 0,
  displayedFeaturedCount = 0,
  displayedSessionUniverseSlugs = [],
  emptySectionSpinnerActive = false,
  expiredCount = 0,
  initialLoadCompleted = false,
  isSBTCacheReady = false,
  loading = false,
  mintingLiveCount = 0,
  refreshing = false,
  revisionSyncPending = false,
  sectionSessionDiscoveryPending = false,
  sectionSessionSearchFlag = false,
  sessionUniverseRegistryPending = false,
}: ResolveSbtListReadinessDisplayPlanArgs = {}): SbtListReadinessDisplayPlan => {
  const initialLoadingActive = allSessionsMode ? !initialLoadCompleted : !initialLoadCompleted && !isSBTCacheReady;
  const sectionHeaderSpinnerVisible = !!emptySectionSpinnerActive;
  const sectionReadinessPending = !isSBTCacheReady;
  const showSectionBodyLoadingHint = !!(
    sectionHeaderSpinnerVisible ||
    sectionSessionDiscoveryPending ||
    sectionSessionSearchFlag ||
    initialLoadingActive ||
    sectionReadinessPending ||
    revisionSyncPending
  );
  const canShowSectionEmptyState = !!(!showSectionBodyLoadingHint && initialLoadCompleted && isSBTCacheReady);
  const shouldDeferInitialLoaderForUniverse = !!(
    allSessionsMode && countSbtListUniverseSlugs(displayedSessionUniverseSlugs) > 0
  );

  return {
    canShowSectionEmptyState,
    initialLoadingActive,
    sectionHeaderSpinnerVisible,
    sectionReadinessPending,
    shouldDeferInitialLoaderForUniverse,
    showExpiredSectionLoadingHint: normalizeSbtListReadinessCount(expiredCount) === 0 && !canShowSectionEmptyState,
    showFeaturedSectionLoadingHint:
      normalizeSbtListReadinessCount(displayedFeaturedCount) === 0 && !canShowSectionEmptyState,
    showInitialLoader: initialLoadingActive && !shouldDeferInitialLoaderForUniverse,
    showLiveSectionLoadingHint: normalizeSbtListReadinessCount(mintingLiveCount) === 0 && !canShowSectionEmptyState,
    showSectionBodyLoadingHint,
    showUniverseSpinner: !!(
      loading ||
      refreshing ||
      sectionSessionDiscoveryPending ||
      sectionSessionSearchFlag ||
      !isSBTCacheReady ||
      sessionUniverseRegistryPending ||
      normalizeSbtListReadinessCount(availableSessionSlugCount) === 0
    ),
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
    const isLoading =
      loadState === 'loading' || scanInProgress || deferred || !!refreshing || (!hasCacheSnapshot && !hasLoadedOnce);
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
    Number(bridgedLiveProgress?.latestBlock || 0) - Number(bridgedLiveProgress?.currentBlock || 0),
  );
  // Regression guard: after a scan completes, live progress can clear before the
  // cache watermark catches up. Keep only a fresh tail bridge to avoid a false restart.
  const liveProgress =
    liveProgressFromProps ||
    (!scanInProgressRaw &&
    !deferredRaw &&
    bridgedLiveProgress &&
    bridgedAgeMs <= Number(bridgeMs || 0) &&
    bridgedRemainingBlocks <= Number(bridgeTailBlocks || 0) &&
    Number(bridgedLiveProgress.currentBlock || 0) > lastBlock
      ? bridgedLiveProgress
      : null);
  const liveCurrentCandidate = Number(liveProgress?.currentBlock || 0);
  const liveCurrentBlock =
    Number.isFinite(liveCurrentCandidate) && liveCurrentCandidate > 0 ? liveCurrentCandidate : null;
  const liveLatestCandidate = Number(liveProgress?.latestBlock || 0);
  const liveLatestBlock = Number.isFinite(liveLatestCandidate) && liveLatestCandidate > 0 ? liveLatestCandidate : null;
  const cfgRecord = cfg && typeof cfg === 'object' ? cfg : null;
  const blockLimits =
    cfgRecord?.blockLimits && typeof cfgRecord.blockLimits === 'object'
      ? (cfgRecord.blockLimits as SbtListHelperRecord)
      : {};
  const startRaw = Number(blockLimits.start);
  const startBlock = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : null;
  const latestCandidate = Math.max(Number(latestBlock || 0), Number(liveLatestBlock || 0));
  const latestForGroup = Number.isFinite(latestCandidate) && latestCandidate > 0 ? latestCandidate : null;
  const hasLatest = latestForGroup != null && latestForGroup > 0 && startBlock != null;
  const currentBlockBaseline = liveCurrentBlock != null ? Math.max(lastBlock, liveCurrentBlock) : lastBlock;
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
