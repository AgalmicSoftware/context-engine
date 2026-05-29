import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { buildTelegramAgentActivityMetadata } from './telegramAgentActivity.mjs';

const PROPOSED_QUESTION_KV_PREFIX = 'telegram:proposed-question:';
const DEFAULT_PROPOSED_QUESTION_TTL_SECONDS = 90 * 24 * 60 * 60;
const SUPPORTED_QUESTION_TYPES = new Set(['binary', 'freeform', 'rating', 'multichoice']);
const SUPPORTED_GEO_REF_KINDS = new Set(['event', 'venue', 'track']);
const MAX_QUESTION_TAGS = 10;
const MAX_QUESTION_TAG_LENGTH = 48;
const MAX_QUESTION_GEO_REFS = 5;
const TAG_STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'agree',
  'answer',
  'before',
  'better',
  'could',
  'from',
  'have',
  'into',
  'question',
  'session',
  'should',
  'that',
  'their',
  'there',
  'this',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'your',
]);
const TAG_RULES = Object.freeze([
  ['ai', /\b(ai|artificial intelligence|llm|model|agent|agents|openclaw)\b/i],
  ['governance', /\b(governance|vote|voting|policy|decision|proposal|consensus)\b/i],
  ['food', /\b(food|pizza|meal|lunch|dinner|restaurant|snack|coffee)\b/i],
  ['work', /\b(work|office|workplace|team|company|job)\b/i],
  ['event', /\b(event|session|talk|workshop|conference|edge city|attended)\b/i],
  ['risk', /\b(risk|safety|safe|unsafe|concern|harm|danger)\b/i],
  ['preference', /\b(prefer|preference|favorite|favourite|like|choice|choose)\b/i],
  ['community', /\b(community|group|tribe|participants|people|members)\b/i],
  ['location', /\b(country|city|local|citizen|resident|live in|location)\b/i],
  ['funding', /\b(fund|funding|invest|investor|budget|grant|money|capital)\b/i],
]);

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function nowIso(now = null) {
  if (now instanceof Date) return now.toISOString();
  if (safeString(now)) return new Date(now).toISOString();
  return new Date().toISOString();
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

function normalizeQuestionType(value = '') {
  const type = lower(value).replace(/_/g, '-');
  if (type === 'agree-disagree' || type === 'agree-unsure-disagree') return 'binary';
  return SUPPORTED_QUESTION_TYPES.has(type) ? type : 'freeform';
}

function normalizePrompt(value = '') {
  return safeString(value).replace(/\s+/g, ' ').slice(0, 1000);
}

export function normalizeQuestionTag(value = '') {
  return safeString(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9:]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_QUESTION_TAG_LENGTH);
}

export function normalizeQuestionTags(value = []) {
  const source = Array.isArray(value)
    ? value
    : safeString(value).split(/[\n,;|#]+/);
  const seen = new Set();
  const tags = [];
  source.forEach((entry) => {
    const raw = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? firstString(entry.tag, entry.tagId, entry.id, entry.label, entry.name)
      : entry;
    const tag = normalizeQuestionTag(raw);
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    tags.push(tag);
  });
  return tags.slice(0, MAX_QUESTION_TAGS);
}

function firstString(...values) {
  return values.find((value) => safeString(value) !== '');
}

export function normalizeGeoId(value = '') {
  return safeString(value).replace(/\s+/g, ' ').slice(0, 128);
}

function normalizeGeoRefKind(value = '') {
  const kind = lower(value || 'event').replace(/_/g, '-');
  return SUPPORTED_GEO_REF_KINDS.has(kind) ? kind : 'event';
}

export function geoTagForId(value = '') {
  const normalized = normalizeQuestionTag(normalizeGeoId(value));
  if (!normalized) return '';
  return normalized.startsWith('geo:') ? normalized : `geo:${normalized}`;
}

function geoRefFromCandidate(entry = {}, fallback = {}) {
  const raw = entry && typeof entry === 'object' && !Array.isArray(entry)
    ? entry
    : { geoId: entry };
  const geoId = normalizeGeoId(firstString(
    raw.geoId,
    raw.geoID,
    raw.id,
    raw.geo,
    raw.eventId,
    raw.venueId,
    raw.trackId,
    fallback.geoId
  ));
  if (!geoId) return null;
  const kind = normalizeGeoRefKind(firstString(raw.kind, raw.geoKind, raw.type, fallback.kind));
  const label = safeString(firstString(raw.label, raw.name, raw.title, fallback.label, geoId))
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  return {
    geoId,
    kind,
    ...(label ? { label } : {}),
  };
}

export function normalizeQuestionGeoRefs(value = [], fallback = {}) {
  const source = [];
  if (Array.isArray(value)) {
    source.push(...value);
  } else if (value && typeof value === 'object') {
    if (Array.isArray(value.geoRefs)) source.push(...value.geoRefs);
    else source.push(value);
  } else if (safeString(value)) {
    source.push(value);
  }
  if (fallback && typeof fallback === 'object' && !Array.isArray(fallback) && safeString(fallback.geoId)) {
    source.push(fallback);
  }
  const refs = [];
  const seen = new Set();
  source.forEach((entry) => {
    const ref = geoRefFromCandidate(entry, fallback);
    if (!ref) return;
    const key = `${lower(ref.geoId)}:${ref.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  });
  return refs.slice(0, MAX_QUESTION_GEO_REFS);
}

export function questionSourceGeoRefs(question = {}) {
  const metadata = question?.metadata && typeof question.metadata === 'object' && !Array.isArray(question.metadata)
    ? question.metadata
    : {};
  const payload = question?.payload && typeof question.payload === 'object' && !Array.isArray(question.payload)
    ? question.payload
    : {};
  return normalizeQuestionGeoRefs([
    ...normalizeQuestionGeoRefs(question.geoRefs),
    ...normalizeQuestionGeoRefs(question.geoRef),
    ...normalizeQuestionGeoRefs(metadata.geoRefs),
    ...normalizeQuestionGeoRefs(metadata.geoRef),
    ...normalizeQuestionGeoRefs(payload.geoRefs),
    ...normalizeQuestionGeoRefs(payload.geoRef),
  ]);
}

export function geoTagsFromGeoRefs(value = []) {
  return normalizeQuestionGeoRefs(value)
    .map((ref) => geoTagForId(ref.geoId))
    .filter(Boolean);
}

export function normalizeSessionContext(value = '') {
  return safeString(value).replace(/\s+/g, ' ').slice(0, 1200);
}

export function sessionContextFromPolicySession(session = {}) {
  const metadata = session?.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
    ? session.metadata
    : {};
  return normalizeSessionContext(firstString(
    session.sessionContext,
    session.telegramSessionContext,
    session.context,
    session.description,
    session.purpose,
    session.topic,
    metadata.sessionContext,
    metadata.context,
    metadata.description
  ));
}

function addQuestionTags(target, tags = []) {
  normalizeQuestionTags(tags).forEach((tag) => {
    if (!target.includes(tag) && target.length < MAX_QUESTION_TAGS) target.push(tag);
  });
}

function questionSourceTags(question = {}) {
  const metadata = question?.metadata && typeof question.metadata === 'object' && !Array.isArray(question.metadata)
    ? question.metadata
    : {};
  const payload = question?.payload && typeof question.payload === 'object' && !Array.isArray(question.payload)
    ? question.payload
    : {};
  return [
    question.tags,
    question.questionTags,
    question.promptTags,
    question.topicTags,
    metadata.tags,
    metadata.questionTags,
    payload.tags,
    payload.questionTags,
  ];
}

function sessionSourceTags(session = {}) {
  const metadata = session?.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
    ? session.metadata
    : {};
  return [
    session.questionTags,
    session.defaultQuestionTags,
    session.telegramQuestionTags,
    session.defaultTags,
    session.tags,
    metadata.questionTags,
    metadata.defaultQuestionTags,
    metadata.tags,
  ];
}

function keywordTagsFromText(text = '') {
  const raw = safeString(text);
  const tags = [];
  TAG_RULES.forEach(([tag, pattern]) => {
    if (pattern.test(raw)) tags.push(tag);
  });
  raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !TAG_STOP_WORDS.has(token))
    .slice(0, 16)
    .forEach((token) => {
      const tag = normalizeQuestionTag(token);
      if (tag && !tags.includes(tag) && tags.length < 6) tags.push(tag);
    });
  return tags;
}

export function inferQuestionTags({
  question = {},
  prompt = '',
  questionType = '',
  options = [],
  session = {},
  explicitTags = [],
  geoRefs = [],
  sessionContext = '',
} = {}) {
  const tags = [];
  addQuestionTags(tags, geoTagsFromGeoRefs(normalizeQuestionGeoRefs(geoRefs).length ? geoRefs : questionSourceGeoRefs(question)));
  addQuestionTags(tags, explicitTags);
  questionSourceTags(question).forEach((source) => addQuestionTags(tags, source));
  sessionSourceTags(session).forEach((source) => addQuestionTags(tags, source));
  const text = [
    prompt,
    question.prompt,
    question.questionText,
    question.title,
    questionType,
    Array.isArray(options) ? options.join(' ') : '',
    sessionContext,
    sessionContextFromPolicySession(session),
    session.sessionName,
    session.sessionSlug,
  ].map(safeString).filter(Boolean).join(' ');
  addQuestionTags(tags, keywordTagsFromText(text));
  return tags.slice(0, MAX_QUESTION_TAGS);
}

function normalizeOptions(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((option) => safeString(option).replace(/\s+/g, ' ').slice(0, 120))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeReferenceUrl(value = '') {
  const text = safeString(value).slice(0, 2000);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function normalizeQuestionReferences(value = []) {
  const source = Array.isArray(value) ? value : (value ? [value] : []);
  const seen = new Set();
  const references = [];
  source.forEach((entry) => {
    const raw = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry
      : { type: 'url', url: entry };
    const type = lower(raw.type || 'url').replace(/[^a-z0-9_-]+/g, '_').slice(0, 32) || 'url';
    const url = type === 'url' ? normalizeReferenceUrl(raw.url || raw.href || raw.value) : '';
    if (type === 'url' && !url) return;
    const key = `${type}:${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    const reference = { type };
    if (url) reference.url = url;
    const title = safeString(raw.title || raw.label || raw.name).replace(/\s+/g, ' ').slice(0, 160);
    if (title) reference.title = title;
    references.push(reference);
  });
  return references.slice(0, 5);
}

function proposedQuestionPrefix(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${PROPOSED_QUESTION_KV_PREFIX}${slug}:` : '';
}

function questionIdFromPrompt({
  sessionSlug = '',
  prompt = '',
  questionType = '',
  telegramUserId = '',
  chatId = '',
} = {}) {
  const seed = [
    'telegram_question_proposal',
    sanitizeSessionSlug(sessionSlug),
    normalizeQuestionType(questionType),
    safeString(telegramUserId),
    safeString(chatId),
    normalizePrompt(prompt),
  ].join('|');
  return `telegram-proposed-${buildOpaqueActionId(seed)}`;
}

function proposedRecordToQuestion(record = {}) {
  const questionId = safeString(record.questionId);
  const prompt = normalizePrompt(record.prompt || record.questionText);
  if (!questionId || !prompt) return null;
  const questionType = normalizeQuestionType(record.questionType);
  const tags = normalizeQuestionTags(record.tags);
  const references = normalizeQuestionReferences(record.references);
  const geoRefs = normalizeQuestionGeoRefs(record.geoRefs);
  const question = {
    questionId,
    id: questionId,
    questionType,
    prompt,
    questionText: prompt,
    sessionSlug: sanitizeSessionSlug(record.sessionSlug),
    source: 'telegram_question_proposal',
    visibility: 'public',
    canAnswer: true,
    proposed: true,
    createdAt: safeString(record.createdAt) || null,
  };
  const options = normalizeOptions(record.options);
  if (options.length) question.options = options;
  if (tags.length) question.tags = tags;
  if (references.length) question.references = references;
  if (geoRefs.length) question.geoRefs = geoRefs;
  return question;
}

export async function persistTelegramProposedQuestion({
  env = {},
  normalized = {},
  sessionSlug = '',
  prompt = '',
  questionType = 'freeform',
  options = [],
  tags = [],
  references = [],
  geoRefs = [],
  geoId = '',
  geoKind = '',
  geoLabel = '',
  sessionContext = '',
  metadata = null,
  createdAt = null,
  ttlSeconds = DEFAULT_PROPOSED_QUESTION_TTL_SECONDS,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const promptText = normalizePrompt(prompt);
  const type = normalizeQuestionType(questionType);
  const normalizedOptions = normalizeOptions(options);
  const normalizedReferences = normalizeQuestionReferences(references);
  const normalizedGeoRefs = normalizeQuestionGeoRefs(geoRefs, {
    geoId,
    kind: geoKind,
    label: geoLabel,
  });
  const normalizedSessionContext = normalizeSessionContext(sessionContext);
  const normalizedTags = inferQuestionTags({
    prompt: promptText,
    questionType: type,
    options: normalizedOptions,
    explicitTags: tags,
    geoRefs: normalizedGeoRefs,
    sessionContext: normalizedSessionContext,
  });
  const prefix = proposedQuestionPrefix(slug);
  if (!slug) return { ok: false, reason: 'session_slug_missing' };
  if (!promptText) return { ok: false, reason: 'question_prompt_missing' };
  if (!prefix || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const telegramUserId = safeString(normalized.user?.telegramUserId || normalized.telegramUserId);
  const chatId = safeString(normalized.chat?.chatId || normalized.chatId);
  const questionId = questionIdFromPrompt({
    sessionSlug: slug,
    prompt: promptText,
    questionType: type,
    telegramUserId,
    chatId,
  });
  const record = {
    version: 1,
    questionId,
    sessionSlug: slug,
    questionType: type,
    prompt: promptText,
    options: normalizedOptions,
    tags: normalizedTags,
    references: normalizedReferences,
    geoRefs: normalizedGeoRefs,
    sessionContext: normalizedSessionContext || null,
    source: 'telegram_question_proposal',
    status: 'active',
    createdByTelegramUserId: telegramUserId || null,
    createdFromChatId: chatId || null,
    createdAt: nowIso(createdAt),
  };
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    record.actionMetadata = { ...metadata };
  }
  assertNoSecretShape(record, 'Telegram proposed questions must not serialize secrets.');
  const activityMetadata = buildTelegramAgentActivityMetadata({
    type: 'proposed_question',
    status: record.status,
    createdAt: record.createdAt,
    pendingAction: '',
    sessionSlug: record.sessionSlug,
    questionId: record.questionId,
    telegramUserId: record.createdByTelegramUserId,
  });
  await env.AGENT_ACTION_KV.put(`${prefix}${questionId}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
    metadata: activityMetadata,
  });
  return {
    ok: true,
    questionId,
    question: proposedRecordToQuestion(record),
    record,
  };
}

export async function listTelegramProposedQuestionsForSession(env = {}, sessionSlug = '') {
  const prefix = proposedQuestionPrefix(sessionSlug);
  if (!prefix || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.list !== 'function') {
    return [];
  }
  const records = [];
  let cursor = '';
  for (let page = 0; page < 20; page += 1) {
    const listed = await env.AGENT_ACTION_KV.list({
      prefix,
      cursor,
      limit: 100,
    }).catch(() => null);
    const keys = Array.isArray(listed?.keys) ? listed.keys : [];
    for (const item of keys) {
      const name = safeString(item?.name);
      if (!name || typeof env.AGENT_ACTION_KV.get !== 'function') continue;
      const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(name).catch(() => null), null);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      assertNoSecretShape(parsed, 'Telegram proposed questions must not serialize secrets.');
      if (parsed.status && lower(parsed.status) !== 'active') continue;
      const question = proposedRecordToQuestion(parsed);
      if (question) records.push(question);
    }
    if (listed?.list_complete !== false || !listed?.cursor) break;
    cursor = listed.cursor;
  }
  return records;
}

export function mergeTelegramProposedQuestions(questions = [], proposedQuestions = []) {
  const merged = [];
  const seen = new Set();
  for (const question of [...(Array.isArray(questions) ? questions : []), ...(Array.isArray(proposedQuestions) ? proposedQuestions : [])]) {
    const qid = safeString(question?.questionId || question?.id);
    if (!qid || seen.has(qid)) continue;
    seen.add(qid);
    merged.push(question);
  }
  return merged;
}

export const __test__telegramQuestionProposals = {
  PROPOSED_QUESTION_KV_PREFIX,
  geoTagForId,
  geoTagsFromGeoRefs,
  inferQuestionTags,
  normalizeGeoId,
  normalizeQuestionGeoRefs,
  normalizeQuestionTag,
  normalizeQuestionReferences,
  normalizeQuestionTags,
  normalizeQuestionType,
  normalizeSessionContext,
  proposedQuestionPrefix,
  proposedRecordToQuestion,
  sessionContextFromPolicySession,
};
