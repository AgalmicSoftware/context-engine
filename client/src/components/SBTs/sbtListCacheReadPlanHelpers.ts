import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import type { SbtListHelperItem, SbtListHelperRecord } from './sbtListCardDetailsHelpers';
import { normalizeSbtListItems, type SbtCacheMetaSnapshot } from './sbtListItemNormalizationHelpers';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export type SbtListCacheReadPlan = {
  hasCacheRecord: boolean;
  hasNetworkCacheEntry: boolean;
  hydrated: SbtListHelperItem[];
  meta: SbtCacheMetaSnapshot;
  netKey: string;
  passwordFlagItems: SbtListHelperItem[];
  shouldApplyCards: boolean;
  shouldEnsurePasswordFlags: boolean;
  shouldKeepExistingCards: boolean;
  targetSlug: string;
};

type BuildSbtListCacheReadPlanArgs = {
  currentItems?: unknown;
  forceRefresh?: unknown;
  hasLoadedBefore?: unknown;
  netKey?: unknown;
  rawCache?: unknown;
  targetSlug?: unknown;
};

const isSbtListCacheRecord = (value: unknown): value is SbtListHelperRecord => !!value && typeof value === 'object';

export const buildSbtListCacheReadPlan = ({
  currentItems = [],
  forceRefresh = false,
  hasLoadedBefore = false,
  netKey = '',
  rawCache = null,
  targetSlug: targetSlugIn = '',
}: BuildSbtListCacheReadPlanArgs = {}): SbtListCacheReadPlan => {
  const targetSlug = normalizeSessionSlug(targetSlugIn || '');
  const normalizedNetKey = isSbtListSyntheticNoSessionSlug(targetSlug) ? '' : String(netKey || '');
  const cacheRecord = isSbtListCacheRecord(rawCache) ? rawCache : {};
  const hasCacheRecord = isSbtListCacheRecord(rawCache);
  const networkNode = normalizedNetKey ? cacheRecord[normalizedNetKey] : undefined;
  const hasNetworkCacheEntry = networkNode != null;
  const networkCache = isSbtListCacheRecord(networkNode) ? networkNode : {};
  const sbtList = isSbtListCacheRecord(networkCache.sbtList) ? networkCache.sbtList : {};
  const hydrated = normalizeSbtListItems(Object.values(sbtList));
  const existingItems = Array.isArray(currentItems) ? currentItems : [];
  const shouldKeepExistingCards =
    hydrated.length === 0 && !forceRefresh && !!hasLoadedBefore && existingItems.length > 0;
  const passwordFlagItems = hydrated.map((item) => (item.slug == null ? { ...item, slug: targetSlug } : item));

  return {
    hasCacheRecord,
    hasNetworkCacheEntry,
    hydrated,
    meta: {
      lastBlock: Number(networkCache.lastBlock || 0),
      sbtCount: hydrated.length,
    },
    netKey: normalizedNetKey,
    passwordFlagItems,
    shouldApplyCards: !shouldKeepExistingCards,
    shouldEnsurePasswordFlags: hydrated.length > 0,
    shouldKeepExistingCards,
    targetSlug,
  };
};
