import { ethers } from 'ethers';
import {
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS } from '../../variables/appConfig.js';
import {
  getSbtMaskedFieldValue,
  hasSbtDisplayName,
  isSbtFieldLocked,
} from '../../utilities/sbt/sbtDisplayNames.js';
import {
  canRetryNameLookup as canRetryNameLookupImpl,
  clearNameLookupFailure as clearNameLookupFailureImpl,
  ensureNameLookupState as ensureNameLookupStateImpl,
  markNameLookupFailure as markNameLookupFailureImpl,
} from './sbtSelectorNameLookupHelpers';
import type {
  SbtNameLookupState,
} from './sbtSelectorNameLookupHelpers';
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
export type {
  SbtNameLookupEntry,
  SbtNameLookupState,
} from './sbtSelectorNameLookupHelpers';

export const SBT_SELECTOR_DEBUG_STORAGE_KEY = 'ce:sbtSelectorDebug';
export const SBT_SELECTOR_DEBUG_QUERY_KEY = 'ceSbtSelectorDebug';

type SbtLookupKeyArgs = {
  address?: unknown;
  chainId?: unknown;
};
type ScopedSbtIgnoreKeyArgs = {
  address?: unknown;
  slug?: unknown;
};
type SbtSelectorScopedEntryLike = Record<string, unknown> & {
  address?: unknown;
  chainId?: unknown;
  sbtInfo?: (Record<string, unknown> & {
    chainID?: unknown;
    chainId?: unknown;
  }) | null;
  slug?: unknown;
};
export type SbtSelectorScopedEntry = SbtSelectorScopedEntryLike & {
  __sourceSessionSlug?: unknown;
  sbtAddress?: unknown;
  sessionBindingSlug?: unknown;
  sbtInfo?: (Record<string, unknown> & {
    chainID?: unknown;
    chainId?: unknown;
    image?: unknown;
  }) | null;
};
type SbtSessionSlugRecord = Record<string, unknown> & {
  sessionName?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
  slug?: unknown;
  sbtInfo?: Record<string, unknown> & {
    sessionName?: unknown;
    sessionSlug?: unknown;
    sessionSlugExplicit?: unknown;
    slug?: unknown;
  };
};
type SbtSelectorHiddenTitleArgs = {
  label?: unknown;
  sbtInfo?: unknown;
};
type SbtSelectorLogContextArgs = {
  effectiveSessionSlug?: unknown;
  extra?: Record<string, unknown>;
  id?: unknown;
  label?: unknown;
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
type SbtSelectorSelectedOrPendingAddressArgs = {
  address?: unknown;
  pendingAddresses?: Set<string> | null;
  selectedAddresses?: Set<string> | null;
};
type SbtSelectorSelectedOrPendingKeyArgs = {
  pendingKeys?: Set<string> | null;
  selectedKeys?: Set<string> | null;
  value?: unknown;
};
type SbtDetailLinkSessionSlugArgs = {
  fallbackSlug?: unknown;
  sbt?: unknown;
};
type BuildSbtSelectorSelectedDisplayEntriesArgs = {
  currentSessionSlug?: unknown;
  resolveSbtLabel?: (sbtInfo: unknown, address: string, sessionSlug: string) => unknown;
  sbtOptionsByAddress?: Map<string, Record<string, unknown>>;
  sbtOptionsBySelectionKey?: Map<string, Record<string, unknown>>;
  selectedSbts?: unknown;
};
type BuildSbtSelectorMergedSelectableOptionsArgs = {
  additionalOptions?: unknown;
  sbtOptions?: unknown;
};
type ResolveSbtSelectorDisplayOptionsArgs = {
  defaultFeaturedSBTs?: unknown;
  limitToFeatured?: unknown;
  mergedSbtOptions?: unknown;
  scopeFeaturedAddresses?: unknown;
};
type ResolveSbtSelectorDisplayOptionsResult<T extends Record<string, unknown>> = {
  displayOptions: T[];
  effectiveFeatured: unknown[];
  hasFeaturedSBTs: boolean;
};
type SbtSelectorSelectOption = {
  chainId?: unknown;
  image?: unknown;
  label: string;
  selectionKey: string;
  value: string;
};
type SbtSelectorHiddenTitleInfo = Record<string, unknown> & {
  name?: unknown;
  nameDecrypted?: unknown;
  sessionName?: unknown;
  title?: unknown;
};
type SbtSelectorSessionConfigSigLike = Record<string, unknown> & {
  __registry?: Record<string, unknown> & {
    chainId?: unknown;
  };
  blockLimits?: Record<string, unknown> & {
    end?: unknown;
    start?: unknown;
  };
  contracts?: Record<string, unknown> & {
    sbtFactory?: Record<string, unknown> & {
      address?: unknown;
      chainId?: unknown;
    };
  };
  networkChainId?: unknown;
  slug?: unknown;
};
type SbtOptionsRequestSignatureArgs = {
  cacheRevision?: unknown;
  featuredEntries?: unknown;
  ignoredFromConfig?: unknown;
  sessionConfigSig?: unknown;
  slug?: unknown;
  targetSlugChainSig?: unknown;
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
type SbtSelectorComparableOption = Record<string, unknown> & {
  address?: unknown;
  chainId?: unknown;
  image?: unknown;
  maskedTitleHidden?: unknown;
  name?: unknown;
  selectionKey?: unknown;
  sessionName?: unknown;
  sessionSlug?: unknown;
};
type SbtSelectorSelectableKeySource = Record<string, unknown> & {
  address?: unknown;
  chainId?: unknown;
  sbtAddress?: unknown;
  sbtInfo?: (Record<string, unknown> & {
    chainID?: unknown;
    chainId?: unknown;
  }) | null;
  selectionKey?: unknown;
  value?: unknown;
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
type SbtSelectorBuiltOption = Record<string, unknown> & {
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
type SbtSelectorDiscoverySlugOptions = {
  allowEmpty?: boolean;
};
type ResolveDirectSbtSelectorTargetSlugsArgs = {
  explicitOverride?: unknown;
  getAllSessionSlugs?: ((options?: { includeEmpty?: boolean }) => unknown) | null;
  normalizeDiscoverySlugs?: ((slugs: unknown, options?: SbtSelectorDiscoverySlugOptions) => string[]) | null;
  propSessionSlug?: unknown;
  readSessionScanScope?: (() => unknown) | null;
  readSessionScanSlugs?: (() => unknown) | null;
};
type ResolveSbtSelectorScopeModeArgs = {
  discoveryOverride?: unknown;
  groupOverride?: unknown;
  readSessionScanScope?: (() => unknown) | null;
};
type ResolveSbtSelectorEffectiveSessionSlugArgs = {
  groupOverride?: unknown;
  props?: unknown;
  sourceSessionSlug?: unknown;
};
type ResolveSbtSelectorTargetSlugsArgs = {
  directlyInvokedTargetSlugs?: unknown;
  groupOverride?: unknown;
  normalizeDiscoverySlugs?: ((slugs: unknown, options?: SbtSelectorDiscoverySlugOptions) => string[]) | null;
  slugOverride?: unknown;
  sourceSessionSlug?: unknown;
};
type ShouldWarmSbtSelectorRegistryCacheArgs = {
  shouldUsePropsSessionConfigForSlug?: ((slug: string) => unknown) | null;
  targetSlugs?: unknown;
};
type ShouldUsePropsSbtSelectorSessionConfigArgs = {
  effectiveSessionSlug?: unknown;
  sessionConfig?: unknown;
  slugIn?: unknown;
};
type ResolveSbtSelectorDisplayLookupSessionConfigArgs = {
  allowDemoSessionFallback?: unknown;
  getDemoSessionConfigBySlug?: ((slug: unknown, options?: { allowDemoFallback?: boolean }) => unknown) | null;
  getSessionConfigBySlugOrDefault?: ((slug: unknown) => unknown) | null;
  isUnresolvedSessionConfig?: ((config: unknown) => boolean) | null;
  sessionSlug?: unknown;
};
type ResolveSbtSelectorSessionNetworkIdArgs = {
  defaultFallbackChainId?: unknown;
  directChainId?: unknown;
  displayLookupSessionConfig?: unknown;
  getNormalizedNetworkChainValue?: ((network: unknown) => number | null) | null;
  getSessionChainId?: ((slug: unknown) => unknown) | null;
  network?: unknown;
  propsSessionConfig?: unknown;
  shouldUsePropsSessionConfig?: unknown;
  slug?: unknown;
};
type BuildSbtSelectorMetadataLookupConfigArgs = {
  baseConfig?: unknown;
  chainId?: unknown;
  propsConfig?: unknown;
  sessionSlug?: unknown;
  shouldUsePropsConfig?: unknown;
};
type BuildSbtSelectorDiscoverySessionRefArgs = {
  metadataLookupConfig?: unknown;
  sessionSlug?: unknown;
};
type ResolveSbtSelectorSessionLabelArgs = {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
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
type SbtSelectorGroupOption = {
  label: string;
  value: string;
};
type BuildSbtSelectorGroupOptionsArgs = {
  getSessionLabel?: ((slug: unknown) => string) | null;
  slugs?: unknown;
};
type BuildSbtSelectorAutoSearchSessionOptionsArgs = {
  autoSearchOtherSessions?: unknown;
  directlyInvokedTargetSlugs?: unknown;
  enableGroupSelect?: unknown;
  groupOptions?: unknown;
  groupOverride?: unknown;
  sourceSessionSlug?: unknown;
};
type ResolveSbtSelectorSessionChainId = (slug: string) => unknown;
type SbtSelectorStorageLike = {
  getItem?: (key: string) => string | null;
};
type SbtSelectorWindowLike = {
  location?: {
    search?: string | null;
  } | null;
};
type SbtSelectorDebugRuntimeArgs = {
  localStorageRef?: SbtSelectorStorageLike | null;
  runtimeGlobal?: Record<string, unknown> | null;
  sessionStorageRef?: SbtSelectorStorageLike | null;
  windowRef?: SbtSelectorWindowLike | null;
};
type ResolveSbtSelectorNoOptionsMessageArgs = {
  isLoading?: unknown;
  pluralLabel?: unknown;
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
type ResolveSbtSelectorUpdateEffectsArgs = {
  cacheChanged?: unknown;
  chainIdChanged?: unknown;
  discoveryOverrideChanged?: unknown;
  hasSharedLightUniverse?: unknown;
  networkChanged?: unknown;
  selectedSbtPropsChanged?: unknown;
  sessionConfigChanged?: unknown;
  shouldWarmRegistryCache?: unknown;
  sharedLightUniverseFnChanged?: unknown;
  slugPropChanged?: unknown;
  sourceGroupChanged?: unknown;
};
type ResolveSbtSelectorUpdateSignalsArgs = {
  nextChainId?: unknown;
  nextDiscoveryOverrideSignature?: unknown;
  nextEnsureLightSbtUniverse?: unknown;
  nextNetwork?: unknown;
  nextPropSessionSlug?: unknown;
  nextSbtCacheRevision?: unknown;
  nextSelectedSBTs?: unknown;
  nextSessionConfig?: unknown;
  nextSourceSessionSlug?: unknown;
  prevChainId?: unknown;
  prevDiscoveryOverrideSignature?: unknown;
  prevEnsureLightSbtUniverse?: unknown;
  prevNetwork?: unknown;
  prevPropSessionSlug?: unknown;
  prevSbtCacheRevision?: unknown;
  prevSelectedSBTs?: unknown;
  prevSessionConfig?: unknown;
  prevSourceSessionSlug?: unknown;
};
type SbtSelectorUpdateEffects = {
  shouldEnsureUniverse: boolean;
  shouldHydrateSelectedNames: boolean;
  shouldKickoffSharedLightUniverse: boolean;
  shouldLoadOptions: boolean;
  shouldWarmRegistryCache: boolean;
};
type SbtSelectorUpdateSignals = {
  cacheChanged: boolean;
  chainIdChanged: boolean;
  discoveryOverrideChanged: boolean;
  networkChanged: boolean;
  selectedSbtPropsChanged: boolean;
  sessionConfigChanged: boolean;
  sharedLightUniverseFnChanged: boolean;
  slugPropChanged: boolean;
  sourceGroupChanged: boolean;
  universeScopeChanged: boolean;
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
type BuildSbtSelectorOptionsStatePatchArgs = {
  currentLoadingOptions?: unknown;
  currentSbtOptions?: unknown;
  currentScopeFeaturedAddresses?: unknown;
  featuredEntries?: unknown;
  loadingOptions?: unknown;
  sbtOptions?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object'
);
const MASKED_SBT_LABEL = String(getSbtMaskedFieldValue() || '').trim().toLowerCase();

const asComparableSbtOption = (value: unknown): SbtSelectorComparableOption => (
  value != null && (typeof value === 'object' || typeof value === 'function')
    ? value as unknown as SbtSelectorComparableOption
    : {}
);

const getDefaultSbtSelectorRuntimeGlobal = (): Record<string, unknown> => {
  try {
    if (typeof globalThis === 'undefined') return {};
    return globalThis as unknown as Record<string, unknown>;
  } catch (_) {
    return {};
  }
};

const getDefaultSbtSelectorWindow = (): SbtSelectorWindowLike | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window;
  } catch (_) {
    return null;
  }
};

const getDefaultSbtSelectorLocalStorage = (): SbtSelectorStorageLike | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch (_) {
    return null;
  }
};

const getDefaultSbtSelectorSessionStorage = (): SbtSelectorStorageLike | null => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch (_) {
    return null;
  }
};

export const readBoolishDebugFlag = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

export const isSbtSelectorForcedDebugEnabled = ({
  localStorageRef,
  runtimeGlobal,
  sessionStorageRef,
  windowRef,
}: SbtSelectorDebugRuntimeArgs = {}): boolean => {
  try {
    const resolvedRuntime = typeof runtimeGlobal === 'undefined'
      ? getDefaultSbtSelectorRuntimeGlobal()
      : runtimeGlobal;
    if (resolvedRuntime && readBoolishDebugFlag(resolvedRuntime.CE_SBT_SELECTOR_DEBUG)) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    const resolvedWindow = typeof windowRef === 'undefined'
      ? getDefaultSbtSelectorWindow()
      : windowRef;
    if (resolvedWindow) {
      const params = new URLSearchParams(resolvedWindow.location?.search || '');
      if (
        params.has(SBT_SELECTOR_DEBUG_QUERY_KEY) &&
        readBoolishDebugFlag(params.get(SBT_SELECTOR_DEBUG_QUERY_KEY))
      ) {
        return true;
      }
    }
  } catch (_) {
    return false;
  }
  try {
    const resolvedLocalStorage = typeof localStorageRef === 'undefined'
      ? getDefaultSbtSelectorLocalStorage()
      : localStorageRef;
    if (
      resolvedLocalStorage?.getItem &&
      readBoolishDebugFlag(resolvedLocalStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))
    ) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    const resolvedSessionStorage = typeof sessionStorageRef === 'undefined'
      ? getDefaultSbtSelectorSessionStorage()
      : sessionStorageRef;
    if (
      resolvedSessionStorage?.getItem &&
      readBoolishDebugFlag(resolvedSessionStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))
    ) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
};

export const shouldAutoSearchOtherSbtSelectorSessions = (
  runtimeGlobal: Record<string, unknown> | null = getDefaultSbtSelectorRuntimeGlobal(),
  fallback: unknown = CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS
): boolean => {
  try {
    if (
      isRecord(runtimeGlobal) &&
      typeof runtimeGlobal.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS !== 'undefined'
    ) {
      return readBoolishDebugFlag(runtimeGlobal.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS);
    }
  } catch (_) {
    return !!fallback;
  }
  return !!fallback;
};

export const resolveSbtSelectorUpdateSignals = ({
  nextChainId = null,
  nextDiscoveryOverrideSignature = '',
  nextEnsureLightSbtUniverse = null,
  nextNetwork = null,
  nextPropSessionSlug = '',
  nextSbtCacheRevision = null,
  nextSelectedSBTs = null,
  nextSessionConfig = null,
  nextSourceSessionSlug = '',
  prevChainId = null,
  prevDiscoveryOverrideSignature = '',
  prevEnsureLightSbtUniverse = null,
  prevNetwork = null,
  prevPropSessionSlug = '',
  prevSbtCacheRevision = null,
  prevSelectedSBTs = null,
  prevSessionConfig = null,
  prevSourceSessionSlug = '',
}: ResolveSbtSelectorUpdateSignalsArgs = {}): SbtSelectorUpdateSignals => {
  const networkChanged = getNormalizedNetworkChainValue(prevNetwork) !== getNormalizedNetworkChainValue(nextNetwork);
  const chainIdChanged = normalizeChainValue(prevChainId) !== normalizeChainValue(nextChainId);
  const sessionConfigChanged = buildSessionConfigSig(prevSessionConfig) !== buildSessionConfigSig(nextSessionConfig);
  const cacheChanged = prevSbtCacheRevision !== nextSbtCacheRevision;
  const slugPropChanged = String(prevPropSessionSlug || '') !== String(nextPropSessionSlug || '');
  const sourceGroupChanged = prevSourceSessionSlug !== nextSourceSessionSlug;
  const selectedSbtPropsChanged = prevSelectedSBTs !== nextSelectedSBTs;
  const discoveryOverrideChanged =
    String(prevDiscoveryOverrideSignature || '') !== String(nextDiscoveryOverrideSignature || '');
  const sharedLightUniverseFnChanged = prevEnsureLightSbtUniverse !== nextEnsureLightSbtUniverse;
  const universeScopeChanged = !!(
    networkChanged ||
    chainIdChanged ||
    sessionConfigChanged ||
    slugPropChanged ||
    sourceGroupChanged ||
    discoveryOverrideChanged
  );

  return {
    cacheChanged,
    chainIdChanged,
    discoveryOverrideChanged,
    networkChanged,
    selectedSbtPropsChanged,
    sessionConfigChanged,
    sharedLightUniverseFnChanged,
    slugPropChanged,
    sourceGroupChanged,
    universeScopeChanged,
  };
};

export const resolveSbtSelectorUpdateEffects = ({
  cacheChanged = false,
  chainIdChanged = false,
  discoveryOverrideChanged = false,
  hasSharedLightUniverse = false,
  networkChanged = false,
  selectedSbtPropsChanged = false,
  sessionConfigChanged = false,
  shouldWarmRegistryCache = false,
  sharedLightUniverseFnChanged = false,
  slugPropChanged = false,
  sourceGroupChanged = false,
}: ResolveSbtSelectorUpdateEffectsArgs = {}): SbtSelectorUpdateEffects => {
  const universeScopeChanged = !!(
    networkChanged ||
    chainIdChanged ||
    sessionConfigChanged ||
    slugPropChanged ||
    sourceGroupChanged ||
    discoveryOverrideChanged
  );
  const optionsScopeChanged = universeScopeChanged || !!cacheChanged;
  return {
    shouldEnsureUniverse: universeScopeChanged,
    shouldHydrateSelectedNames: optionsScopeChanged || !!selectedSbtPropsChanged,
    shouldKickoffSharedLightUniverse: !!sharedLightUniverseFnChanged && !!hasSharedLightUniverse,
    shouldLoadOptions: optionsScopeChanged,
    shouldWarmRegistryCache: universeScopeChanged && !!shouldWarmRegistryCache,
  };
};

export const normalizeAddressListForSig = (addresses: unknown): string[] => (
  Array.from(new Set(
    (Array.isArray(addresses) ? addresses : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )).sort()
);

export const normalizeSessionSlugListForSig = (slugs: unknown): string[] => (
  Array.from(new Set(
    (Array.isArray(slugs) ? slugs : [])
      .map((value) => normalizeSessionSlug(value || ''))
      .filter((value): value is string => value != null)
  ))
);

export const buildSessionSlugSignature = (slugs: unknown): string => (
  normalizeSessionSlugListForSig(slugs).join(',')
);

export const buildSharedLightUniverseKickoffSignature = (slugs: unknown = []): string => {
  const normalized = normalizeDiscoverySlugs(slugs, { allowEmpty: true })
    .slice()
    .sort((left: string, right: string) => String(left || '').localeCompare(String(right || '')));
  return `${normalized.length}:${normalized.join(',')}`;
};

export const buildSbtSelectorLogContext = ({
  effectiveSessionSlug = '',
  extra = {},
  id = '',
  label = '',
}: SbtSelectorLogContextArgs = {}): Record<string, unknown> => ({
  selectorId: String(id || label || '').trim() || 'unnamed-selector',
  effectiveSessionSlug: normalizeSessionSlug(effectiveSessionSlug),
  ...extra,
});

export const buildTargetSlugChainSignature = (
  targetSlugs: unknown = [],
  resolveSessionChainId: ResolveSbtSelectorSessionChainId = () => 0
): string => (
  normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true })
    .map((targetSlug: string) => `${targetSlug}:${Number(resolveSessionChainId(targetSlug) || 0)}`)
    .join('|')
);

export const normalizeChainValue = (value: unknown): number | null => {
  const parsed = Number(value || 0);
  return parsed || null;
};

export const buildSbtLookupKey = ({ address, chainId }: SbtLookupKeyArgs = {}): string => {
  const lowerAddress = String(address || '').trim().toLowerCase();
  if (!lowerAddress) return '';
  const normalizedChainId = normalizeChainValue(chainId);
  return normalizedChainId ? `${normalizedChainId}:${lowerAddress}` : lowerAddress;
};

export const getNormalizedNetworkChainValue = (network: unknown): number | null => {
  const record = network && typeof network === 'object' ? network as Record<string, unknown> : {};
  return normalizeChainValue(record.id || record.chainId || 0);
};

export const resolveSbtSelectorSessionNetworkId = ({
  defaultFallbackChainId = null,
  directChainId = null,
  displayLookupSessionConfig = null,
  getNormalizedNetworkChainValue: getNormalizedNetworkChainValueFn = getNormalizedNetworkChainValue,
  getSessionChainId: getSessionChainIdFn = null,
  network = null,
  propsSessionConfig = null,
  shouldUsePropsSessionConfig = false,
  slug = '',
}: ResolveSbtSelectorSessionNetworkIdArgs = {}): number | null => {
  const sessionConfig = shouldUsePropsSessionConfig && isRecord(propsSessionConfig)
    ? propsSessionConfig
    : null;
  const sessionConfigChainId = normalizeChainValue(sessionConfig?.networkChainId);
  if (sessionConfigChainId) return sessionConfigChainId;

  const registryChainId = normalizeChainValue(
    typeof getSessionChainIdFn === 'function' ? getSessionChainIdFn(slug) : null
  );
  if (registryChainId) return registryChainId;

  const displayLookupCfg = isRecord(displayLookupSessionConfig) ? displayLookupSessionConfig : {};
  const displayContracts = isRecord(displayLookupCfg.contracts) ? displayLookupCfg.contracts : {};
  const displaySbtFactory = isRecord(displayContracts.sbtFactory) ? displayContracts.sbtFactory : {};
  const displaySurveys = isRecord(displayContracts.surveys) ? displayContracts.surveys : {};
  const displayRegistry = isRecord(displayLookupCfg.__registry) ? displayLookupCfg.__registry : {};
  const displayLookupChainId = normalizeChainValue(
    displayLookupCfg.networkChainId ||
    displayRegistry.chainId ||
    displaySbtFactory.chainId ||
    displaySurveys.chainId ||
    0
  );
  if (displayLookupChainId) return displayLookupChainId;

  const directOverride = normalizeChainValue(directChainId);
  if (directOverride) return directOverride;
  const walletChainId = typeof getNormalizedNetworkChainValueFn === 'function'
    ? getNormalizedNetworkChainValueFn(network)
    : getNormalizedNetworkChainValue(network);
  if (walletChainId) return walletChainId;
  return normalizeChainValue(defaultFallbackChainId);
};

export const buildSbtSelectorMetadataLookupConfig = ({
  baseConfig = {},
  chainId = null,
  propsConfig = {},
  sessionSlug = '',
  shouldUsePropsConfig = false,
}: BuildSbtSelectorMetadataLookupConfigArgs = {}): Record<string, unknown> => {
  const baseCfg = isRecord(baseConfig) ? baseConfig : {};
  const propsCfg = shouldUsePropsConfig && isRecord(propsConfig) ? propsConfig : {};
  const mergedContracts = {
    ...(isRecord(baseCfg.contracts) ? baseCfg.contracts : {}),
    ...(isRecord(propsCfg.contracts) ? propsCfg.contracts : {}),
  };
  const resolvedChainId = Number(chainId || baseCfg.networkChainId || 0) || null;
  const next: Record<string, unknown> = {
    ...baseCfg,
    ...propsCfg,
    slug: sessionSlug ?? '',
    contracts: mergedContracts,
  };
  if (resolvedChainId) {
    next.networkChainId = resolvedChainId;
    if (!isRecord(next.__registry)) {
      next.__registry = { chainId: resolvedChainId };
    } else if (!Number(next.__registry.chainId || 0)) {
      next.__registry = { ...next.__registry, chainId: resolvedChainId };
    }
  }
  return next;
};

export const buildSbtSelectorDiscoverySessionRef = ({
  metadataLookupConfig = {},
  sessionSlug = '',
}: BuildSbtSelectorDiscoverySessionRefArgs = {}): Record<string, unknown> => ({
  ...(isRecord(metadataLookupConfig) ? metadataLookupConfig : {}),
  slug: sessionSlug ?? '',
});

export const resolveSbtSelectorSessionLabel = ({
  sessionConfig = null,
  sessionSlug = '',
}: ResolveSbtSelectorSessionLabelArgs = {}): string => {
  const cfg = isRecord(sessionConfig) ? sessionConfig : {};
  const sessionName = String(cfg.sessionName || '');
  const slugText = String(sessionSlug || '');
  if (!slugText) return sessionName || 'General';
  if (sessionName && sessionName !== slugText) return `${sessionName} (${slugText})`;
  return sessionName || slugText;
};

export const normalizeSelectableSbtAddress = (value: unknown): string => {
  const rawAddress = String(value || '').trim();
  if (!rawAddress || !ethers.utils.isAddress(rawAddress)) return '';
  return ethers.utils.getAddress(rawAddress).toLowerCase();
};

export const getSelectableSbtKey = (value: unknown): string => {
  if (isRecord(value)) {
    const record = value as SbtSelectorSelectableKeySource;
    const explicit = String(record.selectionKey || '').trim();
    if (explicit) return explicit;
    const rawAddress = record.address || record.sbtAddress || record.value;
    const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};
    const chainId = record.chainId || sbtInfo.chainId || sbtInfo.chainID || null;
    return buildSbtLookupKey({ address: rawAddress, chainId }) || normalizeSelectableSbtAddress(rawAddress);
  }
  const raw = String(value || '').trim();
  if (!raw) return '';
  const chainScopedMatch = raw.match(/^(\d+):(0x[a-fA-F0-9]{40})$/);
  if (chainScopedMatch && ethers.utils.isAddress(chainScopedMatch[2])) {
    return `${Number(chainScopedMatch[1])}:${ethers.utils.getAddress(chainScopedMatch[2]).toLowerCase()}`;
  }
  return normalizeSelectableSbtAddress(raw);
};

export const getSelectOptionValue = (option: unknown): string => (
  getSelectableSbtKey(option) || String(isRecord(option) ? option.value || '' : '')
);

export const normalizeAdditionalSbtOptions = (optionsInput: unknown): NormalizedAdditionalSbtOption[] => (
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
    : []
);

export const resolvePropSessionSlug = (props: unknown = {}): string => {
  const record = isRecord(props) ? props : {};
  const hasExplicitSessionSlug = hasOwn(record, 'sessionSlug');
  return pickNormalizedSessionSlug(
    hasExplicitSessionSlug ? record.sessionSlug : undefined,
    record.activeSessionSlug
  );
};

export const resolveSbtSelectorEffectiveSessionSlug = ({
  groupOverride = false,
  props = {},
  sourceSessionSlug = '',
}: ResolveSbtSelectorEffectiveSessionSlugArgs = {}): string => (
  groupOverride
    ? String(sourceSessionSlug ?? '')
    : resolvePropSessionSlug(props)
);

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
    })
  );
  return {
    address: addressLower,
    name,
    image,
    sessionSlug: String(resolvedSlug || ''),
    sessionName: info.sessionName || null,
    chainId,
    ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
    selectionKey: buildSbtLookupKey({
      address: addressLower,
      chainId,
    }) || addressLower,
  };
};

export const normalizeDiscoverySlugs = (
  slugs: unknown,
  { allowEmpty = true }: SbtSelectorDiscoverySlugOptions = {}
): string[] => {
  const values = Array.isArray(slugs) ? slugs : [slugs];
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value: unknown) => {
    const normalized = normalizeSessionSlug(value || '');
    if (!allowEmpty && !normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

export const buildSbtSelectorListScopeTargetSlugSet = ({
  fallbackSlug = '',
  scopeMode = 'active',
  targetSlugs = [],
}: {
  fallbackSlug?: unknown;
  scopeMode?: unknown;
  targetSlugs?: unknown;
} = {}): Set<string> | null => {
  if (scopeMode !== 'list') return null;
  const sourceSlugs = Array.isArray(targetSlugs) && targetSlugs.length > 0
    ? targetSlugs
    : [fallbackSlug];
  return new Set<string>(normalizeDiscoverySlugs(sourceSlugs, { allowEmpty: true }));
};

export const resolveDirectSbtSelectorTargetSlugs = ({
  explicitOverride = [],
  getAllSessionSlugs: getAllSessionSlugsFn = null,
  normalizeDiscoverySlugs: normalizeDiscoverySlugsFn = normalizeDiscoverySlugs,
  propSessionSlug = '',
  readSessionScanScope: readSessionScanScopeFn = null,
  readSessionScanSlugs: readSessionScanSlugsFn = null,
}: ResolveDirectSbtSelectorTargetSlugsArgs = {}): string[] => {
  const normalizeSlugs = typeof normalizeDiscoverySlugsFn === 'function'
    ? normalizeDiscoverySlugsFn
    : normalizeDiscoverySlugs;
  const explicitSlugs = normalizeSlugs(explicitOverride, { allowEmpty: true });
  if (explicitSlugs.length > 0) return explicitSlugs;

  const effectiveSlug = normalizeSessionSlug(propSessionSlug || '');
  const scopeMode = typeof readSessionScanScopeFn === 'function'
    ? readSessionScanScopeFn()
    : '';
  if (scopeMode === 'general') return [''];
  if (scopeMode === 'list') {
    const scanSlugs = typeof readSessionScanSlugsFn === 'function'
      ? readSessionScanSlugsFn()
      : [];
    return normalizeSlugs(scanSlugs, { allowEmpty: true });
  }
  if (scopeMode === 'all') {
    const allSlugs = typeof getAllSessionSlugsFn === 'function'
      ? getAllSessionSlugsFn({ includeEmpty: true })
      : [];
    return normalizeSlugs(allSlugs, { allowEmpty: true });
  }
  return normalizeSlugs([effectiveSlug], { allowEmpty: true });
};

export const resolveSbtSelectorTargetSlugs = (
  args: ResolveSbtSelectorTargetSlugsArgs = {}
): string[] => {
  const normalizeSlugs = typeof args.normalizeDiscoverySlugs === 'function'
    ? args.normalizeDiscoverySlugs
    : normalizeDiscoverySlugs;
  if (hasOwn(args, 'slugOverride')) {
    return normalizeSlugs([args.slugOverride], { allowEmpty: true });
  }
  if (args.groupOverride) {
    return normalizeSlugs([args.sourceSessionSlug], { allowEmpty: true });
  }
  return Array.isArray(args.directlyInvokedTargetSlugs)
    ? args.directlyInvokedTargetSlugs
    : normalizeSlugs(args.directlyInvokedTargetSlugs, { allowEmpty: true });
};

export const shouldWarmSbtSelectorRegistryCacheForTargets = ({
  shouldUsePropsSessionConfigForSlug = null,
  targetSlugs = [],
}: ShouldWarmSbtSelectorRegistryCacheArgs = {}): boolean => {
  const targets = Array.isArray(targetSlugs) ? targetSlugs : [];
  if (!targets.length) return true;
  return targets.some((targetSlug: string) => (
    !(typeof shouldUsePropsSessionConfigForSlug === 'function'
      ? shouldUsePropsSessionConfigForSlug(targetSlug)
      : false)
  ));
};

export const shouldUsePropsSbtSelectorSessionConfigForSlug = ({
  effectiveSessionSlug = '',
  sessionConfig = null,
  slugIn,
}: ShouldUsePropsSbtSelectorSessionConfigArgs = {}): boolean => {
  if (!sessionConfig || typeof sessionConfig !== 'object') return false;
  const configRecord = sessionConfig as Record<string, unknown>;
  const effectiveSlug = normalizeSessionSlug(effectiveSessionSlug || '');
  const requestedSlug = normalizeSessionSlug(slugIn !== undefined ? slugIn : effectiveSlug);
  const propsSlug = pickNormalizedSessionSlug(configRecord.slug, effectiveSlug);
  return requestedSlug === propsSlug || requestedSlug === effectiveSlug;
};

export const resolveSbtSelectorDisplayLookupSessionConfig = ({
  allowDemoSessionFallback = false,
  getDemoSessionConfigBySlug: getDemoSessionConfigBySlugFn = null,
  getSessionConfigBySlugOrDefault: getSessionConfigBySlugOrDefaultFn = null,
  isUnresolvedSessionConfig: isUnresolvedSessionConfigFn = isUnresolvedSessionConfig,
  sessionSlug = '',
}: ResolveSbtSelectorDisplayLookupSessionConfigArgs = {}): unknown | null => {
  const strictLookupConfig = typeof getSessionConfigBySlugOrDefaultFn === 'function'
    ? getSessionConfigBySlugOrDefaultFn(sessionSlug)
    : null;
  const isUnresolved = typeof isUnresolvedSessionConfigFn === 'function'
    ? isUnresolvedSessionConfigFn
    : isUnresolvedSessionConfig;
  if (strictLookupConfig && !isUnresolved(strictLookupConfig)) {
    return strictLookupConfig;
  }
  if (!allowDemoSessionFallback) {
    return strictLookupConfig || null;
  }
  const demoLookupConfig = typeof getDemoSessionConfigBySlugFn === 'function'
    ? getDemoSessionConfigBySlugFn(sessionSlug, { allowDemoFallback: true })
    : null;
  return demoLookupConfig || strictLookupConfig || null;
};

export const getNormalizedDiscoveryOverride = (props: unknown = {}): string[] => {
  const record = isRecord(props) ? props : {};
  if (!Array.isArray(record.discoverySessionSlugs) || record.discoverySessionSlugs.length === 0) {
    return [];
  }
  return normalizeDiscoverySlugs(record.discoverySessionSlugs, { allowEmpty: true });
};

export const resolveSbtSelectorScopeMode = ({
  discoveryOverride = [],
  groupOverride = false,
  readSessionScanScope: readSessionScanScopeFn = null,
}: ResolveSbtSelectorScopeModeArgs = {}): string => {
  if (groupOverride) return 'override';
  if (Array.isArray(discoveryOverride) && discoveryOverride.length > 0) return 'explicit';
  return String(typeof readSessionScanScopeFn === 'function' ? readSessionScanScopeFn() : '');
};

export const buildSbtSelectorGroupOptions = ({
  getSessionLabel = null,
  slugs = [],
}: BuildSbtSelectorGroupOptionsArgs = {}): SbtSelectorGroupOption[] => (
  (Array.isArray(slugs) ? slugs : [])
    .map((slug: unknown) => ({
      value: String(slug || ''),
      label: typeof getSessionLabel === 'function'
        ? getSessionLabel(slug)
        : String(slug || ''),
    }))
);

export const buildSbtSelectorAutoSearchSessionOptions = ({
  autoSearchOtherSessions = false,
  directlyInvokedTargetSlugs = [],
  enableGroupSelect = false,
  groupOptions = [],
  groupOverride = false,
  sourceSessionSlug = '',
}: BuildSbtSelectorAutoSearchSessionOptionsArgs = {}): SbtSelectorGroupOption[] => {
  if (!enableGroupSelect) return [];
  if (!autoSearchOtherSessions) return [];
  const hiddenSlugSet = new Set<string>(normalizeDiscoverySlugs(directlyInvokedTargetSlugs, { allowEmpty: true }));
  if (groupOverride) {
    hiddenSlugSet.add(normalizeSessionSlug(sourceSessionSlug));
  }
  return (Array.isArray(groupOptions) ? groupOptions : [])
    .map((option: unknown) => {
      const record = isRecord(option) ? option as SbtSelectorGroupOption : { value: '', label: '' };
      return {
        ...record,
        value: normalizeSessionSlug(record.value || ''),
      };
    })
    .filter((option: SbtSelectorGroupOption) => !hiddenSlugSet.has(option.value));
};

export const normalizeSbtCacheForNet = (
  cacheIn: unknown,
  netKey: unknown
): Record<string, SbtCacheNetNode> => {
  const cacheObj = isRecord(cacheIn) ? { ...cacheIn } as Record<string, SbtCacheNetNode> : {};
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
      netKey
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
    ? resolvedAggregatedSbtList as SbtSelectorScopedEntryMap
    : {};
  const touchedContexts = new Set<SbtSelectorCacheContext>();
  (Array.isArray(results) ? results : []).forEach((resultInput) => {
    const result = isRecord(resultInput) ? resultInput as SbtSelectorHydrationResultLike : null;
    if (!result) return;
    const context = isRecord(result.context) ? result.context as SbtSelectorCacheContext : null;
    const address = String(result.address || '').trim();
    const lower = String(result.lower || address).trim().toLowerCase();
    if (!context || !address || !lower) return;

    if (!isRecord(context.sbtList)) context.sbtList = {};
    const aggregatedKey = buildSbtLookupKey({ address, chainId: context.chainId });
    const existingScoped = isRecord(context.sbtList[lower])
      ? context.sbtList[lower] as SbtSelectorScopedEntry
      : {};
    const existingAggregated = isRecord(aggregatedList[aggregatedKey])
      ? aggregatedList[aggregatedKey] as SbtSelectorScopedEntry
      : {};
    const resolvedInfo = (
      result.sbtInfo ||
      existingScoped.sbtInfo ||
      existingAggregated.sbtInfo ||
      null
    ) as SbtSelectorScopedEntry['sbtInfo'];
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
      context.slug
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
  const normalizeSlugs = typeof normalizeDiscoverySlugsFn === 'function'
    ? normalizeDiscoverySlugsFn
    : normalizeDiscoverySlugs;
  const slugsToRead = normalizeSlugs(
    Array.isArray(targetSlugs) && targetSlugs.length > 0
      ? targetSlugs
      : [((scopeMode === 'general' && resolvedEffectiveSlug !== '') ? '' : resolvedEffectiveSlug)],
    { allowEmpty: true }
  );
  const ignored = new Set<string>();
  slugsToRead.forEach((targetSlug: string) => {
    const listSlug = (scopeMode === 'general' && targetSlug !== '') ? '' : targetSlug;
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
  const normalizeSlugs = typeof normalizeDiscoverySlugsFn === 'function'
    ? normalizeDiscoverySlugsFn
    : normalizeDiscoverySlugs;
  const readFeaturedList = typeof getCanonicalSessionFeaturedSBTsFn === 'function'
    ? getCanonicalSessionFeaturedSBTsFn
    : () => [];
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
    const displayLookupCfg = typeof getDisplayLookupSessionConfigFn === 'function'
      ? getDisplayLookupSessionConfigFn(targetSlug)
      : null;
    const propsFeatured = typeof shouldUsePropsSessionConfigForSlugFn === 'function' &&
      shouldUsePropsSessionConfigForSlugFn(targetSlug)
      ? readFeaturedList(sessionConfig)
      : [];
    const configFeatured = targetSlug !== resolvedEffectiveSlug
      ? readFeaturedList(displayLookupCfg)
      : [];
    const sessionLists = typeof getSessionListsFn === 'function' ? getSessionListsFn(targetSlug) : {};
    const featuredList = isRecord(sessionLists) ? sessionLists.featured_SBTs_LIST : [];
    addEntries(propsFeatured, targetSlug);
    addEntries(configFeatured, targetSlug);
    addEntries(featuredList, targetSlug);
  });
  return out;
};

export const buildSbtOptionsByAddress = <T extends Record<string, unknown> = Record<string, unknown>>(
  sbtOptionsInput: unknown
): Map<string, T> => {
  const byAddress = new Map<string, T>();
  (Array.isArray(sbtOptionsInput) ? sbtOptionsInput : []).forEach((entry: unknown) => {
    const record = isRecord(entry) ? entry as T : null;
    if (!record) return;
    const key = String(record.address || '').toLowerCase();
    if (!key || byAddress.has(key)) return;
    byAddress.set(key, record);
  });
  return byAddress;
};

export const buildSbtOptionsBySelectionKey = <T extends Record<string, unknown> = Record<string, unknown>>(
  sbtOptionsInput: unknown
): Map<string, T> => {
  const bySelectionKey = new Map<string, T>();
  (Array.isArray(sbtOptionsInput) ? sbtOptionsInput : []).forEach((entry: unknown) => {
    const record = isRecord(entry) ? entry as T : null;
    if (!record) return;
    const key = getSelectableSbtKey(record);
    if (!key || bySelectionKey.has(key)) return;
    bySelectionKey.set(key, record);
  });
  return bySelectionKey;
};

export const buildSbtSelectorMergedSelectableOptions = <T extends Record<string, unknown> = Record<string, unknown>>({
  additionalOptions = [],
  sbtOptions = [],
}: BuildSbtSelectorMergedSelectableOptionsArgs = {}): T[] => {
  const baseOptions = Array.isArray(sbtOptions) ? sbtOptions as T[] : [];
  const extraOptions = Array.isArray(additionalOptions) ? additionalOptions as T[] : [];
  return [
    ...baseOptions,
    ...extraOptions.filter((entry: T) => (
      !baseOptions.some((existing: T) => (
        String(existing?.address || '').toLowerCase() === String(entry?.address || '').toLowerCase()
      ))
    )),
  ];
};

export const resolveSbtSelectorDisplayOptions = <T extends Record<string, unknown> = Record<string, unknown>>({
  defaultFeaturedSBTs = [],
  limitToFeatured = false,
  mergedSbtOptions = [],
  scopeFeaturedAddresses = [],
}: ResolveSbtSelectorDisplayOptionsArgs = {}): ResolveSbtSelectorDisplayOptionsResult<T> => {
  const options = Array.isArray(mergedSbtOptions) ? mergedSbtOptions as T[] : [];
  const effectiveFeatured = (
    Array.isArray(scopeFeaturedAddresses) && scopeFeaturedAddresses.length > 0
      ? scopeFeaturedAddresses
      : (Array.isArray(defaultFeaturedSBTs) ? defaultFeaturedSBTs : [])
  );
  const hasFeaturedSBTs = effectiveFeatured.length > 0;
  if (!hasFeaturedSBTs || limitToFeatured !== true) {
    return { displayOptions: options, effectiveFeatured, hasFeaturedSBTs };
  }

  const featuredLower = new Set<string>(
    effectiveFeatured.map((addr: unknown) => String(addr || '').toLowerCase())
  );
  return {
    displayOptions: options.filter((opt: T) => (
      featuredLower.has(String(opt?.address || '').toLowerCase())
    )),
    effectiveFeatured,
    hasFeaturedSBTs,
  };
};

export const buildSbtSelectorSelectOptions = (displayOptions: unknown): SbtSelectorSelectOption[] => (
  (Array.isArray(displayOptions) ? displayOptions : []).map((sbt: unknown) => {
    const record = isRecord(sbt) ? sbt : {};
    return {
      value: String(record.address || ''),
      selectionKey: getSelectableSbtKey(record),
      label: String(record.name || ''),
      image: record.image,
      chainId: record.chainId,
    };
  })
);

export const buildSelectedSbtKeySet = (selectedSbts: unknown): Set<string> => (
  new Set(
    (Array.isArray(selectedSbts) ? selectedSbts : [])
      .map((sbt: unknown) => getSelectableSbtKey(sbt))
      .filter(Boolean)
  )
);

export const buildSelectedSbtAddressSet = (selectedSbts: unknown): Set<string> => (
  new Set(
    (Array.isArray(selectedSbts) ? selectedSbts : [])
      .map((sbt: unknown) => {
        const record = isRecord(sbt) ? sbt : {};
        return normalizeSelectableSbtAddress(record.address);
      })
      .filter(Boolean)
  )
);

export const buildEffectiveFeaturedAddressSet = ({
  scopeFeaturedAddresses,
  defaultFeaturedSBTs,
}: {
  defaultFeaturedSBTs?: unknown;
  scopeFeaturedAddresses?: unknown;
} = {}): Set<string> => (
  new Set(
    (
      Array.isArray(scopeFeaturedAddresses) && scopeFeaturedAddresses.length > 0
        ? scopeFeaturedAddresses
        : (Array.isArray(defaultFeaturedSBTs) ? defaultFeaturedSBTs : [])
    )
      .map((address: unknown) => normalizeSelectableSbtAddress(address))
      .filter(Boolean)
  )
);

export const buildSbtSelectorSelectedDisplayEntries = ({
  currentSessionSlug = '',
  resolveSbtLabel = () => '',
  sbtOptionsByAddress = new Map(),
  sbtOptionsBySelectionKey = new Map(),
  selectedSbts = [],
}: BuildSbtSelectorSelectedDisplayEntriesArgs = {}): unknown[] => (
  (Array.isArray(selectedSbts) ? selectedSbts : []).map((sbt: unknown) => {
    const record = isRecord(sbt) ? sbt : {};
    const address = String(record.address || '').toLowerCase();
    if (!address) return sbt;
    const fromOptions = (
      sbtOptionsBySelectionKey.get(getSelectableSbtKey(record)) ||
      sbtOptionsByAddress.get(address)
    );
    const resolvedName =
      fromOptions?.name ||
      record.name ||
      resolveSbtLabel(
        record.sbtInfo || null,
        address,
        pickNormalizedSessionSlug(record.sessionSlug, currentSessionSlug)
      );
    const sessionBindingSlug = pickOptionalNormalizedSessionSlug(
      fromOptions && hasOwn(fromOptions, 'sessionBindingSlug') ? fromOptions.sessionBindingSlug : undefined,
      hasOwn(record, 'sessionBindingSlug') ? record.sessionBindingSlug : undefined
    );
    return {
      ...record,
      name: resolvedName || record.name || record.address,
      image: fromOptions?.image || record.image || null,
      sessionName: fromOptions?.sessionName || record.sessionName || null,
      sessionSlug: pickNormalizedSessionSlug(fromOptions?.sessionSlug, record.sessionSlug, currentSessionSlug),
      ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
    };
  })
);

export const hasSelectedOrPendingSbtSelectorAddress = ({
  address = '',
  pendingAddresses = null,
  selectedAddresses = null,
}: SbtSelectorSelectedOrPendingAddressArgs = {}): boolean => {
  const normalizedAddress = normalizeSelectableSbtAddress(address);
  if (!normalizedAddress) return false;
  return !!(
    selectedAddresses?.has(normalizedAddress) ||
    pendingAddresses?.has(normalizedAddress)
  );
};

export const hasSelectedOrPendingSbtSelectorKey = ({
  pendingKeys = null,
  selectedKeys = null,
  value = null,
}: SbtSelectorSelectedOrPendingKeyArgs = {}): boolean => {
  const normalizedKey = getSelectableSbtKey(value);
  if (!normalizedKey) return false;
  return !!(
    selectedKeys?.has(normalizedKey) ||
    pendingKeys?.has(normalizedKey)
  );
};

export const pickNormalizedSessionSlug = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return '';
};

export const pickOptionalNormalizedSessionSlug = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return null;
};

export const hasOwn = (value: unknown, key: PropertyKey): boolean => (
  isRecord(value) &&
  Object.prototype.hasOwnProperty.call(value, key)
);

export const buildScopedSbtIgnoreKey = ({ slug, address }: ScopedSbtIgnoreKeyArgs = {}): string => {
  const lowerAddress = String(address || '').trim().toLowerCase();
  if (!lowerAddress) return '';
  return `${pickNormalizedSessionSlug(slug)}|${lowerAddress}`;
};

export const hasAuthoritativeSessionSlug = (value: unknown): boolean => {
  const record = isRecord(value) ? value : {};
  if (!hasOwn(value, 'sessionSlug')) return false;
  const hasExplicitFlag = hasOwn(value, 'sessionSlugExplicit');
  return record.sessionSlugExplicit === true || !hasExplicitFlag;
};

export const resolveAuthoritativeSbtSessionBindingSlug = (sbt: unknown): string | null => {
  const record = isRecord(sbt) ? sbt as SbtSessionSlugRecord : {};
  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};

  if (hasAuthoritativeSessionSlug(sbtInfo)) {
    return normalizeSessionSlug(sbtInfo.sessionSlug || '');
  }
  if (hasAuthoritativeSessionSlug(record)) {
    return normalizeSessionSlug(record.sessionSlug || '');
  }

  const legacySlugRaw = sbtInfo.slug;
  if (legacySlugRaw != null && String(legacySlugRaw).trim() !== '') {
    return normalizeSessionSlug(legacySlugRaw);
  }
  return null;
};

export const resolveDeclaredSbtSessionSlug = (sbt: unknown): string | null => {
  const record = isRecord(sbt) ? sbt as SbtSessionSlugRecord : {};
  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};
  if (hasOwn(sbtInfo, 'sessionSlug')) {
    return normalizeSessionSlug(sbtInfo.sessionSlug || '');
  }
  if (hasOwn(record, 'sessionSlug')) {
    return normalizeSessionSlug(record.sessionSlug || '');
  }
  return null;
};

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
  const entry = isRecord(sbt) ? sbt as SbtSelectorScopedEntry : {};
  const sbtInfo = isRecord(entry.sbtInfo) ? entry.sbtInfo : null;
  const sbtAddressOrNull = entry.sbtAddress;
  if (!sbtAddressOrNull) return null;
  const address = String(sbtAddressOrNull).toLowerCase();
  const chainId = resolveSbtEntryChainId(entry);
  const resolvedSlug = pickNormalizedSessionSlug(
    hasOwn(entry, 'sessionBindingSlug') ? entry.sessionBindingSlug : undefined,
    entry.slug,
    fallbackSlug
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
      const entryRecord = isRecord(entry) ? entry as SbtSelectorScopedEntry : {};
      return {
        address: String(entryRecord.sbtAddress || '').trim(),
        slug: pickNormalizedSessionSlug(
          hasOwn(entryRecord, 'sessionBindingSlug') ? entryRecord.sessionBindingSlug : undefined,
          entryRecord.slug,
          fallbackSlug
        ),
      };
    })
    .filter((entry: SbtSelectorNameHydrationEntry) => Boolean(entry.address) && ethers.utils.isAddress(String(entry.address)))
    .filter((entry: SbtSelectorNameHydrationEntry) => {
      const entryKey = String(entry.address || '').toLowerCase();
      const keyedEntry = isRecord(list[entryKey]) ? list[entryKey] as SbtSelectorScopedEntry : {};
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

export const resolveConcreteSbtSessionBindingSlug = (sbt: unknown): string | null => {
  const record = isRecord(sbt) ? sbt as SbtSessionSlugRecord : {};
  const authoritativeSlug = resolveAuthoritativeSbtSessionBindingSlug(sbt);
  if (authoritativeSlug != null) return authoritativeSlug;

  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};

  const hasInferredSessionSlug = (
    (hasOwn(sbtInfo, 'sessionSlug') && sbtInfo.sessionSlugExplicit === false) ||
    (hasOwn(record, 'sessionSlug') && record.sessionSlugExplicit === false)
  );
  if (hasInferredSessionSlug) return null;

  const legacySessionName = String(
    sbtInfo.sessionName ??
    record.sessionName ??
    ''
  ).trim();
  if (!legacySessionName) return null;

  const mappedSlug = getSessionSlugByName(legacySessionName);
  if (mappedSlug == null) return null;
  return normalizeSessionSlug(mappedSlug);
};

export const resolveSbtDetailLinkSessionSlug = ({
  sbt,
  fallbackSlug = '',
}: SbtDetailLinkSessionSlugArgs = {}): string => {
  const record = isRecord(sbt) ? sbt : {};
  const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};
  const explicitBindingSlug = pickOptionalNormalizedSessionSlug(
    hasOwn(record, 'sessionBindingSlug') ? record.sessionBindingSlug : undefined,
    hasAuthoritativeSessionSlug(sbtInfo)
      ? normalizeSessionSlug(sbtInfo.sessionSlug || '')
      : undefined,
    (hasOwn(record, 'sessionSlug') && record.sessionSlugExplicit === true)
      ? normalizeSessionSlug(record.sessionSlug || '')
      : undefined
  );
  if (explicitBindingSlug != null) return explicitBindingSlug;

  const metadataSessionName = String(
    sbtInfo.sessionName ??
    record.sessionName ??
    ''
  ).trim();
  if (metadataSessionName) {
    const byName = getSessionSlugByName(metadataSessionName);
    if (byName != null) return normalizeSessionSlug(byName);
  }

  const existingSelectedSlug = pickOptionalNormalizedSessionSlug(record.sessionSlug);
  if (existingSelectedSlug != null) return existingSelectedSlug;

  return pickNormalizedSessionSlug(fallbackSlug);
};

export const buildFeaturedEntrySignature = (entries: unknown): string => (
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const record = isRecord(entry) ? entry as SbtSelectorScopedEntryLike : {};
      const slug = normalizeSessionSlug(record.slug || '');
      const address = String(record.address || '').trim().toLowerCase();
      return `${slug}:${address}`;
    })
    .filter((value) => value !== ':')
    .join(',')
);

export const resolveSbtEntryChainId = (entry: unknown, fallbackChainId: unknown = null): number | null => {
  const record = isRecord(entry) ? entry as SbtSelectorScopedEntryLike : {};
  return normalizeChainValue(
    record.chainId ||
    record.sbtInfo?.chainId ||
    record.sbtInfo?.chainID ||
    fallbackChainId
  );
};

export const decorateScopedSbtEntry = (
  entry: unknown,
  fallbackSlug: unknown = ''
): SbtSelectorScopedEntry => {
  const next = isRecord(entry) ? { ...entry } as SbtSelectorScopedEntry : {};
  const sourceSlug = pickNormalizedSessionSlug(
    hasOwn(next, '__sourceSessionSlug') ? next.__sourceSessionSlug : undefined,
    next.slug,
    fallbackSlug
  );
  const sessionBindingSlug = pickOptionalNormalizedSessionSlug(
    hasOwn(next, 'sessionBindingSlug') ? next.sessionBindingSlug : undefined,
    resolveConcreteSbtSessionBindingSlug({
      ...next,
      slug: sourceSlug,
      __sourceSessionSlug: sourceSlug,
    })
  );
  return {
    ...next,
    chainId: resolveSbtEntryChainId(next),
    slug: pickNormalizedSessionSlug(next.slug, fallbackSlug),
    __sourceSessionSlug: sourceSlug,
    ...(sessionBindingSlug != null ? { sessionBindingSlug } : {}),
  };
};

export const shouldPreferIncomingScopedSbtEntry = (
  existingEntry: unknown,
  incomingEntry: unknown
): boolean => {
  const existing = isRecord(existingEntry)
    ? existingEntry as SbtSelectorScopedEntry
    : null;
  const incoming = isRecord(incomingEntry)
    ? incomingEntry as SbtSelectorScopedEntry
    : null;
  if (!incoming) return false;

  const existingNamed = hasSbtDisplayName(existing?.sbtInfo || null);
  const incomingNamed = hasSbtDisplayName(incoming.sbtInfo || null);
  if (!existingNamed && incomingNamed) return true;
  return !existing?.sbtInfo?.image && !!incoming.sbtInfo?.image;
};

export const mergeScopedSbtEntry = (
  existingEntry: unknown,
  incomingEntry: unknown,
  fallbackSlug: unknown = ''
): SbtSelectorScopedEntry | null => {
  const existing = isRecord(existingEntry)
    ? decorateScopedSbtEntry(existingEntry, fallbackSlug)
    : null;
  const incoming = isRecord(incomingEntry)
    ? decorateScopedSbtEntry(incomingEntry, fallbackSlug)
    : null;
  const mergedBindingSlug = pickOptionalNormalizedSessionSlug(
    existing && hasOwn(existing, 'sessionBindingSlug') ? existing.sessionBindingSlug : undefined,
    incoming && hasOwn(incoming, 'sessionBindingSlug') ? incoming.sessionBindingSlug : undefined
  );
  const finalizeEntry = (entry: SbtSelectorScopedEntry | null): SbtSelectorScopedEntry | null => {
    if (!entry) return null;
    return {
      ...entry,
      chainId: resolveSbtEntryChainId(entry),
      slug: pickNormalizedSessionSlug(entry.slug, fallbackSlug),
      __sourceSessionSlug: pickNormalizedSessionSlug(
        hasOwn(entry, '__sourceSessionSlug') ? entry.__sourceSessionSlug : undefined,
        entry.slug,
        fallbackSlug
      ),
      ...(mergedBindingSlug != null ? { sessionBindingSlug: mergedBindingSlug } : {}),
    };
  };
  if (!existing) {
    return incoming ? finalizeEntry(incoming) : null;
  }
  if (!incoming) return finalizeEntry(existing);

  if (shouldPreferIncomingScopedSbtEntry(existing, incoming)) {
    return finalizeEntry({
      ...existing,
      ...incoming,
      slug: pickNormalizedSessionSlug(existing.slug, incoming.slug, fallbackSlug),
    });
  }

  return finalizeEntry(existing);
};

export const applySbtSelectorDiscoveredAddressesToList = ({
  addresses = [],
  resolvedSlug = '',
  sbtList = {},
}: ApplySbtSelectorDiscoveredAddressesToListArgs = {}): ApplySbtSelectorDiscoveredAddressesToListResult => {
  const list = isRecord(sbtList) ? sbtList as SbtSelectorScopedEntryMap : {};
  const uniqueDiscovered: string[] = Array.from(new Set(
    (Array.isArray(addresses) ? addresses : [])
      .map((value: unknown) => String(value || '').trim())
      .filter((value: string) => ethers.utils.isAddress(value))
  ));
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
      resolvedSlug
    );
    const existingAddress = String(existing?.sbtAddress || '').trim().toLowerCase();
    const existingSlug = hasOwn(existing, 'slug')
      ? normalizeSessionSlug(existing?.slug || '')
      : null;
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
  const list = isRecord(sbtList) ? sbtList as SbtSelectorScopedEntryMap : {};
  const lookupState = isRecord(nameLookupState) ? nameLookupState as SbtNameLookupState : {};
  const timestamp = Number(now || 0) || Date.now();
  (Array.isArray(results) ? results : []).forEach((resultInput: unknown) => {
    const result = isRecord(resultInput) ? resultInput as SbtSelectorAddressHydrationResultLike : null;
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
      resolvedSlug
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
  const cache = isRecord(latestCache)
    ? latestCache as Record<string, SbtCacheNetNode>
    : {};
  const key = String(netKey || '');
  if (!isRecord(cache[key])) {
    cache[key] = { sbtList: {} };
  }
  const currentList = isRecord(sbtList) ? sbtList as SbtSelectorScopedEntryMap : {};
  const latestSbtList = { ...(isRecord(cache[key].sbtList) ? cache[key].sbtList : {}) };
  Object.entries(latestSbtList).forEach(([address, entry]) => {
    const entryRecord = isRecord(entry) ? entry as SbtSelectorScopedEntry : {};
    currentList[address] = mergeScopedSbtEntry(
      currentList[address],
      decorateScopedSbtEntry(entryRecord, resolvedSlug),
      resolvedSlug
    );
  });
  const nextNameLookupState = {
    ...ensureNameLookupStateImpl(cache, key),
    ...(isRecord(nameLookupState) ? nameLookupState as SbtNameLookupState : {}),
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
  const list = isRecord(sbtList) ? sbtList as SbtSelectorScopedEntryMap : {};
  const linkedList = isRecord(linkedScopedSbtList)
    ? linkedScopedSbtList as SbtSelectorScopedEntryMap
    : {};
  Object.entries(linkedList).forEach(([address, entry]) => {
    const entryRecord = isRecord(entry) ? entry as SbtSelectorScopedEntry : {};
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
  const list = isRecord(sbtList) ? sbtList as SbtSelectorScopedEntryMap : {};
  const lookupState = isRecord(nameLookupState) ? nameLookupState as SbtNameLookupState : {};
  const lookupNow = Number(now || 0) || Date.now();
  const uniqueAddresses: string[] = Array.from(new Set(
    (Array.isArray(addresses) ? addresses : [])
      .map((address: unknown) => String(address || '').trim())
      .filter(Boolean)
  ));
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

export const buildAggregatedSbtSelectorListFromContexts = (
  contexts: unknown = []
): SbtSelectorScopedEntryMap => {
  const out: SbtSelectorScopedEntryMap = {};
  (Array.isArray(contexts) ? contexts : []).forEach((contextInput: unknown) => {
    const context = isRecord(contextInput) ? contextInput as SbtSelectorCacheContextLike : null;
    if (!context) return;
    const fallbackSlug = normalizeSessionSlug(context.slug || '');
    Object.entries(context.sbtList || {}).forEach(([address, entry]) => {
      const entryRecord = isRecord(entry) ? entry as SbtSelectorScopedEntry : {};
      const decoratedEntry = decorateScopedSbtEntry({
        ...entryRecord,
        sbtAddress: entryRecord.sbtAddress || address,
        chainId: resolveSbtEntryChainId(entryRecord, context.chainId),
      }, fallbackSlug);
      const lookupKey = buildSbtLookupKey({
        address: decoratedEntry.sbtAddress || address,
        chainId: decoratedEntry.chainId || context.chainId,
      });
      if (!lookupKey) return;
      out[lookupKey] = mergeScopedSbtEntry(
        out[lookupKey],
        decoratedEntry,
        fallbackSlug
      );
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
  const entry = isRecord(scopedEntry) ? scopedEntry as SbtSelectorScopedEntry : null;
  if (!entry || !targetSlugSet || targetSlugSet.size <= 0) return null;

  const resolvedSourceSlug = pickNormalizedSessionSlug(
    entry.__sourceSessionSlug,
    sourceSlug
  );
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
  const targetSlugSet = new Set<string>(
    normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true })
  );
  if (targetSlugSet.size === 0) return {};

  const out: SbtSelectorScopedEntryMap = {};
  (Array.isArray(knownEntries) ? knownEntries : []).forEach((knownEntry: unknown) => {
    const knownRecord = isRecord(knownEntry) ? knownEntry : {};
    const sourceSlug = normalizeSessionSlug(knownRecord.slug || '');
    const cacheValue = isRecord(knownRecord.value) ? knownRecord.value : null;
    if (!cacheValue) return;

    Object.entries(cacheValue).forEach(([netKey, netNodeInput]) => {
      const netNode = isRecord(netNodeInput) ? netNodeInput as SbtCacheNetNode : null;
      const sbtList = isRecord(netNode?.sbtList)
        ? netNode.sbtList
        : null;
      if (!sbtList) return;
      const cachedChainId = normalizeChainValue(netKey);

      Object.entries(sbtList).forEach(([cacheAddress, entry]) => {
        const entryRecord = isRecord(entry) ? entry as SbtSelectorScopedEntry : {};
        const scopedEntry = decorateScopedSbtEntry({
          ...entryRecord,
          sbtAddress: entryRecord.sbtAddress || cacheAddress,
          chainId: resolveSbtEntryChainId(entryRecord, cachedChainId),
          __sourceSessionSlug: sourceSlug,
          slug: pickNormalizedSessionSlug(entryRecord.slug, sourceSlug),
        }, sourceSlug);
        const entryAddress = String(scopedEntry.sbtAddress || '').trim().toLowerCase();
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
    const record = isRecord(entry) ? entry as SbtSelectorScopedEntry : {};
    const lower = String(record.address || '').trim().toLowerCase();
    if (!lower || featuredOrder.has(lower)) return;
    featuredOrder.set(lower, index);
  });
  return featuredOrder;
};

export const buildSbtSelectorScopeFeaturedAddresses = (featuredEntries: unknown = []): string[] => (
  (Array.isArray(featuredEntries) ? featuredEntries : [])
    .map((entry: unknown) => {
      const record = isRecord(entry) ? entry as SbtSelectorScopedEntry : {};
      return String(record.address || '').trim().toLowerCase();
    })
    .filter(Boolean)
);

export const areSbtSelectorAddressListsEqual = (left: unknown, right: unknown): boolean => {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];
  return (
    leftList.length === rightList.length &&
    leftList.every((address: unknown, index: number) => address === rightList[index])
  );
};

export const buildSbtSelectorOptionsStatePatch = ({
  currentLoadingOptions = undefined,
  currentSbtOptions = [],
  currentScopeFeaturedAddresses = [],
  featuredEntries = [],
  loadingOptions = undefined,
  sbtOptions = [],
}: BuildSbtSelectorOptionsStatePatchArgs = {}): Record<string, unknown> => {
  const nextPatch: Record<string, unknown> = {};
  if (!areSbtOptionsEqual(currentSbtOptions, sbtOptions)) nextPatch.sbtOptions = sbtOptions;
  const scopeFeaturedAddresses = buildSbtSelectorScopeFeaturedAddresses(featuredEntries);
  const prevFeatured = Array.isArray(currentScopeFeaturedAddresses)
    ? currentScopeFeaturedAddresses
    : [];
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
  featuredOrderInput: unknown = new Map<string, number>()
): number => {
  const left = asComparableSbtOption(leftInput);
  const right = asComparableSbtOption(rightInput);
  const featuredOrder = featuredOrderInput instanceof Map
    ? featuredOrderInput as Map<string, number>
    : new Map<string, number>();
  const leftMasked = left?.maskedTitleHidden === true;
  const rightMasked = right?.maskedTitleHidden === true;
  if (leftMasked !== rightMasked) return leftMasked ? 1 : -1;

  const leftAddress = String(left.address || '');
  const rightAddress = String(right.address || '');
  const leftFeaturedRank = featuredOrder.has(leftAddress)
    ? featuredOrder.get(leftAddress) ?? Number.MAX_SAFE_INTEGER
    : Number.MAX_SAFE_INTEGER;
  const rightFeaturedRank = featuredOrder.has(rightAddress)
    ? featuredOrder.get(rightAddress) ?? Number.MAX_SAFE_INTEGER
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

  const ignoredAddressSet = ignoredSet instanceof Set ? ignoredSet as Set<string> : new Set<string>();
  const sbtOptionsMap = new Map<string, SbtSelectorBuiltOption>();
  Object.values(isRecord(sbtList) ? sbtList as SbtSelectorScopedEntryMap : {}).forEach((sbt) => {
    if (!sbt) return;
    const optionContext = resolveSbtSelectorOptionEntryContext({
      fallbackSlug,
      sbt,
    });
    if (!optionContext) {
      if (typeof onMissingAddress === 'function') onMissingAddress(sbt);
      return;
    }
    const {
      address,
      chainId,
      isManual,
      resolvedSlug,
      sbtInfo,
      selectionKey,
    } = optionContext;
    if (shouldSkipSbtSelectorEntryForOptions({
      address,
      ignoredAddressSet,
      isManual,
      resolvedSlug,
      sbtInfo,
      sbtOptionsMap,
      selectionKey,
    })) return;
    if (listScopeTargetSlugSet) {
      const declaredSessionSlug = resolveDeclaredSbtSessionSlug(sbt);
      const scopedBucketSlug = resolvedSlug;
      const hasVisibleMetadata = hasSbtDisplayName(sbtInfo);
      if (!shouldIncludeSbtSelectorEntryForListScope({
        declaredSessionSlug,
        hasVisibleMetadata,
        listScopeTargetSlugSet,
        scopedBucketSlug,
      })) return;
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

  return Array.from(sbtOptionsMap.values()).sort(
    (left, right) => compareSbtSelectorOptions(left, right, featuredOrder)
  );
};

export const buildSessionConfigSig = (sessionConfig: unknown): string => {
  const config = isRecord(sessionConfig) ? sessionConfig as SbtSelectorSessionConfigSigLike : null;
  if (!config) return '';
  const slug = String(config.slug || '');
  const factoryAddress = String(config.contracts?.sbtFactory?.address || '').trim().toLowerCase();
  const networkChainId = normalizeChainValue(
    config.networkChainId ||
    config.__registry?.chainId ||
    config.contracts?.sbtFactory?.chainId ||
    0
  );
  const blockStart = String(Number(config.blockLimits?.start || 0) || '');
  const blockEnd = String(Number(config.blockLimits?.end || 0) || '');
  return [slug, factoryAddress, String(networkChainId || ''), blockStart, blockEnd].join('|');
};

export const buildSbtOptionsRequestSignature = ({
  slug,
  cacheRevision,
  sessionConfigSig,
  targetSlugChainSig,
  featuredEntries,
  ignoredFromConfig,
}: SbtOptionsRequestSignatureArgs): string => {
  return [
    String(slug || ''),
    String(cacheRevision ?? ''),
    String(sessionConfigSig || ''),
    String(targetSlugChainSig || ''),
    buildFeaturedEntrySignature(featuredEntries),
    normalizeAddressListForSig(ignoredFromConfig).join(','),
  ].join('|');
};

export const isUnresolvedSessionConfig = (config: unknown): boolean => (
  isRecord(config) &&
  config.__unresolved === true
);

export const isMaskedSbtOptionLabel = (value: unknown): boolean => (
  String(value || '').trim().toLowerCase() === MASKED_SBT_LABEL
);

export const isMaskedHiddenTitle = ({ label = '', sbtInfo = null }: SbtSelectorHiddenTitleArgs = {}): boolean => {
  if (!isMaskedSbtOptionLabel(label)) return false;
  if (!isRecord(sbtInfo)) return true;
  const info = sbtInfo as SbtSelectorHiddenTitleInfo;
  const visibleName = (
    String(info.name || '').trim() ||
    String(info.title || '').trim() ||
    String(info.sessionName || '').trim()
  );
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
