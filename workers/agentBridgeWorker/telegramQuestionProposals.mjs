import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { buildTelegramAgentActivityMetadata } from './telegramAgentActivity.mjs';

const PROPOSED_QUESTION_KV_PREFIX = 'telegram:proposed-question:';
const DEFAULT_PROPOSED_QUESTION_TTL_SECONDS = 90 * 24 * 60 * 60;
const SUPPORTED_QUESTION_TYPES = new Set(['binary', 'freeform', 'rating', 'multichoice']);
const MAX_QUESTION_TAGS = 10;
const MAX_QUESTION_TAG_LENGTH = 48;
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
    .replace(/[^a-z0-9]+/g, '-')
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
  sessionContext = '',
} = {}) {
  const tags = [];
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
  sessionContext = '',
  metadata = null,
  createdAt = null,
  ttlSeconds = DEFAULT_PROPOSED_QUESTION_TTL_SECONDS,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const promptText = normalizePrompt(prompt);
  const type = normalizeQuestionType(questionType);
  const normalizedOptions = normalizeOptions(options);
  const normalizedSessionContext = normalizeSessionContext(sessionContext);
  const normalizedTags = inferQuestionTags({
    prompt: promptText,
    questionType: type,
    options: normalizedOptions,
    explicitTags: tags,
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
  inferQuestionTags,
  normalizeQuestionTag,
  normalizeQuestionTags,
  normalizeQuestionType,
  normalizeSessionContext,
  proposedQuestionPrefix,
  proposedRecordToQuestion,
  sessionContextFromPolicySession,
};
