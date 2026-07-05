import { resolveRegistryRpcUrls, resolveSessionRegistryAddress } from './registrySessions.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  authenticateSessionWorker,
  resolveSessionWorkerUrl,
} from './onChainResponses.mjs';

const DEFAULT_CHAIN_ID = '11155420';
const ARWEAVE_GATEWAY = 'https://ar-io.dev';
const ARWEAVE_GATEWAYS = Object.freeze([ARWEAVE_GATEWAY, 'https://arweave.net']);
const DEFAULT_CACHE_TTL_SECONDS = 5 * 60;
const DEFAULT_SCAN_BLOCKS = 130_000;
const DEFAULT_LOG_CHUNK_SIZE = 250_000;
const DEFAULT_PAYLOAD_CONCURRENCY = 4;
const DEFAULT_FOREGROUND_CHUNKS = 1;
const DEFAULT_RPC_TIMEOUT_MS = 5_000;
const DEFAULT_PAYLOAD_FETCH_TIMEOUT_MS = 2_500;
const QUESTION_CACHE_PREFIX = 'telegram:questions:v5:';
const questionMemoryCache = new Map();
const QUESTION_PAYLOAD_SKIP = '__telegramQuestionPayloadSkip';
const STORAGE_BACKENDS = Object.freeze({
  ARWEAVE: 'arweave',
  CLOUDFLARE: 'cloudflare',
});

const SURVEYS_BY_CHAIN = Object.freeze({
  '11155420': '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
});

const SELECTORS = Object.freeze({
  getSessionBySlug: '0x42052f23',
  getQuestionHash: '0x24b9f713',
});

const QUESTIONS_ADDED_TOPIC0 = '0x3b584fb360a325f39352e75bd13458807d8e31735ef4dadaeff99fc3e59b517a';
const SESSION_CREATED_TOPIC0 = '0xda4a316a58925980f9d609158916dd8a071a29c9118777e57a5daed4ba17744f';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function normalizeChainId(value = '') {
  return safeString(value || DEFAULT_CHAIN_ID) || DEFAULT_CHAIN_ID;
}

function normalizePositiveInteger(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function normalizeBlock(value) {
  if (value == null || safeString(value) === '') return null;
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 0) return null;
  return Math.floor(raw);
}

function envFlagEnabled(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(lower(value));
}

function normalizeStorageBackend(value = '') {
  const backend = lower(value);
  if (backend === 'cloudflare' || backend === 'cf' || backend === 'r2') return STORAGE_BACKENDS.CLOUDFLARE;
  return STORAGE_BACKENDS.ARWEAVE;
}

function resolveQuestionStorageBackend(session = {}, env = {}) {
  const metadata = session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
    ? session.metadata
    : {};
  const profile = metadata.storageProfile && typeof metadata.storageProfile === 'object' && !Array.isArray(metadata.storageProfile)
    ? metadata.storageProfile
    : {};
  return normalizeStorageBackend(
    env.AGENT_BRIDGE_QUESTION_STORAGE_BACKEND ||
    profile.questionsBackend ||
    profile.questionBackend ||
    profile.backend ||
    metadata.questionStorageBackend ||
    metadata.storageBackend
  );
}

function storageRefForPointer(pointerId = '', resource = 'questions', backend = STORAGE_BACKENDS.ARWEAVE) {
  const id = safeString(pointerId);
  if (!id) return null;
  if (backend === STORAGE_BACKENDS.CLOUDFLARE) {
    return {
      backend: STORAGE_BACKENDS.CLOUDFLARE,
      id,
      resource,
      uri: `/storage/read?id=${encodeURIComponent(id)}`,
    };
  }
  return {
    backend: STORAGE_BACKENDS.ARWEAVE,
    id,
    resource,
    uri: `ar://${id}`,
  };
}

function loginOriginForWorker(env = {}) {
  const configured = safeString(
    env.AGENT_BRIDGE_WORKER_LOGIN_ORIGIN ||
    env.LOCAL_AUTH_ORIGIN ||
    env.AGENT_BRIDGE_PUBLIC_URL
  );
  try {
    return new URL(configured || 'http://localhost:7391').origin;
  } catch {
    return 'http://localhost:7391';
  }
}

function rpcTimeoutMs(env = {}) {
  return normalizePositiveInteger(env.AGENT_BRIDGE_RPC_TIMEOUT_MS, DEFAULT_RPC_TIMEOUT_MS);
}

function questionPayloadTimeoutMs(env = {}) {
  return normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_PAYLOAD_TIMEOUT_MS, DEFAULT_PAYLOAD_FETCH_TIMEOUT_MS);
}

function normalizeHexAddress(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{40}$/.test(text) ? text : '';
}

function normalizeBytes32(value = '') {
  const text = safeString(value);
  return BYTES32_RE.test(text) ? text.toLowerCase() : '';
}

function strip0x(value = '') {
  return safeString(value).replace(/^0x/i, '');
}

function hexWord(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function utf8ToHex(value = '') {
  return [...new TextEncoder().encode(String(value))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function encodeAbiStringArg(value = '') {
  const hex = utf8ToHex(value);
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return `${hexWord(32)}${hexWord(hex.length / 2)}${hex.padEnd(paddedLength, '0')}`;
}

function decodeUint256Word(word = '') {
  const hex = strip0x(word).slice(0, 64);
  return hex ? BigInt(`0x${hex}`) : 0n;
}

function wordAt(hex = '', index = 0) {
  const clean = strip0x(hex);
  return clean.slice(index * 64, index * 64 + 64);
}

function decodeAbiString(result = '', slotIndex = 0) {
  const hex = strip0x(result);
  if (hex.length < 64) return '';
  const offset = Number(decodeUint256Word(wordAt(hex, slotIndex)));
  const lengthOffset = offset * 2;
  const length = Number(decodeUint256Word(hex.slice(lengthOffset, lengthOffset + 64)));
  const bytesHex = hex.slice(lengthOffset + 64, lengthOffset + 64 + length * 2);
  if (!bytesHex) return '';
  const bytes = bytesHex.match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) || [];
  return new TextDecoder().decode(new Uint8Array(bytes)).trim();
}

function decodeSessionTuple(result = '') {
  const hex = strip0x(result);
  if (hex.length < 64 * 8) return null;
  return {
    slug: decodeAbiString(hex, 0),
    chainId: Number(decodeUint256Word(wordAt(hex, 1))) || null,
    metadataURI: decodeAbiString(hex, 2),
    encryptedMetadataURI: decodeAbiString(hex, 3),
    adminAddress: `0x${wordAt(hex, 4).slice(24)}`.toLowerCase(),
    createdAt: Number(decodeUint256Word(wordAt(hex, 5))) || null,
    updatedAt: Number(decodeUint256Word(wordAt(hex, 6))) || null,
  };
}

function decodeBytes32ArrayFromData(data = '', headSlotIndex = 0) {
  const hex = strip0x(data);
  if (hex.length < 64) return [];
  const offset = Number(decodeUint256Word(wordAt(hex, headSlotIndex)));
  const lengthOffset = offset * 2;
  const length = Number(decodeUint256Word(hex.slice(lengthOffset, lengthOffset + 64)));
  const out = [];
  for (let index = 0; index < length; index += 1) {
    const word = hex.slice(lengthOffset + 64 + index * 64, lengthOffset + 128 + index * 64);
    const bytes32 = normalizeBytes32(`0x${word}`);
    if (bytes32 && bytes32 !== ZERO_BYTES32) out.push(bytes32);
  }
  return out;
}

function bytesFromHex(hex = '') {
  const clean = strip0x(hex);
  if (!clean || clean.length % 2 !== 0) return new Uint8Array();
  return new Uint8Array(clean.match(/.{1,2}/g).map((part) => Number.parseInt(part, 16)));
}

function base64urlFromBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  const encoded = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hexToBase64url(hex = '') {
  const bytes = bytesFromHex(hex);
  return bytes.length ? base64urlFromBytes(bytes) : '';
}

function parseDataUriJson(uri = '') {
  const match = safeString(uri).match(/^data:application\/json(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) return null;
  const encoded = match[1];
  try {
    const text = typeof atob === 'function'
      ? atob(encoded)
      : Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseArweaveId(uri = '') {
  const text = safeString(uri);
  if (!text) return '';
  if (/^[a-zA-Z0-9_-]{43}$/.test(text)) return text;
  if (text.startsWith('ar://')) return safeString(text.slice(5));
  const marker = ['ar-io.dev/', 'arweave.net/'].find((entry) => text.includes(entry));
  return marker ? safeString(text.split(marker)[1] || '').split(/[?#]/)[0] : '';
}

async function rpcRequest({
  rpcUrl = '',
  method = '',
  params = [],
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`RPC ${method} timed out`)), timeoutMs);
  const response = await fetchImpl(rpcUrl, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  }).finally(() => clearTimeout(timeout));
  try {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) {
      throw new Error(safeString(body?.error?.message) || `RPC ${method} failed (${response.status || 502})`);
    }
    return body?.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcWithFallback({
  rpcUrls = [],
  method = '',
  params = [],
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  let lastError = null;
  for (const rpcUrl of rpcUrls) {
    try {
      return {
        ok: true,
        result: await rpcRequest({ rpcUrl, method, params, fetchImpl, timeoutMs }),
        rpcUrl,
      };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    ok: false,
    error: safeString(lastError?.message || lastError) || `No RPC URL succeeded for ${method}`,
  };
}

async function ethCall({
  rpcUrls = [],
  to = '',
  data = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const result = await rpcWithFallback({
    rpcUrls,
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
    fetchImpl,
    timeoutMs,
  });
  if (!result.ok) return result;
  const text = safeString(result.result);
  if (!/^0x[0-9a-fA-F]*$/.test(text)) {
    return { ok: false, error: 'RPC result was not hex' };
  }
  return { ...result, result: text };
}

function resolveSurveysAddress(env = {}, chainId = DEFAULT_CHAIN_ID) {
  return normalizeHexAddress(
    resolveConfiguredSurveysAddress(env) ||
    SURVEYS_BY_CHAIN[normalizeChainId(chainId)]
  );
}

function resolveConfiguredSurveysAddress(env = {}) {
  return normalizeHexAddress(
    env.AGENT_BRIDGE_SURVEYS_ADDRESS ||
    env.SURVEYS_CONTRACT_ADDRESS ||
    env.SURVEYS_ADDRESS
  );
}

function resolveMetadataSurveysAddress(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const contracts = metadata.contracts && typeof metadata.contracts === 'object'
    ? metadata.contracts
    : {};
  const candidates = [
    contracts?.surveys?.address,
    contracts?.survey?.address,
    contracts?.surveysContract?.address,
    contracts?.surveyContract?.address,
    contracts?.Surveys?.address,
    contracts?.surveys,
    contracts?.survey,
    metadata.surveysAddress,
    metadata.surveyAddress,
    metadata.surveysContractAddress,
    metadata.surveyContractAddress,
  ];
  for (const candidate of candidates) {
    const address = normalizeHexAddress(candidate);
    if (address) return address;
  }
  return '';
}

async function fetchArweaveJson(pointerId = '', {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const id = safeString(pointerId);
  if (!/^[a-zA-Z0-9_-]{43}$/.test(id)) return null;
  for (const gateway of ARWEAVE_GATEWAYS) {
    for (const pathPrefix of ['', 'raw/']) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('Arweave fetch timed out')), timeoutMs);
      try {
        const response = await fetchImpl(`${gateway}/${pathPrefix}${id}`, {
          method: 'GET',
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response?.ok) continue;
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          return payload;
        }
      } catch {
        // Try the next path/gateway. The bot must not depend on one gateway being up.
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  return null;
}

async function buildCloudflareQuestionStorageAuth({
  env = {},
  session = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const sessionSlug = safeString(session.slug || session.sessionSlug || env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG);
  const workerUrl = resolveSessionWorkerUrl(env, session);
  if (!workerUrl || !sessionSlug) return { ok: false, reason: 'session_worker_url_missing' };
  const principal = {
    telegramUserId: `question-indexer:${sessionSlug}`,
    username: 'question-indexer',
  };
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
  });
  return authenticateSessionWorker({
    env,
    session: { ...session, sessionSlug },
    account,
    principal,
    workerUrl,
    fetchImpl,
  });
}

async function fetchCloudflareStorageJson(pointerId = '', {
  env = {},
  session = {},
  getAuth,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_PAYLOAD_FETCH_TIMEOUT_MS,
} = {}) {
  const id = safeString(pointerId);
  if (!id || typeof fetchImpl !== 'function') return null;
  const auth = typeof getAuth === 'function'
    ? await getAuth()
    : await buildCloudflareQuestionStorageAuth({ env, session, fetchImpl });
  if (!auth?.ok || !auth.token || !auth.workerUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Cloudflare storage fetch timed out')), timeoutMs);
  try {
    const url = new URL(`${auth.workerUrl}/storage/read`);
    url.searchParams.set('id', id);
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        Origin: loginOriginForWorker(env),
        Authorization: `Bearer ${auth.token}`,
      },
    });
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSessionMetadata(metadataURI = '', {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const dataJson = parseDataUriJson(metadataURI);
  if (dataJson && typeof dataJson === 'object') return dataJson;
  const txId = parseArweaveId(metadataURI);
  if (!txId) return null;
  return fetchArweaveJson(txId, { fetchImpl, timeoutMs });
}

async function fetchSessionTupleWithFallback({
  rpcUrls = [],
  registryAddress = '',
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const data = `${SELECTORS.getSessionBySlug}${encodeAbiStringArg(lower(sessionSlug))}`;
  for (const rpcUrl of rpcUrls) {
    const call = await ethCall({
      rpcUrls: [rpcUrl],
      to: registryAddress,
      data,
      fetchImpl,
      timeoutMs,
    });
    if (!call.ok) continue;
    const tuple = decodeSessionTuple(call.result);
    if (tuple?.slug) return tuple;
  }
  return null;
}

async function fetchSessionConfigForQuestions({
  env = {},
  sessionSlug = '',
  rpcUrls = [],
  fetchImpl = globalThis.fetch,
} = {}) {
  const chainId = normalizeChainId(env.DEFAULT_CHAIN_ID);
  const envStart = normalizeBlock(env.AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK);
  const envEnd = normalizeBlock(env.AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK);
  const configuredSurveysAddress = resolveConfiguredSurveysAddress(env);
  const fallbackSurveysAddress = resolveSurveysAddress(env, chainId);
  const registryAddress = resolveSessionRegistryAddress(env);
  const session = {
    slug: lower(sessionSlug),
    sessionSlug: lower(sessionSlug),
    chainId,
    metadataURI: '',
    metadata: null,
    blockLimits: {
      start: envStart,
      end: envEnd,
    },
    surveysAddress: configuredSurveysAddress || fallbackSurveysAddress,
    sessionWorkerUrl: safeString(env.CE_SESSION_WORKER_BASE_URL || env.AGENT_BRIDGE_SESSION_WORKER_URL || env.SESSION_WORKER_URL),
  };
  if (configuredSurveysAddress && (envStart != null || envFlagEnabled(env.AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY))) {
    return session;
  }
  if (!registryAddress || !rpcUrls.length) return session;

  const tuple = await fetchSessionTupleWithFallback({
    rpcUrls,
    registryAddress,
    sessionSlug,
    fetchImpl,
    timeoutMs: rpcTimeoutMs(env),
  });
  if (!tuple?.slug) return session;
  session.slug = lower(tuple.slug);
  session.sessionSlug = session.slug;
  session.chainId = normalizeChainId(tuple.chainId || chainId);
  session.metadataURI = tuple.metadataURI;
  session.surveysAddress = configuredSurveysAddress || resolveSurveysAddress(env, session.chainId);
  const metadata = await fetchSessionMetadata(tuple.metadataURI, {
    fetchImpl,
    timeoutMs: rpcTimeoutMs(env),
  }).catch(() => null);
  if (metadata && typeof metadata === 'object') {
    session.metadata = metadata;
    session.blockLimits = {
      start: envStart ?? normalizeBlock(metadata?.blockLimits?.start),
      end: envEnd ?? normalizeBlock(metadata?.blockLimits?.end),
    };
    session.surveysAddress = configuredSurveysAddress ||
      resolveMetadataSurveysAddress(metadata) ||
      resolveSurveysAddress(env, session.chainId);
    session.sessionWorkerUrl = safeString(
      metadata.sessionWorkerUrl ||
      metadata.workerUrl ||
      metadata.corsWorkerUrl ||
      metadata.CE_SESSION_WORKER_BASE_URL ||
      session.sessionWorkerUrl
    );
  }
  if (session.blockLimits.start == null && envStart == null) {
    const createdBlock = await fetchSessionCreatedBlock({
      rpcUrls,
      registryAddress,
      sessionSlug: session.slug,
      fetchImpl,
      timeoutMs: rpcTimeoutMs(env),
    }).catch(() => null);
    if (createdBlock != null) {
      session.blockLimits = {
        ...session.blockLimits,
        start: createdBlock,
      };
    }
  }
  return session;
}

async function fetchSessionCreatedBlock({
  rpcUrls = [],
  registryAddress = '',
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const slug = lower(sessionSlug);
  if (!slug || !registryAddress || !rpcUrls.length) return null;
  const result = await rpcWithFallback({
    rpcUrls,
    method: 'eth_getLogs',
    params: [{
      address: registryAddress,
      fromBlock: '0x0',
      toBlock: 'latest',
      topics: [SESSION_CREATED_TOPIC0],
    }],
    fetchImpl,
    timeoutMs,
  });
  if (!result.ok) return null;
  const logs = Array.isArray(result.result) ? result.result : [];
  for (const log of logs.slice().reverse()) {
    const eventSlug = lower(decodeAbiString(log?.data || '', 0));
    if (eventSlug !== slug) continue;
    const block = Number(BigInt(safeString(log?.blockNumber || '0x0')));
    return Number.isFinite(block) && block >= 0 ? block : null;
  }
  return null;
}

async function currentBlockNumber({ rpcUrls = [], fetchImpl = globalThis.fetch } = {}) {
  const result = await rpcWithFallback({
    rpcUrls,
    method: 'eth_blockNumber',
    params: [],
    fetchImpl,
  });
  if (!result.ok) throw new Error(result.error);
  return Number(BigInt(safeString(result.result || '0x0')));
}

function resolveScanWindow({
  currentBlock = 0,
  session = {},
  env = {},
} = {}) {
  const fallbackBlocks = normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_SCAN_BLOCKS, DEFAULT_SCAN_BLOCKS);
  const explicitStart = normalizeBlock(session.blockLimits?.start);
  const explicitEnd = normalizeBlock(session.blockLimits?.end);
  const latest = Math.max(0, Math.floor(Number(currentBlock) || 0));
  const toBlock = explicitEnd == null ? latest : Math.min(latest, explicitEnd);
  const fromBlock = explicitStart == null ? Math.max(0, toBlock - fallbackBlocks) : explicitStart;
  return {
    fromBlock,
    toBlock,
    source: explicitStart == null ? 'fallback_recent_blocks' : 'session_block_limits',
    sessionScoped: explicitStart != null,
    recentBlockCap: explicitStart == null ? fallbackBlocks : null,
  };
}

async function scanQuestionIds({
  rpcUrls = [],
  surveysAddress = '',
  fromBlock = 0,
  toBlock = 0,
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const summary = {
    ids: [],
    chunksAttempted: 0,
    chunksSucceeded: 0,
    chunksFailed: 0,
    errors: [],
    order: 'newest_first',
  };
  if (!surveysAddress) return summary;
  if (toBlock < fromBlock) return summary;
  const chunkSize = normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE, DEFAULT_LOG_CHUNK_SIZE);
  const seen = new Set();
  for (let to = toBlock; to >= fromBlock;) {
    const from = Math.max(fromBlock, to - chunkSize + 1);
    summary.chunksAttempted += 1;
    const result = await rpcWithFallback({
      rpcUrls,
      method: 'eth_getLogs',
      params: [{
        address: surveysAddress,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
        topics: [QUESTIONS_ADDED_TOPIC0],
      }],
      fetchImpl,
      timeoutMs: rpcTimeoutMs(env),
    });
    if (!result.ok) {
      summary.chunksFailed += 1;
      if (summary.errors.length < 3) summary.errors.push(result.error || 'eth_getLogs failed');
      continue;
    }
    summary.chunksSucceeded += 1;
    const logs = Array.isArray(result.result) ? result.result : [];
    for (const log of logs.slice().reverse()) {
      for (const questionId of decodeBytes32ArrayFromData(log?.data || '', 0).reverse()) {
        if (seen.has(questionId)) continue;
        seen.add(questionId);
        summary.ids.push(questionId);
      }
    }
    to = from - 1;
  }
  return summary;
}

function normalizeQuestionVisibility(payload = {}) {
  const raw = lower(payload.visibility || payload.access || payload.questionVisibility);
  if (['private', 'sbt_gated', 'lit_encrypted'].includes(raw)) return raw;
  if (payload.private === true || payload.isPrivate === true) return 'private';
  if (payload.sbtGated === true || payload.gated === true) return 'sbt_gated';
  const encryption = payload.encryption && typeof payload.encryption === 'object' && !Array.isArray(payload.encryption)
    ? payload.encryption
    : null;
  const hasEncryptedField = (
    payload.litEncrypted === true ||
    payload.encrypted === true ||
    payload.promptEncrypted ||
    payload.optionsEncrypted ||
    payload.tagsEncrypted
  );
  const encryptionGateCandidates = [
    ...(Array.isArray(encryption?.gates) ? encryption.gates : []),
    encryption?.gate,
    {
      sbtAddress: encryption?.sbtAddress,
      sbtAddresses: encryption?.sbtAddresses,
    },
  ].filter(Boolean);
  const hasEncryptionGate = encryptionGateCandidates
    .some((gate, index) => normalizeQuestionGate(gate, index));
  if (hasEncryptedField || hasEncryptionGate) {
    return 'lit_encrypted';
  }
  return 'public';
}

function normalizeGateMode(value = '') {
  const mode = lower(value);
  return mode === 'all' ? 'all' : 'any';
}

function normalizeSbtAddresses(values = []) {
  const raw = Array.isArray(values) ? values : [values];
  const seen = new Set();
  const out = [];
  raw.forEach((value) => {
    const address = normalizeHexAddress(value);
    if (!address) return;
    const key = lower(address);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  });
  return out;
}

function normalizeQuestionGate(gate = {}, index = 0) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return null;
  const sbtAddresses = normalizeSbtAddresses([
    ...(Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : []),
    ...(Array.isArray(gate.addresses) ? gate.addresses : []),
    gate.sbtAddress,
    gate.address,
  ]);
  if (!sbtAddresses.length) return null;
  const mode = normalizeGateMode(gate.mode || gate.gateMode || gate.operator);
  return {
    id: safeString(gate.gateId || gate.id || gate.resourceKey || `question-gate-${index}`),
    label: safeString(gate.label || gate.name || gate.title),
    resourceKey: safeString(gate.resourceKey || gate.resource || ''),
    mode,
    sbtAddress: sbtAddresses[0],
    sbtAddresses,
  };
}

function normalizeQuestionEncryption(payload = {}, visibility = 'public') {
  const root = normalizeQuestionPayloadRoot(payload) || {};
  const encryption = root.encryption && typeof root.encryption === 'object' && !Array.isArray(root.encryption)
    ? root.encryption
    : (
        payload.encryption && typeof payload.encryption === 'object' && !Array.isArray(payload.encryption)
          ? payload.encryption
          : {}
      );
  const gateCandidates = [
    ...(Array.isArray(encryption.gates) ? encryption.gates : []),
    encryption.gate,
    ...(Array.isArray(root.gates) ? root.gates : []),
    root.gate,
    payload.gate,
  ].filter(Boolean);
  const gates = gateCandidates
    .map((gate, index) => normalizeQuestionGate(gate, index))
    .filter(Boolean);
  const sbtAddresses = normalizeSbtAddresses([
    ...gates.flatMap((gate) => gate.sbtAddresses || []),
    ...(Array.isArray(encryption.sbtAddresses) ? encryption.sbtAddresses : []),
    ...(Array.isArray(root.sbtAddresses) ? root.sbtAddresses : []),
    encryption.sbtAddress,
    root.sbtAddress,
  ]);
  const encrypted = visibility === 'lit_encrypted' ||
    visibility === 'sbt_gated' ||
    root.encrypted === true ||
    payload.encrypted === true ||
    Boolean(root.promptEncrypted || root.optionsEncrypted || root.tagsEncrypted);
  if (!encrypted && !sbtAddresses.length && !gates.length) return null;
  return {
    enabled: encrypted || gates.length > 0 || sbtAddresses.length > 0,
    encrypted,
    mode: normalizeGateMode(encryption.mode || encryption.gateMode || gates[0]?.mode),
    gates,
    sbtAddresses,
  };
}

function normalizePayloadSessionSlug(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const sessionObject = payload.session && typeof payload.session === 'object' && !Array.isArray(payload.session)
    ? payload.session
    : {};
  for (const candidate of [
    payload.sessionSlug,
    payload.session_slug,
    payload.groupSlug,
    sessionObject.sessionSlug,
    sessionObject.slug,
    payload.session,
  ]) {
    if (typeof candidate !== 'string' && typeof candidate !== 'number') continue;
    const slug = lower(candidate).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
    if (slug) return slug;
  }
  return '';
}

function allowUnscopedQuestionPayloads(env = {}) {
  return envFlagEnabled(env.AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_PAYLOADS);
}

function skippedQuestionPayload(reason = 'session_mismatch') {
  return {
    [QUESTION_PAYLOAD_SKIP]: true,
    reason,
  };
}

function isSkippedQuestionPayload(value = {}) {
  return value && typeof value === 'object' && value[QUESTION_PAYLOAD_SKIP] === true;
}

function normalizeOptions(payload = {}) {
  const raw = payload.options || payload.answerOptions || payload.choices || payload.answers || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => safeString(typeof entry === 'object'
    ? entry.label || entry.text || entry.value || entry.title || entry.name
    : entry))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeQuestionType(payload = {}) {
  const raw = lower(payload.questionType || payload.type || payload.kind || payload.responseType || 'freeform')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (['binary', 'boolean', 'yes_no', 'agree_disagree', 'agree_unsure_disagree'].includes(raw)) return 'binary';
  if (['rating', 'scale', 'linear_scale'].includes(raw)) return 'rating';
  if ([
    'multichoice',
    'multi_choice',
    'multiple_choice',
    'multi_select',
    'single_choice',
    'single_select',
  ].includes(raw)) return 'multichoice';
  return 'freeform';
}

function normalizeQuestionPayloadRoot(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  for (const candidate of [
    payload,
    payload.question,
    payload.questionData,
    payload.metadata,
    payload.data,
  ]) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const hasQuestionShape = candidate.id || candidate.questionId || candidate.prompt || candidate.questionText || candidate.type || candidate.questionType;
      if (hasQuestionShape) return candidate;
    }
  }
  return payload;
}

function normalizeQuestionPayload(payload = {}, {
  questionId = '',
  pointerId = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  sessionSlug = '',
  fallbackSessionSlug = '',
} = {}) {
  const root = normalizeQuestionPayloadRoot(payload);
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
  const id = normalizeBytes32(root.questionId || root.id || payload.questionId || payload.id) || normalizeBytes32(questionId);
  if (!id) return null;
  const visibility = normalizeQuestionVisibility(root);
  const encryption = normalizeQuestionEncryption(payload, visibility);
  const publicPrompt = visibility === 'public'
    ? safeString(root.questionText || root.prompt || root.title || payload.questionText || payload.prompt || payload.title)
    : '';
  const type = normalizeQuestionType(root);
  const normalized = {
    questionId: id,
    id,
    questionType: type,
    type,
    prompt: publicPrompt,
    questionText: publicPrompt,
    title: publicPrompt || (visibility === 'public' ? 'Untitled question' : 'Locked question'),
    options: visibility === 'public' ? normalizeOptions(root) : [],
    singleSelect: root.singleSelect === true || root.singleChoice === true || root.oneSelectionOnly === true,
    visibility,
    ...(encryption?.encrypted === true ? { encrypted: true } : {}),
    ...(encryption?.sbtAddresses?.length ? { requiredSbtAddresses: encryption.sbtAddresses } : {}),
    ...(encryption?.mode ? { gateMode: encryption.mode } : {}),
    ...(encryption?.enabled === true
      ? {
          encryption: {
            enabled: true,
            encrypted: encryption.encrypted === true,
            mode: encryption.mode,
            gates: encryption.gates,
            sbtAddresses: encryption.sbtAddresses,
          },
        }
      : {}),
    source: 'live_session_question',
    sessionSlug: normalizePayloadSessionSlug(root) || normalizePayloadSessionSlug(payload) || lower(fallbackSessionSlug),
    ...(pointerBackend === STORAGE_BACKENDS.ARWEAVE ? { arweaveTxId: pointerId } : {}),
    storageRef: storageRefForPointer(pointerId, 'questions', pointerBackend),
  };
  return normalized;
}

function lockedQuestionPlaceholder({
  questionId = '',
  pointerId = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  sessionSlug = '',
  reason = 'question_payload_unavailable',
} = {}) {
  const id = normalizeBytes32(questionId);
  if (!id) return null;
  return {
    questionId: id,
    id,
    questionType: 'unknown',
    prompt: '',
    questionText: '',
    title: 'Question unavailable',
    options: [],
    visibility: 'payload_unavailable',
    locked: false,
    payloadUnavailable: true,
    payloadUnavailableReason: safeString(reason) || 'question_payload_unavailable',
    source: 'live_session_question',
    sessionSlug: lower(sessionSlug),
    ...(pointerBackend === STORAGE_BACKENDS.ARWEAVE ? { arweaveTxId: pointerId } : {}),
    storageRef: storageRefForPointer(pointerId, 'questions', pointerBackend),
  };
}

async function fetchQuestionPayload({
  rpcUrls = [],
  surveysAddress = '',
  questionId = '',
  session = {},
  sessionSlug = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  getCloudflareAuth = null,
  env = {},
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const id = normalizeBytes32(questionId);
  if (!id || !surveysAddress) return null;
  const hashResult = await ethCall({
    rpcUrls,
    to: surveysAddress,
    data: `${SELECTORS.getQuestionHash}${strip0x(id)}`,
    fetchImpl,
    timeoutMs,
  });
  if (!hashResult.ok) return null;
  const pointerBytes = normalizeBytes32(hashResult.result);
  if (!pointerBytes || pointerBytes === ZERO_BYTES32) return null;
  const pointerId = hexToBase64url(pointerBytes);
  if (!/^[a-zA-Z0-9_-]{43}$/.test(pointerId)) return null;
  const payload = pointerBackend === STORAGE_BACKENDS.CLOUDFLARE
    ? await fetchCloudflareStorageJson(pointerId, {
      env,
      session,
      getAuth: getCloudflareAuth,
      fetchImpl,
      timeoutMs,
    })
    : await fetchArweaveJson(pointerId, { fetchImpl, timeoutMs });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return lockedQuestionPlaceholder({ questionId: id, pointerId, pointerBackend, sessionSlug });
  }
  const payloadSessionSlug = normalizePayloadSessionSlug(payload);
  const requestedSessionSlug = lower(sessionSlug);
  if (payloadSessionSlug && requestedSessionSlug && payloadSessionSlug !== requestedSessionSlug) {
    return skippedQuestionPayload('session_mismatch');
  }
  const shouldStampUnscopedPayload = !payloadSessionSlug &&
    requestedSessionSlug &&
    allowUnscopedQuestionPayloads(env);
  if (!payloadSessionSlug && requestedSessionSlug && !shouldStampUnscopedPayload) {
    return skippedQuestionPayload('session_slug_missing');
  }
  return normalizeQuestionPayload(payload, {
    questionId: id,
    pointerId,
    pointerBackend,
    sessionSlug,
    fallbackSessionSlug: shouldStampUnscopedPayload ? requestedSessionSlug : '',
  }) ||
    lockedQuestionPlaceholder({ questionId: id, pointerId, pointerBackend, sessionSlug });
}

function cacheTtlSeconds(env = {}) {
  return normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS);
}

function payloadConcurrency(env = {}) {
  return normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY, DEFAULT_PAYLOAD_CONCURRENCY);
}

function foregroundChunks(env = {}) {
  return normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS, DEFAULT_FOREGROUND_CHUNKS);
}

function normalizeOptionalPositiveInteger(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

function foregroundPayloadBatchSize(env = {}, questionLimit = 0) {
  return normalizeOptionalPositiveInteger(env.AGENT_BRIDGE_QUESTION_FOREGROUND_PAYLOADS) ||
    normalizeOptionalPositiveInteger(questionLimit);
}

function cacheKey(sessionSlug = '') {
  return `${QUESTION_CACHE_PREFIX}${lower(sessionSlug) || 'general'}`;
}

function normalizeQuestionIndex(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!Array.isArray(value.questions)) return null;
  const questions = value.questions
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
  const cachedAtMs = Number(value.cachedAtMs);
  return {
    ...value,
    ok: value.ok !== false,
    reason: safeString(value.reason || (questions.length ? 'live_questions_loaded' : 'live_questions_empty')),
    source: safeString(value.source || 'live_session_question_cache'),
    cachedAtMs: Number.isFinite(cachedAtMs) ? cachedAtMs : Date.now(),
    questions,
    questionCount: questions.length,
    skippedSessionMismatchCount: Number(value.skippedSessionMismatchCount || 0) || 0,
    indexedFromBlock: normalizeBlock(value.indexedFromBlock),
    indexedToBlock: normalizeBlock(value.indexedToBlock),
    targetFromBlock: normalizeBlock(value.targetFromBlock),
    targetToBlock: normalizeBlock(value.targetToBlock),
    nextScanToBlock: normalizeBlock(value.nextScanToBlock),
    complete: value.complete === true,
    cached: true,
  };
}

function isFreshQuestionIndex(value = {}, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  const index = normalizeQuestionIndex(value);
  if (!index) return false;
  return Date.now() - index.cachedAtMs <= ttlSeconds * 1000;
}

function cachedIndexForReturn(value = {}, cacheLayer = 'kv') {
  const index = normalizeQuestionIndex(value);
  if (!index) return null;
  return {
    ...index,
    cached: true,
    cacheLayer,
  };
}

function questionRecordMatchesSession(question = {}, sessionSlug = '') {
  const selectedSlug = lower(sessionSlug);
  const recordSlug = normalizePayloadSessionSlug(question);
  return !selectedSlug || recordSlug === selectedSlug;
}

function filterQuestionRecordsForSession(questions = [], sessionSlug = '') {
  return (Array.isArray(questions) ? questions : [])
    .filter((question) => questionRecordMatchesSession(question, sessionSlug));
}

function isPayloadUnavailableQuestion(question = {}) {
  return question?.payloadUnavailable === true || lower(question?.visibility) === 'payload_unavailable';
}

function hasPayloadUnavailableQuestions(index = {}) {
  return Array.isArray(index?.questions) && index.questions.some(isPayloadUnavailableQuestion);
}

function scopedCachedIndexForReturn(value = {}, cacheLayer = 'kv', sessionSlug = '') {
  const index = cachedIndexForReturn(value, cacheLayer);
  if (!index) return null;
  const scopedQuestions = filterQuestionRecordsForSession(index.questions, sessionSlug);
  const skippedFromCache = Math.max(0, index.questions.length - scopedQuestions.length);
  return {
    ...index,
    questions: scopedQuestions,
    questionCount: scopedQuestions.length,
    scopedOutQuestionCount: skippedFromCache,
    skippedSessionMismatchCount: Number(index.skippedSessionMismatchCount || 0) + skippedFromCache,
  };
}

function cacheNeedsImmediateScopeRefresh(index = {}) {
  return Number(index?.questionCount || 0) === 0 &&
    Number(index?.scopedOutQuestionCount || 0) > 0;
}

function scheduleIndexRefresh({
  waitUntil = null,
  env = {},
  sessionSlug = '',
  existingIndex = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof waitUntil !== 'function') return;
  if (!existingIndex || (existingIndex.complete === true && !hasPayloadUnavailableQuestions(existingIndex))) return;
  waitUntil(refreshSessionQuestionIndex({
    env,
    sessionSlug,
    existingIndex,
    mode: 'complete',
    fetchImpl,
  }).catch(() => null));
}

async function readKvQuestionIndex(env = {}, key = '') {
  if (!key || !env.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const text = await env.AGENT_ACTION_KV.get(key).catch(() => null);
  if (!text) return null;
  try {
    return normalizeQuestionIndex(JSON.parse(text));
  } catch {
    return null;
  }
}

async function writeKvQuestionIndex(env = {}, key = '', value = {}) {
  if (!key || !env.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') return;
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(value)).catch(() => null);
}

function questionIdFromRecord(question = {}) {
  return normalizeBytes32(question.questionId || question.id);
}

function mergeQuestionRecords(existing = [], additions = [], placement = 'append') {
  const merged = [];
  const seen = new Set();
  const ordered = placement === 'prepend'
    ? [...additions, ...existing]
    : [...existing, ...additions];
  for (const question of ordered) {
    const id = questionIdFromRecord(question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(question);
  }
  return merged;
}

async function fetchQuestionPayloads({
  rpcUrls = [],
  surveysAddress = '',
  questionIds = [],
  session = {},
  sessionSlug = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  getCloudflareAuth = null,
  seenQuestionIds = new Set(),
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const ids = questionIds
    .map((id) => normalizeBytes32(id))
    .filter((id) => id && !seenQuestionIds.has(id));
  const results = new Array(ids.length);
  let cursor = 0;
  let payloadFailureCount = 0;
  let skippedSessionMismatchCount = 0;
  const workers = Array.from({
    length: Math.min(ids.length, payloadConcurrency(env)),
  }, async () => {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      seenQuestionIds.add(id);
      const question = await fetchQuestionPayload({
        rpcUrls,
        surveysAddress,
        questionId: id,
        session,
        sessionSlug,
        pointerBackend,
        getCloudflareAuth,
        env,
        fetchImpl,
        timeoutMs: questionPayloadTimeoutMs(env),
      }).catch(() => null);
      if (isSkippedQuestionPayload(question)) {
        skippedSessionMismatchCount += 1;
      } else if (question) {
        results[index] = question;
      } else {
        payloadFailureCount += 1;
      }
    }
  });
  await Promise.all(workers);
  return {
    attemptedCount: ids.length,
    payloadFailureCount,
    skippedSessionMismatchCount,
    questions: results.filter(Boolean),
  };
}

async function scanQuestionRange({
  rpcUrls = [],
  surveysAddress = '',
  session = {},
  sessionSlug = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  getCloudflareAuth = null,
  fromBlock = 0,
  toBlock = 0,
  seenQuestionIds = new Set(),
  stopAfterFirstAvailable = false,
  foregroundPayloadLimit = 0,
  maxChunks = Infinity,
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const summary = {
    ids: [],
    chunksAttempted: 0,
    chunksSucceeded: 0,
    chunksFailed: 0,
    errors: [],
    order: 'newest_first',
  };
  const questions = [];
  let payloadFailureCount = 0;
  let skippedSessionMismatchCount = 0;
  let lowestScannedBlock = null;
  let nextScanToBlock = null;
  if (!surveysAddress || toBlock < fromBlock) {
    return {
      completed: true,
      scan: summary,
      questions,
      payloadFailureCount,
      skippedSessionMismatchCount,
      lowestScannedBlock,
      nextScanToBlock,
    };
  }
  const chunkSize = normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE, DEFAULT_LOG_CHUNK_SIZE);
  const maxChunkCount = Number.isFinite(Number(maxChunks)) && Number(maxChunks) > 0
    ? Math.floor(Number(maxChunks))
    : Infinity;
  for (let to = toBlock; to >= fromBlock && summary.chunksAttempted < maxChunkCount;) {
    const from = Math.max(fromBlock, to - chunkSize + 1);
    summary.chunksAttempted += 1;
    const result = await rpcWithFallback({
      rpcUrls,
      method: 'eth_getLogs',
      params: [{
        address: surveysAddress,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
        topics: [QUESTIONS_ADDED_TOPIC0],
      }],
      fetchImpl,
      timeoutMs: rpcTimeoutMs(env),
    });
    if (!result.ok) {
      summary.chunksFailed += 1;
      if (summary.errors.length < 3) summary.errors.push(result.error || 'eth_getLogs failed');
      to = from - 1;
      continue;
    }
    summary.chunksSucceeded += 1;
    lowestScannedBlock = from;
    const chunkIds = [];
    const logs = Array.isArray(result.result) ? result.result : [];
    for (const log of logs.slice().reverse()) {
      for (const questionId of decodeBytes32ArrayFromData(log?.data || '', 0).reverse()) {
        if (chunkIds.includes(questionId)) continue;
        chunkIds.push(questionId);
        summary.ids.push(questionId);
      }
    }
    const firstAvailableBatchSize = stopAfterFirstAvailable
      ? foregroundPayloadBatchSize(env, foregroundPayloadLimit)
      : 0;
    const payloadBatches = firstAvailableBatchSize > 0
      ? Array.from({ length: Math.ceil(chunkIds.length / firstAvailableBatchSize) }, (_, index) => (
          chunkIds.slice(index * firstAvailableBatchSize, (index + 1) * firstAvailableBatchSize)
        ))
      : [chunkIds];
    let stoppedWithinChunk = false;
    for (let batchIndex = 0; batchIndex < payloadBatches.length; batchIndex += 1) {
      const batchQuestionIds = payloadBatches[batchIndex];
      const payloads = await fetchQuestionPayloads({
        rpcUrls,
        surveysAddress,
        questionIds: batchQuestionIds,
        session,
        sessionSlug,
        pointerBackend,
        getCloudflareAuth,
        seenQuestionIds,
        env,
        fetchImpl,
      });
      payloadFailureCount += payloads.payloadFailureCount;
      skippedSessionMismatchCount += payloads.skippedSessionMismatchCount;
      questions.push(...payloads.questions);
      if (stopAfterFirstAvailable && questions.length > 0) {
        stoppedWithinChunk = batchIndex < payloadBatches.length - 1;
        nextScanToBlock = stoppedWithinChunk
          ? to
          : (from - 1 >= fromBlock ? from - 1 : null);
        break;
      }
    }
    if (stopAfterFirstAvailable && questions.length > 0) {
      if (stoppedWithinChunk) {
        lowestScannedBlock = null;
      }
      break;
    }
    to = from - 1;
    if (to >= fromBlock && summary.chunksAttempted >= maxChunkCount) {
      nextScanToBlock = to;
      break;
    }
  }
  return {
    completed: nextScanToBlock == null && summary.chunksFailed === 0,
    scan: summary,
    questions,
    payloadFailureCount,
    skippedSessionMismatchCount,
    lowestScannedBlock,
    nextScanToBlock,
  };
}

function mergeScanSummaries(left = {}, right = {}) {
  return {
    ids: [
      ...(Array.isArray(left.ids) ? left.ids : []),
      ...(Array.isArray(right.ids) ? right.ids : []),
    ],
    chunksAttempted: Number(left.chunksAttempted || 0) + Number(right.chunksAttempted || 0),
    chunksSucceeded: Number(left.chunksSucceeded || 0) + Number(right.chunksSucceeded || 0),
    chunksFailed: Number(left.chunksFailed || 0) + Number(right.chunksFailed || 0),
    errors: [
      ...(Array.isArray(left.errors) ? left.errors : []),
      ...(Array.isArray(right.errors) ? right.errors : []),
    ].slice(0, 3),
    order: 'newest_first',
  };
}

async function refreshSessionQuestionIndex({
  env = {},
  sessionSlug = '',
  existingIndex = null,
  mode = 'complete',
  foregroundPayloadLimit = 0,
  fetchImpl = globalThis.fetch,
} = {}) {
  const slug = lower(sessionSlug) || lower(env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG) || 'general';
  const key = cacheKey(slug);
  const previous = normalizeQuestionIndex(existingIndex);
  const rpcUrls = resolveRegistryRpcUrls(env);
  if (!rpcUrls.length) {
    return { ok: false, reason: 'question_rpc_url_missing', sessionSlug: slug, questions: [] };
  }

  const session = await fetchSessionConfigForQuestions({
    env,
    sessionSlug: slug,
    rpcUrls,
    fetchImpl,
  });
  const surveysAddress = normalizeHexAddress(session.surveysAddress) || resolveSurveysAddress(env, session.chainId);
  if (!surveysAddress) {
    return { ok: false, reason: 'surveys_address_missing', sessionSlug: slug, questions: [] };
  }
  const pointerBackend = resolveQuestionStorageBackend(session, env);
  let cloudflareAuthPromise = null;
  const getCloudflareAuth = pointerBackend === STORAGE_BACKENDS.CLOUDFLARE
    ? () => {
        if (!cloudflareAuthPromise) {
          cloudflareAuthPromise = buildCloudflareQuestionStorageAuth({
            env,
            session: { ...session, sessionSlug: slug },
            fetchImpl,
          }).catch((error) => ({
            ok: false,
            reason: safeString(error?.message || error) || 'cloudflare_question_auth_failed',
          }));
        }
        return cloudflareAuthPromise;
      }
    : null;

  let currentBlock = 0;
  try {
    currentBlock = await currentBlockNumber({ rpcUrls, fetchImpl });
  } catch (error) {
    return {
      ok: false,
      reason: 'question_current_block_failed',
      error: safeString(error?.message || error),
      sessionSlug: slug,
      questions: previous?.questions || [],
    };
  }
  const scanWindow = resolveScanWindow({ currentBlock, session, env });
  if (scanWindow.sessionScoped !== true && !envFlagEnabled(env.AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN)) {
    return {
      ok: false,
      reason: 'question_scan_window_unscoped',
      sessionSlug: slug,
      source: 'live_session_question_cache',
      chainId: normalizeChainId(session.chainId),
      surveysAddress,
      scanWindow,
      questions: previous?.questions || [],
    };
  }

  const previousQuestions = filterQuestionRecordsForSession(previous?.questions || [], slug);
  const retryUnavailableQuestions = previousQuestions.filter(isPayloadUnavailableQuestion);
  const retryQuestionIds = retryUnavailableQuestions
    .map(questionIdFromRecord)
    .filter(Boolean);
  let questions = previousQuestions.filter((question) => !isPayloadUnavailableQuestion(question));
  const seenQuestionIds = new Set(questions.map(questionIdFromRecord).filter(Boolean));
  let indexedFromBlock = previous?.indexedFromBlock;
  let indexedToBlock = previous?.indexedToBlock;
  let nextScanToBlock = previous?.nextScanToBlock;
  let complete = previous?.complete === true;
  let aggregateScan = previous?.scan || {};
  let payloadFailureCount = Number(previous?.payloadFailureCount || 0) || 0;
  let skippedSessionMismatchCount = Number(previous?.skippedSessionMismatchCount || 0) || 0;
  let partial = false;

  if (retryQuestionIds.length) {
    const retryPayloads = await fetchQuestionPayloads({
      rpcUrls,
      surveysAddress,
      questionIds: retryQuestionIds,
      session,
      sessionSlug: slug,
      pointerBackend,
      getCloudflareAuth,
      seenQuestionIds,
      env,
      fetchImpl,
    });
    payloadFailureCount += retryPayloads.payloadFailureCount;
    skippedSessionMismatchCount += Number(retryPayloads.skippedSessionMismatchCount || 0) || 0;
    const recoveredIds = new Set(retryPayloads.questions.map(questionIdFromRecord).filter(Boolean));
    const stillUnavailable = retryUnavailableQuestions
      .filter((question) => !recoveredIds.has(questionIdFromRecord(question)));
    questions = mergeQuestionRecords(questions, [...retryPayloads.questions, ...stillUnavailable], 'append');
  }

  const ranges = [];
  const hasCoverage = indexedFromBlock != null && indexedToBlock != null;
  if (hasCoverage && indexedToBlock < scanWindow.toBlock) {
    ranges.push({
      fromBlock: indexedToBlock + 1,
      toBlock: scanWindow.toBlock,
      placement: 'prepend',
      label: 'delta',
    });
  }
  if (!hasCoverage) {
    ranges.push({
      fromBlock: scanWindow.fromBlock,
      toBlock: scanWindow.toBlock,
      placement: 'append',
      label: 'initial',
    });
  } else if (complete !== true || indexedFromBlock > scanWindow.fromBlock) {
    const historicalTo = Math.min(
      normalizeBlock(nextScanToBlock) ?? indexedFromBlock - 1,
      scanWindow.toBlock
    );
    if (historicalTo >= scanWindow.fromBlock) {
      ranges.push({
        fromBlock: scanWindow.fromBlock,
        toBlock: historicalTo,
        placement: 'append',
        label: 'historical',
      });
    }
  }

  for (const range of ranges) {
    const firstAvailableMode = mode === 'until_first_available' && questions.length === 0;
    const rangeResult = await scanQuestionRange({
      rpcUrls,
      surveysAddress,
      session,
      sessionSlug: slug,
      pointerBackend,
      getCloudflareAuth,
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
      seenQuestionIds,
      stopAfterFirstAvailable: firstAvailableMode,
      foregroundPayloadLimit: firstAvailableMode ? foregroundPayloadLimit : 0,
      maxChunks: firstAvailableMode ? foregroundChunks(env) : Infinity,
      env,
      fetchImpl,
    });
    questions = mergeQuestionRecords(questions, rangeResult.questions, range.placement);
    payloadFailureCount += rangeResult.payloadFailureCount;
    skippedSessionMismatchCount += Number(rangeResult.skippedSessionMismatchCount || 0) || 0;
    aggregateScan = mergeScanSummaries(aggregateScan, rangeResult.scan);
    if (rangeResult.lowestScannedBlock != null) {
      if (range.placement === 'prepend') {
        indexedToBlock = Math.max(indexedToBlock ?? rangeResult.lowestScannedBlock, range.toBlock);
        indexedFromBlock = indexedFromBlock ?? rangeResult.lowestScannedBlock;
      } else {
        indexedToBlock = indexedToBlock ?? range.toBlock;
        indexedFromBlock = indexedFromBlock == null
          ? rangeResult.lowestScannedBlock
          : Math.min(indexedFromBlock, rangeResult.lowestScannedBlock);
      }
    }
    nextScanToBlock = rangeResult.nextScanToBlock;
    if (rangeResult.nextScanToBlock != null) {
      partial = true;
      complete = false;
      break;
    }
    if (rangeResult.completed !== true) {
      partial = true;
      complete = false;
    }
  }

  if (!ranges.length) {
    complete = true;
  } else if (!partial) {
    complete = indexedFromBlock != null &&
      indexedFromBlock <= scanWindow.fromBlock &&
      (indexedToBlock ?? 0) >= scanWindow.toBlock &&
      aggregateScan.chunksFailed === 0 &&
      payloadFailureCount === 0;
    nextScanToBlock = complete ? null : nextScanToBlock;
  }

  const hadReadFailures = Number(aggregateScan.chunksFailed || 0) > 0 || payloadFailureCount > 0;
  const ok = questions.length > 0 || !hadReadFailures;
  const reason = questions.length
    ? (complete ? 'live_questions_indexed' : 'live_questions_index_partial')
    : (!complete && !hadReadFailures
        ? 'live_questions_indexing'
        : Number(aggregateScan.chunksAttempted || 0) > 0 && Number(aggregateScan.chunksSucceeded || 0) === 0
        ? 'question_log_scan_failed'
        : Number(aggregateScan.chunksFailed || 0) > 0
        ? 'question_log_scan_partial_failed'
        : (payloadFailureCount > 0 ? 'question_payload_load_failed' : 'live_questions_empty'));
  const result = {
    ok,
    reason,
    sessionSlug: slug,
    source: 'telegram_worker_question_index',
    cacheLayer: 'fresh',
    cachedAtMs: Date.now(),
    chainId: normalizeChainId(session.chainId),
    surveysAddress,
    questionStorageBackend: pointerBackend,
    scanWindow,
    indexedFromBlock,
    indexedToBlock,
    targetFromBlock: scanWindow.fromBlock,
    targetToBlock: scanWindow.toBlock,
    nextScanToBlock,
    complete,
    scan: aggregateScan,
    discoveredCount: aggregateScan.ids?.length || 0,
    payloadFailureCount,
    skippedSessionMismatchCount,
    questionCount: questions.length,
    questions,
  };
  if (ok) {
    questionMemoryCache.set(key, result);
    await writeKvQuestionIndex(env, key, result);
  }
  return result;
}

export async function listCachedSessionQuestionsForBridge({
  env = {},
  sessionSlug = '',
  fetchImpl = env.QUESTION_FETCH || env.REGISTRY_FETCH || globalThis.fetch,
  waitUntil = null,
  forceRefresh = false,
  questionLimit = 0,
} = {}) {
  const slug = lower(sessionSlug) || lower(env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG) || 'general';
  const ttlSeconds = cacheTtlSeconds(env);
  const key = cacheKey(slug);
  const memory = scopedCachedIndexForReturn(questionMemoryCache.get(key), 'memory', slug);
  if (!forceRefresh && memory && isFreshQuestionIndex(memory, ttlSeconds) && !cacheNeedsImmediateScopeRefresh(memory)) {
    if (!hasPayloadUnavailableQuestions(memory)) {
      scheduleIndexRefresh({ waitUntil, env, sessionSlug: slug, existingIndex: memory, fetchImpl });
      return memory;
    }
  }
  const kv = await readKvQuestionIndex(env, key);
  if (!forceRefresh && kv && isFreshQuestionIndex(kv, ttlSeconds)) {
    questionMemoryCache.set(key, kv);
    const cached = scopedCachedIndexForReturn(kv, 'kv', slug);
    if (!cacheNeedsImmediateScopeRefresh(cached) && !hasPayloadUnavailableQuestions(cached)) {
      scheduleIndexRefresh({ waitUntil, env, sessionSlug: slug, existingIndex: cached, fetchImpl });
      return cached;
    }
  }
  const durableCached = scopedCachedIndexForReturn(kv || memory, kv ? 'kv' : 'memory', slug);
  const refreshBaseIndex = cacheNeedsImmediateScopeRefresh(durableCached) ? null : durableCached;
  if (!forceRefresh && refreshBaseIndex && typeof waitUntil === 'function' && !hasPayloadUnavailableQuestions(refreshBaseIndex)) {
    scheduleIndexRefresh({ waitUntil, env, sessionSlug: slug, existingIndex: refreshBaseIndex, fetchImpl });
    return refreshBaseIndex;
  }

  const firstResult = await refreshSessionQuestionIndex({
    env,
    sessionSlug: slug,
    existingIndex: refreshBaseIndex,
    mode: forceRefresh || typeof waitUntil !== 'function' ? 'complete' : 'until_first_available',
    foregroundPayloadLimit: questionLimit,
    fetchImpl,
  });
  if (
    typeof waitUntil === 'function' &&
    firstResult.ok &&
    firstResult.complete !== true &&
    firstResult.nextScanToBlock != null
  ) {
    waitUntil(refreshSessionQuestionIndex({
      env,
      sessionSlug: slug,
      existingIndex: firstResult,
      mode: 'complete',
      fetchImpl,
    }).catch(() => null));
  }
  return firstResult;
}

export const __test__sessionQuestions = {
  QUESTION_CACHE_PREFIX,
  QUESTIONS_ADDED_TOPIC0,
  SELECTORS,
  cacheKey,
  clearCaches() {
    questionMemoryCache.clear();
  },
  decodeBytes32ArrayFromData,
  decodeSessionTuple,
  encodeAbiStringArg,
  hexToBase64url,
  normalizeQuestionPayload,
  isPayloadUnavailableQuestion,
  questionMemoryCache,
  resolveScanWindow,
  scanQuestionIds,
};
