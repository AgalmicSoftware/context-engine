import { stableJson, stableFingerprint } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';

export const DRAFT_EDIT_METRIC_KV_PREFIX = 'telegram:draft-edit-metric:v1:';

function safeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
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

function questionIdSeedPart(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{64}$/.test(text) ? `${text.slice(2, 10)}${text.slice(-6)}` : text;
}

function firstValue(...values) {
  return values.find((value) => safeString(value) !== '');
}

function bucketNumber(value, thresholds = []) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
  for (const threshold of thresholds) {
    if (n <= threshold) return `1-${threshold}`;
  }
  const last = thresholds[thresholds.length - 1] || 0;
  return `${last + 1}+`;
}

function textLengthBucket(value = '') {
  return bucketNumber(safeString(value).length, [20, 80, 200, 500, 1000]);
}

function numericDeltaBucket(value = 0) {
  const n = Math.abs(Number(value) || 0);
  if (n === 0) return '0';
  if (n <= 1) return '1';
  if (n <= 3) return '2-3';
  if (n <= 5) return '4-5';
  return '6+';
}

function normalizeQuestionType(value = '') {
  const type = lower(value);
  if (type === 'agree_unsure_disagree' || type === 'binary') return 'binary';
  if (type === 'rating' || type === 'rating_button') return 'rating';
  if (type === 'multichoice' || type === 'multi_select_toggle' || type === 'multiple_choice') return 'multichoice';
  if (type === 'freeform' || type === 'freeform_text' || type === 'text') return 'freeform';
  return type || 'freeform';
}

function normalizeBinaryValue(value) {
  const raw = lower(value);
  if (['agree', 'yes', 'true', '1', 'support'].includes(raw)) return 'agree';
  if (['disagree', 'no', 'false', '0', 'oppose'].includes(raw)) return 'disagree';
  if (['unsure', 'maybe', 'unknown', 'not_sure', 'not sure', 'depends'].includes(raw)) return 'unsure';
  return raw;
}

function normalizeChoice(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return safeString(firstValue(value.value, value.id, value.label, value.text, value.answer));
  }
  return safeString(value);
}

function normalizeChoiceList(source = {}) {
  const values = Array.isArray(source.values)
    ? source.values
    : Array.isArray(source.value)
      ? source.value
      : Array.isArray(source.answer)
        ? source.answer
        : [firstValue(source.value, source.answer, source.choice, source.label)];
  return [...new Set(values.map(normalizeChoice).map(lower).filter(Boolean))].sort();
}

export function answerFromStoredDraft(draft = {}) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const parsed = safeJsonParse(draft.answerValue, null);
  const base = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : { value: draft.answerValue || draft.answerLabel };
  return {
    ...base,
    label: base.label || draft.answerLabel || '',
    questionType: normalizeQuestionType(base.questionType || draft.controlType),
    controlType: draft.controlType || base.controlType || '',
  };
}

export function answerFromAgentInitial(source = {}) {
  const raw = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const initial = raw.initialAnswer || raw.initialDraft || raw.suggestedAnswer || raw.agentDraft ||
    raw.originalAnswer || raw.previousAnswer || raw.draftAnswer || null;
  if (!initial) return null;
  return initial && typeof initial === 'object' && !Array.isArray(initial) ? initial : { value: initial };
}

function normalizeAnswerForMetric(answer = null, questionType = '') {
  if (!answer) return null;
  const source = answer && typeof answer === 'object' && !Array.isArray(answer)
    ? answer
    : { value: answer };
  const type = normalizeQuestionType(questionType || source.questionType || source.controlType);
  const comments = safeString(source.comments || source.additionalComments || source.reason || source.rationale || source.comment);
  if (type === 'binary') {
    const value = normalizeBinaryValue(firstValue(source.value, source.answer, source.choice, source.stance, source.label));
    return value ? { type, value, comments } : { type, comments };
  }
  if (type === 'rating') {
    const value = Number(firstValue(source.value, source.rating, source.answer, source.label));
    return Number.isFinite(value) ? { type, value, comments } : { type, comments };
  }
  if (type === 'multichoice') {
    return { type, values: normalizeChoiceList(source), comments };
  }
  const text = safeString(firstValue(source.text, source.value, source.answer, source.label));
  return { type: 'freeform', text, comments };
}

function binaryTransition(from = '', to = '') {
  if (!from || !to) return 'unknown';
  if (from === to) return 'same';
  if ((from === 'agree' && to === 'disagree') || (from === 'disagree' && to === 'agree')) return 'opposite';
  if (to === 'unsure') return 'to_unsure';
  if (from === 'unsure') return 'from_unsure';
  return 'changed';
}

function buildMultichoiceMetrics(draft = {}, sent = {}) {
  const draftValues = new Set(Array.isArray(draft.values) ? draft.values : []);
  const sentValues = new Set(Array.isArray(sent.values) ? sent.values : []);
  const added = [...sentValues].filter((value) => !draftValues.has(value)).length;
  const removed = [...draftValues].filter((value) => !sentValues.has(value)).length;
  const intersection = [...sentValues].filter((value) => draftValues.has(value)).length;
  const union = new Set([...draftValues, ...sentValues]).size;
  const jaccard = union ? intersection / union : 1;
  return {
    draftCount: draftValues.size,
    finalCount: sentValues.size,
    addedCount: added,
    removedCount: removed,
    intersectionCount: intersection,
    jaccardBucket: jaccard === 1 ? '1' : jaccard >= 0.75 ? '0.75-0.99' : jaccard >= 0.5 ? '0.5-0.74' : jaccard > 0 ? '0.01-0.49' : '0',
  };
}

export function buildDraftEditMetricSummary({
  questionType = '',
  draftAnswer = null,
  sentAnswer = null,
} = {}) {
  const type = normalizeQuestionType(questionType);
  const draft = normalizeAnswerForMetric(draftAnswer, type);
  const sent = normalizeAnswerForMetric(sentAnswer, type);
  if (!draft || !sent) return null;
  const metrics = {
    questionType: type,
    answerChanged: false,
    commentChanged: draft.comments !== sent.comments,
    draftCommentLengthBucket: textLengthBucket(draft.comments),
    finalCommentLengthBucket: textLengthBucket(sent.comments),
    commentLengthDeltaBucket: numericDeltaBucket(safeString(sent.comments).length - safeString(draft.comments).length),
  };
  if (type === 'binary') {
    metrics.binaryFrom = draft.value || '';
    metrics.binaryTo = sent.value || '';
    metrics.binaryTransition = binaryTransition(metrics.binaryFrom, metrics.binaryTo);
    metrics.answerChanged = metrics.binaryTransition !== 'same' && metrics.binaryTransition !== 'unknown';
  } else if (type === 'rating') {
    const delta = Number(sent.value) - Number(draft.value);
    metrics.ratingFrom = Number.isFinite(Number(draft.value)) ? Number(draft.value) : null;
    metrics.ratingTo = Number.isFinite(Number(sent.value)) ? Number(sent.value) : null;
    metrics.ratingDelta = Number.isFinite(delta) ? delta : null;
    metrics.ratingDirection = !Number.isFinite(delta) || delta === 0 ? 'same' : delta > 0 ? 'up' : 'down';
    metrics.ratingAbsDeltaBucket = numericDeltaBucket(delta);
    metrics.answerChanged = metrics.ratingDirection !== 'same';
  } else if (type === 'multichoice') {
    Object.assign(metrics, buildMultichoiceMetrics(draft, sent));
    metrics.answerChanged = metrics.addedCount > 0 || metrics.removedCount > 0;
  } else {
    metrics.draftTextLengthBucket = textLengthBucket(draft.text);
    metrics.finalTextLengthBucket = textLengthBucket(sent.text);
    metrics.textLengthDeltaBucket = numericDeltaBucket(safeString(sent.text).length - safeString(draft.text).length);
    metrics.answerChanged = safeString(draft.text) !== safeString(sent.text);
  }
  metrics.changed = metrics.answerChanged === true || metrics.commentChanged === true;
  return metrics;
}

async function sha256Hex(value = '') {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function' || typeof TextEncoder === 'undefined') return '';
  const bytes = new TextEncoder().encode(value);
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function participantRef({ env = {}, telegramUserId = '', sessionSlug = '' } = {}) {
  const rootSecret = safeString(env.DEMO_SIGNER_ROOT_SECRET || env.AGENT_BRIDGE_DEMO_ROOT_SECRET || env.MANAGED_ACCOUNT_ROOT_SECRET);
  if (!rootSecret || !telegramUserId || !sessionSlug) return '';
  const seed = stableJson({
    purpose: 'telegram_draft_edit_metric_participant',
    rootSecret,
    telegramUserId,
    sessionSlug,
  });
  const digest = await sha256Hex(seed);
  if (digest) return digest.slice(0, 24);
  return stableFingerprint(seed);
}

export async function persistDraftEditMetric({
  env = {},
  telegramUserId = '',
  sessionSlug = '',
  questionId = '',
  questionType = '',
  draftAnswer = null,
  sentAnswer = null,
  source = '',
  finality = '',
  createdAt = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return { ok: false, stored: false, reason: 'action_kv_unavailable' };
  const user = safeString(telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = safeString(questionId);
  const metrics = buildDraftEditMetricSummary({ questionType, draftAnswer, sentAnswer });
  if (!user || !slug || !qid || !metrics) {
    return { ok: false, stored: false, reason: 'draft_edit_metric_incomplete' };
  }
  const recordedAt = createdAt || new Date().toISOString();
  const participant = await participantRef({ env, telegramUserId: user, sessionSlug: slug });
  const fingerprint = stableFingerprint({
    user,
    slug,
    qid,
    source,
    finality,
    recordedAt,
    metrics,
  });
  const key = `${DRAFT_EDIT_METRIC_KV_PREFIX}${slug}:${questionIdSeedPart(qid)}:${fingerprint}`;
  const record = {
    type: 'telegram_draft_edit_metric',
    version: 1,
    sessionSlug: slug,
    questionId: qid,
    questionType: metrics.questionType,
    source: safeString(source).slice(0, 80),
    finality: safeString(finality).slice(0, 80),
    participantRef: participant,
    metrics,
    createdAt: recordedAt,
  };
  assertNoSecretShape(record, 'Telegram draft-edit metric records must not serialize secrets.');
  await kv.put(key, JSON.stringify(record));
  return { ok: true, stored: true, key, metrics };
}
