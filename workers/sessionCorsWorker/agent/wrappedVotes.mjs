import { safeString, lower, safeJsonParse, kvKeySafePart, nowIsoOrCurrent as nowIso, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_ONLY_INSTRUCTIONS_VERSION, AGENT_ONLY_VOTE_EVENT_KV_PREFIX, MAX_BULK_ROWS, voteStateKey, runIdFromBody } from './wrappedCore.mjs';
import { loadWrappedStatements } from './wrappedStatements.mjs';
import { statementMap, requestSummaryHash, canonicalRequestId, findRecentRequest } from './wrappedAnswers.mjs';
import { normalizeAgentMetadata } from './wrappedMetadata.mjs';

export function normalizeVoteRows(rows = [], space = {}, mode = '') {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_BULK_ROWS) {
    return { ok: false, errors: [{ index: -1, reason: 'votes_batch_size_invalid' }] };
  }
  const byStatement = statementMap(space);
  const seen = new Set();
  const accepted = [];
  const errors = [];
  rows.forEach((row, index) => {
    const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
    const statementId = safeString(source.statement_id || source.statementId);
    const statement = byStatement.get(statementId);
    if (!statement) {
      errors.push({ index, statement_id: statementId, reason: 'statement_unknown' });
      return;
    }
    if (source.statement_version !== statement.statement_version) {
      errors.push({ index, statement_id: statementId, reason: 'statement_version_mismatch' });
      return;
    }
    if (seen.has(statementId)) {
      errors.push({ index, statement_id: statementId, reason: 'statement_duplicate' });
      return;
    }
    seen.add(statementId);
    const votes = Number(source.votes ?? source.weight);
    if (!Number.isInteger(votes) || votes === 0) {
      errors.push({ index, statement_id: statementId, reason: 'vote_value_invalid' });
      return;
    }
    if (mode === 'quadratic' && Math.abs(votes) > 10) {
      errors.push({ index, statement_id: statementId, reason: 'quadratic_vote_value_invalid' });
      return;
    }
    accepted.push({ statementId, statement, votes });
  });
  if (errors.length) return { ok: false, errors };
  const budgetUsed = mode === 'quadratic'
    ? accepted.reduce((sum, row) => sum + row.votes * row.votes, 0)
    : accepted.reduce((sum, row) => sum + Math.abs(row.votes), 0);
  if (budgetUsed > 100) {
    return { ok: false, errors: [{ index: -1, reason: 'vote_budget_exceeded', budgetUsed }] };
  }
  return { ok: true, accepted, budgetUsed };
}

export async function loadVoteState({ env = {}, sessionSlug = '', telegramUserId = '', mode = '' } = {}) {
  const key = voteStateKey(sessionSlug, telegramUserId, mode);
  const kv = env?.AGENT_ACTION_KV;
  const parsed = key && kv && typeof kv.get === 'function'
    ? safeJsonParse(await kv.get(key), null)
    : null;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    assertNoSecretShape(parsed, 'Agent-only vote state must not serialize secrets.');
    return {
      ...parsed,
      votes: parsed.votes && typeof parsed.votes === 'object' && !Array.isArray(parsed.votes) ? parsed.votes : {},
      recentRequestIds: Array.isArray(parsed.recentRequestIds) ? parsed.recentRequestIds : [],
    };
  }
  const createdAt = nowIso();
  return {
    type: 'telegram_agent_only_vote_state',
    version: 1,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    telegramUserId: safeString(telegramUserId),
    mode: lower(mode),
    source: 'agent_autofill',
    votes: {},
    budgetUsed: 0,
    recentRequestIds: [],
    createdAt,
    updatedAt: createdAt,
  };
}

export async function submitAgentOnlyTokenVotesBulk({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  body = {},
  now = null,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug || body.sessionSlug);
  const mode = lower(body.mode);
  if (!['linear', 'quadratic'].includes(mode)) return { ok: false, status: 400, reason: 'vote_mode_invalid' };
  const runId = runIdFromBody(body);
  if (!runId) return { ok: false, status: 400, reason: 'agent_only_run_id_required' };
  const materialized = await loadWrappedStatements({ env, sessionSlug: slug });
  if (!materialized.ok) return materialized;
  const metadata = normalizeAgentMetadata(body.agent_metadata || body.agentMetadata);
  if (!metadata.ok) return { ok: false, status: 400, reason: metadata.reason };
  const validated = normalizeVoteRows(body.votes, materialized.space, mode);
  if (!validated.ok) {
    return { ok: false, status: 400, reason: 'agent_only_votes_invalid', errors: validated.errors };
  }
  const requestBody = {
    run_id: runId,
    mode,
    agent_metadata: metadata.value,
    votes: validated.accepted,
  };
  const requestId = await canonicalRequestId(`votes:${mode}`, requestBody, body.request_id || body.requestId);
  const summaryHash = await requestSummaryHash(`votes:${mode}`, requestBody);
  const state = await loadVoteState({ env, sessionSlug: slug, telegramUserId, mode });
  const response = {
    ok: true,
    mode,
    budgetUsed: validated.budgetUsed,
    replay: false,
  };
  const replay = findRecentRequest(state, requestId);
  if (replay) {
    if (safeString(replay.summaryHash) !== summaryHash) {
      return { ok: false, status: 409, reason: 'request_id_conflict' };
    }
    return { ...response, replay: true };
  }
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') {
    return { ok: false, status: 500, reason: 'agent_only_vote_storage_unavailable' };
  }
  const createdAt = nowIso(now);
  const userPart = kvKeySafePart(telegramUserId);
  // One key per request: a retry after a rejected state write finds its event.
  const eventKey = `${AGENT_ONLY_VOTE_EVENT_KV_PREFIX}${slug}:${userPart}:${mode}:${kvKeySafePart(requestId)}`;
  const votes = Object.fromEntries(validated.accepted.map((row) => [row.statementId, row.votes]));
  const statements = Object.fromEntries(validated.accepted.map(row => [row.statementId, row.statement]));
  const event = {
    type: 'telegram_agent_only_vote_event',
    version: 1,
    sessionSlug: slug,
    telegramUserId: safeString(telegramUserId),
    mode,
    source: 'agent_autofill',
    votes,
    statements,
    budgetUsed: validated.budgetUsed,
    agentMetadata: metadata.value,
    instructionsVersion: AGENT_ONLY_INSTRUCTIONS_VERSION,
    runId,
    requestId,
    createdAt,
  };
  assertNoSecretShape(event, 'Agent-only vote events must not serialize secrets.');
  if (!env.AGENT_SERVICES?.commitWrappedResearch) return { ok: false, status: 503, reason: 'wrapped_coordinator_unavailable', retryable: true };
  return env.AGENT_SERVICES.commitWrappedResearch({ kind: 'votes', mode, subjectId: safeString(telegramUserId), requestId,
    summaryHash, createdAt, initialState: state, response,
    events: [{ key: eventKey, value: event, metadata: { v: 1, t: 'ao_vote_evt', sg: slug, m: mode === 'linear' ? 'l' : 'q', u: validated.budgetUsed } }],
    changes: { votes, statements, budgetUsed: validated.budgetUsed, runId, requestId },
    stateMetadata: { v: 1, t: 'ao_vote', sg: slug, m: mode === 'linear' ? 'l' : 'q', u: validated.budgetUsed } });
}
