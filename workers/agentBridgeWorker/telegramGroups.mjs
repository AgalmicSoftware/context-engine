import { assertNoSecretShape } from './redaction.mjs';

export const TELEGRAM_LIGHTWEIGHT_GROUPS_KV_PREFIX = 'telegram:lightweight-groups:';
export const TELEGRAM_LIGHTWEIGHT_GROUP_MEMBERSHIP_KV_PREFIX = 'telegram:lightweight-group-membership:';
export const TELEGRAM_LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX = 'telegram:lightweight-group-proposal:';
export const TELEGRAM_CHILD_SESSION_KV_PREFIX = 'telegram:child-session:';

const DEFAULT_TELEGRAM_GROUP_CATEGORIES = Object.freeze([
  {
    categoryId: 'age_bucket',
    label: 'Age',
    description: 'Optional age bucket for aggregate comparisons.',
    selectionMode: 'single',
    options: [
      { optionId: '18_24', label: '18-24' },
      { optionId: '25_34', label: '25-34' },
      { optionId: '35_44', label: '35-44' },
      { optionId: '45_54', label: '45-54' },
      { optionId: '55_plus', label: '55+' },
      { optionId: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  {
    categoryId: 'country_relationship',
    label: 'Country',
    description: 'How you relate to the place being discussed.',
    selectionMode: 'multi',
    options: [
      { optionId: 'live_in', label: 'Live in' },
      { optionId: 'citizen_of', label: 'Citizen of' },
      { optionId: 'visitor', label: 'Visitor' },
      { optionId: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  {
    categoryId: 'ai_tribe',
    label: 'AI tribe',
    description: 'Optional self-description for AI governance discussion.',
    selectionMode: 'single',
    options: [
      { optionId: 'e_acc', label: 'e/acc' },
      { optionId: 'd_acc', label: 'd/acc' },
      { optionId: 'pause_ai', label: 'Pause AI' },
      { optionId: 'pluralist_mixed', label: 'Pluralist / mixed' },
      { optionId: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  {
    categoryId: 'contribution_role',
    label: 'Role',
    description: 'Optional role context for group summaries.',
    selectionMode: 'multi',
    options: [
      { optionId: 'builder', label: 'Builder' },
      { optionId: 'researcher', label: 'Researcher' },
      { optionId: 'founder_operator', label: 'Founder / operator' },
      { optionId: 'artist_designer', label: 'Artist / designer' },
      { optionId: 'community_host', label: 'Community host' },
      { optionId: 'other', label: 'Other' },
    ],
  },
]);

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
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

function sanitizeGroupId(value = '', fallback = '') {
  const normalized = lower(value)
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function stableFingerprint(value = {}) {
  const input = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(10, '0');
}

function groupConfigKey(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${TELEGRAM_LIGHTWEIGHT_GROUPS_KV_PREFIX}${slug}` : '';
}

function membershipKey({ sessionSlug = '', telegramUserId = '' } = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const userId = safeString(telegramUserId);
  return slug && userId ? `${TELEGRAM_LIGHTWEIGHT_GROUP_MEMBERSHIP_KV_PREFIX}${slug}:${userId}` : '';
}

function proposalPrefix(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${TELEGRAM_LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX}${slug}:` : '';
}

function childSessionKey(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${TELEGRAM_CHILD_SESSION_KV_PREFIX}${slug}` : '';
}

function cloneCategory(category = {}) {
  return {
    ...category,
    options: (Array.isArray(category.options) ? category.options : []).map((option) => ({ ...option })),
  };
}

function normalizeGroupOption(input = {}, index = 0) {
  const source = typeof input === 'string' ? { label: input } : input;
  const label = safeString(source.label || source.name || source.title || source.optionId || source.id);
  const optionId = sanitizeGroupId(source.optionId || source.id || source.slug || label, `option_${index + 1}`);
  if (!optionId || !label) return null;
  return {
    optionId,
    label,
    description: safeString(source.description || source.summary) || null,
  };
}

export function normalizeTelegramGroupCategory(input = {}, index = 0) {
  const label = safeString(input.label || input.name || input.title || input.categoryId || input.id);
  const categoryId = sanitizeGroupId(input.categoryId || input.id || input.slug || label, `category_${index + 1}`);
  const selectionMode = lower(input.selectionMode || input.mode || (input.multiSelect === true ? 'multi' : 'single'));
  const options = (Array.isArray(input.options) ? input.options : [])
    .map(normalizeGroupOption)
    .filter(Boolean);
  if (!categoryId || !label || !options.length) return null;
  return {
    categoryId,
    label,
    description: safeString(input.description || input.summary) || null,
    selectionMode: selectionMode === 'multi' || selectionMode === 'multiple' ? 'multi' : 'single',
    options,
    source: safeString(input.source) || 'session_policy',
  };
}

export function normalizeTelegramGroupCategories(categories = []) {
  return (Array.isArray(categories) ? categories : [])
    .map(normalizeTelegramGroupCategory)
    .filter(Boolean);
}

function mergeCategoryLists(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const raw of Array.isArray(list) ? list : []) {
      const category = normalizeTelegramGroupCategory(raw);
      if (!category) continue;
      const existing = byId.get(category.categoryId);
      if (!existing) {
        byId.set(category.categoryId, cloneCategory(category));
        continue;
      }
      const optionById = new Map(existing.options.map((option) => [option.optionId, option]));
      category.options.forEach((option) => optionById.set(option.optionId, option));
      byId.set(category.categoryId, {
        ...existing,
        ...category,
        options: Array.from(optionById.values()),
      });
    }
  }
  return Array.from(byId.values());
}

async function readCustomGroupConfig(env = {}, sessionSlug = '') {
  const key = groupConfigKey(sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return { categories: [] };
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { categories: [] };
  assertNoSecretShape(parsed, 'Telegram lightweight group config must not serialize secrets.');
  return {
    ...parsed,
    categories: normalizeTelegramGroupCategories(parsed.categories),
  };
}

async function writeCustomGroupConfig(env = {}, sessionSlug = '', categories = [], {
  createdAt = null,
  updatedBy = '',
} = {}) {
  const key = groupConfigKey(sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const existing = await readCustomGroupConfig(env, sessionSlug);
  const merged = mergeCategoryLists(existing.categories, categories.map((category) => ({
    ...category,
    source: 'cloudflare_custom',
  })));
  const record = {
    version: 1,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    categories: merged,
    updatedBy: safeString(updatedBy) || null,
    updatedAt: createdAt || new Date().toISOString(),
  };
  assertNoSecretShape(record, 'Telegram lightweight group config must not serialize secrets.');
  await kv.put(key, JSON.stringify(record));
  return { ok: true, categories: merged };
}

async function readMembership(env = {}, {
  sessionSlug = '',
  telegramUserId = '',
} = {}) {
  const key = membershipKey({ sessionSlug, telegramUserId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return null;
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  assertNoSecretShape(parsed, 'Telegram lightweight group memberships must not serialize secrets.');
  return parsed;
}

export function normalizeTelegramGroupSelections(selections = {}, categories = []) {
  const categoryById = new Map((Array.isArray(categories) ? categories : []).map((category) => [category.categoryId, category]));
  const source = Array.isArray(selections)
    ? Object.fromEntries(selections.map((entry) => [
      safeString(entry?.categoryId || entry?.id),
      entry?.optionIds || entry?.options || entry?.selectedOptionIds || entry?.value,
    ]))
    : (selections && typeof selections === 'object' ? selections : {});
  const normalized = {};
  for (const [rawCategoryId, rawValues] of Object.entries(source)) {
    const categoryId = sanitizeGroupId(rawCategoryId);
    const category = categoryById.get(categoryId);
    if (!category) continue;
    const optionIds = new Set(category.options.map((option) => option.optionId));
    const values = (Array.isArray(rawValues) ? rawValues : [rawValues])
      .flatMap((value) => typeof value === 'string' && value.includes(',') ? value.split(',') : [value])
      .map(sanitizeGroupId)
      .filter((value) => value && optionIds.has(value));
    const unique = Array.from(new Set(values));
    normalized[categoryId] = category.selectionMode === 'single' ? unique.slice(0, 1) : unique;
  }
  return normalized;
}

async function listKvRecordsByPrefix(env = {}, prefix = '', {
  limit = 100,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!prefix || !kv || typeof kv.list !== 'function' || typeof kv.get !== 'function') return [];
  const records = [];
  let cursor = undefined;
  do {
    const page = await kv.list({
      prefix,
      limit: Math.min(1000, Math.max(1, Number(limit) || 100)),
      ...(cursor ? { cursor } : {}),
    }).catch(() => null);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      const key = safeString(entry?.name || entry);
      if (!key) continue;
      const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        records.push({ ...parsed, key });
      }
      if (records.length >= limit) return records;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return records;
}

async function loadGroupProposals(env = {}, {
  sessionSlug = '',
  telegramUserId = '',
} = {}) {
  const records = await listKvRecordsByPrefix(env, proposalPrefix(sessionSlug), { limit: 100 });
  const userId = safeString(telegramUserId);
  return records
    .filter((proposal) => {
      const target = safeString(proposal.targetTelegramUserId);
      return !target || (userId && target === userId);
    })
    .map((proposal) => ({
      proposalId: safeString(proposal.proposalId),
      status: safeString(proposal.status || 'pending_user_decision'),
      message: safeString(proposal.message),
      categoryId: safeString(proposal.categoryId),
      optionIds: Array.isArray(proposal.optionIds) ? proposal.optionIds.map(safeString).filter(Boolean) : [],
      proposedBy: safeString(proposal.proposedBy) || null,
      createdAt: safeString(proposal.createdAt) || null,
    }))
    .filter((proposal) => proposal.proposalId);
}

export async function loadTelegramLightweightGroups({
  env = {},
  session = {},
  telegramUserId = '',
} = {}) {
  const sessionSlug = sanitizeSessionSlug(session.sessionSlug || session.slug);
  const policyGroups = normalizeTelegramGroupCategories(
    session.lightweightGroups || session.telegramGroups || session.telegramOnlyGroups || []
  );
  const custom = await readCustomGroupConfig(env, sessionSlug);
  const categories = mergeCategoryLists(
    DEFAULT_TELEGRAM_GROUP_CATEGORIES.map((category) => ({ ...category, source: 'default' })),
    policyGroups,
    custom.categories
  );
  const membership = await readMembership(env, { sessionSlug, telegramUserId });
  const selections = normalizeTelegramGroupSelections(membership?.selections || {}, categories);
  const proposals = await loadGroupProposals(env, { sessionSlug, telegramUserId });
  return {
    enabled: Boolean(sessionSlug),
    sessionSlug,
    categories,
    selections,
    proposals,
    updatedAt: safeString(membership?.updatedAt) || null,
  };
}

export async function saveTelegramLightweightGroupMembership({
  env = {},
  session = {},
  telegramUserId = '',
  selections = {},
  createdAt = null,
} = {}) {
  const sessionSlug = sanitizeSessionSlug(session.sessionSlug || session.slug);
  const groups = await loadTelegramLightweightGroups({ env, session, telegramUserId });
  const normalizedSelections = normalizeTelegramGroupSelections(selections, groups.categories);
  const key = membershipKey({ sessionSlug, telegramUserId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const record = {
    version: 1,
    sessionSlug,
    telegramUserId: safeString(telegramUserId),
    selections: normalizedSelections,
    updatedAt: createdAt || new Date().toISOString(),
  };
  assertNoSecretShape(record, 'Telegram lightweight group memberships must not serialize secrets.');
  await kv.put(key, JSON.stringify(record));
  return {
    ok: true,
    groups: {
      ...groups,
      selections: normalizedSelections,
      updatedAt: record.updatedAt,
    },
  };
}

export async function persistTelegramLightweightGroupProposal({
  env = {},
  session = {},
  normalized = {},
  input = {},
  createdAt = null,
} = {}) {
  const sessionSlug = sanitizeSessionSlug(session.sessionSlug || input.sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!sessionSlug || !kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const categoryInput = input.category && typeof input.category === 'object' && !Array.isArray(input.category)
    ? input.category
    : {
      categoryId: input.categoryId || input.groupId,
      label: input.categoryLabel || input.label || input.name,
      description: input.description,
      selectionMode: input.selectionMode || input.mode,
      options: input.options,
    };
  const category = normalizeTelegramGroupCategory(categoryInput);
  if (!category) return { ok: false, reason: 'group_category_required' };
  const saved = await writeCustomGroupConfig(env, sessionSlug, [category], {
    createdAt,
    updatedBy: normalized.user?.telegramUserId,
  });
  if (!saved.ok) return saved;

  const optionIds = (Array.isArray(input.optionIds) ? input.optionIds : (Array.isArray(input.optionsToSuggest) ? input.optionsToSuggest : []))
    .map(sanitizeGroupId)
    .filter(Boolean);
  const proposalId = `tggrp_${stableFingerprint({
    sessionSlug,
    category,
    optionIds,
    message: input.message || input.prompt,
    targetTelegramUserId: input.targetTelegramUserId,
    createdAt,
  })}`;
  const record = {
    version: 1,
    proposalId,
    sessionSlug,
    status: 'pending_user_decision',
    categoryId: category.categoryId,
    optionIds,
    message: safeString(input.message || input.prompt || `Review ${category.label} group options.`),
    targetTelegramUserId: safeString(input.targetTelegramUserId || input.promptTelegramUserId) || null,
    proposedBy: safeString(normalized.user?.telegramUserId) || null,
    createdAt: createdAt || new Date().toISOString(),
  };
  assertNoSecretShape(record, 'Telegram lightweight group proposals must not serialize secrets.');
  await kv.put(`${proposalPrefix(sessionSlug)}${proposalId}`, JSON.stringify(record));
  return {
    ok: true,
    sessionSlug,
    category,
    proposal: record,
    requiresUserApproval: true,
  };
}

export async function persistTelegramChildSession({
  env = {},
  parentSession = {},
  normalized = {},
  input = {},
  createdAt = null,
} = {}) {
  const parentSessionSlug = sanitizeSessionSlug(parentSession.sessionSlug || input.parentSessionSlug || input.sessionSlug);
  const requested = sanitizeSessionSlug(input.childSessionSlug || input.slug || input.sessionName || input.name);
  const childSessionSlug = requested || sanitizeSessionSlug(`${parentSessionSlug}-child-${stableFingerprint(input).slice(0, 6)}`);
  const kv = env?.AGENT_ACTION_KV;
  if (!childSessionSlug || !kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const groups = normalizeTelegramGroupCategories(input.groups || input.lightweightGroups || input.telegramGroups || []);
  const record = {
    version: 1,
    sessionSlug: childSessionSlug,
    parentSessionSlug,
    sessionName: safeString(input.sessionName || input.name || childSessionSlug),
    status: 'worker_local_child_session_created',
    telegramOnly: true,
    cloudflareManaged: true,
    questions: Array.isArray(input.questions) ? input.questions.slice(0, 50) : [],
    lightweightGroups: groups,
    createdByTelegramUserId: safeString(normalized.user?.telegramUserId) || null,
    createdAt: createdAt || new Date().toISOString(),
  };
  assertNoSecretShape(record, 'Telegram child session records must not serialize secrets.');
  await kv.put(childSessionKey(childSessionSlug), JSON.stringify(record));
  if (groups.length) {
    await writeCustomGroupConfig(env, childSessionSlug, groups, {
      createdAt,
      updatedBy: normalized.user?.telegramUserId,
    });
  }
  return {
    ok: true,
    session: record,
    canonicalStatus: 'worker_local_until_session_registry_parity',
  };
}
