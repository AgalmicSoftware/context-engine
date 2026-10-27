import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAnswerValue } from '../../shared/questions/answerValue.mjs';
import {
  answerJsonSchema,
  answerVariants,
  buildAnswerPrompt,
  parseAnswerOutput,
  readQuestionSet,
  runAnswerSet,
} from '../src/answer-set.mjs';
import { runCli } from '../src/cli.mjs';

// A Results "JSON: Questions + Responses" export with every question type.
const resultsExport = {
  sessionSlug: 'ai-futures-2026',
  filteredQuestions: [
    { id: 'qb', type: 'binary', prompt: 'AI labs should publish their safety evaluations.' },
    {
      id: 'qs',
      type: 'multichoice',
      prompt: 'Which camp are you closest to?',
      options: ['d/acc', 'e/acc', 'PauseAI'],
      singleSelect: true,
    },
    {
      id: 'qm',
      type: 'multichoice',
      prompt: 'Which risks worry you?',
      options: ['Misuse', 'Accidents', 'Power concentration', 'None'],
      maxSelections: 2,
    },
    {
      id: 'qr',
      type: 'rating',
      prompt: 'How optimistic are you about AI?',
      scale: { min: 0, max: 10, minLabel: 'Very pessimistic', maxLabel: 'Very optimistic' },
    },
    { id: 'qn', type: 'rating', prompt: 'How many hours a week do you use AI?', scale: { min: 0, max: 40 } },
    {
      id: 'qq',
      type: 'quadratic',
      prompt: 'Where should AI safety funding go?',
      options: ['Evals', 'Interpretability', 'Policy'],
      voiceCredits: 16,
    },
    { id: 'qf', type: 'freeform', prompt: 'What would change your mind about AI risk?' },
    { id: 'locked', type: 'binary', prompt: '[encrypted]' },
    { id: 'poll', type: 'poll', prompt: 'Pick one', options: ['Yes', 'No'] },
    { id: 'ranked', type: 'ranking', prompt: 'Rank these', options: ['A', 'B'] },
  ],
};
const roster = {
  models: [
    { id: 'mock-a', provider: 'mock', model: 'mock/a' },
    { id: 'mock-b', provider: 'mock', model: 'mock/b' },
  ],
};
const byId = (set) => Object.fromEntries(set.questions.map((question) => [question.id, question]));

test('question sets come from Results exports, question lists and the benchmark bank', () => {
  const set = readQuestionSet(resultsExport);
  assert.equal(set.setId, 'ai-futures-2026');
  assert.deepEqual(
    set.questions.map(({ id, type }) => `${id}:${type}`),
    ['qb:binary', 'qs:multichoice', 'qm:multichoice', 'qr:rating', 'qn:rating', 'qq:quadratic', 'qf:freeform', 'poll:multichoice'],
  );
  assert.deepEqual(set.skipped, { locked: 1, unsupported: 1, invalid: 0 });
  // Older polls are single choices unless marked otherwise, as the web client shows them.
  assert.equal(byId(set).poll.singleSelect, true);
  assert.equal(readQuestionSet([{ ...resultsExport.filteredQuestions[8], singleSelect: false }]).questions[0].singleSelect, false);

  const bank = readQuestionSet({
    benchmarkId: 'aidb-sample',
    questions: [{ id: 'aidb_0001', canonicalPrompt: 'Labs should be audited.', reversedPrompt: 'Labs should not be audited.' }],
  });
  assert.equal(bank.setId, 'aidb-sample');
  assert.deepEqual(bank.questions[0], {
    id: 'aidb_0001',
    type: 'binary',
    prompt: 'Labs should be audited.',
    reversedPrompt: 'Labs should not be audited.',
  });
  assert.equal(readQuestionSet([resultsExport.filteredQuestions[0]]).setId, 'questions');
});

test('each type is asked in the ways that expose wording and ordering effects', () => {
  const questions = byId(readQuestionSet(resultsExport));
  assert.deepEqual(answerVariants(questions.qb), ['canonical'], 'no reversed wording to ask');
  assert.deepEqual(answerVariants({ ...questions.qb, reversedPrompt: 'Labs should not publish.' }), ['canonical', 'reversed']);
  assert.deepEqual(answerVariants(questions.qr), ['scale', 'flipped']);
  assert.deepEqual(answerVariants(questions.qn), ['scale'], 'a scale without labelled ends has nothing to flip');
  assert.deepEqual(answerVariants(questions.qs), ['shuffled']);
  assert.deepEqual(answerVariants(questions.qq), ['shuffled']);
  assert.deepEqual(answerVariants(questions.qf), ['as-asked']);
});

test('prompts show options in the order asked, and the scale the way round asked', () => {
  const questions = byId(readQuestionSet(resultsExport));
  const choice = buildAnswerPrompt({ question: questions.qs, variant: 'shuffled', order: [2, 0, 1] });
  assert.ok(choice.indexOf('"PauseAI"') < choice.indexOf('"d/acc"') && choice.indexOf('"d/acc"') < choice.indexOf('"e/acc"'));
  assert.match(choice, /Choose exactly one option/);
  assert.match(buildAnswerPrompt({ question: questions.qm, variant: 'shuffled', order: [0, 1, 2, 3] }), /at most 2/);
  const allocation = buildAnswerPrompt({ question: questions.qq, variant: 'shuffled', order: [1, 2, 0] });
  assert.match(allocation, /1\. Interpretability\n2\. Policy\n3\. Evals/);
  assert.match(allocation, /You have 16 credits/);
  assert.match(buildAnswerPrompt({ question: questions.qr, variant: 'scale' }), /0 means "Very pessimistic" and 10 means "Very optimistic"/);
  // The JSON shape shows placeholders, not answers a model could copy.
  assert.match(buildAnswerPrompt({ question: questions.qn, variant: 'scale' }), /\{"answer":<whole number from 0 to 40>,/);
  assert.match(choice, /\{"answer":"<exact text of one option>",/);
  assert.match(allocation, /\{"answer":\[<vote for option 1>, <vote for option 2>, <vote for option 3>\],/);
  assert.match(buildAnswerPrompt({ question: questions.qr, variant: 'flipped' }), /0 means "Very optimistic" and 10 means "Very pessimistic"/);
  assert.match(
    buildAnswerPrompt({ question: { ...questions.qb, reversedPrompt: 'Labs should keep evaluations private.' }, variant: 'reversed' }),
    /Labs should keep evaluations private\./,
  );
});

test('replies are mapped back to the question and checked like a person’s answer', () => {
  const questions = byId(readQuestionSet(resultsExport));
  const reply = (answer) => JSON.stringify({ answer, confidence: 0.7, rationale: 'Because.' });
  const read = (question, variant, answer, order = [0, 1, 2, 3].slice(0, question.options?.length ?? 0)) =>
    parseAnswerOutput({ rawText: reply(answer), question, variant, order });

  // Choices are stored as lists, a single choice too, as the app stores people's.
  assert.deepEqual(read(questions.qs, 'shuffled', 'pauseai').answer, ['PauseAI']);
  assert.match(read(questions.qs, 'shuffled', ['d/acc', 'e/acc']).parseError, /exactly one option/);
  assert.match(read(questions.qs, 'shuffled', 'Neither').parseError, /not one of this question's options/);
  assert.deepEqual(read(questions.qm, 'shuffled', ['Accidents', 'Misuse']).answer, ['Accidents', 'Misuse']);
  // Votes come back in the order shown: Policy, Evals, Interpretability.
  assert.deepEqual(read(questions.qq, 'shuffled', [3, -2, 1], [2, 0, 1]).answer, [-2, 1, 3]);
  assert.match(read(questions.qq, 'shuffled', [4, 1, 0], [0, 1, 2]).parseError, /exceeds the voice-credit budget/);
  assert.equal(read(questions.qr, 'scale', 2).answer, 2);
  assert.equal(read(questions.qr, 'flipped', 2).answer, 8, 'a 2 on the flipped scale is an 8 on the question’s own');
  assert.match(read(questions.qr, 'scale', 11).parseError, /whole number from 0 to 10/);
  assert.equal(read(questions.qf, 'as-asked', 'Evidence of deception.').answer, 'Evidence of deception.');
  const reversed = parseAnswerOutput({
    rawText: reply('Agree'),
    question: { ...questions.qb, reversedPrompt: 'Labs should keep evaluations private.' },
    variant: 'reversed',
    order: [],
  });
  assert.equal(reversed.answer, 'Disagree');
  assert.equal(reversed.rawAnswer, 'Agree');
  assert.match(parseAnswerOutput({ rawText: 'I think 7', question: questions.qr, variant: 'scale', order: [] }).parseError, /not valid JSON/);
});

test('structured output asks for each type’s own answer shape', () => {
  const questions = byId(readQuestionSet(resultsExport));
  const answerSchema = (question, order = []) => answerJsonSchema({ question, order }).schema.properties.answer;
  assert.deepEqual(answerSchema(questions.qs, [1, 0, 2]), { type: 'string', enum: ['e/acc', 'd/acc', 'PauseAI'] });
  assert.equal(answerSchema(questions.qm, [0, 1, 2, 3]).type, 'array');
  assert.deepEqual(answerSchema(questions.qr), { type: 'integer', minimum: 0, maximum: 10 });
  assert.deepEqual(answerSchema(questions.qq, [0, 1, 2]), { type: 'array', minItems: 3, maxItems: 3, items: { type: 'integer' } });
  assert.deepEqual(answerSchema(questions.qb), { type: 'string', enum: ['Agree', 'Unsure', 'Disagree'] });
});

test('a run answers every question every way, and resumes without asking again', async () => {
  const questionSet = readQuestionSet(resultsExport);
  const result = await runAnswerSet({ questionSet, modelRoster: roster, repeats: 2 });
  // Per model and repeat: qb 1, qs 1, qm 1, qr 2, qn 1, qq 1, qf 1, poll 1 = 9 ways.
  assert.equal(result.kind, 'ai_discourse_bench_answers');
  assert.equal(result.rows.length, 2 * 2 * 9);
  assert.equal(result.unanswered, 0);
  const questions = byId(questionSet);
  for (const row of result.rows) {
    assert.deepEqual(normalizeAnswerValue(questions[row.questionId], row.answer), { ok: true, value: row.answer });
  }
  const orders = result.rows.filter((row) => row.questionId === 'qm').map((row) => row.presentedOptions.join('|'));
  assert.ok(new Set(orders).size > 1, 'option order changes between repeats and models');

  let calls = 0;
  const resumed = await runAnswerSet({
    questionSet,
    modelRoster: roster,
    repeats: 2,
    existingRows: result.rows,
    callModelImpl: async () => {
      calls += 1;
      throw new Error('should not be asked');
    },
  });
  assert.equal(calls, 0);
  assert.equal(resumed.resumedRows, result.rows.length);
});

test('a reply that fails the checks is asked again, then kept as unanswered', async () => {
  const questionSet = readQuestionSet({ questions: [resultsExport.filteredQuestions[3]] });
  let calls = 0;
  const result = await runAnswerSet({
    questionSet,
    modelRoster: { models: [roster.models[0]] },
    repeats: 1,
    maxAttempts: 2,
    sleepImpl: async () => {},
    callModelImpl: async () => {
      calls += 1;
      return JSON.stringify({ answer: 42, confidence: 0.5, rationale: 'Off the scale.' });
    },
  });
  assert.equal(calls, 4, 'two attempts for each way of asking');
  assert.equal(result.unanswered, 2);
  assert.match(result.rows[0].parseError, /whole number from 0 to 10/);
});

test('the answer command writes rows for a session’s questions', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aidb-answer-'));
  const questionsPath = path.join(dir, 'results.json');
  const rosterPath = fileURLToPath(new URL('../data/model-roster.sample.json', import.meta.url));
  const outPath = path.join(dir, 'answers.json');
  await writeFile(questionsPath, JSON.stringify(resultsExport));
  const log = [];
  const originalLog = console.log;
  console.log = (line) => log.push(line);
  try {
    await runCli(['answer', '--questions', questionsPath, '--models', rosterPath, '--out', outPath, '--repeats', '1']);
  } finally {
    console.log = originalLog;
  }
  const written = JSON.parse(await readFile(outPath, 'utf8'));
  assert.equal(written.setId, 'ai-futures-2026');
  assert.equal(written.rows.length, 2 * 9);
  assert.match(log.join('\n'), /wrote 18 answers .* 2 questions skipped/);
  await assert.rejects(
    runCli(['answer', '--questions', questionsPath, '--models', rosterPath]),
    /Missing --out/,
  );
});
