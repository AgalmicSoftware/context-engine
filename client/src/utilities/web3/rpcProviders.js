/**
 * @module rpcProviders
 * @description RPC provider management — cached FallbackProvider instances per chain,
 *              PATH/Pocket RPC preference resolution, and provider selection for sessions.
 *              Mutable state: _providerCache (Map), plus 3 once-logging Sets.
 *
 * Key exports: getReadProviderForGroup, getReadProviderForChain, getReadProviderForSession
 */
import { ethers } from 'ethers';
import store from '../../store.js';
import { DEFAULT_CHAIN_ID, CE_RPC_PROVIDER_MODE } from '../../variables/appConfig.js';
import rpcDefaults from '../../variables/rpcDefaults.js';
import { createLogger, shouldLog } from '../logging.js';
import { getConfiguredPaidRpcHttpUrl, getDefaultHttpRpc, getChainById } from '../../variables/chains.js';
import { wrapEthersJsonRpcSend } from './rpcReadCache.js';
import { shouldUseInjectedReadProviderForChain } from './readProviderSelection.js';
import { toStr } from '../shared/primitives.js';
import { memoizedResolveSession } from '../cache/contractScriptsCache.js';
import { extractChainId } from './contractScripts.corePureHelpers.js';
import { getChainLabelById } from './sessionConfigResolvers.js';
import { isLogsRangeTooLargeError } from './rpcSmartLogFetch.js';
import { logVerboseRpcError } from './rpcErrorSummarization.js';
import {
  SPONSORED_GATE_STATES,
  SPONSORED_ACCESS_CACHE_HIT_TTL_MS,
  resolveSponsoredGateStateForResource,
  readCachedSponsoredAccess,
  addSponsoredAccessChangeListener,
} from './sponsoredAccessState.js';

const { getPathRpcUrl } = rpcDefaults;

const contractsLog = createLogger('contracts');
const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const rpcLog = (...args) => {
  rpcLogger.log(...args);
};

const toLower = (val) => toStr(val).trim().toLowerCase();
const isObj = (val) => !!val && typeof val === 'object' && !Array.isArray(val);
const isAddress = (val) => ethers.utils.isAddress(val);
const sameAddress = (a, b) => !!a && !!b && toLower(a) === toLower(b);

const PATH_PROVIDER_KEYS = new Set(['path', 'pocket']);
const PATH_RPC_ERROR_ONCE = new Set();
const PATH_RPC_SUCCESS_ONCE = new Set();
const RPC_PROVIDER_MODE_DEFAULT = String(CE_RPC_PROVIDER_MODE || 'fallback').trim().toLowerCase() || 'fallback';
const RPC_PROVIDER_SUCCESS_ONCE = new Set();
const SPONSORED_RPC_RESOURCE_KEY = 'rpc';
const SESSION_PROVIDER_TRANSITION_PRUNE_TTL_MS = 60 * 1000;
const TRANSITIONAL_SESSION_ACCESS_STATUSES = new Set(['checking', 'unresolved']);

const normalizeRpcProviderMode = (raw) => {
  const mode = String(raw || '').trim().toLowerCase();
  return mode === 'infura_only' ? 'infura_only' : 'fallback';
};

const shouldTrackSessionProviderCacheKey = (sessionAccessStatus = '') => (
  TRANSITIONAL_SESSION_ACCESS_STATUSES.has(toLower(sessionAccessStatus))
);

const readRpcProviderMode = () => {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.CE_RPC_PROVIDER_MODE !== 'undefined') {
      return normalizeRpcProviderMode(globalThis.CE_RPC_PROVIDER_MODE);
    }
  } catch (_) {}
  return normalizeRpcProviderMode(RPC_PROVIDER_MODE_DEFAULT);
};

const isPathTransportError = (err) => {
  if (!err) return false;
  const code = err?.code ?? err?.error?.code;
  const message = (err?.message || err?.error?.message || '').toLowerCase();
  const status =
    err?.status ??
    err?.statusCode ??
    err?.error?.status ??
    err?.error?.statusCode;

  if (code === 'CALL_EXCEPTION' || code === 'INVALID_ARGUMENT') return false;
  if (typeof status === 'number' && status >= 400) return true;

  if (code === 429 || code === 402 || code === 503) return true;
  if (code === 'NETWORK_ERROR' || code === 'SERVER_ERROR') return true;

  return (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota') ||
    message.includes('payment required') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('server error')
  );
};

const logPathRpcErrorOnce = (url, err, meta = {}) => {
  if (!url || !isPathTransportError(err)) return;
  if (PATH_RPC_ERROR_ONCE.has(url)) return;
  PATH_RPC_ERROR_ONCE.add(url);
  const code = err?.code ?? err?.error?.code;
  const message = err?.message || err?.error?.message || '';
  rpcLogger.error('PATH RPC failed; falling back', { url, code, message, ...meta });
};

const markRangeTooLargeError = (err) => {
  if (!err || err.__ce_range_too_large) return;
  try {
    if (isLogsRangeTooLargeError(err)) err.__ce_range_too_large = true;
  } catch (_) {}
};

const logPathRpcSuccessOnce = (url, meta = {}) => {
  if (!url) return;
  if (!isProviderSuccessLoggingEnabled()) return;
  if (!shouldLog('rpc', 'log')) return;
  if (PATH_RPC_SUCCESS_ONCE.has(url)) return;
  PATH_RPC_SUCCESS_ONCE.add(url);
  rpcLogger.log('PATH RPC ok', { url, ...meta });
};

const isProviderSuccessLoggingEnabled = () => {
  try {
    if (typeof window === 'undefined') return false;
    return window.CE_RPC_LOG_PROVIDER_SUCCESS === true;
  } catch (_) {
    return false;
  }
};

const logRpcProviderSuccessOnce = (url, meta = {}) => {
  if (!url || !isProviderSuccessLoggingEnabled()) return;
  if (!shouldLog('rpc', 'log')) return;
  const key = `${url}|${toStr(meta.method)}|${toStr(meta.chainId)}`;
  if (RPC_PROVIDER_SUCCESS_ONCE.has(key)) return;
  RPC_PROVIDER_SUCCESS_ONCE.add(key);
  const payload = { url, ...meta };
  rpcLogger.log('RPC provider ok', payload);
};

const readPreferPathRpcFlag = (chainId = null) => {
  if (chainId != null && readRpcProviderMode() === 'infura_only' && getConfiguredPaidRpcHttpUrl(chainId)) return false;
  try {
    if (typeof globalThis !== 'undefined') {
      if (typeof globalThis.CE_PREFER_PATH_RPC !== 'undefined') {
        return !!globalThis.CE_PREFER_PATH_RPC;
      }
    }
  } catch (_) {}
  return true;
};

const normalizeRpcUrlList = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((u) => toStr(u).trim()).filter(Boolean);
  }
  const str = toStr(raw).trim();
  return str ? [str] : [];
};

const dedupeRpcUrls = (raw = []) => {
  const seen = new Set();
  return normalizeRpcUrlList(raw).filter((url) => {
    const key = url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const hasCustomPathOverrides = (pathOverrideUrls = [], defaultPathUrls = []) => {
  const defaultUrlSet = new Set(dedupeRpcUrls(defaultPathUrls).map((url) => toLower(url)));
  return dedupeRpcUrls(pathOverrideUrls).some((url) => !defaultUrlSet.has(toLower(url)));
};

const sanitizeRpcUrlMap = (raw) => {
  if (!isObj(raw)) return {};
  return Object.entries(raw).reduce((acc, [chainKey, urls]) => {
    const normalized = dedupeRpcUrls(urls);
    if (normalized.length) acc[String(chainKey)] = normalized;
    return acc;
  }, {});
};

const hasRpcUrlMapEntryForChain = (rpcMap = {}, chainId = 0) => {
  if (!rpcMap || !Object.keys(rpcMap).length) return false;
  const id = Number(chainId || 0);
  if (!id) return true;
  return normalizeRpcUrlList(rpcMap[String(id)] || rpcMap[id] || rpcMap[chainId]).length > 0;
};

const pickFirstNonEmptyRpcUrlMap = (chainId, ...candidates) => candidates.reduce((found, candidate) => {
  if (hasRpcUrlMapEntryForChain(found, chainId)) return found;
  const sanitized = sanitizeRpcUrlMap(candidate);
  return hasRpcUrlMapEntryForChain(sanitized, chainId) ? sanitized : found;
}, {});

const normalizeAddress = (value) => {
  const account = toStr(value).trim();
  return isAddress(account) ? account : '';
};

const getCurrentReadRpcAccount = () => {
  const selected = normalizeAddress(globalThis?.ethereum?.selectedAddress);
  let reduxAccount = '';
  try {
    reduxAccount = normalizeAddress(store?.getState?.()?.profile?.account);
  } catch (_) {}
  if (selected) {
    return {
      account: selected,
      mismatch: !!(reduxAccount && !sameAddress(selected, reduxAccount)),
    };
  }
  return {
    account: reduxAccount,
    mismatch: false,
  };
};

const warmSponsoredSessionRpcAccess = ({
  sessionConfig,
  sessionSlug,
  account,
} = {}) => {
  Promise.resolve()
    .then(() => import('./sponsoredAccess.js'))
    .then((mod) => mod?.primeSponsoredAccessCheck?.({
      sessionConfig,
      sessionSlug,
      account,
      resourceKey: SPONSORED_RPC_RESOURCE_KEY,
    }))
    .catch(() => {});
};

const resolveRpcMap = (rpcCfg) => {
  if (!isObj(rpcCfg)) return {};
  return (
    (isObj(rpcCfg.rpcUrlsByChainId) && rpcCfg.rpcUrlsByChainId) ||
    (isObj(rpcCfg.urlsByChainId) && rpcCfg.urlsByChainId) ||
    (isObj(rpcCfg.rpcUrls) && rpcCfg.rpcUrls) ||
    (isObj(rpcCfg.urls) && rpcCfg.urls) ||
    {}
  );
};

const resolvePathOverrideUrls = (cfg = {}, chainId = 0) => {
  const id = Number(chainId || 0);
  const rpc = isObj(cfg?.rpc) ? cfg.rpc : {};
  const providers = isObj(rpc.providers) ? rpc.providers : {};
  const pathCfg = isObj(rpc.path) ? rpc.path : (isObj(providers.path) ? providers.path : {});
  const pathMap = resolveRpcMap(pathCfg);
  const mappedUrls = id
    ? dedupeRpcUrls(pathMap[String(id)] || pathMap[id] || pathMap[chainId])
    : [];
  const directUrls = dedupeRpcUrls(
    []
      .concat(normalizeRpcUrlList(pathCfg?.rpcUrl))
      .concat(normalizeRpcUrlList(pathCfg?.url))
      .concat(normalizeRpcUrlList(pathCfg?.gatewayUrl))
  );
  return dedupeRpcUrls([].concat(mappedUrls).concat(directUrls));
};

const resolveBrowserVisibleSessionRpcUrls = (cfg = {}, chainId = 0) => {
  const id = Number(chainId || 0);
  const rpc = isObj(cfg?.rpc) ? cfg.rpc : {};
  const defaultSessionChainId = Number(extractChainId(cfg, { strict: true }) || 0);
  const shouldUseDirectUrls = !id || !defaultSessionChainId || id === defaultSessionChainId;
  const rpcMap = pickFirstNonEmptyRpcUrlMap(
    id,
    resolveRpcMap(rpc),
    resolveRpcMap(cfg)
  );
  const mappedUrls = id
    ? dedupeRpcUrls(rpcMap[String(id)] || rpcMap[id] || rpcMap[chainId])
    : [];
  const directUrls = shouldUseDirectUrls
    ? dedupeRpcUrls(
        []
          .concat(normalizeRpcUrlList(cfg?.rpcEndpoint))
          .concat(normalizeRpcUrlList(cfg?.rpcUrl))
          .concat(normalizeRpcUrlList(rpc?.rpcEndpoint))
          .concat(normalizeRpcUrlList(rpc?.endpoint))
          .concat(normalizeRpcUrlList(rpc?.rpcUrl))
          .concat(normalizeRpcUrlList(rpc?.url))
      )
    : [];
  return dedupeRpcUrls([].concat(mappedUrls).concat(directUrls));
};

const resolveSponsoredSessionRpcAccess = (cfg = {}, sessionSlug = '', sessionRpcUrls = []) => {
  if (!Array.isArray(sessionRpcUrls) || !sessionRpcUrls.length) {
    return {
      allowed: false,
      status: 'unavailable',
      accessMode: 'none',
      account: '',
    };
  }

  const gateState = resolveSponsoredGateStateForResource(cfg, SPONSORED_RPC_RESOURCE_KEY);
  const gateStatus = gateState?.status || SPONSORED_GATE_STATES.UNAVAILABLE;
  const hasExplicitParticipantRpcOptIn = (
    gateStatus === SPONSORED_GATE_STATES.OPEN ||
    gateStatus === SPONSORED_GATE_STATES.RESTRICTED ||
    gateStatus === SPONSORED_GATE_STATES.UNRESOLVED
  );

  // Regression guard: Session Wizard writes top-level rpcUrl/rpcUrlsByChainId for
  // ordinary sessions, so participant reads must not honor those fields unless
  // the session explicitly opts into sponsored/root RPC access.
  if (!hasExplicitParticipantRpcOptIn) {
    return {
      allowed: false,
      status: 'unavailable',
      accessMode: 'none',
      account: '',
    };
  }

  if (gateStatus === SPONSORED_GATE_STATES.OPEN) {
    return {
      allowed: true,
      status: 'open',
      accessMode: 'sponsored-open',
      account: '',
    };
  }

  if (gateStatus === SPONSORED_GATE_STATES.RESTRICTED) {
    const { account, mismatch } = getCurrentReadRpcAccount();
    if (!account) {
      return {
        allowed: false,
        status: 'needs-wallet',
        accessMode: 'sponsored-restricted',
        account: '',
      };
    }

    if (mismatch) {
      return {
        allowed: false,
        status: 'checking',
        accessMode: 'sponsored-restricted',
        account,
      };
    }

    const cachedAccess = readCachedSponsoredAccess({
      sessionConfig: cfg,
      account,
      resourceKey: SPONSORED_RPC_RESOURCE_KEY,
      maxAgeMs: SPONSORED_ACCESS_CACHE_HIT_TTL_MS,
    });

    if (cachedAccess?.status === 'granted') {
      return {
        allowed: true,
        status: 'granted',
        accessMode: 'sponsored-restricted',
        account,
      };
    }

    const cachedStatus = toStr(cachedAccess?.status).trim().toLowerCase();

    // Regression guard: restricted sponsored RPC must fail closed until the
    // wallet grant is verified, so we warm the check in the background.
    if (cachedStatus !== SPONSORED_GATE_STATES.UNAVAILABLE) {
      void warmSponsoredSessionRpcAccess({
        sessionConfig: cfg,
        sessionSlug,
        account,
      });
    }

    return {
      allowed: false,
      status: cachedStatus || 'checking',
      accessMode: 'sponsored-restricted',
      account,
    };
  }

  return {
    allowed: false,
    status: gateStatus === SPONSORED_GATE_STATES.UNAVAILABLE ? 'unknown' : gateStatus,
    accessMode: 'sponsored-unknown',
    account: '',
  };
};

function resolveGroupPathRpcPreference(cfg, chainId) {
  const id = Number(chainId || 0);
  if (!id) return null;
  if (readRpcProviderMode() === 'infura_only' && getConfiguredPaidRpcHttpUrl(id)) return null;

  const rpc = isObj(cfg?.rpc) ? cfg.rpc : {};
  const providers = isObj(rpc.providers) ? rpc.providers : {};
  const pathCfg = isObj(rpc.path) ? rpc.path : (isObj(providers.path) ? providers.path : {});
  const activeCfg = pathCfg;
  const providerName = toLower(rpc.provider || rpc.mode || cfg?.rpcProvider || '');
  const providerIsDefault = !providerName || providerName === 'default';
  const providerIsPath = PATH_PROVIDER_KEYS.has(providerName);
  const preferGlobal = readPreferPathRpcFlag(id);
  const pathDefaultUrls = dedupeRpcUrls(getPathRpcUrl(id));
  const pathOverrideUrls = resolvePathOverrideUrls(cfg, id);
  const usingCustomPathOverrides = hasCustomPathOverrides(pathOverrideUrls, pathDefaultUrls);
  const sessionRootUrls = dedupeRpcUrls(
    resolveBrowserVisibleSessionRpcUrls(cfg, id).filter(
      (url) => !usingCustomPathOverrides || !pathOverrideUrls.some((existing) => existing.toLowerCase() === url.toLowerCase())
    )
  );
  const sessionRootAccess = resolveSponsoredSessionRpcAccess(cfg, cfg?.slug || '', sessionRootUrls);
  const hasPathOverrides =
    !!activeCfg?.enabled ||
    usingCustomPathOverrides;
  const hasSessionRootAccess = sessionRootAccess.allowed && sessionRootUrls.length > 0;
  // Session-root RPCs can opt in session-specific reads without implicitly
  // re-enabling PATH defaults when PATH preference is disabled.
  const wantsPathDefaults = providerIsPath || (providerIsDefault && (hasPathOverrides || preferGlobal));
  const wantsPreferredRpc = wantsPathDefaults || (providerIsDefault && hasSessionRootAccess);
  if (!wantsPreferredRpc) {
    return providerIsDefault ? null : { skipGlobalPreferred: true };
  }

  const preferredUrls = dedupeRpcUrls(
    []
      .concat(usingCustomPathOverrides ? pathOverrideUrls : [])
      .concat(usingCustomPathOverrides ? [] : (hasSessionRootAccess ? sessionRootUrls : []))
      .concat(wantsPathDefaults ? pathDefaultUrls : [])
  );

  if (!preferredUrls.length) return null;

  const usingPathOverrides = usingCustomPathOverrides;
  const usingSessionRootUrls = !usingPathOverrides && sessionRootAccess.allowed && sessionRootUrls.length > 0;
  const label = usingSessionRootUrls
    ? 'session'
    : (providerIsPath ? providerName : 'path');
  const cacheKeyPrefix = usingSessionRootUrls ? 'session' : 'path';
  const sessionSlug = toStr(cfg?.slug).trim();
  const shouldUseSessionSlugInCacheKey = (
    !!sessionSlug &&
    shouldTrackSessionProviderCacheKey(sessionRootAccess.status)
  );
  const accessCacheKey = [
    toStr(sessionRootAccess.accessMode).trim() || 'none',
    toStr(sessionRootAccess.status).trim() || 'unavailable',
    usingPathOverrides ? 'path' : (usingSessionRootUrls ? 'root' : 'fallback'),
  ].join(':');
  return {
    preferredUrls,
    providerLabel: label,
    cacheKey: `${cacheKeyPrefix}:${id}${shouldUseSessionSlugInCacheKey ? `:${sessionSlug}` : ''}:${accessCacheKey}:${preferredUrls.join('|')}`,
    treatPreferredUrlsAsPath: label === 'path' || label === 'pocket',
    sessionAccessStatus: sessionRootAccess.status,
    sessionAccessMode: sessionRootAccess.accessMode,
    sessionRpcSource: usingPathOverrides
      ? 'path'
      : usingSessionRootUrls
        ? 'root'
        : 'default-path',
  };
}

// === Cached provider registry (per chain + variant) ===
const _providerCache = new Map();
const _sessionProviderCacheKeys = new Map();
const clearTrackedSessionProviderCacheKey = (
  sessionSlug = '',
  cacheKey = '',
  { deleteProvider = true } = {}
) => {
  const slug = toStr(sessionSlug).trim();
  const key = toStr(cacheKey).trim();
  if (!slug || !key) return;
  const cacheKeys = _sessionProviderCacheKeys.get(slug);
  if (!cacheKeys?.size || !cacheKeys.has(key)) return;
  const timeoutId = cacheKeys.get(key);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  cacheKeys.delete(key);
  if (deleteProvider) {
    _providerCache.delete(key);
  }
  if (!cacheKeys.size) {
    _sessionProviderCacheKeys.delete(slug);
  }
};

const trackSessionProviderCacheKey = (sessionSlug = '', cacheKey = '') => {
  const slug = toStr(sessionSlug).trim();
  const key = toStr(cacheKey).trim();
  if (!slug || !key) return;
  clearTrackedSessionProviderCacheKey(slug, key, { deleteProvider: false });
  const timeoutId = setTimeout(() => {
    clearTrackedSessionProviderCacheKey(slug, key);
  }, SESSION_PROVIDER_TRANSITION_PRUNE_TTL_MS);
  const existing = _sessionProviderCacheKeys.get(slug);
  if (existing) {
    existing.set(key, timeoutId);
    return;
  }
  _sessionProviderCacheKeys.set(slug, new Map([[key, timeoutId]]));
};

const clearTrackedSessionProviderCache = (sessionSlug = '') => {
  const slug = toStr(sessionSlug).trim();
  if (!slug) return;
  const cacheKeys = _sessionProviderCacheKeys.get(slug);
  if (!cacheKeys?.size) return;
  cacheKeys.forEach((timeoutId, cacheKey) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    _providerCache.delete(cacheKey);
  });
  _sessionProviderCacheKeys.delete(slug);
};

addSponsoredAccessChangeListener((payload = {}) => {
  if (toStr(payload?.resourceKey).trim() !== SPONSORED_RPC_RESOURCE_KEY) return;
  clearTrackedSessionProviderCache(payload?.sessionSlug);
});

const syncTrackedSessionProviderCache = (
  sessionSlug = '',
  cacheKey = '',
  sessionAccessStatus = ''
) => {
  if (shouldTrackSessionProviderCacheKey(sessionAccessStatus)) {
    trackSessionProviderCacheKey(sessionSlug, cacheKey);
    return;
  }
  clearTrackedSessionProviderCache(sessionSlug);
};

const filterPathUrls = (urls = [], pathUrls = [], allowPath = true) => {
  const normalizedUrls = normalizeRpcUrlList(urls);
  if (allowPath) return normalizedUrls;
  const pathUrlSet = new Set(normalizeRpcUrlList(pathUrls).map((url) => toLower(url)));
  if (!pathUrlSet.size) return normalizedUrls;
  return normalizedUrls.filter((url) => !pathUrlSet.has(toLower(url)));
};

const buildReadProviderResolution = (chainId, opts = {}) => {
  const requestedId = Number(chainId || 0);
  const id = requestedId > 0
    ? requestedId
    : (Number(DEFAULT_CHAIN_ID || 0) || 0);
  const providerMode = readRpcProviderMode();
  const configuredPaidRpcUrl = toStr(getConfiguredPaidRpcHttpUrl(id)).trim();
  const infuraOnlyForChain = providerMode === 'infura_only' && !!configuredPaidRpcUrl;
  const preferPathFlag = readPreferPathRpcFlag(id);
  const pathDefaultUrls = normalizeRpcUrlList(getPathRpcUrl(id));
  const treatPreferredUrlsAsPath = opts.treatPreferredUrlsAsPath === true;
  const preferredUrlsRaw = Array.isArray(opts.preferredUrls)
    ? opts.preferredUrls.map((u) => toStr(u).trim()).filter(Boolean)
    : [];
  const globalPreferred = !infuraOnlyForChain && !opts.skipGlobalPreferred && preferPathFlag
    ? pathDefaultUrls
    : [];
  const preferredUrls = infuraOnlyForChain ? [] : (preferredUrlsRaw.length ? preferredUrlsRaw : globalPreferred);
  const allowPathUrls = !infuraOnlyForChain && (
    treatPreferredUrlsAsPath ||
    (!preferredUrlsRaw.length && !opts.skipGlobalPreferred && preferPathFlag)
  );
  const providerLabel = infuraOnlyForChain
    ? 'infura_only'
    : (toStr(opts.providerLabel || '') || (preferredUrls.length ? 'path' : 'default'));
  const keyBase = opts.cacheKey
    ? String(opts.cacheKey)
    : (preferredUrls.length ? `pref:${id}:${preferredUrls.join('|')}` : String(id));
  const key = `${providerMode}:${keyBase}`;

  const chain = getChainById(id);
  const publicUrls = filterPathUrls(chain?.rpcUrls?.public?.http, pathDefaultUrls, allowPathUrls);
  const defaultUrls = filterPathUrls(chain?.rpcUrls?.default?.http, pathDefaultUrls, allowPathUrls);
  const fallbackCandidate = getDefaultHttpRpc(id, {
    allowPath: allowPathUrls
  }) || null;
  const fallbackUrl = filterPathUrls(
    fallbackCandidate ? [fallbackCandidate] : [],
    pathDefaultUrls,
    allowPathUrls
  )[0] || null;

  const ordered = []
    .concat(preferredUrls || [])
    .concat(publicUrls || [])
    .concat(defaultUrls || [])
    .concat(fallbackUrl ? [fallbackUrl] : [])
    .map((u) => (u || '').trim())
    .filter(Boolean);

  const effectiveOrdered = infuraOnlyForChain && configuredPaidRpcUrl
    ? (() => {
        const paidOnly = ordered.filter((url) => url === configuredPaidRpcUrl);
        return paidOnly.length ? paidOnly : ordered;
      })()
    : ordered;

  const seen = new Set();
  const urls = effectiveOrdered.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));

  if (urls.length === 0) {
    throw new Error(`No RPC URL configured for chainId=${id}`);
  }

  return {
    id,
    key,
    chain,
    urls,
    publicUrls,
    defaultUrls,
    fallbackUrl,
    preferredUrls,
    providerLabel,
    preferPathFlag,
    pathDefaultUrls,
    providerMode,
    infuraOnlyForChain,
    configuredPaidRpcUrl,
    treatPreferredUrlsAsPath,
  };
};


/**
 * Internal: return a memoized read-only provider for a chain.
 * Builds a FallbackProvider that prefers PUBLIC RPCs first, then default/paid, then fallback.
 * Uses a **static network** on each JsonRpcProvider to avoid detectNetwork() overhead.
 * Quorum=1 to avoid fanning out requests when one healthy endpoint responds.
 */
function _getCachedProvider(chainId, opts = {}) {
  const resolution = buildReadProviderResolution(chainId, opts);
  const {
    id,
    key,
    chain,
    urls,
    publicUrls,
    defaultUrls,
    preferredUrls,
    providerLabel,
    preferPathFlag,
    pathDefaultUrls,
    providerMode,
    infuraOnlyForChain,
    treatPreferredUrlsAsPath,
  } = resolution;
  if (_providerCache.has(key)) return _providerCache.get(key);

  // CRITICAL: Static network object suppresses internal detectNetwork() / eth_chainId calls
  const staticNet = { chainId: id, name: chain?.network || `chain-${id}` };
  const pathPreferred = preferredUrls.length > 0 && treatPreferredUrlsAsPath;
  const pathPreferredSet = pathPreferred ? new Set(preferredUrls) : null;

  if (shouldLog('rpc', 'log')) {
    rpcLog('PROVIDER_SELECT', {
      function: '_getCachedProvider',
      chainId: id,
      chainLabel: getChainLabelById(id),
      urls,
      provider: providerLabel,
      preferredCount: preferredUrls.length,
      publicCount: publicUrls.length,
      defaultCount: defaultUrls.length,
      preferPath: preferPathFlag,
      pathDefaults: pathDefaultUrls,
      preferredUrls,
      skipGlobalPreferred: !!opts.skipGlobalPreferred,
      providerMode,
      infuraOnlyForChain,
      sessionAccessStatus: toStr(opts.sessionAccessStatus).trim() || '',
      sessionAccessMode: toStr(opts.sessionAccessMode).trim() || '',
      sessionRpcSource: toStr(opts.sessionRpcSource).trim() || '',
    });
  }

  const lastIndex = urls.length - 1;

  const providerConfigs = urls.map((url, idx) => {
    const isBackup = urls.length > 1 && idx === lastIndex;
    const provider = new ethers.providers.JsonRpcProvider(url, staticNet);

    const basePerform = provider.perform.bind(provider);
    provider.perform = async (method, params) => {
      try {
        const result = await basePerform(method, params);
        logRpcProviderSuccessOnce(url, { chainId: id, method, provider: providerLabel });
        if (pathPreferredSet && pathPreferredSet.has(url)) {
          logPathRpcSuccessOnce(url, { chainId: id, method, provider: providerLabel });
        }
        return result;
      } catch (err) {
        if (pathPreferredSet && pathPreferredSet.has(url)) {
          markRangeTooLargeError(err);
          logPathRpcErrorOnce(url, err, { chainId: id, method, provider: providerLabel });
          logVerboseRpcError('PATH RPC error detail', err, {
            chainId: id,
            method,
            provider: providerLabel,
            url
          });
        }
        throw err;
      }
    };

    // Central JSON-RPC read caching + in-flight dedupe (opt-in via window.ENABLE_RPC_DEBUG_STATS for stats,
    // and bypassable via window.CE_RPC_CACHE_DISABLED).
    wrapEthersJsonRpcSend(provider, {
      chainId: id,
      providerKey: key,
      providerLabel,
      url,
    });

    return {
      // Explicitly pass staticNet so JsonRpcProvider never queries the node for chainId
      provider,
      // Ethers FallbackProvider favors LOWER priority values (1 is higher priority than 10).
      // Treat the last URL (for example, a paid diagnostics RPC) as a cold fallback.
      priority: isBackup ? 50 : (idx + 1),
      // Public RPCs fan out quickly; paid backup waits much longer before being tried.
      stallTimeout: isBackup ? 6000 : 1500,
      weight: 1
    };
  });

  const fp = new ethers.providers.FallbackProvider(providerConfigs, 1);
  fp.pollingInterval = 12000;
  Object.defineProperty(fp, '__CE_RPC_META', {
    value: {
      chainId: id,
      providerLabel,
      preferredUrls,
      preferPath: preferPathFlag,
      pathDefaults: pathDefaultUrls,
      skipGlobalPreferred: !!opts.skipGlobalPreferred,
      providerMode,
      infuraOnlyForChain,
      sessionAccessStatus: toStr(opts.sessionAccessStatus).trim() || '',
      sessionAccessMode: toStr(opts.sessionAccessMode).trim() || '',
      sessionRpcSource: toStr(opts.sessionRpcSource).trim() || '',
    },
    enumerable: false
  });
  Object.defineProperty(fp, '__CE_RPC_CACHE_KEY', {
    value: key,
    enumerable: false
  });

  _providerCache.set(key, fp);
  return fp;
}



/**
 * Choose a read-only provider for the given chainId using chains.js.
 */
function getReadProviderForChain(chainId) {
  const id = Number(chainId || 0);
  return _getCachedProvider(id);
}

function getReadProviderDiagnostics(chainId, opts = {}) {
  const resolution = buildReadProviderResolution(chainId, opts);
  return {
    chainId: resolution.id,
    chainName: resolution.chain?.name || getChainLabelById(resolution.id),
    providerMode: resolution.providerMode,
    providerLabel: resolution.providerLabel,
    preferPath: resolution.preferPathFlag,
    pathDefaults: [...resolution.pathDefaultUrls],
    preferredUrls: [...resolution.preferredUrls],
    publicUrls: [...resolution.publicUrls],
    defaultUrls: [...resolution.defaultUrls],
    fallbackUrl: resolution.fallbackUrl || '',
    configuredPaidRpcUrl: resolution.configuredPaidRpcUrl,
    includesConfiguredPaidRpc: !!(
      resolution.configuredPaidRpcUrl &&
      resolution.urls.includes(resolution.configuredPaidRpcUrl)
    ),
    infuraOnlyForChain: resolution.infuraOnlyForChain,
    sessionAccessStatus: toStr(opts.sessionAccessStatus).trim() || '',
    sessionAccessMode: toStr(opts.sessionAccessMode).trim() || '',
    sessionRpcSource: toStr(opts.sessionRpcSource).trim() || '',
    urls: [...resolution.urls],
  };
}

function getLocalAwareReadProviderForChain(chainId) {
  const id = Number(chainId || 0);
  const injectedProvider = typeof window !== 'undefined' ? window.ethereum : null;
  if (shouldUseInjectedReadProviderForChain({
    targetChainId: id,
    injectedProvider,
  })) {
    try {
      return new ethers.providers.Web3Provider(injectedProvider, 'any');
    } catch (_) {
      // Fall back to the cached read provider when the injected local provider is unavailable.
    }
  }
  return getReadProviderForChain(id);
}

function getLocalAwareReadProviderForGroup(groupKeyOrCfg, options = null) {
  const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
  const chId = extractChainId(cfg, options);
  const injectedProvider = typeof window !== 'undefined' ? window.ethereum : null;
  if (shouldUseInjectedReadProviderForChain({
    targetChainId: chId,
    injectedProvider,
  })) {
    try {
      return new ethers.providers.Web3Provider(injectedProvider, 'any');
    } catch (_) {
      // Fall back to the session-aware read provider when the injected local provider is unavailable.
    }
  }
  return getReadProviderForGroup(groupKeyOrCfg, options);
}

/**
 * Resolve a demo session (key/slug/object) to its chain and return a **read-only**
 * provider for that chain.
 */
export function getReadProviderForGroup(groupKeyOrCfg, options = null) {
  const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
  const slugOrEmpty = cfg && typeof cfg.slug !== 'undefined' ? cfg.slug : '';
  const chId = extractChainId(cfg, options) || undefined;

  if (!chId) {
    contractsLog.warn("getReadProviderForGroup: Could not resolve chainId for group", groupKeyOrCfg);
  }

  const rpcPref = resolveGroupPathRpcPreference(cfg, chId);
  if (shouldLog('rpc', 'log')) {
    rpcLog('PROVIDER_SELECT', {
      function: 'getReadProviderForGroup',
      group: slugOrEmpty,
      groupKey: groupKeyOrCfg,
      chainId: chId || null,
      contractKey: String(options?.contractKey || '').trim() || null,
      chainLabel: chId ? getChainLabelById(chId) : null,
      rpcProvider: rpcPref?.providerLabel || 'default'
    });
  }

  const provider = rpcPref ? _getCachedProvider(chId, rpcPref) : _getCachedProvider(chId);
  syncTrackedSessionProviderCache(
    slugOrEmpty,
    provider?.__CE_RPC_CACHE_KEY,
    rpcPref?.sessionAccessStatus
  );
  return provider;
}

export const getReadProviderForSession = getReadProviderForGroup;

export {
  getReadProviderForChain,
  getReadProviderDiagnostics,
  getLocalAwareReadProviderForChain,
  getLocalAwareReadProviderForGroup,
  resolveGroupPathRpcPreference,
  readRpcProviderMode,
  normalizeRpcProviderMode,
};
