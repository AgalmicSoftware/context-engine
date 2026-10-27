import { assertExpectedSessionAuthority } from '../sessionConfigAuthority.js';
import { resolveCanonicalWorkerSessionIdHex } from '../sessionConfigMutation.js';
import { createAgentStorage } from './storage.mjs';
import { answerStateKey, voteStateKey, MAX_RECENT_REQUEST_IDS } from './wrappedCore.mjs';
import { sha256Hex, safeJsonParse } from './runtimePrimitives.mjs';

const reply = (body, status = 200) => Response.json(body, { status });
const busy = () => reply({ ok: false, status: 503, reason: 'wrapped_storage_busy', retryable: true, retryAfterSeconds: 1 }, 503);

// The coordinator binds a request before its first KV write. KV holds the
// readable projection; a failed projection never admits changed retry bytes or
// lets a second batch rebuild the summary from a stale KV read. No timer waits
// inside the lock: the caller retries after at least one second.
export const dispatchWrappedResearch = (coordinator, payload) => coordinator.serializeSessionConfigOperation(async () => {
  const record = payload?.record;
  if (!record || !['answers', 'votes'].includes(record.kind) ||
      record.sessionSlug !== payload.slug || typeof record.subjectId !== 'string' || !record.subjectId || record.subjectId.length > 256 ||
      typeof record.requestId !== 'string' || !record.requestId || record.requestId.length > 160 ||
      !/^[a-f0-9]{64}$/.test(record.summaryHash || '') ||
      !Array.isArray(record.events) || record.events.length < 1 || record.events.length > 50 ||
      record.kind === 'votes' && !['linear', 'quadratic'].includes(record.mode)) {
    return reply({ ok: false, reason: 'wrapped_request_invalid' }, 400);
  }
  const authority = await coordinator.readSessionConfigAuthority(payload.slug);
  assertExpectedSessionAuthority(authority, payload.expectedAuthority, payload.slug);
  if (resolveCanonicalWorkerSessionIdHex(authority?.config) !== record.sessionId) {
    return reply({ ok: false, reason: 'wrapped_session_mismatch' }, 409);
  }
  const kv = createAgentStorage({ kv: coordinator.env.GROUP_KV, sessionId: record.sessionId, cursorSecret: coordinator.env.TOKEN_HMAC_SECRET });
  const storage = coordinator.state.storage;
  const stateKey = record.kind === 'answers' ? answerStateKey(record.sessionSlug, record.subjectId)
    : voteStateKey(record.sessionSlug, record.subjectId, record.mode);
  const namespace = `ce-agent-wrapped:${record.sessionId}:${await sha256Hex(stateKey)}`;
  const durableStateKey = `${namespace}:state`;
  const requestKey = `${namespace}:request:${await sha256Hex(record.requestId)}`;
  const existing = await storage.get(requestKey);
  if (existing && existing.summaryHash !== record.summaryHash) return reply({ ok: false, status: 409, reason: 'request_id_conflict' }, 409);
  if (existing?.complete) return reply({ ...existing.response, replay: true });
  let state = await storage.get(durableStateKey);
  if (!state) state = { value: safeJsonParse(await kv.get(stateKey), null), notBeforeMs: 0, pending: null };
  const now = Number(coordinator.now());

  const project = async () => {
    if (now < state.notBeforeMs) return false;
    const pending = await storage.get(state.pending);
    if (!pending) throw new Error('wrapped_pending_request_missing');
    state.notBeforeMs = now + 1000;
    await storage.put(durableStateKey, state);
    try {
      for (const event of pending.events) {
        const serialized = JSON.stringify(event.value);
        const saved = await kv.get(event.key);
        if (saved && saved !== serialized) throw new Error('wrapped_event_conflict');
        if (!saved) await kv.put(event.key, serialized, { metadata: event.metadata });
      }
      await kv.put(stateKey, JSON.stringify(state.value), { metadata: pending.stateMetadata });
    } catch { return false; }
    await storage.transaction(async tx => {
      await tx.put(state.pending, { summaryHash: pending.summaryHash, response: pending.response, complete: true });
      state.pending = null;
      await tx.put(durableStateKey, state);
    });
    return true;
  };
  if (state.pending) {
    if (!await project()) return busy();
    if (existing) return reply({ ...existing.response, replay: true });
  }
  if (now < state.notBeforeMs) return busy();
  const base = state.value || record.initialState;
  if (!base || !record.changes || typeof record.changes !== 'object') return reply({ ok: false, reason: 'wrapped_state_invalid' }, 400);
  let value;
  if (record.kind === 'answers') {
    const byStatement = { ...base.byStatement };
    for (const [id, change] of Object.entries(record.changes)) {
      byStatement[id] = { ...byStatement[id], agent: change.agent, agentSkip: change.agentSkip };
    }
    const counts = { answers: 0, skips: 0 };
    for (const entry of Object.values(byStatement)) {
      if (entry.agent) counts.answers++;
      if (entry.agentSkip) counts.skips++;
    }
    value = { ...base, byStatement, counts, updatedAt: record.createdAt };
  } else value = { ...base, ...record.changes, updatedAt: record.createdAt };
  value.recentRequestIds = [...(base.recentRequestIds || []).filter(entry => entry.requestId !== record.requestId),
    { requestId: record.requestId, summaryHash: record.summaryHash, at: record.createdAt }].slice(-MAX_RECENT_REQUEST_IDS);
  const pending = { summaryHash: record.summaryHash, events: record.events, stateMetadata: record.stateMetadata,
    response: record.response, complete: false };
  if (record.kind === 'answers') pending.stateMetadata = { ...pending.stateMetadata, a: value.counts.answers, s: value.counts.skips };
  state = { ...state, value, pending: requestKey };
  await storage.transaction(async tx => {
    await tx.put(requestKey, pending);
    await tx.put(durableStateKey, state);
  });
  return await project() ? reply(record.response) : busy();
});
