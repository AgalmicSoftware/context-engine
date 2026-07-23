import { ethers } from 'ethers';
import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import { getSbtMaskedFieldValue, hasSbtDisplayName, isSbtFieldLocked } from '../../utilities/sbt/sbtDisplayNames.js';
import {
  canRetryNameLookup as canRetryNameLookupImpl,
  clearNameLookupFailure as clearNameLookupFailureImpl,
  ensureNameLookupState as ensureNameLookupStateImpl,
  markNameLookupFailure as markNameLookupFailureImpl,
} from './sbtSelectorNameLookupHelpers';
import type { SbtNameLookupState } from './sbtSelectorNameLookupHelpers';
import { buildSbtSelectorListScopeTargetSlugSet, normalizeDiscoverySlugs } from './sbtSelectorScopeHelpers';
import type { SbtSelectorDiscoverySlugOptions } from './sbtSelectorScopeHelpers';
import { buildSbtLookupKey, normalizeChainValue } from './sbtSelectorSessionRuntimeHelpers';
import { getSelectableSbtKey, normalizeSelectableSbtAddress } from './sbtSelectorSelectionKeyHelpers';
import {
  buildScopedSbtIgnoreKey,
  hasOwn,
  pickNormalizedSessionSlug,
  pickOptionalNormalizedSessionSlug,
  resolveAuthoritativeSbtSessionBindingSlug,
  resolveConcreteSbtSessionBindingSlug,
  resolveDeclaredSbtSessionSlug,
} from './sbtSelectorSessionBindingHelpers';
import {
  decorateScopedSbtEntry,
  mergeScopedSbtEntry,
  resolveSbtEntryChainId,
} from './sbtSelectorScopedEntryMergeHelpers';
import type { SbtSelectorScopedEntry } from './sbtSelectorScopedEntryMergeHelpers';
export {
  isSbtSelectorForcedDebugEnabled,
  readBoolishDebugFlag,
  resolveSbtSelectorUpdateEffects,
  resolveSbtSelectorUpdateSignals,
  SBT_SELECTOR_DEBUG_QUERY_KEY,
  SBT_SELECTOR_DEBUG_STORAGE_KEY,
  shouldAutoSearchOtherSbtSelectorSessions,
} from './sbtSelectorRuntimeHelpers';
export type { SbtSelectorUpdateEffects, SbtSelectorUpdateSignals } from './sbtSelectorRuntimeHelpers';
export {
  buildSelectedSbtHydrationAddresses,
  buildSelectedSbtHydrationSignature,
  resolveSbtSelectorLoadOptionsRequestDecision,
  resolveSbtSelectorTargetedHydrationDecision,
} from './sbtSelectorHydrationRequestHelpers';
export type {
  BuildSelectedSbtHydrationSignatureArgs,
  ResolveSbtSelectorLoadOptionsRequestDecisionArgs,
  ResolveSbtSelectorTargetedHydrationDecisionArgs,
  SbtSelectorLoadOptionsRequestDecision,
  SbtSelectorTargetedHydrationDecision,
} from './sbtSelectorHydrationRequestHelpers';
export {
  buildSbtSelectorAutoSearchSessionOptions,
  buildSbtSelectorGroupOptions,
  buildSbtSelectorListScopeTargetSlugSet,
  getNormalizedDiscoveryOverride,
  normalizeDiscoverySlugs,
  resolveDirectSbtSelectorTargetSlugs,
  resolvePropSessionSlug,
  resolveSbtSelectorDisplayLookupSessionConfig,
  resolveSbtSelectorEffectiveSessionSlug,
  resolveSbtSelectorScopeMode,
  resolveSbtSelectorTargetSlugs,
  shouldUsePropsSbtSelectorSessionConfigForSlug,
  shouldWarmSbtSelectorRegistryCacheForTargets,
} from './sbtSelectorScopeHelpers';
export type {
  BuildSbtSelectorAutoSearchSessionOptionsArgs,
  BuildSbtSelectorGroupOptionsArgs,
  ResolveDirectSbtSelectorTargetSlugsArgs,
  ResolveSbtSelectorDisplayLookupSessionConfigArgs,
  ResolveSbtSelectorEffectiveSessionSlugArgs,
  ResolveSbtSelectorScopeModeArgs,
  ResolveSbtSelectorTargetSlugsArgs,
  SbtSelectorDiscoverySlugOptions,
  SbtSelectorGroupOption,
  ShouldUsePropsSbtSelectorSessionConfigArgs,
  ShouldWarmSbtSelectorRegistryCacheArgs,
} from './sbtSelectorScopeHelpers';
export {
  buildFeaturedEntrySignature,
  buildSessionConfigSig,
  buildSessionSlugSignature,
  buildSharedLightUniverseKickoffSignature,
  buildSbtLookupKey,
  buildSbtOptionsRequestSignature,
  buildSbtSelectorDiscoverySessionRef,
  buildSbtSelectorLogContext,
  buildSbtSelectorMetadataLookupConfig,
  buildTargetSlugChainSignature,
  getNormalizedNetworkChainValue,
  isUnresolvedSessionConfig,
  normalizeAddressListForSig,
  normalizeChainValue,
  normalizeSessionSlugListForSig,
  resolveSbtSelectorSessionLabel,
  resolveSbtSelectorSessionNetworkId,
  shouldDiscoverSbtForSessionConfig,
} from './sbtSelectorSessionRuntimeHelpers';
export type {
  BuildSbtSelectorDiscoverySessionRefArgs,
  BuildSbtSelectorMetadataLookupConfigArgs,
  ResolveSbtSelectorSessionChainId,
  ResolveSbtSelectorSessionLabelArgs,
  ResolveSbtSelectorSessionNetworkIdArgs,
  SbtLookupKeyArgs,
  SbtOptionsRequestSignatureArgs,
  SbtSelectorLogContextArgs,
  SbtSelectorSessionConfigSigLike,
} from './sbtSelectorSessionRuntimeHelpers';
export {
  getSelectableSbtKey,
  getSelectOptionValue,
  normalizeSelectableSbtAddress,
} from './sbtSelectorSelectionKeyHelpers';
export {
  buildEffectiveFeaturedAddressSet,
  buildSbtOptionsByAddress,
  buildSbtOptionsBySelectionKey,
  buildSbtSelectorMergedSelectableOptions,
  buildSbtSelectorSelectOptions,
  buildSelectedSbtAddressSet,
  buildSelectedSbtKeySet,
  hasSelectedOrPendingSbtSelectorAddress,
  hasSelectedOrPendingSbtSelectorKey,
  resolveSbtSelectorDisplayOptions,
} from './sbtSelectorOptionCollectionHelpers';
export {
  buildScopedSbtIgnoreKey,
  hasAuthoritativeSessionSlug,
  hasOwn,
  pickNormalizedSessionSlug,
  pickOptionalNormalizedSessionSlug,
  resolveAuthoritativeSbtSessionBindingSlug,
  resolveConcreteSbtSessionBindingSlug,
  resolveDeclaredSbtSessionSlug,
  resolveSbtDetailLinkSessionSlug,
} from './sbtSelectorSessionBindingHelpers';
export {
  decorateScopedSbtEntry,
  mergeScopedSbtEntry,
  resolveSbtEntryChainId,
  shouldPreferIncomingScopedSbtEntry,
} from './sbtSelectorScopedEntryMergeHelpers';
export type { SbtSelectorScopedEntry } from './sbtSelectorScopedEntryMergeHelpers';
export {
  buildSbtSelectorCustomAddressClearPatch,
  buildSbtSelectorCustomAddressInputPatch,
  buildSbtSelectorDiscoveringPatch,
  buildSbtSelectorGroupOptionsPatch,
  buildSbtSelectorGroupPickerTogglePatch,
  buildSbtSelectorGroupSourceSelectionPatch,
  buildSbtSelectorLoadingOptionsPatch,
  buildSbtSelectorLoadingStatusClassName,
  buildSbtSelectorManualInputTogglePatch,
  buildSbtSelectorManualInputWarningPatch,
  buildSbtSelectorRootClassName,
  buildSbtSelectorSelectedOptionResetPatch,
  buildSbtSelectorSourceSessionSlugPatch,
  getSbtSelectorLoadingOptionCount,
  getSbtSelectorLoadingStatusText,
  isSbtSelectorOptionsLoading,
  resolveSbtSelectorAutoSearchButtonsState,
  resolveSbtSelectorGroupPickerState,
  resolveSbtSelectorGroupSourceSelection,
  resolveSbtSelectorHeaderLoadingStatusState,
  resolveSbtSelectorLabelImageState,
  resolveSbtSelectorLoadingStatusDisplayState,
  resolveSbtSelectorManualControlsState,
  resolveSbtSelectorManualEntryState,
  resolveSbtSelectorNoOptionsMessage,
  resolveSbtSelectorSelectedAddressesState,
  resolveSbtSelectorVariantDisplayState,
} from './sbtSelectorUiStateHelpers';
export {
  canRetryNameLookup,
  clearNameLookupFailure,
  ensureNameLookupState,
  getNameLookupDelayMs,
  markNameLookupFailure,
} from './sbtSelectorNameLookupHelpers';
export type { SbtNameLookupEntry, SbtNameLookupState } from './sbtSelectorNameLookupHelpers';

type SbtSelectorHiddenTitleArgs = {
  label?: unknown;
  sbtInfo?: unknown;
};
type BuildSbtSelectorCustomSbtSelectionArgs = {
  address?: unknown;
  image?: unknown;
  name?: unknown;
  resolvedSlug?: unknown;
  sbtInfo?: unknown;
};
type SbtSelectorCustomSbtSelection = {
  address: string;
  chainId: unknown;
  image: unknown;
  name: unknown;
  selectionKey: string;
  sessionBindingSlug?: unknown;
  sessionName: unknown;
  sessionSlug: string;
};
type BuildSbtSelectorSelectedDisplayEntriesArgs<
  TSelected extends Record<string, unknown> = Record<string, unknown>,
  TOption extends Record<string, unknown> = Record<string, unknown>,
> = {
  currentSessionSlug?: unknown;
  resolveSbtLabel?: (sbtInfo: unknown, address: string, sessionSlug: string) => unknown;
  sbtOptionsByAddress?: Map<string, TOption>;
  sbtOptionsBySelectionKey?: Map<string, TOption>;
  selectedSbts?: TSelected[] | unknown;
};
type SbtSelectorHiddenTitleInfo = Record<string, unknown> & {
  name?: unknown;
  nameDecrypted?: unknown;
  sessionName?: unknown;
  title?: unknown;
};
type BuildSbtSelectorOptionsArgs = {
  fallbackSlug?: unknown;
  featuredEntries?: unknown;
  ignoredSet?: unknown;
  onMissingAddress?: ((sbt: unknown) => void) | null;
  resolveSbtLabel?: (sbtInfo: unknown, address: string, sessionSlug: string) => unknown;
  sbtList?: unknown;
  scopeMode?: unknown;
  targetSlugs?: unknown;
};
type ReadSbtSelectorScopedCacheContextsArgs = {
  getSessionNetworkId?: ((slug: unknown) => unknown) | null;
  readSbtCacheBySlug?: ((slug: unknown) => Promise<unknown> | unknown) | null;
  targetSlugs?: unknown;
};
type SbtSelectorHydrationResultLike = Record<string, unknown> & {
  address?: unknown;
  context?: unknown;
  lower?: unknown;
  sbtInfo?: unknown;
  slug?: unknown;
};
type SbtSelectorAddressHydrationResultLike = Record<string, unknown> & {
  address?: unknown;
  sbtInfo?: unknown;
};
type ApplySbtSelectorHydrationResultsArgs = {
  now?: unknown;
  resolvedAggregatedSbtList?: unknown;
  results?: unknown;
};
type SbtSelectorComparableOption = {
  address?: unknown;
  chainId?: unknown;
  image?: unknown;
  maskedTitleHidden?: unknown;
  name?: unknown;
  selectionKey?: unknown;
  sessionName?: unknown;
  sessionSlug?: unknown;
};
type BuildSbtSelectorOptionFromEntryArgs = {
  address: string;
  chainId?: number | null;
  resolvedName: string;
  resolvedSlug: string;
  sbt?: unknown;
  sbtInfo?: Record<string, unknown> | null;
  selectionKey?: string;
};
type ResolveSbtSelectorOptionEntryContextArgs = {
  fallbackSlug?: unknown;
  sbt?: unknown;
};
type SbtSelectorOptionEntryContext = {
  address: string;
  chainId: number | null;
  isManual: boolean;
  resolvedSlug: string;
  sbtInfo: Record<string, unknown> | null;
  selectionKey: string;
};
type BuildSbtSelectorNameHydrationEntriesArgs = {
  fallbackSlug?: unknown;
  sbtList?: unknown;
};
type SbtSelectorNameHydrationEntry = {
  address: string;
  slug: string;
};
export type SbtSelectorBuiltOption = Record<string, unknown> & {
  address: string;
  chainId: number | null;
  image: unknown;
  maskedTitleHidden: boolean;
  name: string;
  selectionKey: string;
  sessionBindingSlug?: unknown;
  sessionName: unknown;
  sessionSlug: string;
};
export type NormalizedAdditionalSbtOption = Record<string, unknown> & {
  address: string;
  name: unknown;
};
type SbtSelectorSessionListsReader = (slug: string) => unknown;
type BuildIgnoredSbtSelectorAddressSetArgs = {
  effectiveSlug?: unknown;
  getSessionLists?: SbtSelectorSessionListsReader | null;
  normalizeDiscoverySlugs?: ((slugs: unknown, options?: SbtSelectorDiscoverySlugOptions) => string[]) | null;
  scopeMode?: unknown;
  targetSlugs?: unknown;
};
type SbtSelectorFeaturedListReader = (config: unknown) => unknown;
type BuildScopeFeaturedSbtSelectorEntriesArgs = {
  defaultFeaturedSBTs?: unknown;
  effectiveSlug?: unknown;
  getCanonicalSessionFeaturedSBTs?: SbtSelectorFeaturedListReader | null;
  getDisplayLookupSessionConfig?: ((slug: string) => unknown) | null;
  getSessionLists?: SbtSelectorSessionListsReader | null;
  normalizeDiscoverySlugs?: ((slugs: unknown, options?: SbtSelectorDiscoverySlugOptions) => string[]) | null;
  sessionConfig?: unknown;
  shouldUsePropsSessionConfigForSlug?: ((slug: string) => unknown) | null;
  targetSlugs?: unknown;
};
export type SbtCacheNetNode = Record<string, unknown> & {
  nameLookupState?: SbtNameLookupState;
  sbtList?: Record<string, unknown>;
};
export type SbtSelectorScopedEntryMap = Record<string, SbtSelectorScopedEntry | null | undefined>;
type ApplySbtSelectorDiscoveredAddressesToListArgs = {
  addresses?: unknown;
  resolvedSlug?: unknown;
  sbtList?: unknown;
};
type ApplySbtSelectorDiscoveredAddressesToListResult = {
  mutated: boolean;
  sbtList: SbtSelectorScopedEntryMap;
};
type ApplySbtSelectorAddressHydrationResultsToListArgs = {
  nameLookupState?: unknown;
  now?: unknown;
  resolvedSlug?: unknown;
  results?: unknown;
  sbtList?: unknown;
};
type ApplySbtSelectorAddressHydrationResultsToListResult = {
  nameLookupState: SbtNameLookupState;
  sbtList: SbtSelectorScopedEntryMap;
};
type MergeSbtSelectorLatestCacheStateArgs = {
  latestCache?: unknown;
  nameLookupState?: unknown;
  netKey?: unknown;
  resolvedSlug?: unknown;
  sbtList?: unknown;
};
type MergeSbtSelectorLatestCacheStateResult = {
  cache: Record<string, SbtCacheNetNode>;
  nameLookupState: SbtNameLookupState;
  sbtList: SbtSelectorScopedEntryMap;
};
type MergeSbtSelectorLinkedScopedEntriesArgs = {
  fallbackSlug?: unknown;
  linkedScopedSbtList?: unknown;
  sbtList?: unknown;
};
type MergeSbtSelectorLinkedScopedEntriesResult = {
  linkedScopedCount: number;
  mergedOptionCount: number;
  sbtList: SbtSelectorScopedEntryMap;
};
type BuildSbtSelectorNameLookupFetchListArgs = {
  addresses?: unknown;
  nameLookupState?: unknown;
  now?: unknown;
  sbtList?: unknown;
};
type BuildSbtSelectorNameLookupFetchListResult = {
  addresses: string[];
  nameLookupState: SbtNameLookupState;
};
export type SbtSelectorCacheContext = {
  cache: Record<string, SbtCacheNetNode>;
  chainId: number;
  nameLookupState: SbtNameLookupState;
  netKey: string;
  sbtList: SbtSelectorScopedEntryMap;
  slug: string;
};
export type SbtSelectorCacheContextsResult = {
  contextBySlug: Map<string, SbtSelectorCacheContext>;
  contexts: SbtSelectorCacheContext[];
};
type SbtSelectorCacheContextLike = Record<string, unknown> & {
  chainId?: unknown;
  sbtList?: Record<string, unknown>;
  slug?: unknown;
};
type BuildLinkedSbtSelectorListFromKnownCacheArgs = {
  fallbackSlug?: unknown;
  knownEntries?: unknown;
  requireConcreteBinding?: unknown;
  targetSlugs?: unknown;
};
type ResolveLinkedSbtSelectorScopeEntryArgs = {
  requireConcreteBinding?: unknown;
  scopedEntry?: unknown;
  sourceSlug?: unknown;
  targetSlugSet?: ReadonlySet<string> | null;
};
type BuildSbtSelectorOptionsStatePatchArgs<TSbtOption = unknown> = {
  currentLoadingOptions?: unknown;
  currentSbtOptions?: unknown;
  currentScopeFeaturedAddresses?: unknown;
  featuredEntries?: unknown;
  loadingOptions?: unknown;
  sbtOptions?: TSbtOption[] | unknown;
};
export type SbtSelectorOptionsStatePatch<TSbtOption = unknown> = {
  loadingOptions?: boolean;
  sbtOptions?: TSbtOption[];
  scopeFeaturedAddresses?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const MASKED_SBT_LABEL = String(getSbtMaskedFieldValue() || '')
  .trim()
  .toLowerCase();

const asComparableSbtOption = (value: unknown): SbtSelectorComparableOption => {
  const record = isRecord(value) ? value : {};
  return {
    address: record.address,
    chainId: record.chainId,
    image: record.image,
    maskedTitleHidden: record.maskedTitleHidden,
    name: record.name,
    selectionKey: record.selectionKey,
    sessionName: record.sessionName,
    sessionSlug: record.sessionSlug,
  };
};

export const normalizeAdditionalSbtOptions = (optionsInput: unknown): NormalizedAdditionalSbtOption[] =>
  Array.isArray(optionsInput)
    ? optionsInput
        .map((entry: unknown): NormalizedAdditionalSbtOption | null => {
          const record = isRecord(entry) ? entry : {};
          const address = String(record.address || record.sbtAddress || record.value || '').trim();
          if (!address) return null;
          const name: unknown = record.name || record.label || address;
          return {
            ...record,
            address,
            name,
          };
        })
        .filter((entry): entry is NormalizedAdditionalSbtOption => entry != null)
    : [];

export const buildSbtSelectorCustomSbtSelection = ({
  address = '',
  image = null,
  name = '',
  resolvedSlug = '',
  sbtInfo = null,
}: BuildSbtSelectorCustomSbtSelectionArgs = {}): SbtSelectorCustomSbtSelection => {
  const addressLower = String(address || '').toLowerCase();
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const chainId = info.chainID || info.chainId || null;
  const sessionBindingSlug = pickOptionalNormalizedSessionSlug(
    resolveConcreteSbtSessionBindingSlug({
      sbtInfo,
      sessionSlug: resolvedSlug,
    }),
  );
  return {
    address: addressLower,
    name,
    image,
    sessionSlug: String(resolvedSlug || ''),
    sessionName: info.sessionName || null,
    chainId,
    ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
    selectionKey:
      buildSbtLookupKey({
        address: addressLower,
        chainId,
      }) || addressLower,
  };
};

export const normalizeSbtCacheForNet = (cacheIn: unknown, netKey: unknown): Record<string, SbtCacheNetNode> => {
  const cacheObj = isRecord(cacheIn) ? ({ ...cacheIn } as Record<string, SbtCacheNetNode>) : {};
  const key = String(netKey);
  if (!isRecord(cacheObj[key])) {
    cacheObj[key] = { sbtList: {} };
  }
  if (!isRecord(cacheObj[key].sbtList)) {
    cacheObj[key].sbtList = {};
  }
  return cacheObj;
};

export const readSbtSelectorScopedCacheContexts = async ({
  getSessionNetworkId: getNetworkId = null,
  readSbtCacheBySlug: readCacheBySlug = null,
  targetSlugs = [],
}: ReadSbtSelectorScopedCacheContextsArgs = {}): Promise<SbtSelectorCacheContextsResult> => {
  const contexts: SbtSelectorCacheContext[] = [];
  const contextBySlug = new Map<string, SbtSelectorCacheContext>();
  const orderedTargetSlugs = normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true });

  for (const targetSlug of orderedTargetSlugs) {
    const chainId = Number(typeof getNetworkId === 'function' ? getNetworkId(targetSlug) : 0) || null;
    if (!chainId) continue;
    const netKey = String(chainId);
    const cache = normalizeSbtCacheForNet(
      typeof readCacheBySlug === 'function' ? await readCacheBySlug(targetSlug) : {},
      netKey,
    );
    const netNode = cache[netKey] || { sbtList: {} };
    cache[netKey] = netNode;
    const sbtList = { ...(netNode.sbtList || {}) } as SbtSelectorScopedEntryMap;
    const nameLookupState = ensureNameLookupStateImpl(cache, netKey);
    netNode.sbtList = sbtList;
    netNode.nameLookupState = nameLookupState;
    const context: SbtSelectorCacheContext = {
      slug: targetSlug,
      chainId,
      netKey,
      cache,
      sbtList,
      nameLookupState,
    };
    contexts.push(context);
    contextBySlug.set(targetSlug, context);
  }

  return { contexts, contextBySlug };
};

export const applySbtSelectorHydrationResults = ({
  now = Date.now(),
  resolvedAggregatedSbtList = {},
  results = [],
}: ApplySbtSelectorHydrationResultsArgs = {}): Set<SbtSelectorCacheContext> => {
  const aggregatedList = isRecord(resolvedAggregatedSbtList)
    ? (resolvedAggregatedSbtList as SbtSelectorScopedEntryMap)
    : {};
  const touchedContexts = new Set<SbtSelectorCacheContext>();
  (Array.isArray(results) ? results : []).forEach((resultInput) => {
    const result = isRecord(resultInput) ? (resultInput as SbtSelectorHydrationResultLike) : null;
    if (!result) return;
    const context = isRecord(result.context) ? (result.context as SbtSelectorCacheContext) : null;
    const address = String(result.address || '').trim();
    const lower = String(result.lower || address)
      .trim()
      .toLowerCase();
    if (!context || !address || !lower) return;

    if (!isRecord(context.sbtList)) context.sbtList = {};
    const aggregatedKey = buildSbtLookupKey({ address, chainId: context.chainId });
    const existingScoped = isRecord(context.sbtList[lower]) ? (context.sbtList[lower] as SbtSelectorScopedEntry) : {};
    const existingAggregated = isRecord(aggregatedList[aggregatedKey])
      ? (aggregatedList[aggregatedKey] as SbtSelectorScopedEntry)
      : {};
    const resolvedInfo = (result.sbtInfo ||
      existingScoped.sbtInfo ||
      existingAggregated.sbtInfo ||
      null) as SbtSelectorScopedEntry['sbtInfo'];
    context.sbtList[lower] = {
      ...existingScoped,
      sbtAddress: address,
      chainId: resolveSbtEntryChainId(existingScoped, context.chainId),
      sbtInfo: resolvedInfo,
      slug: pickNormalizedSessionSlug(result.slug, context.slug),
    };
    if (hasSbtDisplayName(resolvedInfo)) {
      clearNameLookupFailureImpl(context.nameLookupState, lower);
    } else {
      markNameLookupFailureImpl(context.nameLookupState, lower, now);
    }
    aggregatedList[aggregatedKey] = mergeScopedSbtEntry(
      aggregatedList[aggregatedKey],
      context.sbtList[lower],
      context.slug,
    );
    touchedContexts.add(context);
  });

  return touchedContexts;
};

export const buildIgnoredSbtSelectorAddressSet = ({
  effectiveSlug = '',
  getSessionLists: getSessionListsFn = null,
  normalizeDiscoverySlugs: normalizeDiscoverySlugsFn = normalizeDiscoverySlugs,
  scopeMode = '',
  targetSlugs = [],
}: BuildIgnoredSbtSelectorAddressSetArgs = {}): Set<string> => {
  const resolvedEffectiveSlug = normalizeSessionSlug(effectiveSlug || '');
  const normalizeSlugs =
    typeof normalizeDiscoverySlugsFn === 'function' ? normalizeDiscoverySlugsFn : normalizeDiscoverySlugs;
  const slugsToRead = normalizeSlugs(
    Array.isArray(targetSlugs) && targetSlugs.length > 0
      ? targetSlugs
      : [scopeMode === 'general' && resolvedEffectiveSlug !== '' ? '' : resolvedEffectiveSlug],
    { allowEmpty: true },
  );
  const ignored = new Set<string>();
  slugsToRead.forEach((targetSlug: string) => {
    const listSlug = scopeMode === 'general' && targetSlug !== '' ? '' : targetSlug;
    const sessionLists = typeof getSessionListsFn === 'function' ? getSessionListsFn(listSlug) : {};
    const ignoredList = isRecord(sessionLists) ? sessionLists.ignored_SBTs_LIST : [];
    (Array.isArray(ignoredList) ? ignoredList : []).forEach((address: unknown) => {
      const scopedKey = buildScopedSbtIgnoreKey({ slug: targetSlug, address });
      if (scopedKey) ignored.add(scopedKey);
    });
  });
  return ignored;
};

export const buildScopeFeaturedSbtSelectorEntries = ({
  defaultFeaturedSBTs = [],
  effectiveSlug = '',
  getCanonicalSessionFeaturedSBTs: getCanonicalSessionFeaturedSBTsFn = null,
  getDisplayLookupSessionConfig: getDisplayLookupSessionConfigFn = null,
  getSessionLists: getSessionListsFn = null,
  normalizeDiscoverySlugs: normalizeDiscoverySlugsFn = normalizeDiscoverySlugs,
  sessionConfig = null,
  shouldUsePropsSessionConfigForSlug: shouldUsePropsSessionConfigForSlugFn = null,
  targetSlugs = [],
}: BuildScopeFeaturedSbtSelectorEntriesArgs = {}): SbtSelectorScopedEntry[] => {
  const resolvedEffectiveSlug = normalizeSessionSlug(effectiveSlug || '');
  const normalizeSlugs =
    typeof normalizeDiscoverySlugsFn === 'function' ? normalizeDiscoverySlugsFn : normalizeDiscoverySlugs;
  const readFeaturedList =
    typeof getCanonicalSessionFeaturedSBTsFn === 'function' ? getCanonicalSessionFeaturedSBTsFn : () => [];
  const seen = new Set<string>();
  const out: SbtSelectorScopedEntry[] = [];
  const addEntries = (addresses: unknown = [], slug: unknown = resolvedEffectiveSlug): void => {
    (Array.isArray(addresses) ? addresses : []).forEach((address: unknown) => {
      const rawAddress = String(address || '').trim();
      if (!rawAddress) return;
      const lower = rawAddress.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      out.push({
        address: rawAddress,
        slug: normalizeSessionSlug(slug || ''),
      });
    });
  };

  addEntries(defaultFeaturedSBTs, resolvedEffectiveSlug);
  normalizeSlugs(targetSlugs, { allowEmpty: true }).forEach((targetSlug: string) => {
    const displayLookupCfg =
      typeof getDisplayLookupSessionConfigFn === 'function' ? getDisplayLookupSessionConfigFn(targetSlug) : null;
    const propsFeatured =
      typeof shouldUsePropsSessionConfigForSlugFn === 'function' && shouldUsePropsSessionConfigForSlugFn(targetSlug)
        ? readFeaturedList(sessionConfig)
        : [];
    const configFeatured = targetSlug !== resolvedEffectiveSlug ? readFeaturedList(displayLookupCfg) : [];
    const sessionLists = typeof getSessionListsFn === 'function' ? getSessionListsFn(targetSlug) : {};
    const featuredList = isRecord(sessionLists) ? sessionLists.featured_SBTs_LIST : [];
    addEntries(propsFeatured, targetSlug);
    addEntries(configFeatured, targetSlug);
    addEntries(featuredList, targetSlug);
  });
  return out;
};

export function buildSbtSelectorSelectedDisplayEntries<
  TSelected extends Record<string, unknown> = Record<string, unknown>,
  TOption extends Record<string, unknown> = Record<string, unknown>,
>(
  args: BuildSbtSelectorSelectedDisplayEntriesArgs<TSelected, TOption> & {
    selectedSbts?: TSelected[];
  },
): TSelected[];
export function buildSbtSelectorSelectedDisplayEntries(args?: BuildSbtSelectorSelectedDisplayEntriesArgs): unknown[];
export function buildSbtSelectorSelectedDisplayEntries({
  currentSessionSlug = '',
  resolveSbtLabel = () => '',
  sbtOptionsByAddress = new Map(),
  sbtOptionsBySelectionKey = new Map(),
  selectedSbts = [],
}: BuildSbtSelectorSelectedDisplayEntriesArgs = {}): unknown[] {
  return (Array.isArray(selectedSbts) ? selectedSbts : []).map((sbt: unknown): unknown => {
    const record = isRecord(sbt) ? sbt : {};
    const address = String(record.address || '').toLowerCase();
    if (!address) return sbt;
    const fromOptions = sbtOptionsBySelectionKey.get(getSelectableSbtKey(record)) || sbtOptionsByAddress.get(address);
    const resolvedName =
      fromOptions?.name ||
      record.name ||
      resolveSbtLabel(
        record.sbtInfo || null,
        address,
        pickNormalizedSessionSlug(record.sessionSlug, currentSessionSlug),
      );
    const sessionBindingSlug = pickOptionalNormalizedSessionSlug(
      fromOptions && hasOwn(fromOptions, 'sessionBindingSlug') ? fromOptions.sessionBindingSlug : undefined,
      hasOwn(record, 'sessionBindingSlug') ? record.sessionBindingSlug : undefined,
    );
    return {
      ...record,
      name: resolvedName || record.name || record.address,
      image: fromOptions?.image || record.image || null,
      sessionName: fromOptions?.sessionName || record.sessionName || null,
      sessionSlug: pickNormalizedSessionSlug(fromOptions?.sessionSlug, record.sessionSlug, currentSessionSlug),
      ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
    };
  });
}

export const shouldIncludeSbtSelectorEntryForListScope = ({
  declaredSessionSlug = null,
  hasVisibleMetadata = false,
  listScopeTargetSlugSet = null,
  scopedBucketSlug = '',
}: {
  declaredSessionSlug?: unknown;
  hasVisibleMetadata?: unknown;
  listScopeTargetSlugSet?: Set<string> | null;
  scopedBucketSlug?: unknown;
} = {}): boolean => {
  if (!(listScopeTargetSlugSet instanceof Set)) return true;
  if (declaredSessionSlug != null) {
    return listScopeTargetSlugSet.has(String(declaredSessionSlug || ''));
  }
  return hasVisibleMetadata !== true && listScopeTargetSlugSet.has(String(scopedBucketSlug || ''));
};

export const shouldSkipSbtSelectorEntryForOptions = ({
  address = '',
  ignoredAddressSet = new Set<string>(),
  isManual = false,
  resolvedSlug = '',
  sbtInfo = null,
  sbtOptionsMap = null,
  selectionKey = '',
}: {
  address?: unknown;
  ignoredAddressSet?: Set<string> | null;
  isManual?: unknown;
  resolvedSlug?: unknown;
  sbtInfo?: unknown;
  sbtOptionsMap?: Map<string, unknown> | null;
  selectionKey?: unknown;
} = {}): boolean => {
  const lowerAddress = String(address || '');
  const ignoreSet = ignoredAddressSet instanceof Set ? ignoredAddressSet : new Set<string>();
  if (ignoreSet.has(buildScopedSbtIgnoreKey({ slug: resolvedSlug, address: lowerAddress }))) return true;

  const info = isRecord(sbtInfo) ? sbtInfo : {};
  if (info.unlisted && !isManual) return true;

  const optionsMap = sbtOptionsMap instanceof Map ? sbtOptionsMap : new Map<string, unknown>();
  return optionsMap.has(String(selectionKey || lowerAddress));
};

export const resolveSbtSelectorOptionEntryContext = ({
  fallbackSlug = '',
  sbt = {},
}: ResolveSbtSelectorOptionEntryContextArgs = {}): SbtSelectorOptionEntryContext | null => {
  const entry = isRecord(sbt) ? (sbt as SbtSelectorScopedEntry) : {};
  const sbtInfo = isRecord(entry.sbtInfo) ? entry.sbtInfo : null;
  const sbtAddressOrNull = entry.sbtAddress;
  if (!sbtAddressOrNull) return null;
  const address = String(sbtAddressOrNull).toLowerCase();
  const chainId = resolveSbtEntryChainId(entry);
  const resolvedSlug = pickNormalizedSessionSlug(
    hasOwn(entry, 'sessionBindingSlug') ? entry.sessionBindingSlug : undefined,
    entry.slug,
    fallbackSlug,
  );
  const selectionKey = buildSbtLookupKey({ address, chainId });

  return {
    address,
    chainId,
    isManual: Boolean(entry.manual),
    resolvedSlug,
    sbtInfo,
    selectionKey,
  };
};

export const buildSbtSelectorNameHydrationEntries = ({
  fallbackSlug = '',
  sbtList = {},
}: BuildSbtSelectorNameHydrationEntriesArgs = {}): SbtSelectorNameHydrationEntry[] => {
  const list = isRecord(sbtList) ? sbtList : {};
  return Object.values(list)
    .map((entry: unknown) => {
      const entryRecord = isRecord(entry) ? (entry as SbtSelectorScopedEntry) : {};
      return {
        address: String(entryRecord.sbtAddress || '').trim(),
        slug: pickNormalizedSessionSlug(
          hasOwn(entryRecord, 'sessionBindingSlug') ? entryRecord.sessionBindingSlug : undefined,
          entryRecord.slug,
          fallbackSlug,
        ),
      };
    })
    .filter(
      (entry: SbtSelectorNameHydrationEntry) => Boolean(entry.address) && ethers.utils.isAddress(String(entry.address)),
    )
    .filter((entry: SbtSelectorNameHydrationEntry) => {
      const entryKey = String(entry.address || '').toLowerCase();
      const keyedEntry = isRecord(list[entryKey]) ? (list[entryKey] as SbtSelectorScopedEntry) : {};
      const info = keyedEntry.sbtInfo || null;
      return !hasSbtDisplayName(info);
    });
};

export const buildSbtSelectorOptionFromEntry = ({
  address,
  chainId = null,
  resolvedName,
  resolvedSlug,
  sbt = {},
  sbtInfo = null,
  selectionKey = '',
}: BuildSbtSelectorOptionFromEntryArgs): SbtSelectorBuiltOption => {
  const entry = isRecord(sbt) ? sbt : {};
  const info = isRecord(sbtInfo) ? sbtInfo : null;
  return {
    address,
    selectionKey: selectionKey || address,
    name: resolvedName,
    image: info?.image || null,
    sessionSlug: resolvedSlug,
    sessionName: info?.sessionName || entry.sessionName || null,
    chainId: chainId || null,
    ...(hasOwn(entry, 'sessionBindingSlug') ? { sessionBindingSlug: entry.sessionBindingSlug } : {}),
    maskedTitleHidden: isMaskedHiddenTitle({
      label: resolvedName,
      sbtInfo: info,
    }),
  };
};

export const applySbtSelectorDiscoveredAddressesToList = ({
  addresses = [],
  resolvedSlug = '',
  sbtList = {},
}: ApplySbtSelectorDiscoveredAddressesToListArgs = {}): ApplySbtSelectorDiscoveredAddressesToListResult => {
  const list = isRecord(sbtList) ? (sbtList as SbtSelectorScopedEntryMap) : {};
  const uniqueDiscovered: string[] = Array.from(
    new Set(
      (Array.isArray(addresses) ? addresses : [])
        .map((value: unknown) => String(value || '').trim())
        .filter((value: string) => ethers.utils.isAddress(value)),
    ),
  );
  let mutated = false;
  uniqueDiscovered.forEach((address: string) => {
    const lower = address.toLowerCase();
    const existing = list[lower] || null;
    const nextEntry = mergeScopedSbtEntry(
      existing,
      {
        ...(existing || {}),
        sbtAddress: address,
        sbtInfo: existing?.sbtInfo || null,
        slug: pickNormalizedSessionSlug(existing?.slug, resolvedSlug),
      },
      resolvedSlug,
    );
    const existingAddress = String(existing?.sbtAddress || '')
      .trim()
      .toLowerCase();
    const existingSlug = hasOwn(existing, 'slug') ? normalizeSessionSlug(existing?.slug || '') : null;
    if (existingAddress === lower && existingSlug === nextEntry?.slug) return;
    list[lower] = nextEntry;
    mutated = true;
  });
  return { mutated, sbtList: list };
};

export const applySbtSelectorAddressHydrationResultsToList = ({
  nameLookupState = {},
  now = Date.now(),
  resolvedSlug = '',
  results = [],
  sbtList = {},
}: ApplySbtSelectorAddressHydrationResultsToListArgs = {}): ApplySbtSelectorAddressHydrationResultsToListResult => {
  const list = isRecord(sbtList) ? (sbtList as SbtSelectorScopedEntryMap) : {};
  const lookupState = isRecord(nameLookupState) ? (nameLookupState as SbtNameLookupState) : {};
  const timestamp = Number(now || 0) || Date.now();
  (Array.isArray(results) ? results : []).forEach((resultInput: unknown) => {
    const result = isRecord(resultInput) ? (resultInput as SbtSelectorAddressHydrationResultLike) : null;
    if (!result) return;
    const address = String(result.address || '').trim();
    const lower = address.toLowerCase();
    const existing = list[lower] || null;
    const resolvedInfo = result.sbtInfo || existing?.sbtInfo || null;
    list[lower] = mergeScopedSbtEntry(
      existing,
      {
        ...(existing || {}),
        sbtAddress: address,
        sbtInfo: resolvedInfo,
        slug: pickNormalizedSessionSlug(existing?.slug, resolvedSlug),
      },
      resolvedSlug,
    );
    if (hasSbtDisplayName(resolvedInfo)) {
      clearNameLookupFailureImpl(lookupState, lower);
    } else {
      markNameLookupFailureImpl(lookupState, lower, timestamp);
    }
  });
  return { nameLookupState: lookupState, sbtList: list };
};

export const mergeSbtSelectorLatestCacheState = ({
  latestCache = {},
  nameLookupState = {},
  netKey = '',
  resolvedSlug = '',
  sbtList = {},
}: MergeSbtSelectorLatestCacheStateArgs = {}): MergeSbtSelectorLatestCacheStateResult => {
  const cache = isRecord(latestCache) ? (latestCache as Record<string, SbtCacheNetNode>) : {};
  const key = String(netKey || '');
  if (!isRecord(cache[key])) {
    cache[key] = { sbtList: {} };
  }
  const currentList = isRecord(sbtList) ? (sbtList as SbtSelectorScopedEntryMap) : {};
  const latestSbtList = { ...(isRecord(cache[key].sbtList) ? cache[key].sbtList : {}) };
  Object.entries(latestSbtList).forEach(([address, entry]) => {
    const entryRecord = isRecord(entry) ? (entry as SbtSelectorScopedEntry) : {};
    currentList[address] = mergeScopedSbtEntry(
      currentList[address],
      decorateScopedSbtEntry(entryRecord, resolvedSlug),
      resolvedSlug,
    );
  });
  const nextNameLookupState = {
    ...ensureNameLookupStateImpl(cache, key),
    ...(isRecord(nameLookupState) ? (nameLookupState as SbtNameLookupState) : {}),
  };
  cache[key].sbtList = currentList;
  cache[key].nameLookupState = nextNameLookupState;
  return {
    cache,
    nameLookupState: nextNameLookupState,
    sbtList: currentList,
  };
};

export const mergeSbtSelectorLinkedScopedEntries = ({
  fallbackSlug = '',
  linkedScopedSbtList = {},
  sbtList = {},
}: MergeSbtSelectorLinkedScopedEntriesArgs = {}): MergeSbtSelectorLinkedScopedEntriesResult => {
  const list = isRecord(sbtList) ? (sbtList as SbtSelectorScopedEntryMap) : {};
  const linkedList = isRecord(linkedScopedSbtList) ? (linkedScopedSbtList as SbtSelectorScopedEntryMap) : {};
  Object.entries(linkedList).forEach(([address, entry]) => {
    const entryRecord = isRecord(entry) ? (entry as SbtSelectorScopedEntry) : {};
    list[address] = mergeScopedSbtEntry(list[address], entryRecord, fallbackSlug);
  });
  return {
    linkedScopedCount: Object.keys(linkedList).length,
    mergedOptionCount: Object.keys(list).length,
    sbtList: list,
  };
};

export const buildSbtSelectorNameLookupFetchList = ({
  addresses = [],
  nameLookupState = {},
  now = Date.now(),
  sbtList = {},
}: BuildSbtSelectorNameLookupFetchListArgs = {}): BuildSbtSelectorNameLookupFetchListResult => {
  const list = isRecord(sbtList) ? (sbtList as SbtSelectorScopedEntryMap) : {};
  const lookupState = isRecord(nameLookupState) ? (nameLookupState as SbtNameLookupState) : {};
  const lookupNow = Number(now || 0) || Date.now();
  const uniqueAddresses: string[] = Array.from(
    new Set(
      (Array.isArray(addresses) ? addresses : [])
        .map((address: unknown) => String(address || '').trim())
        .filter(Boolean),
    ),
  );
  const fetchAddresses = uniqueAddresses.filter((address: string) => {
    const lower = address.toLowerCase();
    const entry = list[lower] || null;
    if (hasSbtDisplayName(entry?.sbtInfo || null)) {
      clearNameLookupFailureImpl(lookupState, lower);
      return false;
    }
    return canRetryNameLookupImpl(lookupState, lower, lookupNow);
  });
  return { addresses: fetchAddresses, nameLookupState: lookupState };
};

export const buildAggregatedSbtSelectorListFromContexts = (contexts: unknown = []): SbtSelectorScopedEntryMap => {
  const out: SbtSelectorScopedEntryMap = {};
  (Array.isArray(contexts) ? contexts : []).forEach((contextInput: unknown) => {
    const context = isRecord(contextInput) ? (contextInput as SbtSelectorCacheContextLike) : null;
    if (!context) return;
    const fallbackSlug = normalizeSessionSlug(context.slug || '');
    Object.entries(context.sbtList || {}).forEach(([address, entry]) => {
      const entryRecord = isRecord(entry) ? (entry as SbtSelectorScopedEntry) : {};
      const decoratedEntry = decorateScopedSbtEntry(
        {
          ...entryRecord,
          sbtAddress: entryRecord.sbtAddress || address,
          chainId: resolveSbtEntryChainId(entryRecord, context.chainId),
        },
        fallbackSlug,
      );
      const lookupKey = buildSbtLookupKey({
        address: decoratedEntry.sbtAddress || address,
        chainId: decoratedEntry.chainId || context.chainId,
      });
      if (!lookupKey) return;
      out[lookupKey] = mergeScopedSbtEntry(out[lookupKey], decoratedEntry, fallbackSlug);
    });
  });
  return out;
};

export const resolveLinkedSbtSelectorScopeEntry = ({
  requireConcreteBinding = false,
  scopedEntry = null,
  sourceSlug = '',
  targetSlugSet = null,
}: ResolveLinkedSbtSelectorScopeEntryArgs = {}): SbtSelectorScopedEntry | null => {
  const entry = isRecord(scopedEntry) ? (scopedEntry as SbtSelectorScopedEntry) : null;
  if (!entry || !targetSlugSet || targetSlugSet.size <= 0) return null;

  const resolvedSourceSlug = pickNormalizedSessionSlug(entry.__sourceSessionSlug, sourceSlug);
  const concreteBindingSlug = resolveAuthoritativeSbtSessionBindingSlug(entry);
  const bindingSlug = hasOwn(entry, 'sessionBindingSlug')
    ? pickOptionalNormalizedSessionSlug(entry.sessionBindingSlug)
    : null;
  const sourceInScope = targetSlugSet.has(resolvedSourceSlug);
  const bindingInScope = bindingSlug != null && targetSlugSet.has(bindingSlug);
  const concreteBindingInScope = concreteBindingSlug != null && targetSlugSet.has(concreteBindingSlug);

  if (requireConcreteBinding) {
    if (!sourceInScope && !concreteBindingInScope) return null;
    if (concreteBindingInScope && concreteBindingSlug != null) {
      return { ...entry, slug: concreteBindingSlug, sessionBindingSlug: concreteBindingSlug };
    }
    return entry;
  }

  if (!sourceInScope && !bindingInScope) return null;
  if (bindingInScope && bindingSlug != null) {
    return { ...entry, slug: bindingSlug };
  }
  return entry;
};

export const buildLinkedSbtSelectorListFromKnownCache = ({
  fallbackSlug = '',
  knownEntries = [],
  requireConcreteBinding = false,
  targetSlugs = [],
}: BuildLinkedSbtSelectorListFromKnownCacheArgs = {}): SbtSelectorScopedEntryMap => {
  const resolvedFallbackSlug = pickNormalizedSessionSlug(fallbackSlug);
  const targetSlugSet = new Set<string>(normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true }));
  if (targetSlugSet.size === 0) return {};

  const out: SbtSelectorScopedEntryMap = {};
  (Array.isArray(knownEntries) ? knownEntries : []).forEach((knownEntry: unknown) => {
    const knownRecord = isRecord(knownEntry) ? knownEntry : {};
    const sourceSlug = normalizeSessionSlug(knownRecord.slug || '');
    const cacheValue = isRecord(knownRecord.value) ? knownRecord.value : null;
    if (!cacheValue) return;

    Object.entries(cacheValue).forEach(([netKey, netNodeInput]) => {
      const netNode = isRecord(netNodeInput) ? (netNodeInput as SbtCacheNetNode) : null;
      const sbtList = isRecord(netNode?.sbtList) ? netNode.sbtList : null;
      if (!sbtList) return;
      const cachedChainId = normalizeChainValue(netKey);

      Object.entries(sbtList).forEach(([cacheAddress, entry]) => {
        const entryRecord = isRecord(entry) ? (entry as SbtSelectorScopedEntry) : {};
        const scopedEntry = decorateScopedSbtEntry(
          {
            ...entryRecord,
            sbtAddress: entryRecord.sbtAddress || cacheAddress,
            chainId: resolveSbtEntryChainId(entryRecord, cachedChainId),
            __sourceSessionSlug: sourceSlug,
            slug: pickNormalizedSessionSlug(entryRecord.slug, sourceSlug),
          },
          sourceSlug,
        );
        const entryAddress = String(scopedEntry.sbtAddress || '')
          .trim()
          .toLowerCase();
        if (!entryAddress) return;

        const entryForScope = resolveLinkedSbtSelectorScopeEntry({
          requireConcreteBinding,
          scopedEntry,
          sourceSlug,
          targetSlugSet,
        });
        if (!entryForScope) return;
        const lookupKey = buildSbtLookupKey({
          address: entryAddress,
          chainId: resolveSbtEntryChainId(entryForScope, cachedChainId),
        });
        if (!lookupKey) return;
        out[lookupKey] = mergeScopedSbtEntry(out[lookupKey], entryForScope, resolvedFallbackSlug);
      });
    });
  });
  return out;
};

export const buildSbtSelectorFeaturedOrder = (featuredEntries: unknown = []): Map<string, number> => {
  const featuredOrder = new Map<string, number>();
  (Array.isArray(featuredEntries) ? featuredEntries : []).forEach((entry: unknown, index: number) => {
    const record = isRecord(entry) ? (entry as SbtSelectorScopedEntry) : {};
    const lower = String(record.address || '')
      .trim()
      .toLowerCase();
    if (!lower || featuredOrder.has(lower)) return;
    featuredOrder.set(lower, index);
  });
  return featuredOrder;
};

export const buildSbtSelectorScopeFeaturedAddresses = (featuredEntries: unknown = []): string[] =>
  (Array.isArray(featuredEntries) ? featuredEntries : [])
    .map((entry: unknown) => {
      const record = isRecord(entry) ? (entry as SbtSelectorScopedEntry) : {};
      return String(record.address || '')
        .trim()
        .toLowerCase();
    })
    .filter(Boolean);

export const areSbtSelectorAddressListsEqual = (left: unknown, right: unknown): boolean => {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];
  return (
    leftList.length === rightList.length &&
    leftList.every((address: unknown, index: number) => address === rightList[index])
  );
};

export const buildSbtSelectorOptionsStatePatch = <TSbtOption = unknown>({
  currentLoadingOptions = undefined,
  currentSbtOptions = [],
  currentScopeFeaturedAddresses = [],
  featuredEntries = [],
  loadingOptions = undefined,
  sbtOptions = [],
}: BuildSbtSelectorOptionsStatePatchArgs<TSbtOption> = {}): SbtSelectorOptionsStatePatch<TSbtOption> => {
  const nextPatch: SbtSelectorOptionsStatePatch<TSbtOption> = {};
  if (!areSbtOptionsEqual(currentSbtOptions, sbtOptions)) {
    nextPatch.sbtOptions = Array.isArray(sbtOptions) ? sbtOptions : [];
  }
  const scopeFeaturedAddresses = buildSbtSelectorScopeFeaturedAddresses(featuredEntries);
  const prevFeatured = Array.isArray(currentScopeFeaturedAddresses) ? currentScopeFeaturedAddresses : [];
  if (!areSbtSelectorAddressListsEqual(scopeFeaturedAddresses, prevFeatured)) {
    nextPatch.scopeFeaturedAddresses = scopeFeaturedAddresses;
  }
  if (typeof loadingOptions === 'boolean' && currentLoadingOptions !== loadingOptions) {
    nextPatch.loadingOptions = loadingOptions;
  }
  return nextPatch;
};

export const compareSbtSelectorOptions = (
  leftInput: unknown,
  rightInput: unknown,
  featuredOrderInput: unknown = new Map<string, number>(),
): number => {
  const left = asComparableSbtOption(leftInput);
  const right = asComparableSbtOption(rightInput);
  const featuredOrder =
    featuredOrderInput instanceof Map ? (featuredOrderInput as Map<string, number>) : new Map<string, number>();
  const leftMasked = left?.maskedTitleHidden === true;
  const rightMasked = right?.maskedTitleHidden === true;
  if (leftMasked !== rightMasked) return leftMasked ? 1 : -1;

  const leftAddress = String(left.address || '');
  const rightAddress = String(right.address || '');
  const leftFeaturedRank = featuredOrder.has(leftAddress)
    ? (featuredOrder.get(leftAddress) ?? Number.MAX_SAFE_INTEGER)
    : Number.MAX_SAFE_INTEGER;
  const rightFeaturedRank = featuredOrder.has(rightAddress)
    ? (featuredOrder.get(rightAddress) ?? Number.MAX_SAFE_INTEGER)
    : Number.MAX_SAFE_INTEGER;
  if (leftFeaturedRank !== rightFeaturedRank) return leftFeaturedRank - rightFeaturedRank;

  const leftLabel = String(left.name || left.address || '').toLowerCase();
  const rightLabel = String(right.name || right.address || '').toLowerCase();
  const labelCompare = leftLabel.localeCompare(rightLabel);
  if (labelCompare !== 0) return labelCompare;
  const addressCompare = leftAddress.localeCompare(rightAddress);
  if (addressCompare !== 0) return addressCompare;
  return Number(left.chainId || 0) - Number(right.chainId || 0);
};

export const buildSbtSelectorOptions = ({
  sbtList = {},
  featuredEntries = [],
  ignoredSet = new Set<string>(),
  fallbackSlug = '',
  onMissingAddress = null,
  resolveSbtLabel = () => '',
  scopeMode = 'active',
  targetSlugs = [],
}: BuildSbtSelectorOptionsArgs = {}): SbtSelectorBuiltOption[] => {
  const featuredOrder = buildSbtSelectorFeaturedOrder(featuredEntries);
  const listScopeTargetSlugSet = buildSbtSelectorListScopeTargetSlugSet({
    fallbackSlug,
    scopeMode,
    targetSlugs,
  });

  const ignoredAddressSet = ignoredSet instanceof Set ? (ignoredSet as Set<string>) : new Set<string>();
  const sbtOptionsMap = new Map<string, SbtSelectorBuiltOption>();
  Object.values(isRecord(sbtList) ? (sbtList as SbtSelectorScopedEntryMap) : {}).forEach((sbt) => {
    if (!sbt) return;
    const optionContext = resolveSbtSelectorOptionEntryContext({
      fallbackSlug,
      sbt,
    });
    if (!optionContext) {
      if (typeof onMissingAddress === 'function') onMissingAddress(sbt);
      return;
    }
    const { address, chainId, isManual, resolvedSlug, sbtInfo, selectionKey } = optionContext;
    if (
      shouldSkipSbtSelectorEntryForOptions({
        address,
        ignoredAddressSet,
        isManual,
        resolvedSlug,
        sbtInfo,
        sbtOptionsMap,
        selectionKey,
      })
    )
      return;
    if (listScopeTargetSlugSet) {
      const declaredSessionSlug = resolveDeclaredSbtSessionSlug(sbt);
      const scopedBucketSlug = resolvedSlug;
      const hasVisibleMetadata = hasSbtDisplayName(sbtInfo);
      if (
        !shouldIncludeSbtSelectorEntryForListScope({
          declaredSessionSlug,
          hasVisibleMetadata,
          listScopeTargetSlugSet,
          scopedBucketSlug,
        })
      )
        return;
    }
    const resolvedName = String(resolveSbtLabel(sbtInfo, address, resolvedSlug) || '');
    const option = buildSbtSelectorOptionFromEntry({
      address,
      chainId,
      resolvedName,
      resolvedSlug,
      sbt,
      sbtInfo,
      selectionKey,
    });
    sbtOptionsMap.set(option.selectionKey || address, option);
  });

  return Array.from(sbtOptionsMap.values()).sort((left, right) =>
    compareSbtSelectorOptions(left, right, featuredOrder),
  );
};

export const isMaskedSbtOptionLabel = (value: unknown): boolean =>
  String(value || '')
    .trim()
    .toLowerCase() === MASKED_SBT_LABEL;

export const isMaskedHiddenTitle = ({ label = '', sbtInfo = null }: SbtSelectorHiddenTitleArgs = {}): boolean => {
  if (!isMaskedSbtOptionLabel(label)) return false;
  if (!isRecord(sbtInfo)) return true;
  const info = sbtInfo as SbtSelectorHiddenTitleInfo;
  const visibleName =
    String(info.name || '').trim() || String(info.title || '').trim() || String(info.sessionName || '').trim();
  if (visibleName) return false;
  if (info.nameDecrypted === true) return false;
  return isSbtFieldLocked(info, 'name');
};

export const areSbtOptionsEqual = (left: unknown, right: unknown): boolean => {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const leftItem = asComparableSbtOption(a[i]);
    const rightItem = asComparableSbtOption(b[i]);
    if (
      String(leftItem.address || '') !== String(rightItem.address || '') ||
      String(leftItem.name || '') !== String(rightItem.name || '') ||
      String(leftItem.image || '') !== String(rightItem.image || '') ||
      String(leftItem.sessionSlug || '') !== String(rightItem.sessionSlug || '') ||
      String(leftItem.sessionName || '') !== String(rightItem.sessionName || '') ||
      String(leftItem.chainId ?? '') !== String(rightItem.chainId ?? '') ||
      String(leftItem.selectionKey || '') !== String(rightItem.selectionKey || '')
    ) {
      return false;
    }
  }
  return true;
};
