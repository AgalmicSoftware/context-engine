import { ethers } from 'ethers';
import { createLogger } from 'utilities/logging.js';
import { getGlobalLitHooks } from '../crypto/litProtocol.js';
import { getAllowedSessionSlugs } from './sessionScanScope.js';
import { resolveSessionRegistryBootstrapChainIds } from './registryBootstrapChainIds.js';
import { normalizeSessionSlug } from '../web3/contractScripts.js';
import {
  fetchSessionFromRegistry,
  loadGroupRegistryCache,
  sessionRegistryStore,
  upsertSessionRegistryCache,
} from '../web3/sessionRegistry.js';
import type { SessionConfigLike as SharedSessionConfigLike } from './sessionTypes.js';
import {
  CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS,
  CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS,
  CE_PROFILE_SCAN_SBT_BURST_SIZE,
  CE_PROFILE_SCAN_SBT_TIMEOUT_MS,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS,
  DEFAULT_CHAIN_ID,
} from '../../variables/appConfig.js';
import { getSessionRegistryChainIds } from '../../variables/chains.js';
import {
  emitProfileScanColdDiag as emitMainSiteProfileScanColdDiag,
  emitProfileScanTelemetry as emitMainSiteProfileScanTelemetry,
  isProfileScanColdDiagEnabled as isMainSiteProfileScanColdDiagEnabled,
  isProfileScanTelemetryEnabled as isMainSiteProfileScanTelemetryEnabled,
} from './profileScanTelemetry.js';
import { shouldEnableSessionRegistryRefresh } from './mainSiteProgressHelpers.js';

const mainSiteLog = createLogger('mainSite');

const PROFILE_SCAN_REPORT_EVENT = 'ce:profile-scan-report';

type NullableChainIdInput = number | string | null | undefined;
type GeneralBackfillRunner = (slug: string) => Promise<unknown> | unknown;
type RuntimeGlobal = typeof globalThis & Record<string, unknown>;

interface SessionContractConfigLike {
  chainId?: NullableChainIdInput;
}

interface SessionContractsLike {
  surveys?: SessionContractConfigLike | null;
  sbtFactory?: SessionContractConfigLike | null;
}

type ProfileScanSessionConfig = Omit<SharedSessionConfigLike, 'contracts' | 'networkChainId'> & {
  networkChainId?: NullableChainIdInput;
  contracts?: SessionContractsLike | null;
};

interface SessionScanScopeContext {
  scope: string;
  list: string[];
  activeSlug?: string;
  activeSlugFromRoute?: boolean;
  [key: string]: unknown;
}

interface UserProfileAllSessionsScanMode {
  legacyAllSessions: boolean;
  useAllSessionsSbtScan: boolean;
  useAllSessionsSurveyActivityScan: boolean;
  useAllSessionsQuestionActivityScan: boolean;
  useAllSessionsActivityScan: boolean;
  useAllSessionsScan: boolean;
}

interface ReadProfileScanActivityLookbackBlocksOptions {
  useAllSessions?: boolean;
}

interface ResolveListScopeSessionConfigOptions extends Record<string, unknown> {
  targetAddress?: unknown;
}

interface RegistryAlternateRpcAttempt {
  attempted: boolean;
  improved: boolean;
  timedOut: boolean;
  hadLoadErrors: boolean;
  hadError: boolean;
  afterCount: number;
}

interface RegistryLoadMeta extends Record<string, unknown> {
  hadLoadErrors?: boolean;
  alternateRpcAttempt?: RegistryAlternateRpcAttempt;
}

interface RegistryHydrationStatus {
  hasEntries: boolean;
  timedOut: boolean;
  beforeCount: number;
  afterCount: number;
  hadLoadErrors: boolean;
  loadMeta: RegistryLoadMeta | null;
}

interface ResolveProfileDeepScanPlanOptions {
  registryStatus?: RegistryHydrationStatus | null;
  useAllSessionsScan?: boolean | null;
}

interface ProfileDeepScanPlan {
  slugs: string[];
  usedAllSessions: boolean;
  coverageComplete: boolean;
  coverageReason: string;
  registryEntryCount: number;
  hadLoadErrors?: boolean;
  rawAllSlugCount?: number;
  activeChainSlugCount?: number;
  scopedFallbackSlugCount?: number;
  relevantSlugs: string[];
  prioritizedGeneralFirst: boolean;
  scanOrdering: string;
}

interface EnqueueGeneralSessionBackfillOptions {
  operation?: string;
  activeSlug?: string;
  runGeneral?: GeneralBackfillRunner | null;
}

interface RunWithGeneralSessionBackfillOptions {
  slugIn?: string;
  operation?: string;
  runPrimary?: GeneralBackfillRunner | null;
  runGeneral?: GeneralBackfillRunner | null;
}

interface TelemetryContext {
  readBoolishRuntimeFlag: (raw: unknown, fallback?: boolean) => boolean;
  _profileScanTelemetrySeq: number;
  isProfileScanTelemetryEnabled: (...args: unknown[]) => boolean;
  emitProfileScanTelemetry: (event: string, payload?: Record<string, unknown>) => unknown;
  isProfileScanColdDiagEnabled: (...args: unknown[]) => boolean;
  emitProfileScanColdDiag: (event: string, payload?: Record<string, unknown>) => unknown;
}

interface GeneralBackfillSlot {
  inFlight: Promise<void> | null;
  pending: boolean;
  runGeneral: GeneralBackfillRunner | null;
  activeSlug: string;
}

export interface SessionProfileScanHost {
  getSessionScanScopeContext?: (scope?: unknown) => SessionScanScopeContext;
  getSessionSlugFromState?: () => string;
  getSessionChainId?: (slug?: string) => unknown;
  getNetworkId?: () => NullableChainIdInput;
  getSessionCfg?: (slug?: string) => unknown;
  getProvider?: () => unknown;
  getAccount?: () => unknown;
  getActiveSessionSlug?: () => string;
  getScopedSessionSlugs?: (scope: string) => string[];
  getScopeFilteredSlugs?: (slugs?: string[], scopeIn?: string | null) => string[];
  isMounted?: () => boolean;
  scanSpecificUserProfile?: (address: string) => Promise<unknown>;
  isSessionSlugAllowedForScan?: (slug: string, scopeContext: SessionScanScopeContext) => boolean;
}

export interface SessionProfileScanController {
  hasExplicitProfileScanScopeOverride: () => boolean;
  getProfileScanScopeContext: () => SessionScanScopeContext;
  readBoolishRuntimeFlag: (raw: unknown, fallback?: boolean) => boolean;
  getUserProfileAllSessionsScanMode: () => UserProfileAllSessionsScanMode;
  isUserProfileAllSessionsScanEnabled: () => boolean;
  getActiveProfileScanChainId: () => number | null;
  readProfileScanStepTimeoutMs: (kind?: string) => number;
  readProfileScanSbtBurstSize: () => number;
  readProfileScanActivityLookbackBlocks: (opts?: ReadProfileScanActivityLookbackBlocksOptions) => number;
  readUserProfileAllSessionsFlag: (runtimeKey: string, fallback?: boolean) => boolean;
  readProfileScanRegistryLookupTimeoutMs: () => number;
  getRegistrySessionEntryCount: () => number;
  getRegistrySessionCoverageCountForChain: (chainIdIn?: NullableChainIdInput) => number;
  getRegistryBootstrapScopeKey: (chainIdsIn?: Array<number | string> | null) => string;
  getProfileScanListScopeSessionConfigCacheKey: (slugIn: string, chainIdIn?: NullableChainIdInput) => string;
  resolveListScopeSessionConfigFromRegistry: (
    slugIn: string,
    opts?: ResolveListScopeSessionConfigOptions,
  ) => Promise<ProfileScanSessionConfig | null>;
  ensureRegistryHydratedForProfileScan: (opts?: Record<string, unknown>) => Promise<RegistryHydrationStatus>;
  isOnchainSessionRegistryEnabled: () => boolean;
  refreshSessionUniverseRegistryCache: () => Promise<unknown | null>;
  resolveProfileDeepScanPlan: (opts?: ResolveProfileDeepScanPlanOptions) => ProfileDeepScanPlan;
  getProfileDeepScanSlugs: () => string[];
  scheduleProfileScanRetryAfterRegistryHydration: (targetAddress: string, reason?: string) => void;
  shouldBackfillGeneralSession: (slugIn: string, scopeContextIn?: SessionScanScopeContext | null) => boolean;
  enqueueGeneralSessionBackfill: (opts?: EnqueueGeneralSessionBackfillOptions) => void;
  runWithGeneralSessionBackfill: (opts?: RunWithGeneralSessionBackfillOptions) => Promise<unknown | undefined>;
  emitProfileScanTelemetry: (event: string, payload?: Record<string, unknown>) => unknown;
  isProfileScanTelemetryEnabled: (...args: unknown[]) => boolean;
  isProfileScanColdDiagEnabled: (...args: unknown[]) => boolean;
  emitProfileScanColdDiag: (event: string, payload?: Record<string, unknown>) => unknown;
  destroy: () => void;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
};

const asProfileScanSessionConfig = (value: unknown): ProfileScanSessionConfig | null => {
  return value && typeof value === 'object' ? (value as ProfileScanSessionConfig) : null;
};

const asRegistryLoadMeta = (value: unknown): RegistryLoadMeta | null => {
  return value && typeof value === 'object' ? (value as RegistryLoadMeta) : null;
};

const readRuntimeGlobalValue = (key: string): unknown => {
  return (globalThis as RuntimeGlobal)[key];
};

const getErrorMessage = (error: unknown): string => {
  const errorRecord = asRecord(error);
  return String(errorRecord?.message || error);
};

const getSessionConfigChainId = (config: unknown, fallbackChainId: NullableChainIdInput = 0): number => {
  const cfg = asProfileScanSessionConfig(config);
  return (
    Number(
      cfg?.networkChainId ||
        cfg?.contracts?.surveys?.chainId ||
        cfg?.contracts?.sbtFactory?.chainId ||
        fallbackChainId ||
        0,
    ) || 0
  );
};

const normalizeSlugArray = (slugs: unknown): string[] => {
  return Array.from(
    new Set((Array.isArray(slugs) ? slugs : []).map((slug: unknown) => normalizeSessionSlug(slug || ''))),
  );
};

const getResultLoadMeta = (result: unknown): RegistryLoadMeta | null => {
  const resultRecord = asRecord(result);
  return asRegistryLoadMeta(resultRecord?.__loadMeta);
};

export const createSessionProfileScanController = (host: SessionProfileScanHost): SessionProfileScanController => {
  const hostApi = host as Required<SessionProfileScanHost>;
  let _registryBootstrapPromise: Promise<unknown> | null = null;
  let _registryBootstrapScopeKey = '';
  const _profileScanRetryAfterRegistry = new Set<string>();
  let _generalBackfillQueue: Record<string, GeneralBackfillSlot> = {};
  const _profileScanListScopeSessionConfigCache = new Map<string, unknown>();
  const _telemetryCtx = {
    readBoolishRuntimeFlag,
    _profileScanTelemetrySeq: 0,
  } as TelemetryContext;

  _telemetryCtx.isProfileScanTelemetryEnabled = isMainSiteProfileScanTelemetryEnabled.bind(
    _telemetryCtx,
  ) as TelemetryContext['isProfileScanTelemetryEnabled'];
  _telemetryCtx.emitProfileScanTelemetry = emitMainSiteProfileScanTelemetry.bind(
    _telemetryCtx,
  ) as TelemetryContext['emitProfileScanTelemetry'];
  _telemetryCtx.isProfileScanColdDiagEnabled = isMainSiteProfileScanColdDiagEnabled.bind(
    _telemetryCtx,
  ) as TelemetryContext['isProfileScanColdDiagEnabled'];
  _telemetryCtx.emitProfileScanColdDiag = emitMainSiteProfileScanColdDiag.bind(
    _telemetryCtx,
  ) as TelemetryContext['emitProfileScanColdDiag'];

  const hasExplicitProfileScanScopeOverride = (): boolean => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location?.search || '');
        if (params.has('ceSessionScanScope')) return true;
      }
    } catch (e: unknown) {}

    try {
      if (typeof localStorage !== 'undefined') {
        if (
          localStorage.getItem('ce:sessionScanScope') != null ||
          localStorage.getItem('ce:selectedSessionScope') != null
        ) {
          return true;
        }
      }
    } catch (e: unknown) {}

    try {
      if (typeof globalThis !== 'undefined' && typeof readRuntimeGlobalValue('CE_SESSION_SCAN_SCOPE') !== 'undefined') {
        return true;
      }
    } catch (e: unknown) {}

    return false;
  };

  const getProfileScanScopeContext = (): SessionScanScopeContext => {
    const scopeContext = hostApi.getSessionScanScopeContext();
    if (scopeContext.scope !== 'list') return scopeContext;
    if (hasExplicitProfileScanScopeOverride()) return scopeContext;

    return {
      ...scopeContext,
      scope: 'active',
      list: [],
    };
  };

  function readBoolishRuntimeFlag(raw: unknown, fallback = false): boolean {
    if (typeof raw === 'boolean') return raw;
    const val = (raw == null ? '' : String(raw)).trim().toLowerCase();
    if (val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
    if (val === '0' || val === 'false' || val === 'no' || val === 'off') return false;
    return !!fallback;
  }

  const readProfileScanStepTimeoutMs = (kind = 'sbt'): number => {
    const normalizedKind = String(kind || '')
      .trim()
      .toLowerCase();
    const defaultMs =
      normalizedKind === 'activity'
        ? Number(CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS || 12000)
        : Number(CE_PROFILE_SCAN_SBT_TIMEOUT_MS || 30000);
    const runtimeKey =
      normalizedKind === 'activity' ? 'CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS' : 'CE_PROFILE_SCAN_SBT_TIMEOUT_MS';
    try {
      if (typeof globalThis !== 'undefined') {
        const runtimeValue = readRuntimeGlobalValue(runtimeKey);
        if (typeof runtimeValue !== 'undefined') {
          const n = Number(runtimeValue);
          if (Number.isFinite(n) && n >= 5000) return Math.min(180000, Math.floor(n));
        }
        const slugTimeoutValue = readRuntimeGlobalValue('CE_PROFILE_SCAN_SLUG_TIMEOUT_MS');
        if (typeof slugTimeoutValue !== 'undefined') {
          const n = Number(slugTimeoutValue);
          if (Number.isFinite(n) && n >= 5000) return Math.min(180000, Math.floor(n));
        }
      }
    } catch (e: unknown) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    if (Number.isFinite(defaultMs) && defaultMs >= 5000) {
      return Math.min(180000, Math.floor(defaultMs));
    }
    return normalizedKind === 'activity' ? 12000 : 30000;
  };

  const readProfileScanSbtBurstSize = (): number => {
    const fallback = Number(CE_PROFILE_SCAN_SBT_BURST_SIZE || 1);
    try {
      if (typeof globalThis !== 'undefined') {
        const runtimeValue = readRuntimeGlobalValue('CE_PROFILE_SCAN_SBT_BURST_SIZE');
        if (typeof runtimeValue !== 'undefined') {
          const n = Number(runtimeValue);
          if (Number.isFinite(n) && n >= 1) return Math.min(16, Math.floor(n));
        }
      }
    } catch (e: unknown) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    if (Number.isFinite(fallback) && fallback >= 1) return Math.min(16, Math.floor(fallback));
    return 1;
  };

  const readProfileScanActivityLookbackBlocks = ({
    useAllSessions = false,
  }: ReadProfileScanActivityLookbackBlocksOptions = {}): number => {
    const defaultLookback = useAllSessions ? 2500 : 0;
    try {
      if (typeof globalThis !== 'undefined') {
        const runtimeValue = readRuntimeGlobalValue('CE_PROFILE_SCAN_ACTIVITY_LOOKBACK_BLOCKS');
        if (typeof runtimeValue !== 'undefined') {
          const n = Number(runtimeValue);
          if (Number.isFinite(n) && n >= 0) return Math.min(200000, Math.floor(n));
        }
      }
    } catch (e: unknown) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    return defaultLookback;
  };

  const readUserProfileAllSessionsFlag = (runtimeKey: string, fallback = false): boolean => {
    try {
      if (typeof globalThis !== 'undefined') {
        const runtimeValue = readRuntimeGlobalValue(runtimeKey);
        if (typeof runtimeValue !== 'undefined') {
          return readBoolishRuntimeFlag(runtimeValue, !!fallback);
        }
      }
    } catch (e: unknown) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    return !!fallback;
  };

  const getUserProfileAllSessionsScanMode = (): UserProfileAllSessionsScanMode => {
    const hasLegacyRuntimeOverride = (() => {
      try {
        return (
          typeof globalThis !== 'undefined' &&
          typeof readRuntimeGlobalValue('CE_USER_PROFILE_SCAN_ALL_SESSIONS') !== 'undefined'
        );
      } catch (e: unknown) {
        return false;
      }
    })();
    const legacyAllSessions = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS',
      !!CE_USER_PROFILE_SCAN_ALL_SESSIONS,
    );
    const useAllSessionsSbtScan = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS',
      hasLegacyRuntimeOverride ? legacyAllSessions : !!CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS,
    );
    const useAllSessionsSurveyActivityScan = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS',
      hasLegacyRuntimeOverride ? legacyAllSessions : !!CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS,
    );
    const useAllSessionsQuestionActivityScan = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS',
      hasLegacyRuntimeOverride ? legacyAllSessions : !!CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS,
    );
    const useAllSessionsActivityScan = !!(useAllSessionsSurveyActivityScan || useAllSessionsQuestionActivityScan);
    return {
      legacyAllSessions,
      useAllSessionsSbtScan,
      useAllSessionsSurveyActivityScan,
      useAllSessionsQuestionActivityScan,
      useAllSessionsActivityScan,
      useAllSessionsScan: !!(useAllSessionsSbtScan || useAllSessionsActivityScan),
    };
  };

  const isUserProfileAllSessionsScanEnabled = (): boolean => {
    return getUserProfileAllSessionsScanMode().useAllSessionsScan;
  };

  const getActiveProfileScanChainId = (): number | null => {
    const activeSlug = hostApi.getSessionSlugFromState();
    const sessionChainId = Number(hostApi.getSessionChainId(activeSlug) || 0) || 0;
    if (sessionChainId > 0) return sessionChainId;
    const explicitNetworkId = Number(hostApi.getNetworkId() || 0) || 0;
    if (explicitNetworkId > 0) return explicitNetworkId;
    return null;
  };

  const getRegistrySessionEntryCount = (): number => {
    try {
      const entries = sessionRegistryStore.getAllSessionEntries() as unknown;
      return Array.isArray(entries) ? entries.length : 0;
    } catch (e: unknown) {
      return 0;
    }
  };

  const getRegistrySessionCoverageCountForChain = (chainIdIn: NullableChainIdInput = null): number => {
    const activeChainId = Number(chainIdIn || 0) || 0;
    try {
      const entries = sessionRegistryStore.getAllSessionEntries() as unknown;
      if (!Array.isArray(entries) || entries.length === 0) return 0;
      if (activeChainId <= 0) return entries.length;
      let covered = 0;
      entries.forEach((entry: unknown) => {
        const cfg = Array.isArray(entry) ? entry[1] : entry;
        const cfgChainId = getSessionConfigChainId(cfg);
        if (cfgChainId === activeChainId) {
          covered += 1;
        }
      });
      return covered;
    } catch (e: unknown) {
      return 0;
    }
  };

  const getRegistryBootstrapScopeKey = (chainIdsIn: Array<number | string> | null = null): string => {
    const ids = Array.from(
      new Set(
        (Array.isArray(chainIdsIn) ? chainIdsIn : [])
          .map((id: number | string) => Number(id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
          .map((id: number) => Math.floor(id)),
      ),
    ).sort((a: number, b: number) => a - b);
    if (ids.length === 0) return 'all';
    return ids.join(',');
  };

  const readProfileScanRegistryLookupTimeoutMs = (): number => {
    const fallback = 12000;
    try {
      if (typeof globalThis !== 'undefined') {
        const runtimeValue = readRuntimeGlobalValue('CE_PROFILE_SCAN_REGISTRY_LOOKUP_TIMEOUT_MS');
        if (typeof runtimeValue !== 'undefined') {
          const n = Number(runtimeValue);
          if (Number.isFinite(n) && n >= 2000) return Math.min(60000, Math.floor(n));
        }
      }
    } catch (e: unknown) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    return fallback;
  };

  const getProfileScanListScopeSessionConfigCacheKey = (
    slugIn: string,
    chainIdIn: NullableChainIdInput = null,
  ): string => {
    const slug = normalizeSessionSlug(slugIn || '');
    const chainId = Number(chainIdIn != null ? chainIdIn : getActiveProfileScanChainId()) || 0;
    return `${slug}|${chainId > 0 ? Math.floor(chainId) : 0}`;
  };

  const resolveListScopeSessionConfigFromRegistry = async (
    slugIn: string,
    opts: ResolveListScopeSessionConfigOptions = {},
  ): Promise<ProfileScanSessionConfig | null> => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (!slug && slug !== '') return null;
    const activeChainId = Number(getActiveProfileScanChainId() || 0) || 0;
    const cacheKey = getProfileScanListScopeSessionConfigCacheKey(slug, activeChainId);

    const cachedCfg = _profileScanListScopeSessionConfigCache.get(cacheKey);
    const cachedConfig = asProfileScanSessionConfig(cachedCfg);
    if (cachedConfig) return cachedConfig;

    const existingCfg = hostApi.getSessionCfg(slug);
    const existingChainId = Number(hostApi.getSessionChainId(slug) || 0) || 0;
    const existingConfig = asProfileScanSessionConfig(existingCfg);
    if (existingConfig && existingChainId > 0) {
      _profileScanListScopeSessionConfigCache.set(cacheKey, existingConfig);
      _profileScanListScopeSessionConfigCache.set(
        getProfileScanListScopeSessionConfigCacheKey(slug, existingChainId),
        existingConfig,
      );
      return existingConfig;
    }

    const orderedChainIds = Array.from(
      new Set([
        ...(activeChainId > 0 ? [activeChainId] : []),
        ...(Number(DEFAULT_CHAIN_ID || 0) > 0 ? [Number(DEFAULT_CHAIN_ID)] : []),
        ...(getSessionRegistryChainIds() as Array<unknown>)
          .map((id: unknown) => Number(id))
          .filter((id: number) => id > 0),
      ]),
    );
    if (!orderedChainIds.length) return null;

    const lookupTimeoutMs = readProfileScanRegistryLookupTimeoutMs();
    const lit = getGlobalLitHooks();
    const targetAddress = String(opts.targetAddress || '').toLowerCase();
    const attemptErrors: Array<Record<string, unknown>> = [];
    const runWithTimeout = async <T>(
      promiseFactory: () => Promise<T> | T,
      chainId: number,
      bootstrapRpc: boolean,
    ): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          Promise.resolve().then(() => promiseFactory()),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              const err = new Error(
                `[MainSite] List-scope registry lookup timed out after ${lookupTimeoutMs}ms for slug "${slug}" on chain ${chainId}.`,
              ) as Error & { code?: string };
              err.code = 'REGISTRY_LOOKUP_TIMEOUT';
              reject(err);
            }, lookupTimeoutMs);
          }),
        ]);
      } finally {
        if (timeoutId != null) clearTimeout(timeoutId);
      }
    };

    for (const registryChainId of orderedChainIds) {
      for (const bootstrapRpc of [true, false]) {
        try {
          const config = await runWithTimeout(
            () =>
              fetchSessionFromRegistry({
                chainId: registryChainId,
                slug,
                providerLike: hostApi.getProvider(),
                account: hostApi.getAccount(),
                lit,
                bootstrapRpc,
              }) as Promise<unknown>,
            registryChainId,
            bootstrapRpc,
          );
          const resolvedConfig = asProfileScanSessionConfig(config);
          if (!resolvedConfig) continue;
          upsertSessionRegistryCache({ config: resolvedConfig });
          const resolvedChainId =
            Number(
              resolvedConfig.networkChainId ||
                resolvedConfig.contracts?.surveys?.chainId ||
                resolvedConfig.contracts?.sbtFactory?.chainId ||
                registryChainId ||
                0,
            ) || null;
          _profileScanListScopeSessionConfigCache.set(cacheKey, resolvedConfig);
          if (resolvedChainId && resolvedChainId > 0) {
            _profileScanListScopeSessionConfigCache.set(
              getProfileScanListScopeSessionConfigCacheKey(slug, resolvedChainId),
              resolvedConfig,
            );
          }
          _telemetryCtx.emitProfileScanTelemetry('list-scope-chain-id-resolved', {
            targetAddress: targetAddress || null,
            slug,
            chainId: resolvedChainId,
            registryChainId,
            bootstrapRpc,
          });
          return resolvedConfig;
        } catch (e: unknown) {
          attemptErrors.push({
            chainId: registryChainId,
            bootstrapRpc,
            error: getErrorMessage(e),
          });
        }
      }
    }

    _telemetryCtx.emitProfileScanTelemetry('list-scope-chain-id-unresolved', {
      targetAddress: targetAddress || null,
      slug,
      attemptedChainIds: orderedChainIds,
      attempts: attemptErrors.slice(0, 6),
    });
    return null;
  };

  const ensureRegistryHydratedForProfileScan = async (
    opts: Record<string, unknown> = {},
  ): Promise<RegistryHydrationStatus> => {
    const activeChainId = getActiveProfileScanChainId();
    const scopeContext = getProfileScanScopeContext();
    const beforeCount = getRegistrySessionEntryCount();

    const chainIds = resolveSessionRegistryBootstrapChainIds({
      scope: scopeContext.scope,
      list: scopeContext.list,
      activeChainId,
      defaultChainId: DEFAULT_CHAIN_ID,
      forceAllChains: !!opts.forceAllChains,
    }) as Array<number | string> | null | undefined;
    const bootstrapScopeKey = getRegistryBootstrapScopeKey(chainIds);
    let run: Promise<unknown> | null = _registryBootstrapPromise;
    const hasScopeMismatch = !!(run && _registryBootstrapScopeKey && _registryBootstrapScopeKey !== bootstrapScopeKey);
    if (hasScopeMismatch) {
      _telemetryCtx.emitProfileScanTelemetry('registry-bootstrap-scope-mismatch', {
        expectedScope: bootstrapScopeKey,
        inFlightScope: _registryBootstrapScopeKey,
        activeChainId: Number(activeChainId || 0) || null,
      });
      run = null;
    }
    if (!run) {
      const lit = getGlobalLitHooks();
      const startedRun = loadGroupRegistryCache({
        chainIds,
        account: hostApi.getAccount(),
        providerLike: hostApi.getProvider(),
        lit,
        force: true,
        bootstrapRpc: true,
      }) as Promise<unknown>;
      _registryBootstrapPromise = startedRun;
      _registryBootstrapScopeKey = bootstrapScopeKey;
      startedRun
        .catch((e: unknown) => {
          mainSiteLog.warn('[SessionRegistry] Profile scan registry preload failed:', e);
        })
        .finally(() => {
          if (_registryBootstrapPromise === startedRun) {
            _registryBootstrapPromise = null;
            _registryBootstrapScopeKey = '';
          }
        });
      run = startedRun;
    }

    const timeoutMs = (() => {
      const fallback = Number(CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS || 45000);
      try {
        if (typeof globalThis !== 'undefined') {
          const runtimeValue = readRuntimeGlobalValue('CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS');
          if (typeof runtimeValue !== 'undefined') {
            const n = Number(runtimeValue);
            if (Number.isFinite(n) && n >= 5000) return Math.min(180000, Math.floor(n));
          }
        }
      } catch (e: unknown) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
      if (Number.isFinite(fallback) && fallback >= 5000) return Math.min(180000, Math.floor(fallback));
      return 45000;
    })();
    let timedOut = false;
    let loadMeta: RegistryLoadMeta | null = null;
    let loadError: unknown = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const activeRun = run as Promise<unknown>;
      await Promise.race([
        Promise.resolve(activeRun)
          .then((result: unknown) => {
            loadMeta = getResultLoadMeta(result);
            return result;
          })
          .catch((e: unknown) => {
            loadError = e;
            return null;
          }),
        new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            resolve(null);
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId != null) clearTimeout(timeoutId);
    }
    const loadMetaResult = loadMeta as RegistryLoadMeta | null;
    let afterCount = getRegistrySessionEntryCount();
    let hadLoadErrors = !!(loadMetaResult && loadMetaResult.hadLoadErrors);
    let alternateRpcAttempt: RegistryAlternateRpcAttempt | null = null;
    const shouldRetryWithAlternateRpc = afterCount <= 0 && (timedOut || hadLoadErrors || !!loadError);
    if (shouldRetryWithAlternateRpc) {
      const lit = getGlobalLitHooks();
      let retryTimedOut = false;
      let retryLoadMeta: RegistryLoadMeta | null = null;
      let retryError: unknown = null;
      let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        await Promise.race([
          Promise.resolve(
            loadGroupRegistryCache({
              chainIds,
              account: hostApi.getAccount(),
              providerLike: hostApi.getProvider(),
              lit,
              force: true,
              bootstrapRpc: false,
            }) as Promise<unknown>,
          )
            .then((result: unknown) => {
              retryLoadMeta = getResultLoadMeta(result);
              return result;
            })
            .catch((e: unknown) => {
              retryError = e;
              return null;
            }),
          new Promise<null>((resolve) => {
            retryTimeoutId = setTimeout(() => {
              retryTimedOut = true;
              resolve(null);
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (retryTimeoutId != null) clearTimeout(retryTimeoutId);
      }
      const retryLoadMetaResult = retryLoadMeta as RegistryLoadMeta | null;
      const retryAfterCount = getRegistrySessionEntryCount();
      const retryHadLoadErrors = !!(retryLoadMetaResult && retryLoadMetaResult.hadLoadErrors);
      alternateRpcAttempt = {
        attempted: true,
        improved: retryAfterCount > afterCount,
        timedOut: retryTimedOut,
        hadLoadErrors: retryHadLoadErrors,
        hadError: !!retryError,
        afterCount: retryAfterCount,
      };
      if (retryAfterCount > afterCount) {
        afterCount = retryAfterCount;
        timedOut = retryTimedOut;
        hadLoadErrors = retryHadLoadErrors;
        loadMeta = retryLoadMeta || loadMeta;
        loadError = retryError;
      } else {
        timedOut = timedOut || retryTimedOut;
        hadLoadErrors = hadLoadErrors || retryHadLoadErrors || !!retryError;
      }
    }
    const loadMetaForMerge = loadMeta as RegistryLoadMeta | null;
    let mergedLoadMeta = loadMetaForMerge ? { ...loadMetaForMerge } : null;
    if (alternateRpcAttempt) {
      mergedLoadMeta = {
        ...(mergedLoadMeta || {}),
        alternateRpcAttempt,
      };
    }
    return {
      hasEntries: afterCount > 0,
      timedOut,
      beforeCount,
      afterCount,
      hadLoadErrors,
      loadMeta: mergedLoadMeta,
    };
  };

  const isOnchainSessionRegistryEnabled = (): boolean => shouldEnableSessionRegistryRefresh();

  const refreshSessionUniverseRegistryCache = async (): Promise<unknown | null> => {
    if (!isOnchainSessionRegistryEnabled()) return null;
    const scopeContext = getProfileScanScopeContext();
    const activeChainId = getActiveProfileScanChainId();
    const chainIds = resolveSessionRegistryBootstrapChainIds({
      scope: scopeContext.scope,
      list: scopeContext.list,
      activeChainId,
      defaultChainId: DEFAULT_CHAIN_ID,
    });
    try {
      const lit = getGlobalLitHooks();
      return await loadGroupRegistryCache({
        chainIds,
        account: hostApi.getAccount(),
        providerLike: hostApi.getProvider(),
        lit,
        force: true,
        bootstrapRpc: true,
      });
    } catch (e: unknown) {
      mainSiteLog.warn('[SessionRegistry] Refresh cache load failed:', e);
      return null;
    }
  };

  const resolveProfileDeepScanPlan = ({
    registryStatus = null,
    useAllSessionsScan = null,
  }: ResolveProfileDeepScanPlanOptions = {}): ProfileDeepScanPlan => {
    const activeChainId = getActiveProfileScanChainId();
    const useAllSessions =
      typeof useAllSessionsScan === 'boolean' ? useAllSessionsScan : isUserProfileAllSessionsScanEnabled();
    const scopeContext = hostApi.getSessionScanScopeContext();
    const listScopePrioritySlugs =
      scopeContext.scope === 'list'
        ? normalizeSlugArray(getAllowedSessionSlugs('list', scopeContext.list, scopeContext.activeSlug))
        : [];
    const prioritizeSlugs = (
      slugs: unknown,
      opts: { prioritySlugs?: unknown } = {},
    ): Pick<ProfileDeepScanPlan, 'relevantSlugs' | 'prioritizedGeneralFirst' | 'scanOrdering'> & {
      slugs: string[];
    } => {
      const normalized = normalizeSlugArray(slugs);
      const activeSlug = normalizeSessionSlug(hostApi.getActiveSessionSlug() || '');
      const hasGeneral = normalized.includes('');
      const hasActive = normalized.includes(activeSlug);
      const explicitPriority = normalizeSlugArray(opts.prioritySlugs).filter((slug: string) =>
        normalized.includes(slug),
      );
      const ordered: string[] = [];
      const push = (slug: unknown): void => {
        const normalizedSlug = normalizeSessionSlug(slug || '');
        if (!normalized.includes(normalizedSlug)) return;
        if (!ordered.includes(normalizedSlug)) ordered.push(normalizedSlug);
      };

      if (explicitPriority.length > 0) {
        explicitPriority.forEach((slug: string) => push(slug));
        if (hasActive) push(activeSlug);
        if (hasGeneral) push('');
      } else {
        if (hasActive) push(activeSlug);
        if (hasGeneral) push('');
      }
      normalized.forEach((slug: string) => push(slug));

      return {
        slugs: ordered,
        relevantSlugs: hasActive ? [activeSlug] : [],
        prioritizedGeneralFirst: ordered[0] === '',
        scanOrdering:
          explicitPriority.length > 0
            ? useAllSessions
              ? 'scope-list-first-all'
              : 'scope-list-first-scoped'
            : useAllSessions
              ? 'active-first-general-early-all'
              : 'active-first-general-early-scoped',
      };
    };
    const dedupeNormalized = (slugs: unknown): string[] => normalizeSlugArray(slugs);
    if (useAllSessions) {
      const rawAll = dedupeNormalized(sessionRegistryStore.getAllSessionSlugs() || []);
      const all = rawAll.filter((slug: string) => {
        if (!activeChainId) return true;
        const slugChainId = Number(hostApi.getSessionChainId(slug) || 0) || 0;
        if (!slugChainId) return false;
        return slugChainId === activeChainId;
      });
      const scopedFallback: string[] = [];
      const prioritized = prioritizeSlugs(all.length > 0 ? all : scopedFallback, {
        prioritySlugs: listScopePrioritySlugs,
      });
      const slugs = prioritized.slugs;
      const registryEntryCount =
        Number(
          registryStatus && Number.isFinite(Number(registryStatus.afterCount))
            ? Number(registryStatus.afterCount)
            : getRegistrySessionEntryCount(),
        ) || 0;
      const hadLoadErrors = !!(registryStatus && registryStatus.hadLoadErrors);
      const timedOut = !!(registryStatus && registryStatus.timedOut);
      const hasRegistryEntries = registryEntryCount > 0 || !!(registryStatus && registryStatus.hasEntries === true);
      const hasAnyActiveChainSlug = all.length > 0;
      const noActiveChainSlugs =
        Number(activeChainId || 0) > 0 && hasRegistryEntries && !timedOut && !hadLoadErrors && !hasAnyActiveChainSlug;
      const coverageComplete =
        (hasRegistryEntries && hasAnyActiveChainSlug && !hadLoadErrors && !timedOut) || noActiveChainSlugs;
      let coverageReason = noActiveChainSlugs ? 'registry-no-active-chain-slugs' : 'registry-ready';
      if (!coverageComplete) {
        if (hadLoadErrors) {
          coverageReason = 'registry-partial-errors';
        } else if (timedOut) {
          coverageReason = 'registry-timeout';
        } else if (registryEntryCount <= 0) {
          coverageReason = 'registry-empty';
        } else if (all.length === 0) {
          coverageReason = 'registry-no-active-chain-slugs';
        }
      }
      return {
        slugs,
        usedAllSessions: true,
        coverageComplete,
        coverageReason,
        registryEntryCount,
        hadLoadErrors,
        rawAllSlugCount: rawAll.length,
        activeChainSlugCount: all.length,
        scopedFallbackSlugCount: scopedFallback.length,
        relevantSlugs: prioritized.relevantSlugs,
        prioritizedGeneralFirst: prioritized.prioritizedGeneralFirst,
        scanOrdering: prioritized.scanOrdering,
      };
    }
    const prioritized = prioritizeSlugs(dedupeNormalized(hostApi.getScopedSessionSlugs(scopeContext.scope)), {
      prioritySlugs: listScopePrioritySlugs,
    });
    return {
      slugs: prioritized.slugs,
      usedAllSessions: false,
      coverageComplete: true,
      coverageReason: 'scoped',
      registryEntryCount: getRegistrySessionEntryCount(),
      relevantSlugs: prioritized.relevantSlugs,
      prioritizedGeneralFirst: prioritized.prioritizedGeneralFirst,
      scanOrdering: prioritized.scanOrdering,
    };
  };

  const scheduleProfileScanRetryAfterRegistryHydration = (targetAddress: string, reason = ''): void => {
    const target = String(targetAddress || '').trim();
    if (!target || !ethers.utils.isAddress(target)) return;
    const targetLower = target.toLowerCase();
    if (_profileScanRetryAfterRegistry.has(targetLower)) return;
    const run = _registryBootstrapPromise;
    const waitForBootstrap = run ? Promise.resolve(run).catch(() => null) : Promise.resolve(null);
    const waitForHydration = !!run;

    _profileScanRetryAfterRegistry.add(targetLower);
    _telemetryCtx.emitProfileScanTelemetry('retry-scheduled', {
      targetAddress: targetLower,
      reason: String(reason || ''),
      waitForHydration,
    });
    if (!run) {
      _telemetryCtx.emitProfileScanTelemetry('retry-no-bootstrap-immediate', {
        targetAddress: targetLower,
        reason: String(reason || ''),
      });
    }

    waitForBootstrap
      .then(() => {
        if (!hostApi.isMounted()) return;
        _telemetryCtx.emitProfileScanTelemetry('retry-fired', {
          targetAddress: targetLower,
          reason: String(reason || ''),
          waitForHydration,
        });
        return hostApi
          .scanSpecificUserProfile(target)
          .then((scanReport: unknown) => {
            if (!scanReport || typeof scanReport !== 'object') return;
            try {
              if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(
                  new CustomEvent(PROFILE_SCAN_REPORT_EVENT, {
                    detail: {
                      source: 'registry-retry',
                      scanReport,
                    },
                  }),
                );
              }
            } catch (e: unknown) {
              mainSiteLog.warn('MainSite: telemetry', e);
            }
          })
          .catch((e: unknown) => {
            _telemetryCtx.emitProfileScanTelemetry('retry-failed', {
              targetAddress: targetLower,
              reason: String(reason || ''),
              error: getErrorMessage(e),
            });
            mainSiteLog.warn('[DeepSearch] Retry after registry hydration failed:', {
              target: targetLower,
              reason: String(reason || ''),
              error: getErrorMessage(e),
            });
          });
      })
      .finally(() => {
        _profileScanRetryAfterRegistry.delete(targetLower);
      });
  };

  const getProfileDeepScanSlugs = (): string[] => {
    return resolveProfileDeepScanPlan().slugs;
  };

  const shouldBackfillGeneralSession = (
    slugIn: string,
    scopeContextIn: SessionScanScopeContext | null = null,
  ): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (!slug) return false;
    const scopeContext = scopeContextIn || hostApi.getSessionScanScopeContext();
    if (scopeContext.scope !== 'general') return false;
    return hostApi.isSessionSlugAllowedForScan('', scopeContext);
  };

  const enqueueGeneralSessionBackfill = ({
    operation = 'unknown',
    activeSlug = '',
    runGeneral,
  }: EnqueueGeneralSessionBackfillOptions = {}): void => {
    if (typeof runGeneral !== 'function') return;

    const opKey = String(operation || '').trim() || 'unknown';
    const activeSlugNormalized = normalizeSessionSlug(activeSlug || '');
    _generalBackfillQueue = _generalBackfillQueue || {};

    const slot =
      _generalBackfillQueue[opKey] && typeof _generalBackfillQueue[opKey] === 'object'
        ? _generalBackfillQueue[opKey]
        : {
            inFlight: null,
            pending: false,
            runGeneral: null,
            activeSlug: '',
          };

    slot.pending = true;
    slot.runGeneral = runGeneral;
    slot.activeSlug = activeSlugNormalized;
    _generalBackfillQueue[opKey] = slot;
    if (slot.inFlight) return;

    slot.inFlight = (async () => {
      try {
        while (slot.pending) {
          if (!hostApi.isMounted()) break;
          slot.pending = false;
          const runGeneralNow = slot.runGeneral;
          const activeSlugForRun = slot.activeSlug;
          if (typeof runGeneralNow !== 'function') continue;
          try {
            await runGeneralNow('');
          } catch (e: unknown) {
            mainSiteLog.warn('[SessionScanScope] background general session backfill failed', {
              operation: opKey,
              activeSlug: activeSlugForRun,
              error: getErrorMessage(e),
            });
          }
        }
      } finally {
        try {
          delete _generalBackfillQueue[opKey];
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: fallback', e);
        }
      }
    })();
  };

  const runWithGeneralSessionBackfill = async ({
    slugIn,
    operation = 'unknown',
    runPrimary,
    runGeneral,
  }: RunWithGeneralSessionBackfillOptions = {}): Promise<unknown | undefined> => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (typeof runPrimary !== 'function') return undefined;
    const primaryResult = await runPrimary(slug);
    const scopeContext = hostApi.getSessionScanScopeContext();
    if (!shouldBackfillGeneralSession(slug, scopeContext)) return primaryResult;

    const runGeneralFn = typeof runGeneral === 'function' ? runGeneral : runPrimary;
    enqueueGeneralSessionBackfill({
      operation,
      activeSlug: slug,
      runGeneral: runGeneralFn,
    });
    return primaryResult;
  };

  const destroy = (): void => {
    _registryBootstrapPromise = null;
    _registryBootstrapScopeKey = '';
    _profileScanRetryAfterRegistry.clear();
    if (_generalBackfillQueue && typeof _generalBackfillQueue === 'object') {
      Object.values(_generalBackfillQueue).forEach((slot: GeneralBackfillSlot) => {
        if (!slot || typeof slot !== 'object') return;
        slot.pending = false;
      });
    }
    _generalBackfillQueue = {};
    _profileScanListScopeSessionConfigCache.clear();
    _telemetryCtx._profileScanTelemetrySeq = 0;
  };

  const controller: SessionProfileScanController = {
    hasExplicitProfileScanScopeOverride,
    getProfileScanScopeContext,
    readBoolishRuntimeFlag,
    getUserProfileAllSessionsScanMode,
    isUserProfileAllSessionsScanEnabled,
    getActiveProfileScanChainId,
    readProfileScanStepTimeoutMs,
    readProfileScanSbtBurstSize,
    readProfileScanActivityLookbackBlocks,
    readUserProfileAllSessionsFlag,
    readProfileScanRegistryLookupTimeoutMs,
    getRegistrySessionEntryCount,
    getRegistrySessionCoverageCountForChain,
    getRegistryBootstrapScopeKey,
    getProfileScanListScopeSessionConfigCacheKey,
    resolveListScopeSessionConfigFromRegistry,
    ensureRegistryHydratedForProfileScan,
    isOnchainSessionRegistryEnabled,
    refreshSessionUniverseRegistryCache,
    resolveProfileDeepScanPlan,
    getProfileDeepScanSlugs,
    scheduleProfileScanRetryAfterRegistryHydration,
    shouldBackfillGeneralSession,
    enqueueGeneralSessionBackfill,
    runWithGeneralSessionBackfill,
    emitProfileScanTelemetry: _telemetryCtx.emitProfileScanTelemetry,
    isProfileScanTelemetryEnabled: _telemetryCtx.isProfileScanTelemetryEnabled,
    isProfileScanColdDiagEnabled: _telemetryCtx.isProfileScanColdDiagEnabled,
    emitProfileScanColdDiag: _telemetryCtx.emitProfileScanColdDiag,
    destroy,
  };

  Object.defineProperties(controller, {
    _registryBootstrapPromise: {
      get: () => _registryBootstrapPromise,
      set: (value: unknown) => {
        _registryBootstrapPromise = value as Promise<unknown> | null;
      },
    },
    _registryBootstrapScopeKey: {
      get: () => _registryBootstrapScopeKey,
      set: (value: unknown) => {
        _registryBootstrapScopeKey = String(value || '');
      },
    },
  });

  return controller;
};
