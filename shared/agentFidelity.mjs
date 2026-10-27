// Agent fidelity: how well an AI's predicted answers match the answers people
// give, and whether AI drafts flatten how strongly or how differently people
// answer. Pure functions with no I/O. The method is in docs/agent-fidelity.md.
import { DEFAULT_AI_MODEL } from './aiDefaults.mjs';
import { confidenceMeaningOf } from './interviewConfidence.mjs';
import { getVoiceCredits } from './questions/quadraticAllocation.mjs';
import { normalizeRatingScale } from './questions/ratingScale.mjs';
import { readStoredRating } from './questions/storedRating.mjs';

export const FIDELITY_METHOD_VERSION = 'ce-agent-fidelity-v1';

// shown: the person reviewed the AI's draft before answering.
// blind: the draft stayed hidden until the person answered (randomized).
// separate: the prediction was made elsewhere and never shown in review
// (Session Wrapped agents).
const CONDITIONS = ['shown', 'blind', 'separate'];
const BINARY_ANSWERS = ['Agree', 'Unsure', 'Disagree'];
const STRUCTURED_TYPES = new Set(['binary', 'multichoice', 'rating', 'quadratic']);
const TIMESTAMP_KEYS = ['timestamp', 'timeStamp', 'created_at', 'createdAt', 'submittedAt'];
const DEFAULTS = Object.freeze({
  bootstrapSamples: 1000,
  seed: 1,
  minParticipants: 5,
  minGroupSize: 3,
  calibrationBins: 10,
  includeAgents: false,
  excludeParticipants: [],
});

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const text = (value) =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const lower = (value) => text(value).toLowerCase();
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const numberOrNull = (value) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return finite(number) ? number : null;
};
const parseJson = (value) => {
  if (typeof value !== 'string' || !/^\s*[[{]/.test(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const groupBy = (items, keyOf) => {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
};

// ---------------------------------------------------------------------------
// Questions and answers

const isSingleSelect = (question) =>
  question.singleSelect === true || question.oneSelectionOnly === true || question.singleChoice === true;

/** Reduces a session question to what scoring needs, or null when it can't be scored. */
export const normalizeFidelityQuestion = (question) => {
  if (!isRecord(question)) return null;
  const id = lower(question.id ?? question.questionID ?? question.questionId);
  if (!id) return null;
  // Like the interview catalog: every type that isn't structured takes free text.
  const declared = lower(question.type || question.questionType || 'freeform');
  const type = STRUCTURED_TYPES.has(declared) ? declared : 'freeform';
  const normalized = { id, type };
  if (type === 'multichoice' || type === 'quadratic') {
    normalized.options = (Array.isArray(question.options) ? question.options : []).map(text).filter(Boolean);
    if (normalized.options.length < 2) return null;
  }
  if (type === 'multichoice') normalized.singleSelect = isSingleSelect(question);
  if (type === 'rating') {
    const scale = normalizeRatingScale(question) || { min: 0, max: 10 };
    normalized.scale = { min: Number(scale.min), max: Number(scale.max) };
  }
  if (type === 'quadratic') normalized.budget = getVoiceCredits(question);
  return normalized;
};

const mapQuestions = (questions = []) =>
  new Map(
    questions
      .map(normalizeFidelityQuestion)
      .filter(Boolean)
      .map((question) => [question.id, question]),
  );

// Stored fields wrap values ({ value }, { values }, { text }); encrypted or
// redacted fields can't be read and count as missing.
const unwrap = (raw) => {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return raw;
  if (raw.redacted === true || raw.encrypted === true) return null;
  const key = ['value', 'values', 'text', 'answer'].find((candidate) => hasOwn(raw, candidate));
  return key ? unwrap(raw[key]) : null;
};
const asArray = (value) => {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : null;
};

/** Returns a comparable answer for the question, or null when it is missing or unreadable. */
export const normalizeFidelityAnswer = (question, raw) => {
  const value = unwrap(raw);
  if (value === null || value === '') return null;
  switch (question.type) {
    case 'binary':
      return BINARY_ANSWERS.find((answer) => answer.toLowerCase() === lower(value)) ?? null;
    case 'multichoice': {
      const picks = new Set((asArray(value) ?? [value]).map(lower));
      const chosen = question.options.filter((option) => picks.has(option.toLowerCase()));
      if (!chosen.length || chosen.length !== picks.size) return null;
      return question.singleSelect && chosen.length !== 1 ? null : chosen;
    }
    case 'rating': {
      const number = numberOrNull(value);
      return number !== null && number >= question.scale.min && number <= question.scale.max ? number : null;
    }
    case 'quadratic': {
      const votes = (asArray(value) ?? []).map(numberOrNull);
      return votes.length === question.options.length && votes.every(Number.isInteger) ? votes : null;
    }
    case 'freeform':
      return text(value) || null;
    default:
      return null;
  }
};

const jaccard = (a, b) => {
  const union = new Set([...a, ...b]);
  return union.size ? a.filter((item) => b.includes(item)).length / union.size : 1;
};
const squaredLength = (votes) => votes.reduce((sum, vote) => sum + vote * vote, 0);
// Direction of the vote vector: same priorities 1, unrelated 0.5, opposite 0.
// How strongly people vote is measured separately (see synthesis checks).
const quadraticSimilarity = (a, b) => {
  const [squaredA, squaredB] = [squaredLength(a), squaredLength(b)];
  if (!squaredA && !squaredB) return 1;
  if (!squaredA || !squaredB) return 0.5;
  const dot = a.reduce((sum, vote, index) => sum + vote * b[index], 0);
  return (1 + Math.max(-1, Math.min(1, dot / Math.sqrt(squaredA * squaredB)))) / 2;
};

/**
 * Graded agreement from 0 to 1 between two normalized answers to the same
 * question, or null when either is missing or the type isn't scored
 * (freeform).
 */
export const answerSimilarity = (question, a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  switch (question.type) {
    case 'binary':
      return a === b ? 1 : 0;
    case 'multichoice':
      return question.singleSelect ? (a[0] === b[0] ? 1 : 0) : jaccard(a, b);
    case 'rating': {
      const span = question.scale.max - question.scale.min;
      return span > 0 ? 1 - Math.abs(a - b) / span : a === b ? 1 : 0;
    }
    case 'quadratic':
      return quadraticSimilarity(a, b);
    default:
      return null;
  }
};

const answerKey = (value) => JSON.stringify(value);
const answersMatch = (a, b) => a !== null && b !== null && answerKey(a) === answerKey(b);

// Sums answerSimilarity over all pairs of answers. Identical answers are
// grouped first, so the cost depends on how many distinct answers there are.
// Quadratic allocations rarely repeat, so they use a closed form over unit
// vectors: the sum of cosines over pairs is (|sum of vectors|^2 - count) / 2.
const pairwiseSimilaritySum = (question, entries) => {
  if (question.type === 'quadratic') {
    let [empty, nonEmpty] = [0, 0];
    const total = new Array(question.options.length).fill(0);
    for (const { value } of entries) {
      const length = Math.sqrt(squaredLength(value));
      if (!length) {
        empty += 1;
        continue;
      }
      nonEmpty += 1;
      value.forEach((vote, index) => {
        total[index] += vote / length;
      });
    }
    const cosineSum = (squaredLength(total) - nonEmpty) / 2;
    const nonEmptyPairs = (nonEmpty * (nonEmpty - 1)) / 2;
    return (empty * (empty - 1)) / 2 + empty * nonEmpty * 0.5 + (nonEmptyPairs + cosineSum) / 2;
  }
  const distinct = [...groupBy(entries, (entry) => entry.key).values()].map((list) => [list[0].value, list.length]);
  let sum = 0;
  distinct.forEach(([value, count], i) => {
    sum += (count * (count - 1)) / 2;
    for (let j = i + 1; j < distinct.length; j += 1) {
      sum += count * distinct[j][1] * answerSimilarity(question, value, distinct[j][0]);
    }
  });
  return sum;
};

// ---------------------------------------------------------------------------
// Reading records

/**
 * Where a draft came from. Records don't say so yet, so this falls back on
 * the provenance source: chat-assistant prefill self-reports chatgpt or claude;
 * in-app voice drafts use the app's default model.
 */
export const inferDraftOrigin = (provenance = {}) => {
  const explicit = text(provenance.draftOrigin);
  if (explicit) return explicit;
  const source = isRecord(provenance.source) ? provenance.source : {};
  const platform = lower(source.platform);
  const modelId = text(source.modelId);
  if (platform === 'chatgpt' || platform === 'claude') return 'external_prefill';
  if (modelId === 'direct-user-context') return 'typed_context';
  if (platform === 'other' && modelId === DEFAULT_AI_MODEL) return 'voice_interview';
  return 'unknown';
};

// Session drafts carry a 0-1 confidence; values above 1 are legacy percents.
const readDraftConfidence = (value) => {
  const number = numberOrNull(value);
  if (number === null || number < 0 || number > 100) return null;
  return number > 1 ? number / 100 : number;
};
// Session Wrapped confidences are whole percents from 0 to 100.
const readPercentConfidence = (value) => {
  const number = numberOrNull(value);
  return number !== null && number >= 0 && number <= 100 ? number / 100 : null;
};
const readAddress = (value) => lower(typeof value === 'string' ? value : isRecord(value) ? value.address : '');
// Self-reported, so any assistant but the two the app names counts as other, as the app records it.
const readPlatform = (value) => {
  const platform = lower(value);
  return platform === 'chatgpt' || platform === 'claude' ? platform : platform ? 'other' : 'unknown';
};
const toMs = (value) => {
  const number = numberOrNull(value);
  if (number !== null) return number < 1e12 ? number * 1000 : number;
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
// First timestamp found on the records, or on their answer fields, in order.
const readTimestamp = (...records) => {
  for (const record of records) {
    for (const source of [record, record?.answer]) {
      if (!isRecord(source)) continue;
      for (const key of TIMESTAMP_KEYS) {
        const ms = toMs(source[key]);
        if (ms !== null) return ms;
      }
    }
  }
  return null;
};

// A stored payload is one response entry or { responses: [...] }. A Results
// JSON export row wraps one payload, often as a JSON string, as
// { responder, response } (survey view) or { responder, questionId, response }
// (questions view). Response entries always carry `answer`; wrappers don't.
const entriesOf = (item, row = null) => {
  const parsed = parseJson(item);
  if (!isRecord(parsed)) return [];
  if (hasOwn(parsed, 'response') && !hasOwn(parsed, 'answer')) return entriesOf(parsed.response, parsed);
  const entries = Array.isArray(parsed.responses) ? parsed.responses.filter(isRecord) : [parsed];
  return entries.map((entry) => ({ entry, payload: parsed, row }));
};

// Keeps the latest record per participant and question; without timestamps,
// later input wins.
const latestByKey = (records) => {
  const latest = new Map();
  for (const record of records) {
    const key = `${record.participantId}|${record.questionId}`;
    const previous = latest.get(key);
    if (!previous || (record.at ?? -Infinity) >= (previous.at ?? -Infinity)) latest.set(key, record);
  }
  return [...latest.values()];
};

/**
 * Response rows from the Results screen, or from its "JSON: Questions +
 * Responses" download: the survey view's `filteredResponses` and the questions
 * view's `filteredQuestionResponses`, keyed by question. Rows in both are
 * counted once per person and question by collectSessionFidelityData.
 */
export const resultsResponseRows = (source) => {
  if (Array.isArray(source)) return source;
  const rows = [
    ...(Array.isArray(source?.filteredResponses) ? source.filteredResponses : []),
    ...Object.values(source?.filteredQuestionResponses ?? {}).flatMap((list) => (Array.isArray(list) ? list : [])),
  ];
  if (rows.length || Array.isArray(source?.filteredResponses) || source?.filteredQuestionResponses) return rows;
  return source ? [source] : [];
};

/**
 * Reads stored session responses into final answers (everyone) and
 * prediction pairs (responses that kept their AI draft comparison). Only each
 * person's latest record for a question counts, so withdrawing research
 * consent or encrypting an answer later replaces what was shared before.
 */
export const collectSessionFidelityData = ({ questions = [], payloads = [] } = {}) => {
  const questionMap = mapQuestions(questions);
  const skipped = { unknownQuestion: 0, noParticipant: 0, unreadableAnswer: 0, unreadablePrediction: 0, freeformWithoutText: 0 };
  const records = [];
  for (const item of payloads) {
    for (const { entry, payload, row } of entriesOf(item)) {
      const question = questionMap.get(lower(entry.questionID ?? entry.questionId ?? row?.questionId));
      if (!question) {
        skipped.unknownQuestion += 1;
        continue;
      }
      // A row's responder comes from the Worker or the chain; a payload's own
      // claim is only a fallback for raw payloads, so one account can't pose as many.
      const participantId = readAddress(row?.responder) || readAddress(payload.responder) || readAddress(entry.responder);
      if (!participantId) {
        skipped.noParticipant += 1;
        continue;
      }
      records.push({ participantId, questionId: question.id, question, entry, payload, at: readTimestamp(entry, payload, row) });
    }
  }
  const answers = [];
  const pairs = [];
  for (const { participantId, questionId, question, entry, payload, at } of latestByKey(records)) {
    const final = normalizeFidelityAnswer(question, entry.answer);
    if (final === null) {
      skipped.unreadableAnswer += 1;
      continue;
    }
    const isAgent = entry.participant?.kind === 'agent' || payload.participant?.kind === 'agent';
    answers.push({ participantId, questionId, value: final, at, isAgent, source: text(entry.recruitment?.source) });
    const provenance = isRecord(entry.interviewProvenance) ? entry.interviewProvenance : null;
    const original = provenance && (provenance.originalPrediction ?? provenance.predictionComparison?.original);
    if (!isRecord(original)) continue;
    // Minimal research records keep no drafted text, so freeform predictions arrive empty.
    if (question.type === 'freeform' && original.answer === null) {
      skipped.freeformWithoutText += 1;
      continue;
    }
    const prediction = normalizeFidelityAnswer(question, original.answer);
    if (prediction === null) {
      skipped.unreadablePrediction += 1;
      continue;
    }
    const condition = CONDITIONS.includes(provenance.predictionCondition) ? provenance.predictionCondition : 'shown';
    // In the blind condition the measured answer is the one given before the
    // draft was revealed; a later change is recorded but not scored.
    const blindAnswer =
      condition === 'blind' && hasOwn(provenance, 'blindAnswer')
        ? normalizeFidelityAnswer(question, provenance.blindAnswer)
        : null;
    const source = isRecord(provenance.source) ? provenance.source : {};
    pairs.push({
      participantId,
      questionId,
      condition,
      origin: inferDraftOrigin(provenance),
      platform: readPlatform(source.platform),
      modelId: text(source.modelId) || 'unknown',
      prediction,
      actual: blindAnswer ?? final,
      confidence: readDraftConfidence(original.confidence),
      // Version 2 records state it; older ones are read from the prompt version.
      confidenceMeaning: ['keep', 'support'].includes(provenance.confidenceMeaning)
        ? provenance.confidenceMeaning
        : confidenceMeaningOf(provenance.promptVersion),
      predictedImportance: readStoredRating(original.importance),
      predictedConviction: readStoredRating(original.conviction),
      // Responses saved without importance fall back on conviction, as the app does.
      importance: readStoredRating(entry.importance) ?? readStoredRating(entry.conviction),
      conviction: readStoredRating(entry.conviction),
      at,
      isAgent,
    });
  }
  return { answers, pairs, skipped };
};

/**
 * Reads Session Wrapped agent-only export rows (`wide` or `gold` views): the
 * agent's prediction beside the person's own answer.
 */
export const collectWrappedFidelityPairs = ({ questions = [], rows = [] } = {}) => {
  const questionMap = mapQuestions(questions);
  const pairs = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const question = questionMap.get(lower(row.statement_id));
    const principal = text(row.principal_id);
    if (!question || !principal) continue;
    const prediction = normalizeFidelityAnswer(question, row.agent_prediction);
    const actual = normalizeFidelityAnswer(question, row.human_current_answer ?? row.prior_human_answer);
    if (prediction === null || actual === null) continue;
    pairs.push({
      participantId: `wrapped:${principal}`,
      questionId: question.id,
      // Historical Mini App reviews showed the prediction; otherwise the
      // person answered on their own.
      condition: text(row.review_status) ? 'shown' : 'separate',
      origin: 'wrapped_agent',
      platform: 'wrapped',
      modelId: text(row.model) || 'unknown',
      prediction,
      actual,
      confidence: readPercentConfidence(row.agent_confidence),
      // The Wrapped rubric grades evidence (90-95 direct, 70-89 supported inference).
      confidenceMeaning: 'support',
      predictedImportance: null,
      predictedConviction: null,
      importance: null,
      conviction: null,
      at: readTimestamp(row),
      isAgent: false,
    });
  }
  return latestByKey(pairs);
};

// ---------------------------------------------------------------------------
// Statistics

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const quantile = (sorted, p) => {
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
};

// Rows from one person aren't independent, so intervals resample people.
const bootstrapInterval = (units, statistic, options) => {
  if (units.length < 2 || options.bootstrapSamples <= 0) return null;
  const random = mulberry32(options.seed);
  const values = [];
  for (let sample = 0; sample < options.bootstrapSamples; sample += 1) {
    const draw = units.map(() => units[Math.floor(random() * units.length)]);
    const value = statistic(draw);
    if (finite(value)) values.push(value);
  }
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  return [quantile(values, 0.025), quantile(values, 0.975)];
};

// Results from fewer people than the minimum are withheld: they are noisy,
// and with one or two people they would publish individual answers.
const withheld = (participants) => ({ value: null, interval: null, participants, suppressed: true });
// Mean of per-person values (each person counts once), with a 95% interval.
const estimate = (values, options) => {
  const kept = values.filter(finite);
  if (kept.length < options.minParticipants) return withheld(kept.length);
  return { value: mean(kept), interval: bootstrapInterval(kept, mean, options), participants: kept.length };
};

/**
 * The keys of a breakdown (groups, platforms) that can be reported beside its
 * total. Subtracting reported figures from the total, or from each other,
 * describes the people who share exactly the same reported keys (those with
 * none of them too), so each such set must be empty or reach `min`. Until each
 * does, the smallest key behind a set that is too small is withheld.
 * `keysByPerson` lists each person's keys.
 */
export const reportableKeys = (keysByPerson, min) => {
  const kept = new Set(keysByPerson.flat());
  const sizeOf = (key) => keysByPerson.filter((keys) => keys.includes(key)).length;
  for (;;) {
    const sets = new Map();
    for (const keys of keysByPerson) {
      const signature = JSON.stringify([...new Set(keys.filter((key) => kept.has(key)))].sort());
      sets.set(signature, (sets.get(signature) ?? 0) + 1);
    }
    const small = [...sets].find(([, size]) => size < min);
    if (!small) return [...kept].sort();
    const behind = JSON.parse(small[0]);
    const [smallest] = (behind.length ? behind : [...kept]).sort((a, b) => sizeOf(a) - sizeOf(b) || (a < b ? -1 : 1));
    // Everyone together is fewer than `min`: nothing can be reported.
    if (smallest === undefined) return [];
    kept.delete(smallest);
  }
};

const ranks = (values) => {
  const order = values.map((value, index) => [value, index]).sort((a, b) => a[0] - b[0]);
  const result = new Array(values.length);
  for (let start = 0; start < order.length; ) {
    let end = start;
    while (end + 1 < order.length && order[end + 1][0] === order[start][0]) end += 1;
    for (let k = start; k <= end; k += 1) result[order[k][1]] = (start + end) / 2 + 1;
    start = end + 1;
  }
  return result;
};
const pearson = (xs, ys) => {
  const [mx, my] = [mean(xs), mean(ys)];
  let [sxy, sxx, syy] = [0, 0, 0];
  xs.forEach((x, index) => {
    sxy += (x - mx) * (ys[index] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[index] - my) ** 2;
  });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
};
const spearman = (points) =>
  points.length >= 3 ? pearson(ranks(points.map((point) => point.x)), ranks(points.map((point) => point.y))) : null;

// ---------------------------------------------------------------------------
// Baselines and typicality

const modeOf = (values, order) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = null;
  for (const candidate of order) {
    if ((counts.get(candidate) ?? 0) > (counts.get(best) ?? 0)) best = candidate;
  }
  return best;
};
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// The single answer that best represents a set of answers: what a predictor
// that ignores the individual would guess.
const consensusAnswer = (question, values) => {
  if (!values.length) return null;
  switch (question.type) {
    case 'binary':
      return modeOf(values, BINARY_ANSWERS);
    case 'multichoice': {
      if (question.singleSelect) return [modeOf(values.map((value) => value[0]), question.options)];
      const chosen = question.options.filter(
        (option) => values.filter((value) => value.includes(option)).length * 2 > values.length,
      );
      return chosen.length ? chosen : [modeOf(values.flat(), question.options)];
    }
    case 'rating':
      return median(values);
    case 'quadratic':
      return question.options.map((_, index) => mean(values.map((value) => value[index])));
    default:
      return null;
  }
};
const isCategorical = (question) =>
  question.type === 'binary' || (question.type === 'multichoice' && question.singleSelect);
// "Kept or changed" only means something for choices: a rating or a vote
// allocation almost never comes back exactly, so those are scored by
// similarity alone and left out of correction rates and calibration.
const isChoice = (pair) => pair.question.type === 'binary' || pair.question.type === 'multichoice';

// For each answer, its mean similarity to every other person's answer to the
// same question.
const typicalityByParticipant = (questionMap, answersByQuestion) => {
  const scores = new Map();
  for (const [questionId, list] of answersByQuestion) {
    const question = questionMap.get(questionId);
    if (question.type === 'freeform' || list.length < 2) continue;
    const entries = list.map((answer) => ({ ...answer, key: answerKey(answer.value) }));
    const similarityToAll = new Map();
    if (question.type === 'quadratic') {
      // u·(sum of unit vectors) - 1 is the sum of cosines to everyone else.
      const empty = entries.filter((entry) => !squaredLength(entry.value)).length;
      const total = new Array(question.options.length).fill(0);
      for (const { value } of entries) {
        const length = Math.sqrt(squaredLength(value));
        if (length) value.forEach((vote, index) => (total[index] += vote / length));
      }
      const nonEmpty = entries.length - empty;
      for (const entry of entries) {
        const length = Math.sqrt(squaredLength(entry.value));
        similarityToAll.set(
          entry,
          length
            ? empty * 0.5 + (nonEmpty - 1 + entry.value.reduce((sum, vote, index) => sum + (vote / length) * total[index], 0) - 1) / 2
            : empty - 1 + nonEmpty * 0.5,
        );
      }
    } else {
      const distinct = [...groupBy(entries, (entry) => entry.key).values()].map((group) => [group[0].value, group.length]);
      const byKey = new Map(
        distinct.map(([value, count]) => [
          answerKey(value),
          distinct.reduce((sum, [other, otherCount]) => sum + otherCount * answerSimilarity(question, value, other), 0) - 1,
        ]),
      );
      for (const entry of entries) similarityToAll.set(entry, byKey.get(entry.key));
    }
    for (const entry of entries) {
      const list = scores.get(entry.participantId) ?? [];
      list.push(similarityToAll.get(entry) / (entries.length - 1));
      scores.set(entry.participantId, list);
    }
  }
  return new Map([...scores].map(([participantId, list]) => [participantId, mean(list)]));
};

// ---------------------------------------------------------------------------
// Scoring

const scorePairs = (pairs, questionMap) =>
  pairs
    .map((pair) => {
      const question = questionMap.get(pair.questionId);
      if (!question) return null;
      return {
        ...pair,
        question,
        similarity: answerSimilarity(question, pair.prediction, pair.actual),
        match: answersMatch(pair.prediction, pair.actual),
        predictionKey: answerKey(pair.prediction),
        actualKey: answerKey(pair.actual),
      };
    })
    .filter(Boolean);

// Calibration is pooled over predictions; per-person bin totals make each
// bootstrap draw a cheap sum.
const calibrationSummary = (pairs, bins) => {
  const summary = { predictions: 0, brier: 0, bins: Array.from({ length: bins }, () => [0, 0, 0]) };
  for (const pair of pairs) {
    if (pair.confidence === null) continue;
    const kept = pair.match ? 1 : 0;
    const bin = summary.bins[Math.min(bins - 1, Math.floor(pair.confidence * bins))];
    bin[0] += 1;
    bin[1] += pair.confidence;
    bin[2] += kept;
    summary.predictions += 1;
    summary.brier += (pair.confidence - kept) ** 2;
  }
  return summary;
};
const calibrationTable = (summaries, bins) => {
  // Per bin: predictions, summed confidence, kept answers and people.
  const totals = Array.from({ length: bins }, () => [0, 0, 0, 0]);
  let [predictions, brier] = [0, 0];
  for (const summary of summaries) {
    predictions += summary.predictions;
    brier += summary.brier;
    summary.bins.forEach((bin, index) => {
      bin.forEach((value, k) => (totals[index][k] += value));
      if (bin[0]) totals[index][3] += 1;
    });
  }
  if (!predictions) return null;
  const used = totals
    .map(([count, confidence, kept, people], index) => ({
      from: index / bins,
      to: (index + 1) / bins,
      count,
      confidence,
      kept,
      people,
    }))
    .filter((bin) => bin.count);
  return {
    predictions,
    brier: brier / predictions,
    expectedCalibrationError: used.reduce(
      (sum, bin) => sum + (bin.count / predictions) * Math.abs(bin.kept / bin.count - bin.confidence / bin.count),
      0,
    ),
    bins: used.map((bin) => ({
      from: bin.from,
      to: bin.to,
      predictions: bin.count,
      meanConfidence: bin.confidence / bin.count,
      keepRate: bin.kept / bin.count,
      participants: bin.people,
    })),
  };
};
// Pairs built outside the collectors carry no meaning and are taken as chances of keeping.
const confidenceMeaning = (pair) => pair.confidenceMeaning ?? 'keep';
const calibrationEstimate = (people, condition, options) => {
  const bins = options.calibrationBins;
  const calibrated = (pair) => pair.condition === condition && isChoice(pair) && confidenceMeaning(pair) === 'keep';
  const summaries = people
    .map((person) => calibrationSummary(person.pairs.filter(calibrated), bins))
    .filter((summary) => summary.predictions);
  if (!summaries.length) return null;
  if (summaries.length < options.minParticipants) return { participants: summaries.length, suppressed: true };
  const table = calibrationTable(summaries, bins);
  return {
    ...table,
    // A bin from fewer people than the minimum would describe those people's answers.
    bins: table.bins.map(({ from, to, predictions, participants, ...rates }) =>
      participants < options.minParticipants
        ? { from, to, predictions, participants, suppressed: true }
        : { from, to, predictions, ...rates, participants },
    ),
    participants: summaries.length,
    brierInterval: bootstrapInterval(summaries, (draw) => calibrationTable(draw, bins)?.brier ?? null, options),
    errorInterval: bootstrapInterval(
      summaries,
      (draw) => calibrationTable(draw, bins)?.expectedCalibrationError ?? null,
      options,
    ),
  };
};

const breakdown = (people, keyOf, valueOf, options) => {
  const keys = new Set(people.flatMap((person) => person.pairs.map(keyOf)));
  return Object.fromEntries(
    [...keys]
      .sort()
      .map((key) => [key, estimate(people.map((person) => valueOf(person.pairs.filter((pair) => keyOf(pair) === key))), options)]),
  );
};
// Platforms and draft origins mostly divide people rather than their drafts,
// so like groups, a key is also withheld when subtracting it from the total,
// or from the other keys, would leave fewer than the minimum.
const peopleBreakdown = (people, keyOf, valueOf, options) => {
  const reportable = new Set(reportableKeys(people.map((person) => person.pairs.map(keyOf)), options.minParticipants));
  return Object.fromEntries(
    Object.entries(breakdown(people, keyOf, valueOf, options)).map(([key, result]) => [
      key,
      reportable.has(key) ? result : withheld(result.participants),
    ]),
  );
};
const meanSimilarity = (pairs) => mean(pairs.map((pair) => pair.similarity));
const matchRate = (pairs) => mean(pairs.map((pair) => (pair.match ? 1 : 0)));

// Cohen's kappa: exact agreement beyond what chance gives, where chance comes
// from each question's answer shares among the predictions and among the
// answers. Pooled over questions, weighting each by its predictions.
const pooledKappa = (pairs) => {
  if (!pairs.length) return null;
  let [agreed, chance] = [0, 0];
  for (const questionPairs of groupBy(pairs, (pair) => pair.questionId).values()) {
    const answered = groupBy(questionPairs, (pair) => pair.actualKey);
    for (const [answer, predicted] of groupBy(questionPairs, (pair) => pair.predictionKey)) {
      chance += (predicted.length * (answered.get(answer)?.length ?? 0)) / questionPairs.length;
    }
    agreed += questionPairs.filter((pair) => pair.match).length;
  }
  const [observed, expected] = [agreed / pairs.length, chance / pairs.length];
  return expected < 1 ? (observed - expected) / (1 - expected) : null;
};
const kappaEstimate = (people, options) => {
  const choices = people.map((person) => person.pairs.filter(isChoice)).filter((pairs) => pairs.length);
  if (choices.length < options.minParticipants) return withheld(choices.length);
  return {
    value: pooledKappa(choices.flat()),
    interval: bootstrapInterval(choices, (draw) => pooledKappa(draw.flat()), options),
    participants: choices.length,
  };
};
// Mean absolute error of rating predictions, as a share of each question's scale.
const ratingError = (personPairs) => {
  const rated = personPairs.filter((pair) => pair.question.type === 'rating');
  return rated.length ? mean(rated.map((pair) => 1 - pair.similarity)) : null;
};

const extremity = (question, value) => {
  const half = (question.scale.max - question.scale.min) / 2;
  return half > 0 ? Math.abs(value - (question.scale.min + half)) / half : 0;
};
const topShare = (votes) => {
  const total = squaredLength(votes);
  return total ? Math.max(...votes.map((vote) => vote * vote)) / total : null;
};
const creditsUsed = (question, votes) => squaredLength(votes) / question.budget;
// Per person: mean of `measure` over the AI's drafts minus the same over the
// person's answers. Below zero means the drafts were weaker or more uniform.
const pairedShift = (pairs, measure) => {
  const values = pairs
    .map((pair) => [measure(pair, pair.prediction), measure(pair, pair.actual)])
    .filter(([predicted, actual]) => finite(predicted) && finite(actual));
  return values.length ? mean(values.map(([predicted, actual]) => predicted - actual)) : null;
};
// Mean dissimilarity between people's answers to one question.
const spreadOf = (question, pairs, side) => {
  const count = pairs.length;
  const entries = pairs.map((pair) => ({ value: pair[side], key: pair[`${side}Key`] }));
  return 1 - pairwiseSimilaritySum(question, entries) / ((count * (count - 1)) / 2);
};
// How much people's answers differ from each other on each question, for the
// AI's drafts versus their own answers, averaged over questions.
const spreadShift = (draw, minParticipants) => {
  const byQuestion = groupBy(draw.flatMap((person) => person.pairs), (pair) => pair.questionId);
  const shifts = [];
  for (const pairs of byQuestion.values()) {
    if (pairs.length < Math.max(2, minParticipants)) continue;
    const { question } = pairs[0];
    shifts.push(spreadOf(question, pairs, 'prediction') - spreadOf(question, pairs, 'actual'));
  }
  return mean(shifts.filter(finite));
};

const shown = (personPairs) => personPairs.filter((pair) => pair.condition === 'shown');
const allowedBy = (settings) => {
  const excluded = new Set(settings.excludeParticipants.map(lower));
  return (record) => !excluded.has(lower(record.participantId)) && (settings.includeAgents || !record.isAgent);
};
const peopleOf = (pairs) =>
  [...groupBy(pairs, (pair) => pair.participantId)].map(([participantId, personPairs]) => ({
    participantId,
    pairs: personPairs,
  }));
const coverageOf = ({ pairs, scored, measured, people, settings }) => ({
  participants: people.length,
  predictions: measured.length,
  freeformPredictions: scored.filter((pair) => pair.question.type === 'freeform').length,
  byCondition: Object.fromEntries(CONDITIONS.map((condition) => [condition, measured.filter((pair) => pair.condition === condition).length])),
  byOrigin: Object.fromEntries([...groupBy(measured, (pair) => pair.origin)].map(([key, list]) => [key, list.length])),
  // Choice predictions with a confidence, by what it means; only 'keep' is calibrated.
  byConfidenceMeaning: Object.fromEntries(
    [...groupBy(measured.filter((pair) => pair.confidence !== null && isChoice(pair)), confidenceMeaning)].map(
      ([key, list]) => [key, list.length],
    ),
  ),
  excludedAgentPredictions: settings.includeAgents ? 0 : pairs.filter((pair) => pair.isAgent).length,
});
// Mirror Scores, the correction rate and calibration: each person counts once.
const coreScores = (people, settings) => ({
  mirrorScore: {
    overall: estimate(people.map((person) => meanSimilarity(person.pairs)), settings),
    byCondition: breakdown(people, (pair) => pair.condition, meanSimilarity, settings),
    byType: breakdown(people, (pair) => pair.question.type, meanSimilarity, settings),
    byOrigin: peopleBreakdown(people, (pair) => pair.origin, meanSimilarity, settings),
    byPlatform: peopleBreakdown(people, (pair) => pair.platform, meanSimilarity, settings),
  },
  correctionRate: estimate(
    people.map((person) => {
      const visible = shown(person.pairs).filter(isChoice);
      return visible.length ? 1 - matchRate(visible) : null;
    }),
    settings,
  ),
  calibration: Object.fromEntries(
    CONDITIONS.map((condition) => [condition, calibrationEstimate(people, condition, settings)]).filter(([, value]) => value),
  ),
});

/**
 * Scores prediction pairs. `answers` are everyone's final answers (used for
 * baselines and typicality); `groups` maps participant ids to group ids (for
 * example position groups or the `src` link they arrived through).
 */
export const scoreAgentFidelity = ({ questions = [], pairs = [], answers = [], groups = {}, options = {} } = {}) => {
  const settings = { ...DEFAULTS, ...options };
  const questionMap = mapQuestions(questions);
  const allowed = allowedBy(settings);
  // Listed groups win; otherwise the `src` link a person arrived through.
  const groupsById = new Map();
  for (const answer of answers) {
    if (answer.source && !groupsById.has(answer.participantId)) groupsById.set(answer.participantId, [answer.source]);
  }
  for (const [participantId, listed] of Object.entries(groups)) {
    const ids = (Array.isArray(listed) ? listed : [listed]).map(text).filter(Boolean);
    if (ids.length) groupsById.set(lower(participantId), ids);
  }
  const groupsOf = (participantId) => groupsById.get(participantId) ?? [];

  const scored = scorePairs(pairs.filter(allowed), questionMap);
  const measured = scored.filter((pair) => pair.similarity !== null);
  const population = answers.filter(allowed).filter((answer) => questionMap.has(answer.questionId));
  const answersByQuestion = groupBy(population, (answer) => answer.questionId);
  const others = (pair, inGroup = null) =>
    (answersByQuestion.get(pair.questionId) ?? [])
      .filter((answer) => answer.participantId !== pair.participantId)
      .filter((answer) => !inGroup || groupsOf(answer.participantId).includes(inGroup))
      .map((answer) => answer.value);

  const withBaselines = measured.map((pair) => {
    const ownGroup = groupsOf(pair.participantId)[0] ?? null;
    const peers = ownGroup ? others(pair, ownGroup) : [];
    const populationGuess = consensusAnswer(pair.question, others(pair));
    const groupGuess = peers.length >= settings.minGroupSize ? consensusAnswer(pair.question, peers) : null;
    return {
      ...pair,
      populationGuess,
      populationSimilarity: answerSimilarity(pair.question, populationGuess, pair.actual),
      groupSimilarity: answerSimilarity(pair.question, groupGuess, pair.actual),
    };
  });
  const people = peopleOf(withBaselines);
  const core = coreScores(people, settings);
  const perPerson = (valueOf) => estimate(people.map((person) => valueOf(person.pairs)), settings);
  const groupSizes = new Map();
  for (const person of people) {
    for (const group of groupsOf(person.participantId)) groupSizes.set(group, (groupSizes.get(group) ?? 0) + 1);
  }
  const reportedGroups = reportableKeys(people.map((person) => groupsOf(person.participantId)), settings.minParticipants);

  // Unusual views: how similar each person's own answers are to everyone
  // else's, across every question they answered.
  const typicality = typicalityByParticipant(questionMap, answersByQuestion);
  const lift = (personPairs, key) => {
    const comparable = personPairs.filter((pair) => pair[key] !== null);
    return comparable.length ? meanSimilarity(comparable) - mean(comparable.map((pair) => pair[key])) : null;
  };
  const points = people
    .map((person) => ({
      typicality: typicality.get(person.participantId) ?? null,
      agent: meanSimilarity(person.pairs),
      baseline: mean(person.pairs.map((pair) => pair.populationSimilarity).filter(finite)),
      lift: lift(person.pairs, 'populationSimilarity'),
    }))
    .filter((point) => [point.typicality, point.agent, point.baseline, point.lift].every(finite));
  const correlation = (key) => {
    const xy = points.map((point) => ({ x: point.typicality, y: point[key] }));
    return { value: spearman(xy), interval: bootstrapInterval(xy, spearman, settings) };
  };
  const sortedPoints = [...points].sort((a, b) => a.typicality - b.typicality);
  const terciles = ['most unusual', 'middle', 'most typical'].map((label, index) => {
    const slice = sortedPoints.slice(
      Math.round((index * sortedPoints.length) / 3),
      Math.round(((index + 1) * sortedPoints.length) / 3),
    );
    if (slice.length < settings.minParticipants) return { tercile: label, participants: slice.length, suppressed: true };
    return {
      tercile: label,
      participants: slice.length,
      typicality: mean(slice.map((point) => point.typicality)),
      agent: mean(slice.map((point) => point.agent)),
      baseline: mean(slice.map((point) => point.baseline)),
      lift: mean(slice.map((point) => point.lift)),
    };
  });

  const byType = (type) => (pair) => pair.question.type === type;
  // Within each person: agreement when drafts were shown minus when they were
  // hidden. Above zero means showing a draft pulled answers toward it. Only
  // drafts from the hidden ones' source compare, since only those could be hidden.
  const anchoring = (valueOf, filter = () => true) =>
    estimate(
      people.map((person) => {
        const hidden = person.pairs.filter((pair) => pair.condition === 'blind' && filter(pair));
        const origins = new Set(hidden.map((pair) => pair.origin));
        const visible = shown(person.pairs).filter((pair) => filter(pair) && origins.has(pair.origin));
        return visible.length && hidden.length ? valueOf(visible) - valueOf(hidden) : null;
      }),
      settings,
    );
  const shiftOf = (filter, measure) => perPerson((personPairs) => pairedShift(personPairs.filter(filter), measure));
  const ratingShift = (field) =>
    perPerson((personPairs) => {
      const rated = personPairs.filter((pair) => finite(pair[`predicted${field}`]) && finite(pair[field.toLowerCase()]));
      return rated.length ? mean(rated.map((pair) => pair[`predicted${field}`] - pair[field.toLowerCase()])) : null;
    });
  const enough = people.length >= settings.minParticipants;

  return {
    method: FIDELITY_METHOD_VERSION,
    options: { ...settings, excludeParticipants: settings.excludeParticipants.length },
    coverage: coverageOf({ pairs, scored, measured, people, settings }),
    mirrorScore: {
      ...core.mirrorScore,
      // Groups below the minimum, or that could be subtracted down to fewer,
      // are left out entirely: their names can be per-invite links.
      byGroup: Object.fromEntries(
        reportedGroups.map((group) => [
          group,
          estimate(
            people.filter((person) => groupsOf(person.participantId).includes(group)).map((person) => meanSimilarity(person.pairs)),
            settings,
          ),
        ]),
      ),
      groupsWithheld: groupSizes.size - reportedGroups.length,
    },
    correctionRate: core.correctionRate,
    calibration: core.calibration,
    agreement: {
      choiceKappa: kappaEstimate(people, settings),
      ratingError: perPerson(ratingError),
    },
    anchoring: {
      exactMatchShift: anchoring(matchRate, isChoice),
      similarityShift: anchoring(meanSimilarity),
    },
    baselines: {
      population: {
        agent: perPerson(meanSimilarity),
        baseline: perPerson((personPairs) => mean(personPairs.map((pair) => pair.populationSimilarity).filter(finite))),
        lift: perPerson((personPairs) => lift(personPairs, 'populationSimilarity')),
      },
      group: {
        agent: perPerson((personPairs) => {
          const comparable = personPairs.filter((pair) => pair.groupSimilarity !== null);
          return comparable.length ? meanSimilarity(comparable) : null;
        }),
        baseline: perPerson((personPairs) => mean(personPairs.map((pair) => pair.groupSimilarity).filter(finite))),
        lift: perPerson((personPairs) => lift(personPairs, 'groupSimilarity')),
      },
    },
    unusualViews:
      points.length >= settings.minParticipants
        ? {
            participants: points.length,
            correlation: { agent: correlation('agent'), baseline: correlation('baseline'), lift: correlation('lift') },
            terciles,
          }
        : { participants: points.length, suppressed: true },
    synthesis: {
      ratingExtremity: shiftOf(byType('rating'), (pair, value) => extremity(pair.question, value)),
      quadraticTopShare: shiftOf(byType('quadratic'), (pair, value) => topShare(value)),
      quadraticCreditsUsed: shiftOf(byType('quadratic'), (pair, value) => creditsUsed(pair.question, value)),
      unsureRate: shiftOf(byType('binary'), (pair, value) => (value === 'Unsure' ? 1 : 0)),
      importance: ratingShift('Importance'),
      conviction: ratingShift('Conviction'),
      majorityPull: shiftOf(
        (pair) => isCategorical(pair.question) && pair.populationGuess !== null,
        (pair, value) => (answersMatch(value, pair.populationGuess) ? 1 : 0),
      ),
      spread: enough
        ? {
            value: spreadShift(people, settings.minParticipants),
            interval: bootstrapInterval(people, (draw) => spreadShift(draw, settings.minParticipants), settings),
            participants: people.length,
          }
        : withheld(people.length),
    },
    // Per-person rows for plotting, by pseudonym, only when there are enough
    // people; groups are listed only when they meet the minimum.
    participants: enough
      ? people.map((person, index) => ({
          id: `p${String(index + 1).padStart(3, '0')}`,
          predictions: person.pairs.length,
          mirrorScore: meanSimilarity(person.pairs),
          exactMatchRate: matchRate(person.pairs),
          typicality: typicality.get(person.participantId) ?? null,
          groups: groupsOf(person.participantId).filter((group) => reportedGroups.includes(group)),
          origins: [...new Set(person.pairs.map((pair) => pair.origin))].sort(),
        }))
      : [],
  };
};

/**
 * The report's Mirror Scores, correction rate and calibration, for the Results
 * screen. It skips the baselines and synthesis checks, which compare every pair
 * of people and are too slow to rerun in the browser; what it returns matches
 * the same parts of scoreAgentFidelity.
 */
export const scoreFidelityOverview = ({ questions = [], pairs = [], options = {} } = {}) => {
  const settings = { ...DEFAULTS, ...options };
  const scored = scorePairs(pairs.filter(allowedBy(settings)), mapQuestions(questions));
  const measured = scored.filter((pair) => pair.similarity !== null);
  const people = peopleOf(measured);
  return {
    method: FIDELITY_METHOD_VERSION,
    options: { ...settings, excludeParticipants: settings.excludeParticipants.length },
    coverage: coverageOf({ pairs, scored, measured, people, settings }),
    ...coreScores(people, settings),
  };
};

/**
 * Pairs for one person's own review, from the raw predicted and given answers,
 * ready for summarizeParticipantFidelity. Unreadable answers are left out.
 */
export const fidelityPairsFromReview = ({ questions = [], reviewed = [] } = {}) => {
  const questionMap = mapQuestions(questions);
  return reviewed
    .map((entry) => {
      const question = questionMap.get(lower(entry.questionId));
      if (!question) return null;
      const prediction = normalizeFidelityAnswer(question, entry.predicted);
      const actual = normalizeFidelityAnswer(question, entry.answered);
      if (prediction === null || actual === null) return null;
      return {
        questionId: question.id,
        condition: entry.condition === 'blind' ? 'blind' : 'shown',
        prediction,
        actual,
        confidence: readDraftConfidence(entry.confidence),
      };
    })
    .filter(Boolean);
};

/**
 * One person's own result, for showing back to them: the Mirror Score, how
 * many choice predictions matched (also for hidden drafts), and the AI's most
 * confident misses.
 */
export const summarizeParticipantFidelity = ({ questions = [], pairs = [] } = {}) => {
  const scored = scorePairs(pairs, mapQuestions(questions)).filter((pair) => pair.similarity !== null);
  if (!scored.length) return null;
  const choices = scored.filter(isChoice);
  const hidden = choices.filter((pair) => pair.condition === 'blind');
  const hiddenAll = scored.filter((pair) => pair.condition === 'blind');
  return {
    predictions: scored.length,
    mirrorScore: meanSimilarity(scored),
    choicePredictions: choices.length,
    choiceMatches: choices.filter((pair) => pair.match).length,
    hiddenChoicePredictions: hidden.length,
    hiddenChoiceMatches: hidden.filter((pair) => pair.match).length,
    // Every hidden draft, ratings and allocations included, guessed exactly or not.
    hiddenPredictions: hiddenAll.length,
    hiddenMatches: hiddenAll.filter((pair) => pair.match).length,
    meanConfidence: mean(choices.map((pair) => pair.confidence).filter(finite)),
    confidentMisses: choices
      .filter((pair) => !pair.match && pair.confidence !== null)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map(({ questionId, prediction, actual, confidence }) => ({ questionId, prediction, actual, confidence })),
  };
};
