import path from 'node:path';

import {
  readJsonFile,
  readJsonFileIfExists,
  writeJsonFile,
  writeTextFile,
} from '../src/io.mjs';
import { createCheckpointWriter, readCheckpointRuns } from '../src/checkpoint.mjs';
import { assertWithinEstimatedCostBudget, buildExperimentPlan } from '../src/experiment-plan.mjs';
import { auditOpenRouterRoster, fetchOpenRouterCatalog } from '../src/openrouter-catalog.mjs';
import { limitQuestionBank } from '../src/report-inputs.mjs';
import { runBenchmark } from '../src/runner.mjs';
import { buildResultsReport } from '../src/scoring.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';
import {
  throwIfErrors,
  validateModelRoster,
  validatePersonas,
  validateQuestionBank,
  validateRuns,
} from '../src/schema.mjs';

const parsePositiveInt = (value, fallback, label) => {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
};

const mode = process.env.AIDB_MODE || 'self';
if (!['self', 'persona'].includes(mode)) throw new Error('AIDB_MODE must be self or persona');
if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required for openrouter:full');

const questionBankPath = process.env.AIDB_QUESTION_BANK || './banks/ai-futures/v0.1-candidate/question-bank.json';
const modelRosterPath = process.env.AIDB_MODEL_ROSTER || './data/model-roster.openrouter.sample.json';
const personasPath = process.env.AIDB_PERSONAS || './data/personas.sample.json';
const personaId = mode === 'persona' ? String(process.env.AIDB_PERSONA || '').trim() : '';
if (mode === 'persona' && !personaId) throw new Error('AIDB_PERSONA is required when AIDB_MODE=persona');

const repeats = parsePositiveInt(process.env.AIDB_REPEATS, 10, 'AIDB_REPEATS');
const concurrency = parsePositiveInt(process.env.AIDB_CONCURRENCY, 4, 'AIDB_CONCURRENCY');
const maxAttempts = parsePositiveInt(process.env.AIDB_MAX_ATTEMPTS, 3, 'AIDB_MAX_ATTEMPTS');
const progressEvery = parsePositiveInt(process.env.AIDB_PROGRESS_EVERY, 25, 'AIDB_PROGRESS_EVERY');
const questionLimit = process.env.AIDB_LIMIT_QUESTIONS
  ? parsePositiveInt(process.env.AIDB_LIMIT_QUESTIONS, 0, 'AIDB_LIMIT_QUESTIONS')
  : 0;

const questionBank = limitQuestionBank(await readJsonFile(questionBankPath), questionLimit);
const modelRoster = await readJsonFile(modelRosterPath);
const personasFile = mode === 'persona' ? await readJsonFile(personasPath) : { personas: [] };
const persona = mode === 'persona'
  ? personasFile.personas.find((entry) => entry.id === personaId)
  : null;

throwIfErrors('question bank', validateQuestionBank(questionBank));
throwIfErrors('model roster', validateModelRoster(modelRoster));
if (mode === 'persona') {
  throwIfErrors('personas', validatePersonas(personasFile));
  if (!persona) throw new Error(`Persona ${personaId} was not found in ${personasPath}`);
}

const catalogAudit = auditOpenRouterRoster({
  modelRoster,
  catalog: await fetchOpenRouterCatalog(),
});
if (catalogAudit.errors.length > 0) {
  throw new Error(`OpenRouter roster preflight failed:\n- ${catalogAudit.errors.join('\n- ')}`);
}

const outputPrefix = process.env.AIDB_OUTPUT_PREFIX || [
  'openrouter',
  mode,
  persona?.id || 'self',
].join('-');
const runPath = path.join('./runs', `${outputPrefix}-runs.json`);
const checkpointPath = path.join('./runs', `${outputPrefix}-checkpoint.jsonl`);
const planPath = path.join('./runs', `${outputPrefix}-plan.json`);
const reportPath = path.join('./results', `${outputPrefix}-report.json`);
const htmlPath = path.join('./results', `${outputPrefix}-report.html`);
const resume = /^(1|true|yes)$/i.test(process.env.AIDB_RESUME || '');

const plan = {
  ...buildExperimentPlan({
  questionBank,
  modelRoster,
  mode,
  persona,
  providerOverride: 'openrouter',
  repeats,
  }),
  openRouterCatalogAudit: catalogAudit,
};
plan.costBudget = assertWithinEstimatedCostBudget(
  plan,
  process.env.AIDB_MAX_ESTIMATED_COST_USD || 10,
);
await writeJsonFile(planPath, plan);

console.log(`planned ${plan.totalCalls} OpenRouter calls; estimated cost ${plan.estimatedCostUsd === null ? 'unknown' : `$${plan.estimatedCostUsd}`}`);
console.log(`question bank: ${questionBankPath}`);
if (questionLimit > 0) console.log(`question limit: first ${questionLimit}`);
console.log(`mode: ${mode}${persona ? ` (${persona.label})` : ''}`);
console.log(`models: ${modelRoster.models.map((model) => model.model).join(', ')}`);
console.log(`repeats per polarity: ${repeats}; concurrency: ${concurrency}; max attempts: ${maxAttempts}`);

const priorOutput = resume ? await readJsonFileIfExists(runPath, { runs: [] }) : { runs: [] };
const checkpointRuns = resume ? await readCheckpointRuns(checkpointPath) : [];
const checkpointWriter = await createCheckpointWriter(checkpointPath, { reset: !resume });

const runsFile = await runBenchmark({
  questionBank,
  modelRoster,
  personasFile,
  providerOverride: 'openrouter',
  mode,
  personaId,
  repeats,
  concurrency,
  maxAttempts,
  scheduleSeed: process.env.AIDB_SCHEDULE_SEED || '',
  existingRuns: [...(priorOutput.runs || []), ...checkpointRuns],
  onRun: async (run, index) => {
    await checkpointWriter(run);
    if (index === 1 || index === plan.totalCalls || index % progressEvery === 0) {
      const status = run.error || run.parseError ? 'issue' : 'ok';
      console.log(`[${index}/${plan.totalCalls}] ${status} ${run.modelId} ${run.questionId} ${run.polarity} #${run.repeatIndex}`);
    }
  },
});

throwIfErrors('runs', validateRuns(runsFile, {
  modelIds: new Set(modelRoster.models.map((model) => model.id)),
  questionIds: new Set(questionBank.questions.map((question) => question.id)),
  benchmarkId: questionBank.benchmarkId,
  requireRunIds: true,
  requireRepeatIndex: true,
  maxRepeatIndex: repeats,
  requireProvenance: true,
  mode,
  personaId: persona?.id || null,
}));

await writeJsonFile(runPath, runsFile);
const report = buildResultsReport({ questionBank, modelRoster, runsFile });
await writeJsonFile(reportPath, report);
await writeTextFile(htmlPath, renderHtmlReport(report));

const errored = runsFile.runs.filter((run) => run.error || run.parseError).length;
console.log(`wrote ${planPath}`);
console.log(`wrote ${runPath}`);
console.log(`wrote ${reportPath}`);
console.log(`wrote ${htmlPath}`);
if (errored > 0) console.log(`${errored} runs had provider or parse issues; this report is not release-ready.`);
