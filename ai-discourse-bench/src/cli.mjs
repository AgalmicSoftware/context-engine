import {
  readJsonFile,
  readJsonFileIfExists,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from './io.mjs';
import { createCheckpointWriter, readCheckpointRuns } from './checkpoint.mjs';
import { renderHtmlReport } from './render-html.mjs';
import { buildContextEnginePolisExport } from './ce-export.mjs';
import { attachAnalysisOverlay, buildSecondPassAnalysisInput } from './analysis-export.mjs';
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_REPEATS,
  PROVIDERS,
} from './config.mjs';
import {
  limitQuestionBank,
  mergeModelRosters,
  mergeRunsFiles,
  parseInputFileList,
} from './report-inputs.mjs';
import {
  throwIfErrors,
  validateModelRoster,
  validatePersonas,
  validateQuestionBank,
  validateReleaseRunFile,
  validateRuns,
} from './schema.mjs';
import { runBenchmark } from './runner.mjs';
import { buildResultsReport } from './scoring.mjs';
import { hashJson } from './provenance.mjs';

const usage = `Usage:
  ai-discourse-bench validate --questions <file> --models <file> [--personas <file>]
  ai-discourse-bench run --questions <file> --models <file> --out <file> [--provider mock|local|openrouter] [--mode self|persona] [--persona <id>] [--personas <file>] [--repeats <n>] [--concurrency <n>] [--max-attempts <n>] [--resume] [--checkpoint <file.jsonl>]
  ai-discourse-bench build-report --questions <file> --models <file[,file...]> --runs <file[,file...]> --out <file> [--limit-questions <n>] [--release]
  ai-discourse-bench render-report --report <file> --out <file.html> [--analysis <overlay.json>]
  ai-discourse-bench export-ce --report <file> --out <file.json>
  ai-discourse-bench export-analysis-input --report <file> --out <file.json>
  ai-discourse-bench print-prompt [--file <prompt.md>]
`;

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${item}\n${usage}`);
    }
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
};

const parsePositiveInt = (value, fallback, label) => {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
};

const readInputs = async (args, { personasOptional = true } = {}) => {
  if (!args.questions) throw new Error(`Missing --questions\n${usage}`);
  if (!args.models) throw new Error(`Missing --models\n${usage}`);
  const questionBank = limitQuestionBank(
    await readJsonFile(args.questions),
    args['limit-questions'] || 0
  );
  const modelPaths = parseInputFileList(args.models);
  const modelRosters = await Promise.all(modelPaths.map((modelPath) => readJsonFile(modelPath)));
  modelRosters.forEach((modelRoster, index) => {
    throwIfErrors(`model roster ${modelPaths[index]}`, validateModelRoster(modelRoster));
  });
  const modelRoster = mergeModelRosters(modelRosters);
  const personasFile = args.personas
    ? await readJsonFile(args.personas)
    : { personas: [] };

  throwIfErrors('question bank', validateQuestionBank(questionBank));
  throwIfErrors('model roster', validateModelRoster(modelRoster));
  if (args.personas || !personasOptional) {
    throwIfErrors('personas', validatePersonas(personasFile));
  }

  return { questionBank, modelRoster, personasFile };
};

const commandValidate = async (args) => {
  await readInputs(args);
  console.log('ai-discourse-bench validation passed');
};

const commandRun = async (args) => {
  if (!args.out) throw new Error(`Missing --out\n${usage}`);
  const provider = args.provider || '';
  if (provider && !PROVIDERS.includes(provider)) {
    throw new Error(`--provider must be one of ${PROVIDERS.join(', ')}`);
  }
  const mode = args.mode || 'self';
  if (!['self', 'persona'].includes(mode)) {
    throw new Error('--mode must be self or persona');
  }
  const repeats = parsePositiveInt(args.repeats, DEFAULT_REPEATS, '--repeats');
  const concurrency = parsePositiveInt(args.concurrency, DEFAULT_CONCURRENCY, '--concurrency');
  const maxAttempts = parsePositiveInt(args['max-attempts'], DEFAULT_MAX_ATTEMPTS, '--max-attempts');
  const inputs = await readInputs(args, { personasOptional: mode !== 'persona' });
  const checkpointPath = args.checkpoint || `${args.out}.jsonl`;
  const priorOutput = args.resume ? await readJsonFileIfExists(args.out, { runs: [] }) : { runs: [] };
  const checkpointRuns = args.resume ? await readCheckpointRuns(checkpointPath) : [];
  const existingRuns = [...(priorOutput?.runs || []), ...checkpointRuns];
  const checkpointWriter = await createCheckpointWriter(checkpointPath, { reset: !args.resume });
  const result = await runBenchmark({
    ...inputs,
    providerOverride: provider,
    mode,
    personaId: args.persona || '',
    repeats,
    concurrency,
    maxAttempts,
    scheduleSeed: args['schedule-seed'] || '',
    existingRuns,
    onRun: checkpointWriter,
  });
  throwIfErrors('runs', validateRuns(result, {
    modelIds: new Set(inputs.modelRoster.models.map((model) => model.id)),
    questionIds: new Set(inputs.questionBank.questions.map((question) => question.id)),
    benchmarkId: inputs.questionBank.benchmarkId,
    requireRunIds: true,
    requireRepeatIndex: true,
    maxRepeatIndex: repeats,
    requireProvenance: true,
    mode,
    personaId: args.persona || null,
  }));
  await writeJsonFile(args.out, result);
  console.log(`wrote ${result.runs.length} runs to ${args.out} (${result.resumedRuns} resumed; checkpoint ${checkpointPath})`);
};

const commandBuildReport = async (args) => {
  if (!args.runs) throw new Error(`Missing --runs\n${usage}`);
  if (!args.out) throw new Error(`Missing --out\n${usage}`);
  if (args.release && args['limit-questions']) {
    throw new Error('--release cannot be combined with --limit-questions');
  }
  const { questionBank, modelRoster } = await readInputs(args);
  const runPaths = parseInputFileList(args.runs);
  const runsFiles = await Promise.all(runPaths.map((runPath) => readJsonFile(runPath)));
  if (args.release) {
    runsFiles.forEach((runsFile, index) => {
      throwIfErrors(`release run file ${runPaths[index]}`, validateReleaseRunFile(runsFile, {
        questionBankHash: hashJson(questionBank),
        requiredRepeats: questionBank.runPlan?.repeatsPerPolarity,
        questionCount: questionBank.questions?.length,
        selectedModelsById: new Map(modelRoster.models.map((model) => [model.id, model])),
      }));
    });
  }
  const runsFile = mergeRunsFiles(runsFiles);
  throwIfErrors('runs', validateRuns(runsFile, {
    modelIds: new Set(modelRoster.models.map((model) => model.id)),
    questionIds: new Set(questionBank.questions.map((question) => question.id)),
    benchmarkId: questionBank.benchmarkId,
    requireRunIds: Boolean(args.release),
    requireRepeatIndex: Boolean(args.release),
    maxRepeatIndex: args.release ? questionBank.runPlan?.repeatsPerPolarity : null,
    requireProvenance: Boolean(args.release),
    mode: runsFile.mode || 'self',
    personaId: runsFile.personaId || null,
  }));
  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  if (args.release && !report.integrity.releaseReady) {
    throw new Error(`release report integrity failed:\n- ${report.integrity.warnings.join('\n- ')}`);
  }
  await writeJsonFile(args.out, report);
  console.log(`wrote report to ${args.out}`);
};

const commandPrintPrompt = async (args) => {
  const promptFile = args.file || new URL('../prompts/question-bank-generator.md', import.meta.url).pathname;
  console.log(await readTextFile(promptFile));
};

const commandRenderReport = async (args) => {
  if (!args.report) throw new Error(`Missing --report\n${usage}`);
  if (!args.out) throw new Error(`Missing --out\n${usage}`);
  const report = args.analysis
    ? attachAnalysisOverlay(await readJsonFile(args.report), await readJsonFile(args.analysis))
    : await readJsonFile(args.report);
  await writeTextFile(args.out, renderHtmlReport(report));
  console.log(`wrote HTML report to ${args.out}`);
};

const commandExportCe = async (args) => {
  if (!args.report) throw new Error(`Missing --report\n${usage}`);
  if (!args.out) throw new Error(`Missing --out\n${usage}`);
  const report = await readJsonFile(args.report);
  await writeJsonFile(args.out, buildContextEnginePolisExport(report));
  console.log(`wrote Context Engine Polis export to ${args.out}`);
};

const commandExportAnalysisInput = async (args) => {
  if (!args.report) throw new Error(`Missing --report\n${usage}`);
  if (!args.out) throw new Error(`Missing --out\n${usage}`);
  const report = await readJsonFile(args.report);
  await writeJsonFile(args.out, buildSecondPassAnalysisInput(report));
  console.log(`wrote AI analysis input to ${args.out}`);
};

export const runCli = async (argv) => {
  const args = parseArgs(argv);
  switch (args.command) {
    case 'validate':
      return commandValidate(args);
    case 'run':
      return commandRun(args);
    case 'build-report':
      return commandBuildReport(args);
    case 'render-report':
      return commandRenderReport(args);
    case 'export-ce':
      return commandExportCe(args);
    case 'export-analysis-input':
      return commandExportAnalysisInput(args);
    case 'print-prompt':
      return commandPrintPrompt(args);
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(usage);
      return undefined;
    default:
      throw new Error(`Unknown command: ${args.command}\n${usage}`);
  }
};
