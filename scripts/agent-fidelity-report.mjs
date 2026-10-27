#!/usr/bin/env node
// Scores how well AI drafts predicted participants' answers in a session and
// writes agent-fidelity-report.json and agent-fidelity-report.md.
// Method and inputs: docs/agent-fidelity.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectSessionFidelityData,
  collectWrappedFidelityPairs,
  resultsResponseRows,
  scoreAgentFidelity,
} from '../shared/agentFidelity.mjs';

const USAGE = `Usage:
  node scripts/agent-fidelity-report.mjs --export <results.json> [options]
  node scripts/agent-fidelity-report.mjs --questions <file> --responses <file> [options]

<results.json> is the Results screen's "JSON: Questions + Responses" download.

Options:
  --wrapped <file>          Session Wrapped agent-only export (wide or gold view, JSONL or JSON)
  --groups <file>           JSON object mapping participant address to group id(s)
  --exclude <file>          Participant addresses to leave out, one per line
  --out <dir>               Output folder (default: current folder)
  --bootstrap <n>           Bootstrap samples for 95% intervals (default 1000)
  --seed <n>                Random seed (default 1)
  --min-participants <n>    Smallest group of people to report on (default 5)
  --include-agents          Keep self-declared agent participants`;

const VALUE_FLAGS = new Set(['export', 'questions', 'responses', 'wrapped', 'groups', 'exclude', 'out', 'bootstrap', 'seed', 'min-participants']);
const INTEGER_FLAGS = { bootstrap: 0, seed: -Infinity, 'min-participants': 1 };

export const parseArgs = (argv) => {
  const args = { includeAgents: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index].replace(/^-{1,2}/, '');
    if (flag === 'include-agents') {
      args.includeAgents = true;
    } else if (flag === 'help' || flag === 'h') {
      args.help = true;
    } else if (VALUE_FLAGS.has(flag) && index + 1 < argv.length) {
      args[flag] = argv[(index += 1)];
    } else {
      throw new Error(`Unknown or incomplete option: ${argv[index]}`);
    }
  }
  for (const [flag, minimum] of Object.entries(INTEGER_FLAGS)) {
    if (args[flag] === undefined) continue;
    const value = Number(args[flag]);
    if (!/^-?\d+$/.test(args[flag]) || value < minimum) {
      throw new Error(`--${flag} must be a whole number${Number.isFinite(minimum) ? ` of at least ${minimum}` : ''}.`);
    }
    args[flag] = value;
  }
  if (!args.help && !args.export && !(args.questions && args.responses)) {
    throw new Error('Pass --export, or both --questions and --responses.');
  }
  return args;
};

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
// Session Wrapped exports default to JSONL (one row per line); JSON arrays and
// { rows } objects also work.
const readRows = (file) => {
  const body = readFileSync(file, 'utf8').trim();
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : [parsed];
  } catch {
    return body.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${file} line ${index + 1} is not JSON. Export the wide or gold view as JSONL (the default) or JSON.`);
      }
    });
  }
};
const listOf = (value, ...keys) => {
  if (Array.isArray(value)) return value;
  const key = keys.find((candidate) => Array.isArray(value?.[candidate]));
  return key ? value[key] : null;
};
const count = (value) => (Number.isInteger(value) ? String(value) : '–');
const decimal = (value) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '–');
const signed = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}` : '–');
const percent = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100)}%` : '–');
const interval = (result, format = decimal) =>
  result?.interval ? `${format(result.interval[0])} to ${format(result.interval[1])}` : '–';
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (header, rows) => [row(header), row(header.map(() => '---')), ...rows.map(row)].join('\n');

export const renderFidelityMarkdown = (report) => {
  const { coverage, mirrorScore, baselines, anchoring, calibration, unusualViews, synthesis } = report;
  const { keep: _calibrated, ...otherMeanings } = coverage.byConfidenceMeaning ?? {};
  const uncalibrated = Object.values(otherMeanings).reduce((sum, count) => sum + count, 0);
  const minimum = report.options.minParticipants;
  const fewer = `fewer than ${minimum} people`;
  const cell = (result, format = decimal) => (result?.suppressed ? fewer : format(result?.value));
  const breakdownTable = (label, results) =>
    Object.keys(results).length
      ? `### ${label}\n\n${table(
          ['', 'Mirror Score', '95% interval', 'People'],
          Object.entries(results).map(([key, result]) => [key, cell(result), interval(result), count(result.participants)]),
        )}`
      : '';
  const headline = [
    ['Mirror Score, all predictions', mirrorScore.overall],
    ['Mirror Score, drafts shown', mirrorScore.byCondition.shown],
    ['Mirror Score, drafts hidden until answered', mirrorScore.byCondition.blind],
    ['Mirror Score, predictions made separately', mirrorScore.byCondition.separate],
    ['Lift over the most common answer', baselines.population.lift],
    ["Lift over the person's group's most common answer", baselines.group.lift],
    ['Anchoring: exact-match rate shown minus hidden', anchoring.exactMatchShift, signed],
  ].filter(([, result]) => result);
  const conditionLabel = { shown: 'shown', blind: 'hidden until answered', separate: 'made separately' };
  const calibrationSections = Object.entries(calibration).map(([condition, result]) =>
    result.suppressed
      ? `### Drafts ${conditionLabel[condition]}\n\nWithheld: ${fewer}.`
      : `### Drafts ${conditionLabel[condition]}\n\n` +
        `Brier score ${decimal(result.brier)} (${interval({ interval: result.brierInterval })}); ` +
        `expected calibration error ${decimal(result.expectedCalibrationError)} (${interval({ interval: result.errorInterval })}); ` +
        `${result.predictions} predictions from ${result.participants} people.\n\n` +
        table(
          ['Stated confidence', 'Mean stated', 'Kept unchanged', 'Predictions'],
          result.bins.map((bin) => [`${percent(bin.from)}–${percent(bin.to)}`, percent(bin.meanConfidence), percent(bin.keepRate), count(bin.predictions)]),
        ),
  );
  const unusual = unusualViews.suppressed
    ? `Withheld: ${fewer}.`
    : [
        table(
          ['', 'People', 'Typicality', 'AI', 'Most common answer', 'Lift'],
          unusualViews.terciles.map((tercile) =>
            tercile.suppressed
              ? [tercile.tercile, count(tercile.participants), fewer, '', '', '']
              : [
                  tercile.tercile,
                  count(tercile.participants),
                  decimal(tercile.typicality),
                  decimal(tercile.agent),
                  decimal(tercile.baseline),
                  signed(tercile.lift),
                ],
          ),
        ),
        '',
        `Rank correlation with typicality: AI ${decimal(unusualViews.correlation.agent.value)} ` +
          `(${interval(unusualViews.correlation.agent)}), most common answer ${decimal(unusualViews.correlation.baseline.value)} ` +
          `(${interval(unusualViews.correlation.baseline)}), lift ${decimal(unusualViews.correlation.lift.value)} ` +
          `(${interval(unusualViews.correlation.lift)}).`,
      ].join('\n');
  const shifts = [
    ['Rating extremity (0 = scale midpoint, 1 = an end)', synthesis.ratingExtremity],
    ['Quadratic: share of credits on the top option', synthesis.quadraticTopShare],
    ['Quadratic: share of the credit budget used', synthesis.quadraticCreditsUsed],
    ['Binary: rate of "Unsure"', synthesis.unsureRate],
    ['Importance (0–10)', synthesis.importance],
    ['Conviction (0–10)', synthesis.conviction],
    ['Agreement with the most common answer', synthesis.majorityPull],
    ['Spread between people (mean dissimilarity per question)', synthesis.spread],
  ];
  return [
    '# Agent fidelity report',
    '',
    `Method \`${report.method}\`. ${coverage.participants} people, ${coverage.predictions} scored predictions ` +
      `(${coverage.byCondition.shown} shown, ${coverage.byCondition.blind} hidden, ${coverage.byCondition.separate} separate). ` +
      `${coverage.freeformPredictions + (coverage.skippedRecords?.freeformWithoutText ?? 0)} freeform predictions are not scored. ` +
      `Intervals are 95% bootstrap intervals over people (${report.options.bootstrapSamples} samples, seed ${report.options.seed}); ` +
      `results from ${fewer} are withheld.`,
    '',
    '## Headline',
    '',
    table(
      ['Measure', 'Value', '95% interval', 'People'],
      headline.map(([label, result, format = decimal]) => [label, cell(result, format), interval(result, format), count(result.participants)]),
    ),
    '',
    "Mirror Score is graded agreement from 0 to 1 between the AI's draft and the answer, averaged per person and then across people. " +
      'Lift compares it with guessing the most common answer among everyone else. The hidden-draft score is the least biased; ' +
      'the shown-draft score also counts drafts people accepted without strong views.',
    '',
    `Correction rate (choice drafts shown and changed): ${cell(report.correctionRate, percent)} (${interval(report.correctionRate, percent)}).`,
    '',
    '## Breakdowns',
    '',
    breakdownTable('By question type', mirrorScore.byType),
    '',
    breakdownTable('By where the draft came from', mirrorScore.byOrigin),
    '',
    breakdownTable('By self-reported platform', mirrorScore.byPlatform),
    '',
    breakdownTable('By group', mirrorScore.byGroup),
    mirrorScore.groupsWithheld ? `\n${mirrorScore.groupsWithheld} smaller groups are not listed.` : '',
    '',
    '## Calibration',
    '',
    'For choice questions: when the AI states a confidence, about that share of its answers should be kept unchanged.',
    '',
    ...(uncalibrated
      ? [
          `${uncalibrated} choice predictions are left out of calibration: their confidence graded strength of support (prompts before ce-interview-brief-v6, and Session Wrapped), or its meaning wasn't recorded.`,
          '',
        ]
      : []),
    calibrationSections.join('\n\n') || 'No choice predictions carried a confidence meaning the chance of keeping the answer.',
    '',
    '## Unusual views',
    '',
    "People are split into thirds by how similar their own answers are to everyone else's (typicality). " +
      "If the AI only knew the stereotype, its score would fall with typicality as fast as the baseline's does.",
    '',
    unusual,
    '',
    '## Synthesis checks',
    '',
    "Each row is the AI's drafts minus people's own answers, per person and then averaged. Below zero means the drafts were " +
      'weaker or more alike than what people said; above zero for "Agreement with the most common answer" means the drafts ' +
      'pulled people toward the majority.',
    '',
    table(
      ['Measure', 'Drafts minus answers', '95% interval', 'People'],
      shifts.map(([label, result]) => [label, cell(result, signed), interval(result, signed), count(result?.participants)]),
    ),
    '',
  ].join('\n');
};

export const runFidelityReport = (args) => {
  const exported = args.export ? readJson(args.export) : null;
  const questions = listOf(exported ?? readJson(args.questions), 'filteredQuestions', 'questions') ?? [];
  const payloads = resultsResponseRows(exported ?? readJson(args.responses));
  if (!payloads.length) throw new Error('No response rows found. Check that the export includes responses.');
  const { answers, pairs, skipped } = collectSessionFidelityData({ questions, payloads });
  const wrappedPairs = args.wrapped ? collectWrappedFidelityPairs({ questions, rows: readRows(args.wrapped) }) : [];
  const groupsInput = args.groups ? readJson(args.groups) : {};
  const groups = Array.isArray(groupsInput)
    ? Object.fromEntries(groupsInput.map((entry) => [entry.address, entry.groups ?? entry.group]))
    : groupsInput;
  const excludeParticipants = args.exclude
    ? readFileSync(args.exclude, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const report = scoreAgentFidelity({
    questions,
    pairs: [...pairs, ...wrappedPairs],
    answers,
    groups,
    options: {
      includeAgents: args.includeAgents,
      excludeParticipants,
      ...(args.bootstrap !== undefined ? { bootstrapSamples: args.bootstrap } : {}),
      ...(args.seed !== undefined ? { seed: args.seed } : {}),
      ...(args['min-participants'] !== undefined ? { minParticipants: args['min-participants'] } : {}),
    },
  });
  report.coverage.skippedRecords = skipped;
  const out = args.out || '.';
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'agent-fidelity-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(out, 'agent-fidelity-report.md'), renderFidelityMarkdown(report));
  return report;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(USAGE);
    } else {
      const report = runFidelityReport(args);
      if (!report.coverage.predictions) {
        console.warn('No AI draft comparisons found. They are saved only when "Share AI draft changes for research" is on.');
      }
      console.log(
        `${report.coverage.participants} people, ${report.coverage.predictions} predictions; ` +
          `Mirror Score ${report.mirrorScore.overall.suppressed ? 'withheld (too few people)' : decimal(report.mirrorScore.overall.value)}. ` +
          `Wrote ${path.resolve(args.out || '.')}`,
      );
    }
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
  }
}
