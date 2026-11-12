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
  assert.equal(parseArgs(['--export', 'r.json', '--draft-text', 'd.json', '--clio', 'c.jsonl']).clio, 'c.jsonl');
  assert.throws(() => parseArgs(['--export', 'r.json', '--draft-text', 'd.json']), /--draft-text and --clio go together/);
  assert.throws(() => parseArgs(['--export', 'r.json', '--clio', 'c.jsonl']), /--draft-text and --clio go together/);
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
    assert.match(markdown, /\| Rating error, as a share of the scale \| no data \|/);
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
    // Twenty scored predictions and four freeform drafts, whose text is left out but whose change is kept.
    assert.equal(lines.length, 24);
    assert.match(header, /"answer_changed","comment_changed"$/);
    const freeform = lines.filter((line) => line.includes('"freeform"'));
    assert.equal(freeform.length, 4);
    for (const line of freeform) assert.match(line, /,"","","","","","","1","0"$/);
    assert.ok(lines.filter((line) => line.includes('"voice_interview"') && !line.includes('"freeform"')).every((line) => line.endsWith('"0","0"')));
    const text = lines.join('\n');
    assert.doesNotMatch(text, /0x0{30}|reasons/i, 'no addresses or free text');
    // The report and the file name each person the same way.
    const perPerson = new Map();
    for (const line of lines.filter((row) => !row.includes('"freeform"'))) {
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

test('excluded people and agents leave no freeform rows in the predictions file', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    const survey = exportFixture();
    survey.filteredQuestions.push({ id: 'qf', type: 'freeform', prompt: 'Why?' });
    const freeformFrom = (index, extra = {}) => ({
      responder: `0x${String(index).padStart(40, '0')}`,
      response: JSON.stringify({
        ...extra,
        responses: [
          {
            questionID: 'qf',
            answer: { value: 'Text', encrypted: false },
            interviewProvenance: { version: 2, draftOrigin: 'voice_interview', originalPrediction: { answer: null, confidence: 0.5 }, changedFields: ['answer'] },
          },
        ],
      }),
    });
    // The first fixture person (excluded below, by an upper-case address), an agent and one other person.
    survey.filteredResponses.push(freeformFrom(1), freeformFrom(20, { participant: { kind: 'agent' } }), freeformFrom(21));
    const input = path.join(dir, 'results.json');
    const exclude = path.join(dir, 'exclude.txt');
    const csv = path.join(dir, 'predictions.csv');
    writeFileSync(input, JSON.stringify(survey));
    writeFileSync(exclude, `0x${'1'.padStart(40, '0').toUpperCase()}\n`);
    const run = runReport(dir, ['--export', input, '--exclude', exclude, '--predictions', csv]);
    assert.equal(run.status, 0, run.stderr);
    const lines = readFileSync(csv, 'utf8').trim().split('\n').slice(1);
    assert.equal(lines.filter((line) => line.includes('"freeform"')).length, 1, "only the other person's draft");
    assert.equal(lines.length, 11, "five people's two predictions and one freeform draft");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the command exits non-zero with usage on bad input', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Usage:/);
});

const addressOf = (index) => `0x${String(index + 1).padStart(40, '0')}`;
// The admin's AI draft text download, made the day after the Results export, with rows saved the day before.
const draftTextFixture = (rows) => ({
  type: 'ce_draft_text_export',
  version: 1,
  sessionSlug: 'fixture',
  exportedAt: '2026-10-25T23:59:00.000Z',
  rows: rows.map((row) => ({ savedAt: '2026-10-23T15:42:11.000Z', ...row })),
});
const readJsonl = (file) => readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));

test('conversations name people as the predictions file does, on the export day, without addresses', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    // Each person's AI has its own model, so a CSV row says whose it is; each draft's text says the same.
    const survey = exportFixture();
    survey.filteredResponses.forEach((row, index) => {
      const payload = JSON.parse(row.response);
      payload.responses.forEach((entry) => {
        entry.interviewProvenance.source.modelId = `model-${index}`;
      });
      row.response = JSON.stringify(payload);
    });
    const input = path.join(dir, 'results.json');
    const draftFile = path.join(dir, 'draft-text.json');
    const exclude = path.join(dir, 'exclude.txt');
    const csv = path.join(dir, 'predictions.csv');
    const clio = path.join(dir, 'out', 'conversations.jsonl');
    writeFileSync(input, JSON.stringify(survey));
    writeFileSync(
      draftFile,
      JSON.stringify(
        draftTextFixture(
          Array.from({ length: 6 }, (_, index) => ({
            responder: addressOf(index).toUpperCase().replace('0X', '0x'),
            questionId: 'q1',
            aiAnswer: `Draft ${index}`,
            aiComment: '',
            origin: 'external_prefill',
            condition: 'shown',
          })),
        ),
      ),
    );
    // The last person is left out, by an address in another case.
    writeFileSync(exclude, `${addressOf(5).toUpperCase()}\n`);
    const run = runReport(dir, ['--export', input, '--exclude', exclude, '--predictions', csv, '--draft-text', draftFile, '--clio', clio]);
    assert.equal(run.status, 0, run.stderr);

    const conversations = readJsonl(clio);
    assert.equal(conversations.length, 5, "the excluded person's draft is left out");
    assert.ok(!conversations.some((line) => line.messages[0].content === 'Draft 5'));
    const csvPerson = new Map(
      readFileSync(csv, 'utf8').trim().split('\n').slice(1).map((line) => {
        const cells = line.split(',').map((cell) => cell.replaceAll('"', ''));
        return [cells[3], cells[0]];
      }),
    );
    assert.equal(csvPerson.size, 5);
    for (const line of conversations) {
      const index = line.messages[0].content.replace('Draft ', '');
      assert.equal(line.metadata.participant, csvPerson.get(`model-${index}`), `person ${index}`);
      assert.equal(line.chat_id, `${line.metadata.participant}:q1:answer`);
      assert.equal(line.created_at, '2026-10-25T00:00:00Z');
      for (const message of line.messages) assert.equal(message.created_at, '2026-10-25T00:00:00Z');
      assert.deepEqual(
        line.messages.map((message) => [message.role, message.content]),
        [['assistant', `Draft ${index}`], ['user', Number(index) < 4 ? 'Agree' : 'Disagree']],
      );
      assert.deepEqual(line.metadata, { participant: line.metadata.participant, question_id: 'q1', field: 'answer', origin: 'external_prefill', condition: 'shown', changed: true });
    }
    assert.deepEqual(conversations.map((line) => line.chat_id), conversations.map((line) => line.chat_id).sort());
    const markdown = readFileSync(path.join(dir, 'agent-fidelity-report.md'), 'utf8');
    for (const [name, body] of [['conversations', readFileSync(clio, 'utf8')], ['markdown', markdown], ['stdout', run.stdout]]) {
      assert.doesNotMatch(body, /0x[0-9a-f]{8}/i, `no address in the ${name}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('conversations add the final text only when it changed, and skip encrypted or missing finals', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    const survey = exportFixture();
    survey.filteredQuestions.push({ id: 'qf', type: 'freeform', prompt: 'Why?' });
    const freeform = (index, answer, additional) => ({
      responder: addressOf(index),
      response: JSON.stringify({ responses: [{ questionID: 'qf', answer, additional }] }),
    });
    survey.filteredResponses.push(
      freeform(0, { value: 'Keep it simple', encrypted: false }, { value: 'My own note', encrypted: false }),
      // The second person first saved a plain answer, then encrypted it.
      freeform(1, { value: 'Old plain answer', encrypted: false }, { value: 'Old note', encrypted: false }),
      freeform(1, { value: '*', encrypted: true, encryptedPortion: '{"ciphertext":"x"}' }, { value: 'Plain note', encrypted: false }),
    );
    const input = path.join(dir, 'results.json');
    const draftFile = path.join(dir, 'draft-text.json');
    const clio = path.join(dir, 'conversations.jsonl');
    writeFileSync(input, JSON.stringify(survey));
    writeFileSync(
      draftFile,
      JSON.stringify(
        draftTextFixture([
          { responder: addressOf(0), questionId: 'qf', aiAnswer: 'Keep it simple ', aiComment: 'AI note', origin: 'voice_interview', condition: 'blind' },
          { responder: addressOf(1), questionId: 'qf', aiAnswer: 'AI guess', aiComment: 'Plain note' },
          // No response to these questions, and no drafted text.
          { responder: addressOf(2), questionId: 'qf', aiAnswer: 'Unanswered', aiComment: '' },
          { responder: addressOf(2), questionId: 'q9', aiAnswer: 'Unknown question', aiComment: '' },
          { responder: addressOf(3), questionId: 'q1', aiAnswer: '', aiComment: '  ' },
        ]),
      ),
    );
    const run = runReport(dir, ['--export', input, '--draft-text', draftFile, '--clio', clio]);
    assert.equal(run.status, 0, run.stderr);
    const conversations = readJsonl(clio);
    const byField = (field, origin) => conversations.find((line) => line.metadata.field === field && line.metadata.origin === origin);
    assert.equal(conversations.length, 3, 'two from the first person, the comment from the second');

    const unchanged = byField('answer', 'voice_interview');
    const first = unchanged.metadata.participant;
    assert.deepEqual(unchanged, {
      chat_id: `${first}:qf:answer`,
      created_at: '2026-10-25T00:00:00Z',
      messages: [{ role: 'assistant', content: 'Keep it simple ', created_at: '2026-10-25T00:00:00Z' }],
      metadata: { participant: first, question_id: 'qf', field: 'answer', origin: 'voice_interview', condition: 'blind', changed: false },
    });
    const changed = byField('comment', 'voice_interview');
    assert.deepEqual(changed.messages.map((message) => [message.role, message.content]), [['assistant', 'AI note'], ['user', 'My own note']]);
    assert.equal(changed.metadata.changed, true);

    // The second person's answer is encrypted now, so only their comment is written; origin and condition weren't given.
    const second = conversations.filter((line) => line.metadata.participant !== first);
    assert.deepEqual(second.map((line) => line.metadata.field), ['comment']);
    assert.deepEqual(Object.keys(second[0].metadata), ['participant', 'question_id', 'field', 'changed']);
    assert.equal(second[0].messages.length, 1);
    assert.doesNotMatch(readFileSync(clio, 'utf8'), /AI guess|Old plain|Unanswered|Unknown question/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a draft text file of the wrong kind is an error', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-fidelity-'));
  try {
    const input = path.join(dir, 'results.json');
    const draftFile = path.join(dir, 'draft-text.json');
    const clio = path.join(dir, 'conversations.jsonl');
    writeFileSync(input, JSON.stringify(exportFixture()));
    for (const [body, message] of [
      [{ ...draftTextFixture([]), type: 'ce_results_export' }, /must be the AI draft text download/],
      [{ ...draftTextFixture([]), version: 2 }, /must be the AI draft text download/],
      [{ ...draftTextFixture([]), rows: {} }, /has no list of rows/],
    ]) {
      writeFileSync(draftFile, JSON.stringify(body));
      const run = runReport(dir, ['--export', input, '--draft-text', draftFile, '--clio', clio]);
      assert.equal(run.status, 1);
      assert.match(run.stderr, message);
    }
    const run = spawnSync(process.execPath, [script, '--export', input, '--clio', clio], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /--draft-text and --clio go together/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
