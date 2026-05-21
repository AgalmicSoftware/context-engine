import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { resolveSessionUniverseEntrySlug } from './sbtSessionUniverse.js';
import {
  buildSbtListRenderItemKey,
  coerceSbtMintEndSeconds,
  lowerSbtListAddressSet,
  normalizeSbtListAddressLower,
} from './sbtListCardModelHelpers';
export {
  buildSbtListDisplayCardModel,
  buildSbtListExpandedAddressSetToggle,
  buildSbtListFeaturedCardModel,
  buildSbtListInteractiveMiniCardModel,
  buildSbtListMetaRowModel,
  buildSbtListRenderItemKey,
  coerceSbtMintEndSeconds,
  isModifiedSbtListPointerNavigation,
  lowerSbtListAddressSet,
  normalizeSbtListAddressLower,
} from './sbtListCardModelHelpers';
export type {
  BuildSbtListDisplayCardModelOptions,
  BuildSbtListFeaturedCardModelOptions,
  BuildSbtListInteractiveMiniCardModelOptions,
  BuildSbtListMetaRowModelOptions,
  SbtListDisplayCardAddressMode,
  SbtListDisplayCardModel,
  SbtListFeaturedCardModel,
  SbtListInteractiveMiniCardModel,
  SbtListMetaRowModel,
  SbtListRenderItemKeyOptions,
} from './sbtListCardModelHelpers';
import type {
  SbtListHelperItem,
  SbtListHelperRecord,
} from './sbtListCardDetailsHelpers';
export {
  collectSbtDocumentUrls,
  collectSbtTagValues,
  dedupeCaseInsensitiveStrings,
  getSbtCardDetails,
  normalizeSbtListDocumentHref,
  normalizeSbtListGatewayUri,
  normalizeSbtListTokenUri,
} from './sbtListCardDetailsHelpers';
export type {
  SbtCardDetails,
  SbtListDocumentLink,
  SbtListHelperItem,
  SbtListHelperRecord,
} from './sbtListCardDetailsHelpers';
export {
  buildSbtListExpandedCardShellClassName,
  buildSbtListFilterContainerClassName,
  buildSbtListFilterLabelClassName,
  buildSbtListLoadingGroupStatusClassName,
  buildSbtListLoadingProgressFillClassName,
  buildSbtListMiniSettingsButtonClassName,
  buildSbtListRootClassName,
  buildSbtListSessionUniversePanelClassName,
  findSbtListInteractiveAncestor,
  resolveSbtListHeaderBlocksLeftStyle,
  resolveSbtListHeaderSpinnerWrapStyle,
  resolveSbtListLoadingProgressFillStyle,
  resolveSbtListRelativeImageStyle,
} from './sbtListDisplayHelpers';

export type SbtCacheMetaSnapshot = {
  lastBlock: number;
  sbtCount: number;
};
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
type ResolveSbtListConcreteSessionBindingSlugOptions = {
  getSessionSlugByName?: (sessionName: string) => unknown;
};
type ResolveSbtListItemSessionSlugOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  allSessionsMode?: unknown;
  isListModeScopeEnabled?: unknown;
  listSlug?: unknown;
  resolveConcreteSessionBindingSlug?: (sbt: T | null | undefined) => string | null;
};

export type SbtSessionGroupLists = {
  featured_SBTs_LIST?: unknown;
  ignored_SBTs_LIST?: unknown;
};

export type SbtRenderBuckets<T extends SbtListHelperItem = SbtListHelperItem> = {
  baseFilteredList: T[];
  displayedFeatured: T[];
  expiredList: T[];
  featuredItemKeySet: Set<string>;
  mintingLiveList: T[];
};

export type BuildSbtRenderBucketsOptions<T extends SbtListHelperItem = SbtListHelperItem> = {
  allSessionsMode: boolean;
  excludePasswordLocked: boolean;
  featuredSbtAddresses?: unknown;
  getSessionListsForSlug: (slug: string) => SbtSessionGroupLists;
  ignoredSbtAddressesLower?: readonly string[];
  isListModeScopeEnabled: boolean;
  isMintingLive: (sbt: T) => boolean;
  isPasswordLocked: (sbt: T) => boolean;
  listSlug?: unknown;
  resolveSbtSessionSlug: (sbt: T) => string;
  sbtList?: unknown;
  sectionSessionSlugs?: unknown;
};

export type SbtListSessionUniverseOptions = {
  demoSessionMap?: Record<string, SbtListHelperRecord>;
};

export type SbtListStorageReader = {
  getItem?: (key: string) => string | null;
};

type SbtListCreateFormCacheChecker = (args: {
  clearInvalid: true;
  migrateLegacyToSessionKey: true;
  sessionSlug: string;
}) => boolean;
type ResolveSbtListCreateGroupInitialVisibilityArgs = {
  hasCachedCreateSbtForm?: SbtListCreateFormCacheChecker | null;
  listSlug?: unknown;
};
type ResolveSbtListSectionSessionSlugsArgs = {
  allSessionsMode?: unknown;
  isListModeScopeEnabled?: unknown;
  listSlug?: unknown;
  selectedSessionUniverseSlugs?: unknown;
};
type ResolveSbtListDefaultSelectedSessionSlugsArgs = {
  displayedSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  listModeConfiguredSessionSlugs?: unknown;
};
type ResolveSbtListSelectedSessionUniverseSlugsArgs = {
  allSessionsMode?: unknown;
  defaultListModeSelectedSessionSlugs?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedSessionSlugs?: unknown;
};
type ResolveSbtListDisplayedSessionUniverseSlugsArgs = {
  allSessionsMode?: unknown;
  availableSessionSlugs?: unknown;
  baseSessionUniverseSlugs?: unknown;
  hasNoSessionUniverseItems?: unknown;
  hiddenRegistrySessionSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedHiddenRegistrySessionSlugs?: unknown;
  showMoreSessions?: unknown;
};
type ResolveSbtListHiddenRegistrySessionSlugsArgs = {
  availableSessionSlugs?: unknown;
  baseSessionUniverseSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  registrySessionUniverseSlugs?: unknown;
};
type ResolveSbtListSelectedHiddenRegistrySessionSlugsArgs = {
  hiddenRegistrySessionSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedSessionSlugs?: unknown;
};
type ResolveSbtListRemainingHiddenRegistrySessionSlugsArgs = {
  hiddenRegistrySessionSlugs?: unknown;
  isListModeScopeEnabled?: unknown;
  selectedHiddenRegistrySessionSlugs?: unknown;
};
type ResolveSbtListClampedSelectedSessionSlugsArgs = {
  availableSessionSlugs?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  hiddenRegistrySessionSlugs?: unknown;
  listModeConfiguredSessionSlugs?: unknown;
  registrySessionUniverseSlugs?: unknown;
  selectedSessionSlugs?: unknown;
};
type ResolveSbtListChipSelectedSessionSlugsArgs = {
  defaultListModeSelectedSessionSlugs?: unknown;
  displayedSessionUniverseSlugs?: unknown;
  selectedSessionSlugs?: unknown;
  selectedSlug?: unknown;
  wasSelected?: unknown;
};
type SbtListSessionUniverseSnapshotLike = {
  fallbackEntryCount?: unknown;
  registryEntryCount?: unknown;
  registryHydrated?: unknown;
  slugs?: unknown;
};
type ResolveSbtListSessionUniverseSnapshotUpdateArgs<TPrevious, TNext> = {
  nextSnapshot?: TNext;
  previousSnapshot?: TPrevious;
};

type SbtListSessionUniverseEntryTuple = [unknown, SbtListHelperRecord | undefined];

const SESSION_ID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_ID_HEX_RE = /^0x[0-9a-f]{32}$/i;
const SESSION_ID_COMPACT_RE = /^[0-9a-f]{32}$/i;
export const SBT_LIST_NO_SESSION_UNIVERSE_SLUG = '__no_session__';
export const SBT_LIST_MODE_SELECTION_STORAGE_KEY = 'dg:sbtListModeSelectedSessions';
const SBT_LIST_MANAGED_DG_CACHE_NAMES = new Set<string>([
  'questionsCache',
  'surveysCache',
  'bookmarksCache',
  'filters',
  'sbtCache',
  'userCache',
]);

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

export const isSbtListHelperRecord = (value: unknown): value is SbtListHelperRecord => (
  !!value && typeof value === 'object'
);

const getDefaultSbtListStorage = (): SbtListStorageReader | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (_) {
    return null;
  }
};

const getDefaultSbtListRuntimeGlobal = (): SbtListHelperRecord => {
  try {
    if (typeof globalThis === 'undefined') return {};
    return globalThis as unknown as SbtListHelperRecord;
  } catch (_) {
    return {};
  }
};

export const hasSbtListOwn = (obj: unknown, key: PropertyKey): boolean => (
  isSbtListHelperRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key)
);

export const hasSbtListAuthoritativeSessionSlug = (obj: unknown): boolean => {
  const record = isSbtListHelperRecord(obj) ? obj : {};
  if (!hasSbtListOwn(obj, 'sessionSlug')) return false;
  const hasExplicitFlag = hasSbtListOwn(obj, 'sessionSlugExplicit');
  return record.sessionSlugExplicit === true || !hasExplicitFlag;
};

export const hasSbtListExplicitNoSessionAssociation = (sbt: unknown): boolean => {
  const record = isSbtListHelperRecord(sbt) ? sbt as SbtListHelperItem : {};
  const info = isSbtListHelperRecord(record.sbtInfo) ? record.sbtInfo : {};
  if (hasSbtListAuthoritativeSessionSlug(info)) {
    return String(info.sessionSlug ?? '').trim() === '';
  }
  if (hasSbtListAuthoritativeSessionSlug(record)) {
    return String(record.sessionSlug ?? '').trim() === '';
  }
  return false;
};

export const hasSbtListMetadataSessionSlugField = (sbt: unknown): boolean => {
  const record = isSbtListHelperRecord(sbt) ? sbt as SbtListHelperItem : {};
  return hasSbtListOwn(record.sbtInfo, 'sessionSlug') || hasSbtListOwn(record, 'sessionSlug');
};

export const hasSbtListMissingOrEmptySessionSlug = (sbt: unknown): boolean => {
  const record = isSbtListHelperRecord(sbt) ? sbt as SbtListHelperItem : {};
  const info = isSbtListHelperRecord(record.sbtInfo) ? record.sbtInfo : {};
  if (!hasSbtListMetadataSessionSlugField(record)) return true;
  return String(info.sessionSlug ?? record.sessionSlug ?? '').trim() === '';
};

export const resolveSbtListConcreteSessionBindingSlug = <T extends SbtListHelperItem = SbtListHelperItem>(
  sbt: T | null | undefined,
  {
    getSessionSlugByName = () => null,
  }: ResolveSbtListConcreteSessionBindingSlugOptions = {}
): string | null => {
  const sbtInfo = isSbtListHelperRecord(sbt?.sbtInfo) ? sbt.sbtInfo : {};

  if (hasSbtListAuthoritativeSessionSlug(sbtInfo)) {
    return normalizeSessionSlug(sbtInfo?.sessionSlug || '');
  }
  if (hasSbtListAuthoritativeSessionSlug(sbt)) {
    return normalizeSessionSlug(sbt?.sessionSlug || '');
  }

  const legacySlugRaw = sbtInfo?.slug;
  if (legacySlugRaw != null && String(legacySlugRaw).trim() !== '') {
    return normalizeSessionSlug(legacySlugRaw);
  }

  const hasInferredSessionSlug = (
    (hasSbtListOwn(sbtInfo, 'sessionSlug') && sbtInfo?.sessionSlugExplicit === false) ||
    (hasSbtListOwn(sbt, 'sessionSlug') && sbt?.sessionSlugExplicit === false)
  );
  if (hasInferredSessionSlug) return null;

  const legacySessionName = String(
    sbtInfo?.sessionName ??
    sbt?.sessionName ??
    ''
  ).trim();
  if (!legacySessionName) return null;

  const mappedSlug = getSessionSlugByName(legacySessionName);
  if (mappedSlug == null) return null;
  return normalizeSessionSlug(mappedSlug);
};

export const resolveSbtListItemSessionSlug = <T extends SbtListHelperItem = SbtListHelperItem>(
  sbt: T | null | undefined,
  {
    allSessionsMode = false,
    isListModeScopeEnabled = false,
    listSlug = '',
    resolveConcreteSessionBindingSlug = (item) => resolveSbtListConcreteSessionBindingSlug(item),
  }: ResolveSbtListItemSessionSlugOptions<T> = {}
): string => {
  const sbtInfo = isSbtListHelperRecord(sbt?.sbtInfo) ? sbt.sbtInfo : {};
  const sourceSlug = normalizeSessionSlug(
    sbt?.__sourceSessionSlug ?? sbt?.slug ?? sbt?.sessionSlug ?? ''
  );
  if (allSessionsMode && hasSbtListExplicitNoSessionAssociation(sbt)) {
    return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
  }
  const hasMetadataSessionSlug = (
    hasSbtListOwn(sbtInfo, 'sessionSlug') ||
    hasSbtListOwn(sbt, 'sessionSlug')
  );
  const metadataSessionSlug = hasMetadataSessionSlug
    ? normalizeSessionSlug(sbtInfo?.sessionSlug ?? sbt?.sessionSlug ?? '')
    : null;
  const hasAuthoritativeMetadataSessionSlug = (
    hasSbtListAuthoritativeSessionSlug(sbtInfo) || hasSbtListAuthoritativeSessionSlug(sbt)
  );

  if (allSessionsMode && isListModeScopeEnabled) {
    const concreteBindingSlug = resolveConcreteSessionBindingSlug(sbt);
    if (concreteBindingSlug != null) {
      return concreteBindingSlug === ''
        ? SBT_LIST_NO_SESSION_UNIVERSE_SLUG
        : concreteBindingSlug;
    }
    if (hasSbtListMissingOrEmptySessionSlug(sbt)) {
      return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
    }
    return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
  }
  if (hasSbtListAuthoritativeSessionSlug(sbtInfo)) {
    return normalizeSessionSlug(sbtInfo?.sessionSlug || '');
  }
  if (hasSbtListAuthoritativeSessionSlug(sbt)) {
    return normalizeSessionSlug(sbt?.sessionSlug || '');
  }
  if (
    metadataSessionSlug != null &&
    metadataSessionSlug !== sourceSlug &&
    !hasAuthoritativeMetadataSessionSlug &&
    sourceSlug
  ) {
    return sourceSlug;
  }

  const legacyRaw = (
    sbtInfo?.sessionSlug ??
    sbtInfo?.slug ??
    sbt?.sessionSlug ??
    sbt?.slug
  );
  if (legacyRaw != null && String(legacyRaw).trim() !== '') {
    return normalizeSessionSlug(legacyRaw);
  }
  if (allSessionsMode) return SBT_LIST_NO_SESSION_UNIVERSE_SLUG;
  return normalizeSessionSlug(listSlug || '');
};

export const isSbtListManagedDgCacheName = (name: unknown): boolean => (
  SBT_LIST_MANAGED_DG_CACHE_NAMES.has(String(name || ''))
);

export const readStoredSbtListModeSelectedSessionSlugs = (
  storage?: SbtListStorageReader | null
): string[] => {
  try {
    const resolvedStorage = typeof storage === 'undefined' ? getDefaultSbtListStorage() : storage;
    if (!resolvedStorage?.getItem) return [];
    const raw = resolvedStorage.getItem(SBT_LIST_MODE_SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return dedupeNormalizedSbtListSlugs(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return [];
  }
};

export const resolveSbtListCreateGroupInitialVisibility = ({
  hasCachedCreateSbtForm = null,
  listSlug = '',
}: ResolveSbtListCreateGroupInitialVisibilityArgs = {}): boolean => (
  typeof hasCachedCreateSbtForm === 'function'
    ? hasCachedCreateSbtForm({
      sessionSlug: normalizeSessionSlug(listSlug || ''),
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    })
    : false
);

export const readSbtListUniverseCollapsedState = (
  storage?: SbtListStorageReader | null
): boolean => {
  try {
    const resolvedStorage = typeof storage === 'undefined' ? getDefaultSbtListStorage() : storage;
    return resolvedStorage?.getItem?.('dg:sbtUniverseCollapsed') === 'true';
  } catch (_) {
    return false;
  }
};

export const readSbtListShowDemoSessions = (
  runtimeGlobal = getDefaultSbtListRuntimeGlobal(),
  fallback: unknown = SHOW_DEMO_SESSIONS
): boolean => {
  try {
    if (
      isSbtListHelperRecord(runtimeGlobal) &&
      typeof runtimeGlobal.SHOW_DEMO_SESSIONS !== 'undefined'
    ) {
      return !!runtimeGlobal.SHOW_DEMO_SESSIONS;
    }
  } catch (e) { void e; /* fallback: demo visibility lookup. */ }
  return !!fallback;
};

export const readSbtListSyncBarResearchBlockStep = (
  runtimeGlobal = getDefaultSbtListRuntimeGlobal(),
  fallback: unknown = CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP
): number => {
  try {
    if (
      isSbtListHelperRecord(runtimeGlobal) &&
      typeof runtimeGlobal.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP !== 'undefined'
    ) {
      const runtimeValue = Number(runtimeGlobal.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP);
      if (Number.isFinite(runtimeValue) && runtimeValue > 0) {
        return Math.max(1, Math.floor(runtimeValue));
      }
    }
  } catch (e) { void e; /* fallback: sync-bar research step lookup. */ }

  const defaultValue = Number(fallback || 0);
  if (Number.isFinite(defaultValue) && defaultValue > 0) {
    return Math.max(1, Math.floor(defaultValue));
  }
  return 50;
};

export const isSbtListSessionIdLikeSlug = (raw: unknown): boolean => {
  const value = String(raw || '').trim();
  if (!value) return false;
  return (
    SESSION_ID_UUID_RE.test(value) ||
    SESSION_ID_HEX_RE.test(value) ||
    SESSION_ID_COMPACT_RE.test(value)
  );
};

export const isSbtListSyntheticNoSessionSlug = (slugIn: unknown): boolean => (
  normalizeSessionSlug(slugIn || '') === SBT_LIST_NO_SESSION_UNIVERSE_SLUG
);

export const getVisibleSbtListSessionSlugsFromEntries = (
  entries: unknown = [],
  options: SbtListSessionUniverseOptions = {}
): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(entries) ? entries : []).forEach((entry: unknown) => {
    const [key, cfg] = (
      Array.isArray(entry) ? entry : [undefined, undefined]
    ) as SbtListSessionUniverseEntryTuple;
    const rawSlug = (typeof cfg?.slug === 'string' ? cfg.slug : key) || '';
    const trimmed = String(rawSlug || '').trim();
    const candidate = resolveSessionUniverseEntrySlug(entry, {
      demoSessionMap: options.demoSessionMap,
    });
    const isGeneral = candidate === '';
    if (!isGeneral && !candidate) return;
    const idCheckValue = candidate || trimmed;
    if (isSbtListSessionIdLikeSlug(idCheckValue)) return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    out.push(candidate);
  });
  return out;
};

export const areStringArraysEqual = (a: unknown = [], b: unknown = []): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i]) !== String(b[i])) return false;
  }
  return true;
};

export const dedupeNormalizedSbtListSlugs = (list: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(list) ? list : []).forEach((raw: unknown) => {
    const slug = normalizeSessionSlug(raw);
    if (isSbtListSessionIdLikeSlug(slug || raw)) return;
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

export const pickNormalizedSbtListSessionSlug = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return '';
};

export const mergeSbtListsByAddress = (...lists: unknown[]): SbtListHelperItem[] => {
  const out: SbtListHelperItem[] = [];
  const seen = new Set<string>();
  lists.forEach((list: unknown) => {
    (Array.isArray(list) ? list : []).forEach((item: unknown) => {
      const record = isSbtListHelperRecord(item) ? item as SbtListHelperItem : null;
      if (!record) return;
      const addrLower = String(record.sbtAddress || '').trim().toLowerCase();
      if (!addrLower || seen.has(addrLower)) return;
      seen.add(addrLower);
      out.push(record);
    });
  });
  return out;
};

export const sortSbtListSlugsByUniverseOrder = (
  slugs: unknown = [],
  universeSlugs: unknown = []
): string[] => {
  const normalizedUniverse = dedupeNormalizedSbtListSlugs(universeSlugs);
  const order = new Map<string, number>();
  normalizedUniverse.forEach((slug: string, index: number) => {
    order.set(normalizeSessionSlug(slug), index);
  });
  return dedupeNormalizedSbtListSlugs(slugs).sort((aRaw: string, bRaw: string) => {
    const a = normalizeSessionSlug(aRaw);
    const b = normalizeSessionSlug(bRaw);
    const aOrder = order.has(a) ? order.get(a) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const bOrder = order.has(b) ? order.get(b) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
};

export const resolveSbtListSectionSessionSlugs = ({
  allSessionsMode = false,
  isListModeScopeEnabled = false,
  listSlug = '',
  selectedSessionUniverseSlugs = [],
}: ResolveSbtListSectionSessionSlugsArgs = {}): string[] => {
  if (!allSessionsMode) return [normalizeSessionSlug(listSlug || '')];
  if (isListModeScopeEnabled) {
    return Array.isArray(selectedSessionUniverseSlugs)
      ? selectedSessionUniverseSlugs
      : [];
  }
  return [normalizeSessionSlug(listSlug || '')];
};

export const resolveSbtListActionableSessionSlugs = (slugs: unknown = []): string[] => (
  dedupeNormalizedSbtListSlugs(slugs).filter(
    (slug: unknown) => !isSbtListSyntheticNoSessionSlug(slug)
  )
);

export const resolveSbtListSessionUniverseSnapshotUpdate = <
  TPrevious = unknown,
  TNext = unknown
>({
  nextSnapshot,
  previousSnapshot,
}: ResolveSbtListSessionUniverseSnapshotUpdateArgs<TPrevious, TNext> = {}): TPrevious | TNext | undefined => {
  const prev = (previousSnapshot && typeof previousSnapshot === 'object')
    ? previousSnapshot as SbtListSessionUniverseSnapshotLike
    : {};
  const next = (nextSnapshot && typeof nextSnapshot === 'object')
    ? nextSnapshot as SbtListSessionUniverseSnapshotLike
    : {};
  const prevSlugs = Array.isArray(prev.slugs) ? prev.slugs : [];
  const nextSlugs = Array.isArray(next.slugs) ? next.slugs : [];
  const prevRegistryCount = Number(prev.registryEntryCount || 0);
  const nextRegistryCount = Number(next.registryEntryCount || 0);
  const prevFallbackCount = Number(prev.fallbackEntryCount || 0);
  const nextFallbackCount = Number(next.fallbackEntryCount || 0);
  const prevHydrated = !!prev.registryHydrated;
  const nextHydrated = !!next.registryHydrated;
  if (
    prevRegistryCount === nextRegistryCount &&
    prevFallbackCount === nextFallbackCount &&
    prevHydrated === nextHydrated &&
    areStringArraysEqual(prevSlugs, nextSlugs)
  ) {
    return previousSnapshot;
  }
  return nextSnapshot;
};

export const resolveSbtListDefaultSelectedSessionSlugs = ({
  displayedSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  listModeConfiguredSessionSlugs = [],
}: ResolveSbtListDefaultSelectedSessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const displayedSlugs = dedupeNormalizedSbtListSlugs(displayedSessionUniverseSlugs);
  const displayedSet = new Set(displayedSlugs);
  const configured = dedupeNormalizedSbtListSlugs(listModeConfiguredSessionSlugs)
    .filter((slug) => displayedSet.has(slug));
  if (configured.length > 0) {
    return sortSbtListSlugsByUniverseOrder(configured, displayedSlugs);
  }
  const fallbackWithoutNoSession = displayedSlugs.filter(
    (slug) => !isSbtListSyntheticNoSessionSlug(slug)
  );
  const fallbackSelection = fallbackWithoutNoSession.length > 0
    ? fallbackWithoutNoSession
    : displayedSlugs;
  return sortSbtListSlugsByUniverseOrder(fallbackSelection, displayedSlugs);
};

export const resolveSbtListSelectedSessionUniverseSlugs = ({
  allSessionsMode = false,
  defaultListModeSelectedSessionSlugs = [],
  displayedSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  selectedSessionSlugs = [],
}: ResolveSbtListSelectedSessionUniverseSlugsArgs = {}): string[] => {
  if (!allSessionsMode || !isListModeScopeEnabled) return [];
  const displayedSlugs = dedupeNormalizedSbtListSlugs(displayedSessionUniverseSlugs);
  const displayedSet = new Set(displayedSlugs);
  const userSelected = dedupeNormalizedSbtListSlugs(selectedSessionSlugs)
    .filter((slug) => displayedSet.has(slug));
  if (userSelected.length > 0) {
    return sortSbtListSlugsByUniverseOrder(userSelected, displayedSlugs);
  }
  return Array.isArray(defaultListModeSelectedSessionSlugs)
    ? defaultListModeSelectedSessionSlugs
    : [];
};

export const resolveSbtListDisplayedSessionUniverseSlugs = ({
  allSessionsMode = false,
  availableSessionSlugs = [],
  baseSessionUniverseSlugs = [],
  hasNoSessionUniverseItems = false,
  hiddenRegistrySessionSlugs = [],
  isListModeScopeEnabled = false,
  selectedHiddenRegistrySessionSlugs = [],
  showMoreSessions = false,
}: ResolveSbtListDisplayedSessionUniverseSlugsArgs = {}): string[] => {
  const expandedHiddenSlugs = !isListModeScopeEnabled
    ? []
    : dedupeNormalizedSbtListSlugs([
      ...(showMoreSessions && Array.isArray(hiddenRegistrySessionSlugs) ? hiddenRegistrySessionSlugs : []),
      ...(Array.isArray(selectedHiddenRegistrySessionSlugs) ? selectedHiddenRegistrySessionSlugs : []),
    ]);
  const baseUniverse = !isListModeScopeEnabled
    ? (Array.isArray(availableSessionSlugs) ? availableSessionSlugs : [])
    : dedupeNormalizedSbtListSlugs([
      ...(Array.isArray(baseSessionUniverseSlugs) ? baseSessionUniverseSlugs : []),
      ...expandedHiddenSlugs,
    ]);
  if (!allSessionsMode || !hasNoSessionUniverseItems) return baseUniverse;
  return dedupeNormalizedSbtListSlugs([...baseUniverse, SBT_LIST_NO_SESSION_UNIVERSE_SLUG]);
};

export const resolveSbtListHiddenRegistrySessionSlugs = ({
  availableSessionSlugs = [],
  baseSessionUniverseSlugs = [],
  isListModeScopeEnabled = false,
  registrySessionUniverseSlugs = [],
}: ResolveSbtListHiddenRegistrySessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const baseSet = new Set(
    (Array.isArray(baseSessionUniverseSlugs) ? baseSessionUniverseSlugs : [])
      .map((slug) => normalizeSessionSlug(slug))
  );
  const discoverable = dedupeNormalizedSbtListSlugs([
    ...(Array.isArray(availableSessionSlugs) ? availableSessionSlugs : []),
    ...(Array.isArray(registrySessionUniverseSlugs) ? registrySessionUniverseSlugs : []),
  ]);
  return discoverable.filter((slug) => !baseSet.has(normalizeSessionSlug(slug)));
};

export const resolveSbtListSelectedHiddenRegistrySessionSlugs = ({
  hiddenRegistrySessionSlugs = [],
  isListModeScopeEnabled = false,
  selectedSessionSlugs = [],
}: ResolveSbtListSelectedHiddenRegistrySessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const hiddenSet = new Set(dedupeNormalizedSbtListSlugs(hiddenRegistrySessionSlugs));
  return dedupeNormalizedSbtListSlugs(selectedSessionSlugs)
    .filter((slug) => hiddenSet.has(normalizeSessionSlug(slug)));
};

export const resolveSbtListRemainingHiddenRegistrySessionSlugs = ({
  hiddenRegistrySessionSlugs = [],
  isListModeScopeEnabled = false,
  selectedHiddenRegistrySessionSlugs = [],
}: ResolveSbtListRemainingHiddenRegistrySessionSlugsArgs = {}): string[] => {
  if (!isListModeScopeEnabled) return [];
  const selectedSet = new Set(
    (Array.isArray(selectedHiddenRegistrySessionSlugs) ? selectedHiddenRegistrySessionSlugs : [])
      .map((slug) => normalizeSessionSlug(slug))
  );
  return dedupeNormalizedSbtListSlugs(hiddenRegistrySessionSlugs)
    .filter((slug) => !selectedSet.has(normalizeSessionSlug(slug)));
};

export const resolveSbtListClampedSelectedSessionSlugs = ({
  availableSessionSlugs = [],
  displayedSessionUniverseSlugs = [],
  hiddenRegistrySessionSlugs = [],
  listModeConfiguredSessionSlugs = [],
  registrySessionUniverseSlugs = [],
  selectedSessionSlugs = [],
}: ResolveSbtListClampedSelectedSessionSlugsArgs = {}): string[] => {
  const selected = (Array.isArray(selectedSessionSlugs) ? selectedSessionSlugs : []) as string[];
  const discoverableSet = new Set(dedupeNormalizedSbtListSlugs([
    ...(Array.isArray(displayedSessionUniverseSlugs) ? displayedSessionUniverseSlugs : []),
    ...(Array.isArray(availableSessionSlugs) ? availableSessionSlugs : []),
    ...(Array.isArray(registrySessionUniverseSlugs) ? registrySessionUniverseSlugs : []),
    ...(Array.isArray(hiddenRegistrySessionSlugs) ? hiddenRegistrySessionSlugs : []),
    ...(Array.isArray(listModeConfiguredSessionSlugs) ? listModeConfiguredSessionSlugs : []),
  ]));
  const normalized = dedupeNormalizedSbtListSlugs(selected);
  const clamped = normalized.filter((slug) => discoverableSet.has(slug));
  return areStringArraysEqual(normalized, clamped) ? selected : clamped;
};

export const resolveSbtListChipSelectedSessionSlugs = ({
  defaultListModeSelectedSessionSlugs = [],
  displayedSessionUniverseSlugs = [],
  selectedSessionSlugs = [],
  selectedSlug = '',
  wasSelected = false,
}: ResolveSbtListChipSelectedSessionSlugsArgs = {}): string[] => {
  const normalized = normalizeSessionSlug(selectedSlug || '');
  const displayedSlugs = dedupeNormalizedSbtListSlugs(displayedSessionUniverseSlugs);
  const displayedSet = new Set(displayedSlugs);
  const normalizedPrev = dedupeNormalizedSbtListSlugs(selectedSessionSlugs)
    .filter((slug) => displayedSet.has(slug));
  const effectivePrev = normalizedPrev.length > 0
    ? normalizedPrev
    : dedupeNormalizedSbtListSlugs(defaultListModeSelectedSessionSlugs);
  if (wasSelected) {
    const next = effectivePrev.filter((slug) => slug !== normalized);
    const clamped = next.length > 0 ? next : [normalized];
    return sortSbtListSlugsByUniverseOrder(clamped, displayedSlugs);
  }
  return sortSbtListSlugsByUniverseOrder(
    [...effectivePrev, normalized],
    displayedSlugs
  );
};

export const buildSbtListDetailHref = (
  sbtAddress: unknown,
  sessionSlug: unknown = ''
): string => (
  buildSbtDetailPath(
    sbtAddress,
    isSbtListSyntheticNoSessionSlug(sessionSlug) ? '' : String(sessionSlug || '')
  )
);

const readSbtSessionGroupLists = (
  slug: string,
  getSessionListsForSlug: BuildSbtRenderBucketsOptions['getSessionListsForSlug']
): SbtSessionGroupLists => (
  isSbtListSyntheticNoSessionSlug(slug)
    ? { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] }
    : getSessionListsForSlug(slug)
);

export const buildSbtListRenderBuckets = <T extends SbtListHelperItem>({
  allSessionsMode,
  excludePasswordLocked,
  featuredSbtAddresses = [],
  getSessionListsForSlug,
  ignoredSbtAddressesLower = [],
  isListModeScopeEnabled,
  isMintingLive,
  isPasswordLocked,
  listSlug = '',
  resolveSbtSessionSlug,
  sbtList = [],
  sectionSessionSlugs = [],
}: BuildSbtRenderBucketsOptions<T>): SbtRenderBuckets<T> => {
  const base: T[] = [];
  const live: T[] = [];
  const expired: T[] = [];
  const featuredSet = new Set<string>();
  const baseKeySet = new Set<string>();
  const byAddrSingle = new Map<string, T>();
  const featuredLowerSingle = lowerSbtListAddressSet(featuredSbtAddresses);
  const featuredAllGroups: T[] = [];
  const activeSessionSlug = normalizeSessionSlug(listSlug || '');
  const selectedSessionSet = new Set<string>(
    (Array.isArray(sectionSessionSlugs) ? sectionSessionSlugs : [])
      .map((slug: unknown) => normalizeSessionSlug(slug || ''))
  );
  const keyOptions = { allSessionsMode, listSlug, resolveSbtSessionSlug };

  (Array.isArray(sbtList) ? sbtList : []).forEach((candidate: unknown) => {
    const sbt = isSbtListHelperRecord(candidate) ? candidate as T : null;
    if (!sbt?.sbtInfo || !sbt?.sbtAddress) return;
    const addrLower = normalizeSbtListAddressLower(sbt.sbtAddress);
    if (!addrLower) return;
    if (!byAddrSingle.has(addrLower)) byAddrSingle.set(addrLower, sbt);

    let isFeaturedForItem = false;
    if (!allSessionsMode) {
      if (ignoredSbtAddressesLower.includes(addrLower)) return;
      isFeaturedForItem = featuredLowerSingle.has(addrLower);
      if (sbt.sbtInfo.unlisted && !isFeaturedForItem) return;
    } else {
      const itemSlug = resolveSbtSessionSlug(sbt);
      if (isListModeScopeEnabled) {
        if (selectedSessionSet.size > 0 && !selectedSessionSet.has(itemSlug)) return;
      } else if (itemSlug !== activeSessionSlug) {
        return;
      }
      const lists = readSbtSessionGroupLists(itemSlug, getSessionListsForSlug);
      const ignoredSet = lowerSbtListAddressSet(lists.ignored_SBTs_LIST);
      if (ignoredSet.has(addrLower)) return;
      isFeaturedForItem = lowerSbtListAddressSet(lists.featured_SBTs_LIST).has(addrLower);
      if (sbt.sbtInfo.unlisted && !isFeaturedForItem) return;
    }

    if (excludePasswordLocked && isPasswordLocked(sbt)) return;

    const itemKey = buildSbtListRenderItemKey(sbt, keyOptions);
    base.push(sbt);
    baseKeySet.add(itemKey);
    if (isMintingLive(sbt)) live.push(sbt);
    else expired.push(sbt);

    if (isFeaturedForItem) {
      featuredSet.add(itemKey);
      if (allSessionsMode) featuredAllGroups.push(sbt);
    }
  });

  let featured: T[] = [];
  if (allSessionsMode) {
    featured = featuredAllGroups;
  } else {
    const seen = new Set<string>();
    featured = (Array.isArray(featuredSbtAddresses) ? featuredSbtAddresses : [])
      .map((addr: unknown): T | null => {
        const addrLower = normalizeSbtListAddressLower(addr);
        if (!addrLower) return null;
        if (seen.has(addrLower)) return null;
        seen.add(addrLower);
        return byAddrSingle.get(addrLower) || null;
      })
      .filter((sbt: T | null): sbt is T => {
        if (!sbt) return false;
        const itemKey = buildSbtListRenderItemKey(sbt, keyOptions);
        if (!baseKeySet.has(itemKey)) return false;
        featuredSet.add(itemKey);
        return true;
      });
  }

  return {
    baseFilteredList: base,
    mintingLiveList: live,
    expiredList: expired,
    displayedFeatured: featured,
    featuredItemKeySet: featuredSet,
  };
};

export const readSbtListCacheMetaSnapshot = (
  slug: unknown,
  netKey: unknown
): SbtCacheMetaSnapshot | null => {
  if (!netKey) return null;
  try {
    const cache = peekCacheSync('sbtCache', String(slug || ''), { clone: false });
    if (!isSbtListHelperRecord(cache)) return null;
    const netCache: SbtListHelperRecord = isSbtListHelperRecord(cache[String(netKey)])
      ? cache[String(netKey)] as SbtListHelperRecord
      : {};
    return {
      lastBlock: Number(netCache.lastBlock || 0),
      sbtCount: Object.keys(isSbtListHelperRecord(netCache.sbtList) ? netCache.sbtList : {}).length
    };
  } catch (_) {
    return null;
  }
};

export const getSbtListNetHolderCount = (item: unknown = {}): number => {
  const record = isSbtListHelperRecord(item) ? item as SbtListHelperItem : {};
  const summaryCount = Number(record.historySummary?.currentHolderCount);
  if (Number.isFinite(summaryCount) && summaryCount >= 0) {
    return Math.floor(summaryCount);
  }
  return Math.max(
    0,
    Number(Array.isArray(record.mintedAddresses) ? record.mintedAddresses.length : 0) -
      Number(Array.isArray(record.burnedAddresses) ? record.burnedAddresses.length : 0)
  );
};

export const normalizeSbtListItems = (items: unknown = []): SbtListHelperItem[] => (
  (Array.isArray(items) ? items : [])
    .filter((item: unknown): item is SbtListHelperItem => {
      const record = isSbtListHelperRecord(item) ? item as SbtListHelperItem : null;
      return !!(record && record.sbtAddress && record.sbtInfo);
    })
    .sort((a: SbtListHelperItem, b: SbtListHelperItem) => {
      const netA = getSbtListNetHolderCount(a);
      const netB = getSbtListNetHolderCount(b);
      if (netB !== netA) return netB - netA;
      const addrA = String(a.sbtAddress || '').toLowerCase();
      const addrB = String(b.sbtAddress || '').toLowerCase();
      return addrA.localeCompare(addrB);
    })
);

export const getSbtListComparableText = (value: unknown): string => String(value ?? '').trim();

export const getSbtListItemSignature = (item: unknown = {}): string => {
  const record = isSbtListHelperRecord(item) ? item as SbtListHelperItem : {};
  const info = isSbtListHelperRecord(record.sbtInfo) ? record.sbtInfo : {};
  return [
    String(record.sbtAddress || '').toLowerCase(),
    normalizeSessionSlug(record.slug || ''),
    Number(record.blockNumber || 0),
    Number(getSbtListNetHolderCount(record)),
    String(record.historySummary?.historicalHolderCount || ''),
    normalizeSessionSlug(info.sessionSlug ?? record.sessionSlug ?? ''),
    getSbtListComparableText(info.name),
    getSbtListComparableText(info.title),
    getSbtListComparableText(info.description),
    getSbtListComparableText(info.image),
    getSbtListComparableText(info.tokenURI ?? info.tokenUri),
  ].join('|');
};

export const areSbtListArraysEqual = (a: unknown = [], b: unknown = []): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (getSbtListItemSignature(a[i]) !== getSbtListItemSignature(b[i])) return false;
  }
  return true;
};
