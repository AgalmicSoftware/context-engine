import {
  safeString,
  safeJsonParse,
  nowIsoOrCurrent,
  sanitizeSessionSlug,
} from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';

export const AGENT_QUESTION_NUMBER_KV_PREFIX = 'telegram:question-number:';

function normalizeQuestionId(value = '') {
  return safeString(value).slice(0, 256);
}

export function agentQuestionNumberKvKey(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${AGENT_QUESTION_NUMBER_KV_PREFIX}${slug}` : '';
}

export function normalizeAgentQuestionNumberMap(raw = {}, sessionSlug = '') {
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
  const key = agentQuestionNumberKvKey(sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return normalizeAgentQuestionNumberMap({}, sessionSlug);
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), {});
  return normalizeAgentQuestionNumberMap(parsed || {}, sessionSlug);
}

async function persistQuestionNumberMap(env = {}, map = {}, createdAt = null) {
  const key = agentQuestionNumberKvKey(map.sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const record = normalizeAgentQuestionNumberMap({ ...map, updatedAt: nowIsoOrCurrent(createdAt) }, map.sessionSlug);
  assertNoSecretShape(record, "Agent question number map must not serialize secrets.");
  await kv.put(key, JSON.stringify(record));
  return { ok: true, key, record };
}

export async function assignAgentQuestionNumber({
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
