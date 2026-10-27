import { safeString, lower, stableFingerprint, nowIso, safeEnvJsonParse as safeJsonParse, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { LEGACY_TRANSPORT_LANES } from './constants.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { buildAgentActivityMetadata } from './agentActivity.mjs';
import { ANSWER_DRAFT_KV_PREFIX, ANSWER_DRAFT_VIEW_KV_PREFIX, DEFAULT_GROUP_SESSION_TTL_SECONDS, questionIdSeedPart, CANONICAL_ANSWER_KINDS } from './runtimeCore.mjs';

export function answerDraftKey({
  normalized = {},
  sessionSlug = '',
  questionId: selectedQuestionId = '',
} = {}) {
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = questionIdSeedPart(selectedQuestionId || 'question');
  return telegramUserId && slug && qid
    ? `${ANSWER_DRAFT_KV_PREFIX}${telegramUserId}:${slug}:${qid}`
    : '';
}

export function answerDraftViewKey({
  normalized = {},
  sessionSlug = '',
  questionId: selectedQuestionId = '',
} = {}) {
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = questionIdSeedPart(selectedQuestionId || 'question');
  return telegramUserId && slug && qid
    ? `${ANSWER_DRAFT_VIEW_KV_PREFIX}${telegramUserId}:${slug}:${qid}`
    : '';
}

export function answerDraftFingerprint(record = {}) {
  return stableFingerprint({
    answerLabel: safeString(record.answerLabel),
    answerValue: safeString(record.answerValue),
    controlType: safeString(record.controlType),
  });
}

export function answerDraftOrigin(record = null) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const origin = record.origin && typeof record.origin === 'object' && !Array.isArray(record.origin)
    ? record.origin
    : null;
  if (origin) {
    return {
      source: safeString(origin.source) || null,
      agentMetadata: origin.agentMetadata && typeof origin.agentMetadata === 'object' && !Array.isArray(origin.agentMetadata)
        ? origin.agentMetadata
        : null,
      answerLabel: safeString(origin.answerLabel),
      answerValue: safeString(origin.answerValue),
      controlType: safeString(origin.controlType),
      fingerprint: safeString(origin.fingerprint) || answerDraftFingerprint(origin),
      savedAt: safeString(origin.savedAt) || null,
    };
  }
  return {
    source: safeString(record.source) || null,
    agentMetadata: record.agentMetadata && typeof record.agentMetadata === 'object' && !Array.isArray(record.agentMetadata)
      ? record.agentMetadata
      : null,
    answerLabel: safeString(record.answerLabel),
    answerValue: safeString(record.answerValue),
    controlType: safeString(record.controlType),
    fingerprint: safeString(record.fingerprint) || answerDraftFingerprint(record),
    savedAt: safeString(record.selectedAt) || null,
  };
}

export async function writeDraftLifecycleEvent() { return false; }

export function canonicalDraftAnswerForm(record = {}) {
  const raw = safeString(record.answerValue);
  const parsed = safeJsonParse(raw, null);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  const type = CANONICAL_ANSWER_KINDS[lower(safeString(source?.questionType))] ||
    CANONICAL_ANSWER_KINDS[lower(safeString(record.controlType))] ||
    'unknown';
  const text = safeString(source ? (source.text ?? source.value ?? '') : raw);
  const comments = safeString(source?.comments);
  if (type === 'binary') {
    return { type, value: lower(safeString(source?.value) || text), comments };
  }
  if (type === 'rating') {
    const candidate = source?.value ?? (text === '' ? null : text);
    const value = candidate === null || candidate === undefined || candidate === ''
      ? NaN
      : Number(candidate);
    return { type, value: Number.isFinite(value) ? value : null, comments };
  }
  if (type === 'quadratic') {
    return { type, value: Array.isArray(source?.value) ? source.value : null, comments };
  }
  if (type === 'multichoice') {
    const values = Array.isArray(source?.values)
      ? source.values.map(safeString).filter(Boolean)
      : (text ? [text] : []);
    return { type, values: [...new Set(values)].sort(), comments };
  }
  return { type, text, comments };
}

export function answerDraftSemanticFingerprint(record = {}) {
  return stableFingerprint(canonicalDraftAnswerForm(record));
}

export function buildDraftDelta(origin = null, finalAnswer = null) {
  if (!origin || !finalAnswer) return null;
  const before = canonicalDraftAnswerForm(origin);
  const after = canonicalDraftAnswerForm(finalAnswer);
  const changed = stableFingerprint(before) !== stableFingerprint(after);
  const kind = after.type !== 'unknown' ? after.type : before.type;
  const delta = { kind, changed };
  if (kind === 'binary') {
    delta.stanceBefore = safeString(before.value);
    delta.stanceAfter = safeString(after.value);
    delta.stanceChanged = delta.stanceBefore !== delta.stanceAfter;
  } else if (kind === 'rating') {
    delta.ratingBefore = Number.isFinite(before.value) ? before.value : null;
    delta.ratingAfter = Number.isFinite(after.value) ? after.value : null;
    delta.ratingShift = delta.ratingBefore !== null && delta.ratingAfter !== null
      ? delta.ratingAfter - delta.ratingBefore
      : null;
  } else if (kind === 'quadratic') {
    const valuesBefore = Array.isArray(before.value) ? before.value : [];
    const valuesAfter = Array.isArray(after.value) ? after.value : [];
    delta.changedOptionCount = Array.from({ length: Math.max(valuesBefore.length, valuesAfter.length) },
      (_, index) => valuesBefore[index] !== valuesAfter[index]).filter(Boolean).length;
  } else if (kind === 'multichoice') {
    const valuesBefore = Array.isArray(before.values) ? before.values : [];
    const valuesAfter = Array.isArray(after.values) ? after.values : [];
    delta.addedValues = valuesAfter.filter((value) => !valuesBefore.includes(value));
    delta.removedValues = valuesBefore.filter((value) => !valuesAfter.includes(value));
  } else {
    const textBefore = safeString(before.text);
    const textAfter = safeString(after.text);
    delta.lengthBefore = textBefore.length;
    delta.lengthAfter = textAfter.length;
    delta.lengthDelta = textAfter.length - textBefore.length;
    delta.textChanged = textBefore !== textAfter;
  }
  const commentsBefore = safeString(before.comments);
  const commentsAfter = safeString(after.comments);
  if (commentsBefore || commentsAfter) delta.commentsChanged = commentsBefore !== commentsAfter;
  return delta;
}

export function buildDraftProvenance({
  draft = null,
  submittedAt = '',
  firstViewedAt = '',
} = {}) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const origin = draft.origin && typeof draft.origin === 'object' && !Array.isArray(draft.origin)
    ? answerDraftOrigin(draft)
    : null;
  const finalAnswer = {
    answerLabel: safeString(draft.answerLabel),
    answerValue: safeString(draft.answerValue),
    controlType: safeString(draft.controlType),
  };
  const finalFingerprint = safeString(draft.fingerprint) || answerDraftFingerprint(draft);
  const finalSemanticFingerprint = safeString(draft.semanticFingerprint) ||
    answerDraftSemanticFingerprint(draft);
  const originSemanticFingerprint = origin ? answerDraftSemanticFingerprint(origin) : '';
  const agentDrafted = safeString(origin?.source) === 'agent_handoff';
  const editedFromOrigin = origin ? originSemanticFingerprint !== finalSemanticFingerprint : null;
  const storedAgentRevision = draft.agentRevision &&
    typeof draft.agentRevision === 'object' && !Array.isArray(draft.agentRevision)
    ? draft.agentRevision
    : null;
  const agentRevision = storedAgentRevision ||
    (agentDrafted ? { semanticFingerprint: originSemanticFingerprint, savedAt: origin?.savedAt || null } : null);
  const submitted = safeString(submittedAt);
  const originSavedAtMs = origin?.savedAt ? Date.parse(origin.savedAt) : NaN;
  const submittedAtMs = submitted ? Date.parse(submitted) : NaN;
  const viewed = safeString(firstViewedAt);
  const viewedAtMs = viewed ? Date.parse(viewed) : NaN;
  const validFirstViewedAt = viewed && (
    !Number.isFinite(originSavedAtMs) ||
    (Number.isFinite(viewedAtMs) && viewedAtMs >= originSavedAtMs)
  ) ? viewed : '';
  return {
    version: 1,
    source: safeString(draft.source) || null,
    origin,
    finalAnswer,
    finalFingerprint,
    finalSemanticFingerprint,
    originSemanticFingerprint: originSemanticFingerprint || null,
    editCount: Number(draft.editCount || 0),
    humanEditCount: Number(draft.humanEditCount || 0),
    lastEditSource: safeString(draft.lastEditSource) || null,
    draftSavedAt: safeString(draft.selectedAt) || null,
    lastEditedAt: safeString(draft.lastEditedAt) || null,
    firstViewedAt: validFirstViewedAt || null,
    submittedAt: submitted || null,
    agentDrafted,
    agentRevisionSavedAt: safeString(agentRevision?.savedAt) || null,
    editedFromOrigin,
    editedFromAgentDraft: agentRevision
      ? safeString(agentRevision.semanticFingerprint) !== finalSemanticFingerprint
      : false,
    draftToSubmitMs: Number.isFinite(originSavedAtMs) && Number.isFinite(submittedAtMs) && submittedAtMs >= originSavedAtMs
      ? submittedAtMs - originSavedAtMs
      : null,
    delta: buildDraftDelta(origin, finalAnswer),
  };
}

export async function readAnswerDraftFirstViewedAt({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
} = {}) {
  const key = answerDraftViewKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return '';
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? safeString(parsed.firstViewedAt)
    : '';
}

export async function readAnswerDraft({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
} = {}) {
  const key = answerDraftKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  assertNoSecretShape(parsed, "Agent answer drafts must not serialize secrets.");
  return { ...parsed, key };
}

export async function persistAnswerDraft({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
  answerLabel = '',
  answerValue = '',
  controlType = '',
  ratingScale = null,
  submitLane = LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
  metadata = null,
  agentMetadata = null,
  createdAt = null,
} = {}) {
  const key = answerDraftKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const existing = typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null)
    : null;
  const previous = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : null;
  const savedAt = createdAt || nowIso();
  const record = {
    version: 2,
    telegramUserId: safeString(normalized.user?.telegramUserId),
    chatId: safeString(normalized.chat?.chatId),
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    questionId: safeString(selectedQuestionId),
    answerLabel: safeString(answerLabel),
    answerValue: safeString(answerValue || answerLabel),
    controlType: safeString(controlType),
    ...(ratingScale ? { ratingScale } : {}),
    status: 'draft_saved',
    submitLane: safeString(submitLane) || LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
    selectedAt: savedAt,
  };
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    record.source = safeString(metadata.source) || null;
    record.actionMetadata = { ...metadata };
  }
  if (agentMetadata && typeof agentMetadata === 'object' && !Array.isArray(agentMetadata)) {
    record.agentMetadata = { ...agentMetadata };
  }
  if (!record.telegramUserId || !record.sessionSlug || !record.questionId || !record.answerLabel) {
    return { ok: false, reason: 'answer_draft_incomplete' };
  }
  record.fingerprint = answerDraftFingerprint(record);
  record.semanticFingerprint = answerDraftSemanticFingerprint(record);
  record.origin = answerDraftOrigin(previous) || {
    source: record.source || null,
    agentMetadata: record.agentMetadata || null,
    answerLabel: record.answerLabel,
    answerValue: record.answerValue,
    controlType: record.controlType,
    fingerprint: record.fingerprint,
    savedAt,
  };
  const previousSemanticFingerprint = previous
    ? (safeString(previous.semanticFingerprint) || answerDraftSemanticFingerprint(previous))
    : '';
  const contentChanged = Boolean(previous) && previousSemanticFingerprint !== record.semanticFingerprint;
  const isAgentWrite = record.source === 'agent_handoff';
  record.editCount = Number(previous?.editCount || 0) + (contentChanged ? 1 : 0);
  record.lastEditedAt = contentChanged ? savedAt : (safeString(previous?.lastEditedAt) || null);
  record.humanEditCount = Number(previous?.humanEditCount || 0) +
    (contentChanged && !isAgentWrite ? 1 : 0);
  record.lastEditSource = contentChanged
    ? (record.source || null)
    : (safeString(previous?.lastEditSource) || null);
  const previousAgentRevision = previous?.agentRevision &&
    typeof previous.agentRevision === 'object' && !Array.isArray(previous.agentRevision)
    ? previous.agentRevision
    : null;
  record.agentRevision = isAgentWrite
    ? { semanticFingerprint: record.semanticFingerprint, savedAt }
    : previousAgentRevision;
  assertNoSecretShape(record, "Agent answer drafts must not serialize secrets.");
  const activityMetadata = buildAgentActivityMetadata({
    type: 'answer_draft',
    status: record.status,
    createdAt: record.selectedAt,
    pendingAction: 'review_draft',
    sessionSlug: record.sessionSlug,
    questionId: record.questionId,
    telegramUserId: record.telegramUserId,
    editCount: record.editCount,
    originSource: record.origin?.source || '',
  });
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(record), {
    expirationTtl: DEFAULT_GROUP_SESSION_TTL_SECONDS,
    metadata: activityMetadata,
  });
  if (!previous || contentChanged) {
    await writeDraftLifecycleEvent(env, {
      event: previous ? 'draft_edited' : 'draft_created',
      sessionSlug: record.sessionSlug,
      questionId: record.questionId,
      source: safeString(record.source),
      originSource: safeString(record.origin?.source),
      controlType: record.controlType,
      editCount: record.editCount,
      telegramUserId: record.telegramUserId,
    });
  }
  return { ok: true, key, draft: record };
}
