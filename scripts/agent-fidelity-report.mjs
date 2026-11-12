#!/usr/bin/env node
// Scores how well AI drafts predicted participants' answers in a session and
// writes agent-fidelity-report.json and agent-fidelity-report.md.
// Method and inputs: docs/agent-fidelity.md.
import { randomInt } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answerSimilarity,
  collectSessionFidelityData,
  collectWrappedFidelityPairs,
  CONTEXT_BUCKETS,
  normalizeFidelityQuestion,
  resultsResponseRows,
  scoreAgentFidelity,
  scoreDraftOrigins,
} from '../shared/agentFidelity.mjs';
import { quoteCsvCell } from '../shared/csv/quoteCell.mjs';

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
  --include-agents          Keep self-declared agent participants
  --predictions <file.csv>  Also write one de-identified row per scored prediction`;

const VALUE_FLAGS = new Set(['export', 'questions', 'responses', 'wrapped', 'groups', 'exclude', 'out', 'bootstrap', 'seed', 'min-participants', 'predictions']);
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

const ORIGIN_LABELS = {
  external_prefill: 'AI prefill',
  voice_interview: 'AI interview (voice)',
  typed_context: 'Typed notes',
  group_recording: 'Group recording',
  wrapped_agent: 'Session Wrapped',
  unknown: 'Not recorded',
};
const CONTEXT_LABELS = { 'not reported': 'Not reported', none: 'None', '1-9': '1–9 items', '10-49': '10–49 items', '50+': '50 or more' };

export const renderFidelityMarkdown = (report) => {
  const { coverage, mirrorScore, baselines, anchoring, calibration, unusualViews, synthesis } = report;
  const { keep: _calibrated, ...otherMeanings } = coverage.byConfidenceMeaning ?? {};
  const uncalibrated = Object.values(otherMeanings).reduce((sum, count) => sum + count, 0);
  const minimum = report.options.minParticipants;
  const fewer = `fewer than ${minimum} people`;
  const cell = (result, format = decimal) => (result?.suppressed ? fewer : format(result?.value));
  const breakdownTable = (label, results = {}, nameOf = (key) => key) =>
    Object.keys(results).length
      ? `### ${label}\n\n${table(
          ['', 'Mirror Score', '95% interval', 'People'],
          Object.entries(results).map(([key, result]) => [
            nameOf(key),
            result.suppressed && result.participants >= minimum ? 'withheld' : cell(result),
            interval(result),
            count(result.participants),
          ]),
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
    ["Cohen's kappa, choice predictions", report.agreement?.choiceKappa],
    ['Rating error, as a share of the scale', report.agreement?.ratingError],
  ].filter(([, result]) => result);
  const conditionLabel = { shown: 'shown', blind: 'hidden until answered', separate: 'made separately' };
  const shownCell = (result, format = decimal) =>
    !result ? '–' : result.suppressed && !result.participants ? '–' : result.suppressed && result.participants >= minimum ? 'withheld' : cell(result, format);
  const origins = Object.entries(report.origins ?? {});
  const originsTable = origins.length
    ? table(
        ['Where the draft came from', 'People', 'Drafts scored', 'Mirror Score', 'Hidden drafts', 'Answers changed', 'Comments changed'],
        origins.map(([origin, row]) => [
          ORIGIN_LABELS[origin] ?? origin,
          count(Math.max(row.mirrorScore.participants, row.answersChanged.participants)),
          count(row.predictions),
          `${shownCell(row.mirrorScore)}${row.mirrorScore.interval ? ` (${interval(row.mirrorScore)})` : ''}`,
          shownCell(row.hiddenMirrorScore),
          shownCell(row.answersChanged, percent),
          shownCell(row.commentsChanged, percent),
        ]),
      )
    : 'No AI drafts were shared for research.';
  const contextOrder = Object.fromEntries(
    CONTEXT_BUCKETS.filter((key) => mirrorScore.byContext?.[key]).map((key) => [key, mirrorScore.byContext[key]]),
  );
  const calibrationSections = Object.entries(calibration).map(([condition, result]) =>
    result.suppressed
      ? `### Drafts ${conditionLabel[condition]}\n\nWithheld: ${fewer}.`
      : `### Drafts ${conditionLabel[condition]}\n\n` +
        `Brier score ${decimal(result.brier)} (${interval({ interval: result.brierInterval })}); ` +
        `expected calibration error ${decimal(result.expectedCalibrationError)} (${interval({ interval: result.errorInterval })}); ` +
        `${result.predictions} predictions from ${result.participants} people.\n\n` +
        table(
          ['Stated confidence', 'Mean stated', 'Kept unchanged', 'Predictions'],
          result.bins.map((bin) => [
            `${percent(bin.from)}–${percent(bin.to)}`,
            ...(bin.suppressed ? [fewer, ''] : [percent(bin.meanConfidence), percent(bin.keepRate)]),
            count(bin.predictions),
          ]),
        ),
  );
  const unusual = unusualViews.suppressed
    ? `Withheld: ${fewer}.`
    : [
        table(
          ['', 'People', 'Typicality', 'AI', 'Most common answer', 'Lift'],
          unusualViews.terciles.map((tercile) =>
            tercile.suppressed
              ? [tercile.tercile, count(tercile.participants), tercile.equallyTypical ? 'everyone is equally typical' : fewer, '', '', '']
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
    '## Headline: AI prefill',
    '',
    'The headline scores predictions made before the person spoke: drafts from their own ChatGPT or Claude (AI prefill), ' +
      'and Session Wrapped predictions when given. Interview, typed-note and group-recording drafts restate what the person ' +
      'said, so they are scored on their own rows in "Where drafts came from" and never pooled with these.',
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
    '## Where drafts came from',
    '',
    "Each source on its own row. Mirror Score is graded agreement between the AI's draft and the submitted answer. " +
      '"Answers changed" is the share of drafts each person was shown whose answer they submitted differently, averaged ' +
      'over people, freeform answers and later edits included; "Comments changed" is the same for the comment. ' +
      'For interview, typed-note and recording drafts these say how faithfully the interviewer and the mapping captured ' +
      'what the person said, and how much people corrected it.',
    '',
    originsTable,
    '',
    '## Breakdowns',
    '',
    `Rows from ${fewer} are withheld. Rows that divide people (where the draft came from, platform and group) are also withheld ` +
      'when subtracting them from the total, or from each other, would leave fewer.',
    '',
    breakdownTable('By question type', mirrorScore.byType),
    '',
    breakdownTable('By self-reported platform', mirrorScore.byPlatform),
    '',
    breakdownTable('By model', mirrorScore.byModel),
    '',
    breakdownTable('By context used', contextOrder, (key) => CONTEXT_LABELS[key] ?? key),
    '',
    'Context used is the number of past chats, memories and connected sources the AI said it drew on. ' +
      'A count it left out adds nothing; "Not reported" means it gave none of them.',
    '',
    breakdownTable('By group', mirrorScore.byGroup),
    mirrorScore.groupsWithheld ? `\n${mirrorScore.groupsWithheld} groups are withheld and not named.` : '',
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

// The headline scores predictions made before the person spoke; other origins get their own rows.
const PREDICTION_ORIGINS = ['external_prefill', 'wrapped_agent'];

// Pseudonyms in an order drawn afresh each run, so neither storage order nor an address list can recover who is who.
const pseudonymsFor = (participantIds) => {
  const ids = [...new Set(participantIds)];
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [ids[index], ids[other]] = [ids[other], ids[index]];
  }
  return new Map(ids.map((id, index) => [id, `p${String(index + 1).padStart(3, '0')}`]));
};

const PREDICTION_COLUMNS = ['person', 'origin', 'platform', 'model', 'context_used', 'group', 'condition', 'question_id', 'question_type', 'prediction', 'answer', 'similarity', 'exact_match', 'confidence', 'confidence_meaning'];
const cellValue = (value) => (value === null || value === undefined ? '' : typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value));

/**
 * One row per scored prediction, for analysis outside the app: people by pseudonym, no addresses, names or free
 * text (freeform questions are left out), and only groups the report itself names.
 */
export const predictionRows = ({ questions, pairs, pseudonyms, groupOf = () => '' }) => {
  const byId = new Map(questions.map(normalizeFidelityQuestion).filter(Boolean).map((question) => [question.id, question]));
  const rows = pairs
    .filter((pair) => byId.get(pair.questionId) && byId.get(pair.questionId).type !== 'freeform' && pseudonyms.has(pair.participantId))
    .map((pair) => {
      const question = byId.get(pair.questionId);
      const similarity = answerSimilarity(question, pair.prediction, pair.actual);
      return [
        pseudonyms.get(pair.participantId), pair.origin, pair.platform, pair.modelId, pair.context ?? 'not reported',
        groupOf(pair.participantId), pair.condition, pair.questionId, question.type, pair.prediction, pair.actual,
        similarity === null ? null : Number(similarity.toFixed(4)), JSON.stringify(pair.prediction) === JSON.stringify(pair.actual) ? 1 : 0,
        pair.confidence, pair.confidenceMeaning,
      ];
    })
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[7] < b[7] ? -1 : 1));
  return `${[PREDICTION_COLUMNS, ...rows].map((cells) => cells.map((value) => quoteCsvCell(cellValue(value))).join(',')).join('\n')}\n`;
};

export const runFidelityReport = (args) => {
  const exported = args.export ? readJson(args.export) : null;
  const questions = listOf(exported ?? readJson(args.questions), 'filteredQuestions', 'questions') ?? [];
  const payloads = resultsResponseRows(exported ?? readJson(args.responses));
  if (!payloads.length) throw new Error('No response rows found. Check that the export includes responses.');
  const { answers, pairs: sessionPairs, drafts, skipped } = collectSessionFidelityData({ questions, payloads });
  const wrappedPairs = args.wrapped ? collectWrappedFidelityPairs({ questions, rows: readRows(args.wrapped) }) : [];
  const pairs = [...sessionPairs, ...wrappedPairs];
  const groupsInput = args.groups ? readJson(args.groups) : {};
  const groups = Array.isArray(groupsInput)
    ? Object.fromEntries(groupsInput.map((entry) => [entry.address, entry.groups ?? entry.group]))
    : groupsInput;
  const excludeParticipants = args.exclude
    ? readFileSync(args.exclude, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const options = {
    includeAgents: args.includeAgents,
    excludeParticipants,
    ...(args.bootstrap !== undefined ? { bootstrapSamples: args.bootstrap } : {}),
    ...(args.seed !== undefined ? { seed: args.seed } : {}),
    ...(args['min-participants'] !== undefined ? { minParticipants: args['min-participants'] } : {}),
  };
  const kept = (pair) =>
    !excludeParticipants.some((id) => id.toLowerCase() === pair.participantId) && (args.includeAgents || !pair.isAgent);
  const pseudonyms = pseudonymsFor(pairs.filter(kept).map((pair) => pair.participantId));
  const report = scoreAgentFidelity({
    questions,
    pairs: pairs.filter((pair) => PREDICTION_ORIGINS.includes(pair.origin)),
    answers,
    groups,
    pseudonyms,
    options,
  });
  report.origins = scoreDraftOrigins({ questions, pairs, drafts, options });
  report.coverage.skippedRecords = skipped;
  const out = args.out || '.';
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'agent-fidelity-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(out, 'agent-fidelity-report.md'), renderFidelityMarkdown(report));
  if (args.predictions) {
    const reportedGroups = new Set(Object.keys(report.mirrorScore.byGroup));
    const groupOf = (participantId) => {
      const listed = Object.entries(groups).find(([address]) => address.toLowerCase() === participantId)?.[1];
      const own = listed ? (Array.isArray(listed) ? listed : [listed]) : [answers.find((answer) => answer.participantId === participantId)?.source];
      return own.find((group) => reportedGroups.has(group)) ?? '';
    };
    mkdirSync(path.dirname(path.resolve(args.predictions)), { recursive: true });
    writeFileSync(args.predictions, predictionRows({ questions, pairs: pairs.filter(kept), pseudonyms, groupOf }));
  }
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
      if (!report.coverage.predictions && !Object.keys(report.origins).length) {
        console.warn('No AI draft comparisons found. They are saved only when "Share for research" is on.');
      }
      console.log(
        `AI prefill: ${report.coverage.participants} people, ${report.coverage.predictions} predictions; ` +
          `Mirror Score ${report.mirrorScore.overall.suppressed ? 'withheld (too few people)' : decimal(report.mirrorScore.overall.value)}. ` +
          `Other origins: ${Object.keys(report.origins).filter((origin) => !PREDICTION_ORIGINS.includes(origin)).join(', ') || 'none'}. ` +
          `Wrote ${path.resolve(args.out || '.')}`,
      );
    }
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
  }
}
