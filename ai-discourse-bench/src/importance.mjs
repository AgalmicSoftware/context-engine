import {
  DEFAULT_CONCURRENCY,
  DEFAULT_IMPORTANCE_BUDGET,
  DEFAULT_IMPORTANCE_REPEATS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_OUTPUT_SCHEMA_VERSION,
  DEFAULT_RETRY_BASE_DELAY_MS,
  HARNESS_VERSION,
  IMPORTANCE_PROMPT_TEMPLATE_VERSION,
} from './config.mjs';
import { callOpenAiCompatibleChat } from './adapters/openai-compatible.mjs';
import { hashJson, sha256 } from './provenance.mjs';

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value, digits = 4) => (
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null
);

export const IMPORTANCE_JSON_SCHEMA = Object.freeze({
  name: 'ai_discourse_bench_quadratic_importance',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['allocations', 'rationale'],
    properties: {
      allocations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['questionId', 'votes'],
          properties: {
            questionId: { type: 'string' },
            votes: { type: 'integer', minimum: 1 },
          },
        },
      },
      rationale: { type: 'string' },
    },
  },
});

const jsonObjectCandidates = (text) => {
  const candidates = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return candidates;
};

export const buildImportancePrompt = ({ questionBank, budget = DEFAULT_IMPORTANCE_BUDGET }) => {
  const questions = (questionBank.questions || [])
    .map((question) => `${question.id}: ${question.canonicalPrompt}`)
    .join('\n');
  return `Allocate quadratic importance votes across this benchmark question bank.

You have ${budget} credits. Assign a non-negative integer number of importance votes to any questions you consider most important for understanding this topic. The credit cost for a question is votes squared. The sum of all squared vote costs must not exceed ${budget}. Omit questions receiving zero votes.

Judge importance, agenda priority, and consequence. Do not answer whether you agree or disagree with a question. Spread votes only when multiple questions genuinely deserve priority.

Questions:
${questions}

Return only valid JSON with this shape:
{"allocations":[{"questionId":"question-id","votes":3}],"rationale":"one short sentence"}

Rules:
- Every questionId must exactly match an id above.
- votes must be positive integers; omit zero-vote questions.
- sum(votes * votes) must be at most ${budget}.
- Return the JSON object immediately with no markdown or hidden reasoning.`;
};

export const parseImportanceAllocation = (rawText, {
  questionIds,
  budget = DEFAULT_IMPORTANCE_BUDGET,
} = {}) => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return { allocations: [], rationale: '', spentCredits: 0, parseError: 'empty response' };
  const knownQuestionIds = questionIds instanceof Set ? questionIds : new Set(questionIds || []);
  const candidates = trimmed.startsWith('{') && trimmed.endsWith('}')
    ? [trimmed, ...jsonObjectCandidates(trimmed)]
    : jsonObjectCandidates(trimmed);
  let parsedObject = null;
  let lastFailure = null;
  for (const candidate of [...new Set(candidates)]) {
    try {
      parsedObject = JSON.parse(candidate);
      if (!Array.isArray(parsedObject?.allocations)) {
        lastFailure = {
          allocations: [],
          rationale: typeof parsedObject?.rationale === 'string' ? parsedObject.rationale.trim() : '',
          spentCredits: 0,
          parseError: 'missing or invalid allocations',
        };
        continue;
      }
      const seen = new Set();
      const allocations = [];
      let parseError = '';
      for (const [index, allocation] of parsedObject.allocations.entries()) {
        const questionId = typeof allocation?.questionId === 'string' ? allocation.questionId.trim() : '';
        const votes = Number(allocation?.votes);
        if (!questionId || (knownQuestionIds.size && !knownQuestionIds.has(questionId))) {
          parseError = `allocations[${index}].questionId is unknown`;
          break;
        }
        if (seen.has(questionId)) {
          parseError = `allocations duplicates ${questionId}`;
          break;
        }
        if (!Number.isInteger(votes) || votes < 1) {
          parseError = `allocations[${index}].votes must be a positive integer`;
          break;
        }
        seen.add(questionId);
        allocations.push({ questionId, votes, cost: votes ** 2 });
      }
      const spentCredits = allocations.reduce((sum, allocation) => sum + allocation.cost, 0);
      if (!parseError && allocations.length === 0) parseError = 'allocations must not be empty';
      if (!parseError && spentCredits > budget) {
        parseError = `quadratic cost ${spentCredits} exceeds budget ${budget}`;
      }
      const result = {
        allocations: parseError ? [] : allocations.sort((left, right) => left.questionId.localeCompare(right.questionId)),
        rationale: typeof parsedObject.rationale === 'string' ? parsedObject.rationale.trim() : '',
        spentCredits: parseError ? 0 : spentCredits,
        parseError,
      };
      if (!parseError) return result;
      lastFailure = result;
    } catch {
      // Try the next balanced JSON object.
    }
  }
  return lastFailure || {
    allocations: [],
    rationale: typeof parsedObject?.rationale === 'string' ? parsedObject.rationale.trim() : '',
    spentCredits: 0,
    parseError: parsedObject ? 'missing or invalid allocations' : 'response was not valid JSON',
  };
};

const importanceMaxTokensFor = (modelEntry) => {
  const configured = Number(modelEntry.importanceMaxTokens || modelEntry.maxTokens || 0);
  return Number.isFinite(configured) && configured > 0 ? Math.max(1200, configured) : 1200;
};

const deterministicMockImportance = ({ model, questionBank, budget }) => {
  let remaining = budget;
  const allocations = [...(questionBank.questions || [])]
    .sort((left, right) => sha256(`${model}:${left.id}`).localeCompare(sha256(`${model}:${right.id}`)))
    .map((question) => {
      const votes = Math.min(5, Math.floor(Math.sqrt(remaining)));
      if (votes < 1) return null;
      remaining -= votes ** 2;
      return { questionId: question.id, votes };
    })
    .filter(Boolean);
  return {
    content: JSON.stringify({
      allocations,
      rationale: `Deterministic mock allocation for ${model}.`,
    }),
    metadata: {
      provider: 'mock',
      requestedModel: model,
      resolvedModel: model,
      requestId: `mock-importance-${sha256(`${model}:${budget}`).slice(0, 12)}`,
      finishReason: 'stop',
      usage: null,
      latencyMs: 0,
      endpoint: 'mock://deterministic-importance',
    },
  };
};

const defaultCallModel = async ({ providerOverride, modelEntry, prompt, questionBank, budget }) => {
  const provider = providerOverride || modelEntry.provider;
  if (provider === 'mock') {
    return deterministicMockImportance({ model: modelEntry.model, questionBank, budget });
  }
  if (!['local', 'openrouter'].includes(provider)) throw new Error(`Unsupported provider: ${provider}`);
  return callOpenAiCompatibleChat({
    provider,
    model: modelEntry.model,
    prompt,
    temperature: modelEntry.temperature ?? 0.2,
    maxTokens: importanceMaxTokensFor(modelEntry),
    timeoutMs: modelEntry.timeoutMs,
    structuredOutput: modelEntry.structuredOutput || 'auto',
    providerRouting: modelEntry.providerRouting || null,
    responseSchema: IMPORTANCE_JSON_SCHEMA,
    systemPrompt: 'You allocate quadratic importance votes for a benchmark and return strict JSON only.',
  });
};

const normalizeModelResponse = (response) => (
  typeof response === 'string'
    ? { content: response, metadata: {} }
    : { content: response?.content || '', metadata: response?.metadata || {} }
);

export const buildImportanceRunId = ({ benchmarkId, modelId, repeatIndex }) => (
  [benchmarkId, 'quadratic-importance', modelId, repeatIndex].join(':')
);

export const runImportanceBenchmark = async ({
  questionBank,
  modelRoster,
  providerOverride = '',
  budget = DEFAULT_IMPORTANCE_BUDGET,
  repeats = DEFAULT_IMPORTANCE_REPEATS,
  concurrency = DEFAULT_CONCURRENCY,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  existingRuns = [],
  onRun = null,
  callModelImpl = defaultCallModel,
  sleepImpl = sleep,
}) => {
  for (const [value, label] of [[budget, 'budget'], [repeats, 'repeats'], [concurrency, 'concurrency'], [maxAttempts, 'maxAttempts']]) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  }
  const startedAt = nowIso();
  const prompt = buildImportancePrompt({ questionBank, budget });
  const promptHash = sha256(prompt);
  const questionIds = new Set((questionBank.questions || []).map((question) => question.id));
  const tasks = (modelRoster.models || []).flatMap((modelEntry) => (
    Array.from({ length: repeats }, (_, repeatIndex) => ({
      modelEntry,
      repeatIndex: repeatIndex + 1,
      runId: buildImportanceRunId({
        benchmarkId: questionBank.benchmarkId,
        modelId: modelEntry.id,
        repeatIndex: repeatIndex + 1,
      }),
    }))
  ));
  const expectedRunIds = new Set(tasks.map((task) => task.runId));
  const taskByRunId = new Map(tasks.map((task) => [task.runId, task]));
  const isReusableRun = (run, task) => {
    const expectedGeneration = {
      temperature: task.modelEntry.temperature ?? 0.2,
      maxTokens: importanceMaxTokensFor(task.modelEntry),
      timeoutMs: task.modelEntry.timeoutMs ?? null,
      structuredOutput: task.modelEntry.structuredOutput || 'auto',
      providerRouting: task.modelEntry.providerRouting || null,
    };
    return run?.runId === task.runId
      && !run.error
      && !run.parseError
      && Array.isArray(run.allocations)
      && run.allocations.length > 0
      && run.promptHash === promptHash
      && run.model === task.modelEntry.model
      && run.provider === (providerOverride || task.modelEntry.provider)
      && Number(run.budget) === budget
      && Number(run.generation?.temperature) === Number(expectedGeneration.temperature)
      && Number(run.generation?.maxTokens) === Number(expectedGeneration.maxTokens)
      && (run.generation?.timeoutMs ?? null) === expectedGeneration.timeoutMs
      && (run.generation?.structuredOutput || 'auto') === expectedGeneration.structuredOutput
      && hashJson(run.generation?.providerRouting || null) === hashJson(expectedGeneration.providerRouting)
      && hashJson(run.modelProvenance || {}) === hashJson(task.modelEntry.provenance || {})
    ;
  };
  const runsById = new Map(existingRuns
    .filter((run) => {
      const task = run?.runId ? taskByRunId.get(run.runId) : null;
      return task && isReusableRun(run, task);
    })
    .map((run) => [run.runId, run]));
  const pendingTasks = tasks.filter((task) => !runsById.has(task.runId));
  let cursor = 0;
  let newlyCompleted = 0;

  const executeTask = async (task) => {
    const attempts = [];
    let rawOutput = '';
    let responseMetadata = {};
    let error = '';
    let parsed = parseImportanceAllocation('', { questionIds, budget });
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = nowIso();
      try {
        const response = normalizeModelResponse(await callModelImpl({
          providerOverride,
          modelEntry: task.modelEntry,
          prompt,
          questionBank,
          budget,
        }));
        rawOutput = response.content;
        responseMetadata = response.metadata;
        parsed = parseImportanceAllocation(rawOutput, { questionIds, budget });
        attempts.push({
          attempt,
          startedAt: attemptStartedAt,
          completedAt: nowIso(),
          error: '',
          parseError: parsed.parseError,
          responseMetadata,
        });
        error = '';
        if (!parsed.parseError) break;
      } catch (caught) {
        error = caught?.message || String(caught || 'unknown error');
        attempts.push({
          attempt,
          startedAt: attemptStartedAt,
          completedAt: nowIso(),
          error,
          retryable: caught?.retryable !== false,
          status: Number.isFinite(caught?.status) ? caught.status : null,
          code: caught?.code || null,
        });
        if (caught?.retryable === false) break;
      }
      if (attempt < maxAttempts) await sleepImpl(retryBaseDelayMs * (2 ** (attempt - 1)));
    }
    return {
      schemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
      benchmarkId: questionBank.benchmarkId,
      runId: task.runId,
      mode: 'quadratic-importance',
      modelId: task.modelEntry.id,
      model: task.modelEntry.model,
      provider: providerOverride || task.modelEntry.provider,
      repeatIndex: task.repeatIndex,
      budget,
      promptHash,
      generation: {
        temperature: task.modelEntry.temperature ?? 0.2,
        maxTokens: importanceMaxTokensFor(task.modelEntry),
        timeoutMs: task.modelEntry.timeoutMs ?? null,
        structuredOutput: task.modelEntry.structuredOutput || 'auto',
        providerRouting: task.modelEntry.providerRouting || null,
      },
      modelProvenance: task.modelEntry.provenance || {},
      allocations: parsed.allocations,
      spentCredits: parsed.spentCredits,
      unspentCredits: budget - parsed.spentCredits,
      rationale: parsed.rationale,
      rawOutput,
      parseError: parsed.parseError,
      error,
      attempts,
      responseMetadata,
      startedAt: attempts[0]?.startedAt || nowIso(),
      completedAt: attempts.at(-1)?.completedAt || nowIso(),
    };
  };

  const worker = async () => {
    while (cursor < pendingTasks.length) {
      const task = pendingTasks[cursor];
      cursor += 1;
      const run = await executeTask(task);
      runsById.set(run.runId, run);
      newlyCompleted += 1;
      if (onRun) await onRun(run, runsById.size, tasks.length);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(concurrency, Math.max(1, pendingTasks.length)) },
    () => worker(),
  ));

  const runs = Array.from(runsById.values())
    .filter((run) => expectedRunIds.has(run.runId))
    .sort((left, right) => left.runId.localeCompare(right.runId));
  const completedAt = nowIso();
  return {
    schemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
    kind: 'ai_discourse_bench_importance_runs',
    benchmarkId: questionBank.benchmarkId,
    mode: 'quadratic-importance',
    generatedAt: completedAt,
    budget,
    repeats,
    expectedRuns: tasks.length,
    resumedRuns: runs.length - newlyCompleted,
    manifest: {
      schemaVersion: 1,
      kind: 'ai_discourse_bench_importance_manifest',
      harnessVersion: HARNESS_VERSION,
      benchmarkId: questionBank.benchmarkId,
      questionBankHash: hashJson(questionBank),
      modelRosterHash: hashJson(modelRoster),
      promptTemplateVersion: IMPORTANCE_PROMPT_TEMPLATE_VERSION,
      promptTemplateHash: sha256(buildImportancePrompt.toString()),
      promptHash,
      budget,
      repeats,
      startedAt,
      completedAt,
      expectedRuns: tasks.length,
      completedRuns: runs.length,
      models: (modelRoster.models || []).map((model) => ({
        id: model.id,
        model: model.model,
        provider: providerOverride || model.provider,
        temperature: model.temperature ?? 0.2,
        maxTokens: importanceMaxTokensFor(model),
        timeoutMs: model.timeoutMs ?? null,
        structuredOutput: model.structuredOutput || 'auto',
        providerRouting: model.providerRouting || null,
        provenance: model.provenance || {},
      })),
    },
    runs,
  };
};

export const validateImportanceRuns = (file, {
  modelIds = null,
  questionIds = null,
  benchmarkId = '',
} = {}) => {
  const errors = [];
  if (!file || typeof file !== 'object' || Array.isArray(file)) return ['importance runs file must be an object'];
  if (file.kind !== 'ai_discourse_bench_importance_runs') errors.push('kind must be ai_discourse_bench_importance_runs');
  if (file.mode !== 'quadratic-importance') errors.push('mode must be quadratic-importance');
  const budget = Number(file.budget);
  if (!Number.isInteger(budget) || budget < 1) errors.push('budget must be a positive integer');
  if (!Array.isArray(file.runs)) return [...errors, 'runs must be an array'];
  const seen = new Set();
  file.runs.forEach((run, index) => {
    const base = `runs[${index}]`;
    if (!run || typeof run !== 'object' || Array.isArray(run)) {
      errors.push(`${base} must be an object`);
      return;
    }
    if (typeof run.runId !== 'string' || !run.runId) errors.push(`${base}.runId must be a non-empty string`);
    if (seen.has(run.runId)) errors.push(`${base}.runId duplicates ${run.runId}`);
    seen.add(run.runId);
    if (run.mode !== 'quadratic-importance') errors.push(`${base}.mode must be quadratic-importance`);
    if (modelIds && !modelIds.has(run.modelId)) errors.push(`${base}.modelId references unknown model ${run.modelId}`);
    const benchmarkFamily = (value) => String(value || '').replace(/-first-\d+$/, '');
    if (benchmarkId && run.benchmarkId && benchmarkFamily(run.benchmarkId) !== benchmarkFamily(benchmarkId)) {
      errors.push(`${base}.benchmarkId ${run.benchmarkId} is incompatible with ${benchmarkId}`);
    }
    if (Number(run.budget) !== budget) errors.push(`${base}.budget must match artifact budget ${budget}`);
    if (!Number.isInteger(Number(run.repeatIndex)) || Number(run.repeatIndex) < 1) {
      errors.push(`${base}.repeatIndex must be a positive integer`);
    } else if (Number.isInteger(Number(file.repeats)) && Number(run.repeatIndex) > Number(file.repeats)) {
      errors.push(`${base}.repeatIndex exceeds artifact repeats ${file.repeats}`);
    }
    if (!run.error && !run.parseError) {
      const parsed = parseImportanceAllocation(JSON.stringify({ allocations: run.allocations, rationale: run.rationale || '' }), {
        questionIds,
        budget,
      });
      if (parsed.parseError) errors.push(`${base}.${parsed.parseError}`);
      if (Number(run.spentCredits) !== parsed.spentCredits) errors.push(`${base}.spentCredits does not match allocations`);
      if (Number(run.unspentCredits) !== budget - parsed.spentCredits) errors.push(`${base}.unspentCredits does not match budget`);
    }
  });
  return errors;
};

export const summarizeImportanceRuns = ({ importanceFile, questionBank, modelRoster }) => {
  const budget = Number(importanceFile?.budget || 0);
  const runs = Array.isArray(importanceFile?.runs) ? importanceFile.runs : [];
  const questions = questionBank.questions || [];
  const models = modelRoster.models || [];
  const questionIds = new Set(questions.map((question) => question.id));
  const validRuns = runs.map((run) => {
    if (run.error || run.parseError || !Array.isArray(run.allocations)) return null;
    const parsed = parseImportanceAllocation(JSON.stringify({
      allocations: run.allocations,
      rationale: run.rationale || '',
    }), { questionIds, budget });
    if (parsed.parseError) return null;
    return { ...run, allocations: parsed.allocations, spentCredits: parsed.spentCredits };
  }).filter(Boolean);
  const byModel = {};
  models.forEach((model) => {
    const modelRuns = validRuns.filter((run) => run.modelId === model.id);
    if (!modelRuns.length) return;
    const byQuestion = {};
    questions.forEach((question) => {
      const votes = modelRuns.map((run) => Number(run.allocations.find((entry) => entry.questionId === question.id)?.votes || 0));
      const meanVotes = round(votes.reduce((sum, value) => sum + value, 0) / modelRuns.length);
      if (meanVotes > 0) {
        byQuestion[question.id] = {
          meanVotes,
          meanCost: round(votes.reduce((sum, value) => sum + (value ** 2), 0) / modelRuns.length),
        };
      }
    });
    const meanSpentCredits = modelRuns.reduce((sum, run) => sum + Number(run.spentCredits || 0), 0) / modelRuns.length;
    byModel[model.id] = {
      attemptedRuns: runs.filter((run) => run.modelId === model.id).length,
      validRuns: modelRuns.length,
      meanSpentCredits: round(meanSpentCredits),
      budget,
      utilizationRate: budget ? round(meanSpentCredits / budget) : null,
      byQuestion,
    };
  });
  const contributingModelIds = Object.keys(byModel);
  const byQuestion = {};
  questions.forEach((question) => {
    const values = contributingModelIds.map((modelId) => Number(byModel[modelId].byQuestion[question.id]?.meanVotes || 0));
    byQuestion[question.id] = {
      meanVotes: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
      modelCount: values.length,
    };
  });
  const totalMeanVotes = Object.values(byQuestion).reduce((sum, row) => sum + row.meanVotes, 0);
  Object.values(byQuestion).forEach((row) => {
    row.share = totalMeanVotes ? round(row.meanVotes / totalMeanVotes) : 0;
  });
  const byTopic = {};
  questions.forEach((question) => {
    const topic = question.topic || 'uncategorized';
    if (!byTopic[topic]) byTopic[topic] = { meanVotes: 0, questionCount: 0, modelCount: contributingModelIds.length };
    byTopic[topic].meanVotes += byQuestion[question.id].meanVotes;
    byTopic[topic].questionCount += 1;
  });
  Object.values(byTopic).forEach((row) => {
    row.meanVotes = round(row.meanVotes);
    row.share = totalMeanVotes ? round(row.meanVotes / totalMeanVotes) : 0;
  });
  return {
    available: contributingModelIds.length > 0 && totalMeanVotes > 0,
    method: 'quadratic-voting',
    aggregationUnit: 'model-participant',
    costFunction: 'votes-squared',
    budget,
    repeats: Number(importanceFile?.repeats || 0),
    attemptedRuns: runs.length,
    validRuns: validRuns.length,
    contributingModels: contributingModelIds.length,
    totalMeanVotes: round(totalMeanVotes),
    byModel,
    byQuestion,
    byTopic,
  };
};
