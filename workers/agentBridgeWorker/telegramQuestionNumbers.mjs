import { safeString, safeJsonParse } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';

export const TELEGRAM_QUESTION_NUMBER_KV_PREFIX = 'telegram:question-number:';

function sanitizeSessionSlug(value = '') {
  return safeString(value).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function normalizeQuestionId(value = '') {
  return safeString(value).slice(0, 256);
}

function nowIso(now = null) {
  if (now instanceof Date) return now.toISOString();
  if (safeString(now)) {
    const parsed = new Date(now);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function questionId(question = {}) {
  return normalizeQuestionId(question?.questionId || question?.id);
}

export function telegramQuestionNumberKvKey(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${TELEGRAM_QUESTION_NUMBER_KV_PREFIX}${slug}` : '';
}

export function normalizeTelegramQuestionNumberMap(raw = {}, sessionSlug = '') {
  const slug = sanitizeSessionSlug(raw.sessionSlug || sessionSlug);
  const numberToQuestionId = {};
  const questionIdToNumber = {};
  const sourceNumberToQuestionId = raw.numberToQuestionId && typeof raw.numberToQuestionId === 'object' && !Array.isArray(raw.numberToQuestionId)
    ? raw.numberToQuestionId
    : {};
  const sourceQuestionIdToNumber = raw.questionIdToNumber && typeof raw.questionIdToNumber === 'object' && !Array.isArray(raw.questionIdToNumber)
    ? raw.questionIdToNumber
    : {};

  for (const [rawNumber, rawQuestionId] of Object.entries(sourceNumberToQuestionId)) {
    const number = Math.floor(Number(rawNumber));
    const qid = normalizeQuestionId(rawQuestionId);
    if (!Number.isInteger(number) || number <= 0 || !qid) continue;
    numberToQuestionId[String(number)] = qid;
    questionIdToNumber[qid] = number;
  }
  for (const [rawQuestionId, rawNumber] of Object.entries(sourceQuestionIdToNumber)) {
    const number = Math.floor(Number(rawNumber));
    const qid = normalizeQuestionId(rawQuestionId);
    if (!Number.isInteger(number) || number <= 0 || !qid) continue;
    if (numberToQuestionId[String(number)] && numberToQuestionId[String(number)] !== qid) continue;
    numberToQuestionId[String(number)] = qid;
    questionIdToNumber[qid] = number;
  }

  const highestNumber = Object.keys(numberToQuestionId)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .reduce((max, value) => Math.max(max, value), 0);
  const nextNumber = Math.max(highestNumber + 1, Math.floor(Number(raw.nextNumber || 1)) || 1);

  return {
    version: 1,
    sessionSlug: slug,
    nextNumber,
    numberToQuestionId,
    questionIdToNumber,
    updatedAt: safeString(raw.updatedAt) || null,
  };
}

async function loadQuestionNumberMap(env = {}, sessionSlug = '') {
  const key = telegramQuestionNumberKvKey(sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return normalizeTelegramQuestionNumberMap({}, sessionSlug);
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), {});
  return normalizeTelegramQuestionNumberMap(parsed || {}, sessionSlug);
}

async function persistQuestionNumberMap(env = {}, map = {}, createdAt = null) {
  const key = telegramQuestionNumberKvKey(map.sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const record = normalizeTelegramQuestionNumberMap({ ...map, updatedAt: nowIso(createdAt) }, map.sessionSlug);
  assertNoSecretShape(record, 'Telegram question number map must not serialize secrets.');
  await kv.put(key, JSON.stringify(record));
  return { ok: true, key, record };
}

export async function ensureTelegramQuestionNumbers({
  env = {},
  sessionSlug = '',
  questions = [],
  createdAt = null,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!slug) return { ok: false, reason: 'session_slug_missing', questions: Array.isArray(questions) ? questions : [] };
  const map = await loadQuestionNumberMap(env, slug);
  let changed = false;
  for (const question of Array.isArray(questions) ? questions : []) {
    const qid = questionId(question);
    if (!qid || map.questionIdToNumber[qid]) continue;
    const number = map.nextNumber;
    map.numberToQuestionId[String(number)] = qid;
    map.questionIdToNumber[qid] = number;
    map.nextNumber = number + 1;
    changed = true;
  }
  if (changed) await persistQuestionNumberMap(env, map, createdAt);
  const numberedQuestions = (Array.isArray(questions) ? questions : []).map((question) => {
    const qid = questionId(question);
    const stableQuestionNumber = qid ? map.questionIdToNumber[qid] : null;
    return stableQuestionNumber ? { ...question, stableQuestionNumber } : question;
  });
  return { ok: true, map, questions: numberedQuestions };
}

export async function assignTelegramQuestionNumber({
  env = {},
  sessionSlug = '',
  questionId = '',
  createdAt = null,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = normalizeQuestionId(questionId);
  if (!slug || !qid) return { ok: false, reason: 'question_number_input_missing' };
  const map = await loadQuestionNumberMap(env, slug);
  let number = map.questionIdToNumber[qid];
  if (!number) {
    number = map.nextNumber;
    map.numberToQuestionId[String(number)] = qid;
    map.questionIdToNumber[qid] = number;
    map.nextNumber = number + 1;
    await persistQuestionNumberMap(env, map, createdAt);
  }
  return { ok: true, number, map };
}

export function parseStableQuestionNumberSelector(selector = '') {
  const text = safeString(selector).toLowerCase();
  const match = text.match(/^(?:question|q|#)?\s*(\d+)$/i);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function findQuestionByStableNumber({
  env = {},
  sessionSlug = '',
  selector = '',
  questions = [],
  createdAt = null,
} = {}) {
  const number = parseStableQuestionNumberSelector(selector);
  if (!number) return null;
  const ensured = await ensureTelegramQuestionNumbers({ env, sessionSlug, questions, createdAt });
  const qid = ensured.map?.numberToQuestionId?.[String(number)];
  if (!qid) return null;
  return (ensured.questions || questions).find((question) => questionId(question) === qid) || null;
}

export const __test__telegramQuestionNumbers = {
  normalizeNumberMap: normalizeTelegramQuestionNumberMap,
  normalizeTelegramQuestionNumberMap,
  parseStableQuestionNumberSelector,
  telegramQuestionNumberKvKey,
};
