import {
  safeString,
  lower,
  nowIso,
  safeJsonParse,
  sanitizeSessionSlug,
} from './runtimePrimitives.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { buildTelegramAgentActivityMetadata } from './telegramAgentActivity.mjs';
import { assignTelegramQuestionNumber } from './telegramQuestionNumbers.mjs';

const PROPOSED_QUESTION_KV_PREFIX = 'telegram:proposed-question:';
const PROPOSED_QUESTION_ID_PREFIX = 'ceq_';
const DEFAULT_PROPOSED_QUESTION_TTL_SECONDS = 90 * 24 * 60 * 60;
const SUPPORTED_QUESTION_TYPES = new Set(['binary', 'freeform', 'rating', 'multichoice']);
const MAX_QUESTION_TAGS = 10;
const MAX_QUESTION_TAG_LENGTH = 48;
const MAX_QUESTION_GEO_REFS = 10;
const MAX_QUESTION_GEO_ID_LENGTH = 96;
const MAX_QUESTION_GEO_LABEL_LENGTH = 160;
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

function normalizeQuestionType(value = '') {
  const type = lower(value).replace(/_/g, '-');
  if (type === 'agree-disagree' || type === 'agree-unsure-disagree') return 'binary';
  if (type === 'single-choice') return 'multichoice';
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
    geoTagsFromRefs(firstString(question.geoId, metadata.geoId, payload.geoId)),
    geoTagsFromRefs(question.geoRefs || question.geoIds || metadata.geoRefs || metadata.geoIds || payload.geoRefs || payload.geoIds),
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

function leadingNumber(value) {
  const match = safeString(value).match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeRatingScale(value = {}, options = []) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const optionNumbers = normalizeOptions(options)
    .map((option) => leadingNumber(option))
    .filter((number) => Number.isFinite(number));
  let min = Number(source.min ?? source.minimum);
  let max = Number(source.max ?? source.maximum);
  let step = Number(source.step ?? source.interval);
  if (!Number.isFinite(min) && optionNumbers.length >= 2) min = Math.min(...optionNumbers);
  if (!Number.isFinite(max) && optionNumbers.length >= 2) max = Math.max(...optionNumbers);
  if (!Number.isFinite(step)) {
    const sorted = [...new Set(optionNumbers)].sort((left, right) => left - right);
    const diffs = sorted.slice(1).map((number, index) => number - sorted[index]).filter((number) => number > 0);
    step = diffs.length ? Math.min(...diffs) : 1;
  }
  min = Math.floor(min);
  max = Math.floor(max);
  step = Math.floor(step);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
  if (!Number.isFinite(step) || step < 1) step = 1;
  min = Math.max(-100, Math.min(100, min));
  max = Math.max(-100, Math.min(100, max));
  if (Math.floor((max - min) / step) + 1 > 21) return null;
  return { min, max, step };
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

export function normalizeGeoId(value = '') {
  return safeString(value)
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_QUESTION_GEO_ID_LENGTH);
}

export function normalizeQuestionGeoRefs(value = []) {
  const source = Array.isArray(value)
    ? value
    : safeString(value).split(/[\n,;|]+/);
  const seen = new Set();
  const refs = [];
  source.forEach((entry) => {
    const raw = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry
      : { geoId: entry };
    const geoId = normalizeGeoId(firstString(raw.geoId, raw.id, raw.nodeId, raw.value));
    if (!geoId || seen.has(geoId)) return;
    seen.add(geoId);
    const ref = { geoId };
    const label = safeString(raw.label || raw.title || raw.name).replace(/\s+/g, ' ').slice(0, MAX_QUESTION_GEO_LABEL_LENGTH);
    if (label) ref.label = label;
    const url = normalizeReferenceUrl(raw.url || raw.href);
    if (url) ref.url = url;
    refs.push(ref);
  });
  return refs.slice(0, MAX_QUESTION_GEO_REFS);
}

export function geoTagsFromRefs(value = []) {
  return normalizeQuestionGeoRefs(value).map((ref) => `geo:${normalizeQuestionTag(ref.geoId)}`).filter(Boolean);
}

function proposedQuestionPrefix(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${PROPOSED_QUESTION_KV_PREFIX}${slug}:` : '';
}

function normalizeProposedQuestionId(value = '') {
  // Validate, never sanitize: stripping characters would alias a malformed id
  // (e.g. "ceq_abc!") onto a different record's key ("ceq_abc").
  const id = safeString(value);
  if (!id.startsWith(PROPOSED_QUESTION_ID_PREFIX) || id.length > 96) return '';
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : '';
}

function proposedQuestionKey(sessionSlug = '', questionId = '') {
  const prefix = proposedQuestionPrefix(sessionSlug);
  const id = normalizeProposedQuestionId(questionId);
  return prefix && id ? `${prefix}${id}` : '';
}

async function readProposedQuestionMetadata(env = {}, key = '') {
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.list !== 'function') return null;
  const listed = await kv.list({ prefix: key, limit: 1 }).catch(() => null);
  const entry = (Array.isArray(listed?.keys) ? listed.keys : [])
    .find((item) => safeString(item?.name || item) === key);
  const metadata = entry && typeof entry === 'object' && !Array.isArray(entry)
    ? entry.metadata
    : null;
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : null;
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
  return `${PROPOSED_QUESTION_ID_PREFIX}${buildOpaqueActionId(seed).replace(/^ceab_/, '')}`;
}

function proposedRecordToQuestion(record = {}) {
  const questionId = safeString(record.questionId);
  const prompt = normalizePrompt(record.prompt || record.questionText);
  if (!questionId || !prompt) return null;
  const questionType = normalizeQuestionType(record.questionType);
  const tags = normalizeQuestionTags(record.tags);
  const references = normalizeQuestionReferences(record.references);
  const geoRefs = normalizeQuestionGeoRefs(record.geoRefs || record.geoIds || record.geoId);
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
  if (questionType === 'multichoice' && record.singleSelect === true) {
    question.singleSelect = true;
  }
  if (questionType === 'rating') {
    const ratingScale = normalizeRatingScale(record.ratingScale || record.rating_scale, options);
    if (ratingScale) question.ratingScale = ratingScale;
  }
  if (tags.length) question.tags = tags;
  if (references.length) question.references = references;
  if (geoRefs.length) question.geoRefs = geoRefs;
  return question;
}

function questionTextValueIsString(value) {
  if (value === undefined || value === null) return true;
  return typeof value === 'string';
}

function questionTagsShapeIsValid(value) {
  if (value === undefined) return true;
  if (value === null) return false;
  return Array.isArray(value) || typeof value === 'string';
}

function proposedRecordMalformedReason(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'record_not_object';
  let questionId = '';
  try {
    questionId = safeString(record.questionId);
  } catch {
    return 'question_id_invalid';
  }
  if (!questionId) return 'question_id_missing';
  const promptValue = record.prompt ?? record.questionText;
  if (!questionTextValueIsString(promptValue)) return 'question_prompt_invalid';
  let prompt = '';
  try {
    prompt = normalizePrompt(promptValue);
  } catch {
    return 'question_prompt_invalid';
  }
  if (!prompt) return 'question_prompt_missing';
  if (!questionTagsShapeIsValid(record.tags)) return 'question_tags_invalid';
  return '';
}

export async function persistTelegramProposedQuestion({
  env = {},
  normalized = {},
  sessionSlug = '',
  prompt = '',
  questionType = 'freeform',
  options = [],
  ratingScale = null,
  tags = [],
  references = [],
  geoRefs = [],
  singleSelect = false,
  sessionContext = '',
  metadata = null,
  createdAt = null,
  ttlSeconds = DEFAULT_PROPOSED_QUESTION_TTL_SECONDS,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const promptText = normalizePrompt(prompt);
  const type = normalizeQuestionType(questionType);
  const normalizedOptions = normalizeOptions(options);
  const normalizedRatingScale = type === 'rating'
    ? normalizeRatingScale(ratingScale, normalizedOptions)
    : null;
  const normalizedReferences = normalizeQuestionReferences(references);
  const normalizedGeoRefs = normalizeQuestionGeoRefs(geoRefs);
  const normalizedSessionContext = normalizeSessionContext(sessionContext);
  const explicitTagList = normalizeQuestionTags([
    ...geoTagsFromRefs(normalizedGeoRefs),
    ...(Array.isArray(tags) ? tags : normalizeQuestionTags(tags)),
  ]);
  const normalizedTags = explicitTagList.length
    ? explicitTagList
    : inferQuestionTags({
      prompt: promptText,
      questionType: type,
      options: normalizedOptions,
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
    ...(normalizedRatingScale ? { ratingScale: normalizedRatingScale } : {}),
    ...(type === 'multichoice' && singleSelect === true ? { singleSelect: true } : {}),
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
  const assigned = await assignTelegramQuestionNumber({
    env,
    sessionSlug: slug,
    questionId,
    createdAt: record.createdAt,
  });
  if (assigned.ok) record.stableQuestionNumber = assigned.number;
  return {
    ok: true,
    questionId,
    question: assigned.ok
      ? { ...proposedRecordToQuestion(record), stableQuestionNumber: assigned.number }
      : proposedRecordToQuestion(record),
    record,
  };
}

export async function archiveTelegramProposedQuestion({
  env = {},
  sessionSlug = '',
  questionId = '',
  now = null,
} = {}) {
  const id = normalizeProposedQuestionId(questionId);
  if (!id) return { ok: true, result: 'not_proposed' };
  const key = proposedQuestionKey(sessionSlug, id);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    throw new Error('proposed_question_storage_unavailable');
  }
  const existingText = await kv.get(key);
  if (!existingText) return { ok: true, result: 'not_found' };
  const existing = safeJsonParse(existingText, null);
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    throw new Error('proposed_question_record_invalid');
  }
  const record = {
    ...existing,
    status: 'archived',
    archivedAt: lower(existing.status) === 'archived' && safeString(existing.archivedAt)
      ? safeString(existing.archivedAt)
      : nowIso(now),
    archivedBy: 'service',
  };
  assertNoSecretShape(record, 'Telegram proposed questions must not serialize secrets.');
  const existingMetadata = await readProposedQuestionMetadata(env, key);
  const metadata = existingMetadata
    ? { ...existingMetadata, s: 'archived' }
    : buildTelegramAgentActivityMetadata({
      type: 'proposed_question',
      status: record.status,
      createdAt: record.createdAt,
      pendingAction: '',
      sessionSlug: record.sessionSlug,
      questionId: record.questionId,
      telegramUserId: record.createdByTelegramUserId,
    });
  assertNoSecretShape(metadata, 'Telegram proposed question metadata must not serialize secrets.');
  await kv.put(key, JSON.stringify(record), {
    expirationTtl: DEFAULT_PROPOSED_QUESTION_TTL_SECONDS,
    metadata,
  });
  return { ok: true, result: 'archived' };
}

export async function deleteTelegramProposedQuestion({
  env = {},
  sessionSlug = '',
  questionId = '',
} = {}) {
  const id = normalizeProposedQuestionId(questionId);
  if (!id) return { ok: true, result: 'not_proposed' };
  const key = proposedQuestionKey(sessionSlug, id);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function' || typeof kv.delete !== 'function') {
    throw new Error('proposed_question_storage_unavailable');
  }
  const existingText = await kv.get(key);
  if (!existingText) return { ok: true, result: 'not_found' };
  await kv.delete(key);
  return { ok: true, result: 'deleted' };
}

export async function listTelegramProposedQuestionsForSessionWithSummary(env = {}, sessionSlug = '') {
  const prefix = proposedQuestionPrefix(sessionSlug);
  if (!prefix || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.list !== 'function') {
    return { questions: [], skippedMalformed: 0 };
  }
  const records = [];
  let skippedMalformed = 0;
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
      try {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          skippedMalformed += 1;
          continue;
        }
        assertNoSecretShape(parsed, 'Telegram proposed questions must not serialize secrets.');
        if (parsed.status && lower(parsed.status) !== 'active') continue;
        if (proposedRecordMalformedReason(parsed)) {
          skippedMalformed += 1;
          continue;
        }
        const question = proposedRecordToQuestion(parsed);
        if (question) {
          records.push(question);
        } else {
          skippedMalformed += 1;
        }
      } catch {
        skippedMalformed += 1;
      }
    }
    if (listed?.list_complete !== false || !listed?.cursor) break;
    cursor = listed.cursor;
  }
  return { questions: records, skippedMalformed };
}

export async function listTelegramProposedQuestionsForSession(env = {}, sessionSlug = '') {
  const summary = await listTelegramProposedQuestionsForSessionWithSummary(env, sessionSlug);
  return summary.questions;
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
  PROPOSED_QUESTION_ID_PREFIX,
  inferQuestionTags,
  normalizeQuestionTag,
  normalizeQuestionReferences,
  normalizeGeoId,
  normalizeQuestionGeoRefs,
  normalizeQuestionTags,
  normalizeQuestionType,
  normalizeSessionContext,
  normalizeProposedQuestionId,
  proposedQuestionKey,
  proposedQuestionPrefix,
  questionIdFromPrompt,
  proposedRecordToQuestion,
  proposedRecordMalformedReason,
  sessionContextFromPolicySession,
};
