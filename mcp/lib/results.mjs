import { summarizeQuadraticAllocations, validateQuadraticAllocation } from '../../shared/questions/quadraticAllocation.mjs';
import { isSingleSelect, ratingScaleFor } from './records.mjs';
import { normalizeSessionIdHex } from './workerClient.mjs';
import { registryResponseMatchesSession } from './registryIdentity.mjs';
import { compareChainOrder } from './registryChain.mjs';

// Summaries of public session results, computed the way the web client reads
// them: newest answer per participant and question wins (Worker createdAt,
// then storage id), and cleared answers count as no answer. Every stored
// record is untrusted, so values are checked against the question before
// they count.

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const MAX_FREEFORM_SAMPLES = 5;
const MAX_SAMPLE_LENGTH = 280;

const isNewer = (candidate, current) =>
  !current ||
  candidate.createdAt > current.createdAt ||
  (candidate.createdAt === current.createdAt && candidate.storageId > current.storageId);

/**
 * `entries` are { storageId, createdAt, responder, payload } for response
 * records. Returns Map(questionId -> Map(responder -> entry)) of latest answers.
 */
export const latestAnswersByQuestion = (entries, { sessionSlug, sessionId, registryConfig, questionIds }) => {
  const byQuestion = new Map();
  for (const entry of entries) {
    const payload = entry?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
    // Session ids may be stored as 0x hex, bare hex, or a UUID, like the web client accepts.
    const questionId = (text(payload.questionID) || text(payload.questionId)).toLowerCase();
    if (registryConfig) {
      if (!questionIds?.has(questionId) || !registryResponseMatchesSession(payload, registryConfig) || payload.answer?.encrypted === true) continue;
    } else if (text(payload.sessionSlug) !== sessionSlug || normalizeSessionIdHex(text(payload.sessionId)) !== sessionId) continue;
    const responder = text(entry.responder).toLowerCase();
    if (!questionId || !responder) continue;
    const answers = byQuestion.get(questionId) || new Map();
    const current = answers.get(responder);
    if (registryConfig ? !current || compareChainOrder(entry, current) > 0 : isNewer(entry, current)) answers.set(responder, entry);
    byQuestion.set(questionId, answers);
  }
  return byQuestion;
};

const rawValue = (entry) => {
  const answer = entry?.payload?.answer;
  if (!answer || typeof answer !== 'object' || answer.encrypted === true) return undefined;
  return answer.value;
};

const BINARY_VOTES = Object.freeze({
  agree: 'Agree', yes: 'Agree', y: 'Agree', true: 'Agree', 1: 'Agree',
  disagree: 'Disagree', no: 'Disagree', n: 'Disagree', false: 'Disagree', '-1': 'Disagree',
  unsure: 'Unsure', unknown: 'Unsure', maybe: 'Unsure', neutral: 'Unsure', 0: 'Unsure',
});

/**
 * Reads an answer the way the web report does (PolisReport
 * polisReportAnswers.ts readReportAnswer): legacy spellings and numeric text
 * count, anything else is not an answer. Returns undefined when invalid.
 */
const validValue = (question, entry) => {
  const payloadType = text(entry?.payload?.type);
  if (payloadType && payloadType !== question.type) return undefined;
  const value = rawValue(entry);
  if (value === undefined || value === null || value === '*') return undefined;
  switch (question.type) {
    case 'binary': {
      // The web report stringifies the value, so ['Agree'] reads as Agree.
      const scalar = Array.isArray(value) && value.every((item) => ['string', 'number'].includes(typeof item)) ? value.join(',') : value;
      const key = typeof scalar === 'boolean' || typeof scalar === 'number' ? String(scalar) : text(scalar).toLowerCase();
      return Object.hasOwn(BINARY_VOTES, key) ? BINARY_VOTES[key] : undefined;
    }
    case 'rating': {
      if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return undefined;
      const number = Number(value);
      const scale = ratingScaleFor(question);
      return Number.isFinite(number) && number >= scale.min && number <= scale.max ? number : undefined;
    }
    case 'multichoice': {
      const options = (Array.isArray(question.options) ? question.options : []).map(text).filter(Boolean);
      const picks = (Array.isArray(value) ? value : [value]).map(text);
      if (!picks.length || picks.some((pick) => !pick)) return undefined;
      const canonical = options.length
        ? picks.map((pick) => options.find((option) => option.toLowerCase() === pick.toLowerCase()) || '')
        : picks;
      if (canonical.some((pick) => !pick)) return undefined;
      const selected = [...new Set(canonical)];
      const limit = isSingleSelect(question)
        ? 1
        : Number.isSafeInteger(question.maxSelections) && question.maxSelections > 0
          ? question.maxSelections
          : selected.length;
      return selected.length <= limit ? selected : undefined;
    }
    case 'quadratic':
      return Array.isArray(value) && !validateQuadraticAllocation(value, question) ? value : undefined;
    case 'freeform': {
      const answer = ['string', 'number', 'boolean'].includes(typeof value) ? String(value).trim() : '';
      return answer || undefined;
    }
    default:
      return undefined;
  }
};

/** Responders whose latest answer to `question` is a valid answer. */
export const respondersWithAnswers = (question, answersByResponder = new Map()) =>
  [...answersByResponder.entries()].filter(([, entry]) => validValue(question, entry) !== undefined).map(([responder]) => responder);

const isAgent = (entry) => entry?.payload?.participant?.kind === 'agent';

const isCleared = (value) => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);

/** Summarizes one question's latest answers by type. */
export const summarizeQuestion = (question, answersByResponder = new Map()) => {
  const latest = [...answersByResponder.values()];
  const answered = latest.filter((entry) => validValue(question, entry) !== undefined);
  const summary = {
    questionId: question.id,
    type: question.type,
    prompt: question.prompt,
    responses: answered.length,
    selfDeclaredAgents: answered.filter(isAgent).length,
    invalidResponses: latest.filter((entry) => !isCleared(rawValue(entry))).length - answered.length,
  };
  switch (question.type) {
    case 'binary': {
      const counts = { Agree: 0, Unsure: 0, Disagree: 0 };
      answered.forEach((entry) => {
        counts[validValue(question, entry)] += 1;
      });
      return { ...summary, counts };
    }
    case 'rating': {
      const scale = ratingScaleFor(question);
      const values = answered.map((entry) => validValue(question, entry));
      const histogram = {};
      values.forEach((value) => {
        histogram[value] = (histogram[value] || 0) + 1;
      });
      const mean = values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;
      return { ...summary, scale: { min: scale.min, max: scale.max }, mean, histogram };
    }
    case 'multichoice': {
      const counts = new Map((Array.isArray(question.options) ? question.options : []).map(text).filter(Boolean).map((option) => [option, 0]));
      answered.forEach((entry) => validValue(question, entry).forEach((option) => counts.set(option, (counts.get(option) || 0) + 1)));
      return { ...summary, counts: Object.fromEntries(counts) };
    }
    case 'quadratic': {
      const tally = summarizeQuadraticAllocations(answered.map((entry) => entry.payload), question);
      return { ...summary, options: tally.options };
    }
    case 'freeform': {
      const samples = answered
        .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
        .slice(0, MAX_FREEFORM_SAMPLES)
        .map((entry) => validValue(question, entry).slice(0, MAX_SAMPLE_LENGTH));
      return { ...summary, recentAnswers: samples };
    }
    default:
      return summary;
  }
};
