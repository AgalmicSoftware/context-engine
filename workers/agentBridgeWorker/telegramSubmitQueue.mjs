import { AGENT_BRIDGE_EVENT_TYPES, TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { submitTelegramResponseOnChain } from './onChainResponses.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { normalizeTelegramPrincipal } from './telegramUpdates.mjs';

export const SUBMIT_REQUEST_KV_PREFIX = 'telegram:submit-request:';
export const SUBMIT_REQUEST_SESSION_KV_PREFIX = 'telegram:submit-request-by-session:v1:';
export const SUBMIT_REQUEST_USER_KV_PREFIX = 'telegram:submit-request-by-user:v1:';
export const CANONICAL_ANSWER_KV_PREFIX = 'telegram:canonical-answer:v1:';
export const CANONICAL_ANSWER_SESSION_KV_PREFIX = 'telegram:canonical-answer-by-session:v1:';
export const SUBMIT_REQUEST_TTL_SECONDS = 30 * 24 * 60 * 60;
export const TELEGRAM_SUBMIT_QUEUE_MESSAGE_TYPE = 'telegram_submit_direct_v1';
export const SUBMITTED_RESULT_STATUSES = Object.freeze([
  'direct_submitted',
  'submit_queued',
  'submit_request_created',
]);

function safeString(value) {
  return String(value || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function envFlagEnabled(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(lower(value));
}

function envFlagDisabled(value = '') {
  return ['0', 'false', 'no', 'off'].includes(lower(value));
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

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

export function submitRequestKvKey(requestId = '') {
  const id = safeString(requestId);
  return id ? `${SUBMIT_REQUEST_KV_PREFIX}${id}` : '';
}

export function submitRequestSessionKvPrefix(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${SUBMIT_REQUEST_SESSION_KV_PREFIX}${slug}:` : '';
}

export function submitRequestSessionKvKey(record = {}) {
  const prefix = submitRequestSessionKvPrefix(record.sessionSlug);
  const requestId = safeString(record.requestId);
  return prefix && requestId ? `${prefix}${requestId}` : '';
}

export function submitRequestUserKvPrefix({
  sessionSlug = '',
  telegramUserId = '',
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const userId = safeString(telegramUserId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 128);
  return slug && userId ? `${SUBMIT_REQUEST_USER_KV_PREFIX}${slug}:${userId}:` : '';
}

export function submitRequestUserKvKey(record = {}) {
  const prefix = submitRequestUserKvPrefix({
    sessionSlug: record.sessionSlug,
    telegramUserId: record.telegramUserId,
  });
  const questionId = safeString(record.questionId).replace(/[^0-9A-Za-z._:-]/g, '').slice(0, 160);
  const requestId = safeString(record.requestId);
  return prefix && requestId ? `${prefix}${questionId || 'question'}:${requestId}` : '';
}

export function canonicalAnswerKvKey(record = {}) {
  const requestId = safeString(record.requestId || record.idempotencyKey).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 160);
  return requestId ? `${CANONICAL_ANSWER_KV_PREFIX}${requestId}` : '';
}

export function canonicalAnswerSessionKvPrefix(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${CANONICAL_ANSWER_SESSION_KV_PREFIX}${slug}:` : '';
}

export function canonicalAnswerSessionKvKey(record = {}) {
  const prefix = canonicalAnswerSessionKvPrefix(record.sessionSlug);
  const requestId = safeString(record.requestId || record.idempotencyKey).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 160);
  return prefix && requestId ? `${prefix}${requestId}` : '';
}

export function telegramSubmitQueueEnabled(env = {}) {
  if (envFlagDisabled(env.AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED)) return false;
  if (!envFlagEnabled(env.AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED)) return false;
  return env?.AGENT_RESPONSE_QUEUE && typeof env.AGENT_RESPONSE_QUEUE.send === 'function';
}

export function safeSessionSnapshotForSubmitQueue(session = {}) {
  return {
    sessionSlug: sanitizeSessionSlug(session.sessionSlug),
    sessionName: safeString(session.sessionName || session.name),
    managedAccountSubmitAllowed: session.managedAccountSubmitAllowed === true,
    sponsoredFaucetAllowed: session.sponsoredFaucetAllowed === true,
    sessionWorkerUrl: safeString(session.sessionWorkerUrl || session.workerUrl || session.corsWorkerUrl),
    surveysAddress: safeString(session.surveysAddress || session.surveyAddress),
    chainId: Number(session.chainId || 0) || undefined,
    rpcUrl: safeString(session.rpcUrl || session.defaultRpcUrl),
    additionalRpcUrl: safeString(session.additionalRpcUrl || session.fallbackRpcUrl),
  };
}

function objectOrNull(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeSubmitRecordTimestamps(record = {}) {
  const createdAt = safeString(record.createdAt || record.processedAt || record.updatedAt) || nowIso();
  return {
    ...record,
    createdAt,
  };
}

export function buildCanonicalAnswerRecord(record = {}, {
  sourceKey = '',
} = {}) {
  const requestId = safeString(record.requestId || record.idempotencyKey);
  const sessionSlug = sanitizeSessionSlug(record.sessionSlug);
  const questionId = safeString(record.questionId);
  if (!requestId || !sessionSlug || !questionId) return null;
  const createdAt = safeString(record.createdAt || record.processedAt || record.updatedAt);
  const updatedAt = safeString(record.processedAt || record.updatedAt || createdAt);
  const canonical = {
    version: 1,
    type: 'telegram_canonical_answer',
    requestId,
    idempotencyKey: safeString(record.idempotencyKey),
    status: safeString(record.status),
    lane: safeString(record.lane),
    telegramUserId: safeString(record.telegramUserId),
    username: safeString(record.username),
    languageCode: safeString(record.languageCode),
    chatId: safeString(record.chatId),
    sessionSlug,
    questionId,
    questionIdShort: safeString(record.questionIdShort),
    answerFingerprint: safeString(record.answerFingerprint),
    answer: objectOrNull(record.answer),
    onChainAnswer: objectOrNull(record.onChainAnswer),
    answerRef: objectOrNull(record.answerRef),
    canonicalApiRequest: objectOrNull(record.canonicalApiRequest),
    onChain: objectOrNull(record.onChain),
    directSubmitAttempt: objectOrNull(record.directSubmitAttempt),
    sourceKey: safeString(sourceKey),
    createdAt,
    updatedAt,
  };
  assertNoSecretShape(canonical, 'Canonical Telegram answer records must not serialize secrets.');
  return canonical;
}

export function buildQueuedSubmitRecord({
  baseRecord = {},
  session = {},
  canonicalBody = {},
} = {}) {
  const record = {
    ...baseRecord,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    status: 'submit_queued',
    canonicalApiRequest: {
      method: 'POST',
      path: '/api/agent/responses/submit-request',
      status: 'queued_direct_onchain',
      body: canonicalBody,
    },
    sessionSnapshot: safeSessionSnapshotForSubmitQueue(session),
  };
  assertNoSecretShape(record, 'Queued Telegram submit records must not serialize secrets.');
  return record;
}

export async function persistQueuedSubmitRecord({
  env = {},
  kvKey = '',
  record = {},
} = {}) {
  if (!env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  assertNoSecretShape(record, 'Queued Telegram submit records must not serialize secrets.');
  await persistTelegramSubmitRecord({ env, kvKey, record });
  return { ok: true };
}

async function persistCanonicalAnswerRecord({
  kv,
  record = {},
  sourceKey = '',
} = {}) {
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const canonical = buildCanonicalAnswerRecord(record, { sourceKey });
  if (!canonical) return { ok: false, reason: 'canonical_answer_incomplete' };
  const keys = [
    canonicalAnswerKvKey(canonical),
    canonicalAnswerSessionKvKey(canonical),
  ].filter(Boolean);
  if (!keys.length) return { ok: false, reason: 'canonical_answer_key_missing' };

  // KV is eventually consistent and last-write-wins. Submit-request records are
  // rolling operational indexes with TTLs; canonical answer records intentionally
  // have no expirationTtl. Keep any KV metadata compact (<=1024 bytes) and keep
  // values bounded because Cloudflare enforces per-value size limits.
  const serialized = JSON.stringify(canonical);
  await Promise.all(keys.map((key) => kv.put(key, serialized)));
  return { ok: true, keys, record: canonical };
}

export async function persistTelegramSubmitRecord({
  env = {},
  kvKey = '',
  record = {},
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const requestId = safeString(record.requestId);
  const canonicalKey = kvKey || submitRequestKvKey(requestId);
  if (!canonicalKey) return { ok: false, reason: 'submit_request_key_missing' };
  const storedRecord = normalizeSubmitRecordTimestamps(record);
  assertNoSecretShape(storedRecord, 'Telegram submit records must not serialize secrets.');
  const serialized = JSON.stringify(storedRecord);
  const canonical = await persistCanonicalAnswerRecord({ kv, record: storedRecord, sourceKey: canonicalKey });
  if (!canonical.ok) return canonical;
  const submitMetadata = {
    v: 1,
    t: 'submit_request',
    st: safeString(storedRecord.status).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 64),
    sg: sanitizeSessionSlug(storedRecord.sessionSlug),
    u: safeString(storedRecord.telegramUserId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 128),
    c: safeString(storedRecord.createdAt).slice(0, 32),
  };
  assertNoSecretShape(submitMetadata, 'Telegram submit record metadata must not serialize secrets.');
  const putOptions = { expirationTtl: SUBMIT_REQUEST_TTL_SECONDS, metadata: submitMetadata };
  await kv.put(canonicalKey, serialized, putOptions);
  const indexKeys = [
    submitRequestSessionKvKey(storedRecord),
    submitRequestUserKvKey(storedRecord),
  ].filter((key) => key && key !== canonicalKey);
  await Promise.all(indexKeys.map((key) => kv.put(key, serialized, putOptions)));
  return { ok: true, key: canonicalKey, indexKeys };
}

export async function enqueueTelegramSubmitRecord({
  env = {},
  record = {},
} = {}) {
  if (!telegramSubmitQueueEnabled(env)) {
    return { ok: false, skipped: true, reason: 'telegram_submit_queue_disabled' };
  }
  const body = {
    type: TELEGRAM_SUBMIT_QUEUE_MESSAGE_TYPE,
    version: 1,
    requestId: safeString(record.requestId),
    record,
  };
  assertNoSecretShape(body, 'Queued Telegram submit messages must not serialize secrets.');
  await env.AGENT_RESPONSE_QUEUE.send(body, { contentType: 'json' });
  return { ok: true, requestId: body.requestId };
}

export async function queueTelegramSubmitRecord({
  env = {},
  kvKey = '',
  record = {},
} = {}) {
  const persisted = await persistQueuedSubmitRecord({ env, kvKey, record });
  if (!persisted.ok) return persisted;
  const queued = await enqueueTelegramSubmitRecord({ env, record });
  if (!queued.ok) return queued;
  return { ok: true, queued: true, requestId: record.requestId };
}

export async function processQueuedTelegramSubmitRecord({
  env = {},
  record = {},
  createdAt = null,
  contractFactory = env.AGENT_BRIDGE_CONTRACT_FACTORY,
} = {}) {
  const requestId = safeString(record.requestId);
  const kvKey = submitRequestKvKey(requestId);
  const existing = env?.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(kvKey).catch(() => null), null)
    : null;
  if (existing?.status === 'direct_submitted') {
    return { ok: true, requestId, replayed: true, status: 'direct_submitted' };
  }
  const source = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : record;
  const session = source.sessionSnapshot || { sessionSlug: source.sessionSlug };
  const principal = normalizeTelegramPrincipal({
    telegramUserId: source.telegramUserId,
    username: source.username,
    languageCode: source.languageCode,
  });
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt: createdAt || source.createdAt || null,
  });
  const directSubmit = await submitTelegramResponseOnChain({
    env,
    session,
    account,
    principal,
    questionRef: {
      sessionSlug: source.sessionSlug,
      questionId: source.questionId,
    },
    answer: source.onChainAnswer || source.answer,
    idempotencyKey: source.idempotencyKey,
    createdAt: createdAt || source.createdAt || null,
    contractFactory,
  });
  const updated = {
    ...source,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    status: directSubmit.ok === true ? 'direct_submitted' : 'direct_submit_failed',
    canonicalApiRequest: {
      ...(source.canonicalApiRequest || {}),
      status: directSubmit.ok === true ? 'executed_direct_onchain' : 'direct_submit_failed',
    },
    onChain: directSubmit,
    processedAt: createdAt || new Date().toISOString(),
  };
  assertNoSecretShape(updated, 'Queued Telegram submit records must not serialize secrets.');
  if (env?.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.put === 'function') {
    await persistTelegramSubmitRecord({ env, kvKey, record: updated });
  }
  return {
    ok: directSubmit.ok === true,
    requestId,
    status: updated.status,
    reason: directSubmit.reason || null,
    error: directSubmit.error || null,
  };
}

export async function processTelegramSubmitQueueBatch(batch = {}, env = {}) {
  const messages = Array.isArray(batch.messages) ? batch.messages : [];
  const results = [];
  for (const message of messages) {
    const body = message.body || {};
    if (body.type !== TELEGRAM_SUBMIT_QUEUE_MESSAGE_TYPE || !body.record) {
      message.ack?.();
      results.push({ ok: true, skipped: true, reason: 'unsupported_queue_message' });
      continue;
    }
    try {
      const result = await processQueuedTelegramSubmitRecord({ env, record: body.record });
      message.ack?.();
      results.push(result);
    } catch (error) {
      message.retry?.();
      results.push({
        ok: false,
        reason: 'telegram_submit_queue_processing_failed',
        error: safeString(error?.message || error),
      });
    }
  }
  return { ok: results.every((result) => result.ok !== false), results };
}
