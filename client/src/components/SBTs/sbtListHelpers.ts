import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import {
  buildSbtListRenderItemKey,
  coerceSbtMintEndSeconds,
  lowerSbtListAddressSet,
  normalizeSbtListAddressLower,
} from './sbtListCardModelHelpers';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';
import { isSbtListHelperRecord } from './sbtListSessionBindingHelpers';
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
import type { SbtListHelperItem } from './sbtListCardDetailsHelpers';
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
  findSbtListInteractiveAncestor,
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
export {
  hasSbtListAuthoritativeSessionSlug,
  hasSbtListExplicitNoSessionAssociation,
  hasSbtListMetadataSessionSlugField,
  hasSbtListMissingOrEmptySessionSlug,
  hasSbtListOwn,
  isSbtListHelperRecord,
  resolveSbtListConcreteSessionBindingSlug,
  resolveSbtListItemSessionSlug,
} from './sbtListSessionBindingHelpers';

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
