import { resolveRegistryRpcUrls, resolveSessionRegistryAddress } from './registrySessions.mjs';

const DEFAULT_CHAIN_ID = '11155420';
const ARWEAVE_GATEWAY = 'https://ar-io.dev';
const DEFAULT_CACHE_TTL_SECONDS = 5 * 60;
const DEFAULT_SCAN_BLOCKS = 130_000;
const DEFAULT_LOG_CHUNK_SIZE = 20_000;
const DEFAULT_MAX_QUESTIONS = 20;
const QUESTION_CACHE_PREFIX = 'telegram:questions:v1:';
const questionMemoryCache = new Map();

const SURVEYS_BY_CHAIN = Object.freeze({
  '11155420': '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
});

const SELECTORS = Object.freeze({
  getSessionBySlug: '0x42052f23',
  getQuestionHash: '0x24b9f713',
});

const QUESTIONS_ADDED_TOPIC0 = '0x3b584fb360a325f39352e75bd13458807d8e31735ef4dadaeff99fc3e59b517a';
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
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const response = await fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(safeString(body?.error?.message) || `RPC ${method} failed (${response.status || 502})`);
  }
  return body?.result;
}

async function rpcWithFallback({
  rpcUrls = [],
  method = '',
  params = [],
  fetchImpl = globalThis.fetch,
} = {}) {
  let lastError = null;
  for (const rpcUrl of rpcUrls) {
    try {
      return {
        ok: true,
        result: await rpcRequest({ rpcUrl, method, params, fetchImpl }),
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
} = {}) {
  const result = await rpcWithFallback({
    rpcUrls,
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
    fetchImpl,
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
    env.AGENT_BRIDGE_SURVEYS_ADDRESS ||
    env.SURVEYS_CONTRACT_ADDRESS ||
    env.SURVEYS_ADDRESS ||
    SURVEYS_BY_CHAIN[normalizeChainId(chainId)]
  );
}

async function fetchSessionMetadata(metadataURI = '', {
  fetchImpl = globalThis.fetch,
} = {}) {
  const dataJson = parseDataUriJson(metadataURI);
  if (dataJson && typeof dataJson === 'object') return dataJson;
  const txId = parseArweaveId(metadataURI);
  if (!txId) return null;
  const response = await fetchImpl(`${ARWEAVE_GATEWAY}/${txId}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
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
  const envSurveysAddress = resolveSurveysAddress(env, chainId);
  const registryAddress = resolveSessionRegistryAddress(env);
  const session = {
    slug: lower(sessionSlug),
    chainId,
    metadataURI: '',
    metadata: null,
    blockLimits: {
      start: envStart,
      end: envEnd,
    },
    surveysAddress: envSurveysAddress,
  };
  if (envSurveysAddress && (envStart != null || safeString(env.AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY))) {
    return session;
  }
  if (!registryAddress || !rpcUrls.length) return session;

  const call = await ethCall({
    rpcUrls,
    to: registryAddress,
    data: `${SELECTORS.getSessionBySlug}${encodeAbiStringArg(lower(sessionSlug))}`,
    fetchImpl,
  });
  if (!call.ok) return session;
  const tuple = decodeSessionTuple(call.result);
  if (!tuple?.slug) return session;
  session.slug = lower(tuple.slug);
  session.chainId = normalizeChainId(tuple.chainId || chainId);
  session.metadataURI = tuple.metadataURI;
  session.surveysAddress = envSurveysAddress || resolveSurveysAddress(env, session.chainId);
  const metadata = await fetchSessionMetadata(tuple.metadataURI, { fetchImpl }).catch(() => null);
  if (metadata && typeof metadata === 'object') {
    session.metadata = metadata;
    session.blockLimits = {
      start: envStart ?? normalizeBlock(metadata?.blockLimits?.start),
      end: envEnd ?? normalizeBlock(metadata?.blockLimits?.end),
    };
  }
  return session;
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
  };
  if (!surveysAddress) return summary;
  if (toBlock < fromBlock) return summary;
  const chunkSize = normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE, DEFAULT_LOG_CHUNK_SIZE);
  const seen = new Set();
  for (let from = fromBlock; from <= toBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, toBlock);
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
    });
    if (!result.ok) {
      summary.chunksFailed += 1;
      if (summary.errors.length < 3) summary.errors.push(result.error || 'eth_getLogs failed');
      continue;
    }
    summary.chunksSucceeded += 1;
    const logs = Array.isArray(result.result) ? result.result : [];
    for (const log of logs) {
      for (const questionId of decodeBytes32ArrayFromData(log?.data || '', 0)) {
        if (seen.has(questionId)) continue;
        seen.add(questionId);
        summary.ids.push(questionId);
      }
    }
  }
  return summary;
}

function normalizeQuestionVisibility(payload = {}) {
  const raw = lower(payload.visibility || payload.access || payload.questionVisibility);
  if (['private', 'sbt_gated', 'lit_encrypted'].includes(raw)) return raw;
  if (payload.private === true || payload.isPrivate === true) return 'private';
  if (payload.sbtGated === true || payload.gated === true) return 'sbt_gated';
  if (payload.litEncrypted === true || payload.encrypted === true || payload.promptEncrypted) return 'lit_encrypted';
  return 'public';
}

function normalizeOptions(payload = {}) {
  const raw = payload.options || payload.answerOptions || payload.choices || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => safeString(typeof entry === 'object' ? entry.label || entry.text || entry.value : entry))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeQuestionPayload(payload = {}, {
  questionId = '',
  pointerId = '',
  sessionSlug = '',
} = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const id = normalizeBytes32(payload.questionId || payload.id) || normalizeBytes32(questionId);
  if (!id) return null;
  const visibility = normalizeQuestionVisibility(payload);
  const publicPrompt = visibility === 'public'
    ? safeString(payload.questionText || payload.prompt || payload.title)
    : '';
  const normalized = {
    questionId: id,
    id,
    questionType: safeString(payload.questionType || payload.type || 'freeform'),
    prompt: publicPrompt,
    questionText: publicPrompt,
    title: publicPrompt || (visibility === 'public' ? 'Untitled question' : 'Locked question'),
    options: visibility === 'public' ? normalizeOptions(payload) : [],
    visibility,
    source: 'live_session_question',
    sessionSlug: lower(payload.sessionSlug || payload.session || sessionSlug),
    arweaveTxId: pointerId,
    storageRef: pointerId ? { backend: 'arweave', id: pointerId, resource: 'questions', uri: `ar://${pointerId}` } : null,
  };
  return normalized;
}

async function fetchQuestionPayload({
  rpcUrls = [],
  surveysAddress = '',
  questionId = '',
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const id = normalizeBytes32(questionId);
  if (!id || !surveysAddress) return null;
  const hashResult = await ethCall({
    rpcUrls,
    to: surveysAddress,
    data: `${SELECTORS.getQuestionHash}${strip0x(id)}`,
    fetchImpl,
  });
  if (!hashResult.ok) return null;
  const pointerBytes = normalizeBytes32(hashResult.result);
  if (!pointerBytes || pointerBytes === ZERO_BYTES32) return null;
  const pointerId = hexToBase64url(pointerBytes);
  if (!/^[a-zA-Z0-9_-]{43}$/.test(pointerId)) return null;
  const response = await fetchImpl(`${ARWEAVE_GATEWAY}/${pointerId}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null);
  return normalizeQuestionPayload(payload, { questionId: id, pointerId, sessionSlug });
}

function cacheTtlSeconds(env = {}) {
  return normalizePositiveInteger(env.AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS);
}

function cacheKey(sessionSlug = '') {
  return `${QUESTION_CACHE_PREFIX}${lower(sessionSlug) || 'general'}`;
}

function validCachedResult(value = {}, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const cachedAtMs = Number(value.cachedAtMs);
  if (!Number.isFinite(cachedAtMs) || Date.now() - cachedAtMs > ttlSeconds * 1000) return null;
  return {
    ...value,
    cached: true,
  };
}

async function readKvCache(env = {}, key = '', ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  if (!key || !env.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const text = await env.AGENT_ACTION_KV.get(key).catch(() => null);
  if (!text) return null;
  try {
    return validCachedResult(JSON.parse(text), ttlSeconds);
  } catch {
    return null;
  }
}

async function writeKvCache(env = {}, key = '', value = {}, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  if (!key || !env.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') return;
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds }).catch(() => null);
}

export async function listCachedSessionQuestionsForBridge({
  env = {},
  sessionSlug = '',
  fetchImpl = env.QUESTION_FETCH || env.REGISTRY_FETCH || globalThis.fetch,
} = {}) {
  const slug = lower(sessionSlug) || lower(env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG) || 'general';
  const ttlSeconds = cacheTtlSeconds(env);
  const key = cacheKey(slug);
  const memory = validCachedResult(questionMemoryCache.get(key), ttlSeconds);
  if (memory) return { ...memory, cacheLayer: 'memory' };
  const kv = await readKvCache(env, key, ttlSeconds);
  if (kv) {
    questionMemoryCache.set(key, kv);
    return { ...kv, cacheLayer: 'kv' };
  }

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
  const surveysAddress = resolveSurveysAddress(env, session.chainId);
  if (!surveysAddress) {
    return { ok: false, reason: 'surveys_address_missing', sessionSlug: slug, questions: [] };
  }

  let currentBlock = 0;
  try {
    currentBlock = await currentBlockNumber({ rpcUrls, fetchImpl });
  } catch (error) {
    return {
      ok: false,
      reason: 'question_current_block_failed',
      error: safeString(error?.message || error),
      sessionSlug: slug,
      questions: [],
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
      questions: [],
    };
  }

  const scanResult = await scanQuestionIds({
    rpcUrls,
    surveysAddress,
    fromBlock: scanWindow.fromBlock,
    toBlock: scanWindow.toBlock,
    env,
    fetchImpl,
  });
  const allIds = scanResult.ids;
  if (scanResult.chunksAttempted > 0 && scanResult.chunksSucceeded === 0) {
    return {
      ok: false,
      reason: 'question_log_scan_failed',
      error: scanResult.errors[0] || 'Question log scan failed',
      sessionSlug: slug,
      source: 'live_session_question_cache',
      chainId: normalizeChainId(session.chainId),
      surveysAddress,
      scanWindow,
      scan: scanResult,
      questions: [],
    };
  }
  const maxQuestions = normalizePositiveInteger(env.AGENT_BRIDGE_MAX_QUESTIONS_PER_SESSION, DEFAULT_MAX_QUESTIONS);
  const candidateIds = allIds.slice(-maxQuestions).reverse();
  const questions = [];
  let payloadFailureCount = 0;
  for (const questionId of candidateIds) {
    const question = await fetchQuestionPayload({
      rpcUrls,
      surveysAddress,
      questionId,
      sessionSlug: slug,
      fetchImpl,
    });
    if (question) questions.push(question);
    else payloadFailureCount += 1;
  }
  const hadReadFailures = scanResult.chunksFailed > 0 || payloadFailureCount > 0;
  const ok = questions.length > 0 || !hadReadFailures;
  const reason = questions.length
    ? (hadReadFailures ? 'live_questions_loaded_partial' : 'live_questions_loaded')
    : (scanResult.chunksFailed > 0
        ? 'question_log_scan_partial_failed'
        : (payloadFailureCount > 0 ? 'question_payload_load_failed' : 'live_questions_empty'));

  const result = {
    ok,
    reason,
    sessionSlug: slug,
    source: 'live_session_question_cache',
    cacheLayer: 'fresh',
    cachedAtMs: Date.now(),
    chainId: normalizeChainId(session.chainId),
    surveysAddress,
    scanWindow,
    scan: scanResult,
    discoveredCount: allIds.length,
    payloadFailureCount,
    questionCount: questions.length,
    questions,
  };
  if (ok && !hadReadFailures) {
    questionMemoryCache.set(key, result);
    await writeKvCache(env, key, result, ttlSeconds);
  }
  return result;
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
  questionMemoryCache,
  resolveScanWindow,
  scanQuestionIds,
};
