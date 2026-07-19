const DEFAULT_CHAIN_ID = '11155420';
const DEFAULT_RPC_TIMEOUT_MS = 5_000;
const SESSION_REGISTRY_BY_CHAIN = Object.freeze({
  '11155420': '0xDcB1731984E9F75c6a061c38dD8b67d18De4C0c1',
});

const SELECTORS = Object.freeze({
  getSessionCount: '0x6e6734bf',
  getSessionSlugByIndex: '0x27916a76',
});

const SESSION_SLUG_RE = /^[a-z0-9_-]{1,128}$/i;
const REGISTRY_SESSION_CACHE_TTL_MS = 2 * 60 * 1000;
const REGISTRY_SESSION_KV_PREFIX = 'telegram:registry-sessions:v1:';
const registrySessionCache = new Map();

function safeString(value) {
  return String(value || '').trim();
}

function normalizeChainId(value = '') {
  return safeString(value || DEFAULT_CHAIN_ID) || DEFAULT_CHAIN_ID;
}

function normalizeHexAddress(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{40}$/.test(text) ? text : '';
}

function splitRpcUrls(value = '') {
  return safeString(value)
    .split(/[\s,]+/)
    .map((entry) => safeString(entry))
    .filter((entry) => /^https:\/\/[^/\s]+(?:\/.*)?$/i.test(entry));
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizePositiveInteger(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function rpcTimeoutMs(env = {}) {
  return normalizePositiveInteger(env.AGENT_BRIDGE_RPC_TIMEOUT_MS, DEFAULT_RPC_TIMEOUT_MS);
}

export function resolveRegistryRpcUrls(env = {}) {
  const urls = [
    ...splitRpcUrls(env.DEFAULT_RPC_URL),
    ...splitRpcUrls(env.ADDITIONAL_RPC_URL),
  ];
  return [...new Set(urls)];
}

export function resolveSessionRegistryAddress(env = {}) {
  return normalizeHexAddress(
    env.AGENT_BRIDGE_SESSION_REGISTRY_ADDRESS ||
    env.SESSION_REGISTRY_ADDRESS ||
    env.SESSION_REGISTRY ||
    SESSION_REGISTRY_BY_CHAIN[normalizeChainId(env.DEFAULT_CHAIN_ID)]
  );
}

function hexWord(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function encodeUint256(value) {
  const n = BigInt(value);
  if (n < 0n) throw new Error('uint256 cannot be negative');
  return hexWord(n);
}

function strip0x(value = '') {
  return safeString(value).replace(/^0x/i, '');
}

function decodeUint256Word(word = '') {
  const hex = strip0x(word).slice(0, 64);
  return hex ? BigInt(`0x${hex}`) : 0n;
}

function decodeAbiString(result = '', slotIndex = 0) {
  const hex = strip0x(result);
  if (hex.length < 64) return '';
  const offset = Number(decodeUint256Word(hex.slice(slotIndex * 64, slotIndex * 64 + 64)));
  const lengthOffset = offset * 2;
  const length = Number(decodeUint256Word(hex.slice(lengthOffset, lengthOffset + 64)));
  const bytesHex = hex.slice(lengthOffset + 64, lengthOffset + 64 + length * 2);
  if (!bytesHex) return '';
  const bytes = bytesHex.match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) || [];
  return new TextDecoder().decode(new Uint8Array(bytes)).trim();
}

function buildGetSessionSlugByIndexData(index) {
  return `${SELECTORS.getSessionSlugByIndex}${encodeUint256(index)}`;
}

async function jsonRpcCall({
  rpcUrl = '',
  registryAddress = '',
  data = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('SessionRegistry RPC timed out')), timeoutMs);
  const response = await fetchImpl(rpcUrl, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: registryAddress, data }, 'latest'],
    }),
  }).finally(() => clearTimeout(timeout));
  try {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) {
      throw new Error(safeString(body?.error?.message) || `RPC call failed (${response.status || 502})`);
    }
    const result = safeString(body?.result);
    if (!/^0x[0-9a-fA-F]*$/.test(result)) throw new Error('RPC result was not hex');
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function callWithRpcFallback({
  rpcUrls = [],
  registryAddress = '',
  data = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  let lastError = null;
  for (const rpcUrl of rpcUrls) {
    try {
      const result = await jsonRpcCall({ rpcUrl, registryAddress, data, fetchImpl, timeoutMs });
      return { ok: true, result, rpcUrl };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    ok: false,
    error: safeString(lastError?.message || lastError) || 'No RPC URL succeeded',
  };
}

export async function listRegistrySessionsForBridge({
  env = {},
  fetchImpl = env.REGISTRY_FETCH || globalThis.fetch,
  forceRefresh = false,
} = {}) {
  const registryAddress = resolveSessionRegistryAddress(env);
  const rpcUrls = resolveRegistryRpcUrls(env);
  const chainId = normalizeChainId(env.DEFAULT_CHAIN_ID);
  const maxSessions = Math.max(1, Math.min(250, Number(env.AGENT_BRIDGE_MAX_REGISTRY_SESSIONS || 50) || 50));
  const cacheKey = `${chainId}|${registryAddress.toLowerCase()}|${rpcUrls.join('|')}|${maxSessions}`;
  const kvCacheKey = `${REGISTRY_SESSION_KV_PREFIX}${chainId}:${registryAddress.toLowerCase()}:${maxSessions}`;
  const cached = registrySessionCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.cachedAt < REGISTRY_SESSION_CACHE_TTL_MS) {
    return { ...cached.result, cached: true, cacheLayer: 'memory' };
  }
  if (!registryAddress) {
    return { ok: false, reason: 'session_registry_address_missing', sessions: [] };
  }
  if (!rpcUrls.length) {
    return { ok: false, reason: 'registry_rpc_url_missing', sessions: [] };
  }
  if (!forceRefresh && env?.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.get === 'function') {
    const kvCached = safeJsonParse(await env.AGENT_ACTION_KV.get(kvCacheKey), null);
    if (kvCached && Array.isArray(kvCached.sessions)) {
      registrySessionCache.set(cacheKey, { cachedAt: Date.now(), result: kvCached });
      return { ...kvCached, cached: true, cacheLayer: 'kv' };
    }
  }
  const countResult = await callWithRpcFallback({
    rpcUrls,
    registryAddress,
    data: SELECTORS.getSessionCount,
    fetchImpl,
    timeoutMs: rpcTimeoutMs(env),
  });
  if (!countResult.ok) {
    return { ok: false, reason: 'session_registry_count_failed', error: countResult.error, sessions: [] };
  }
  const count = Number(decodeUint256Word(countResult.result));
  const limit = Math.min(count, maxSessions);
  const startIndex = Math.max(0, count - limit);
  const sessions = [];
  for (let index = startIndex; index < count; index += 1) {
    const slugResult = await callWithRpcFallback({
      rpcUrls,
      registryAddress,
      data: buildGetSessionSlugByIndexData(index),
      fetchImpl,
      timeoutMs: rpcTimeoutMs(env),
    });
    if (!slugResult.ok) continue;
    const slug = safeString(decodeAbiString(slugResult.result));
    if (!SESSION_SLUG_RE.test(slug)) continue;
    sessions.push({
      sessionSlug: slug.toLowerCase(),
      sessionName: slug,
      default: sessions.length === 0,
      telegramBridgeEnabled: true,
      managedAccountSubmitAllowed: true,
      sponsoredAiAllowed: true,
      sponsoredRpcAllowed: true,
      sponsoredFaucetAllowed: true,
      sbtJoinModes: ['public'],
      docLibraryEnabled: true,
      source: 'session_registry',
      chainId,
    });
  }
  const result = {
    ok: sessions.length > 0,
    reason: sessions.length ? 'session_registry_loaded' : 'session_registry_empty',
    sessions,
    count,
    limit,
    startIndex,
    chainId,
    registryAddress,
    rpcFallbackCount: rpcUrls.length,
  };
  if (result.ok) {
    registrySessionCache.set(cacheKey, { cachedAt: Date.now(), result });
    if (env?.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.put === 'function') {
      await env.AGENT_ACTION_KV.put(kvCacheKey, JSON.stringify(result), {
        expirationTtl: Math.ceil(REGISTRY_SESSION_CACHE_TTL_MS / 1000),
      }).catch(() => null);
    }
  }
  return result;
}
