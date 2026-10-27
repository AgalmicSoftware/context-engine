import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compareAnswers, renderComparisonMarkdown, summarizeModelAnswers } from '../src/answer-comparison.mjs';
import { runCli } from '../src/cli.mjs';

const questions = [
  { id: 'qb', type: 'binary', prompt: 'AI labs should publish their safety evaluations.' },
  { id: 'qs', type: 'multichoice', prompt: 'Which camp are you closest to?', options: ['d/acc', 'e/acc', 'PauseAI'], singleSelect: true },
  { id: 'qm', type: 'multichoice', prompt: 'Which risks worry you?', options: ['Misuse', 'Accidents', 'Power'] },
  { id: 'qr', type: 'rating', prompt: 'How optimistic are you?', scale: { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Very' } },
  { id: 'qq', type: 'quadratic', prompt: 'Fund what?', options: ['Evals', 'Interpretability', 'Policy'], voiceCredits: 16 },
  { id: 'qf', type: 'freeform', prompt: 'What would change your mind?' },
];
const person = (index) => `0x${String(index).padStart(40, '0')}`;
// Six people: the first five arrived through the rxc link, the sixth through edge.
const peopleAnswers = {
  qb: ['Agree', 'Agree', 'Agree', 'Agree', 'Disagree', 'Disagree'],
  qs: [['d/acc'], ['d/acc'], ['d/acc'], ['e/acc'], ['e/acc'], ['PauseAI']],
  qm: [['Misuse'], ['Misuse', 'Power'], ['Accidents'], ['Misuse'], ['Power'], ['Misuse', 'Accidents']],
  qr: [2, 4, 6, 8, 10, 10],
  qq: Array.from({ length: 6 }, () => [2, 1, 0]),
  qf: ['More evidence.', 'A good argument.', 'Nothing.', 'Data.', 'Time.', 'Experience.'],
};
const resultsExport = {
  sessionSlug: 'ai-futures-2026',
  filteredQuestions: questions,
  filteredQuestionResponses: Object.fromEntries(
    Object.entries(peopleAnswers).map(([questionId, values]) => [
      questionId,
      values.map((value, index) => ({
        responder: person(index + 1),
        questionId,
        response: { questionID: questionId, answer: { value }, recruitment: { source: index < 5 ? 'rxc' : 'edge' } },
      })),
    ]),
  ),
};
const modelReplies = {
  'model-a': { qb: ['Agree', 'Agree', 'Disagree'], qs: [['d/acc'], ['d/acc'], ['d/acc']], qm: [['Misuse'], ['Misuse', 'Power'], ['Misuse']], qr: [6, 6, 8], qq: [[2, 1, 0], [2, 1, 0]], qf: ['Evidence.'] },
  'model-b': { qb: ['Disagree', 'Disagree', 'Disagree'], qs: [['PauseAI'], ['e/acc'], ['PauseAI']], qm: [['Power']], qr: [10, 10, 10], qq: [[0, 0, 3]], qf: ['Nothing.'] },
};
const answersFile = {
  kind: 'ai_discourse_bench_answers',
  setId: 'ai-futures-2026',
  questions,
  rows: Object.entries(modelReplies).flatMap(([modelId, replies]) =>
    Object.entries(replies).flatMap(([questionId, values]) =>
      values.map((answer, index) => ({ modelId, questionId, repeatIndex: index + 1, answer })),
    ),
  ),
};
const report = compareAnswers({ answersFile, resultsExport, bootstrapSamples: 200 });
const questionResult = (id) => report.questions.find((question) => question.id === id);

test('each model counts once, summarized from its replies', () => {
  const [qb, qs, qr, qq] = ['qb', 'qs', 'qr', 'qq'].map((id) => ({ ...questions.find((q) => q.id === id), id }));
  assert.deepEqual(summarizeModelAnswers(qb, ['Agree', 'Agree', 'Disagree']), { answer: 'Agree', replies: 3, stability: 0.6667 });
  assert.equal(summarizeModelAnswers(qb, ['Agree', 'Disagree']).answer, 'Unsure', 'an even split has not settled');
  assert.deepEqual(summarizeModelAnswers({ ...qs, singleSelect: true }, [['e/acc'], ['PauseAI'], ['PauseAI']]).answer, ['PauseAI']);
  assert.equal(summarizeModelAnswers({ ...qr, scale: { min: 0, max: 10 } }, [6, 6, 8]).answer, 6);
  assert.deepEqual(summarizeModelAnswers(qq, [[2, 1, 0], [0, 1, 2]]).answer, [1, 1, 1]);
});

test('groups smaller than 5 people are withheld, and freeform is listed but not compared', () => {
  assert.deepEqual(report.groups, [{ id: 'everyone', people: 6 }, { id: 'rxc', people: 5 }]);
  assert.equal(report.groupsWithheld, 1);
  assert.match(questionResult('qf').notCompared, /judge model/);
  assert.equal(questionResult('qf').models['model-a'].replies, 1);
});

test('agree/disagree: share giving the same answer, difference in % agree with an interval, earth mover’s distance', () => {
  const everyone = questionResult('qb').comparisons.everyone;
  assert.equal(everyone.byModel['model-a'].sameAnswerShare, 0.6667);
  assert.equal(everyone.byModel['model-b'].sameAnswerShare, 0.3333);
  assert.deepEqual(everyone.models.agreeShare, { models: 0.5, people: 0.6667 });
  assert.equal(everyone.models.agreeDifference, -0.1667);
  const [low, high] = everyone.models.agreeDifferenceInterval;
  assert.ok(low < -0.1667 && high > -0.1667);
  // Half of the models disagree against a third of people, across the two-step Disagree–Agree gap.
  assert.equal(everyone.models.earthMovers, 0.3333);
  assert.equal(questionResult('qb').comparisons.rxc.byModel['model-a'].sameAnswerShare, 0.8);
});

test('choices: same-answer share and distances, or Jaccard and inclusion rates for several options', () => {
  const single = questionResult('qs').comparisons.everyone;
  assert.equal(single.byModel['model-a'].sameAnswerShare, 0.5);
  assert.equal(single.byModel['model-b'].sameAnswerShare, 0.1667);
  assert.equal(single.models.totalVariation, 0.3333);
  assert.ok(single.models.jensenShannon > 0 && single.models.jensenShannon < 1);
  const multiple = questionResult('qm').comparisons.everyone;
  // Model A's answer is Misuse; people's sets give Jaccard 1, 1/2, 0, 1, 0 and 1/2.
  assert.equal(multiple.byModel['model-a'].meanJaccard, 0.5);
  const misuse = multiple.models.inclusion.find((row) => row.option === 'Misuse');
  assert.deepEqual([misuse.models, misuse.people, misuse.difference], [0.5, 0.6667, -0.1667]);
  assert.equal(misuse.interval.length, 2);
});

test('ratings: percentile, distance from the median, earth mover’s distance and median difference', () => {
  const everyone = questionResult('qr').comparisons.everyone;
  assert.deepEqual(everyone.byModel['model-a'], { similarity: 0.7333, percentile: 0.4167, fromMedian: -1 });
  assert.equal(everyone.byModel['model-b'].percentile, 0.8333);
  assert.equal(everyone.models.medianDifference, 1);
  assert.equal(everyone.models.earthMovers, 1.3333);
  assert.equal(everyone.models.medianDifferenceInterval.length, 2);
});

test('allocations: cosine to the group’s mean, mean vote differences and top-option shares', () => {
  const everyone = questionResult('qq').comparisons.everyone;
  assert.equal(everyone.byModel['model-a'].cosineToMean, 1);
  const evals = everyone.models.byOption[0];
  assert.deepEqual(evals.meanVotes, { models: 1, people: 2 });
  assert.deepEqual(evals.topOptionShare, { models: 0.5, people: 1 });
});

test('closeness averages each model’s similarity over the questions compared', () => {
  const similarities = ['qb', 'qs', 'qm', 'qr', 'qq'].map(
    (id) => questionResult(id).comparisons.everyone.byModel['model-a'].similarity,
  );
  const expected = Number((similarities.reduce((sum, value) => sum + value, 0) / similarities.length).toFixed(4));
  assert.deepEqual(report.closeness.everyone['model-a'], { similarity: expected, questions: 5 });
  const markdown = renderComparisonMarkdown(report);
  assert.match(markdown, /\| Model \| everyone \(6\) \| rxc \(5\) \|/);
  assert.match(markdown, /Agree: models 0\.5, people 0\.6667; difference -0\.1667/);
});

test('listed groups replace arrival links, and agents are left out', () => {
  const withAgent = structuredClone(resultsExport);
  withAgent.filteredQuestionResponses.qb.push({
    responder: person(9),
    questionId: 'qb',
    response: { questionID: 'qb', answer: { value: 'Agree' }, participant: { kind: 'agent' } },
  });
  const listed = compareAnswers({
    answersFile,
    resultsExport: withAgent,
    groups: Object.fromEntries([1, 2, 3, 4, 5, 6].map((index) => [person(index), index % 2 ? 'odd' : 'even'])),
    minPeople: 3,
    bootstrapSamples: 50,
  });
  assert.deepEqual(listed.groups, [{ id: 'everyone', people: 6 }, { id: 'even', people: 3 }, { id: 'odd', people: 3 }]);
});

test('the compare-answers command writes JSON and Markdown', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aidb-compare-'));
  const answersPath = path.join(dir, 'answers.json');
  const peoplePath = path.join(dir, 'results.json');
  await writeFile(answersPath, JSON.stringify(answersFile));
  await writeFile(peoplePath, JSON.stringify(resultsExport));
  const originalLog = console.log;
  console.log = () => {};
  try {
    await runCli(['compare-answers', '--answers', answersPath, '--people', peoplePath, '--out', dir, '--bootstrap', '50']);
  } finally {
    console.log = originalLog;
  }
  const written = JSON.parse(await readFile(path.join(dir, 'answer-comparison.json'), 'utf8'));
  assert.equal(written.kind, 'ai_discourse_bench_answer_comparison');
  assert.match(await readFile(path.join(dir, 'answer-comparison.md'), 'utf8'), /^# Models compared with people/);
});
