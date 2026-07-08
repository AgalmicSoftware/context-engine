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

type UnknownRecord = Record<string, unknown>;
type TimestampedEntry = Record<string, unknown>;
type TimestampedRecord = Record<string, TimestampedEntry>;
type PruneTimestampedOptions = {
  tsField?: string;
  maxEntries?: number;
};
type SessionConfigRecord = UnknownRecord & {
  _isWeb3Context?: boolean;
  activeSessionSlug?: unknown;
  blockLimits?: UnknownRecord;
  cfg?: unknown;
  contracts?: {
    surveys?: { chainId?: unknown };
    sbtFactory?: { chainId?: unknown };
  };
  group?: unknown;
  groupKeyOrCfg?: unknown;
  networkChainId?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  slug?: unknown;
};
type ResolvedSessionConfig = {
  sessionSlug?: string;
  sessionConfig?: SessionConfigRecord | null;
  sessionConfigSource?: string;
  warnings?: unknown[];
};
type TimedMemoEntry<T> = {
  value: T;
  ts: number;
};
type HashReadMemoKeyInput = {
  baseKey: unknown;
  id: unknown;
};
type HashReadInflightKeyInput = HashReadMemoKeyInput & {
  throwOnError?: boolean;
};
type SessionAddresses = {
  sbtFactory?: {
    address?: unknown;
    chainId?: unknown;
  };
};
type SessionRegistryStoreLike = {
  getSessionConfig: (slug: string) => SessionConfigRecord | null | undefined;
};
type RegistryLog = {
  blockNumber?: unknown;
};
type RegistryContractLike = {
  address?: string;
  provider?: {
    getBlockNumber?: () => Promise<unknown>;
    getLogs?: (filter: UnknownRecord) => Promise<RegistryLog[]>;
  };
  filters?: {
    SessionCreated?: (arg0: unknown, arg1: unknown) => unknown;
  };
  interface?: {
    getEventTopic?: (eventName: string) => string;
  };
  queryFilter?: (filter: unknown, fromBlock: number, toBlock: number | string) => Promise<RegistryLog[]>;
};
type SessionRegistryUtilsLike = {
  toRegistrySlug: (slug: string) => string;
  getRegistryContract: (chainId: number, provider?: null, options?: { bootstrapRpc?: boolean }) => unknown;
  upsertSessionRegistryCache: (input: UnknownRecord) => void;
};
type ContractScriptsCacheDeps = {
  resolveSession: (groupKeyOrCfg: unknown) => SessionConfigRecord | null;
  normalizeSessionSlug: (slug: unknown) => string;
  getSessionAddresses: (cfg: SessionConfigRecord | null) => SessionAddresses;
  shouldBypassSessionScopeWindow: (groupKeyOrCfg: unknown, cfg: SessionConfigRecord | null) => boolean;
  sessionRegistryStore: SessionRegistryStoreLike;
  sessionRegistryUtils: SessionRegistryUtilsLike;
  DEFAULT_CHAIN_ID: unknown;
  contractsLog: {
    warn: (message: string, context?: UnknownRecord) => void;
  };
  parsePositiveBlockNumber: (value: unknown) => number | null;
  ethers: {
    utils: {
      keccak256: (value: string | Uint8Array) => string;
      toUtf8Bytes: (value: string) => Uint8Array;
    };
  };
};
type ArweaveTxCacheEntry = UnknownRecord & {
  text?: string;
  contentType?: string;
  savedAtMs?: number;
};
type QuestionsNetworkNode = UnknownRecord & {
  questionsLatestBlock: unknown;
  questionsDiscoveryCheckpointBlock: unknown;
  questions: UnknownRecord;
  questionResponses: UnknownRecord;
  questionResponsesLatestBlock: unknown;
  questionResponsesMeta: UnknownRecord;
  arweaveTxCache: Record<string, ArweaveTxCacheEntry>;
  arweaveTxFailureCache: Record<string, UnknownRecord>;
  questionHydrationMeta: UnknownRecord;
};
type ArweaveTxInput = {
  groupKeyOrCfg?: unknown;
  txId?: unknown;
};
type ArweaveFailureInput = ArweaveTxInput & {
  entry?: unknown;
};
type ArweaveReadFailureInput = ArweaveTxInput & {
  preferMemo?: boolean;
};
type ArweaveWriteCacheInput = ArweaveTxInput & {
  text?: unknown;
  contentType?: unknown;
};
type ArweaveInflightKeyInput = {
  chainId?: unknown;
  txId?: unknown;
  forceFetch?: boolean;
};
type ArweaveInflightRunInput<T> = ArweaveInflightKeyInput & {
  task: () => Promise<T> | T;
};
type SessionStartInput = {
  cfg: SessionConfigRecord | null;
  slug: string;
};
type RunVersionStore = UnknownRecord & {
  _runVersion?: Record<string, number>;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asSessionConfigRecord = (value: unknown): SessionConfigRecord | null =>
  isRecord(value) ? (value as SessionConfigRecord) : null;

const asRegistryContract = (value: unknown): RegistryContractLike | null =>
  isRecord(value) ? (value as RegistryContractLike) : null;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const BLOCK_CACHE_MS = 30000;
export const latestBlockCache = { value: null, promise: null, ts: 0 };
export const gasPriceCache = { value: null, promise: null, ts: 0 };

export const clearLatestBlockCache = (): void => {
  delete (latestBlockCache as { _map?: unknown })._map;
  latestBlockCache.value = null;
  latestBlockCache.promise = null;
  latestBlockCache.ts = 0;
};

export const HASH_READ_TTL_MS = 30 * 60 * 1000;
export const HASH_READ_MAX_ENTRIES = 2000;
export const ARWEAVE_TX_CACHE_MAX_ENTRIES = 1200;
export const ARWEAVE_TX_FAILURE_CACHE_MAX_ENTRIES = 1200;
export const HASH_MISS_SENTINEL = '__ce_hash_missing__';

const pruneTimestampedRecord = (record: TimestampedRecord, { tsField, maxEntries }: PruneTimestampedOptions = {}) => {
  if (!record || typeof record !== 'object') return record;
  const timestampField = tsField || 'ts';
  const max = Math.max(0, Math.floor(Number(maxEntries) || 0));
  const keys = Object.keys(record);
  if (max <= 0 || keys.length <= max) return record;
  const sorted = keys
    .map((key) => ({ key, ts: Number(record?.[key]?.[timestampField] || 0) }))
    .sort((a, b) => a.ts - b.ts);
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
let _resolveSessionCacheTimer: ReturnType<typeof setTimeout> | null = null;

const defaultStrictAllowDemoFallback = () => !USE_ONCHAIN_SESSION_REGISTRY;

const resolveSessionConfigEntry = (
  sessionSlug: string,
  opts: { allowDemoFallback?: boolean; preferRegistry?: boolean } = {},
): ResolvedSessionConfig => {
  const hasAllowDemoFallback = Object.prototype.hasOwnProperty.call(opts, 'allowDemoFallback');
  const allowDemoFallback = hasAllowDemoFallback ? !!opts.allowDemoFallback : defaultStrictAllowDemoFallback();
  const preferRegistry = Object.prototype.hasOwnProperty.call(opts, 'preferRegistry') ? !!opts.preferRegistry : true;
  const resolved = resolveSessionConfigFromSources({
    sessionSlug,
    getRegistrySessionConfig: (slug: string) => sessionRegistryStore.getSessionConfig(slug),
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

const normalizeResolvedSessionConfig = (
  resolved: ResolvedSessionConfig,
  opts: { normalizeRegistry?: boolean } = {},
): SessionConfigRecord | null => {
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

const resolveSession = (groupKeyOrCfg: unknown): SessionConfigRecord | null => {
  const groupRecord = asSessionConfigRecord(groupKeyOrCfg);
  if (groupRecord) {
    const aliasResolved = resolveSessionConfigAliases(groupRecord);
    const aliasCfg = asSessionConfigRecord(aliasResolved.sessionConfig || null);
    if (aliasCfg) {
      const merged = { ...(aliasCfg || {}), ...(groupRecord || {}) };
      delete merged.sessionConfig;
      delete merged.sessionSlug;
      delete merged.activeSessionSlug;
      delete merged.group;
      if (!merged.slug && aliasResolved.sessionSlug) merged.slug = aliasResolved.sessionSlug;
      return normalizeSessionNaming(merged) as SessionConfigRecord;
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
  if (groupRecord) return normalizeSessionNaming(groupRecord) as SessionConfigRecord;
  if (!defaultStrictAllowDemoFallback()) return null;
  return getDemoDefaultSessionConfig();
};

export const memoizedResolveSession = (groupKeyOrCfg: unknown) => {
  const groupRecord = asSessionConfigRecord(groupKeyOrCfg);
  const resolvedInput =
    groupRecord && groupRecord._isWeb3Context === true
      ? (groupRecord.groupKeyOrCfg ?? groupRecord.cfg ?? groupRecord)
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

const pruneMapBySize = (map: Map<string, unknown>, maxEntries: number) => {
  while (map.size > maxEntries) {
    const oldest = map.keys().next().value;
    if (!oldest) break;
    map.delete(oldest);
  }
};

export const markHashRevertLoggedOnce = (set: Set<string>, key: unknown, maxEntries = 1200) => {
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

export const getTimedMemoValue = <T>(map: Map<string, TimedMemoEntry<T>>, key: string, ttlMs: number): T | null => {
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

export const setTimedMemoValue = <T>(
  map: Map<string, TimedMemoEntry<T>>,
  key: string,
  value: T,
  maxEntries = HASH_READ_MAX_ENTRIES,
) => {
  map.delete(key);
  map.set(key, { value, ts: Date.now() });
  pruneMapBySize(map, maxEntries);
};

export const buildHashReadMemoKey = ({ baseKey, id }: HashReadMemoKeyInput) => `${baseKey}|${id}`;

export const buildHashReadInflightKey = ({ baseKey, id, throwOnError = false }: HashReadInflightKeyInput) =>
  `${buildHashReadMemoKey({ baseKey, id })}|strict:${throwOnError ? '1' : '0'}`;

const readQuestionsCacheStorage = async (slug: string): Promise<UnknownRecord> => {
  const parsed = await readCache('questionsCache', slug);
  return isRecord(parsed) ? parsed : {};
};

const ensureQuestionsNetworkNode = (cacheObj: UnknownRecord, netIdStr: string): QuestionsNetworkNode => {
  const existing = cacheObj[netIdStr];
  if (!isRecord(existing)) {
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
  const net = cacheObj[netIdStr] as QuestionsNetworkNode;
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
}: ContractScriptsCacheDeps) => {
  const resolveReadContext = (groupKeyOrCfg: unknown) => {
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

  const buildArweaveDebugContext = (groupKeyOrCfg: unknown, category = '', extra: UnknownRecord = {}) => {
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    return {
      category: String(category || '').trim() || 'unknown',
      caller: 'contractScripts',
      slug: slug || 'general',
      chainId: Number(chainId || 0) || null,
      ...(extra && typeof extra === 'object' ? extra : {}),
    };
  };

  const normalizeBlockWindowMemoPart = (value: unknown, fallback = 'na') => {
    if (value == null || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return String(Math.max(0, Math.floor(n)));
  };

  const buildSbtScopeMemoTag = (groupKeyOrCfg: unknown, resolvedCfg: SessionConfigRecord | null = null) => {
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

  const bumpSbtMemoRunVersion = (store: RunVersionStore, memoKey: string) => {
    if (!store._runVersion) store._runVersion = {};
    const next = Number(store._runVersion[memoKey] || 0) + 1;
    store._runVersion[memoKey] = next;
    return next;
  };

  const isLatestSbtMemoRun = (store: RunVersionStore, memoKey: string, runVersion: unknown) =>
    Number(store?._runVersion?.[memoKey] || 0) === Number(runVersion || 0);

  const buildSessionStartCacheKey = (chainId: unknown, registrySlug: unknown) => {
    const id = Number(chainId || 0) || 0;
    return `${id}:${toStr(registrySlug || '').toLowerCase()}`;
  };

  const readSessionCreatedBlockViaQueryFilter = async (contract: RegistryContractLike | null, slugHash: string) => {
    if (!contract || typeof contract.queryFilter !== 'function') return null;
    const filter = contract?.filters?.SessionCreated ? contract.filters.SessionCreated(null, slugHash) : null;
    if (!filter) return null;
    const events = await contract.queryFilter(filter, 0, 'latest');
    if (!Array.isArray(events) || !events.length) return null;
    let minBlock: number | null = null;
    events.forEach((evt) => {
      const bn = parsePositiveBlockNumber(evt?.blockNumber);
      if (!bn) return;
      if (minBlock == null || bn < minBlock) minBlock = bn;
    });
    return minBlock;
  };

  const readSessionCreatedBlockViaChunkedLogs = async (contract: RegistryContractLike | null, slugHash: string) => {
    const provider = contract?.provider;
    if (!provider || typeof provider.getLogs !== 'function') return null;

    const topic0 = contract?.interface?.getEventTopic ? contract.interface.getEventTopic('SessionCreated') : null;
    if (!topic0) return null;

    let latest = 0;
    try {
      const getBlockNumber = provider.getBlockNumber;
      if (typeof getBlockNumber !== 'function') return null;
      latest = Number(await getBlockNumber()) || 0;
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
      let minBlock: number | null = null;
      logs.forEach((log) => {
        const bn = parsePositiveBlockNumber(log?.blockNumber);
        if (!bn) return;
        if (minBlock == null || bn < minBlock) minBlock = bn;
      });
      if (minBlock != null) return minBlock;
    }
    return null;
  };

  const resolveSessionStartFromRegistry = async ({ cfg, slug }: SessionStartInput) => {
    const chainId = Number(cfg?.networkChainId || DEFAULT_CHAIN_ID || 0) || 0;
    if (!chainId) return null;

    const registrySlug = sessionRegistryUtils.toRegistrySlug(slug || '');
    const cacheKey = buildSessionStartCacheKey(chainId, registrySlug);
    const cached = parsePositiveBlockNumber(SESSION_START_BLOCK_FALLBACK_CACHE.get(cacheKey));
    if (cached) return cached;

    let contract: RegistryContractLike | null = null;
    try {
      contract = asRegistryContract(sessionRegistryUtils.getRegistryContract(chainId, null, { bootstrapRpc: true }));
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
        error: errorMessage(err),
      });
    }

    if (resolved == null) {
      try {
        resolved = await readSessionCreatedBlockViaChunkedLogs(contract, slugHash);
      } catch (err) {
        contractsLog.warn('[blockLimits] SessionCreated chunked log fallback failed.', {
          slug: slug || 'general',
          chainId,
          error: errorMessage(err),
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

  const buildArweaveFailureMemoKey = ({ groupKeyOrCfg, txId }: ArweaveTxInput) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return '';
    const { baseKey } = resolveReadContext(groupKeyOrCfg);
    return `${baseKey}|${normalizedTxId}`;
  };

  const setArweaveFailureMemoEntry = ({ groupKeyOrCfg, txId, entry }: ArweaveFailureInput) => {
    const memoKey = buildArweaveFailureMemoKey({ groupKeyOrCfg, txId });
    if (!memoKey) return;
    if (!entry || typeof entry !== 'object') {
      ARWEAVE_TX_FAILURE_MEMO.delete(memoKey);
      return;
    }
    ARWEAVE_TX_FAILURE_MEMO.set(memoKey, { ...entry });
    pruneMapBySize(ARWEAVE_TX_FAILURE_MEMO, 2400);
  };

  const getArweaveFailureMemoEntry = ({ groupKeyOrCfg, txId }: ArweaveTxInput) => {
    const memoKey = buildArweaveFailureMemoKey({ groupKeyOrCfg, txId });
    if (!memoKey) return null;
    const entry = ARWEAVE_TX_FAILURE_MEMO.get(memoKey);
    if (!entry || typeof entry !== 'object') return null;
    return { ...entry };
  };

  const readArweaveTxCacheEntry = async ({ groupKeyOrCfg, txId }: ArweaveTxInput) => {
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

  const readArweaveTxFailureCacheEntry = async ({
    groupKeyOrCfg,
    txId,
    preferMemo = true,
  }: ArweaveReadFailureInput) => {
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

  const writeArweaveTxFailureCacheEntry = async ({ groupKeyOrCfg, txId, entry }: ArweaveFailureInput) => {
    const normalizedTxId = String(txId || '').trim();
    const normalizedEntry = normalizeFailureEntry(entry);
    if (!normalizedTxId || !normalizedEntry) return null;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return null;
    const netIdStr = String(chainId);
    await updateCacheAtomic('questionsCache', slug, (current: unknown) => {
      const cache = isRecord(current) ? current : {};
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

  const clearArweaveTxFailureCacheEntry = async ({ groupKeyOrCfg, txId }: ArweaveTxInput) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return;
    const netIdStr = String(chainId);
    await updateCacheAtomic('questionsCache', slug, (current: unknown) => {
      const cache = isRecord(current) ? current : {};
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

  const writeArweaveTxCacheEntry = async ({
    groupKeyOrCfg,
    txId,
    text,
    contentType = 'application/json',
  }: ArweaveWriteCacheInput) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId || typeof text !== 'string' || text.length === 0) return;
    const { slug, chainId } = resolveReadContext(groupKeyOrCfg);
    if (!chainId) return;
    const netIdStr = String(chainId);
    await updateCacheAtomic('questionsCache', slug, (current: unknown) => {
      const cache = isRecord(current) ? current : {};
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

  const buildArweaveTxFetchInflightKey = ({ chainId, txId, forceFetch = false }: ArweaveInflightKeyInput) =>
    `${Number(chainId || 0)}|${String(txId || '').trim()}|force:${forceFetch ? '1' : '0'}`;

  const runArweaveTxFetchCoalesced = async <T>({
    chainId,
    txId,
    forceFetch = false,
    task,
  }: ArweaveInflightRunInput<T>) => {
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

  const clearReadCachesForGroup = (groupKeyOrCfg: unknown = null) => {
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
