/**
 * @module rpcProviders
 * @description RPC provider management — cached FallbackProvider instances per chain,
 *              PATH/Pocket RPC preference resolution, and provider selection for sessions.
 *              Mutable state: _providerCache (Map), plus 3 once-logging Sets.
 *
 * Key exports: getReadProviderForGroup, getReadProviderForChain, getReadProviderForSession
 */
import { ethers } from 'ethers';
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

const { getPathRpcUrl } = rpcDefaults;

const contractsLog = createLogger('contracts');
const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const rpcLog = (...args) => {
  rpcLogger.log(...args);
};

const toLower = (val) => toStr(val).trim().toLowerCase();
const isObj = (val) => !!val && typeof val === 'object' && !Array.isArray(val);

const PATH_PROVIDER_KEYS = new Set(['path', 'pocket']);
const PATH_RPC_ERROR_ONCE = new Set();
const PATH_RPC_SUCCESS_ONCE = new Set();
const RPC_PROVIDER_MODE_DEFAULT = String(CE_RPC_PROVIDER_MODE || 'fallback').trim().toLowerCase() || 'fallback';
const RPC_PROVIDER_SUCCESS_ONCE = new Set();

const normalizeRpcProviderMode = (raw) => {
  const mode = String(raw || '').trim().toLowerCase();
  return mode === 'infura_only' ? 'infura_only' : 'fallback';
};

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

  const map = resolveRpcMap(activeCfg);
  const mappedUrl = normalizeRpcUrlList(map[String(id)] || map[id] || map[chainId]);
  const overrideUrls = normalizeRpcUrlList(activeCfg?.rpcUrl || activeCfg?.url || activeCfg?.gatewayUrl);
  const hasOverrides =
    !!activeCfg?.enabled || mappedUrl.length > 0 || overrideUrls.length > 0 || Object.keys(map).length > 0;

  const wantsPath = providerIsPath || (providerIsDefault && (hasOverrides || preferGlobal));
  if (!wantsPath) {
    return providerIsDefault ? null : { skipGlobalPreferred: true };
  }

  const defaultUrl = normalizeRpcUrlList(getPathRpcUrl(id));
  const preferredUrls = []
    .concat(mappedUrl)
    .concat(overrideUrls)
    .concat(defaultUrl)
    .map((u) => u.trim())
    .filter(Boolean);

  if (!preferredUrls.length) return null;

  const label = providerIsPath ? providerName : 'path';
  const cacheKey = `path:${id}:${preferredUrls.join('|')}`;
  return { preferredUrls, providerLabel: label, cacheKey };
}

// === Cached provider registry (per chain + variant) ===
const _providerCache = new Map();

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
  const preferredUrlsRaw = Array.isArray(opts.preferredUrls)
    ? opts.preferredUrls.map((u) => toStr(u).trim()).filter(Boolean)
    : [];
  const globalPreferred = !infuraOnlyForChain && !opts.skipGlobalPreferred && preferPathFlag
    ? pathDefaultUrls
    : [];
  const preferredUrls = infuraOnlyForChain ? [] : (preferredUrlsRaw.length ? preferredUrlsRaw : globalPreferred);
  const providerLabel = infuraOnlyForChain
    ? 'infura_only'
    : (toStr(opts.providerLabel || '') || (preferredUrls.length ? 'path' : 'default'));
  const keyBase = opts.cacheKey
    ? String(opts.cacheKey)
    : (preferredUrls.length ? `pref:${id}:${preferredUrls.join('|')}` : String(id));
  const key = `${providerMode}:${keyBase}`;

  const chain = getChainById(id);
  const publicUrls = Array.isArray(chain?.rpcUrls?.public?.http) ? chain.rpcUrls.public.http : [];
  const defaultUrls = Array.isArray(chain?.rpcUrls?.default?.http) ? chain.rpcUrls.default.http : [];
  const fallbackUrl = getDefaultHttpRpc(id, {
    allowPath: infuraOnlyForChain ? false : !opts.skipGlobalPreferred
  }) || null;

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
  } = resolution;
  if (_providerCache.has(key)) return _providerCache.get(key);

  // CRITICAL: Static network object suppresses internal detectNetwork() / eth_chainId calls
  const staticNet = { chainId: id, name: chain?.network || `chain-${id}` };
  const pathPreferred =
    preferredUrls.length > 0 &&
    (providerLabel === 'path' || providerLabel === 'pocket' || preferPathFlag);
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
      infuraOnlyForChain
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
      infuraOnlyForChain
    },
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

  return rpcPref ? _getCachedProvider(chId, rpcPref) : _getCachedProvider(chId);
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
