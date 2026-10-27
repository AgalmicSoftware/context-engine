import { safeString, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { AGENT_ONLY_MODE_CONFIG_KV_PREFIX, AGENT_ONLY_ANSWER_STATE_KV_PREFIX, AGENT_ONLY_VOTE_STATE_KV_PREFIX, answerStatePrefix, principalPartFromAnswerStateKey, voteStatePrefix } from './wrappedCore.mjs';

export async function listKvEntriesByPrefix(env = {}, prefix = '', limit = 100000) {
  const kv = env?.AGENT_ACTION_KV;
  if (!prefix || !kv || typeof kv.list !== 'function') return [];
  const entries = [];
  let cursor = '';
  do {
    const page = await kv.list({ prefix, limit: Math.min(1000, limit - entries.length), ...(cursor ? { cursor } : {}) });
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      entries.push({
        key: safeString(entry?.name || entry),
        metadata: entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry.metadata || null) : null,
      });
      if (entries.length >= limit) return entries;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return entries;
}

export async function listKvEntriesPageByPrefix(env = {}, prefix = '', {
  limit = 250,
  cursor = '',
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!prefix || !kv || typeof kv.list !== 'function') return { entries: [], nextCursor: '' };
  const pageLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit)) || 250));
  const page = await kv.list({
    prefix,
    limit: pageLimit,
    ...(safeString(cursor) ? { cursor: safeString(cursor) } : {}),
  });
  const keys = Array.isArray(page?.keys) ? page.keys : [];
  return {
    entries: keys.map((entry) => ({
      key: safeString(entry?.name || entry),
      metadata: entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry.metadata || null) : null,
    })),
    nextCursor: page?.list_complete === false ? safeString(page.cursor) : '',
  };
}

export function sessionFromKey(key = '', prefix = '') {
  return sanitizeSessionSlug(safeString(key).slice(prefix.length).split(':')[0]);
}

export async function buildAgentOnlyMetrics({
  env = {},
  scope = 'session',
  sessionSlug = '',
  visibleSessionSlugs = null,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const visible = visibleSessionSlugs instanceof Set ? visibleSessionSlugs : null;
  const inScope = (candidate = '') => {
    const value = sanitizeSessionSlug(candidate);
    if (!value) return false;
    if (scope === 'session') return value === slug;
    if (visible) return visible.has(value);
    return true;
  };
  const totals = {
    responsesSubmitted: 0,
    privacySkips: 0,
    distinctPrincipals: 0,
    voteAllocations: 0,
    voteBudgetUsed: 0,
    flaggedStatementCount: 0,
  };
  const principals = new Set();
  const answerEntries = await listKvEntriesByPrefix(env, scope === 'session' ? answerStatePrefix(slug) : AGENT_ONLY_ANSWER_STATE_KV_PREFIX);
  for (const entry of answerEntries) {
    const meta = entry.metadata || {};
    const entrySlug = sanitizeSessionSlug(meta.sg) || sessionFromKey(entry.key, AGENT_ONLY_ANSWER_STATE_KV_PREFIX);
    if (!inScope(entrySlug)) continue;
    const answers = Number(meta.a) || 0;
    const skips = Number(meta.s) || 0;
    totals.responsesSubmitted += answers;
    totals.privacySkips += skips;
    principals.add(principalPartFromAnswerStateKey(entry.key) || entry.key);

  }
  const voteEntries = await listKvEntriesByPrefix(env, scope === 'session' ? voteStatePrefix(slug) : AGENT_ONLY_VOTE_STATE_KV_PREFIX);
  for (const entry of voteEntries) {
    const meta = entry.metadata || {};
    const entrySlug = sanitizeSessionSlug(meta.sg) || sessionFromKey(entry.key, AGENT_ONLY_VOTE_STATE_KV_PREFIX);
    if (!inScope(entrySlug)) continue;
    const budget = Number(meta.u) || 0;
    totals.voteAllocations += 1;
    totals.voteBudgetUsed += budget;

  }
  const configEntries = await listKvEntriesByPrefix(env, scope === 'session' ? `${AGENT_ONLY_MODE_CONFIG_KV_PREFIX}${slug}` : AGENT_ONLY_MODE_CONFIG_KV_PREFIX);
  for (const entry of configEntries) {
    const meta = entry.metadata || {};
    const entrySlug = sanitizeSessionSlug(meta.sg) || sessionFromKey(entry.key, AGENT_ONLY_MODE_CONFIG_KV_PREFIX);
    if (!inScope(entrySlug)) continue;
    const count = Number(meta.q) || 0;
    totals.flaggedStatementCount += count;
  }
  totals.distinctPrincipals = principals.size;
  return totals;
}
