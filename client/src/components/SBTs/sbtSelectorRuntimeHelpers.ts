import { CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS } from '../../variables/appConfig.js';
import {
  buildSessionConfigSig,
  getNormalizedNetworkChainValue,
  normalizeChainValue,
} from './sbtSelectorSessionRuntimeHelpers';

export const SBT_SELECTOR_DEBUG_STORAGE_KEY = 'ce:sbtSelectorDebug';
export const SBT_SELECTOR_DEBUG_QUERY_KEY = 'ceSbtSelectorDebug';

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
export type SbtSelectorUpdateEffects = {
  shouldEnsureUniverse: boolean;
  shouldHydrateSelectedNames: boolean;
  shouldKickoffSharedLightUniverse: boolean;
  shouldLoadOptions: boolean;
  shouldWarmRegistryCache: boolean;
};
export type SbtSelectorUpdateSignals = {
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

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

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
    const resolvedRuntime = typeof runtimeGlobal === 'undefined' ? getDefaultSbtSelectorRuntimeGlobal() : runtimeGlobal;
    if (resolvedRuntime && readBoolishDebugFlag(resolvedRuntime.CE_SBT_SELECTOR_DEBUG)) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    const resolvedWindow = typeof windowRef === 'undefined' ? getDefaultSbtSelectorWindow() : windowRef;
    if (resolvedWindow) {
      const params = new URLSearchParams(resolvedWindow.location?.search || '');
      if (params.has(SBT_SELECTOR_DEBUG_QUERY_KEY) && readBoolishDebugFlag(params.get(SBT_SELECTOR_DEBUG_QUERY_KEY))) {
        return true;
      }
    }
  } catch (_) {
    return false;
  }
  try {
    const resolvedLocalStorage =
      typeof localStorageRef === 'undefined' ? getDefaultSbtSelectorLocalStorage() : localStorageRef;
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
    const resolvedSessionStorage =
      typeof sessionStorageRef === 'undefined' ? getDefaultSbtSelectorSessionStorage() : sessionStorageRef;
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
  fallback: unknown = CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS,
): boolean => {
  try {
    if (isRecord(runtimeGlobal) && typeof runtimeGlobal.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS !== 'undefined') {
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
