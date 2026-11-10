import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionVoteRecommendations } from './questionVotes.mjs';

const question = (id, tags = [], extra = {}) => ({ questionId: id, questionType: 'binary', prompt: `Question ${id}`, tags, answerable: true, ...extra });
const recommendations = (questions, input) => buildQuestionVoteRecommendations(questions, input).recommendations;

for (const size of [1, 20, 300]) {
  test(`a targeted match survives a ${size}-question catalog`, () => {
    const questions = [question('target', ['garden']), ...Array.from({ length: size - 1 }, (_, index) => question(`other-${index}`))];
    for (const catalog of [questions, [...questions].reverse()]) {
      assert.deepEqual(recommendations(catalog, { tags: ['garden'] }).map(row => row.questionId), ['target']);
    }
  });
}

test('targeted matches include positive, negative and explicit IDs but exclude unrelated questions', () => {
  const questions = [question('unrelated'), question('positive', ['garden']), question('negative', ['noise']),
    question('important'), question('deprioritized'), question('unanswerable', ['garden'], { answerable: false })];
  const input = { tags: ['garden'], avoidTags: ['noise'], importantQuestionIds: ['important'], deprioritizeQuestionIds: ['deprioritized'] };
  const expected = ['important', 'deprioritized', 'positive', 'negative'];
  for (const catalog of [questions, [...questions].reverse()]) {
    const rows = recommendations(catalog, input);
    assert.deepEqual(rows.map(row => row.questionId), expected);
    assert.deepEqual(rows.map(row => row.suggestedVote), ['up', 'down', 'up', 'down']);
  }
});

test('equal relevance and vote direction preserve fallback order', () => {
  const questions = [question('down-first', ['avoid']), question('up-first', ['match']),
    question('up-second', ['match']), question('down-second', ['avoid'])];
  assert.deepEqual(recommendations(questions, { tags: ['match'], avoidTags: ['avoid'] }).map(row => row.questionId),
    ['up-first', 'up-second', 'down-first', 'down-second']);
});

test('untargeted recommendations preserve the eligible catalog order and output fields', () => {
  const rows = recommendations([question('first'), question('hidden', [], { answerable: false }), question('second')], {});
  assert.deepEqual(rows.map(row => row.questionId), ['first', 'second']);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['questionId', 'questionType', 'prompt', 'tags', 'suggestedVote', 'score', 'confidence', 'reason', 'agentNote', 'relevance'].sort());
});
