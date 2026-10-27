import { safeString, lower } from './runtimePrimitives.mjs';
import { safeAnswerString, questionId, shortQuestionId } from './runtimeCore.mjs';
import { questionPromptById } from './submittedResults.mjs';

export function participantAlias(id = '', index = 0) {
  return `P${index + 1}`;
}

export function answerScore(label = '', value = '') {
  const text = lower(value || label);
  if (!text) return 0;
  if (/\b(agree|yes|true|support|approve)\b/.test(text)) return 1;
  if (/\b(disagree|no|false|oppose|reject)\b/.test(text)) return -1;
  if (/\b(unsure|unknown|neutral|mixed|abstain)\b/.test(text)) return 0;
  const numeric = Number(text.match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric >= 1 && numeric <= 5) return Math.max(-1, Math.min(1, (numeric - 3) / 2));
  if (numeric >= 0 && numeric <= 10) return Math.max(-1, Math.min(1, (numeric - 5) / 5));
  return Math.max(-1, Math.min(1, numeric));
}

export function averageAnswerScore(records = []) {
  const scored = records
    .map((record) => answerScore(record.label, record.value))
    .filter((score) => Number.isFinite(score));
  if (!scored.length) return 0;
  return scored.reduce((sum, score) => sum + score, 0) / scored.length;
}

export function countResultVotes(records = []) {
  const counts = { agree: 0, disagree: 0, unsure: 0, responded: 0 };
  for (const record of records) {
    const score = answerScore(record.label, record.value);
    if (score > 0.25) counts.agree += 1;
    else if (score < -0.25) counts.disagree += 1;
    else counts.unsure += 1;
    counts.responded += 1;
  }
  return {
    ...counts,
    agreeRate: counts.responded ? Number(((counts.agree * 100) / counts.responded).toFixed(1)) : 0,
    disagreeRate: counts.responded ? Number(((counts.disagree * 100) / counts.responded).toFixed(1)) : 0,
    unsureRate: counts.responded ? Number(((counts.unsure * 100) / counts.responded).toFixed(1)) : 0,
  };
}

export function questionTypeById(questions = []) {
  const map = new Map();
  for (const question of questions) {
    const id = questionId(question);
    if (id) map.set(id, lower(question.questionType || question.type || question.controlType));
  }
  return map;
}

export function qualitativeTextFromResultRecord(record = {}, questionTypeLookup = new Map()) {
  const type = lower(record.questionType || questionTypeLookup.get(record.questionId));
  const text = safeAnswerString(record.text);
  const comments = safeAnswerString(record.comments);
  const parts = [];
  if (type === 'freeform' && text) parts.push(text);
  if (comments) parts.push(comments);
  return parts.join(' ').trim();
}

export function qualitativeResponsesForGroup({
  records = [],
  aliases = new Map(),
  questionIndex = new Map(),
  promptMap = new Map(),
  questionTypeLookup = new Map(),
  limit = 8,
} = {}) {
  const responses = [];
  for (const record of records) {
    const text = qualitativeTextFromResultRecord(record, questionTypeLookup);
    if (!text) continue;
    responses.push({
      participant: aliases.get(record.telegramUserId) || 'Participant',
      questionId: record.questionId,
      questionLabel: questionIndex.get(record.questionId) || 'Q?',
      prompt: promptMap.get(record.questionId) || shortQuestionId(record.questionId),
      text: text.slice(0, 500),
    });
    if (responses.length >= limit) break;
  }
  return responses;
}

export function groupBucketForScore(score = 0) {
  if (score > 0.25) return { bucketId: 'support', theme: 'higher agreement' };
  if (score < -0.25) return { bucketId: 'concern', theme: 'higher disagreement' };
  return { bucketId: 'mixed', theme: 'mixed or unsure' };
}

export function groupThemeForScore(score = 0) {
  if (score > 0.35) return 'higher agreement';
  if (score < -0.35) return 'higher disagreement';
  if (score > 0.08) return 'leaning agreement';
  if (score < -0.08) return 'leaning disagreement';
  return 'mixed or unsure';
}

export function requestedScoreBuckets({ records = [], participantIds = [], clusterCount = null } = {}) {
  const count = Number(clusterCount);
  if (!Number.isFinite(count) || count <= 0) return null;
  const scored = participantIds
    .map((id) => ({
      id,
      score: averageAnswerScore(records.filter((record) => record.telegramUserId === id)),
    }))
    .sort((left, right) => right.score - left.score || String(left.id).localeCompare(String(right.id)));
  const resolvedCount = Math.max(1, Math.min(6, Math.floor(count), scored.length));
  if (!resolvedCount || !scored.length) return [];
  const buckets = Array.from({ length: resolvedCount }, (_, index) => ({
    bucketId: `cluster-${index + 1}`,
    theme: '',
    participantIds: [],
    scoreTotal: 0,
  }));
  scored.forEach((item, index) => {
    const bucketIndex = Math.min(resolvedCount - 1, Math.floor(index * resolvedCount / scored.length));
    const bucket = buckets[bucketIndex];
    bucket.participantIds.push(item.id);
    bucket.scoreTotal += item.score;
  });
  buckets.forEach((bucket) => {
    const average = bucket.participantIds.length ? bucket.scoreTotal / bucket.participantIds.length : 0;
    bucket.theme = groupThemeForScore(average);
  });
  return buckets;
}

export function buildParticipantResultGroups({
  records = [],
  participantIds = [],
  aliases = new Map(),
  questionIds = [],
  questionIndex = new Map(),
  promptMap = new Map(),
  questionTypeLookup = new Map(),
  clusterCount = null,
} = {}) {
  const requestedBuckets = requestedScoreBuckets({ records, participantIds, clusterCount });
  const buckets = Array.isArray(requestedBuckets) ? requestedBuckets : (() => {
    const out = new Map();
    for (const id of participantIds) {
      const participantRecords = records.filter((record) => record.telegramUserId === id);
      const score = averageAnswerScore(participantRecords);
      const bucket = groupBucketForScore(score);
      if (!out.has(bucket.bucketId)) {
        out.set(bucket.bucketId, {
          bucketId: bucket.bucketId,
          theme: bucket.theme,
          participantIds: [],
          scoreTotal: 0,
        });
      }
      const item = out.get(bucket.bucketId);
      item.participantIds.push(id);
      item.scoreTotal += score;
    }
    return Array.from(out.values());
  })();

  return buckets
    .filter((bucket) => bucket.participantIds.length)
    .sort((left, right) => (
      (right.scoreTotal / right.participantIds.length) -
      (left.scoreTotal / left.participantIds.length) ||
      right.participantIds.length - left.participantIds.length ||
      left.theme.localeCompare(right.theme)
    ))
    .map((bucket, index) => {
      const participantSet = new Set(bucket.participantIds);
      const clusterRecords = records.filter((record) => participantSet.has(record.telegramUserId));
      const qualitativeResponses = qualitativeResponsesForGroup({
        records: clusterRecords,
        aliases,
        questionIndex,
        promptMap,
        questionTypeLookup,
      });
      const topStatements = questionIds.map((id, questionNumber) => {
        const clusterQuestionRecords = clusterRecords.filter((record) => record.questionId === id);
        const overallQuestionRecords = records.filter((record) => record.questionId === id);
        const clusterAverage = averageAnswerScore(clusterQuestionRecords);
        const overallAverage = averageAnswerScore(overallQuestionRecords);
        return {
          label: questionIndex.get(id) || `Q${questionNumber + 1}`,
          questionIndex: questionNumber,
          prompt: promptMap.get(id) || shortQuestionId(id),
          cluster: countResultVotes(clusterQuestionRecords),
          overall: countResultVotes(overallQuestionRecords),
          differenceScore: Number(Math.abs(clusterAverage - overallAverage).toFixed(3)),
        };
      })
        .filter((statement) => statement.cluster.responded > 0)
        .sort((left, right) => (
          right.differenceScore - left.differenceScore ||
          right.cluster.responded - left.cluster.responded ||
          left.prompt.localeCompare(right.prompt)
        ))
        .slice(0, 5);
      return {
        groupId: `group-${index + 1}`,
        label: `Group ${index + 1}`,
        theme: bucket.theme,
        size: bucket.participantIds.length,
        aliases: bucket.participantIds.map((id) => aliases.get(id)).filter(Boolean),
        averageScore: Number((bucket.scoreTotal / bucket.participantIds.length).toFixed(3)),
        topStatements,
        qualitativeResponses,
      };
    });
}

export function buildParticipantGraph(records = [], questions = [], options = {}) {
  const questionTypeLookup = questionTypeById(questions);
  const graphRecords = (Array.isArray(records) ? records : []).map((record) => ({
    ...record,
    questionType: safeString(record.questionType || questionTypeLookup.get(record.questionId)),
  }));
  const questionIds = Array.from(new Set(graphRecords.map((record) => record.questionId).filter(Boolean)));
  const questionIndex = new Map(questionIds.map((id, index) => [id, `Q${index + 1}`]));
  const participants = Array.from(new Set(graphRecords.map((record) => record.telegramUserId).filter(Boolean)));
  const aliases = new Map(participants.map((id, index) => [id, participantAlias(id, index)]));
  const lines = participants.map((id) => {
    const answered = graphRecords
      .filter((record) => record.telegramUserId === id)
      .map((record) => `${questionIndex.get(record.questionId) || 'Q?'}:${record.label}`);
    return `${aliases.get(id)} -> ${answered.join(', ') || 'No answers'}`;
  });
  const promptMap = questionPromptById(questions);
  const legend = questionIds.slice(0, 5).map((id, index) => `${index + 1}. ${promptMap.get(id) || shortQuestionId(id)}`);
  const imageParticipants = participants.slice(0, 8).map((id) => ({
    participant: aliases.get(id),
    answers: graphRecords
      .filter((record) => record.telegramUserId === id)
      .map((record) => ({
        question: questionIndex.get(record.questionId) || 'Q?',
        label: record.label,
      })),
  }));
  const groups = buildParticipantResultGroups({
    records: graphRecords,
    participantIds: participants,
    aliases,
    questionIds,
    questionIndex,
    promptMap,
    questionTypeLookup,
    clusterCount: options.clusterCount,
  });
  return {
    lines,
    legend,
    participants: imageParticipants,
    groups,
    participantCount: participants.length,
    questionCount: questionIds.length,
  };
}
