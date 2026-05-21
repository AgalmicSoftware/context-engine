import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import {
  buildSbtListRenderItemKey,
  coerceSbtMintEndSeconds,
  lowerSbtListAddressSet,
  normalizeSbtListAddressLower,
} from './sbtListCardModelHelpers';
import {
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
  isSbtListSyntheticNoSessionSlug,
} from './sbtListSessionUniverseHelpers';
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
export {
  areSbtListArraysEqual,
  getSbtListComparableText,
  getSbtListItemSignature,
  getSbtListNetHolderCount,
  normalizeSbtListItems,
  readSbtListCacheMetaSnapshot,
} from './sbtListItemNormalizationHelpers';
export type { SbtCacheMetaSnapshot } from './sbtListItemNormalizationHelpers';
import type {
  SbtListHelperItem,
  SbtListHelperRecord,
} from './sbtListCardDetailsHelpers';
import type { SbtCacheMetaSnapshot } from './sbtListItemNormalizationHelpers';
import type { SbtSessionGroupLists } from './sbtListSessionUniverseHelpers';
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
  areStringArraysEqual,
  dedupeNormalizedSbtListSlugs,
  getVisibleSbtListSessionSlugsFromEntries,
  isSbtListSessionIdLikeSlug,
  isSbtListSyntheticNoSessionSlug,
  mergeSbtListsByAddress,
  pickNormalizedSbtListSessionSlug,
  resolveSbtListActionableSessionSlugs,
  resolveSbtListChipSelectedSessionSlugs,
  resolveSbtListClampedSelectedSessionSlugs,
  resolveSbtListDefaultSelectedSessionSlugs,
  resolveSbtListDisplayedSessionUniverseSlugs,
  resolveSbtListHiddenRegistrySessionSlugs,
  resolveSbtListRemainingHiddenRegistrySessionSlugs,
  resolveSbtListSelectedHiddenRegistrySessionSlugs,
  resolveSbtListSelectedSessionUniverseSlugs,
  resolveSbtListSectionSessionSlugs,
  resolveSbtListSessionUniverseSnapshotUpdate,
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
  sortSbtListSlugsByUniverseOrder,
} from './sbtListSessionUniverseHelpers';
export type {
  SbtListSessionUniverseOptions,
  SbtSessionGroupLists,
} from './sbtListSessionUniverseHelpers';
export {
  buildSbtListExpandedCardShellClassName,
  buildSbtListFilterContainerClassName,
  buildSbtListFilterLabelClassName,
  buildSbtListLoadingGroupStatusClassName,
  buildSbtListLoadingProgressFillClassName,
  buildSbtListMiniSettingsButtonClassName,
  buildSbtListRootClassName,
  buildSbtListSessionUniversePanelClassName,
  resolveSbtListHeaderBlocksLeftStyle,
  resolveSbtListHeaderSpinnerWrapStyle,
  resolveSbtListLoadingProgressFillStyle,
  resolveSbtListRelativeImageStyle,
} from './sbtListDisplayHelpers';

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
