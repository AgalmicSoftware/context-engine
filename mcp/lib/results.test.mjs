import test from 'node:test';
import assert from 'node:assert/strict';
import { latestAnswersByQuestion, summarizeQuestion } from './results.mjs';

const SESSION = { sessionSlug: 'town-hall', sessionId: '0x00112233445566778899aabbccddeeff' };

test('registry results accept web identities and use chain ordering only for known questions', () => {
  const row = (blockNumber, transactionIndex, logIndex, value, extra = {}) => ({
    blockNumber, transactionIndex, logIndex, createdAt: 'same', responder: '0xA',
    payload: { questionID: '0xq', answer: { value }, ...extra },
  });
  const latest = latestAnswersByQuestion([
    row(2, 0, 1, 'Unsure'), row(1, 9, 9, 'Agree'), row(2, 1, 0, 'Disagree', { sessionName: 'Town Hall' }),
    row(2, 1, 1, 'Agree', { name: 'town-hall' }),
    row(3, 0, 0, 'Disagree', { sessionSlug: 'elsewhere' }),
    row(3, 0, 1, 'Disagree', { questionID: '0xunknown' }),
    row(3, 0, 2, 'Disagree', { answer: { encrypted: true, value: 'ciphertext' } }),
  ], { registryConfig: { slug: 'town-hall', sessionName: 'Town Hall' }, questionIds: new Set(['0xq']) });
  assert.equal(latest.size, 1);
  assert.equal(latest.get('0xq').get('0xa').payload.answer.value, 'Agree');
});
const entry = (storageId, createdAt, responder, questionId, value, extra = {}) => ({
  storageId,
  createdAt,
  responder,
  payload: { questionID: questionId, answer: { value }, ...SESSION, ...extra },
});

test('keeps the newest answer per participant, breaking ties by storage id, and drops other sessions', () => {
  const latest = latestAnswersByQuestion(
    [
      entry('a', '2026-10-16T10:00:00.000Z', '0xA', '0xq', 'Agree'),
      entry('b', '2026-10-16T11:00:00.000Z', '0xA', '0xq', 'Disagree'),
      entry('d', '2026-10-16T12:00:00.000Z', '0xB', '0xq', 'Agree'),
      entry('c', '2026-10-16T12:00:00.000Z', '0xB', '0xq', 'Unsure'),
      entry('x', '2026-10-16T13:00:00.000Z', '0xC', '0xq', 'Agree', { sessionSlug: 'other' }),
    ],
    SESSION,
  );
  const answers = latest.get('0xq');
  assert.equal(answers.size, 2);
  assert.equal(answers.get('0xa').payload.answer.value, 'Disagree');
  assert.equal(answers.get('0xb').storageId, 'd');
});

test('summarizes binary answers, ignoring cleared answers and counting self-declared agents', () => {
  const latest = latestAnswersByQuestion(
    [
      entry('1', '1', '0xA', '0xq', 'Agree', { participant: { kind: 'agent' } }),
      entry('2', '1', '0xB', '0xq', 'Disagree'),
      entry('3', '1', '0xC', '0xq', ''),
    ],
    SESSION,
  );
  const summary = summarizeQuestion({ id: '0xq', type: 'binary', prompt: 'P' }, latest.get('0xq'));
  assert.deepEqual(summary.counts, { Agree: 1, Unsure: 0, Disagree: 1 });
  assert.equal(summary.responses, 2);
  assert.equal(summary.selfDeclaredAgents, 1);
});

test('summarizes rating, multichoice, quadratic and freeform answers', () => {
  const answers = (values) =>
    latestAnswersByQuestion(values.map((value, index) => entry(String(index), '1', `0x${index}`, '0xq', value)), SESSION).get('0xq');
  const rating = summarizeQuestion({ id: '0xq', type: 'rating', prompt: 'P' }, answers([2, 4, 4]));
  assert.equal(rating.mean, 3.33);
  assert.deepEqual(rating.histogram, { 2: 1, 4: 2 });
  const multi = summarizeQuestion({ id: '0xq', type: 'multichoice', options: ['A', 'B'] }, answers([['A'], ['A', 'B']]));
  assert.deepEqual(multi.counts, { A: 2, B: 1 });
  const quad = summarizeQuestion({ id: '0xq', type: 'quadratic', options: ['A', 'B'], voiceCredits: 10 }, answers([[3, -1], [1, 1], [4, 0]]));
  assert.deepEqual(quad.options.map((option) => option.net), [4, 0]);
  assert.equal(quad.responses, 2);
  assert.equal(quad.invalidResponses, 1);
  const free = summarizeQuestion({ id: '0xq', type: 'freeform' }, answers(['one', 'two']));
  assert.equal(free.recentAnswers.length, 2);
});

test('ignores hostile or malformed answers instead of miscounting them', () => {
  const answers = (values, extra = {}) =>
    latestAnswersByQuestion(values.map((value, index) => entry(String(index), '1', `0x${index}`, '0xq', value, extra)), SESSION).get('0xq');
  const binary = summarizeQuestion({ id: '0xq', type: 'binary' }, answers(['constructor', 'toString', ['Agree'], 'Agree', { toString: 1 }]));
  assert.deepEqual(binary.counts, { Agree: 2, Unsure: 0, Disagree: 0 });
  assert.equal(binary.invalidResponses, 3);
  const multi = summarizeQuestion({ id: '0xq', type: 'multichoice', options: ['A'] }, answers([['constructor'], ['A']]));
  assert.deepEqual(multi.counts, { A: 1 });
  const rating = summarizeQuestion({ id: '0xq', type: 'rating' }, answers([1e308, 1e308, 5, '7']));
  assert.equal(rating.mean, 6);
  const weird = latestAnswersByQuestion(
    [{ storageId: 'x', createdAt: '1', responder: '0xA', payload: { questionID: '0xq', sessionSlug: { toString: 1, valueOf: 1 }, sessionId: SESSION.sessionId, answer: { value: 'Agree' } } }],
    SESSION,
  );
  assert.equal(weird.size, 0);
});

test('reads legacy and differently typed answers the way the web report does', () => {
  const answers = (values, extra = {}) =>
    latestAnswersByQuestion(values.map((value, index) => entry(String(index), '1', `0x${index}`, '0xq', value, extra)), SESSION).get('0xq');
  const binary = summarizeQuestion({ id: '0xq', type: 'binary' }, answers(['yes', 'AGREE', 'no', 'maybe', true]));
  assert.deepEqual(binary.counts, { Agree: 3, Unsure: 1, Disagree: 1 });
  const multi = summarizeQuestion({ id: '0xq', type: 'multichoice', options: ['Red', 'Blue'], singleChoice: true }, answers(['red', ['Blue'], ['Red', 'Blue']]));
  assert.deepEqual(multi.counts, { Red: 1, Blue: 1 });
  assert.equal(multi.invalidResponses, 1);
  const mismatched = summarizeQuestion({ id: '0xq', type: 'binary' }, answers(['Agree'], { type: 'rating' }));
  assert.equal(mismatched.responses, 0);
});
