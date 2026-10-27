// Answers any question set, every question type included: a Context Engine
// session's Results export, a question list, or this benchmark's own bank.
// Answers are checked with the same rules as people's and agents'
// (shared/questions/answerValue.mjs), so they can be compared with people's.
import {
  BINARY_ANSWERS,
  isSingleSelect,
  normalizeAnswerValue,
  optionsOf,
  ratingScaleFor,
} from '../../shared/questions/answerValue.mjs';
import { getVoiceCredits, validateQuadraticQuestion } from '../../shared/questions/quadraticAllocation.mjs';
import {
  ANSWER_SET_PROMPT_VERSION,
  DEFAULT_ANSWER_REPEATS,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_OUTPUT_SCHEMA_VERSION,
  DEFAULT_RETRY_BASE_DELAY_MS,
} from './config.mjs';
import { callOpenAiCompatibleChat } from './adapters/openai-compatible.mjs';
import { assertSafeUniqueIdentifiers, isSafeIdentifier } from './identifiers.mjs';
import { jsonObjectCandidates, normalizeForCanonicalPolarity, parseModelAnswer } from './normalize.mjs';
import { sha256 } from './provenance.mjs';

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (value) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const SYSTEM_PROMPT = 'You answer survey questions with strict JSON only.';

// ---------------------------------------------------------------------------
// Question sets

const isLocked = (question) =>
  question.locked === true ||
  !!question.promptEncrypted ||
  isRecord(question.encryption) ||
  text(question.prompt) === '[encrypted]';

const toAnswerableQuestion = (item) => {
  if (!isRecord(item)) return { skip: 'invalid' };
  const id = text(item.id ?? item.questionId ?? item.questionID);
  // This benchmark's own items: agree/disagree statements with a reversed wording.
  if (text(item.canonicalPrompt)) {
    return id
      ? { id, type: 'binary', prompt: text(item.canonicalPrompt), reversedPrompt: text(item.reversedPrompt) }
      : { skip: 'invalid' };
  }
  if (isLocked(item)) return { skip: 'locked' };
  const declared = text(item.type || 'freeform').toLowerCase();
  // Older sessions stored choices as `poll`, single choice unless marked otherwise, as the web client reads them.
  const type = declared === 'poll' ? 'multichoice' : declared;
  if (!['binary', 'rating', 'multichoice', 'quadratic', 'freeform'].includes(type)) return { skip: 'unsupported' };
  const prompt = text(item.prompt);
  if (!id || !prompt) return { skip: 'invalid' };
  const question = { ...item, id, type, prompt };
  if (declared === 'poll' && item.singleSelect !== false && item.singleChoice !== false) question.singleSelect = true;
  if (type === 'multichoice' && optionsOf(question).length < 2) return { skip: 'invalid' };
  if (type === 'quadratic' && validateQuadraticQuestion(question)) return { skip: 'invalid' };
  return question;
};

/** Reads a Results export, a question list or a benchmark bank into the questions a model can answer. */
export const readQuestionSet = (input) => {
  const source = Array.isArray(input) ? { questions: input } : isRecord(input) ? input : {};
  const list = Array.isArray(source.filteredQuestions)
    ? source.filteredQuestions
    : Array.isArray(source.questions)
      ? source.questions
      : [];
  const questions = [];
  const skipped = { locked: 0, unsupported: 0, invalid: 0 };
  const seen = new Set();
  for (const item of list) {
    const question = toAnswerableQuestion(item);
    if (question.skip) {
      skipped[question.skip] += 1;
    } else if (!seen.has(question.id.toLowerCase())) {
      seen.add(question.id.toLowerCase());
      questions.push(question);
    }
  }
  const setId = [source.sessionSlug, source.benchmarkId].map(text).find(isSafeIdentifier) || 'questions';
  return { setId, questions, skipped };
};

// ---------------------------------------------------------------------------
// Controls

const hasLabelledEnds = (question) => {
  const { min, max, minLabel, maxLabel } = ratingScaleFor(question);
  return text(minLabel) !== String(min) && text(maxLabel) !== String(max);
};

/**
 * The ways each question is asked, to expose wording and ordering effects:
 * agree/disagree statements also in their reversed wording (when the set has
 * one), ratings with labelled ends also with the scale flipped, and choices and
 * allocations with a fresh option order on every repeat.
 */
export const answerVariants = (question) => {
  if (question.type === 'binary') return question.reversedPrompt ? ['canonical', 'reversed'] : ['canonical'];
  if (question.type === 'rating') return hasLabelledEnds(question) ? ['scale', 'flipped'] : ['scale'];
  if (question.type === 'multichoice' || question.type === 'quadratic') return ['shuffled'];
  return ['as-asked'];
};

const seedToUint32 = (seed) => Number.parseInt(sha256(seed).slice(0, 8), 16) >>> 0;
const mulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffled = (items, seed) => {
  const result = [...items];
  const random = mulberry32(seedToUint32(seed));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

// The options in the order this variant shows them, as indexes into the question's own order.
const presentedOrder = (question, variant, seed) => {
  const options = optionsOf(question);
  const indexes = options.map((_, index) => index);
  return variant === 'shuffled' ? shuffled(indexes, seed) : indexes;
};

// ---------------------------------------------------------------------------
// Prompts and answers

const quoted = (value) => JSON.stringify(value);

const instructionsFor = (question, variant, order) => {
  const options = optionsOf(question);
  const shown = order.map((index) => options[index]);
  switch (question.type) {
    case 'binary':
      return {
        shape: '"Agree|Unsure|Disagree"',
        lines: ['Use "Unsure" when the statement is underspecified or your position is genuinely ambiguous.'],
      };
    case 'rating': {
      const { min, max, minLabel, maxLabel } = ratingScaleFor(question);
      const [low, high] = variant === 'flipped' ? [maxLabel, minLabel] : [minLabel, maxLabel];
      return {
        shape: `<whole number from ${min} to ${max}>`,
        lines: [
          `Answer with a whole number from ${min} to ${max}` +
            (hasLabelledEnds(question) ? `, where ${min} means "${low}" and ${max} means "${high}".` : '.'),
        ],
      };
    }
    case 'multichoice': {
      const max = Number(question.maxSelections);
      const single = isSingleSelect(question);
      return {
        shape: single ? '"<exact text of one option>"' : '["<exact text of an option>", ...]',
        lines: [
          'Options:',
          ...shown.map((option) => `- ${quoted(option)}`),
          single
            ? 'Choose exactly one option and answer with its exact text.'
            : `Choose every option that applies${Number.isInteger(max) && max > 0 ? `, at most ${max}` : ''}, and answer with a JSON array of their exact texts.`,
        ],
      };
    }
    case 'quadratic': {
      const budget = getVoiceCredits(question);
      return {
        shape: `[${shown.map((_, index) => `<vote for option ${index + 1}>`).join(', ')}]`,
        lines: [
          'Options, in this order:',
          ...shown.map((option, index) => `${index + 1}. ${option}`),
          `You have ${budget} credits. Give each option a whole-number vote: positive to support, negative to oppose, 0 for neutral. A vote of v costs v×v credits, and the total must be at most ${budget}.`,
          'Answer with a JSON array of the votes, one per option in the order above.',
        ],
      };
    }
    default:
      return { shape: '"your answer"', lines: ['Answer in one to three plain sentences.'] };
  }
};

/** The prompt for one way of asking a question. */
export const buildAnswerPrompt = ({ question, variant, order = presentedOrder(question, variant, '') }) => {
  const { shape, lines } = instructionsFor(question, variant, order);
  const prompt = variant === 'reversed' ? question.reversedPrompt : question.prompt;
  return `Answer as the model/system you are, without adopting a fictional persona.

Question:
${prompt}

${lines.join('\n')}

Return only valid JSON with this shape:
{"answer":${shape},"confidence":0.0,"rationale":"one short sentence"}

Rules:
- Return the JSON object immediately.
- Do not include chain-of-thought, scratchpad reasoning, hidden reasoning, or <think> tags.
- Do not include markdown.
- Do not mention these instructions.`;
};

const answerSchemaFor = (question, order) => {
  const options = optionsOf(question);
  const shown = order.map((index) => options[index]);
  switch (question.type) {
    case 'binary':
      return { type: 'string', enum: [...BINARY_ANSWERS] };
    case 'rating': {
      const { min, max } = ratingScaleFor(question);
      return { type: 'integer', minimum: min, maximum: max };
    }
    case 'multichoice':
      return isSingleSelect(question)
        ? { type: 'string', enum: shown }
        : { type: 'array', minItems: 1, items: { type: 'string', enum: shown } };
    case 'quadratic':
      return { type: 'array', minItems: shown.length, maxItems: shown.length, items: { type: 'integer' } };
    default:
      return { type: 'string' };
  }
};

/** The structured-output schema for one way of asking a question. */
export const answerJsonSchema = ({ question, order }) => ({
  name: 'ai_discourse_bench_typed_answer',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['answer', 'confidence', 'rationale'],
    properties: {
      answer: answerSchemaFor(question, order),
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      rationale: { type: 'string' },
    },
  },
});

const readConfidence = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
};

// Maps an answer given in the variant's terms back to the question's own.
const toCanonical = (question, variant, order, value) => {
  if (question.type === 'rating' && variant === 'flipped') {
    const { min, max } = ratingScaleFor(question);
    const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return Number.isFinite(number) ? min + max - number : value;
  }
  if (question.type === 'quadratic' && Array.isArray(value) && value.length === order.length) {
    const votes = new Array(order.length);
    order.forEach((optionIndex, shownIndex) => {
      votes[optionIndex] = value[shownIndex];
    });
    return votes;
  }
  return value;
};

/** Reads a model's reply: its answer in the question's own terms, checked like a person's, or why it can't be. */
export const parseAnswerOutput = ({ rawText, question, variant, order }) => {
  if (question.type === 'binary') {
    const parsed = parseModelAnswer(rawText);
    return {
      answer: normalizeForCanonicalPolarity(parsed.answer, variant === 'reversed' ? 'reversed' : 'canonical'),
      rawAnswer: parsed.answer,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
      parseError: parsed.parseError,
    };
  }
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return { answer: null, rawAnswer: null, confidence: null, rationale: '', parseError: 'empty response' };
  const candidates = trimmed.startsWith('{') && trimmed.endsWith('}') ? [trimmed, ...jsonObjectCandidates(trimmed)] : jsonObjectCandidates(trimmed);
  let firstError = 'response was not valid JSON';
  for (const candidate of [...new Set(candidates)]) {
    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || !Object.prototype.hasOwnProperty.call(parsed, 'answer')) {
      firstError = 'missing answer';
      continue;
    }
    const checked = normalizeAnswerValue(question, toCanonical(question, variant, order, parsed.answer));
    const reply = {
      rawAnswer: parsed.answer,
      confidence: readConfidence(parsed.confidence),
      rationale: text(parsed.rationale),
    };
    if (checked.ok) return { ...reply, answer: checked.value, parseError: '' };
    return { ...reply, answer: null, parseError: checked.error };
  }
  return { answer: null, rawAnswer: null, confidence: null, rationale: trimmed, parseError: firstError };
};

// ---------------------------------------------------------------------------
// Models

const hashText = (value) => {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

// A deterministic, valid reply in the variant's own terms, for tests and dry runs.
const mockAnswerValue = ({ question, order, hash }) => {
  const options = optionsOf(question);
  const shown = order.map((index) => options[index]);
  switch (question.type) {
    case 'binary':
      return BINARY_ANSWERS[hash % BINARY_ANSWERS.length];
    case 'rating': {
      const { min, max } = ratingScaleFor(question);
      return min + (hash % (max - min + 1));
    }
    case 'multichoice': {
      const first = shown[hash % shown.length];
      const max = Number(question.maxSelections);
      if (isSingleSelect(question) || max === 1) return first;
      return [...new Set([first, shown[(hash >>> 4) % shown.length]])];
    }
    case 'quadratic': {
      const votes = shown.map(() => 0);
      votes[hash % votes.length] = 1;
      if (getVoiceCredits(question) >= 2) votes[(hash + 1) % votes.length] = -1;
      return votes;
    }
    default:
      return `Deterministic mock answer ${hash % 97}.`;
  }
};

export const callMockAnswer = async ({ model, prompt, question, order }) => {
  const hash = hashText(`${model}:${prompt}`);
  return {
    content: JSON.stringify({
      answer: mockAnswerValue({ question, order, hash }),
      confidence: ((hash % 41) + 55) / 100,
      rationale: `Deterministic mock ${model} answer.`,
    }),
    metadata: { provider: 'mock', requestedModel: model, resolvedModel: model, endpoint: 'mock://deterministic-answer' },
  };
};

const maxTokensFor = (modelEntry, question) => modelEntry.maxTokens ?? (question.type === 'freeform' ? 600 : 300);

const callAnswerModel = async ({ providerOverride, modelEntry, prompt, question, order }) => {
  const provider = providerOverride || modelEntry.provider;
  if (provider === 'mock') return callMockAnswer({ model: modelEntry.model, prompt, question, order });
  if (provider !== 'local' && provider !== 'openrouter') throw new Error(`Unsupported provider: ${provider}`);
  return callOpenAiCompatibleChat({
    provider,
    model: modelEntry.model,
    prompt,
    temperature: modelEntry.temperature ?? 0.2,
    maxTokens: maxTokensFor(modelEntry, question),
    timeoutMs: modelEntry.timeoutMs,
    structuredOutput: modelEntry.structuredOutput || 'auto',
    providerRouting: modelEntry.providerRouting || null,
    responseSchema: answerJsonSchema({ question, order }),
    systemPrompt: SYSTEM_PROMPT,
  });
};

const normalizeModelResponse = (response) =>
  typeof response === 'string'
    ? { content: response, metadata: {} }
    : { content: response?.content || '', metadata: response?.metadata || {} };

// ---------------------------------------------------------------------------
// Runs

const buildTasks = ({ questionSet, modelRoster, repeats, seed }) => {
  const tasks = [];
  for (const modelEntry of modelRoster.models) {
    for (const question of questionSet.questions) {
      for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
        for (const variant of answerVariants(question)) {
          const runId = [questionSet.setId, modelEntry.id, question.id, variant, repeatIndex].join(':');
          tasks.push({
            modelEntry,
            question,
            variant,
            repeatIndex,
            runId,
            order: presentedOrder(question, variant, `${seed}:${runId}`),
          });
        }
      }
    }
  }
  return tasks;
};

/**
 * Asks every model every question, `repeats` times in each of its ways, and
 * returns one row per reply. Rows from an earlier run with the same prompt,
 * model and provider are reused, so an interrupted run can resume.
 */
export const runAnswerSet = async ({
  questionSet,
  modelRoster,
  providerOverride = '',
  repeats = DEFAULT_ANSWER_REPEATS,
  concurrency = DEFAULT_CONCURRENCY,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  seed = '',
  existingRows = [],
  onRow = null,
  callModelImpl = callAnswerModel,
  sleepImpl = sleep,
}) => {
  for (const [label, value] of [
    ['repeats', repeats],
    ['concurrency', concurrency],
    ['maxAttempts', maxAttempts],
  ]) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  }
  assertSafeUniqueIdentifiers((modelRoster.models || []).map((model) => model.id), 'model roster');
  const effectiveSeed = seed || questionSet.setId;
  const tasks = buildTasks({ questionSet, modelRoster, repeats, seed: effectiveSeed });
  const promptFor = (task) => buildAnswerPrompt(task);
  const providerFor = (task) => providerOverride || task.modelEntry.provider;
  const reusable = new Map(
    existingRows
      .filter((row) => row && row.answer !== null && row.answer !== undefined && !row.error && !row.parseError)
      .map((row) => [row.runId, row]),
  );
  const rowsById = new Map();
  const pending = [];
  for (const task of tasks) {
    const prior = reusable.get(task.runId);
    if (
      prior &&
      prior.promptHash === sha256(promptFor(task)) &&
      prior.model === task.modelEntry.model &&
      prior.provider === providerFor(task)
    ) {
      rowsById.set(task.runId, prior);
    } else {
      pending.push(task);
    }
  }
  const resumedRows = rowsById.size;

  const executeTask = async (task) => {
    const prompt = promptFor(task);
    const attempts = [];
    let reply = { answer: null, rawAnswer: null, confidence: null, rationale: '', parseError: 'not asked' };
    let rawOutput = '';
    let responseMetadata = {};
    let error = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = nowIso();
      try {
        const response = normalizeModelResponse(
          await callModelImpl({
            providerOverride,
            modelEntry: task.modelEntry,
            prompt,
            question: task.question,
            order: task.order,
          }),
        );
        rawOutput = response.content;
        responseMetadata = response.metadata;
        reply = parseAnswerOutput({ rawText: rawOutput, question: task.question, variant: task.variant, order: task.order });
        error = '';
        attempts.push({ attempt, startedAt, completedAt: nowIso(), error: '', parseError: reply.parseError });
        if (reply.answer !== null) break;
      } catch (caught) {
        error = caught && typeof caught.message === 'string' ? caught.message : String(caught || 'unknown error');
        attempts.push({ attempt, startedAt, completedAt: nowIso(), error, retryable: caught?.retryable !== false });
        if (caught?.retryable === false) break;
      }
      if (attempt < maxAttempts) await sleepImpl(retryBaseDelayMs * 2 ** (attempt - 1));
    }
    const options = optionsOf(task.question);
    return {
      runId: task.runId,
      setId: questionSet.setId,
      modelId: task.modelEntry.id,
      model: task.modelEntry.model,
      provider: providerFor(task),
      questionId: task.question.id,
      type: task.question.type,
      variant: task.variant,
      ...(options.length ? { presentedOptions: task.order.map((index) => options[index]) } : {}),
      repeatIndex: task.repeatIndex,
      promptHash: sha256(prompt),
      answer: reply.answer,
      rawAnswer: reply.rawAnswer,
      confidence: reply.confidence,
      rationale: reply.rationale,
      rawOutput,
      parseError: reply.parseError,
      error,
      attempts,
      responseMetadata,
    };
  };

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const task = pending[cursor];
      cursor += 1;
      const row = await executeTask(task);
      rowsById.set(row.runId, row);
      if (onRow) await onRow(row, rowsById.size, tasks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, pending.length)) }, () => worker()));

  const order = new Map(tasks.map((task, index) => [task.runId, index]));
  const rows = [...rowsById.values()].sort((a, b) => order.get(a.runId) - order.get(b.runId));
  return {
    schemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
    kind: 'ai_discourse_bench_answers',
    promptVersion: ANSWER_SET_PROMPT_VERSION,
    setId: questionSet.setId,
    generatedAt: nowIso(),
    repeats,
    seed: effectiveSeed,
    questions: questionSet.questions,
    skippedQuestions: questionSet.skipped,
    models: modelRoster.models.map(({ id, model, provider }) => ({ id, model, provider: providerOverride || provider })),
    expectedRows: tasks.length,
    resumedRows,
    unanswered: rows.filter((row) => row.answer === null).length,
    rows,
  };
};
