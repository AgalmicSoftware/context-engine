import { safeString, lower, kvKeySafePart, nowIsoOrCurrent as nowIso, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_ONLY_ATTEMPT_EVENT_KV_PREFIX, normalizeAgentOnlyRunId, runIdFromBody } from './wrappedCore.mjs';
import { eventId } from './wrappedAnswers.mjs';

export function attemptEventPrefix(sessionSlug = '', userPart = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  const user = safeString(userPart);
  return slug && user ? `${AGENT_ONLY_ATTEMPT_EVENT_KV_PREFIX}${slug}:${user}:` : '';
}

export function normalizeAttemptStage(value = '') {
  return lower(value).replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'unknown';
}

export function attemptReasonFromResult(result = {}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return '';
  const direct = safeString(result.reason);
  if (direct) return direct.slice(0, 120);
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const firstErrorReason = safeString(errors.find((error) => error && typeof error === 'object')?.reason);
  return firstErrorReason.slice(0, 120);
}

export function attemptCountsFromResult(result = {}) {
  const source = result && typeof result === 'object' && !Array.isArray(result) ? result : {};
  return {
    accepted: Number.isFinite(Number(source.accepted)) ? Number(source.accepted) : null,
    skipsRecorded: Number.isFinite(Number(source.skipsRecorded)) ? Number(source.skipsRecorded) : null,
    budgetUsed: Number.isFinite(Number(source.budgetUsed)) ? Number(source.budgetUsed) : null,
    statementCount: Number.isFinite(Number(source.statement_count)) ? Number(source.statement_count) : null,
    agentPredictionCount: Number.isFinite(Number(source.agent_prediction_count)) ? Number(source.agent_prediction_count) : null,
    agentResponseCount: Number.isFinite(Number(source.agent_response_count)) ? Number(source.agent_response_count) : null,
    privacySkipCount: Number.isFinite(Number(source.privacy_skip_count)) ? Number(source.privacy_skip_count) : null,
  };
}

export async function recordAgentOnlyAttemptEvent({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  stage = '',
  status = 0,
  result = {},
  body = {},
  now = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'agent_only_attempt_storage_unavailable' };
  const slug = sanitizeSessionSlug(sessionSlug || body.sessionSlug);
  const userPart = kvKeySafePart(telegramUserId);
  const prefix = attemptEventPrefix(slug, userPart);
  if (!prefix) return { ok: false, reason: 'agent_only_attempt_scope_missing' };
  const httpStatus = Math.trunc(Number(status) || 0);
  const ok = result?.ok === false ? false : httpStatus >= 200 && httpStatus < 400;
  const normalizedStage = normalizeAttemptStage(stage);
  const reason = attemptReasonFromResult(result);
  const record = {
    type: 'telegram_agent_only_attempt_event',
    version: 1,
    sessionSlug: slug,
    telegramUserId: safeString(telegramUserId),
    stage: normalizedStage,
    ok,
    status: httpStatus,
    reason,
    runId: normalizeAgentOnlyRunId(result?.run_id || result?.runId || runIdFromBody(body)),
    mode: lower(result?.mode || body.mode || body.image_mode || body.imageMode),
    requestId: safeString(result?.request_id || result?.requestId || body.request_id || body.requestId),
    replay: result.replay === true,
    counts: attemptCountsFromResult(result),
    createdAt: nowIso(now),
  };
  assertNoSecretShape(record, 'Agent-only attempt events must not serialize secrets.');
  const key = `${prefix}${eventId()}`;
  await kv.put(key, JSON.stringify(record), {
    metadata: {
      v: 1,
      t: 'ao_attempt',
      sg: slug,
      st: normalizedStage.slice(0, 16),
      ok: ok ? 1 : 0,
      r: reason.slice(0, 48),
    },
  });
  return { ok: true, key };
}

export async function recordAgentOnlyAttemptEventQuietly(args = {}) {
  try {
    return await recordAgentOnlyAttemptEvent(args);
  } catch {
    return { ok: false, reason: 'agent_only_attempt_record_failed' };
  }
}
