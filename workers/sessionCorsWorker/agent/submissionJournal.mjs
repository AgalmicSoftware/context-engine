import { buildOpaqueActionId } from './opaqueActions.mjs';
import { resolveCanonicalWorkerSessionIdHex } from '../sessionConfigMutation.js';
import { assertExpectedSessionAuthority } from '../sessionConfigAuthority.js';
import { createAgentStorage } from './storage.mjs';
import { persistAgentSubmitRecord } from './agentSubmitQueue.mjs';
import { sha256Hex, stableJson } from './runtimePrimitives.mjs';

const PROJECTION_PREFIX = 'ce-agent-submit-projection:';
const reply = (body, status = 200) => Response.json(body, { status });
const sameRequest = (a, b) => ['sessionId', 'sessionSlug', 'workerOrigin', 'accountAddress', 'principalId', 'questionId', 'idempotencyKey', 'requestId']
  .every(key => a[key] === b[key]);
const journalRecord = stored => {
  if (!stored) return null;
  const { kvProjection: _projection, ...record } = stored;
  return record;
};

export async function nextAgentSubmitProjectionAt(coordinator) {
  const pending = await coordinator.state.storage.list({ prefix: PROJECTION_PREFIX });
  let next = Infinity;
  for (const value of pending.values()) next = Math.min(next, value.notBeforeMs);
  return next;
}

async function scheduleProjectionRepair(coordinator) {
  const nextAt = await nextAgentSubmitProjectionAt(coordinator);
  if (!Number.isFinite(nextAt) || typeof coordinator.state.storage.setAlarm !== 'function') return;
  const current = await coordinator.state.storage.getAlarm?.();
  if (!current || current <= Number(coordinator.now()) || current > nextAt) await coordinator.state.storage.setAlarm(nextAt);
}

async function projectOutcome(coordinator, key, stored) {
  const record = journalRecord(stored);
  const projectionKey = `${PROJECTION_PREFIX}${record.sessionId}:${record.requestId}`;
  const digest = await sha256Hex(stableJson(record));
  const previous = stored.kvProjection || {};
  if (previous.digest === digest && previous.pending !== true) return;
  const now = Number(coordinator.now());
  let notBeforeMs = Number(previous.notBeforeMs) || now;
  const pending = { digest, pending: true, notBeforeMs };
  // Commit the outcome and its repair marker together before touching KV. A
  // partial projection is disposable; it must never turn a saved effect into a
  // failed submission, or be retried within KV's one-write-per-key interval.
  await coordinator.state.storage.transaction(async storage => {
    await storage.put(key, { ...record, kvProjection: pending });
    await storage.put(projectionKey, { key, notBeforeMs });
  });
  if (now < notBeforeMs) { await scheduleProjectionRepair(coordinator); return; }
  notBeforeMs = now + 1000;
  await coordinator.state.storage.transaction(async storage => {
    await storage.put(key, { ...record, kvProjection: { ...pending, notBeforeMs } });
    await storage.put(projectionKey, { key, notBeforeMs });
  });
  // Arm repair before KV: an isolate reset mid-write must not strand the marker.
  await scheduleProjectionRepair(coordinator);
  try {
    const kv = createAgentStorage({ kv: coordinator.env.GROUP_KV, sessionId: record.sessionId, cursorSecret: coordinator.env.TOKEN_HMAC_SECRET });
    const persisted = await persistAgentSubmitRecord({ env: { AGENT_ACTION_KV: kv }, record });
    if (!persisted.ok) throw new Error(persisted.reason);
  } catch {
    notBeforeMs = Number(coordinator.now()) + 1000;
    await coordinator.state.storage.transaction(async storage => {
      await storage.put(key, { ...record, kvProjection: { ...pending, notBeforeMs } });
      await storage.put(projectionKey, { key, notBeforeMs });
    });
    await scheduleProjectionRepair(coordinator);
    return;
  }
  notBeforeMs = Number(coordinator.now()) + 1000;
  await coordinator.state.storage.transaction(async storage => {
    await storage.put(key, { ...record, kvProjection: { digest, pending: false, notBeforeMs } });
    await storage.delete(projectionKey);
  });
}

export async function repairAgentSubmitProjections(coordinator) {
  const pending = await coordinator.state.storage.list({ prefix: PROJECTION_PREFIX });
  for (const [projectionKey, value] of pending) {
    if (value.notBeforeMs > Number(coordinator.now())) continue;
    await coordinator.serializeSessionConfigOperation(async () => {
      const stored = await coordinator.state.storage.get(value.key);
      if (stored) await projectOutcome(coordinator, value.key, stored);
      else await coordinator.state.storage.delete(projectionKey);
    });
  }
  await scheduleProjectionRepair(coordinator);
}

// Admission lives only in the coordinator. KV indexes project the finished
// outcome once; replays read this journal even if that projection is delayed.
export const dispatchAgentSubmissionJournal = (coordinator, operation, payload) => coordinator.serializeSessionConfigOperation(async () => {
  const record = payload?.record;
  if (operation === 'claim') {
    if (!record || record.sessionSlug !== payload.slug ||
        ['principalId', 'questionId', 'transport', 'contentDigest'].some(key => typeof record[key] !== 'string' || !record[key])) {
      return reply({ ok: false, reason: 'submit_journal_record_invalid' }, 400);
    }
    const authority = await coordinator.readSessionConfigAuthority(payload.slug);
    if (resolveCanonicalWorkerSessionIdHex(authority?.config) !== record.sessionId) return reply({ ok: false, reason: 'submit_journal_session_mismatch' }, 409);
    const key = `ce-agent-answer-head:${record.sessionId}:${await sha256Hex(stableJson([record.principalId, record.questionId]))}`;
    const head = await coordinator.state.storage.get(key);
    // A retry retains its identity even after authority changes. Different
    // content claims a new revision before either direct or queued effects.
    if (head?.contentDigest === record.contentDigest) return reply({ ok: true, head });
    assertExpectedSessionAuthority(authority, payload.expectedAuthority, payload.slug);
    const revision = (head?.revision || 0) + 1;
    if (!Number.isSafeInteger(revision)) return reply({ ok: false, reason: 'submit_revision_exhausted' }, 409);
    const idempotencyKey = buildOpaqueActionId(await sha256Hex(stableJson([record.transport, record.principalId, record.sessionId, record.questionId, revision])));
    const next = { revision, contentDigest: record.contentDigest, requestId: buildOpaqueActionId(idempotencyKey), idempotencyKey };
    await coordinator.state.storage.put(key, next);
    return reply({ ok: true, head: next });
  }
  if (!['begin', 'finish', 'read'].includes(operation) || !record || !/^[A-Za-z0-9_-]{1,160}$/.test(record.requestId || '') ||
      !record.idempotencyKey || record.sessionSlug !== payload.slug || (operation !== 'read' && !record.onChain?.submissionAttemptId)) {
    return reply({ ok: false, reason: 'submit_journal_record_invalid' }, 400);
  }
  const authority = await coordinator.readSessionConfigAuthority(payload.slug);
  if (resolveCanonicalWorkerSessionIdHex(authority?.config) !== record.sessionId) return reply({ ok: false, reason: 'submit_journal_session_mismatch' }, 409);
  const key = `ce-agent-submit:${record.sessionId}:${record.requestId}`;
  const stored = await coordinator.state.storage.get(key);
  const existing = journalRecord(stored);
  if (existing && !sameRequest(existing, record)) return reply({ ok: false, reason: 'submit_journal_request_mismatch' }, 409);
  let next = record;
  let replayed = false;
  if (operation === 'read') {
    if (!existing) return reply({ ok: true, record: null });
    next = existing; replayed = true;
  } else if (operation === 'begin') {
    assertExpectedSessionAuthority(authority, payload.expectedAuthority, payload.slug);
    if (existing && (existing.status === 'direct_submitted' || existing.onChain?.safeToRetry !== true)) {
      next = existing; replayed = true;
    } else if (existing?.status === 'direct_submit_in_progress') {
      // Hosted receipt replay is safe, but must reuse the first admitted bytes.
      next = existing;
    } else if (existing) next = { ...record, createdAt: existing.createdAt, draftProvenance: existing.draftProvenance, responsePayload: existing.responsePayload,
      onChain: { ...record.onChain, ...(existing.onChain?.storageId ? { storageId: existing.onChain.storageId, storageRef: existing.onChain.storageRef } : {}) } };
  } else {
    if (!existing) return reply({ ok: false, reason: 'submit_intent_missing' }, 409);
    if (!['direct_submitted', 'direct_submit_failed', 'direct_submit_reconciliation_required'].includes(record.status)) return reply({ ok: false, reason: 'submit_journal_outcome_invalid' }, 400);
    if (existing.status === 'direct_submitted' || record.onChain.safeToRetry === true &&
        existing.onChain?.submissionAttemptId !== record.onChain.submissionAttemptId) {
      next = existing; replayed = true;
    } else next = { ...record, createdAt: existing.createdAt, draftProvenance: existing.draftProvenance, responsePayload: existing.responsePayload,
      onChain: { ...record.onChain, ...(existing.onChain?.storageId && !record.onChain?.storageId ? { storageId: existing.onChain.storageId, storageRef: existing.onChain.storageRef } : {}) } };
  }
  if (operation === 'begin' && !replayed) {
    next = { ...next, admissionComplete: true };
    await coordinator.state.storage.transaction(async storage => {
      await storage.put(key, { ...next, kvProjection: { ...stored?.kvProjection, pending: false } });
      await storage.delete(`${PROJECTION_PREFIX}${record.sessionId}:${record.requestId}`);
    });
  } else if (operation === 'finish' || stored?.kvProjection?.pending) {
    // A changed gate or revision after effects cannot erase an admitted outcome.
    await projectOutcome(coordinator, key, { ...next, kvProjection: stored?.kvProjection });
  }
  return reply({ ok: true, record: next, replayed, previousOutcome: existing?.onChain || null });
});
