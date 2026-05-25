import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape } from './redaction.mjs';

const PROPOSED_QUESTION_KV_PREFIX = 'telegram:proposed-question:';
const DEFAULT_PROPOSED_QUESTION_TTL_SECONDS = 90 * 24 * 60 * 60;
const SUPPORTED_QUESTION_TYPES = new Set(['binary', 'freeform', 'rating', 'multichoice']);

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
  if (type === 'agree-disagree' || type === 'agree_unsure_disagree') return 'binary';
  return SUPPORTED_QUESTION_TYPES.has(type) ? type : 'freeform';
}

function normalizePrompt(value = '') {
  return safeString(value).replace(/\s+/g, ' ').slice(0, 1000);
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
  return question;
}

export async function persistTelegramProposedQuestion({
  env = {},
  normalized = {},
  sessionSlug = '',
  prompt = '',
  questionType = 'freeform',
  options = [],
  createdAt = null,
  ttlSeconds = DEFAULT_PROPOSED_QUESTION_TTL_SECONDS,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const promptText = normalizePrompt(prompt);
  const type = normalizeQuestionType(questionType);
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
    options: normalizeOptions(options),
    source: 'telegram_question_proposal',
    status: 'active',
    createdByTelegramUserId: telegramUserId || null,
    createdFromChatId: chatId || null,
    createdAt: nowIso(createdAt),
  };
  assertNoSecretShape(record, 'Telegram proposed questions must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(`${prefix}${questionId}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
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
  normalizeQuestionType,
  proposedQuestionPrefix,
  proposedRecordToQuestion,
};
