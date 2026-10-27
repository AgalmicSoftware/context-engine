import { safeString, safeJsonParse, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { SUBMIT_REQUEST_USER_KV_PREFIX } from './agentSubmitQueue.mjs';
import { ADMIN_METRICS_SUBMIT_ENTRY_LIMIT, ANSWER_DRAFT_KV_PREFIX } from './httpConstants.mjs';

export async function listMetricKvEntriesByPrefix(env = {}, prefix = '', { limit = 10000 } = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!prefix || !kv || typeof kv.list !== 'function') return [];
  const maxEntries = Math.max(1, Math.min(ADMIN_METRICS_SUBMIT_ENTRY_LIMIT, Number(limit) || 10000));
  const pageLimit = Math.min(1000, maxEntries);
  const entries = [];
  let cursor = undefined;
  do {
    const page = await kv
      .list({
        prefix,
        limit: pageLimit,
        ...(cursor ? { cursor } : {}),
      })
      .catch(() => null);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      const key = safeString(entry?.name || entry);
      if (!key) continue;
      entries.push({
        key,
        metadata: entry && typeof entry === 'object' && !Array.isArray(entry) ? entry.metadata || null : null,
      });
      if (entries.length >= maxEntries) return entries;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return entries;
}

export async function readMetricRecord(env = {}, key = '') {
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return null;
  const record = safeJsonParse(await kv.get(key).catch(() => null), null);
  return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
}

export async function listHandoffKvRecordsByPrefix(env = {}, prefix = '', { limit = 10000 } = {}) {
  const entries = await listMetricKvEntriesByPrefix(env, prefix, { limit });
  const records = [];
  for (const entry of entries) {
    const record = await readMetricRecord(env, entry.key);
    if (record) records.push({ ...record, key: entry.key });
  }
  return records;
}

export function dedupeSubmitRecordsByRequestId(records = []) {
  const byId = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const requestId = safeString(record?.requestId || record?.idempotencyKey || record?.key);
    if (!requestId) return;
    const existing = byId.get(requestId);
    if (!existing || safeString(existing.createdAt).localeCompare(safeString(record.createdAt)) <= 0) {
      byId.set(requestId, record);
    }
  });
  return Array.from(byId.values());
}

export function sessionFromSessionFirstKey(key = '', prefix = '') {
  const rest = safeString(key).startsWith(prefix) ? safeString(key).slice(prefix.length) : '';
  return sanitizeSessionSlug(rest.split(':')[0]);
}

export function sessionFromDraftKey(key = '') {
  const rest = safeString(key).startsWith(ANSWER_DRAFT_KV_PREFIX)
    ? safeString(key).slice(ANSWER_DRAFT_KV_PREFIX.length)
    : '';
  return sanitizeSessionSlug(rest.split(':')[1]);
}

export function userFromSubmitUserKey(key = '') {
  const rest = safeString(key).startsWith(SUBMIT_REQUEST_USER_KV_PREFIX)
    ? safeString(key).slice(SUBMIT_REQUEST_USER_KV_PREFIX.length)
    : '';
  const [sessionSlug, telegramUserId] = rest.split(':');
  return {
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    telegramUserId: safeString(telegramUserId),
  };
}

export function emptyAdminMetricTotals() {
  return {
    agentsOnboarded: 0,
    distinctUsersOnboarded: 0,
    questionsCreated: 0,
    questionsAnswered: 0,
    answerDrafts: 0,
    answerDraftsEdited: 0,
    agentDraftedAnswers: 0,
    draftEditMetrics: 0,
    groupProposals: 0,
    sessionsWithBridgeActivity: 0,
    registrySessionCount: 0,
    distinctRespondents: 0,
  };
}

export function incrementMetric(perSession = new Map(), sessionSlug = '', field = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!slug || !field) return;
  const current = perSession.get(slug) || {
    sessionSlug: slug,
    ...emptyAdminMetricTotals(),
    _usersOnboarded: new Set(),
    _respondents: new Set(),
  };
  current[field] = Number(current[field] || 0) + 1;
  perSession.set(slug, current);
}

export function sessionMetric(perSession = new Map(), sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!slug) return null;
  const current = perSession.get(slug) || {
    sessionSlug: slug,
    ...emptyAdminMetricTotals(),
    _usersOnboarded: new Set(),
    _respondents: new Set(),
  };
  perSession.set(slug, current);
  return current;
}

export function publicSessionMetric(metric = {}) {
  const out = {
    sessionSlug: sanitizeSessionSlug(metric.sessionSlug),
    agentsOnboarded: Number(metric.agentsOnboarded || 0),
    distinctUsersOnboarded:
      metric._usersOnboarded instanceof Set ? metric._usersOnboarded.size : Number(metric.distinctUsersOnboarded || 0),
    questionsCreated: Number(metric.questionsCreated || 0),
    questionsAnswered: Number(metric.questionsAnswered || 0),
    answerDrafts: Number(metric.answerDrafts || 0),
    answerDraftsEdited: Number(metric.answerDraftsEdited || 0),
    agentDraftedAnswers: Number(metric.agentDraftedAnswers || 0),
    draftEditMetrics: Number(metric.draftEditMetrics || 0),
    groupProposals: Number(metric.groupProposals || 0),
    sessionsWithBridgeActivity: 0,
    registrySessionCount: Number(metric.registrySessionCount || 0),
    distinctRespondents:
      metric._respondents instanceof Set ? metric._respondents.size : Number(metric.distinctRespondents || 0),
  };
  out.sessionsWithBridgeActivity = [
    out.agentsOnboarded,
    out.questionsCreated,
    out.questionsAnswered,
    out.answerDrafts,
    out.answerDraftsEdited,
    out.agentDraftedAnswers,
    out.draftEditMetrics,
    out.groupProposals,
  ].some((count) => count > 0)
    ? 1
    : 0;
  return out;
}
