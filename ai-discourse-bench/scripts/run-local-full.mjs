import path from 'node:path';

import {
  readJsonFile,
  readJsonFileIfExists,
  writeJsonFile,
  writeTextFile,
} from '../src/io.mjs';
import { createCheckpointWriter, readCheckpointRuns } from '../src/checkpoint.mjs';
import { runBenchmark } from '../src/runner.mjs';
import { buildResultsReport } from '../src/scoring.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';
import {
  throwIfErrors,
  validateModelRoster,
  validateQuestionBank,
} from '../src/schema.mjs';

const parsePositiveInt = (value, fallback, label) => {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
};

const slug = (value) => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const parseLocalModels = (raw) => String(raw || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry, index) => {
    const [model, label = model, parameterClass = 'local-configured', ossStatus = 'local-configured', countryOfOrigin = 'unknown'] = entry
      .split('|')
      .map((part) => part.trim());
    if (!model) throw new Error(`AIDB_LOCAL_MODELS entry ${index + 1} is missing a model id`);
    return {
      id: slug(label || model) || `local-model-${index + 1}`,
      label: label || model,
      model,
      provider: 'local',
      temperature: 0.2,
      maxTokens: process.env.AIDB_MAX_TOKENS ? parsePositiveInt(process.env.AIDB_MAX_TOKENS, 220, 'AIDB_MAX_TOKENS') : 220,
      traits: {
        parameterClass,
        ossStatus,
        countryOfOrigin,
        providerClass: 'local',
      },
    };
  });

const readModelRoster = async () => {
  if (process.env.AIDB_MODEL_ROSTER) {
    return readJsonFile(process.env.AIDB_MODEL_ROSTER);
  }
  const models = parseLocalModels(process.env.AIDB_LOCAL_MODELS);
  if (models.length === 0) {
    throw new Error([
      'Set AIDB_LOCAL_MODELS to run local models.',
      'Example:',
      'AIDB_LOCAL_MODELS="llama3.1:8b|Llama 3.1 8B|8B|open-weights|US,qwen2.5:14b|Qwen 2.5 14B|14B|open-weights|China"',
    ].join('\n'));
  }
  return {
    schemaVersion: 1,
    models,
  };
};

const questionBankPath = process.env.AIDB_QUESTION_BANK || './data/question-bank.sample.json';
const outputPrefix = process.env.AIDB_OUTPUT_PREFIX || 'local-self';
const repeats = parsePositiveInt(process.env.AIDB_REPEATS, 10, 'AIDB_REPEATS');
const concurrency = parsePositiveInt(process.env.AIDB_CONCURRENCY, 1, 'AIDB_CONCURRENCY');
const maxAttempts = parsePositiveInt(process.env.AIDB_MAX_ATTEMPTS, 3, 'AIDB_MAX_ATTEMPTS');
const progressEvery = parsePositiveInt(process.env.AIDB_PROGRESS_EVERY, 25, 'AIDB_PROGRESS_EVERY');
const limitQuestions = process.env.AIDB_LIMIT_QUESTIONS
  ? parsePositiveInt(process.env.AIDB_LIMIT_QUESTIONS, 0, 'AIDB_LIMIT_QUESTIONS')
  : 0;

const loadedQuestionBank = await readJsonFile(questionBankPath);
const questionBank = limitQuestions > 0
  ? {
    ...loadedQuestionBank,
    benchmarkId: `${loadedQuestionBank.benchmarkId}-first-${limitQuestions}`,
    questions: (loadedQuestionBank.questions || []).slice(0, limitQuestions),
    runPlan: {
      ...(loadedQuestionBank.runPlan || {}),
      limitQuestions,
    },
  }
  : loadedQuestionBank;
const modelRoster = await readModelRoster();

throwIfErrors('question bank', validateQuestionBank(questionBank));
throwIfErrors('model roster', validateModelRoster(modelRoster));

const totalExpectedRuns = (questionBank.questions || []).length * (modelRoster.models || []).length * 2 * repeats;
console.log(`running ${totalExpectedRuns} local model calls`);
console.log(`question bank: ${questionBankPath}`);
if (limitQuestions > 0) console.log(`question limit: first ${limitQuestions}`);
console.log(`models: ${modelRoster.models.map((model) => model.model).join(', ')}`);
console.log(`repeats per polarity: ${repeats}`);
console.log(`concurrency: ${concurrency}; max attempts: ${maxAttempts}`);

const runPath = path.join('./runs', `${outputPrefix}-runs.json`);
const checkpointPath = path.join('./runs', `${outputPrefix}-checkpoint.jsonl`);
const rosterPath = path.join('./runs', `${outputPrefix}-model-roster.generated.json`);
const reportPath = path.join('./results', `${outputPrefix}-report.json`);
const htmlPath = path.join('./results', `${outputPrefix}-report.html`);
const resume = /^(1|true|yes)$/i.test(process.env.AIDB_RESUME || '');
const priorOutput = resume ? await readJsonFileIfExists(runPath, { runs: [] }) : { runs: [] };
const checkpointRuns = resume ? await readCheckpointRuns(checkpointPath) : [];
const checkpointWriter = await createCheckpointWriter(checkpointPath, { reset: !resume });

const runsFile = await runBenchmark({
  questionBank,
  modelRoster,
  providerOverride: 'local',
  mode: 'self',
  repeats,
  concurrency,
  maxAttempts,
  scheduleSeed: process.env.AIDB_SCHEDULE_SEED || '',
  existingRuns: [...(priorOutput.runs || []), ...checkpointRuns],
  onRun: async (run, index) => {
    await checkpointWriter(run);
    if (index === 1 || index === totalExpectedRuns || index % progressEvery === 0) {
      const status = run.error || run.parseError ? 'issue' : 'ok';
      console.log(`[${index}/${totalExpectedRuns}] ${status} ${run.modelId} ${run.questionId} ${run.polarity} #${run.repeatIndex}`);
    }
  },
});

await writeJsonFile(rosterPath, modelRoster);
await writeJsonFile(runPath, runsFile);

const report = buildResultsReport({ questionBank, modelRoster, runsFile });
await writeJsonFile(reportPath, report);
await writeTextFile(htmlPath, renderHtmlReport(report));

const errored = runsFile.runs.filter((run) => run.error || run.parseError).length;
console.log(`wrote ${runPath}`);
console.log(`wrote ${reportPath}`);
console.log(`wrote ${htmlPath}`);
if (errored > 0) {
  console.log(`${errored} runs had provider or parse issues; inspect the report JSON before treating the results as complete.`);
}
