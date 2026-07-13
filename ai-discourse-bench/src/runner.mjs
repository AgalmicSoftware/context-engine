import {
  ANSWER_VALUES,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_OUTPUT_SCHEMA_VERSION,
  DEFAULT_RETRY_BASE_DELAY_MS,
} from './config.mjs';
import { callMockModel } from './adapters/mock.mjs';
import { callOpenAiCompatibleChat } from './adapters/openai-compatible.mjs';
import {
  buildQuestionPrompt,
  normalizeForCanonicalPolarity,
  parseModelAnswer,
} from './normalize.mjs';
import { buildRunManifest, hashJson, sha256 } from './provenance.mjs';

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callModel = async ({ providerOverride, modelEntry, prompt }) => {
  const provider = providerOverride || modelEntry.provider;
  if (provider === 'mock') {
    return callMockModel({ model: modelEntry.model, prompt });
  }
  if (provider === 'local' || provider === 'openrouter') {
    return callOpenAiCompatibleChat({
      provider,
      model: modelEntry.model,
      prompt,
      temperature: modelEntry.temperature ?? 0.2,
      maxTokens: modelEntry.maxTokens ?? 220,
      timeoutMs: modelEntry.timeoutMs,
      structuredOutput: modelEntry.structuredOutput || 'auto',
      providerRouting: modelEntry.providerRouting || null,
    });
  }
  throw new Error(`Unsupported provider: ${provider}`);
};

const seedToUint32 = (seed) => Number.parseInt(sha256(seed).slice(0, 8), 16) >>> 0;

const mulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
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

export const buildRunId = ({ benchmarkId, mode, personaId, modelId, questionId, polarity, repeatIndex }) => [
  benchmarkId,
  mode,
  personaId || 'self',
  modelId,
  questionId,
  polarity,
  repeatIndex,
].join(':');

const buildTasks = ({ questionBank, modelRoster, mode, personaId, repeats }) => {
  const tasks = [];
  for (const modelEntry of modelRoster.models) {
    for (const question of questionBank.questions) {
      for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
        for (const polarity of ['canonical', 'reversed']) {
          tasks.push({
            modelEntry,
            question,
            polarity,
            repeatIndex,
            runId: buildRunId({
              benchmarkId: questionBank.benchmarkId,
              mode,
              personaId,
              modelId: modelEntry.id,
              questionId: question.id,
              polarity,
              repeatIndex,
            }),
          });
        }
      }
    }
  }
  return tasks;
};

const normalizeModelResponse = (response) => (
  typeof response === 'string'
    ? { content: response, metadata: {} }
    : { content: response?.content || '', metadata: response?.metadata || {} }
);

const shouldRetry = (error) => error?.retryable !== false;

export const runBenchmark = async ({
  questionBank,
  modelRoster,
  personasFile = { personas: [] },
  providerOverride = '',
  mode = 'self',
  personaId = '',
  repeats = 10,
  concurrency = DEFAULT_CONCURRENCY,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  scheduleSeed = '',
  existingRuns = [],
  onRun = null,
  callModelImpl = callModel,
  sleepImpl = sleep,
}) => {
  const persona = mode === 'persona'
    ? personasFile.personas.find((entry) => entry.id === personaId)
    : null;
  if (mode === 'persona' && !persona) {
    throw new Error(`Persona ${personaId || '(missing)'} was not found.`);
  }
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer');
  }
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error('repeats must be a positive integer');
  }
  if (!Number.isFinite(retryBaseDelayMs) || retryBaseDelayMs < 0) {
    throw new Error('retryBaseDelayMs must be a non-negative number');
  }

  const startedAt = nowIso();
  const effectiveScheduleSeed = scheduleSeed || [
    questionBank.benchmarkId,
    mode,
    persona?.id || 'self',
    repeats,
  ].join(':');
  const manifest = buildRunManifest({
    questionBank,
    modelRoster,
    mode,
    persona,
    providerOverride,
    repeats,
    concurrency,
    maxAttempts,
    scheduleSeed: effectiveScheduleSeed,
    startedAt,
    promptTemplateHash: sha256(buildQuestionPrompt.toString()),
  });
  const tasks = shuffled(buildTasks({
    questionBank,
    modelRoster,
    mode,
    personaId: persona?.id || null,
    repeats,
  }), effectiveScheduleSeed);
  const expectedRunIds = new Set(tasks.map((task) => task.runId));
  const buildPromptForTask = (task) => buildQuestionPrompt({
    question: task.question,
    mode,
    persona,
    polarity: task.polarity,
  });
  const isReusableRun = (run, task) => {
    if (!run || run.error || run.parseError || !ANSWER_VALUES.includes(run.normalizedAnswer)) return false;
    const expectedProvider = providerOverride || task.modelEntry.provider;
    const expectedGeneration = {
      temperature: task.modelEntry.temperature ?? 0.2,
      maxTokens: task.modelEntry.maxTokens ?? 220,
      timeoutMs: task.modelEntry.timeoutMs ?? null,
      structuredOutput: task.modelEntry.structuredOutput || 'auto',
      providerRouting: task.modelEntry.providerRouting || null,
    };
    return run.runId === task.runId
      && run.promptHash === sha256(buildPromptForTask(task))
      && run.model === task.modelEntry.model
      && run.provider === expectedProvider
      && Number(run.generation?.temperature) === Number(expectedGeneration.temperature)
      && Number(run.generation?.maxTokens) === Number(expectedGeneration.maxTokens)
      && (run.generation?.timeoutMs ?? null) === expectedGeneration.timeoutMs
      && (run.generation?.structuredOutput || 'auto') === expectedGeneration.structuredOutput
      && hashJson(run.generation?.providerRouting || null) === hashJson(expectedGeneration.providerRouting)
      && hashJson(run.modelProvenance || {}) === hashJson(task.modelEntry.provenance || {});
  };
  const taskByRunId = new Map(tasks.map((task) => [task.runId, task]));
  const runsById = new Map(
    existingRuns
      .filter((run) => {
        const task = run?.runId ? taskByRunId.get(run.runId) : null;
        return task && isReusableRun(run, task);
      })
      .map((run) => [run.runId, run])
  );
  const pendingTasks = tasks.filter((task) => !runsById.has(task.runId));
  let taskCursor = 0;
  let newlyCompleted = 0;

  const executeTask = async (task) => {
    const prompt = buildPromptForTask(task);
    const attempts = [];
    let rawOutput = '';
    let responseMetadata = {};
    let error = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = nowIso();
      try {
        const response = normalizeModelResponse(await callModelImpl({
          providerOverride,
          modelEntry: task.modelEntry,
          prompt,
        }));
        rawOutput = response.content;
        responseMetadata = response.metadata;
        attempts.push({
          attempt,
          startedAt: attemptStartedAt,
          completedAt: nowIso(),
          error: '',
          responseMetadata,
        });
        error = '';
        break;
      } catch (caught) {
        error = caught && typeof caught.message === 'string' ? caught.message : String(caught || 'unknown error');
        attempts.push({
          attempt,
          startedAt: attemptStartedAt,
          completedAt: nowIso(),
          error,
          retryable: shouldRetry(caught),
          status: Number.isFinite(caught?.status) ? caught.status : null,
          code: caught?.code || null,
        });
        if (attempt >= maxAttempts || !shouldRetry(caught)) break;
        await sleepImpl(retryBaseDelayMs * (2 ** (attempt - 1)));
      }
    }

    const parsed = parseModelAnswer(rawOutput);
    const normalizedAnswer = normalizeForCanonicalPolarity(parsed.answer, task.polarity);
    return {
      schemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
      benchmarkId: questionBank.benchmarkId,
      runId: task.runId,
      mode,
      personaId: persona?.id || null,
      modelId: task.modelEntry.id,
      model: task.modelEntry.model,
      provider: providerOverride || task.modelEntry.provider,
      questionId: task.question.id,
      polarity: task.polarity,
      repeatIndex: task.repeatIndex,
      promptHash: sha256(prompt),
      generation: {
        temperature: task.modelEntry.temperature ?? 0.2,
        maxTokens: task.modelEntry.maxTokens ?? 220,
        timeoutMs: task.modelEntry.timeoutMs ?? null,
        structuredOutput: task.modelEntry.structuredOutput || 'auto',
        providerRouting: task.modelEntry.providerRouting || null,
      },
      modelProvenance: task.modelEntry.provenance || {},
      rawAnswer: parsed.answer,
      normalizedAnswer,
      confidence: parsed.confidence,
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
    while (taskCursor < pendingTasks.length) {
      const task = pendingTasks[taskCursor];
      taskCursor += 1;
      const runRecord = await executeTask(task);
      runsById.set(runRecord.runId, runRecord);
      newlyCompleted += 1;
      if (onRun) {
        await onRun(runRecord, runsById.size, tasks.length);
      }
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(concurrency, Math.max(1, pendingTasks.length)) },
    () => worker()
  ));

  const runs = Array.from(runsById.values())
    .filter((run) => expectedRunIds.has(run.runId))
    .sort((left, right) => left.runId.localeCompare(right.runId));
  const completedAt = nowIso();

  return {
    schemaVersion: DEFAULT_OUTPUT_SCHEMA_VERSION,
    kind: 'ai_discourse_bench_runs',
    benchmarkId: questionBank.benchmarkId,
    mode,
    personaId: persona?.id || null,
    generatedAt: completedAt,
    repeats,
    expectedRuns: tasks.length,
    resumedRuns: runs.length - newlyCompleted,
    manifest: {
      ...manifest,
      completedAt,
      expectedRuns: tasks.length,
      completedRuns: runs.length,
    },
    runs,
  };
};
