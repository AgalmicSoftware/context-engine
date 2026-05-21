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
  buildSbtListSessionChipStateBySlug,
  buildSbtListSessionLoadingStatus,
  buildSbtListSessionProgressSnapshot,
} from './sbtListSessionLoadingHelpers';
export type {
  SbtListLiveProgressSnapshot,
  SbtListSessionChipState,
  SbtListSessionChipStateBySlug,
  SbtListSessionLoadingStatus,
  SbtListSessionLoadingStatusSnapshot,
  SbtListSessionProgressSnapshot,
} from './sbtListSessionLoadingHelpers';
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
export {
  isSbtListManagedDgCacheName,
  readSbtListShowDemoSessions,
  readSbtListSyncBarResearchBlockStep,
  readSbtListUniverseCollapsedState,
  readStoredSbtListModeSelectedSessionSlugs,
  resolveSbtListCreateGroupInitialVisibility,
  SBT_LIST_MODE_SELECTION_STORAGE_KEY,
} from './sbtListStorageHelpers';
export type { SbtListStorageReader } from './sbtListStorageHelpers';

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

export const isSbtListHelperRecord = (value: unknown): value is SbtListHelperRecord => (
  !!value && typeof value === 'object'
);

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
