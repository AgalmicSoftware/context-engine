import { safeString, lower } from './runtimePrimitives.mjs';
import { DEFAULT_CACHE_TTL_SECONDS, DEFAULT_PAYLOAD_CONCURRENCY, DEFAULT_FOREGROUND_CHUNKS, QUESTION_CACHE_PREFIX, normalizeBlock, normalizeBytes32 } from './registryQuestionCore.mjs';
import { normalizePayloadSessionSlug } from './registryQuestionPayloads.mjs';
import { refreshSessionQuestionIndex } from './registryQuestions.mjs';

const pendingIndexRefreshes = new Map();

export function cacheTtlSeconds(env = {}) {
  return DEFAULT_CACHE_TTL_SECONDS;
}

export function payloadConcurrency(env = {}) {
  return DEFAULT_PAYLOAD_CONCURRENCY;
}

export function foregroundChunks(env = {}) {
  return DEFAULT_FOREGROUND_CHUNKS;
}

export function normalizeOptionalPositiveInteger(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

export function foregroundPayloadBatchSize(env = {}, questionLimit = 0) {
  return (
    normalizeOptionalPositiveInteger(questionLimit)
  );
}

export function cacheKey(sessionSlug = '') {
  return `${QUESTION_CACHE_PREFIX}${lower(sessionSlug) || 'general'}`;
}

export function sessionQuestionCacheKey(env, sessionSlug) {
  const { sessionId, revision, address } = env.AGENT_CONTEXT;
  return cacheKey(`${sessionId}:${revision}:${address}:${lower(sessionSlug)}`);
}

export function mergeQuestionRanges(ranges = []) {
  const sorted = ranges.map(range => ({
    fromBlock: normalizeBlock(range.fromBlock), toBlock: normalizeBlock(range.toBlock),
  })).filter(range => range.fromBlock != null && range.toBlock != null && range.fromBlock <= range.toBlock)
    .sort((a, b) => a.fromBlock - b.fromBlock);
  const merged = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.fromBlock <= last.toBlock + 1) last.toBlock = Math.max(last.toBlock, range.toBlock);
    else merged.push(range);
  }
  return merged;
}

export function removeScannedQuestionRange(ranges, fromBlock, toBlock) {
  if (fromBlock == null) return ranges;
  return ranges.flatMap(range => {
    if (range.toBlock < fromBlock || range.fromBlock > toBlock) return [range];
    return [
      ...(range.fromBlock < fromBlock ? [{ fromBlock: range.fromBlock, toBlock: fromBlock - 1 }] : []),
      ...(range.toBlock > toBlock ? [{ fromBlock: toBlock + 1, toBlock: range.toBlock }] : []),
    ];
  });
}

export function normalizeQuestionIndex(value = {}) {
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
    unresolvedRanges: mergeQuestionRanges(value.unresolvedRanges || []),
    complete: value.complete === true,
    cached: true,
  };
}

export function isFreshQuestionIndex(value = {}, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  const index = normalizeQuestionIndex(value);
  if (!index) return false;
  return Date.now() - index.cachedAtMs <= ttlSeconds * 1000;
}

export function cachedIndexForReturn(value = {}, cacheLayer = 'kv') {
  const index = normalizeQuestionIndex(value);
  if (!index) return null;
  return {
    ...index,
    cached: true,
    cacheLayer,
  };
}

export function questionRecordMatchesSession(question = {}, sessionSlug = '') {
  const selectedSlug = lower(sessionSlug);
  const recordSlug = normalizePayloadSessionSlug(question);
  return !selectedSlug || recordSlug === selectedSlug;
}

export function filterQuestionRecordsForSession(questions = [], sessionSlug = '') {
  return (Array.isArray(questions) ? questions : [])
    .filter((question) => questionRecordMatchesSession(question, sessionSlug));
}

export function isPayloadUnavailableQuestion(question = {}) {
  return question?.payloadUnavailable === true || lower(question?.visibility) === 'payload_unavailable';
}

export function hasPayloadUnavailableQuestions(index = {}) {
  return Array.isArray(index?.questions) && index.questions.some(isPayloadUnavailableQuestion);
}

export function scopedCachedIndexForReturn(value = {}, cacheLayer = 'kv', sessionSlug = '') {
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

export function cacheNeedsImmediateScopeRefresh(index = {}) {
  return Number(index?.questionCount || 0) === 0 &&
    Number(index?.scopedOutQuestionCount || 0) > 0;
}

export function scheduleIndexRefresh({
  waitUntil = null,
  env = {},
  sessionSlug = '',
  existingIndex = null,
  refreshExpired = false,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof waitUntil !== 'function' || !existingIndex) return;
  const needsCompletion = existingIndex.complete !== true || hasPayloadUnavailableQuestions(existingIndex);
  const needsFreshness = refreshExpired && !isFreshQuestionIndex(existingIndex, cacheTtlSeconds(env));
  if (!needsCompletion && !needsFreshness) return;
  const key = sessionQuestionCacheKey(env, sessionSlug);
  if (pendingIndexRefreshes.has(key)) return;
  const refresh = refreshSessionQuestionIndex({
    env,
    sessionSlug,
    existingIndex,
    mode: 'complete',
    fetchImpl,
  }).catch(() => null).finally(() => pendingIndexRefreshes.delete(key));
  pendingIndexRefreshes.set(key, refresh);
  waitUntil(refresh);
}

export async function readKvQuestionIndex(env = {}, key = '') {
  if (!key || !env.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const text = await env.AGENT_ACTION_KV.get(key).catch(() => null);
  if (!text) return null;
  try {
    return normalizeQuestionIndex(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function writeKvQuestionIndex(env = {}, key = '', value = {}) {
  if (!key || !env.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') return;
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(value)).catch(() => null);
}

export function questionIdFromRecord(question = {}) {
  return normalizeBytes32(question.questionId || question.id);
}

export function mergeQuestionRecords(existing = [], additions = [], placement = 'append') {
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
