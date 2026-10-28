import { safeString, lower, safeEnvJsonParse as safeJsonParse, sanitizeSessionSlug, stableJson } from './runtimePrimitives.mjs';
import { listKvRecordsByPrefix } from './kvReadHelpers.mjs';
import { canonicalAnswerSessionKvPrefix, submitRequestSessionKvPrefix } from './agentSubmitQueue.mjs';
import { safeAnswerString, firstAnswerValue, questionText, questionId, shortQuestionId } from './runtimeCore.mjs';

export function normalizeResultAnswerLabel(value = '') {
  const label = safeAnswerString(value);
  const normalized = lower(label);
  if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 'Agree';
  if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return 'Disagree';
  if (normalized === 'unsure' || normalized === 'unknown') return 'Unsure';
  return label || 'Response';
}

const compareText = (left, right) => left === right ? 0 : left < right ? -1 : 1;
const answerRevision = record => Number.isSafeInteger(record.answerRevision) && record.answerRevision >= 0 ? record.answerRevision : 0;
const compareAnswers = (left, right) => answerRevision(left) - answerRevision(right) ||
  compareText(safeString(left.createdAt), safeString(right.createdAt)) ||
  compareText(safeString(left.requestId), safeString(right.requestId)) ||
  compareText(stableJson(left), stableJson(right));

export function selectCurrentSubmittedAnswers(records = []) {
  const byParticipantQuestion = new Map();
  const anonymous = [];
  for (const record of Array.isArray(records) ? records : []) {
    const participant = safeString(record.telegramUserId);
    if (!participant) { anonymous.push(record); continue; }
    const key = JSON.stringify([sanitizeSessionSlug(record.sessionSlug) || safeString(record.sessionId), participant, safeString(record.questionId)]);
    const existing = byParticipantQuestion.get(key);
    // A later claim wins even when its upload finishes first. The final
    // content tie-break also makes legacy equal-time records order-independent.
    if (!existing || compareAnswers(existing, record) < 0) byParticipantQuestion.set(key, record);
  }
  return [...byParticipantQuestion.values(), ...anonymous].sort(compareAnswers);
}

export function dedupeSubmitRecords(records = []) {
  const byId = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const requestId = safeString(record.requestId || record.idempotencyKey || record.key);
    if (!requestId) return;
    const existing = byId.get(requestId);
    if (!existing || compareAnswers(existing, record) < 0) {
      byId.set(requestId, record);
    }
  });
  return Array.from(byId.values());
}

export async function loadSubmittedResultRecords(env = {}, sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  const indexedPrefix = submitRequestSessionKvPrefix(slug);
  const indexedRecords = indexedPrefix
    ? await listKvRecordsByPrefix(env, indexedPrefix, { limit: Infinity, parseJson: safeJsonParse })
    : [];
  const canonicalPrefix = canonicalAnswerSessionKvPrefix(slug);
  const canonicalRecords = canonicalPrefix
    ? await listKvRecordsByPrefix(env, canonicalPrefix, { limit: Infinity, parseJson: safeJsonParse })
    : [];
  const records = dedupeSubmitRecords([...indexedRecords, ...canonicalRecords]);
  const submittedStatuses = new Set(['direct_submitted']);
  return records
    .filter((record) => (
      submittedStatuses.has(safeString(record?.status)) &&
      sanitizeSessionSlug(record.sessionSlug) === slug &&
      safeString(record.questionId)
    ))
    .map((record) => {
      const answer = structuredResultAnswer(record);
      return {
        key: safeString(record.key),
        requestId: safeString(record.requestId),
        createdAt: safeString(record.createdAt),
        sessionSlug: slug,
        answerRevision: answerRevision(record),
        telegramUserId: safeString(record.telegramUserId),
        questionId: safeString(record.questionId),
        label: normalizeResultAnswerLabel(firstAnswerValue(
          answer.label,
          answer.value,
          answer.text,
          record.answerLabel,
          record.answerValue,
        )),
        value: safeAnswerString(firstAnswerValue(
          answer.value,
          answer.text,
          answer.label,
          record.answerValue,
          record.answerLabel,
        )),
        questionType: safeString(answer.questionType || record.questionType || record.controlType),
        ...(answer.questionType === 'quadratic' ? { answer: { value: answer.value, encrypted: answer.encrypted === true } } : {}),
        text: safeAnswerString(firstAnswerValue(
          answer.text,
          record.answerText,
        )),
        comments: safeAnswerString(firstAnswerValue(
          answer.comments,
          answer.additionalComments,
          record.comments,
          record.answerComments,
        )),
        txHash: safeString(record.onChain?.txHash),
      };
    })
    .sort((left, right) => safeString(left.createdAt).localeCompare(safeString(right.createdAt)));
}

export function structuredResultAnswer(record = {}) {
  const answer = record.answer && typeof record.answer === 'object' && !Array.isArray(record.answer)
    ? { ...record.answer }
    : {};
  const parsed = safeJsonParse(answer.value || record.answerValue, null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return {
      ...answer,
      ...parsed,
      label: safeString(answer.label || parsed.label),
    };
  }
  return answer;
}

export function questionPromptById(questions = []) {
  const map = new Map();
  for (const question of questions) {
    const id = questionId(question);
    if (id) map.set(id, questionText(question));
  }
  return map;
}

export function consensusQuestionType(question = {}) {
  return lower(question.questionType || question.type || question.controlType);
}

export function questionSupportsConsensus(question = {}) {
  return [
    'agree_unsure_disagree',
    'agree-disagree',
    'binary',
    'boolean',
    'yes_no',
    'yes-no',
  ].includes(consensusQuestionType(question));
}

export function consensusQuestionsForResults(questions = []) {
  return (Array.isArray(questions) ? questions : []).filter(questionSupportsConsensus);
}

export function summarizeQuestionResults(records = [], questions = []) {
  const promptMap = questionPromptById(questions);
  const byQuestion = new Map();
  for (const record of records) {
    if (!byQuestion.has(record.questionId)) {
      byQuestion.set(record.questionId, {
        questionId: record.questionId,
        prompt: promptMap.get(record.questionId) || shortQuestionId(record.questionId),
        total: 0,
        participants: new Set(),
        counts: new Map(),
      });
    }
    const item = byQuestion.get(record.questionId);
    item.total += 1;
    if (record.telegramUserId) item.participants.add(record.telegramUserId);
    item.counts.set(record.label, (item.counts.get(record.label) || 0) + 1);
  }
  return Array.from(byQuestion.values()).map((item) => {
    const counts = Array.from(item.counts.entries()).sort(([left], [right]) => left.localeCompare(right));
    const maxCount = counts.reduce((max, [, count]) => Math.max(max, count), 0);
    const differenceScore = item.total > 0 ? 1 - (maxCount / item.total) : 0;
    return {
      ...item,
      participants: item.participants.size,
      counts,
      differenceScore,
      hasDifference: counts.length > 1,
    };
  }).sort((left, right) => (
    right.differenceScore - left.differenceScore ||
    right.total - left.total ||
    left.prompt.localeCompare(right.prompt)
  ));
}
