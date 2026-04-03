/**
 * @file rpcDebugStats.js
 * @module rpcDebugStats
 * @description Lightweight, opt-in RPC and perf counters for debugging.
 *              Enabled by window.ENABLE_RPC_DEBUG_STATS. Tracks provider context, call counts, and timing.
 *
 * Key exports: rpcDebugRecord, rpcDebugSnapshot, rpcDebugScanSummary, perfDebugDecryptEnvelope, perfDebugLitGetKey
 */
// Lightweight, opt-in RPC + perf counters. Enabled only when
// `window.ENABLE_RPC_DEBUG_STATS === true` (or `globalThis.ENABLE_RPC_DEBUG_STATS`).
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';

const log = createLogger('rpcDebugStats');


const MAX_RECENT_DEFAULT = 200;
const MAX_KEYS_DEFAULT = 500;
const toLower = (val) => toStr(val).trim().toLowerCase();
const normalizeTag = (val) => {
  const raw = toStr(val).trim();
  return raw ? raw.toLowerCase() : '';
};
const normalizeMethodTag = (val) => {
  const raw = toStr(val).trim().toLowerCase();
  return raw || '';
};
const normalizeBlockTagForContext = (raw) => {
  const parsed = parseBlockTagToScalar(raw);
  if (parsed == null) return null;
  if (typeof parsed === 'number' && Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  const asStr = toStr(parsed).trim().toLowerCase();
  return asStr || null;
};

const parseBlockTagToScalar = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  const s = toLower(raw);
  if (!s) return null;
  if (/^0x[0-9a-f]+$/.test(s)) {
    const parsed = Number.parseInt(s, 16);
    return Number.isFinite(parsed) ? parsed : s;
  }
  if (/^[0-9]+$/.test(s)) {
    const parsed = Number.parseInt(s, 10);
    return Number.isFinite(parsed) ? parsed : s;
  }
  return s;
};

const normalizeAddressField = (raw) => {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => toLower(item))
      .filter(Boolean)
      .sort();
  }
  const one = toLower(raw);
  return one || null;
};

const normalizeTopicsField = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((topic) => {
    if (Array.isArray(topic)) {
      return topic.map((sub) => toLower(sub)).filter(Boolean);
    }
    return toLower(topic);
  });
};

const extractMethodDetails = (methodIn, paramsIn) => {
  const method = toStr(methodIn).trim();
  const params = Array.isArray(paramsIn) ? paramsIn : [];

  if (method === 'eth_getLogs') {
    const filter = params[0] && typeof params[0] === 'object' ? params[0] : {};
    const topics = normalizeTopicsField(filter.topics);
    return {
      type: 'eth_getLogs',
      fromBlockRaw: filter.fromBlock == null ? null : toStr(filter.fromBlock),
      toBlockRaw: filter.toBlock == null ? null : toStr(filter.toBlock),
      fromBlock: parseBlockTagToScalar(filter.fromBlock),
      toBlock: parseBlockTagToScalar(filter.toBlock),
      blockHash: toLower(filter.blockHash) || null,
      address: normalizeAddressField(filter.address),
      topics0: Array.isArray(topics) && topics.length ? topics[0] : null,
      topicsCount: topics.length,
    };
  }

  if (method === 'eth_call') {
    const tx = params[0] && typeof params[0] === 'object' ? params[0] : {};
    return {
      type: 'eth_call',
      to: toLower(tx.to) || null,
      from: toLower(tx.from) || null,
      blockTagRaw: params[1] == null ? null : toStr(params[1]),
      blockTag: parseBlockTagToScalar(params[1]),
    };
  }

  if (method === 'eth_blockNumber') {
    return { type: 'eth_blockNumber' };
  }

  return null;
};

const isRpcDebugEnabled = () => {
  try {
    return typeof globalThis !== 'undefined' && globalThis.ENABLE_RPC_DEBUG_STATS === true;
  } catch (_) {
    return false;
  }
};

const isRpcTraceEnabled = () => {
  try {
    return typeof globalThis !== 'undefined' && globalThis.ENABLE_RPC_DEBUG_TRACE === true;
  } catch (_) {
    return false;
  }
};

const truncate = (str, max = 800) => {
  const s = toStr(str);
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…(${s.length})`;
};

const getGlobalState = () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  if (!g.__CE_RPC_DEBUG_STATE__ || typeof g.__CE_RPC_DEBUG_STATE__ !== 'object') {
    g.__CE_RPC_DEBUG_STATE__ = {
      v: 1,
      recentMax: MAX_RECENT_DEFAULT,
      keysMax: MAX_KEYS_DEFAULT,
      countsByMethod: {},
      countsByMethodOutcome: {}, // method -> { network, cache_hit, inflight_hit, error }
      countsByTaggedMethodOutcome: {}, // `${method}|${fnTag}|${scopeTag}` -> { method, fnTag, scopeTag, outcomes... }
      countsByChainTaggedMethodOutcome: {}, // `${chainId}|${method}|${fnTag}|${scopeTag}` -> { chainId, method, fnTag, scopeTag, outcomes... }
      countsByChain: {}, // chainId -> { method -> count }
      countsByChainOutcome: {}, // chainId -> { method -> { network, cache_hit, inflight_hit, error } }
      outcomes: { network: 0, cache_hit: 0, inflight_hit: 0, error: 0 },
      cacheHits: 0,
      inflightHits: 0,
      recent: [],
      keys: new Map(), // keyHash -> { count, method, chainId, providerKey, url, paramsSummary, stackSnippet }
      perf: {
        decryptEnvelope: { attempts: 0, cacheHits: 0, inflightHits: 0, errors: 0 },
        litGetKey: { attempts: 0, cacheHits: 0, inflightHits: 0, negCacheHits: 0, errors: 0 },
      },
    };
  }
  return g.__CE_RPC_DEBUG_STATE__;
};

const getProviderContextStore = () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  if (!g.__CE_RPC_DEBUG_PROVIDER_CONTEXT_STACKS__ || typeof g.__CE_RPC_DEBUG_PROVIDER_CONTEXT_STACKS__ !== 'object') {
    g.__CE_RPC_DEBUG_PROVIDER_CONTEXT_STACKS__ = new WeakMap();
  }
  return g.__CE_RPC_DEBUG_PROVIDER_CONTEXT_STACKS__;
};

const nextProviderContextToken = () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  const current = Number(g.__CE_RPC_DEBUG_PROVIDER_CONTEXT_TOKEN_SEQ__ || 0);
  const next = Number.isFinite(current) ? (current + 1) : 1;
  g.__CE_RPC_DEBUG_PROVIDER_CONTEXT_TOKEN_SEQ__ = next;
  return next;
};

const normalizeProviderDebugContext = (contextIn) => {
  if (!contextIn || typeof contextIn !== 'object') return null;
  const fnTag = normalizeTag(contextIn.fnTag || contextIn.fn || '');
  const scopeTag = normalizeTag(contextIn.scopeTag || contextIn.scope || '');
  const method = normalizeMethodTag(contextIn.method || contextIn.rpcMethod || '');
  const fromBlock = normalizeBlockTagForContext(contextIn.fromBlock);
  const toBlock = normalizeBlockTagForContext(contextIn.toBlock);
  if (!fnTag && !scopeTag) return null;
  return {
    ...(fnTag ? { fnTag } : {}),
    ...(scopeTag ? { scopeTag } : {}),
    ...(method ? { method } : {}),
    ...(fromBlock != null ? { fromBlock } : {}),
    ...(toBlock != null ? { toBlock } : {}),
  };
};

const normalizeProviderContextStack = (rawStack) => {
  if (!Array.isArray(rawStack)) return [];
  return rawStack.filter((entry) => entry && typeof entry === 'object');
};

const readProviderContextFromEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.context && typeof entry.context === 'object') return entry.context;
  return entry;
};

export const rpcDebugPushProviderContextWithToken = (provider, contextIn) => {
  if (!provider || (typeof provider !== 'object' && typeof provider !== 'function')) return null;
  const context = normalizeProviderDebugContext(contextIn);
  if (!context) return null;
  try {
    const store = getProviderContextStore();
    const current = normalizeProviderContextStack(store.get(provider));
    const token = nextProviderContextToken();
    current.push({ token, context });
    store.set(provider, current);
    return token;
  } catch (_) {
    return null;
  }
};

export const rpcDebugPushProviderContext = (provider, contextIn) => {
  return rpcDebugPushProviderContextWithToken(provider, contextIn) != null;
};

export const rpcDebugPopProviderContext = (provider, token = null) => {
  if (!provider || (typeof provider !== 'object' && typeof provider !== 'function')) return;
  try {
    const store = getProviderContextStore();
    const current = normalizeProviderContextStack(store.get(provider));
    if (!Array.isArray(current) || current.length === 0) return;
    if (token == null) {
      current.pop();
    } else {
      let idx = -1;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        const entry = current[i];
        if (!entry || typeof entry !== 'object') continue;
        if (entry.token === token) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return;
      current.splice(idx, 1);
    }
    if (current.length > 0) store.set(provider, current);
    else store.delete(provider);
  } catch (e) { log.warn('rpcDebugStats: fallback', e); }
};

export const rpcDebugReadProviderContext = (provider) => {
  if (!provider || (typeof provider !== 'object' && typeof provider !== 'function')) return null;
  try {
    const store = getProviderContextStore();
    const stack = normalizeProviderContextStack(store.get(provider));
    if (!Array.isArray(stack) || !stack.length) return null;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const top = readProviderContextFromEntry(stack[i]);
      if (top && typeof top === 'object') return top;
    }
    return null;
  } catch (_) {
    return null;
  }
};

const touchLru = (map, key, value) => {
  try {
    map.delete(key);
    map.set(key, value);
  } catch (e) { log.warn('rpcDebugStats: fallback', e); }
};

export const rpcDebugReset = (opts = {}) => {
  const st = getGlobalState();
  st.recentMax = Number(opts.recentMax || st.recentMax || MAX_RECENT_DEFAULT) || MAX_RECENT_DEFAULT;
  st.keysMax = Number(opts.keysMax || st.keysMax || MAX_KEYS_DEFAULT) || MAX_KEYS_DEFAULT;
  st.countsByMethod = {};
  st.countsByMethodOutcome = {};
  st.countsByTaggedMethodOutcome = {};
  st.countsByChainTaggedMethodOutcome = {};
  st.countsByChain = {};
  st.countsByChainOutcome = {};
  st.outcomes = { network: 0, cache_hit: 0, inflight_hit: 0, error: 0 };
  st.cacheHits = 0;
  st.inflightHits = 0;
  st.recent = [];
  st.keys = new Map();
  st.perf = {
    decryptEnvelope: { attempts: 0, cacheHits: 0, inflightHits: 0, errors: 0 },
    litGetKey: { attempts: 0, cacheHits: 0, inflightHits: 0, negCacheHits: 0, errors: 0 },
  };
  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.__CE_RPC_DEBUG_PROVIDER_CONTEXT_STACKS__ = new WeakMap();
      globalThis.__CE_RPC_DEBUG_PROVIDER_CONTEXT_TOKEN_SEQ__ = 0;
    }
  } catch (e) { log.warn('rpcDebugStats: fallback', e); }
};

export const rpcDebugRecord = ({
  chainId,
  providerKey,
  url,
  method,
  params,
  outcome,
  fnTag,
  scopeTag,
  ms,
  stackSnippet,
  keyHash,
} = {}) => {
  if (!isRpcDebugEnabled()) return;

  const st = getGlobalState();
  const m = toStr(method || 'unknown') || 'unknown';
  const chainKey = toStr(chainId ?? '') || '';
  const oc = toStr(outcome || 'network') || 'network';
  const normalizedFnTag = normalizeTag(fnTag);
  const normalizedScopeTag = normalizeTag(scopeTag);

  st.countsByMethod[m] = (st.countsByMethod[m] || 0) + 1;
  if (!st.countsByMethodOutcome[m] || typeof st.countsByMethodOutcome[m] !== 'object') {
    st.countsByMethodOutcome[m] = { network: 0, cache_hit: 0, inflight_hit: 0, error: 0 };
  }
  if (Object.prototype.hasOwnProperty.call(st.countsByMethodOutcome[m], oc)) {
    st.countsByMethodOutcome[m][oc] += 1;
  }
  if (chainKey) {
    const chainSlot = st.countsByChain[chainKey] || (st.countsByChain[chainKey] = {});
    chainSlot[m] = (chainSlot[m] || 0) + 1;
    const chainOutcomeSlot = st.countsByChainOutcome[chainKey] || (st.countsByChainOutcome[chainKey] = {});
    if (!chainOutcomeSlot[m] || typeof chainOutcomeSlot[m] !== 'object') {
      chainOutcomeSlot[m] = { network: 0, cache_hit: 0, inflight_hit: 0, error: 0 };
    }
    if (Object.prototype.hasOwnProperty.call(chainOutcomeSlot[m], oc)) {
      chainOutcomeSlot[m][oc] += 1;
    }
  }

  if (Object.prototype.hasOwnProperty.call(st.outcomes, oc)) {
    st.outcomes[oc] += 1;
  }
  if (oc === 'cache_hit') st.cacheHits += 1;
  if (oc === 'inflight_hit') st.inflightHits += 1;

  const taggedKey = `${m}|${normalizedFnTag}|${normalizedScopeTag}`;
  if (!st.countsByTaggedMethodOutcome[taggedKey] || typeof st.countsByTaggedMethodOutcome[taggedKey] !== 'object') {
    st.countsByTaggedMethodOutcome[taggedKey] = {
      method: m,
      fnTag: normalizedFnTag || null,
      scopeTag: normalizedScopeTag || null,
      network: 0,
      cache_hit: 0,
      inflight_hit: 0,
      error: 0,
    };
  }
  if (Object.prototype.hasOwnProperty.call(st.countsByTaggedMethodOutcome[taggedKey], oc)) {
    st.countsByTaggedMethodOutcome[taggedKey][oc] += 1;
  }
  if (chainKey) {
    const chainTaggedKey = `${chainKey}|${m}|${normalizedFnTag}|${normalizedScopeTag}`;
    if (
      !st.countsByChainTaggedMethodOutcome[chainTaggedKey] ||
      typeof st.countsByChainTaggedMethodOutcome[chainTaggedKey] !== 'object'
    ) {
      st.countsByChainTaggedMethodOutcome[chainTaggedKey] = {
        chainId: chainKey,
        method: m,
        fnTag: normalizedFnTag || null,
        scopeTag: normalizedScopeTag || null,
        network: 0,
        cache_hit: 0,
        inflight_hit: 0,
        error: 0,
      };
    }
    if (Object.prototype.hasOwnProperty.call(st.countsByChainTaggedMethodOutcome[chainTaggedKey], oc)) {
      st.countsByChainTaggedMethodOutcome[chainTaggedKey][oc] += 1;
    }
  }

  const entry = {
    ts: Date.now(),
    method: m,
    chainId: chainKey || null,
    outcome: oc,
    ms: typeof ms === 'number' && Number.isFinite(ms) ? ms : null,
    providerKey: providerKey ? toStr(providerKey) : null,
    url: url ? toStr(url) : null,
    keyHash: keyHash ? toStr(keyHash) : null,
  };
  if (normalizedFnTag) entry.fnTag = normalizedFnTag;
  if (normalizedScopeTag) entry.scopeTag = normalizedScopeTag;
  const methodDetails = extractMethodDetails(m, params);
  if (methodDetails) entry.rpc = methodDetails;
  if (params !== undefined) {
    try {
      entry.paramsSummary = truncate(JSON.stringify(params), 900);
    } catch (_) {
      entry.paramsSummary = truncate(String(params), 900);
    }
  }
  if (stackSnippet) entry.stack = truncate(stackSnippet, 1600);
  st.recent.push(entry);
  while (st.recent.length > st.recentMax) st.recent.shift();

  const kh = toStr(keyHash || '').trim();
  if (kh) {
    const cur = st.keys.get(kh);
    if (cur) {
      cur.count += 1;
      touchLru(st.keys, kh, cur);
    } else {
      const paramsSummary = entry.paramsSummary || '';
      const stack = entry.stack || '';
      st.keys.set(kh, {
        keyHash: kh,
        count: 1,
        method: m,
        chainId: chainKey || null,
        providerKey: providerKey ? toStr(providerKey) : null,
        url: url ? toStr(url) : null,
        paramsSummary,
        stackSnippet: stack,
      });
      while (st.keys.size > st.keysMax) {
        const oldest = st.keys.keys().next().value;
        if (!oldest) break;
        st.keys.delete(oldest);
      }
    }
  }
};

const normalizeFilterValues = (raw, normalizer = normalizeTag) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const seen = new Set();
  const out = [];
  arr.forEach((item) => {
    const normalized = normalizer(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const normalizeSummaryFilter = (filterIn) => {
  if (!filterIn || typeof filterIn !== 'object') return null;
  const methods = normalizeFilterValues(
    Object.prototype.hasOwnProperty.call(filterIn, 'methods') ? filterIn.methods : filterIn.method
  );
  const outcomes = normalizeFilterValues(
    Object.prototype.hasOwnProperty.call(filterIn, 'outcomes') ? filterIn.outcomes : filterIn.outcome
  );
  const fnTags = normalizeFilterValues(
    Object.prototype.hasOwnProperty.call(filterIn, 'fnTags') ? filterIn.fnTags : filterIn.fnTag
  );
  const scopeTags = normalizeFilterValues(
    Object.prototype.hasOwnProperty.call(filterIn, 'scopeTags') ? filterIn.scopeTags : filterIn.scopeTag
  );
  const chainIds = normalizeFilterValues(
    Object.prototype.hasOwnProperty.call(filterIn, 'chainIds') ? filterIn.chainIds : filterIn.chainId,
    (value) => toStr(value).trim()
  );
  const out = {};
  if (methods.length) out.methods = methods;
  if (outcomes.length) out.outcomes = outcomes;
  if (fnTags.length) out.fnTags = fnTags;
  if (scopeTags.length) out.scopeTags = scopeTags;
  if (chainIds.length) out.chainIds = chainIds;
  return Object.keys(out).length ? out : null;
};

const entryMatchesSummaryFilter = (entry, filterIn) => {
  const filter = normalizeSummaryFilter(filterIn);
  if (!filter) return true;
  if (!entry || typeof entry !== 'object') return false;

  if (filter.methods && filter.methods.length) {
    const method = normalizeTag(entry.method);
    if (!filter.methods.includes(method)) return false;
  }
  if (filter.outcomes && filter.outcomes.length) {
    const outcome = normalizeTag(entry.outcome);
    if (!filter.outcomes.includes(outcome)) return false;
  }
  if (filter.fnTags && filter.fnTags.length) {
    const fnTag = normalizeTag(entry.fnTag || '');
    if (!filter.fnTags.includes(fnTag)) return false;
  }
  if (filter.scopeTags && filter.scopeTags.length) {
    const scopeTag = normalizeTag(entry.scopeTag || '');
    if (!filter.scopeTags.includes(scopeTag)) return false;
  }
  if (filter.chainIds && filter.chainIds.length) {
    const chainId = toStr(entry.chainId ?? '').trim();
    if (!filter.chainIds.includes(chainId)) return false;
  }
  return true;
};

const createOutcomeCounter = () => ({
  total: 0,
  network: 0,
  cache_hit: 0,
  inflight_hit: 0,
  error: 0,
});

const addOutcomeCounts = (target, source) => {
  const out = target;
  out.network += Number(source?.network || 0);
  out.cache_hit += Number(source?.cache_hit || 0);
  out.inflight_hit += Number(source?.inflight_hit || 0);
  out.error += Number(source?.error || 0);
  out.total = out.network + out.cache_hit + out.inflight_hit + out.error;
  return out;
};

const buildFilteredMethodOutcomes = (st, filterIn) => {
  const filter = normalizeSummaryFilter(filterIn);
  const totals = createOutcomeCounter();
  const byMethod = {};
  if (!filter) return { totals, byMethod };
  const hasChainFilter = !!(filter.chainIds && filter.chainIds.length);
  const tagged = (() => {
    if (hasChainFilter) {
      return st?.countsByChainTaggedMethodOutcome && typeof st.countsByChainTaggedMethodOutcome === 'object'
        ? st.countsByChainTaggedMethodOutcome
        : {};
    }
    return st?.countsByTaggedMethodOutcome && typeof st.countsByTaggedMethodOutcome === 'object'
      ? st.countsByTaggedMethodOutcome
      : {};
  })();
  Object.values(tagged).forEach((slotRaw) => {
    const slot = slotRaw && typeof slotRaw === 'object' ? slotRaw : null;
    if (!slot) return;
    const pseudoEntry = {
      method: slot.method,
      outcome: null,
      fnTag: slot.fnTag || null,
      scopeTag: slot.scopeTag || null,
    };
    if (filter.methods && filter.methods.length) {
      const method = normalizeTag(pseudoEntry.method);
      if (!filter.methods.includes(method)) return;
    }
    if (filter.fnTags && filter.fnTags.length) {
      const fnTag = normalizeTag(pseudoEntry.fnTag || '');
      if (!filter.fnTags.includes(fnTag)) return;
    }
    if (filter.scopeTags && filter.scopeTags.length) {
      const scopeTag = normalizeTag(pseudoEntry.scopeTag || '');
      if (!filter.scopeTags.includes(scopeTag)) return;
    }
    if (hasChainFilter) {
      const chainId = toStr(slot.chainId ?? '').trim();
      if (!filter.chainIds.includes(chainId)) return;
    }
    const addable = createOutcomeCounter();
    addOutcomeCounts(addable, slot);
    if (filter.outcomes && filter.outcomes.length) {
      const filtered = createOutcomeCounter();
      filter.outcomes.forEach((outcomeName) => {
        if (!Object.prototype.hasOwnProperty.call(filtered, outcomeName)) return;
        filtered[outcomeName] = Number(addable[outcomeName] || 0);
      });
      filtered.total = filtered.network + filtered.cache_hit + filtered.inflight_hit + filtered.error;
      addOutcomeCounts(totals, filtered);
      if (!byMethod[slot.method]) byMethod[slot.method] = createOutcomeCounter();
      addOutcomeCounts(byMethod[slot.method], filtered);
      return;
    }
    addOutcomeCounts(totals, addable);
    if (!byMethod[slot.method]) byMethod[slot.method] = createOutcomeCounter();
    addOutcomeCounts(byMethod[slot.method], addable);
  });
  return { totals, byMethod };
};

const buildGetLogsRangeReport = (recentEntries = [], maxRows = 200) => {
  const rangeMap = new Map();
  for (const entry of recentEntries) {
    if (!entry || entry.method !== 'eth_getLogs') continue;
    const rpc = entry.rpc && typeof entry.rpc === 'object' ? entry.rpc : {};
    const chainId = entry.chainId || '';
    const fromBlock = rpc.fromBlock;
    const toBlock = rpc.toBlock;
    const fromLabel = rpc.fromBlockRaw != null ? toStr(rpc.fromBlockRaw) : String(fromBlock);
    const toLabel = rpc.toBlockRaw != null ? toStr(rpc.toBlockRaw) : String(toBlock);
    const addressPart = Array.isArray(rpc.address)
      ? rpc.address.join(',')
      : (rpc.address || '');
    const key = [
      chainId,
      fromLabel,
      toLabel,
      addressPart,
      rpc.blockHash || '',
      toStr(rpc.topics0 || ''),
    ].join('|');
    const slot = rangeMap.get(key) || {
      chainId: chainId || null,
      fromBlock,
      toBlock,
      fromBlockRaw: rpc.fromBlockRaw || null,
      toBlockRaw: rpc.toBlockRaw || null,
      address: rpc.address || null,
      blockHash: rpc.blockHash || null,
      topics0: rpc.topics0 || null,
      totalCalls: 0,
      networkCalls: 0,
      cacheHits: 0,
      inflightHits: 0,
      errorCalls: 0,
      firstTs: entry.ts || null,
      lastTs: entry.ts || null,
    };
    slot.totalCalls += 1;
    if (entry.outcome === 'network') slot.networkCalls += 1;
    else if (entry.outcome === 'cache_hit') slot.cacheHits += 1;
    else if (entry.outcome === 'inflight_hit') slot.inflightHits += 1;
    else if (entry.outcome === 'error') slot.errorCalls += 1;

    const ts = Number(entry.ts || 0);
    if (Number.isFinite(ts) && ts > 0) {
      if (!slot.firstTs || ts < slot.firstTs) slot.firstTs = ts;
      if (!slot.lastTs || ts > slot.lastTs) slot.lastTs = ts;
    }
    rangeMap.set(key, slot);
  }

  return Array.from(rangeMap.values())
    .sort((a, b) => {
      if ((b.networkCalls || 0) !== (a.networkCalls || 0)) return (b.networkCalls || 0) - (a.networkCalls || 0);
      if ((b.totalCalls || 0) !== (a.totalCalls || 0)) return (b.totalCalls || 0) - (a.totalCalls || 0);
      return (b.lastTs || 0) - (a.lastTs || 0);
    })
    .slice(0, Math.max(1, Number(maxRows || 0) || 200));
};

const readLegacyRpcStats = () => {
  try {
    const stats = (typeof globalThis !== 'undefined' && globalThis.__RPC_STATS__) || null;
    if (!stats || typeof stats !== 'object') return null;
    return {
      fnCounts: stats.counts || {},
      inflight: stats.inflight || {},
      recentCount: Array.isArray(stats.recent) ? stats.recent.length : 0,
    };
  } catch (_) {
    return null;
  }
};

export const perfDebugDecryptEnvelope = (event) => {
  if (!isRpcDebugEnabled()) return;
  const st = getGlobalState();
  const e = toStr(event || '');
  if (e === 'attempt') st.perf.decryptEnvelope.attempts += 1;
  else if (e === 'cache_hit') st.perf.decryptEnvelope.cacheHits += 1;
  else if (e === 'inflight_hit') st.perf.decryptEnvelope.inflightHits += 1;
  else if (e === 'error') st.perf.decryptEnvelope.errors += 1;
};

export const perfDebugLitGetKey = (event) => {
  if (!isRpcDebugEnabled()) return;
  const st = getGlobalState();
  const e = toStr(event || '');
  if (e === 'attempt') st.perf.litGetKey.attempts += 1;
  else if (e === 'cache_hit') st.perf.litGetKey.cacheHits += 1;
  else if (e === 'inflight_hit') st.perf.litGetKey.inflightHits += 1;
  else if (e === 'neg_cache_hit') st.perf.litGetKey.negCacheHits += 1;
  else if (e === 'error') st.perf.litGetKey.errors += 1;
};

export const rpcDebugSnapshot = ({ topN = 20 } = {}) => {
  const st = getGlobalState();
  const n = Number(topN || 0) || 20;

  const methodsByCount = Object.entries(st.countsByMethod || {})
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, n);

  const methodsByNetworkCalls = Object.entries(st.countsByMethodOutcome || {})
    .map(([method, slot]) => ({ method, count: Number(slot?.network || 0) || 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, n);

  const methodsByErrorCalls = Object.entries(st.countsByMethodOutcome || {})
    .map(([method, slot]) => ({ method, count: Number(slot?.error || 0) || 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, n);

  const keysArr = [];
  try {
    for (const [, v] of st.keys.entries()) keysArr.push(v);
  } catch (e) { log.warn('rpcDebugStats: fallback', e); }
  const topKeys = keysArr
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, n)
    .map((k) => ({
      keyHash: k.keyHash,
      count: k.count,
      method: k.method,
      chainId: k.chainId,
      providerKey: k.providerKey,
      url: k.url,
      paramsSummary: k.paramsSummary,
      stackSnippet: k.stackSnippet,
    }));

  return {
    v: st.v || 1,
    ts: Date.now(),
    enabled: isRpcDebugEnabled(),
    traceEnabled: isRpcTraceEnabled(),
    outcomes: { ...(st.outcomes || {}) },
    cacheHits: Number(st.cacheHits || 0),
    inflightHits: Number(st.inflightHits || 0),
    methodsByCount,
    methodsByNetworkCalls,
    methodsByErrorCalls,
    methodsByNetworkCount: st.countsByChain || {},
    methodsByNetworkOutcome: st.countsByChainOutcome || {},
    methodsByTaggedOutcome: st.countsByTaggedMethodOutcome || {},
    methodsByChainTaggedOutcome: st.countsByChainTaggedMethodOutcome || {},
    topKeys,
    recent: Array.isArray(st.recent) ? st.recent.slice(-st.recentMax) : [],
    perf: st.perf || {},
  };
};

export const rpcDebugScanSummary = ({ topN = 20, maxRanges = 200, filter = null } = {}) => {
  const st = getGlobalState();
  const snapshot = rpcDebugSnapshot({ topN });
  const normalizedFilter = normalizeSummaryFilter(filter);
  const allRecent = Array.isArray(st.recent) ? st.recent.slice(-st.recentMax) : [];
  const recent = normalizedFilter
    ? allRecent.filter((entry) => entryMatchesSummaryFilter(entry, normalizedFilter))
    : allRecent;
  const getLogsRanges = buildGetLogsRangeReport(recent, maxRanges);

  let totals;
  let methodOutcomes;
  if (!normalizedFilter) {
    const byMethodOutcome = snapshot.methodsByNetworkOutcome || {};
    methodOutcomes = {};
    Object.entries(byMethodOutcome || {}).forEach(([, chainSlot]) => {
      if (!chainSlot || typeof chainSlot !== 'object') return;
      Object.entries(chainSlot).forEach(([methodName, methodSlot]) => {
        if (!methodSlot || typeof methodSlot !== 'object') return;
        if (!methodOutcomes[methodName]) methodOutcomes[methodName] = createOutcomeCounter();
        addOutcomeCounts(methodOutcomes[methodName], methodSlot);
      });
    });
    totals = {
      network: Number(snapshot.outcomes?.network || 0),
      cache_hit: Number(snapshot.outcomes?.cache_hit || 0),
      inflight_hit: Number(snapshot.outcomes?.inflight_hit || 0),
      error: Number(snapshot.outcomes?.error || 0),
    };
    totals.total = totals.network + totals.cache_hit + totals.inflight_hit + totals.error;
  } else {
    const fromTagged = buildFilteredMethodOutcomes(st, normalizedFilter);
    methodOutcomes = fromTagged.byMethod;
    totals = fromTagged.totals;
  }

  const pickMethod = (name) => {
    const methodSlot = methodOutcomes && typeof methodOutcomes === 'object'
      ? methodOutcomes[name]
      : null;
    if (!methodSlot || typeof methodSlot !== 'object') return createOutcomeCounter();
    return {
      total: Number(methodSlot.total || 0),
      network: Number(methodSlot.network || 0),
      cache_hit: Number(methodSlot.cache_hit || 0),
      inflight_hit: Number(methodSlot.inflight_hit || 0),
      error: Number(methodSlot.error || 0),
    };
  };

  return {
    ts: Date.now(),
    enabled: snapshot.enabled,
    traceEnabled: snapshot.traceEnabled,
    retainedRecentCalls: recent.length,
    retainedRecentCallsUnfiltered: allRecent.length,
    filter: normalizedFilter || null,
    totals,
    methods: {
      eth_getLogs: pickMethod('eth_getLogs'),
      eth_call: pickMethod('eth_call'),
      eth_blockNumber: pickMethod('eth_blockNumber'),
    },
    getLogs: {
      uniqueRanges: getLogsRanges.length,
      ranges: getLogsRanges,
    },
    highLevel: readLegacyRpcStats(),
  };
};

export const rpcDebugStartRun = ({ recentMax = 1000, keysMax = 1500 } = {}) => {
  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.ENABLE_RPC_DEBUG_STATS = true;
      globalThis.__RPC_STATS__ = { counts: {}, recent: [], inflight: {} };
    }
  } catch (e) { log.warn('rpcDebugStats: fallback', e); }

  rpcDebugReset({ recentMax, keysMax });
  return rpcDebugScanSummary({ topN: 20, maxRanges: 200 });
};

const installWindowTools = () => {
  try {
    if (typeof window === 'undefined') return;
    const existing = window.__CE_RPC_DEBUG__ && typeof window.__CE_RPC_DEBUG__ === 'object'
      ? window.__CE_RPC_DEBUG__
      : {};
    window.__CE_RPC_DEBUG__ = {
      ...existing,
      startRun: rpcDebugStartRun,
      reset: rpcDebugReset,
      snapshot: rpcDebugSnapshot,
      scanSummary: rpcDebugScanSummary,
    };
  } catch (e) { log.warn('rpcDebugStats: fallback', e); }
};

installWindowTools();
