import { readCache, updateCacheAtomic } from './cacheScripts.js';
import { ensureQuestionArweaveCacheBranches } from '../arweave/arweaveRetryHelpers.js';
import { normalizeArweaveFailureEntry as normalizeFailureEntry } from '../arweave/arweaveFailureClassifiers.js';
import { USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import { resolveSessionConfigFromSources } from '../session/canonicalSessionContext.js';
import { normalizeSessionNaming } from '../session/sessionMetadata.js';
import { normalizeSessionSlug, resolveSessionConfigAliases } from '../session/sessionNaming.js';
import {
  getDefaultSessionConfig as getDemoDefaultSessionConfig,
  getDemoSessionConfigForDisplay,
} from '../session/sessionSourceResolver.js';
import { overlayCachedSessionWorkerConfig } from '../session/sessionWorkerConfigCache.js';
import { normalizeAddress } from '../web3/addressNormalization.js';
import { sessionRegistryStore } from '../web3/sessionRegistry.js';
import { toStr } from '../shared/primitives.js';

export const BLOCK_CACHE_MS = 30000;
export const latestBlockCache = { value: null, promise: null, ts: 0 };
export const gasPriceCache = { value: null, promise: null, ts: 0 };

export const HASH_READ_TTL_MS = 30 * 60 * 1000;
export const HASH_READ_MAX_ENTRIES = 2000;
export const ARWEAVE_TX_CACHE_MAX_ENTRIES = 1200;
export const ARWEAVE_TX_FAILURE_CACHE_MAX_ENTRIES = 1200;
export const HASH_MISS_SENTINEL = '__ce_hash_missing__';

const pruneTimestampedRecord = (record, { tsField, maxEntries } = {}) => {
  if (!record || typeof record !== 'object') return record;
  const max = Math.max(0, Math.floor(Number(maxEntries) || 0));
  const keys = Object.keys(record);
  if (max <= 0 || keys.length <= max) return record;
  const sorted = keys.map((key) => ({ key, ts: Number(record?.[key]?.[tsField] || 0) })).sort((a, b) => a.ts - b.ts);
  for (let i = 0; i < sorted.length - max; i += 1) {
    try {
      delete record[sorted[i].key];
    } catch (_) {}
  }
  return record;
};

const ARWEAVE_TX_FAILURE_MEMO = new Map();
const ARWEAVE_TX_FETCH_INFLIGHT = new Map();
const QUESTION_HASH_REVERT_LOGGED = new Set();
const SURVEY_HASH_REVERT_LOGGED = new Set();
const SESSION_START_BLOCK_FALLBACK_CACHE = new Map();
const _resolveSessionCache = new Map();
let _resolveSessionCacheTimer = null;

const defaultStrictAllowDemoFallback = () => !USE_ONCHAIN_SESSION_REGISTRY;

const resolveSessionConfigEntry = (sessionSlug, opts = {}) => {
  const hasAllowDemoFallback = Object.prototype.hasOwnProperty.call(opts, 'allowDemoFallback');
  const allowDemoFallback = hasAllowDemoFallback ? !!opts.allowDemoFallback : defaultStrictAllowDemoFallback();
  const preferRegistry = Object.prototype.hasOwnProperty.call(opts, 'preferRegistry') ? !!opts.preferRegistry : true;
  const resolved = resolveSessionConfigFromSources({
    sessionSlug,
    getRegistrySessionConfig: (slug) => sessionRegistryStore.getSessionConfig(slug),
    preferRegistry,
    allowDemoFallback: false,
  });
  if (resolved.sessionConfig || !allowDemoFallback) return resolved;
  const demoConfig = getDemoSessionConfigForDisplay(resolved.sessionSlug);
  return {
    ...resolved,
    sessionConfig: demoConfig,
    sessionConfigSource: demoConfig ? 'demo' : 'missing',
    warnings: resolved.warnings || [],
  };
};

const normalizeResolvedSessionConfig = (resolved, opts = {}) => {
  if (!resolved?.sessionConfig) return null;
  if (resolved.sessionConfigSource === 'registry' && opts.normalizeRegistry !== true) {
    return overlayCachedSessionWorkerConfig({
      slug: resolved.sessionSlug,
      sessionConfig: resolved.sessionConfig,
    });
  }
  return overlayCachedSessionWorkerConfig({
    slug: resolved.sessionSlug,
    sessionConfig: normalizeSessionNaming(resolved.sessionConfig),
  });
};

const resolveSession = (groupKeyOrCfg) => {
  if (groupKeyOrCfg && typeof groupKeyOrCfg === 'object') {
    const aliasResolved = resolveSessionConfigAliases(groupKeyOrCfg);
    const aliasCfg = aliasResolved.sessionConfig || null;
    if (aliasCfg && typeof aliasCfg === 'object') {
      const merged = { ...(aliasCfg || {}), ...(groupKeyOrCfg || {}) };
      delete merged.sessionConfig;
      delete merged.sessionSlug;
      delete merged.activeSessionSlug;
      delete merged.group;
      if (!merged.slug && aliasResolved.sessionSlug) merged.slug = aliasResolved.sessionSlug;
      return normalizeSessionNaming(merged);
    }
    if (aliasResolved.hasExplicitSessionSlug) {
      groupKeyOrCfg = aliasResolved.sessionSlug;
    }
  }

  if (groupKeyOrCfg === '' || groupKeyOrCfg == null) return getDemoDefaultSessionConfig();
  if (typeof groupKeyOrCfg === 'string') {
    const normalizedInput = normalizeSessionSlug(groupKeyOrCfg);
    if (normalizedInput === '') return getDemoDefaultSessionConfig();
    const resolved = resolveSessionConfigEntry(normalizedInput);
    if (resolved.sessionConfig) return normalizeResolvedSessionConfig(resolved);
    return {
      slug: normalizedInput,
      contracts: {},
      __unresolved: true,
    };
  }
  if (typeof groupKeyOrCfg === 'object') return normalizeSessionNaming(groupKeyOrCfg);
  if (!defaultStrictAllowDemoFallback()) return null;
  return getDemoDefaultSessionConfig();
};

export const memoizedResolveSession = (groupKeyOrCfg) => {
  const resolvedInput =
    groupKeyOrCfg && typeof groupKeyOrCfg === 'object' && groupKeyOrCfg._isWeb3Context === true
      ? (groupKeyOrCfg.groupKeyOrCfg ?? groupKeyOrCfg.cfg ?? groupKeyOrCfg)
      : groupKeyOrCfg;
  const key =
    resolvedInput === undefined
      ? ''
      : typeof resolvedInput === 'string'
        ? resolvedInput
        : JSON.stringify(resolvedInput);
  if (_resolveSessionCache.has(key)) return _resolveSessionCache.get(key);
  const result = resolveSession(resolvedInput === undefined ? '' : resolvedInput);
  _resolveSessionCache.set(key, result);
  if (!_resolveSessionCacheTimer) {
    _resolveSessionCacheTimer = setTimeout(() => {
      _resolveSessionCache.clear();
      _resolveSessionCacheTimer = null;
    }, 100);
  }
  return result;
};

export const READ_MEMO = {
  surveyHash: new Map(),
  questionHash: new Map(),
};

export const READ_INFLIGHT = {
  surveyHash: new Map(),
  questionHash: new Map(),
  response: new Map(),
  surveyData: new Map(),
  questionData: new Map(),
};

const pruneMapBySize = (map, maxEntries) => {
  while (map.size > maxEntries) {
    const oldest = map.keys().next().value;
    if (!oldest) break;
    map.delete(oldest);
  }
};

export const markHashRevertLoggedOnce = (set, key, maxEntries = 1200) => {
  const memoKey = String(key || '');
  if (!memoKey) return false;
  if (set.has(memoKey)) return false;
  set.add(memoKey);
  while (set.size > maxEntries) {
    const oldest = set.values().next().value;
    if (!oldest) break;
    set.delete(oldest);
  }
  return true;
};

export const getTimedMemoValue = (map, key, ttlMs) => {
  const entry = map.get(key);
  if (!entry) return null;
  const age = Date.now() - Number(entry.ts || 0);
  if (!Number.isFinite(age) || age > ttlMs) {
    map.delete(key);
    return null;
  }
  map.delete(key);
  map.set(key, entry);
  return entry.value;
};

export const setTimedMemoValue = (map, key, value, maxEntries = HASH_READ_MAX_ENTRIES) => {
  map.delete(key);
  map.set(key, { value, ts: Date.now() });
  pruneMapBySize(map, maxEntries);
};

export const buildHashReadMemoKey = ({ baseKey, id }) => `${baseKey}|${id}`;

export const buildHashReadInflightKey = ({ baseKey, id, throwOnError = false }) =>
  `${buildHashReadMemoKey({ baseKey, id })}|strict:${throwOnError ? '1' : '0'}`;

const readQuestionsCacheStorage = async (slug) => {
  const parsed = await readCache('questionsCache', slug);
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const ensureQuestionsNetworkNode = (cacheObj, netIdStr) => {
  if (!cacheObj[netIdStr]) {
    cacheObj[netIdStr] = {
      questionsLatestBlock: 0,
      questionsDiscoveryCheckpointBlock: 0,
      questions: {},
      questionResponses: {},
      questionResponsesLatestBlock: 0,
      questionResponsesMeta: {},
      arweaveTxCache: {},
      arweaveTxFailureCache: {},
      questionHydrationMeta: {},
    };
  }
  const net = cacheObj[netIdStr];
  if (!Number.isFinite(Number(net.questionsDiscoveryCheckpointBlock))) net.questionsDiscoveryCheckpointBlock = 0;
  if (!net.questions || typeof net.questions !== 'object') net.questions = {};
  if (!net.questionResponses || typeof net.questionResponses !== 'object') net.questionResponses = {};
  if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') net.questionResponsesMeta = {};
  ensureQuestionArweaveCacheBranches(net);
  if (!net.questionHydrationMeta || typeof net.questionHydrationMeta !== 'object') net.questionHydrationMeta = {};
  return net;
};

export { normalizeFailureEntry };

export const createContractScriptsCache = ({
  resolveSession,
  normalizeSessionSlug,
  getSessionAddresses,
  shouldBypassSessionScopeWindow,
  sessionRegistryStore,
  sessionRegistryUtils,
  DEFAULT_CHAIN_ID,
  contractsLog,
  parsePositiveBlockNumber,
  ethers,
}) => {
  const resolveReadContext = (groupKeyOrCfg) => {
    const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const slug = normalizeSessionSlug((typeof groupKeyOrCfg === 'string' ? groupKeyOrCfg : cfg?.slug || '') || '');
    const chainId =
      Number(cfg?.networkChainId || cfg?.contracts?.surveys?.chainId || cfg?.contracts?.sbtFactory?.chainId || 0) || 0;
    return {
      cfg,
      slug,
      chainId,
      baseKey: `${chainId}|${slug}`,
    };
  };

  const buildArweaveDebugContext = (groupKeyOrCfg, category = '', extra = {}) => {
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    return {
      category: String(category || '').trim() || 'unknown',
      caller: 'contractScripts',
      slug: slug || 'general',
      chainId: Number(chainId || 0) || null,
      ...(extra && typeof extra === 'object' ? extra : {}),
    };
  };

  const normalizeBlockWindowMemoPart = (value, fallback = 'na') => {
    if (value == null || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return String(Math.max(0, Math.floor(n)));
  };

  const buildSbtScopeMemoTag = (groupKeyOrCfg, resolvedCfg = null) => {
    const cfg =
      resolvedCfg && typeof resolvedCfg === 'object'
        ? resolvedCfg
        : resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const slug = normalizeSessionSlug(cfg?.slug || '') || 'general';
    const addrs = getSessionAddresses(cfg);
    const factoryAddr = normalizeAddress(addrs?.sbtFactory?.address || '') || 'no-factory';
    const chainId = Number(addrs?.sbtFactory?.chainId || cfg?.networkChainId || 0) || 0;
    const scopeBypass = shouldBypassSessionScopeWindow(groupKeyOrCfg, cfg);
    const blockStart = normalizeBlockWindowMemoPart(cfg?.blockLimits?.start, 'start-unknown');
    const blockEnd =
      cfg?.blockLimits?.end == null ? 'end-latest' : normalizeBlockWindowMemoPart(cfg?.blockLimits?.end, 'end-invalid');
    return `${factoryAddr}:${chainId}:${scopeBypass ? 'scope-bypass' : 'scope-default'}:${slug}:${blockStart}:${blockEnd}`;
  };

  const bumpSbtMemoRunVersion = (store, memoKey) => {
    if (!store._runVersion) store._runVersion = {};
    const next = Number(store._runVersion[memoKey] || 0) + 1;
    store._runVersion[memoKey] = next;
    return next;
  };

  const isLatestSbtMemoRun = (store, memoKey, runVersion) =>
    Number(store?._runVersion?.[memoKey] || 0) === Number(runVersion || 0);

  const buildSessionStartCacheKey = (chainId, registrySlug) => {
    const id = Number(chainId || 0) || 0;
    return `${id}:${toStr(registrySlug || '').toLowerCase()}`;
  };

  const readSessionCreatedBlockViaQueryFilter = async (contract, slugHash) => {
    if (!contract || typeof contract.queryFilter !== 'function') return null;
    const filter = contract?.filters?.SessionCreated ? contract.filters.SessionCreated(null, slugHash) : null;
    if (!filter) return null;
    const events = await contract.queryFilter(filter, 0, 'latest');
    if (!Array.isArray(events) || !events.length) return null;
    let minBlock = null;
    events.forEach((evt) => {
      const bn = parsePositiveBlockNumber(evt?.blockNumber);
      if (!bn) return;
      if (minBlock == null || bn < minBlock) minBlock = bn;
    });
    return minBlock;
  };

  const readSessionCreatedBlockViaChunkedLogs = async (contract, slugHash) => {
    const provider = contract?.provider;
    if (!provider || typeof provider.getLogs !== 'function') return null;

    const topic0 = contract?.interface?.getEventTopic ? contract.interface.getEventTopic('SessionCreated') : null;
    if (!topic0) return null;

    let latest = 0;
    try {
      latest = Number(await provider.getBlockNumber()) || 0;
    } catch (_) {
      return null;
    }
    if (latest <= 0) return null;

    const step = 250000;
    for (let toBlock = latest; toBlock >= 0; toBlock -= step) {
      const fromBlock = Math.max(0, toBlock - step + 1);
      const logs = await provider.getLogs({
        address: contract.address,
        topics: [topic0, null, slugHash],
        fromBlock,
        toBlock,
      });
      if (!Array.isArray(logs) || !logs.length) continue;
      let minBlock = null;
      logs.forEach((log) => {
        const bn = parsePositiveBlockNumber(log?.blockNumber);
        if (!bn) return;
        if (minBlock == null || bn < minBlock) minBlock = bn;
      });
      if (minBlock != null) return minBlock;
    }
    return null;
  };

  const resolveSessionStartFromRegistry = async ({ cfg, slug }) => {
    const chainId = Number(cfg?.networkChainId || DEFAULT_CHAIN_ID || 0) || 0;
    if (!chainId) return null;

    const registrySlug = sessionRegistryUtils.toRegistrySlug(slug || '');
    const cacheKey = buildSessionStartCacheKey(chainId, registrySlug);
    const cached = parsePositiveBlockNumber(SESSION_START_BLOCK_FALLBACK_CACHE.get(cacheKey));
    if (cached) return cached;

    let contract = null;
    try {
      contract = sessionRegistryUtils.getRegistryContract(chainId, null, { bootstrapRpc: true });
    } catch (_) {
      contract = null;
    }
    if (!contract) return null;

    const slugHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(registrySlug));
    let resolved = null;

    try {
      resolved = await readSessionCreatedBlockViaQueryFilter(contract, slugHash);
    } catch (err) {
      contractsLog.warn('[blockLimits] SessionCreated queryFilter fallback failed; trying chunked logs.', {
        slug: slug || 'general',
        chainId,
        error: err?.message || String(err),
      });
    }

    if (resolved == null) {
      try {
        resolved = await readSessionCreatedBlockViaChunkedLogs(contract, slugHash);
      } catch (err) {
        contractsLog.warn('[blockLimits] SessionCreated chunked log fallback failed.', {
          slug: slug || 'general',
          chainId,
          error: err?.message || String(err),
        });
      }
    }

    const valid = parsePositiveBlockNumber(resolved);
    if (!valid) return null;

    SESSION_START_BLOCK_FALLBACK_CACHE.set(cacheKey, valid);

    try {
      const normalizedSlug = normalizeSessionSlug(slug || '');
      const cachedCfg = sessionRegistryStore.getSessionConfig(normalizedSlug);
      if (cachedCfg && typeof cachedCfg === 'object') {
        sessionRegistryUtils.upsertSessionRegistryCache({
          config: {
            ...cachedCfg,
            blockLimits: {
              ...(cachedCfg.blockLimits || {}),
              start: valid,
            },
          },
        });
      }
    } catch (_) {}

    return valid;
  };

  const buildArweaveFailureMemoKey = ({ groupKeyOrCfg, txId }) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return '';
    const { baseKey } = resolveReadContext(groupKeyOrCfg);
    return `${baseKey}|${normalizedTxId}`;
  };

  const setArweaveFailureMemoEntry = ({ groupKeyOrCfg, txId, entry }) => {
    const memoKey = buildArweaveFailureMemoKey({ groupKeyOrCfg, txId });
    if (!memoKey) return;
    if (!entry || typeof entry !== 'object') {
      ARWEAVE_TX_FAILURE_MEMO.delete(memoKey);
      return;
    }
    ARWEAVE_TX_FAILURE_MEMO.set(memoKey, { ...entry });
    pruneMapBySize(ARWEAVE_TX_FAILURE_MEMO, 2400);
  };

  const getArweaveFailureMemoEntry = ({ groupKeyOrCfg, txId }) => {
    const memoKey = buildArweaveFailureMemoKey({ groupKeyOrCfg, txId });
    if (!memoKey) return null;
    const entry = ARWEAVE_TX_FAILURE_MEMO.get(memoKey);
    if (!entry || typeof entry !== 'object') return null;
    return { ...entry };
  };

  const readArweaveTxCacheEntry = async ({ groupKeyOrCfg, txId }) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return null;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return null;
    const netIdStr = String(chainId);
    const cache = await readQuestionsCacheStorage(slug);
    const net = ensureQuestionsNetworkNode(cache, netIdStr);
    const entry = net?.arweaveTxCache?.[normalizedTxId];
    if (!entry || typeof entry !== 'object') return null;
    const text = typeof entry.text === 'string' ? entry.text : '';
    if (!text) return null;
    return entry;
  };

  const readArweaveTxFailureCacheEntry = async ({ groupKeyOrCfg, txId, preferMemo = true }) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return null;
    const memoHit = preferMemo ? getArweaveFailureMemoEntry({ groupKeyOrCfg, txId: normalizedTxId }) : null;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return memoHit ? normalizeFailureEntry(memoHit) : null;
    const netIdStr = String(chainId);
    try {
      const cache = await readQuestionsCacheStorage(slug);
      const net = ensureQuestionsNetworkNode(cache, netIdStr);
      const entry = normalizeFailureEntry(net?.arweaveTxFailureCache?.[normalizedTxId]);
      if (entry) {
        setArweaveFailureMemoEntry({ groupKeyOrCfg, txId: normalizedTxId, entry });
        return entry;
      }
      if (memoHit) {
        setArweaveFailureMemoEntry({ groupKeyOrCfg, txId: normalizedTxId, entry: null });
      }
      return null;
    } catch (error) {
      if (memoHit) return normalizeFailureEntry(memoHit);
      throw error;
    }
  };

  const writeArweaveTxFailureCacheEntry = async ({ groupKeyOrCfg, txId, entry }) => {
    const normalizedTxId = String(txId || '').trim();
    const normalizedEntry = normalizeFailureEntry(entry);
    if (!normalizedTxId || !normalizedEntry) return null;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return null;
    const netIdStr = String(chainId);
    await updateCacheAtomic('questionsCache', slug, (current) => {
      const cache = current && typeof current === 'object' ? current : {};
      const net = ensureQuestionsNetworkNode(cache, netIdStr);
      net.arweaveTxFailureCache[normalizedTxId] = { ...normalizedEntry };
      pruneTimestampedRecord(net.arweaveTxFailureCache, {
        tsField: 'lastFailedAtMs',
        maxEntries: ARWEAVE_TX_FAILURE_CACHE_MAX_ENTRIES,
      });
      return cache;
    });
    setArweaveFailureMemoEntry({ groupKeyOrCfg, txId: normalizedTxId, entry: normalizedEntry });
    return normalizedEntry;
  };

  const clearArweaveTxFailureCacheEntry = async ({ groupKeyOrCfg, txId }) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return;
    const netIdStr = String(chainId);
    await updateCacheAtomic('questionsCache', slug, (current) => {
      const cache = current && typeof current === 'object' ? current : {};
      const net = ensureQuestionsNetworkNode(cache, netIdStr);
      if (
        net.arweaveTxFailureCache &&
        Object.prototype.hasOwnProperty.call(net.arweaveTxFailureCache, normalizedTxId)
      ) {
        try {
          delete net.arweaveTxFailureCache[normalizedTxId];
        } catch (_) {}
      }
      return cache;
    });
    setArweaveFailureMemoEntry({ groupKeyOrCfg, txId: normalizedTxId, entry: null });
  };

  const writeArweaveTxCacheEntry = async ({ groupKeyOrCfg, txId, text, contentType = 'application/json' }) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId || typeof text !== 'string' || text.length === 0) return;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return;
    const netIdStr = String(chainId);
    await updateCacheAtomic('questionsCache', slug, (current) => {
      const cache = current && typeof current === 'object' ? current : {};
      const net = ensureQuestionsNetworkNode(cache, netIdStr);
      net.arweaveTxCache[normalizedTxId] = {
        text,
        contentType: String(contentType || 'application/json'),
        savedAtMs: Date.now(),
      };
      pruneTimestampedRecord(net.arweaveTxCache, {
        tsField: 'savedAtMs',
        maxEntries: ARWEAVE_TX_CACHE_MAX_ENTRIES,
      });
      return cache;
    });
  };

  const buildArweaveTxFetchInflightKey = ({ chainId, txId, forceFetch = false }) =>
    `${Number(chainId || 0)}|${String(txId || '').trim()}|force:${forceFetch ? '1' : '0'}`;

  const runArweaveTxFetchCoalesced = async ({ chainId, txId, forceFetch = false, task }) => {
    const inflightKey = buildArweaveTxFetchInflightKey({ chainId, txId, forceFetch });
    if (ARWEAVE_TX_FETCH_INFLIGHT.has(inflightKey)) {
      return ARWEAVE_TX_FETCH_INFLIGHT.get(inflightKey);
    }
    const run = (async () => await task())();
    ARWEAVE_TX_FETCH_INFLIGHT.set(inflightKey, run);
    try {
      return await run;
    } finally {
      if (ARWEAVE_TX_FETCH_INFLIGHT.get(inflightKey) === run) {
        ARWEAVE_TX_FETCH_INFLIGHT.delete(inflightKey);
      }
    }
  };

  const clearReadCachesForGroup = (groupKeyOrCfg = null) => {
    const { baseKey, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!baseKey) return;
    const prefix = `${baseKey}|`;
    const chainPrefix = `${Number(chainId || 0)}|`;
    [READ_MEMO.surveyHash, READ_MEMO.questionHash].forEach((memo) => {
      Array.from(memo.keys()).forEach((k) => {
        if (String(k).startsWith(prefix)) memo.delete(k);
      });
    });
    Object.values(READ_INFLIGHT).forEach((inflightMap) => {
      Array.from(inflightMap.keys()).forEach((k) => {
        if (String(k).startsWith(prefix)) inflightMap.delete(k);
      });
    });
    Array.from(ARWEAVE_TX_FAILURE_MEMO.keys()).forEach((k) => {
      if (String(k).startsWith(prefix)) ARWEAVE_TX_FAILURE_MEMO.delete(k);
    });
    Array.from(ARWEAVE_TX_FETCH_INFLIGHT.keys()).forEach((k) => {
      if (String(k).startsWith(chainPrefix)) ARWEAVE_TX_FETCH_INFLIGHT.delete(k);
    });
  };

  return {
    resolveReadContext,
    buildArweaveDebugContext,
    buildSbtScopeMemoTag,
    bumpSbtMemoRunVersion,
    isLatestSbtMemoRun,
    resolveSessionStartFromRegistry,
    readArweaveTxCacheEntry,
    readArweaveTxFailureCacheEntry,
    writeArweaveTxFailureCacheEntry,
    clearArweaveTxFailureCacheEntry,
    writeArweaveTxCacheEntry,
    runArweaveTxFetchCoalesced,
    clearReadCachesForGroup,
    questionHashRevertLogged: QUESTION_HASH_REVERT_LOGGED,
    surveyHashRevertLogged: SURVEY_HASH_REVERT_LOGGED,
  };
};
