import {
  safeString,
  lower,
  safeJsonParse,
  envFlagEnabled,
  envFlagDisabled,
  nowIso,
  sanitizeSessionSlug,
} from './runtimePrimitives.mjs';
import { AGENT_BRIDGE_EVENT_TYPES, AGENT_ACTIONS } from './constants.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { submitAgentResponseOnChain } from './onChainResponses.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { normalizeLegacyManagedPrincipal } from './legacyCompatibility.mjs';
import { normalizeAgentRatingScale } from './ratingScale.mjs';

export const SUBMIT_REQUEST_KV_PREFIX = 'telegram:submit-request:';
export const SUBMIT_REQUEST_SESSION_KV_PREFIX = 'telegram:submit-request-by-session:v1:';
export const SUBMIT_REQUEST_USER_KV_PREFIX = 'telegram:submit-request-by-user:v1:';
export const CANONICAL_ANSWER_KV_PREFIX = 'telegram:canonical-answer:v1:';
export const CANONICAL_ANSWER_SESSION_KV_PREFIX = 'telegram:canonical-answer-by-session:v1:';
export const SUBMIT_REQUEST_TTL_SECONDS = 30 * 24 * 60 * 60;
export const AGENT_SUBMIT_QUEUE_MESSAGE_TYPE = 'telegram_submit_direct_v1';
export const SUBMIT_QUEUE_MAX_ATTEMPTS = 4;
export const SUBMIT_QUEUE_RETRY_DELAY_SECONDS = 60;
export const SUBMITTED_RESULT_STATUSES = Object.freeze([
  'direct_submitted',
  'submit_queued',
  'submit_request_created',
]);

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

export function agentSubmitQueueEnabled(env = {}) {
  if (envFlagDisabled(env.AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED)) return false;
  if (!envFlagEnabled(env.AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED)) return false;
  return env?.AGENT_RESPONSE_QUEUE && typeof env.AGENT_RESPONSE_QUEUE.send === 'function';
}

export function safeSessionSnapshotForSubmitQueue(session = {}) {
  return {
    sessionSlug: sanitizeSessionSlug(session.sessionSlug),
    sessionName: safeString(session.sessionName || session.name),
    sessionId: safeString(session.sessionId),
    sessionIdHex: safeString(session.sessionIdHex),
    ...(session.sessionModeProfile && typeof session.sessionModeProfile === 'object' && !Array.isArray(session.sessionModeProfile) ? {
      sessionModeProfile: {
        authority: { mode: safeString(session.sessionModeProfile.authority?.mode) },
        surfaces: { agentHttp: session.sessionModeProfile.surfaces?.agentHttp === true },
      },
    } : {}),
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
  assertNoSecretShape(canonical, "Canonical Agent answer records must not serialize secrets.");
  return canonical;
}

export function buildQueuedSubmitRecord({
  baseRecord = {},
  session = {},
  canonicalBody = {},
} = {}) {
  const record = normalizeSubmitRecordTimestamps({
    ...baseRecord,
    action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    status: 'submit_queued',
    canonicalApiRequest: {
      method: 'POST',
      path: '/api/agent/responses/submit-request',
      status: 'queued_direct_onchain',
      body: canonicalBody,
    },
    sessionSnapshot: safeSessionSnapshotForSubmitQueue(session),
  });
  assertNoSecretShape(record, "Queued Agent submit records must not serialize secrets.");
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
  assertNoSecretShape(record, "Queued Agent submit records must not serialize secrets.");
  await persistAgentSubmitRecord({ env, kvKey, record });
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

export async function persistAgentSubmitRecord({
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
  assertNoSecretShape(storedRecord, "Agent submit records must not serialize secrets.");
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
  assertNoSecretShape(submitMetadata, "Agent submit record metadata must not serialize secrets.");
  const putOptions = { expirationTtl: SUBMIT_REQUEST_TTL_SECONDS, metadata: submitMetadata };
  await kv.put(canonicalKey, serialized, putOptions);
  const indexKeys = [
    submitRequestSessionKvKey(storedRecord),
    submitRequestUserKvKey(storedRecord),
  ].filter((key) => key && key !== canonicalKey);
  await Promise.all(indexKeys.map((key) => kv.put(key, serialized, putOptions)));
  return { ok: true, key: canonicalKey, indexKeys };
}

export async function enqueueAgentSubmitRecord({
  env = {},
  record = {},
} = {}) {
  if (!agentSubmitQueueEnabled(env)) {
    return { ok: false, skipped: true, reason: 'telegram_submit_queue_disabled' };
  }
  const body = {
    type: AGENT_SUBMIT_QUEUE_MESSAGE_TYPE,
    version: 1,
    requestId: safeString(record.requestId),
    record,
  };
  assertNoSecretShape(body, "Queued Agent submit messages must not serialize secrets.");
  await env.AGENT_RESPONSE_QUEUE.send(body, { contentType: 'json' });
  return { ok: true, requestId: body.requestId };
}

export async function queueAgentSubmitRecord({
  env = {},
  kvKey = '',
  record = {},
} = {}) {
  const normalizedRecord = {
    ...normalizeSubmitRecordTimestamps(record),
    queueGeneration: safeString(record.queueGeneration) || crypto.randomUUID(),
  };
  const persisted = await persistQueuedSubmitRecord({ env, kvKey, record: normalizedRecord });
  if (!persisted.ok) return persisted;
  const queued = await enqueueAgentSubmitRecord({ env, record: normalizedRecord });
  if (!queued.ok) return queued;
  return { ok: true, queued: true, requestId: record.requestId };
}

function queueAttemptPolicy(env, attempts = 1) {
  const configured = Number(env.AGENT_BRIDGE_SUBMIT_MAX_ATTEMPTS);
  const maxAttempts = Number.isInteger(configured) && configured >= 1 && configured <= 101 ? configured : SUBMIT_QUEUE_MAX_ATTEMPTS;
  const attempt = Number.isInteger(Number(attempts)) && Number(attempts) >= 1 ? Number(attempts) : 1;
  const configuredDelay = Number(env.AGENT_BRIDGE_SUBMIT_RETRY_DELAY_SECONDS);
  const baseDelay = Number.isInteger(configuredDelay) && configuredDelay >= 60 && configuredDelay <= 3600 ? configuredDelay : SUBMIT_QUEUE_RETRY_DELAY_SECONDS;
  return { attempt, maxAttempts, delaySeconds: Math.min(3600, baseDelay * 2 ** Math.min(attempt - 1, 10)) };
}

function withRetryExhaustion(outcome, policy) {
  if (outcome.retryable !== true) return outcome;
  return {
    ...outcome, safeToRetry: true, attempts: policy.attempt, maxAttempts: policy.maxAttempts,
    retryable: policy.attempt < policy.maxAttempts,
    retryExhausted: policy.attempt >= policy.maxAttempts,
  };
}

function outcomeStatus(outcome) {
  return outcome.ok === true ? 'direct_submitted'
    : outcome.retryable === true ? 'submit_queued'
      : outcome.reconciliationRequired === true ? 'direct_submit_reconciliation_required' : 'direct_submit_failed';
}

function replayResult(record) {
  return {
    ok: record.status === 'direct_submitted', requestId: record.requestId, replayed: true,
    status: record.status, retryable: false,
    reconciliationRequired: record.status === 'direct_submit_reconciliation_required' || record.onChain?.reconciliationRequired === true,
    reason: record.onChain?.reason || null, onChain: record.onChain || null,
  };
}

function sameQueuedRequest(left, right) {
  return ['requestId', 'idempotencyKey', 'sessionSlug', 'questionId', 'telegramUserId']
    .every(key => safeString(left[key]) === safeString(right[key]));
}

function staleQueueGeneration(existing, incoming) {
  return existing?.queueGeneration && incoming?.queueGeneration && existing.queueGeneration !== incoming.queueGeneration;
}

function recoveryDiagnostics(record, reason) {
  return {
    event: 'agent_submit_recovery_required', reason, requestId: safeString(record.requestId),
    status: safeString(record.status), sessionSlug: safeString(record.sessionSlug),
    txHash: safeString(record.onChain?.txHash), storageId: safeString(record.onChain?.storageId),
    createdAt: safeString(record.createdAt), queueGeneration: safeString(record.queueGeneration),
  };
}

async function retainOutcomeForRecovery(env, record, error) {
  // The recovery message carries only an already-decided outcome. Its consumer
  // must never authenticate, upload, fund, or broadcast, even on redelivery.
  const recovery = record.onChain?.retryable === true ? {
    ...record, status: 'direct_submit_failed',
    canonicalApiRequest: { ...record.canonicalApiRequest, status: 'direct_submit_failed' },
    onChain: { ...record.onChain, retryable: false, safeToRetry: true, recoveryReason: 'submit_result_persistence_failed' },
  } : { ...record, canonicalApiRequest: { ...record.canonicalApiRequest, status: record.status === 'direct_submitted' ? 'executed_direct_onchain' : record.status } };
  const body = { type: AGENT_SUBMIT_QUEUE_MESSAGE_TYPE, version: 1, requestId: recovery.requestId, persistenceOnly: true, record: recovery };
  let retained = false;
  try {
    assertNoSecretShape(body, 'Submit recovery messages must not serialize secrets.');
    if (typeof env.AGENT_RESPONSE_QUEUE?.send !== 'function') throw new Error('submit_recovery_queue_unavailable');
    await env.AGENT_RESPONSE_QUEUE.send(body, { contentType: 'json', delaySeconds: SUBMIT_QUEUE_RETRY_DELAY_SECONDS });
    retained = true;
  } catch {
    console.error(recoveryDiagnostics(recovery, 'submit_recovery_persistence_unavailable'));
  }
  return {
    ok: false, requestId: recovery.requestId, status: recovery.status,
    reason: 'submit_result_persistence_failed', error: safeString(error?.message || error),
    retryable: false, reconciliationRequired: record.onChain?.ok === true || record.onChain?.reconciliationRequired === true,
    persistenceOnlyQueued: retained, diagnosticsRetained: retained, onChain: recovery.onChain,
  };
}

async function persistQueueOutcome({ env, source, outcome, now }) {
  const status = outcomeStatus(outcome);
  const updated = {
    ...source, action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE, status,
    canonicalApiRequest: { ...source.canonicalApiRequest, status: outcome.ok === true ? 'executed_direct_onchain' : status },
    onChain: outcome, processedAt: now.toISOString(),
  };
  try {
    if (outcome.safeToRetry === true && !outcome.submissionAttemptId) {
      // A pre-effect failure describes this delivery only. Recheck ownership so
      // it cannot mark another delivery's visible intent or outcome safe to retry.
      const raw = await env.AGENT_ACTION_KV.get(submitRequestKvKey(source.requestId));
      const latest = raw == null ? null : objectOrNull(safeJsonParse(raw, null));
      if (raw != null && (!latest || !sameQueuedRequest(latest, source))) {
        return { ok: false, requestId: source.requestId, retryable: false, reason: 'submit_request_record_invalid' };
      }
      if (staleQueueGeneration(latest, source)) return { ok: true, requestId: source.requestId, replayed: true, reason: 'stale_submit_delivery' };
      if (latest && (['direct_submitted', 'direct_submit_failed', 'direct_submit_reconciliation_required'].includes(latest.status) || latest.onChain?.reconciliationRequired === true)) {
        return replayResult(latest);
      }
    }
    const persisted = await persistAgentSubmitRecord({ env, record: updated });
    if (!persisted.ok) throw new Error(persisted.reason || 'submit_request_write_failed');
  } catch (error) {
    if (outcome.retryable === true && ['worker_auth_failed', 'rating_scale_unavailable'].includes(outcome.reason)) {
      // These failures precede the intent marker. A failed status write must not
      // turn known-safe transient authentication/metadata failure into a dead end.
      return { ...outcome, ok: false, requestId: source.requestId, status, reason: 'submit_result_persistence_failed', reconciliationRequired: false, onChain: outcome };
    }
    return retainOutcomeForRecovery(env, updated, error);
  }
  return {
    ok: outcome.ok === true, requestId: source.requestId, status, reason: outcome.reason || null,
    error: outcome.error || null, retryable: outcome.retryable === true,
    retryAfterSeconds: Number(outcome.retryAfterSeconds) || 0,
    reconciliationRequired: outcome.reconciliationRequired === true, onChain: outcome,
  };
}

async function persistRecoveryMessage({ env, body }) {
  const record = objectOrNull(body.record);
  if (!record || safeString(body.requestId) !== safeString(record.requestId) || !record.requestId || !record.sessionSlug || !record.questionId ||
      !['direct_submitted', 'direct_submit_failed', 'direct_submit_reconciliation_required'].includes(record.status) || !objectOrNull(record.onChain)) {
    return { ok: false, retryable: false, reason: 'submit_recovery_record_invalid' };
  }
  try {
    const kv = env.AGENT_ACTION_KV;
    if (typeof kv?.get !== 'function' || typeof kv?.put !== 'function') throw new Error('action_kv_unavailable');
    const raw = await kv.get(submitRequestKvKey(record.requestId));
    const existing = raw == null ? null : objectOrNull(safeJsonParse(raw, null));
    if (raw != null && (!existing || !sameQueuedRequest(existing, record))) {
      return { ok: false, retryable: false, reason: 'submit_recovery_request_mismatch' };
    }
    if (staleQueueGeneration(existing, record)) return { ok: true, replayed: true, reason: 'stale_submit_recovery' };
    if (existing?.status === 'direct_submitted' && record.status !== 'direct_submitted') return replayResult(existing);
    if (existing?.status === 'direct_submit_failed' && existing.onChain?.safeToRetry !== true && record.onChain.safeToRetry === true) {
      // Legacy or unknown failures carry no proof that a submission had no effects.
      return replayResult(existing);
    }
    if ((existing?.status === 'direct_submit_reconciliation_required' || existing?.onChain?.reconciliationRequired === true) &&
        record.onChain.safeToRetry === true && (!record.onChain.submissionAttemptId || record.onChain.submissionAttemptId !== existing.onChain?.submissionAttemptId)) {
      // Failed replay reads/auth do not prove that another delivery had no side
      // effects. Only the same admitted attempt can resolve its intent as safe.
      return replayResult(existing);
    }
    if (existing?.onChain?.txHash && record.onChain?.txHash && existing.onChain.txHash !== record.onChain.txHash) {
      // Keep both known outcomes: do not overwrite the stored one, and let the
      // recovery message reach the DLQ for explicit transaction reconciliation.
      return { ok: false, requestId: record.requestId, retryable: true, persistenceOnly: true, reason: 'submit_recovery_outcome_conflict' };
    }
    const persisted = await persistAgentSubmitRecord({ env, record: { ...record, createdAt: existing?.createdAt || record.createdAt } });
    if (!persisted.ok) throw new Error(persisted.reason || 'submit_recovery_write_failed');
    return { ok: true, requestId: record.requestId, status: record.status, persistenceOnly: true };
  } catch (error) {
    return { ok: false, requestId: record.requestId, retryable: true, persistenceOnly: true, reason: 'submit_recovery_write_failed', error: safeString(error?.message || error) };
  }
}

export async function processQueuedAgentSubmitRecord({
  env = {},
  record = {},
  createdAt = null,
  now = new Date(),
  attempts = 1,
  contractFactory = env.AGENT_BRIDGE_CONTRACT_FACTORY,
} = {}) {
  const requestId = safeString(record.requestId);
  const retryPolicy = queueAttemptPolicy(env, attempts);
  const kvKey = submitRequestKvKey(requestId);
  if (!kvKey) return { ok: false, retryable: false, reason: 'submit_request_key_missing' };
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    return { ok: false, requestId, retryable: false, reason: 'action_kv_unavailable' };
  }
  let rawExisting;
  try {
    rawExisting = await kv.get(kvKey);
  } catch (error) {
    // Do not mistake an unavailable replay check for an absent record and send again.
    const outcome = withRetryExhaustion({ ok: false, retryable: true, reason: 'submit_request_read_failed', error: safeString(error?.message || error) }, retryPolicy);
    if (outcome.retryable) return { ...outcome, requestId };
    // The failed read cannot authorize overwriting a possibly completed record.
    // Defer that comparison and terminal write to persistence-only recovery.
    return retainOutcomeForRecovery(env, { ...record, status: 'direct_submit_failed', onChain: outcome }, error);
  }
  const existing = rawExisting == null ? null : objectOrNull(safeJsonParse(rawExisting, null));
  if (rawExisting != null && (!existing || !sameQueuedRequest(existing, record))) {
    return { ok: false, requestId, retryable: false, reason: 'submit_request_record_invalid' };
  }
  if (staleQueueGeneration(existing, record)) return { ok: true, requestId, replayed: true, reason: 'stale_submit_delivery' };
  if (existing?.status === 'direct_submit_failed') return replayResult(existing);
  if (existing?.status === 'direct_submitted') {
    return { ok: true, requestId, replayed: true, status: 'direct_submitted' };
  }
  if (existing?.status === 'direct_submit_reconciliation_required' || existing?.onChain?.reconciliationRequired === true) {
    return {
      ok: false, requestId, replayed: true, retryable: false, reconciliationRequired: true,
      status: existing.status, reason: existing.onChain?.reason || 'direct_submit_reconciliation_required',
      onChain: existing.onChain || null,
    };
  }
  const source = existing || record;
  const executionTime = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(executionTime.getTime())) {
    return { ok: false, requestId, retryable: false, reason: 'submit_execution_time_invalid' };
  }
  const answerCreatedAt = source.createdAt || createdAt || null;
  const answer = source.onChainAnswer || source.answer;
  let ratingScale = source.ratingScale;
  if (answer?.questionType === 'rating' &&
      !(Number.isFinite(ratingScale?.min) && Number.isFinite(ratingScale?.max))) {
    try {
      // Reuse the chat's canonical lookup without a module-initialization cycle.
      const { loadQuestionsForSession } = await import('./agentSessionRuntime.mjs');
      const loaded = await loadQuestionsForSession(env, source.sessionSlug, { preferredQuestionIds: [source.questionId] });
      const question = (loaded.questions || []).find((entry) =>
        safeString(entry.questionId || entry.id) === source.questionId);
      if (!question) throw new Error('rating_scale_unavailable');
      ratingScale = normalizeAgentRatingScale(question);
    } catch (error) {
      // No upload or chain operation has started; lookup recovery may safely retry.
      return persistQueueOutcome({ env, source, now: executionTime,
        outcome: withRetryExhaustion({ ok: false, retryable: true, reason: 'rating_scale_unavailable', error: safeString(error?.message || error) }, retryPolicy) });
    }
  }
  const session = source.sessionSnapshot || { sessionSlug: source.sessionSlug };
  const principal = normalizeLegacyManagedPrincipal({
    telegramUserId: source.telegramUserId,
    username: source.username,
    languageCode: source.languageCode,
  });
  let account;
  try {
    account = await deriveManagedDemoAccount({
      principal,
      deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
      rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
      lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
      createdAt: answerCreatedAt,
    });
  } catch (error) {
    return persistQueueOutcome({ env, source, now: executionTime,
      outcome: { ok: false, retryable: false, safeToRetry: true, reason: 'managed_account_unavailable', error: safeString(error?.message || error) } });
  }
  let directSubmit;
  let submissionAttemptId = '';
  try {
    directSubmit = await submitAgentResponseOnChain({
      env,
      session,
      account,
      principal,
      questionRef: {
        sessionSlug: source.sessionSlug,
        questionId: source.questionId,
        ratingScale,
      },
      answer,
      idempotencyKey: source.idempotencyKey,
      createdAt: answerCreatedAt,
      now: executionTime,
      contractFactory,
      beforeUpload: async () => {
        const raw = await kv.get(kvKey);
        const latest = raw == null ? null : objectOrNull(safeJsonParse(raw, null));
        if (raw != null && (!latest || !sameQueuedRequest(latest, source))) return { ok: false, replayed: true, retryable: false, reason: 'submit_request_record_changed' };
        if (staleQueueGeneration(latest, source)) return { ok: false, replayed: true, status: latest.status, reason: 'stale_submit_delivery' };
        if (latest && ['direct_submitted', 'direct_submit_failed', 'direct_submit_reconciliation_required'].includes(latest.status)) return replayResult(latest);
        submissionAttemptId = crypto.randomUUID();
        // Admission happens after successful auth. A visible intent blocks an
        // identical re-tap/re-delivery; KV still cannot serialize concurrent reads.
        const intent = {
          ...source, status: 'direct_submit_reconciliation_required',
          canonicalApiRequest: { ...source.canonicalApiRequest, status: 'direct_submit_reconciliation_required' },
          onChain: { ok: false, retryable: false, reconciliationRequired: true, reason: 'submission_in_progress', stage: 'admitted', submissionAttemptId },
          processedAt: executionTime.toISOString(),
        };
        const persisted = await persistAgentSubmitRecord({ env, kvKey, record: intent });
        if (!persisted.ok) throw new Error(persisted.reason || 'submit_intent_write_failed');
        return null;
      },
    });
  } catch (error) {
    directSubmit = {
      ok: false, retryable: false, reconciliationRequired: true,
      reason: 'direct_submit_outcome_unknown', error: safeString(error?.message || error),
    };
  }
  if (directSubmit.replayed) return { ...directSubmit, requestId };
  if (submissionAttemptId) directSubmit = { ...directSubmit, submissionAttemptId };
  return persistQueueOutcome({ env, source, now: executionTime, outcome: withRetryExhaustion(directSubmit, retryPolicy) });
}

export async function processAgentSubmitQueueBatch(batch = {}, env = {}) {
  const messages = Array.isArray(batch.messages) ? batch.messages : [];
  const results = [];
  for (const message of messages) {
    const body = message.body || {};
    if (body.type !== AGENT_SUBMIT_QUEUE_MESSAGE_TYPE || !body.record) {
      message.ack?.();
      results.push({ ok: true, skipped: true, reason: 'unsupported_queue_message' });
      continue;
    }
    if (body.requestId && safeString(body.requestId) !== safeString(body.record.requestId)) {
      message.ack?.();
      results.push({ ok: false, retryable: false, reason: body.persistenceOnly ? 'submit_recovery_record_invalid' : 'submit_request_record_invalid' });
      continue;
    }
    try {
      const policy = queueAttemptPolicy(env, message.attempts);
      const result = body.persistenceOnly === true
        ? await persistRecoveryMessage({ env, body })
        : await processQueuedAgentSubmitRecord({ env, record: body.record, attempts: policy.attempt });
      if (result.retryable === true) {
        message.retry?.({ delaySeconds: Math.min(86400, Math.max(policy.delaySeconds, Number(result.retryAfterSeconds) || 0)) });
        if (body.persistenceOnly === true && policy.attempt >= policy.maxAttempts) console.error(recoveryDiagnostics(body.record, 'submit_recovery_dead_letter_required'));
      }
      else message.ack?.();
      results.push(result);
    } catch (error) {
      message.ack?.();
      results.push({
        ok: false,
        reason: 'telegram_submit_queue_processing_failed',
        error: safeString(error?.message || error),
        retryable: false,
        reconciliationRequired: true,
      });
    }
  }
  return { ok: results.every((result) => result.ok !== false), results };
}
