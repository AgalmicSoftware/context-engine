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
} from '../../components/MainSite/debugTelemetry.js';
import { shouldEnableSessionRegistryRefresh } from '../../components/MainSite/progressHelpers.js';

const mainSiteLog = createLogger('mainSite');

const PROFILE_SCAN_REPORT_EVENT = 'ce:profile-scan-report';

export const createSessionProfileScanController = (host) => {
  let _registryBootstrapPromise = null;
  let _registryBootstrapScopeKey = '';
  let _profileScanRetryAfterRegistry = new Set();
  let _generalBackfillQueue = {};
  let _profileScanListScopeSessionConfigCache = new Map();
  const _telemetryCtx = {
    readBoolishRuntimeFlag,
    _profileScanTelemetrySeq: 0,
  };
  _telemetryCtx.isProfileScanTelemetryEnabled = isMainSiteProfileScanTelemetryEnabled.bind(_telemetryCtx);
  _telemetryCtx.emitProfileScanTelemetry = emitMainSiteProfileScanTelemetry.bind(_telemetryCtx);
  _telemetryCtx.isProfileScanColdDiagEnabled = isMainSiteProfileScanColdDiagEnabled.bind(_telemetryCtx);
  _telemetryCtx.emitProfileScanColdDiag = emitMainSiteProfileScanColdDiag.bind(_telemetryCtx);

  const hasExplicitProfileScanScopeOverride = () => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location?.search || '');
        if (params.has('ceSessionScanScope')) return true;
      }
    } catch (_) {}

    try {
      if (typeof localStorage !== 'undefined') {
        if (
          localStorage.getItem('ce:sessionScanScope') != null ||
          localStorage.getItem('ce:selectedSessionScope') != null
        ) {
          return true;
        }
      }
    } catch (_) {}

    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.CE_SESSION_SCAN_SCOPE !== 'undefined') {
        return true;
      }
    } catch (_) {}

    return false;
  };

  const getProfileScanScopeContext = () => {
    const scopeContext = host.getSessionScanScopeContext();
    if (scopeContext.scope !== 'list') return scopeContext;
    if (hasExplicitProfileScanScopeOverride()) return scopeContext;

    return {
      ...scopeContext,
      scope: 'active',
      list: [],
    };
  };

  function readBoolishRuntimeFlag(raw, fallback = false) {
    if (typeof raw === 'boolean') return raw;
    const val = (raw == null ? '' : String(raw)).trim().toLowerCase();
    if (val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
    if (val === '0' || val === 'false' || val === 'no' || val === 'off') return false;
    return !!fallback;
  }

  const readProfileScanStepTimeoutMs = (kind = 'sbt') => {
    const normalizedKind = String(kind || '').trim().toLowerCase();
    const defaultMs = normalizedKind === 'activity'
      ? Number(CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS || 12000)
      : Number(CE_PROFILE_SCAN_SBT_TIMEOUT_MS || 30000);
    const runtimeKey = normalizedKind === 'activity'
      ? 'CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS'
      : 'CE_PROFILE_SCAN_SBT_TIMEOUT_MS';
    try {
      if (typeof globalThis !== 'undefined') {
        if (typeof globalThis[runtimeKey] !== 'undefined') {
          const n = Number(globalThis[runtimeKey]);
          if (Number.isFinite(n) && n >= 5000) return Math.min(180000, Math.floor(n));
        }
        if (typeof globalThis.CE_PROFILE_SCAN_SLUG_TIMEOUT_MS !== 'undefined') {
          const n = Number(globalThis.CE_PROFILE_SCAN_SLUG_TIMEOUT_MS);
          if (Number.isFinite(n) && n >= 5000) return Math.min(180000, Math.floor(n));
        }
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    if (Number.isFinite(defaultMs) && defaultMs >= 5000) {
      return Math.min(180000, Math.floor(defaultMs));
    }
    return normalizedKind === 'activity' ? 12000 : 30000;
  };

  const readProfileScanSbtBurstSize = () => {
    const fallback = Number(CE_PROFILE_SCAN_SBT_BURST_SIZE || 1);
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.CE_PROFILE_SCAN_SBT_BURST_SIZE !== 'undefined') {
        const n = Number(globalThis.CE_PROFILE_SCAN_SBT_BURST_SIZE);
        if (Number.isFinite(n) && n >= 1) return Math.min(16, Math.floor(n));
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    if (Number.isFinite(fallback) && fallback >= 1) return Math.min(16, Math.floor(fallback));
    return 1;
  };

  const readProfileScanActivityLookbackBlocks = ({ useAllSessions = false } = {}) => {
    const defaultLookback = useAllSessions ? 2500 : 0;
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.CE_PROFILE_SCAN_ACTIVITY_LOOKBACK_BLOCKS !== 'undefined') {
        const n = Number(globalThis.CE_PROFILE_SCAN_ACTIVITY_LOOKBACK_BLOCKS);
        if (Number.isFinite(n) && n >= 0) return Math.min(200000, Math.floor(n));
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    return defaultLookback;
  };

  const readUserProfileAllSessionsFlag = (runtimeKey, fallback = false) => {
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis[runtimeKey] !== 'undefined') {
        return readBoolishRuntimeFlag(globalThis[runtimeKey], !!fallback);
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    return !!fallback;
  };

  const getUserProfileAllSessionsScanMode = () => {
    const hasLegacyRuntimeOverride = (() => {
      try {
        return (
          typeof globalThis !== 'undefined' &&
          typeof globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS !== 'undefined'
        );
      } catch (_) {
        return false;
      }
    })();
    const legacyAllSessions = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS',
      !!CE_USER_PROFILE_SCAN_ALL_SESSIONS
    );
    const useAllSessionsSbtScan = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS',
      hasLegacyRuntimeOverride ? legacyAllSessions : !!CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS
    );
    const useAllSessionsSurveyActivityScan = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS',
      hasLegacyRuntimeOverride ? legacyAllSessions : !!CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS
    );
    const useAllSessionsQuestionActivityScan = readUserProfileAllSessionsFlag(
      'CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS',
      hasLegacyRuntimeOverride ? legacyAllSessions : !!CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS
    );
    const useAllSessionsActivityScan = !!(
      useAllSessionsSurveyActivityScan ||
      useAllSessionsQuestionActivityScan
    );
    return {
      legacyAllSessions,
      useAllSessionsSbtScan,
      useAllSessionsSurveyActivityScan,
      useAllSessionsQuestionActivityScan,
      useAllSessionsActivityScan,
      useAllSessionsScan: !!(useAllSessionsSbtScan || useAllSessionsActivityScan),
    };
  };

  const isUserProfileAllSessionsScanEnabled = () => {
    return getUserProfileAllSessionsScanMode().useAllSessionsScan;
  };

  const getActiveProfileScanChainId = () => {
    const activeSlug = host.getSessionSlugFromState();
    const sessionChainId = Number(host.getSessionChainId(activeSlug) || 0) || 0;
    if (sessionChainId > 0) return sessionChainId;
    const explicitNetworkId = Number(host.getNetworkId() || 0) || 0;
    if (explicitNetworkId > 0) return explicitNetworkId;
    return null;
  };

  const getRegistrySessionEntryCount = () => {
    try {
      const entries = sessionRegistryStore.getAllSessionEntries();
      return Array.isArray(entries) ? entries.length : 0;
    } catch (_) {
      return 0;
    }
  };

  const getRegistrySessionCoverageCountForChain = (chainIdIn = null) => {
    const activeChainId = Number(chainIdIn || 0) || 0;
    try {
      const entries = sessionRegistryStore.getAllSessionEntries();
      if (!Array.isArray(entries) || entries.length === 0) return 0;
      if (activeChainId <= 0) return entries.length;
      let covered = 0;
      entries.forEach((entry) => {
        const cfg = Array.isArray(entry) ? entry[1] : entry;
        const cfgChainId = Number(
          cfg?.networkChainId ||
          cfg?.contracts?.surveys?.chainId ||
          cfg?.contracts?.sbtFactory?.chainId ||
          0
        ) || 0;
        if (cfgChainId === activeChainId) {
          covered += 1;
        }
      });
      return covered;
    } catch (_) {
      return 0;
    }
  };

  const getRegistryBootstrapScopeKey = (chainIdsIn = null) => {
    const ids = (Array.isArray(chainIdsIn) ? chainIdsIn : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => Math.floor(id))
      .sort((a, b) => a - b);
    if (ids.length === 0) return 'all';
    return ids.join(',');
  };

  const readProfileScanRegistryLookupTimeoutMs = () => {
    const fallback = 12000;
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.CE_PROFILE_SCAN_REGISTRY_LOOKUP_TIMEOUT_MS !== 'undefined') {
        const n = Number(globalThis.CE_PROFILE_SCAN_REGISTRY_LOOKUP_TIMEOUT_MS);
        if (Number.isFinite(n) && n >= 2000) return Math.min(60000, Math.floor(n));
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    return fallback;
  };

  const getProfileScanListScopeSessionConfigCacheKey = (slugIn, chainIdIn = null) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const chainId = Number(
      chainIdIn != null
        ? chainIdIn
        : getActiveProfileScanChainId()
    ) || 0;
    return `${slug}|${chainId > 0 ? Math.floor(chainId) : 0}`;
  };

  const resolveListScopeSessionConfigFromRegistry = async (slugIn, opts = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (!slug && slug !== '') return null;
    const activeChainId = Number(getActiveProfileScanChainId() || 0) || 0;
    const cacheKey = getProfileScanListScopeSessionConfigCacheKey(slug, activeChainId);

    const cachedCfg = _profileScanListScopeSessionConfigCache.get(cacheKey);
    if (cachedCfg && typeof cachedCfg === 'object') return cachedCfg;

    const existingCfg = host.getSessionCfg(slug);
    const existingChainId = Number(host.getSessionChainId(slug) || 0) || 0;
    if (existingCfg && typeof existingCfg === 'object' && existingChainId > 0) {
      _profileScanListScopeSessionConfigCache.set(cacheKey, existingCfg);
      _profileScanListScopeSessionConfigCache.set(
        getProfileScanListScopeSessionConfigCacheKey(slug, existingChainId),
        existingCfg
      );
      return existingCfg;
    }

    const orderedChainIds = Array.from(
      new Set([
        ...(activeChainId > 0 ? [activeChainId] : []),
        ...(Number(DEFAULT_CHAIN_ID || 0) > 0 ? [Number(DEFAULT_CHAIN_ID)] : []),
        ...getSessionRegistryChainIds().map((id) => Number(id)).filter((id) => id > 0),
      ])
    );
    if (!orderedChainIds.length) return null;

    const lookupTimeoutMs = readProfileScanRegistryLookupTimeoutMs();
    const lit = getGlobalLitHooks();
    const targetAddress = String(opts?.targetAddress || '').toLowerCase();
    const attemptErrors = [];
    const runWithTimeout = async (promiseFactory, chainId, bootstrapRpc) => {
      let timeoutId = null;
      try {
        return await Promise.race([
          Promise.resolve().then(() => promiseFactory()),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              const err = new Error(
                `[MainSite] List-scope registry lookup timed out after ${lookupTimeoutMs}ms for slug "${slug}" on chain ${chainId}.`
              );
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
            () => fetchSessionFromRegistry({
              chainId: registryChainId,
              slug,
              providerLike: host.getProvider(),
              account: host.getAccount(),
              lit,
              bootstrapRpc,
            }),
            registryChainId,
            bootstrapRpc
          );
          if (!config || typeof config !== 'object') continue;
          upsertSessionRegistryCache({ config });
          const resolvedChainId = Number(
            config?.networkChainId ||
            config?.contracts?.surveys?.chainId ||
            config?.contracts?.sbtFactory?.chainId ||
            registryChainId ||
            0
          ) || null;
          _profileScanListScopeSessionConfigCache.set(cacheKey, config);
          if (resolvedChainId && resolvedChainId > 0) {
            _profileScanListScopeSessionConfigCache.set(
              getProfileScanListScopeSessionConfigCacheKey(slug, resolvedChainId),
              config
            );
          }
          _telemetryCtx.emitProfileScanTelemetry('list-scope-chain-id-resolved', {
            targetAddress: targetAddress || null,
            slug,
            chainId: resolvedChainId,
            registryChainId,
            bootstrapRpc,
          });
          return config;
        } catch (err) {
          attemptErrors.push({
            chainId: registryChainId,
            bootstrapRpc,
            error: String(err?.message || err),
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

  const ensureRegistryHydratedForProfileScan = async (opts = {}) => {
    const activeChainId = getActiveProfileScanChainId();
    const scopeContext = getProfileScanScopeContext();
    const beforeCount = getRegistrySessionEntryCount();

    const chainIds = resolveSessionRegistryBootstrapChainIds({
      scope: scopeContext.scope,
      list: scopeContext.list,
      activeChainId,
      defaultChainId: DEFAULT_CHAIN_ID,
      forceAllChains: !!opts?.forceAllChains,
    });
    const bootstrapScopeKey = getRegistryBootstrapScopeKey(chainIds);
    let run = _registryBootstrapPromise;
    const hasScopeMismatch = !!(
      run &&
      _registryBootstrapScopeKey &&
      _registryBootstrapScopeKey !== bootstrapScopeKey
    );
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
        account: host.getAccount(),
        providerLike: host.getProvider(),
        lit,
        force: true,
        bootstrapRpc: true,
      });
      _registryBootstrapPromise = startedRun;
      _registryBootstrapScopeKey = bootstrapScopeKey;
      startedRun
        .catch((err) => {
          mainSiteLog.warn('[SessionRegistry] Profile scan registry preload failed:', err);
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
        if (typeof globalThis !== 'undefined' && typeof globalThis.CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS !== 'undefined') {
          const n = Number(globalThis.CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS);
          if (Number.isFinite(n) && n >= 5000) return Math.min(180000, Math.floor(n));
        }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      if (Number.isFinite(fallback) && fallback >= 5000) return Math.min(180000, Math.floor(fallback));
      return 45000;
    })();
    let timedOut = false;
    let loadMeta = null;
    let loadError = null;
    let timeoutId = null;
    try {
      await Promise.race([
        Promise.resolve(run)
          .then((result) => {
            loadMeta = (result && typeof result === 'object' && result.__loadMeta)
              ? result.__loadMeta
              : null;
            return result;
          })
          .catch((err) => {
            loadError = err;
            return null;
          }),
        new Promise((resolve) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            resolve(null);
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId != null) clearTimeout(timeoutId);
    }
    let afterCount = getRegistrySessionEntryCount();
    let hadLoadErrors = !!(loadMeta && loadMeta.hadLoadErrors);
    let alternateRpcAttempt = null;
    const shouldRetryWithAlternateRpc = (
      afterCount <= 0 &&
      (timedOut || hadLoadErrors || !!loadError)
    );
    if (shouldRetryWithAlternateRpc) {
      const lit = getGlobalLitHooks();
      let retryTimedOut = false;
      let retryLoadMeta = null;
      let retryError = null;
      let retryTimeoutId = null;
      try {
        await Promise.race([
          Promise.resolve(
            loadGroupRegistryCache({
              chainIds,
              account: host.getAccount(),
              providerLike: host.getProvider(),
              lit,
              force: true,
              bootstrapRpc: false,
            })
          )
            .then((result) => {
              retryLoadMeta = (result && typeof result === 'object' && result.__loadMeta)
                ? result.__loadMeta
                : null;
              return result;
            })
            .catch((err) => {
              retryError = err;
              return null;
            }),
          new Promise((resolve) => {
            retryTimeoutId = setTimeout(() => {
              retryTimedOut = true;
              resolve(null);
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (retryTimeoutId != null) clearTimeout(retryTimeoutId);
      }
      const retryAfterCount = getRegistrySessionEntryCount();
      const retryHadLoadErrors = !!(retryLoadMeta && retryLoadMeta.hadLoadErrors);
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
    let mergedLoadMeta = loadMeta && typeof loadMeta === 'object' ? { ...loadMeta } : null;
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

  const isOnchainSessionRegistryEnabled = () => shouldEnableSessionRegistryRefresh();

  const refreshSessionUniverseRegistryCache = async () => {
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
        account: host.getAccount(),
        providerLike: host.getProvider(),
        lit,
        force: true,
        bootstrapRpc: true,
      });
    } catch (err) {
      mainSiteLog.warn('[SessionRegistry] Refresh cache load failed:', err);
      return null;
    }
  };

  const resolveProfileDeepScanPlan = ({ registryStatus = null, useAllSessionsScan = null } = {}) => {
    const activeChainId = getActiveProfileScanChainId();
    const useAllSessions = typeof useAllSessionsScan === 'boolean'
      ? useAllSessionsScan
      : isUserProfileAllSessionsScanEnabled();
    const scopeContext = host.getSessionScanScopeContext();
    const listScopePrioritySlugs = scopeContext.scope === 'list'
      ? getAllowedSessionSlugs('list', scopeContext.list, scopeContext.activeSlug)
      : [];
    const prioritizeSlugs = (slugs, opts = {}) => {
      const normalized = Array.from(
        new Set((Array.isArray(slugs) ? slugs : []).map((slug) => normalizeSessionSlug(slug || '')))
      );
      const activeSlug = normalizeSessionSlug(host.getActiveSessionSlug() || '');
      const hasGeneral = normalized.includes('');
      const hasActive = normalized.includes(activeSlug);
      const explicitPriority = Array.from(
        new Set((Array.isArray(opts.prioritySlugs) ? opts.prioritySlugs : []).map((slug) => normalizeSessionSlug(slug || '')))
      ).filter((slug) => normalized.includes(slug));
      const ordered = [];
      const push = (slug) => {
        const normalizedSlug = normalizeSessionSlug(slug || '');
        if (!normalized.includes(normalizedSlug)) return;
        if (!ordered.includes(normalizedSlug)) ordered.push(normalizedSlug);
      };

      if (explicitPriority.length > 0) {
        explicitPriority.forEach(push);
        if (hasActive) push(activeSlug);
        if (hasGeneral) push('');
      } else {
        if (hasActive) push(activeSlug);
        if (hasGeneral) push('');
      }
      normalized.forEach(push);

      return {
        slugs: ordered,
        relevantSlugs: hasActive ? [activeSlug] : [],
        prioritizedGeneralFirst: ordered[0] === '',
        scanOrdering: explicitPriority.length > 0
          ? (useAllSessions ? 'scope-list-first-all' : 'scope-list-first-scoped')
          : (useAllSessions ? 'active-first-general-early-all' : 'active-first-general-early-scoped'),
      };
    };
    const dedupeNormalized = (slugs) => Array.from(
      new Set(
        (Array.isArray(slugs) ? slugs : []).map((slug) => normalizeSessionSlug(slug || ''))
      )
    );
    if (useAllSessions) {
      const rawAll = dedupeNormalized(sessionRegistryStore.getAllSessionSlugs() || []);
      const all = rawAll.filter((slug) => {
        if (!activeChainId) return true;
        const slugChainId = Number(host.getSessionChainId(slug) || 0) || 0;
        if (!slugChainId) return false;
        return slugChainId === activeChainId;
      });
      const scopedFallback = [];
      const prioritized = prioritizeSlugs(
        all.length > 0 ? all : scopedFallback,
        { prioritySlugs: listScopePrioritySlugs }
      );
      const slugs = prioritized.slugs;
      const registryEntryCount = Number(
        registryStatus && Number.isFinite(Number(registryStatus.afterCount))
          ? Number(registryStatus.afterCount)
          : getRegistrySessionEntryCount()
      ) || 0;
      const hadLoadErrors = !!(registryStatus && registryStatus.hadLoadErrors);
      const timedOut = !!(registryStatus && registryStatus.timedOut);
      const hasRegistryEntries = (
        registryEntryCount > 0 ||
        !!(registryStatus && registryStatus.hasEntries === true)
      );
      const hasAnyActiveChainSlug = all.length > 0;
      const noActiveChainSlugs =
        Number(activeChainId || 0) > 0 &&
        hasRegistryEntries &&
        !timedOut &&
        !hadLoadErrors &&
        !hasAnyActiveChainSlug;
      const coverageComplete = (
        hasRegistryEntries &&
        hasAnyActiveChainSlug &&
        !hadLoadErrors &&
        !timedOut
      ) || noActiveChainSlugs;
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
    const prioritized = prioritizeSlugs(
      dedupeNormalized(host.getScopedSessionSlugs(scopeContext.scope)),
      { prioritySlugs: listScopePrioritySlugs }
    );
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

  const scheduleProfileScanRetryAfterRegistryHydration = (targetAddress, reason = '') => {
    const target = String(targetAddress || '').trim();
    if (!target || !ethers.utils.isAddress(target)) return;
    const targetLower = target.toLowerCase();
    if (_profileScanRetryAfterRegistry.has(targetLower)) return;
    const run = _registryBootstrapPromise;
    const waitForBootstrap = run
      ? Promise.resolve(run).catch(() => null)
      : Promise.resolve(null);
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
        if (!host.isMounted()) return;
        _telemetryCtx.emitProfileScanTelemetry('retry-fired', {
          targetAddress: targetLower,
          reason: String(reason || ''),
          waitForHydration,
        });
        return host.scanSpecificUserProfile(target)
          .then((scanReport) => {
            if (!scanReport || typeof scanReport !== 'object') return;
            try {
              if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent(PROFILE_SCAN_REPORT_EVENT, {
                  detail: {
                    source: 'registry-retry',
                    scanReport,
                  },
                }));
              }
            } catch (e) { mainSiteLog.warn('MainSite: telemetry', e); }
          })
          .catch((err) => {
            _telemetryCtx.emitProfileScanTelemetry('retry-failed', {
              targetAddress: targetLower,
              reason: String(reason || ''),
              error: String(err?.message || err),
            });
            mainSiteLog.warn('[DeepSearch] Retry after registry hydration failed:', {
              target: targetLower,
              reason: String(reason || ''),
              error: err?.message || String(err),
            });
          });
      })
      .finally(() => {
        _profileScanRetryAfterRegistry.delete(targetLower);
      });
  };

  const getProfileDeepScanSlugs = () => {
    return resolveProfileDeepScanPlan().slugs;
  };

  const shouldBackfillGeneralSession = (slugIn, scopeContextIn = null) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (!slug) return false;
    const scopeContext = scopeContextIn || host.getSessionScanScopeContext();
    if (scopeContext.scope !== 'general') return false;
    return host.isSessionSlugAllowedForScan('', scopeContext);
  };

  const enqueueGeneralSessionBackfill = ({
    operation = 'unknown',
    activeSlug = '',
    runGeneral,
  } = {}) => {
    if (typeof runGeneral !== 'function') return;

    const opKey = String(operation || '').trim() || 'unknown';
    const activeSlugNormalized = normalizeSessionSlug(activeSlug || '');
    _generalBackfillQueue = _generalBackfillQueue || {};

    const slot = _generalBackfillQueue[opKey] && typeof _generalBackfillQueue[opKey] === 'object'
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
          if (!host.isMounted()) break;
          slot.pending = false;
          const runGeneralNow = slot.runGeneral;
          const activeSlugForRun = slot.activeSlug;
          if (typeof runGeneralNow !== 'function') continue;
          try {
            await runGeneralNow('');
          } catch (err) {
            mainSiteLog.warn('[SessionScanScope] background general session backfill failed', {
              operation: opKey,
              activeSlug: activeSlugForRun,
              error: err?.message || String(err),
            });
          }
        }
      } finally {
        try {
          delete _generalBackfillQueue[opKey];
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      }
    })();
  };

  const runWithGeneralSessionBackfill = async ({
    slugIn,
    operation = 'unknown',
    runPrimary,
    runGeneral,
  } = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (typeof runPrimary !== 'function') return undefined;
    const primaryResult = await runPrimary(slug);
    const scopeContext = host.getSessionScanScopeContext();
    if (!shouldBackfillGeneralSession(slug, scopeContext)) return primaryResult;

    const runGeneralFn = typeof runGeneral === 'function' ? runGeneral : runPrimary;
    enqueueGeneralSessionBackfill({
      operation,
      activeSlug: slug,
      runGeneral: runGeneralFn,
    });
    return primaryResult;
  };

  const destroy = () => {
    _registryBootstrapPromise = null;
    _registryBootstrapScopeKey = '';
    _profileScanRetryAfterRegistry.clear();
    if (_generalBackfillQueue && typeof _generalBackfillQueue === 'object') {
      Object.values(_generalBackfillQueue).forEach((slot) => {
        if (!slot || typeof slot !== 'object') return;
        slot.pending = false;
      });
    }
    _generalBackfillQueue = {};
    _profileScanListScopeSessionConfigCache.clear();
    _telemetryCtx._profileScanTelemetrySeq = 0;
  };

  const controller = {
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
      set: (value) => {
        _registryBootstrapPromise = value;
      },
    },
    _registryBootstrapScopeKey: {
      get: () => _registryBootstrapScopeKey,
      set: (value) => {
        _registryBootstrapScopeKey = String(value || '');
      },
    },
  });

  return controller;
};
