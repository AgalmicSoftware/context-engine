import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './agent-fidelity-report.mjs';

const script = fileURLToPath(new URL('./agent-fidelity-report.mjs', import.meta.url));

// A Results "JSON: Questions + Responses" export: six people answer two
// statements after reviewing AI drafts; the AI is wrong for the two who
// disagree.
const exportFixture = () => ({
  exportedAt: '2026-10-24T00:00:00.000Z',
  sessionSlug: 'fixture',
  filteredQuestions: [
    { id: 'q1', type: 'binary', prompt: 'One' },
    { id: 'q2', type: 'binary', prompt: 'Two' },
  ],
  filteredResponses: Array.from({ length: 6 }, (_, index) => ({
    responder: `0x${String(index + 1).padStart(40, '0')}`,
    response: JSON.stringify({
      timestamp: 1000 + index,
      responses: ['q1', 'q2'].map((questionID) => ({
        questionID,
        answer: { value: index < 4 ? 'Agree' : 'Disagree', encrypted: false },
        interviewProvenance: {
          version: 1,
          source: { platform: 'chatgpt', modelId: 'gpt-test', verification: 'self_reported' },
          originalPrediction: { answer: 'Agree', confidence: 0.75 },
        },
      })),
    }),
  })),
});

test('arguments need an export or both questions and responses, and whole numbers', () => {
  assert.deepEqual(parseArgs(['--export', 'r.json', '--out', 'x', '--include-agents', '--bootstrap', '0']), {
    includeAgents: true,
    export: 'r.json',
    out: 'x',
    bootstrap: 0,
  });
  assert.equal(parseArgs(['-h']).help, true);
  assert.throws(() => parseArgs(['--questions', 'q.json']), /both --questions and --responses/);
  assert.throws(() => parseArgs(['--export']), /Unknown or incomplete option/);
  assert.throws(() => parseArgs(['--export', 'r.json', '--min-participants', 'five']), /--min-participants must be a whole number of at least 1/);
  assert.throws(() => parseArgs(['--export', 'r.json', '--min-participants', '0']), /at least 1/);
  assert.throws(() => parseArgs(['--export', 'r.json', '--bootstrap', 'lots']), /--bootstrap must be a whole number/);
});

const runReport = (dir, args) =>
  spawnSync(process.execPath, [script, ...args, '--out', dir, '--bootstrap', '100', '--min-participants', '3'], { encoding: 'utf8' });

test('questions-view exports and JSONL Session Wrapped exports are read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    const survey = exportFixture();
    // The questions view keys rows by question and wraps one entry per row.
    const byQuestion = { q1: [], q2: [] };
    for (const row of survey.filteredResponses) {
      for (const entry of JSON.parse(row.response).responses) {
        byQuestion[entry.questionID].push({ responder: row.responder, questionId: entry.questionID, response: entry, timestamp: 1 });
      }
    }
    const input = path.join(dir, 'questions-view.json');
    writeFileSync(input, JSON.stringify({ ...survey, viewMode: 'questions', filteredResponses: [], filteredQuestionResponses: byQuestion }));
    const wrapped = path.join(dir, 'wide.jsonl');
    writeFileSync(
      wrapped,
      ['a', 'b', 'c']
        .map((principal) => JSON.stringify({ principal_id: principal, statement_id: 'q1', agent_prediction: { value: 'agree' }, agent_confidence: 70, human_current_answer: { value: 'agree' }, review_status: '' }))
        .join('\n'),
    );
    const run = runReport(dir, ['--export', input, '--wrapped', wrapped]);
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(path.join(dir, 'agent-fidelity-report.json'), 'utf8'));
    assert.equal(report.coverage.byOrigin.external_prefill, 12);
    assert.equal(report.coverage.byOrigin.wrapped_agent, 3);
    assert.equal(report.coverage.byCondition.separate, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a report says when everyone is equally typical, rather than too few', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    const survey = exportFixture();
    survey.filteredResponses = survey.filteredResponses.map((row) => ({
      ...row,
      response: row.response.replaceAll('"Disagree"', '"Agree"'),
    }));
    const input = path.join(dir, 'export.json');
    writeFileSync(input, JSON.stringify(survey));
    const run = runReport(dir, ['--export', input]);
    assert.equal(run.status, 0, run.stderr);
    const markdown = readFileSync(path.join(dir, 'agent-fidelity-report.md'), 'utf8');
    assert.match(markdown, /\| middle \| 6 \| everyone is equally typical/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an export without response rows is an error, not an empty report', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    const input = path.join(dir, 'empty.json');
    writeFileSync(input, JSON.stringify({ ...exportFixture(), filteredResponses: [], filteredQuestionResponses: {} }));
    const run = runReport(dir, ['--export', input]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /No response rows found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the command writes JSON and Markdown reports from a Results export', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    const input = path.join(dir, 'results.json');
    writeFileSync(input, JSON.stringify(exportFixture()));
    const run = spawnSync(process.execPath, [script, '--export', input, '--out', dir, '--bootstrap', '100', '--min-participants', '3'], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /6 people, 12 predictions; Mirror Score 0\.67/);
    const report = JSON.parse(readFileSync(path.join(dir, 'agent-fidelity-report.json'), 'utf8'));
    assert.equal(report.coverage.byOrigin.external_prefill, 12);
    assert.equal(report.correctionRate.participants, 6);
    assert.deepEqual(report.coverage.skippedRecords, { unknownQuestion: 0, noParticipant: 0, unreadableAnswer: 0, unreadablePrediction: 0, freeformWithoutText: 0 });
    const markdown = readFileSync(path.join(dir, 'agent-fidelity-report.md'), 'utf8');
    assert.match(markdown, /^# Agent fidelity report/);
    assert.match(markdown, /\| Mirror Score, all predictions \| 0\.67 \|/);
    assert.match(markdown, /Correction rate \(choice drafts shown and changed\): 33%/);
    // Always "Agree" is right exactly as often as chance; there are no ratings.
    assert.match(markdown, /\| Cohen's kappa, choice predictions \| 0\.00 \|/);
    assert.match(markdown, /\| Rating error, as a share of the scale \| fewer than 3 people \|/);
    // These records don't say which prompt version made them, so their confidences aren't calibrated.
    assert.deepEqual(report.coverage.byConfidenceMeaning, { unknown: 12 });
    assert.match(markdown, /12 choice predictions are left out of calibration/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rows that subtraction would reveal are marked withheld', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    // The sixth person's AI is Claude: all six minus the five ChatGPT users would be theirs.
    const mixed = exportFixture();
    const sixth = JSON.parse(mixed.filteredResponses[5].response);
    sixth.responses.forEach((entry) => {
      entry.interviewProvenance.source.platform = 'claude';
    });
    mixed.filteredResponses[5].response = JSON.stringify(sixth);
    const input = path.join(dir, 'results.json');
    writeFileSync(input, JSON.stringify(mixed));
    const run = spawnSync(process.execPath, [script, '--export', input, '--out', dir, '--bootstrap', '100', '--min-participants', '3'], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    const markdown = readFileSync(path.join(dir, 'agent-fidelity-report.md'), 'utf8');
    assert.match(markdown, /\| chatgpt \| withheld \| – \| 5 \|/);
    assert.match(markdown, /\| claude \| fewer than 3 people \| – \| 1 \|/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('interview drafts get their own row, not the headline, and predictions export under pseudonyms', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    // Four more people were interviewed by voice, and the interview drafted their answers exactly;
    // one also wrote a freeform answer the AI drafted in full.
    const survey = exportFixture();
    survey.filteredQuestions.push({ id: 'qf', type: 'freeform', prompt: 'Why?' });
    for (let index = 6; index < 10; index += 1) {
      survey.filteredResponses.push({
        responder: `0x${String(index + 1).padStart(40, '0')}`,
        response: JSON.stringify({
          timestamp: 2000 + index,
          responses: [
            ...['q1', 'q2'].map((questionID) => ({
              questionID,
              answer: { value: 'Disagree', encrypted: false },
              interviewProvenance: {
                version: 2,
                draftOrigin: 'voice_interview',
                source: { platform: 'other', modelId: 'interview-model' },
                originalPrediction: { answer: 'Disagree', confidence: 0.9 },
                changedFields: [],
              },
            })),
            {
              questionID: 'qf',
              answer: { value: 'Private reasons', encrypted: false },
              interviewProvenance: {
                version: 2,
                draftOrigin: 'voice_interview',
                originalPrediction: { answer: 'Drafted reasons', confidence: 0.5 },
                changedFields: ['answer'],
              },
            },
          ],
        }),
      });
    }
    const input = path.join(dir, 'results.json');
    const csv = path.join(dir, 'new', 'predictions.csv');
    writeFileSync(input, JSON.stringify(survey));
    const run = runReport(dir, ['--export', input, '--predictions', csv]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /AI prefill: 6 people, 12 predictions; Mirror Score 0\.67\. Other origins: voice_interview\./);
    const report = JSON.parse(readFileSync(path.join(dir, 'agent-fidelity-report.json'), 'utf8'));
    assert.deepEqual(report.coverage.byOrigin, { external_prefill: 12 }, 'the headline scores prefill only');
    assert.equal(report.origins.voice_interview.mirrorScore.value, 1);
    // One in three shown drafts changed for each interviewed person: the freeform answer.
    assert.ok(Math.abs(report.origins.voice_interview.answersChanged.value - 1 / 3) < 1e-12);
    const markdown = readFileSync(path.join(dir, 'agent-fidelity-report.md'), 'utf8');
    // The prefill records predate the changed-fields list, so their shares are unknown, not zero.
    assert.match(markdown, /\| AI prefill \| 6 \| 12 \| 0\.67 [^|]*\| – \| – \| – \|/);
    assert.match(markdown, /\| AI interview \(voice\) \| 4 \| 8 \| 1\.00 [^|]*\| – \| 33% \| 0% \|/);
    assert.match(markdown, /### By model\n\n[^#]*\| gpt-test \| 0\.67 \|/);
    assert.match(markdown, /### By context used\n\n[^#]*\| Not reported \| 0\.67 \|/);

    const [header, ...lines] = readFileSync(csv, 'utf8').trim().split('\n');
    assert.match(header, /^"person","origin","platform","model","context_used","group","condition","question_id"/);
    assert.equal(lines.length, 20, 'freeform drafts are left out');
    const text = lines.join('\n');
    assert.doesNotMatch(text, /0x0{30}|reasons/i, 'no addresses or free text');
    // The report and the file name each person the same way.
    const perPerson = new Map();
    for (const line of lines) {
      const person = line.split(',')[0].replaceAll('"', '');
      perPerson.set(person, (perPerson.get(person) ?? 0) + 1);
    }
    assert.equal(perPerson.size, 10);
    for (const row of report.participants) assert.equal(perPerson.get(row.id), row.predictions, row.id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('prefill and Session Wrapped rows follow the headline, and exclusions ignore case', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    // Six prefill people and two Session Wrapped people; six voice and four typed-note people would otherwise
    // make the prefill origin row showable, and the headline minus it would be the two Wrapped people.
    const survey = exportFixture();
    for (let index = 6; index < 16; index += 1) {
      survey.filteredResponses.push({
        responder: `0x${String(index + 1).padStart(40, '0')}`,
        response: JSON.stringify({
          responses: ['q1', 'q2'].map((questionID) => ({
            questionID,
            answer: { value: 'Agree', encrypted: false },
            interviewProvenance: {
              version: 2,
              draftOrigin: index < 12 ? 'voice_interview' : 'typed_context',
              originalPrediction: { answer: 'Agree', confidence: 0.9 },
            },
          })),
        }),
      });
    }
    const input = path.join(dir, 'results.json');
    writeFileSync(input, JSON.stringify(survey));
    const wrappedId = '0xAbCdEf0000000000000000000000000000000001';
    const wrapped = ['0xAbCdEf0000000000000000000000000000000001', '0xAbCdEf0000000000000000000000000000000002'].flatMap(
      (principal) =>
        ['q1', 'q2'].map((statementId) => ({
          principal_id: principal,
          statement_id: statementId,
          agent_prediction: 'Disagree',
          human_current_answer: 'Agree',
          agent_confidence: 60,
          model: 'wrapped-model',
        })),
    );
    const wrappedFile = path.join(dir, 'wrapped.jsonl');
    writeFileSync(wrappedFile, wrapped.map((row) => JSON.stringify(row)).join('\n'));
    const csv = path.join(dir, 'predictions.csv');
    let run = runReport(dir, ['--export', input, '--wrapped', wrappedFile, '--predictions', csv]);
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(path.join(dir, 'agent-fidelity-report.json'), 'utf8'));
    assert.equal(report.mirrorScore.overall.participants, 8);
    assert.equal(report.mirrorScore.byOrigin.wrapped_agent.suppressed, true);
    assert.equal(report.origins.external_prefill.mirrorScore.suppressed, true, 'the headline minus prefill would be Wrapped');
    assert.equal(report.origins.voice_interview.mirrorScore.value, 1);

    // An exclusion written in any case leaves the person out of the CSV too.
    const exclude = path.join(dir, 'exclude.txt');
    writeFileSync(exclude, `wrapped:${wrappedId}\n`);
    run = runReport(dir, ['--export', input, '--wrapped', wrappedFile, '--predictions', csv, '--exclude', exclude]);
    assert.equal(run.status, 0, run.stderr);
    const lines = readFileSync(csv, 'utf8').trim().split('\n').slice(1);
    assert.equal(lines.filter((line) => line.includes('"wrapped_agent"')).length, 2, 'one Wrapped person is left');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the command exits non-zero with usage on bad input', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Usage:/);
});
