import { safeString, lower, safeJsonParse, stableFingerprint, kvKeySafePart, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { normalizeQuestionType } from './sessionQuestions.mjs';

export const AGENT_QUESTION_QUEUE_CONFIG_KV_PREFIX = 'telegram:question-queue-config:v1:';
export const AGENT_QUESTION_QUEUE_STATE_KV_PREFIX = 'telegram:question-queue-state:v1:';

const MAX_SPONSORED_QUESTIONS = 50;
const MAX_HISTORY = 50;

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === false) return value;
  const normalized = lower(value);
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeTokenList(value = []) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
  return source
    .map((entry) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return safeString(entry.id || entry.questionId || entry.value || entry.label || entry.name);
      }
      return safeString(entry);
    })
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index);
}

function normalizeQuestionIds(value = []) {
  return normalizeTokenList(value).slice(0, MAX_SPONSORED_QUESTIONS);
}

function normalizeTags(value = []) {
  return normalizeTokenList(value)
    .flatMap((entry) => entry.split(/\s+/))
    .map((entry) => lower(entry).replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index);
}

function canonicalQuestionType(value = '') {
  const type = lower(value)
    .replace(/[^a-z0-9_ -]+/g, '')
    .replace(/\s+/g, '_');
  if (type === 'multiselect') return 'multichoice';
  if (['number', 'numeric'].includes(type)) return 'rating';
  return normalizeQuestionType({ type }, type || 'freeform');
}

function normalizeQuestionTypes(value = []) {
  return normalizeTokenList(value)
    .map(canonicalQuestionType)
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index);
}

function envQuestionQueueConfig() { return {}; }

export function questionQueueConfigKey(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${AGENT_QUESTION_QUEUE_CONFIG_KV_PREFIX}${slug}` : '';
}

export function questionQueueStateKey({
  sessionSlug = '',
  telegramUserId = '',
  queueKey = '',
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const user = kvKeySafePart(telegramUserId);
  const queue = kvKeySafePart(queueKey || 'default');
  return slug && user && queue ? `${AGENT_QUESTION_QUEUE_STATE_KV_PREFIX}${slug}:${user}:${queue}` : '';
}

export async function loadAgentQuestionQueueConfig({
  env = {},
  sessionSlug = '',
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const defaults = envQuestionQueueConfig(env, slug);
  const fallback = {
    type: 'telegram_question_queue_config',
    version: 1,
    sessionSlug: slug,
    sponsoredQuestionIds: normalizeQuestionIds(defaults.sponsoredQuestionIds || defaults.questionIds),
    source: defaults.sponsoredQuestionIds || defaults.questionIds ? 'env' : 'default',
  };
  const key = questionQueueConfigKey(slug);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return fallback;
  const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
  assertNoSecretShape(parsed, "Agent question queue config records must not serialize secrets.");
  return {
    ...fallback,
    ...parsed,
    sessionSlug: slug,
    sponsoredQuestionIds: normalizeQuestionIds(parsed.sponsoredQuestionIds || parsed.questionIds),
    source: 'kv',
  };
}

export async function saveAgentQuestionQueueConfig({
  env = {},
  sessionSlug = '',
  sponsoredQuestionIds = [],
  updatedByTelegramUserId = '',
  updatedByAccountAddress = '',
  createdAt = null,
} = {}) {
  const key = questionQueueConfigKey(sessionSlug);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'question_queue_storage_unavailable' };
  }
  const existing = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  const now = safeString(createdAt) || new Date().toISOString();
  const record = {
    type: 'telegram_question_queue_config',
    version: 1,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    sponsoredQuestionIds: normalizeQuestionIds(sponsoredQuestionIds),
    updatedByTelegramUserId: safeString(updatedByTelegramUserId),
    updatedByAccountAddress: safeString(updatedByAccountAddress).toLowerCase(),
    createdAt: safeString(existing?.createdAt) || now,
    updatedAt: now,
  };
  assertNoSecretShape(record, "Agent question queue config records must not serialize secrets.");
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(record));
  return { ok: true, key, config: record };
}

export function normalizeQuestionQueueCriteria(input = {}) {
  const criteria = input.criteria && typeof input.criteria === 'object' && !Array.isArray(input.criteria)
    ? input.criteria
    : {};
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? input.preferences
    : {};
  const tags = normalizeTags(
    input.tags ||
    criteria.tags ||
    criteria.tagIds ||
    preferences.tags ||
    preferences.tagIds ||
    preferences.interests ||
      input.interests,
  );
  const questionTypes = normalizeQuestionTypes(
    input.questionTypes ||
    input.questionType ||
    criteria.questionTypes ||
    criteria.questionType ||
      preferences.questionTypes,
  );
  const excludeQuestionIds = normalizeQuestionIds(
    input.excludeQuestionIds || criteria.excludeQuestionIds || preferences.excludeQuestionIds,
  );
  const includeSponsored = normalizeBoolean(input.includeSponsored ?? criteria.includeSponsored, true);
  const sponsoredFirst = normalizeBoolean(input.sponsoredFirst ?? criteria.sponsoredFirst, true);
  const skipServed = normalizeBoolean(input.skipServed ?? criteria.skipServed, true);
  const queueKey = safeString(input.queueKey || criteria.queueKey) || stableFingerprint({
    tags,
    questionTypes,
    includeSponsored,
    sponsoredFirst,
  });
  return {
    tags,
    questionTypes,
    excludeQuestionIds,
    includeSponsored,
    sponsoredFirst,
    skipServed,
    queueKey,
  };
}

function questionMatchesCriteria(question = {}, criteria = {}) {
  if (!question || question.answerable !== true) return false;
  if (criteria.questionTypes.length) {
    const type = canonicalQuestionType(question.questionType || question.type);
    if (!criteria.questionTypes.includes(type)) return false;
  }
  if (criteria.tags.length) {
    const questionTags = new Set(normalizeTags(question.tags));
    const promptText = [
      question.prompt,
      question.questionType,
      Array.isArray(question.options) ? question.options.join(' ') : '',
    ].map((value) => lower(value)).join(' ');
    const matched = criteria.tags.some((tag) => (
      questionTags.has(tag) ||
      promptText.includes(tag.replace(/-/g, ' '))
    ));
    if (!matched) return false;
  }
  return true;
}

function orderCandidates(questions = [], sponsoredIds = [], criteria = {}, servedSet = new Set()) {
  const excluded = new Set(criteria.excludeQuestionIds);
  const base = questions.filter((question) => {
    const questionId = safeString(question.questionId || question.id);
    return questionId &&
      !excluded.has(questionId) &&
      !servedSet.has(questionId) &&
      questionMatchesCriteria(question, criteria);
  });
  if (!criteria.includeSponsored || !criteria.sponsoredFirst || !sponsoredIds.length) return base;
  const byId = new Map(base.map((question) => [safeString(question.questionId || question.id), question]));
  const sponsored = sponsoredIds.map((questionId) => byId.get(questionId)).filter(Boolean);
  const sponsoredSet = new Set(sponsored.map((question) => safeString(question.questionId || question.id)));
  return [
    ...sponsored,
    ...base.filter((question) => !sponsoredSet.has(safeString(question.questionId || question.id))),
  ];
}

export async function selectNextAgentQuestion({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  questions = [],
  sponsoredQuestionIds = [],
  input = {},
  createdAt = null,
} = {}) {
  const criteria = normalizeQuestionQueueCriteria(input);
  const advance = normalizeBoolean(input.advance, true);
  const resetQueue = normalizeBoolean(input.resetQueue || input.reset, false);
  const key = questionQueueStateKey({ sessionSlug, telegramUserId, queueKey: criteria.queueKey });
  const kv = env?.AGENT_ACTION_KV;
  const now = safeString(createdAt) || new Date().toISOString();
  const existing = key && kv && typeof kv.get === 'function' && !resetQueue
    ? safeJsonParse(await kv.get(key).catch(() => null), null)
    : null;
  const sponsoredIds = normalizeQuestionIds(sponsoredQuestionIds);
  const eligible = orderCandidates(questions, sponsoredIds, criteria, new Set());
  const eligibleIds = new Set(eligible.map((question) => safeString(question.questionId || question.id)));
  const previousServed = Array.isArray(existing?.servedQuestionIds) ? existing.servedQuestionIds : [];
  const servedQuestionIds = [...new Set(previousServed.map(safeString))].filter((id) => eligibleIds.has(id));
  const servedSet = criteria.skipServed ? new Set(servedQuestionIds) : new Set();

  let candidates = eligible.filter((question) => !servedSet.has(safeString(question.questionId || question.id)));
  let cycled = false;
  let statePersisted = false;
  if (!candidates.length && criteria.skipServed && servedQuestionIds.length) {
    candidates = eligible;
    cycled = candidates.length > 0;
  }
  const selected = candidates[0] || null;
  const selectedQuestionId = safeString(selected?.questionId || selected?.id);
  const sponsored = selectedQuestionId ? sponsoredIds.includes(selectedQuestionId) : false;
  const nextServed = !selected ? servedQuestionIds : cycled ? [selectedQuestionId] : [
    ...servedQuestionIds.filter((questionId) => questionId !== selectedQuestionId),
    selectedQuestionId,
  ];
  const pruned = servedQuestionIds.length !== previousServed.length;
  if ((selected || pruned) && advance && key && kv && typeof kv.put === 'function') {
    const criteriaFingerprint = stableFingerprint(criteria);
    const criteriaSummary = {
      tagCount: criteria.tags.length,
      questionTypes: criteria.questionTypes,
      excludeQuestionCount: criteria.excludeQuestionIds.length,
      includeSponsored: criteria.includeSponsored,
      sponsoredFirst: criteria.sponsoredFirst,
      skipServed: criteria.skipServed,
    };
    const history = [
      ...(Array.isArray(existing?.history) ? existing.history : []),
      ...(selected ? [{
        questionId: selectedQuestionId,
        sponsored,
        criteriaFingerprint,
        criteriaSummary,
        selectedAt: now,
      }] : []),
    ].slice(-MAX_HISTORY);
    const record = {
      type: 'telegram_question_queue_state',
      version: 1,
      sessionSlug: sanitizeSessionSlug(sessionSlug),
      telegramUserId: safeString(telegramUserId),
      queueKey: criteria.queueKey,
      servedQuestionIds: nextServed,
      lastQuestionId: selectedQuestionId || safeString(existing?.lastQuestionId),
      history,
      createdAt: safeString(existing?.createdAt) || now,
      updatedAt: now,
    };
    assertNoSecretShape(record, "Agent question queue state records must not serialize secrets.");
    await kv.put(key, JSON.stringify(record));
    statePersisted = true;
  }
  return {
    ok: Boolean(selected),
    question: selected,
    sponsored,
    reason: selected
      ? (sponsored ? 'sponsored_question_queue' : 'criteria_ranked_question_queue')
      : 'no_matching_question',
    queue: {
      queueKey: criteria.queueKey,
      criteria,
      advanced: statePersisted,
      advanceRequested: Boolean(selected && advance),
      reset: resetQueue,
      cycled,
      servedCount: nextServed.length,
      candidateCount: candidates.length,
      sponsoredQuestionCount: sponsoredIds.length,
    },
  };
}

export const __test__agentQuestionQueue = {
  normalizeQuestionQueueCriteria,
  questionMatchesCriteria,
  orderCandidates,
  stableFingerprint,
};
