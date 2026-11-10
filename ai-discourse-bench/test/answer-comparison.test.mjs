import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compareAnswers, renderComparisonMarkdown, summarizeModelAnswers } from '../src/answer-comparison.mjs';
import { readQuestionSet, runAnswerSet } from '../src/answer-set.mjs';
import { runCli } from '../src/cli.mjs';
import { newcombeDifferenceInterval } from '../src/statistics.mjs';

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

test('groups smaller than 5 people are withheld, and so are groups that could be subtracted from everyone', () => {
  // The edge link brought one person. Everyone (6) minus rxc (5) would be that
  // person's own answers, so rxc is withheld too.
  assert.equal(report.people, 6);
  assert.deepEqual(report.groups, []);
  assert.equal(report.groupsWithheld, 2);
  assert.equal(questionResult('qb').comparisons.byGroup.rxc, undefined);
  assert.match(questionResult('qf').notCompared, /judge model/);
  assert.equal(questionResult('qf').models['model-a'].replies, 1);
});

test('agree/disagree: share giving the same answer, difference in % agree with an interval, earth mover’s distance', () => {
  const everyone = questionResult('qb').comparisons.overall;
  assert.equal(everyone.byModel['model-a'].sameAnswerShare, 0.6667);
  assert.equal(everyone.byModel['model-b'].sameAnswerShare, 0.3333);
  assert.deepEqual(everyone.models.agreeShare, { models: 0.5, people: 0.6667 });
  assert.equal(everyone.models.agreeDifference, -0.1667);
  const [low, high] = everyone.models.agreeDifferenceInterval;
  assert.ok(low < -0.1667 && high > -0.1667);
  // Half of the models disagree against a third of people, across the two-step Disagree–Agree gap.
  assert.equal(everyone.models.earthMovers, 0.3333);
  // Newcombe's (1998) worked example: 56/70 against 48/80.
  assert.deepEqual(newcombeDifferenceInterval(56, 70, 48, 80), [0.0524, 0.3339]);
});

test('choices: same-answer share and distances, or Jaccard and inclusion rates for several options', () => {
  const single = questionResult('qs').comparisons.overall;
  assert.equal(single.byModel['model-a'].sameAnswerShare, 0.5);
  assert.equal(single.byModel['model-b'].sameAnswerShare, 0.1667);
  assert.equal(single.models.totalVariation, 0.3333);
  assert.ok(single.models.jensenShannon > 0 && single.models.jensenShannon < 1);
  const multiple = questionResult('qm').comparisons.overall;
  // Model A's answer is Misuse; people's sets give Jaccard 1, 1/2, 0, 1, 0 and 1/2.
  assert.equal(multiple.byModel['model-a'].meanJaccard, 0.5);
  const misuse = multiple.models.inclusion.find((row) => row.option === 'Misuse');
  assert.deepEqual([misuse.models, misuse.people, misuse.difference], [0.5, 0.6667, -0.1667]);
  assert.equal(misuse.interval.length, 2);
});

test('ratings: percentile, distance from the median, earth mover’s distance and median difference', () => {
  const everyone = questionResult('qr').comparisons.overall;
  assert.deepEqual(everyone.byModel['model-a'], { similarity: 0.7333, percentile: 0.4167, fromMedian: -1 });
  assert.equal(everyone.byModel['model-b'].percentile, 0.8333);
  assert.equal(everyone.models.medianDifference, 1);
  assert.equal(everyone.models.earthMovers, 1.3333);
  assert.equal(everyone.models.medianDifferenceInterval.length, 2);
});

test('allocations: cosine to the group’s mean, mean vote differences and top-option shares', () => {
  const everyone = questionResult('qq').comparisons.overall;
  assert.equal(everyone.byModel['model-a'].cosineToMean, 1);
  const evals = everyone.models.byOption[0];
  assert.deepEqual(evals.meanVotes, { models: 1, people: 2 });
  assert.deepEqual(evals.topOptionShare, { models: 0.5, people: 1 });
});

test('closeness averages each model’s similarity over the questions compared', () => {
  const similarities = ['qb', 'qs', 'qm', 'qr', 'qq'].map(
    (id) => questionResult(id).comparisons.overall.byModel['model-a'].similarity,
  );
  const expected = Number((similarities.reduce((sum, value) => sum + value, 0) / similarities.length).toFixed(4));
  assert.deepEqual(report.closeness.overall['model-a'], { similarity: expected, questions: 5 });
  const markdown = renderComparisonMarkdown(report);
  assert.match(markdown, /\| Model \| Everyone \(6\) \|\n/);
  assert.match(markdown, /Agree: models 0\.5, people 0\.6667; difference -0\.1667/);
});

test('listed groups replace arrival links, and agents are left out', () => {
  const withAgent = structuredClone(resultsExport);
  withAgent.filteredQuestionResponses.qb.push({
    responder: person(9),
    questionId: 'qb',
    response: { questionID: 'qb', answer: { value: 'Agree' }, participant: { kind: 'agent' } },
  });
  const oddOrEven = Object.fromEntries([1, 2, 3, 4, 5, 6].map((index) => [person(index), index % 2 ? 'odd' : 'even']));
  const listed = compareAnswers({ answersFile, resultsExport: withAgent, groups: oddOrEven, minPeople: 3, bootstrapSamples: 50 });
  assert.deepEqual(listed.groups, [{ id: 'even', people: 3 }, { id: 'odd', people: 3 }]);
  // People 1, 3 and 5 said Agree, Agree and Disagree; model A said Agree.
  assert.equal(listed.questions.find((question) => question.id === 'qb').comparisons.byGroup.odd.byModel['model-a'].sameAnswerShare, 0.6667);
});

test('a group named everyone is reported apart from everyone', () => {
  // Ten people: the five who arrived through ?src=everyone agree, the other five disagree.
  const qb = questions[0];
  const rows = Array.from({ length: 10 }, (_, index) => ({
    responder: person(index + 1),
    questionId: 'qb',
    response: {
      questionID: 'qb',
      answer: { value: index < 5 ? 'Agree' : 'Disagree' },
      recruitment: { source: index < 5 ? 'everyone' : 'other' },
    },
  }));
  const compared = compareAnswers({
    answersFile: { ...answersFile, questions: [qb], rows: [{ modelId: 'model-a', questionId: 'qb', answer: 'Agree' }] },
    resultsExport: { filteredQuestions: [qb], filteredQuestionResponses: { qb: rows } },
    bootstrapSamples: 0,
  });
  assert.equal(compared.people, 10);
  assert.deepEqual(compared.groups, [{ id: 'everyone', people: 5 }, { id: 'other', people: 5 }]);
  const { overall, byGroup } = compared.questions[0].comparisons;
  assert.deepEqual([overall.people, overall.byModel['model-a'].sameAnswerShare], [10, 0.5]);
  assert.deepEqual([byGroup.everyone.people, byGroup.everyone.byModel['model-a'].sameAnswerShare], [5, 1]);
  assert.equal(compared.closeness.overall['model-a'].similarity, 0.5);
  assert.equal(compared.closeness.byGroup.everyone['model-a'].similarity, 1);
  assert.match(renderComparisonMarkdown(compared), /\| Model \| Everyone \(10\) \| Group everyone \(5\) \| Group other \(5\) \|/);
});

test('each question checks its groups again with the people who answered it', () => {
  // Person 2 skips qb: two even people answered it, so even is withheld there,
  // and odd too, since everyone minus odd would be those two.
  const skipped = structuredClone(resultsExport);
  skipped.filteredQuestionResponses.qb = skipped.filteredQuestionResponses.qb.filter((row) => row.responder !== person(2));
  const oddOrEven = Object.fromEntries([1, 2, 3, 4, 5, 6].map((index) => [person(index), index % 2 ? 'odd' : 'even']));
  const checked = compareAnswers({ answersFile, resultsExport: skipped, groups: oddOrEven, minPeople: 3, bootstrapSamples: 50 });
  const comparisons = (id) => checked.questions.find((question) => question.id === id).comparisons;
  assert.deepEqual(comparisons('qb').byGroup.even, { people: 2, suppressed: true });
  assert.deepEqual(comparisons('qb').byGroup.odd, { people: 3, suppressed: true });
  assert.equal(comparisons('qb').overall.people, 5);
  assert.equal(comparisons('qs').byGroup.odd.people, 3);
  assert.equal(comparisons('qs').byGroup.odd.suppressed, undefined);
});

test('a question the answer file defines differently from the export is not compared', () => {
  const exportWith = (changes) => ({
    ...resultsExport,
    filteredQuestions: questions.map((question) => ({ ...question, ...changes[question.id] })),
  });
  const compared = compareAnswers({
    answersFile,
    resultsExport: exportWith({
      qr: { scale: { min: 0, max: 100, minLabel: 'Not at all', maxLabel: 'Very' } },
      qq: { options: ['Policy', 'Interpretability', 'Evals'] },
      qs: { options: ['PauseAI', 'e/acc', 'd/acc'] },
    }),
    bootstrapSamples: 0,
  });
  const result = (id) => compared.questions.find((question) => question.id === id);
  assert.match(result('qr').notCompared, /differently .*\(scale\)/);
  assert.equal(result('qr').comparisons, undefined);
  assert.equal(result('qr').models['model-a'].answer, 6, 'replies are read as the models were asked');
  assert.match(result('qq').notCompared, /\(options\)/, 'votes are read by position');
  assert.equal(result('qs').notCompared, undefined, 'choices listed in another order read the same');
  assert.equal(compared.closeness.overall['model-a'].questions, 3);
  assert.match(renderComparisonMarkdown(compared), /defines this question differently/);

  const swapped = compareAnswers({
    answersFile,
    resultsExport: exportWith({ qr: { scale: { min: 0, max: 10, minLabel: 'Very', maxLabel: 'Not at all' } } }),
    bootstrapSamples: 0,
  });
  assert.match(swapped.questions.find((question) => question.id === 'qr').notCompared, /\(labels\)/);
  const retyped = compareAnswers({
    answersFile: { ...answersFile, questions: questions.map((question) => (question.id === 'qb' ? { ...question, type: 'rating' } : question)) },
    resultsExport,
    bootstrapSamples: 0,
  });
  assert.match(retyped.questions.find((question) => question.id === 'qb').notCompared, /\(type\)/);
});

test('an answer file and a Results export from another session are refused', () => {
  assert.throws(() => compareAnswers({ answersFile: { runs: [] }, resultsExport }), /must come from the answer command/);
  const elsewhere = { ...answersFile, rows: answersFile.rows.map((row) => ({ ...row, questionId: `other-${row.questionId}` })) };
  assert.throws(() => compareAnswers({ answersFile: elsewhere, resultsExport }), /None of the answers/);
});

test('older polls are asked and compared as single choices, from answer to compare-answers', async () => {
  const pollExport = structuredClone(resultsExport);
  pollExport.filteredQuestions = [{ id: 'qp', type: 'poll', prompt: 'Which camp?', options: ['d/acc', 'e/acc', 'PauseAI'] }];
  pollExport.filteredQuestionResponses = {
    qp: ['d/acc', 'd/acc', 'e/acc', 'PauseAI', 'd/acc'].map((value, index) => ({
      responder: person(index + 1),
      questionId: 'qp',
      response: { questionID: 'qp', answer: { value } },
    })),
  };
  const answered = await runAnswerSet({
    questionSet: readQuestionSet(pollExport),
    modelRoster: { models: [{ id: 'mock-a', provider: 'mock', model: 'mock/a' }] },
    repeats: 3,
  });
  assert.ok(answered.rows.every((row) => row.answer.length === 1), 'one option per reply');
  const poll = compareAnswers({ answersFile: answered, resultsExport: pollExport, bootstrapSamples: 50 }).questions[0];
  assert.equal(poll.type, 'multichoice');
  assert.equal(poll.comparisons.overall.people, 5);
  assert.ok(Number.isFinite(poll.comparisons.overall.models.totalVariation));
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
