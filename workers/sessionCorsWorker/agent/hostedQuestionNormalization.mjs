import { safeString, lower, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { listAgentProposedQuestionsForSessionWithSummary, mergeAgentProposedQuestions } from './agentQuestionProposals.mjs';

export function questionPayloadRoot(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  for (const candidate of [
    payload,
    payload.question,
    payload.questionData,
    payload.metadata,
    payload.data,
  ]) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const hasQuestionShape = candidate.id ||
        candidate.questionId ||
        candidate.prompt ||
        candidate.questionText ||
        candidate.title ||
        candidate.type ||
        candidate.questionType;
      if (hasQuestionShape) return candidate;
    }
  }
  return payload;
}

export function normalizePreloadedQuestionRecord(entry = {}, {
  index = 0,
  fallbackSessionSlug = '',
  source = 'telegram_only_preloaded_questions',
} = {}) {
  const root = questionPayloadRoot(entry);
  if (!root) return null;
  const sessionSlug = sanitizeSessionSlug(root.sessionSlug || root.session || entry.sessionSlug || entry.session || fallbackSessionSlug);
  const storageRef = root.storageRef && typeof root.storageRef === 'object' && !Array.isArray(root.storageRef)
    ? root.storageRef
    : (entry.storageRef && typeof entry.storageRef === 'object' && !Array.isArray(entry.storageRef) ? entry.storageRef : null);
  const id = safeString(
    root.questionId ||
    root.id ||
    entry.questionId ||
    entry.id ||
    storageRef?.id ||
      `telegram-only-${sessionSlug || 'session'}-${index + 1}`,
  );
  if (!id) return null;
  const visibility = lower(root.visibility || root.accessMode || entry.visibility || 'public') || 'public';
  const locked = root.locked === true || entry.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
  const prompt = locked
    ? ''
    : safeString(root.questionText || root.prompt || root.title || entry.questionText || entry.prompt || entry.title);
  const payloadUnavailable = !locked && !prompt;
  const normalized = {
    ...entry,
    ...root,
    questionId: id,
    questionType: safeString(root.questionType || root.type || entry.questionType || entry.type || 'freeform'),
    type: safeString(root.questionType || root.type || entry.questionType || entry.type || 'freeform'),
    prompt: payloadUnavailable ? '' : prompt,
    questionText: payloadUnavailable ? '' : prompt,
    title: payloadUnavailable
      ? 'Question unavailable'
      : (prompt || (locked ? 'Locked question' : 'Untitled question')),
    options: Array.isArray(root.options)
      ? root.options.slice()
      : (Array.isArray(entry.options) ? entry.options.slice() : []),
    visibility: payloadUnavailable ? 'payload_unavailable' : visibility,
    locked,
    source,
    sessionSlug,
    ...(storageRef ? { storageRef } : {}),
  };
  if (payloadUnavailable) {
    normalized.payloadUnavailable = true;
    normalized.payloadUnavailableReason = 'telegram_only_question_payload_missing_prompt';
  }
  return normalized;
}

export function normalizeQuestionLoadLimit(value = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export function questionIdLookupSet(values = []) {
  return new Set((Array.isArray(values) ? values : [])
    .map((value) => lower(value))
    .filter(Boolean));
}

export function cloudflareQuestionItemIds(item = {}) {
  const storageRef = item?.storageRef && typeof item.storageRef === 'object' && !Array.isArray(item.storageRef)
    ? item.storageRef
    : {};
  return [
    storageRef.id,
    storageRef.questionId,
    item?.metadata?.resourceId,
    item?.id,
    item?.questionId,
    item?.key,
    item?.name,
  ].map(lower).filter(Boolean);
}

export function selectWorkerCloudflareQuestionItems(items = [], {
  questionLimit = 0,
  preferredQuestionIds = [],
} = {}) {
  const source = Array.isArray(items) ? items : [];
  const limit = normalizeQuestionLoadLimit(questionLimit);
  if (!limit) return source;
  const preferred = questionIdLookupSet(preferredQuestionIds);
  if (!preferred.size) return source.slice(0, limit);
  const selected = [];
  const selectedIndexes = new Set();
  source.forEach((item, index) => {
    if (cloudflareQuestionItemIds(item).some((id) => preferred.has(id))) {
      selected.push(item);
      selectedIndexes.add(index);
    }
  });
  const targetCount = Math.max(limit, selected.length || 0);
  for (let index = 0; index < source.length && selected.length < targetCount; index += 1) {
    if (selectedIndexes.has(index)) continue;
    selected.push(source[index]);
  }
  return selected;
}

export function questionIsPayloadUnavailable(question = {}) {
  return question?.payloadUnavailable === true || lower(question?.visibility) === 'payload_unavailable';
}

export function questionIsLocked(question = {}) {
  const visibility = lower(question?.visibility);
  return question?.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
}

export function questionTextValueIsString(value) {
  if (value === undefined || value === null) return true;
  return typeof value === 'string';
}

export function questionTagsShapeIsValid(value) {
  if (value === undefined) return true;
  if (value === null) return false;
  return Array.isArray(value) || typeof value === 'string';
}

export function firstQuestionTextValue(question = {}) {
  if (question.questionText !== undefined && question.questionText !== null) return question.questionText;
  if (question.prompt !== undefined && question.prompt !== null) return question.prompt;
  if (question.title !== undefined && question.title !== null) return question.title;
  return '';
}

export function cloudflareQuestionItemHasInlinePayload(item = {}) {
  const root = questionPayloadRoot(item);
  if (!root) return false;
  for (const value of [root.questionText, root.prompt, item?.questionText, item?.prompt]) {
    if (value === undefined || value === null || typeof value !== 'string') continue;
    if (safeString(value)) return true;
  }
  return false;
}

export function questionRecordMalformedReason(question = {}) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) return 'record_not_object';
  let qid = '';
  try {
    qid = safeString(question.questionId || question.id);
  } catch {
    return 'question_id_invalid';
  }
  if (!qid) return 'question_id_missing';
  if (!questionTagsShapeIsValid(question.tags)) return 'question_tags_invalid';
  const textValue = firstQuestionTextValue(question);
  if (!questionTextValueIsString(textValue)) return 'question_prompt_invalid';
  let locked = false;
  let unavailable = false;
  try {
    locked = questionIsLocked(question);
    unavailable = questionIsPayloadUnavailable(question);
  } catch {
    return 'question_visibility_invalid';
  }
  if (!locked && !unavailable) {
    let prompt = '';
    try {
      prompt = safeString(textValue);
    } catch {
      return 'question_prompt_invalid';
    }
    if (!prompt) return 'question_prompt_missing';
  }
  return '';
}

export function orderQuestionsForPresentationWithSummary(questions = []) {
  const rows = [];
  let skippedMalformed = 0;
  (Array.isArray(questions) ? questions : []).forEach((question, index) => {
    try {
      if (questionRecordMalformedReason(question)) {
        skippedMalformed += 1;
        return;
      }
      rows.push({ question, index });
    } catch {
      skippedMalformed += 1;
    }
  });
  rows.sort((left, right) => {
    let leftRank = 2;
    let rightRank = 2;
    try {
      leftRank = questionPresentationRank(left.question);
    } catch {
      leftRank = 2;
    }
    try {
      rightRank = questionPresentationRank(right.question);
    } catch {
      rightRank = 2;
    }
    return leftRank - rightRank || left.index - right.index;
  });
  return {
    questions: rows.map(({ question }) => question),
    skippedMalformed,
  };
}

export function withSkippedMalformed(result = {}, skippedMalformed = 0) {
  const count = Number(skippedMalformed || 0) || 0;
  if (count <= 0) return result;
  return {
    ...result,
    skippedMalformed: (Number(result.skippedMalformed || 0) || 0) + count,
  };
}

export function questionPresentationRank(question = {}) {
  if (questionIsPayloadUnavailable(question)) return 2;
  if (questionIsLocked(question)) return 1;
  return 0;
}

export function orderQuestionsForPresentation(questions = []) {
  return orderQuestionsForPresentationWithSummary(questions).questions;
}

export async function withAgentProposedQuestions(env = {}, sessionSlug = '', result = {}) {
  const proposedSummary = await listAgentProposedQuestionsForSessionWithSummary(env, sessionSlug);
  // A canonical read failure outranks the proposal cap; keep its reason.
  if (proposedSummary.complete === false) {
    result = { ...result, complete: false, reason: result.complete === false && result.reason ? result.reason : proposedSummary.reason };
  }
  const proposed = Array.isArray(proposedSummary.questions) ? proposedSummary.questions : [];
  const baseSummary = orderQuestionsForPresentationWithSummary(result.questions || []);
  const skippedMalformed = (Number(proposedSummary.skippedMalformed || 0) || 0) + baseSummary.skippedMalformed;
  if (!proposed.length) {
    if (skippedMalformed <= 0) return result;
    return withSkippedMalformed({
      ...result,
      questions: baseSummary.questions,
      questionCount: baseSummary.questions.length,
    }, skippedMalformed);
  }
  const mergedSummary = orderQuestionsForPresentationWithSummary(mergeAgentProposedQuestions(baseSummary.questions, proposed));
  const questions = mergedSummary.questions;
  return {
    ...withSkippedMalformed(result, skippedMalformed + mergedSummary.skippedMalformed),
    ok: result.ok !== false || questions.length > 0,
    reason: result.ok === false && questions.length > 0
      ? 'proposed_questions_loaded_with_source_warning'
      : result.reason,
    questions,
    questionCount: questions.length,
    proposedQuestionCount: proposed.length,
  };
}
