/*
 * @file rpcReadCache.js
 * @module rpcReadCache
 * @description RPC response caching layer — wraps ethers JsonRpcProvider.send() with
 *              in-flight dedup, short TTL caching for "latest" reads, and immutable caching for block-range queries.
 *
 * Key exports: wrapEthersJsonRpcSend
 */
// Wrap Ethers JsonRpcProvider `.send()` with:
// - in-flight dedupe for safe read methods
// - short TTL caching for "latest" reads (blockNumber, eth_call, getLogs)
// - immutable caching for numeric block ranges / blockTags
//
// Correctness notes:
// - Never caches write methods.
// - Cache keys include provider identity (chainId + providerKey + url) to avoid cross-provider weirdness.

import { utils as ethersUtils } from 'ethers';
import { rpcDebugReadProviderContext, rpcDebugRecord } from './rpcDebugStats.js';
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';

type LooseObject = { [key: string]: unknown };
type RpcParams = unknown[];
type RpcCacheMethod = 'eth_call' | 'eth_getLogs' | 'eth_blockNumber' | 'eth_chainId';
type ProviderSend = (methodIn: unknown, paramsIn: unknown) => Promise<any>;

interface RpcCacheEntry {
  expiresAt: number;
  value: any;
}

interface RpcCacheByMethod {
  [method: string]: Map<string, RpcCacheEntry>;
  eth_call: Map<string, RpcCacheEntry>;
  eth_getLogs: Map<string, RpcCacheEntry>;
  eth_blockNumber: Map<string, RpcCacheEntry>;
  eth_chainId: Map<string, RpcCacheEntry>;
}

interface RpcReadCacheState {
  v: number;
  inflight: Map<string, Promise<any>>;
  cacheByMethod: RpcCacheByMethod;
}

interface ProviderDebugContext extends LooseObject {
  fn?: unknown;
  fnTag?: unknown;
  fromBlock?: unknown;
  method?: unknown;
  rpcMethod?: unknown;
  scope?: unknown;
  scopeTag?: unknown;
  toBlock?: unknown;
}

interface ProviderSendMeta {
  chainId: number;
  providerKey: string;
  providerLabel: string;
  url: string;
}

interface WrappedProviderMeta extends LooseObject {
  chainId?: unknown;
  providerKey?: unknown;
  providerLabel?: unknown;
  url?: unknown;
}

interface WrappedProvider extends LooseObject {
  send: ProviderSend;
  __CE_RPC_DEBUG_CONTEXT__?: ProviderDebugContext | null;
  __CE_RPC_SEND_META?: ProviderSendMeta;
  __CE_RPC_SEND_WRAPPED__?: boolean;
}

interface RpcDebugTags {
  fnTag: string | null;
  scopeTag: string | null;
}

type RpcCacheGlobals = typeof globalThis & {
  __CE_RPC_READ_CACHE__?: RpcReadCacheState;
  CE_RPC_CACHE_DISABLED?: boolean;
  ENABLE_RPC_DEBUG_STATS?: boolean;
  ENABLE_RPC_DEBUG_TRACE?: boolean;
};

const log: any = createLogger('rpcReadCache');
let evictionIntervalStarted: boolean = false;
let evictionIntervalId: ReturnType<typeof setInterval> | null = null;

const createCacheByMethod = (): RpcCacheByMethod => ({
  eth_call: new Map<string, RpcCacheEntry>(),
  eth_getLogs: new Map<string, RpcCacheEntry>(),
  eth_blockNumber: new Map<string, RpcCacheEntry>(),
  eth_chainId: new Map<string, RpcCacheEntry>(),
});

const createGlobalCacheState = (): RpcReadCacheState => ({
  v: 1,
  inflight: new Map<string, Promise<any>>(),
  cacheByMethod: createCacheByMethod(),
});

const getGlobalObject = (): RpcCacheGlobals => (
  typeof globalThis !== 'undefined' ? (globalThis as RpcCacheGlobals) : ({} as RpcCacheGlobals)
);

const isObj = (val: unknown): val is LooseObject => !!val && typeof val === 'object' && !Array.isArray(val);
const normalizeDebugTag = (value: unknown): string | null => {
  const raw = toStr(value).trim().toLowerCase();
  return raw || null;
};
const normalizeDebugMethod = (value: unknown): string => {
  const raw = toStr(value).trim().toLowerCase();
  return raw || '';
};

const nowMs = (): number => Date.now();

const isCacheDisabled = (): boolean => {
  try {
    return getGlobalObject().CE_RPC_CACHE_DISABLED === true;
  } catch (_) {
    return false;
  }
};

const isDebugTraceEnabled = (): boolean => {
  try {
    return getGlobalObject().ENABLE_RPC_DEBUG_TRACE === true;
  } catch (_) {
    return false;
  }
};

const isRpcDebugEnabled = (): boolean => {
  try {
    return getGlobalObject().ENABLE_RPC_DEBUG_STATS === true;
  } catch (_) {
    return false;
  }
};

const safeStackSnippet = (): string => {
  if (!isDebugTraceEnabled()) return '';
  try {
    const stack = new Error().stack;
    if (!stack) return '';
    const lines = stack
      .split('\n')
      .map((line) => String(line || '').trim())
      .filter(Boolean);

    // Drop the leading "Error" line (browser/Node differ slightly).
    const frames = lines[0] && lines[0].toLowerCase().startsWith('error')
      ? lines.slice(1)
      : lines;

    // Heuristic: remove wrapper + ethers internals, then take the next few frames which are
    // more likely to include app callsites (when sourcemaps are available).
    const ignoreSubstrings = [
      'rpcreadcache.js',
      'rpcdebugstats.js',
      '@ethersproject',
      'ethers.js',
      'ethers.esm',
      'json-rpc-provider',
      'fallback-provider',
      'base-provider',
      'web3provider',
      'node_modules',
      'webpack-internal',
    ];
    const isIgnorable = (line: string): boolean => {
      const lower = String(line || '').toLowerCase();
      return ignoreSubstrings.some((s) => lower.includes(s));
    };

    let start = 0;
    while (start < frames.length && isIgnorable(frames[start])) start += 1;
    const picked = frames.slice(start, start + 8);
    if (picked.length) return picked.join('\n');

    // Fallback: return a few frames even if everything matched the ignore list.
    return frames.slice(0, 8).join('\n');
  } catch (_) {
    return '';
  }
};

const normalizeHexAddress = (value: unknown): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  if (raw.startsWith('0x') && raw.length === 42) return raw.toLowerCase();
  return raw;
};

const normalizeHex = (value: unknown): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  return raw.toLowerCase();
};

const normalizeLogsAddress = (value: unknown): string | string[] => {
  if (!Array.isArray(value)) return normalizeHexAddress(value);
  const normalized = value
    .map(normalizeHexAddress)
    .filter(Boolean)
    .sort();
  if (normalized.length === 0) return '';
  if (normalized.length === 1) return normalized[0];
  return normalized;
};

const normalizeBlockTag = (value: unknown): string => {
  if (value == null) return 'latest';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `0x${Math.max(0, Math.floor(value)).toString(16)}`;
  }
  const raw = toStr(value).trim();
  if (!raw) return 'latest';
  return raw.toLowerCase();
};

const matchesProviderDebugContext = (contextIn: unknown, methodIn: unknown, paramsIn: unknown): boolean => {
  if (!isObj(contextIn)) return true;
  const context = contextIn as ProviderDebugContext;
  const method = normalizeDebugMethod(methodIn);
  const params: RpcParams = Array.isArray(paramsIn) ? paramsIn : [];
  const contextMethod = normalizeDebugMethod(context.method || context.rpcMethod || '');
  if (contextMethod && contextMethod !== method) return false;

  const hasFrom = Object.prototype.hasOwnProperty.call(context, 'fromBlock');
  const hasTo = Object.prototype.hasOwnProperty.call(context, 'toBlock');
  if (!hasFrom && !hasTo) return true;
  if (method !== 'eth_getlogs') return false;

  const filter: LooseObject = isObj(params[0]) ? params[0] : {};
  if (hasFrom) {
    const ctxFrom = normalizeBlockTag(context.fromBlock);
    const reqFrom = normalizeBlockTag(filter.fromBlock);
    if (ctxFrom !== reqFrom) return false;
  }
  if (hasTo) {
    const ctxTo = normalizeBlockTag(context.toBlock);
    const reqTo = normalizeBlockTag(filter.toBlock);
    if (ctxTo !== reqTo) return false;
  }
  return true;
};

const isNumericHex = (value: unknown): boolean => {
  const raw = toStr(value).trim().toLowerCase();
  return /^0x[0-9a-f]+$/.test(raw) && raw !== '0x';
};

const stableKeyStringify = (value: unknown): string => {
  const seen = new Set<object>();
  const walk = (v: unknown): unknown => {
    if (v == null) return v;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'bigint') return `bigint:${v.toString()}`;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      const record = v as LooseObject;
      const out: LooseObject = {};
      Object.keys(record).sort().forEach((k) => {
        out[k] = walk(record[k]);
      });
      return out;
    }
    return toStr(v);
  };
  try {
    return JSON.stringify(walk(value));
  } catch (_) {
    try {
      return JSON.stringify(value);
    } catch {
      return toStr(value);
    }
  }
};

const buildMethodKeyPart = (methodIn: unknown, paramsIn: unknown): string => {
  const method = toStr(methodIn).trim() || 'unknown';
  const params: RpcParams = Array.isArray(paramsIn) ? paramsIn : [];

  if (method === 'eth_blockNumber') return 'bn';
  if (method === 'eth_chainId') return 'chainId';

  if (method === 'eth_call') {
    const tx: LooseObject = isObj(params[0]) ? params[0] : {};
    const blockTag = normalizeBlockTag(params[1]);
    const normTx = {
      to: normalizeHexAddress(tx.to),
      from: normalizeHexAddress(tx.from),
      data: normalizeHex(tx.data),
      value: normalizeHex(tx.value),
      gas: normalizeHex(tx.gas),
      gasPrice: normalizeHex(tx.gasPrice),
      maxFeePerGas: normalizeHex(tx.maxFeePerGas),
      maxPriorityFeePerGas: normalizeHex(tx.maxPriorityFeePerGas),
      nonce: normalizeHex(tx.nonce),
      type: normalizeHex(tx.type),
    };
    return `call:${stableKeyStringify(normTx)}:${blockTag}`;
  }

  if (method === 'eth_getLogs') {
    const filter: LooseObject = isObj(params[0]) ? params[0] : {};
    const addressNorm = normalizeLogsAddress(filter.address);
    const topics = Array.isArray(filter.topics) ? filter.topics : [];
    const topicsNorm = stableKeyStringify(
      topics.map((t) => (Array.isArray(t) ? t.map(normalizeHex) : normalizeHex(t)))
    );
    const fromBlock = normalizeBlockTag(filter.fromBlock);
    const toBlock = normalizeBlockTag(filter.toBlock);
    const blockHash = normalizeHex(filter.blockHash);
    return `logs:${stableKeyStringify({ address: addressNorm, topics: topicsNorm, fromBlock, toBlock, blockHash })}`;
  }

  if (method === 'eth_getTransactionReceipt' || method === 'eth_getTransactionByHash') {
    const hash = normalizeHex(params[0]);
    return `${method}:${hash}`;
  }

  if (method === 'eth_getBalance') {
    const addr = normalizeHexAddress(params[0]);
    const blockTag = normalizeBlockTag(params[1]);
    return `bal:${addr}:${blockTag}`;
  }

  // Default: stable stringify params (can be large; only used for allowlisted dedupe methods).
  return `${method}:${stableKeyStringify(params)}`;
};

const resolveTtlMs = (methodIn: unknown, paramsIn: unknown): number => {
  const method = toStr(methodIn).trim();
  const params: RpcParams = Array.isArray(paramsIn) ? paramsIn : [];

  if (method === 'eth_chainId') return 60 * 60 * 1000;
  if (method === 'eth_blockNumber') return 2000;

  if (method === 'eth_call') {
    const blockTag = normalizeBlockTag(params[1]);
    if (blockTag === 'latest' || blockTag === 'pending') return 2000;
    if (isNumericHex(blockTag)) return 10 * 60 * 1000;
    return 2000;
  }

  if (method === 'eth_getLogs') {
    const filter: LooseObject = isObj(params[0]) ? params[0] : {};
    const fromBlock = normalizeBlockTag(filter.fromBlock);
    const toBlock = normalizeBlockTag(filter.toBlock);
    const isLatest =
      fromBlock === 'latest' ||
      fromBlock === 'pending' ||
      toBlock === 'latest' ||
      toBlock === 'pending';
    if (isLatest) return 2000;
    // Treat numeric ranges as immutable (hash includes range).
    if ((isNumericHex(fromBlock) || fromBlock === 'earliest') && isNumericHex(toBlock)) return 10 * 60 * 1000;
    return 2000;
  }

  return 0;
};

const DEDUPE_METHODS: ReadonlySet<string> = new Set([
  'eth_call',
  'eth_getLogs',
  'eth_getBlockByNumber',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_chainId',
]);

const TTL_METHODS: ReadonlySet<string> = new Set([
  'eth_call',
  'eth_getLogs',
  'eth_blockNumber',
  'eth_chainId',
]);

const METHOD_CACHE_LIMITS: Readonly<Record<RpcCacheMethod, number>> = Object.freeze({
  eth_call: 800,
  eth_getLogs: 250,
  eth_blockNumber: 50,
  eth_chainId: 50,
});

const getGlobalCache = (): RpcReadCacheState => {
  const g = getGlobalObject();
  if (!g.__CE_RPC_READ_CACHE__ || typeof g.__CE_RPC_READ_CACHE__ !== 'object') {
    g.__CE_RPC_READ_CACHE__ = createGlobalCacheState();
  }
  return g.__CE_RPC_READ_CACHE__;
};

export const evictExpiredEntries = (): number => {
  try {
    const globalCache = getGlobalCache();
    const cacheByMethod = globalCache?.cacheByMethod;
    if (!cacheByMethod || typeof cacheByMethod !== 'object') return 0;

    const now = nowMs();
    let evictedCount = 0;

    Object.keys(cacheByMethod).forEach((method) => {
      const methodMap = cacheByMethod[method];
      if (!(methodMap instanceof Map)) return;

      for (const [key, entry] of methodMap.entries()) {
        if (Number(entry?.expiresAt) < now) {
          methodMap.delete(key);
          evictedCount += 1;
        }
      }
    });

    if (evictedCount > 0) {
      log.log(`rpcReadCache: evicted ${evictedCount} expired entr${evictedCount === 1 ? 'y' : 'ies'}`);
    }

    return evictedCount;
  } catch (e) {
    log.warn('rpcReadCache: evictExpiredEntries failed', e);
    return 0;
  }
};

const startEvictionInterval = (): void => {
  if (evictionIntervalStarted) return;
  try {
    evictionIntervalId = setInterval(evictExpiredEntries, 60_000);
    evictionIntervalStarted = true;
  } catch (e) {
    log.warn('rpcReadCache: failed to start eviction interval', e);
  }
};

const cacheLruGet = <T>(map: Map<string, T> | null | undefined, key: string): T | null => {
  if (!map || !map.has(key)) return null;
  const value = map.get(key) as T;
  map.delete(key);
  map.set(key, value);
  return value;
};

const cacheLruSet = <T>(map: Map<string, T> | null | undefined, key: string, entry: T, maxSize: number): void => {
  if (!map) return;
  if (map.has(key)) map.delete(key);
  map.set(key, entry);
  const limit = Number(maxSize || 0);
  if (limit > 0) {
    while (map.size > limit) {
      const oldest = map.keys().next();
      if (oldest.done) break;
      map.delete(oldest.value);
    }
  }
};

const getCacheMapForMethod = (method: unknown): Map<string, RpcCacheEntry> | null => {
  const g = getGlobalCache();
  const m = toStr(method).trim();
  if (!m) return null;
  if (!g.cacheByMethod[m]) g.cacheByMethod[m] = new Map<string, RpcCacheEntry>();
  return g.cacheByMethod[m];
};

export const wrapEthersJsonRpcSend = <T extends WrappedProvider | null | undefined>(
  provider: T,
  meta: WrappedProviderMeta = {},
): T => {
  if (!provider || typeof provider.send !== 'function') return provider;
  startEvictionInterval();
  if (provider.__CE_RPC_SEND_WRAPPED__ === true) return provider;

  const chainId = Number(meta.chainId || 0) || 0;
  const providerKey = toStr(meta.providerKey || '').trim();
  const url = toStr(meta.url || '').trim();
  const providerLabel = toStr(meta.providerLabel || '').trim();

  const providerInstanceId = (() => {
    try {
      return ethersUtils.id(`${chainId}|${providerKey}|${url}`);
    } catch (_) {
      return `${chainId}|${providerKey}|${url}`;
    }
  })();

  const readProviderRpcDebugContext = (method: string, params: RpcParams): RpcDebugTags => {
    try {
      const mapped: any = rpcDebugReadProviderContext(provider);
      if (mapped && typeof mapped === 'object' && matchesProviderDebugContext(mapped, method, params)) {
        return {
          fnTag: normalizeDebugTag(mapped.fnTag || mapped.fn || ''),
          scopeTag: normalizeDebugTag(mapped.scopeTag || mapped.scope || ''),
        };
      }
      const raw = provider && typeof provider === 'object' ? provider.__CE_RPC_DEBUG_CONTEXT__ : null;
      if (!raw || typeof raw !== 'object' || !matchesProviderDebugContext(raw, method, params)) {
        return { fnTag: null, scopeTag: null };
      }
      return {
        fnTag: normalizeDebugTag(raw.fnTag || raw.fn || ''),
        scopeTag: normalizeDebugTag(raw.scopeTag || raw.scope || ''),
      };
    } catch (_) {
      return { fnTag: null, scopeTag: null };
    }
  };

  const originalSend: ProviderSend = provider.send.bind(provider) as ProviderSend;
  try {
    Object.defineProperty(provider, '__CE_RPC_SEND_WRAPPED__', { value: true, enumerable: false });
  } catch (_) {
    // best effort
    provider.__CE_RPC_SEND_WRAPPED__ = true;
  }

  provider.send = async (methodIn: unknown, paramsIn: unknown): Promise<any> => {
    const method = toStr(methodIn).trim() || 'unknown';
    const params: RpcParams = Array.isArray(paramsIn) ? paramsIn : [];

    const wantsDedupe = DEDUPE_METHODS.has(method);
    const wantsTtl = TTL_METHODS.has(method);
    const debugOnly = false;

    // Fast path: if this method is not a target for dedupe/TTL caching, do nothing.
    if (!wantsDedupe && !wantsTtl && !debugOnly) {
      return await originalSend(methodIn, paramsIn);
    }

    const cacheOff = isCacheDisabled();
    const ttlMs = (!cacheOff && wantsTtl) ? resolveTtlMs(method, params) : 0;
    const shouldDedupe = (!cacheOff && wantsDedupe);
    const isDebug = isRpcDebugEnabled();

    const keyPart = buildMethodKeyPart(method, params);
    const keySeed = `${providerInstanceId}|${keyPart}`;
    const keyHash = (() => {
      try {
        return ethersUtils.id(keySeed);
      } catch (_) {
        return keySeed;
      }
    })();

    const stackSnippet = isDebug ? safeStackSnippet() : '';
    const debugContext = isDebug
      ? readProviderRpcDebugContext(method, params)
      : { fnTag: null, scopeTag: null };
    const t0 = nowMs();

    if (ttlMs > 0) {
      const cacheMap = getCacheMapForMethod(method);
      const cached = cacheMap ? cacheLruGet(cacheMap, keyHash) : null;
      if (cached && typeof cached === 'object' && Number(cached.expiresAt || 0) > nowMs()) {
        if (isDebug) {
          rpcDebugRecord({
            chainId,
            providerKey,
            url,
            method,
            params,
            fnTag: debugContext.fnTag,
            scopeTag: debugContext.scopeTag,
            outcome: 'cache_hit',
            ms: nowMs() - t0,
            stackSnippet,
            keyHash,
          });
        }
        return cached.value;
      }
    }

    const globalCache = getGlobalCache();
    if (shouldDedupe) {
      const inflight = globalCache.inflight.get(keyHash);
      if (inflight) {
        if (isDebug) {
          rpcDebugRecord({
            chainId,
            providerKey,
            url,
            method,
            params,
            fnTag: debugContext.fnTag,
            scopeTag: debugContext.scopeTag,
            outcome: 'inflight_hit',
            ms: nowMs() - t0,
            stackSnippet,
            keyHash,
          });
        }
        return await inflight;
      }
    }

    const run: Promise<any> = (async (): Promise<any> => {
      return await originalSend(methodIn, paramsIn);
    })();

    if (shouldDedupe) globalCache.inflight.set(keyHash, run);

    try {
      const result = await run;
      const elapsed = nowMs() - t0;
      if (ttlMs > 0) {
        const cacheMap = getCacheMapForMethod(method);
        const limit = METHOD_CACHE_LIMITS[method as RpcCacheMethod] || 0;
        if (cacheMap) {
          cacheLruSet(cacheMap, keyHash, { value: result, expiresAt: nowMs() + ttlMs }, limit);
        }
      }
      if (isDebug) {
        rpcDebugRecord({
          chainId,
          providerKey,
          url,
          method,
          params,
          fnTag: debugContext.fnTag,
          scopeTag: debugContext.scopeTag,
          outcome: 'network',
          ms: elapsed,
          stackSnippet,
          keyHash,
        });
      }
      return result;
    } catch (err) {
      if (isDebug) {
        rpcDebugRecord({
          chainId,
          providerKey,
          url,
          method,
          params,
          fnTag: debugContext.fnTag,
          scopeTag: debugContext.scopeTag,
          outcome: 'error',
          ms: nowMs() - t0,
          stackSnippet,
          keyHash,
        });
      }
      throw err;
    } finally {
      if (shouldDedupe && globalCache.inflight.get(keyHash) === run) {
        globalCache.inflight.delete(keyHash);
      }
    }
  };

  // Small hint to make debugging easier (non-enumerable).
  try {
    Object.defineProperty(provider, '__CE_RPC_SEND_META', {
      value: { chainId, providerKey, providerLabel, url },
      enumerable: false,
    });
  } catch (e) { log.warn('rpcReadCache: fallback', e); }

  return provider;
};

export const __test__resetRpcReadCache = (): void => {
  const g = getGlobalObject();
  if (g.__CE_RPC_READ_CACHE__ && typeof g.__CE_RPC_READ_CACHE__ === 'object') {
    try {
      g.__CE_RPC_READ_CACHE__.inflight = new Map<string, Promise<any>>();
      g.__CE_RPC_READ_CACHE__.cacheByMethod = createCacheByMethod();
    } catch (e) { log.warn('rpcReadCache: fallback', e); }
  }
  if (evictionIntervalId != null) {
    clearInterval(evictionIntervalId);
    evictionIntervalId = null;
    evictionIntervalStarted = false;
  }
};
