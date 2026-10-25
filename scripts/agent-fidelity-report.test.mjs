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
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the command exits non-zero with usage on bad input', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Usage:/);
});
