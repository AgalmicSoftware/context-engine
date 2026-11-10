import test from 'node:test';
import assert from 'node:assert/strict';
import { answerScore, buildParticipantGraph } from './participantResults.mjs';
import { anonymizeAgentGroups } from './results.mjs';

const rating = { questionId: 'rating', questionType: 'rating', scale: { min: 0, max: 10 } };
const record = (participant, questionId, value, extra = {}) => ({
  telegramUserId: participant, questionId, label: String(value), value, ...extra,
});

test('JSON and image group projections contain the same permitted memberships', () => {
  const graph = buildParticipantGraph([
    record('first', 'binary', 'Agree'), record('second', 'binary', 'Agree'),
    record('third', 'binary', 'Disagree'),
  ], [{ questionId: 'binary', questionType: 'binary' }]);
  const projected = anonymizeAgentGroups(graph.groups, 2, graph.participants);
  assert.equal(projected.suppressedGroupCount, 1);
  assert.deepEqual(projected.groups.map(group => [group.groupId, group.size]), [['group-1', 2]]);
  assert.deepEqual(projected.participants?.map(participant => participant.participant), ['P1', 'P2']);
  assert.deepEqual(projected.imageGroups.map(group => group.aliases), [['P1', 'P2']]);
  assert.deepEqual(projected.imageGroups.map(group => [group.groupId, group.size]),
    projected.groups.map(group => [group.groupId, group.size]));
});

test('rating scores increase monotonically across the declared scale', () => {
  const scores = [3, 4, 5, 6, 7].map(value => answerScore('', value, rating));
  assert.ok(scores.every((score, index) => index === 0 || score > scores[index - 1]));
  assert.equal(answerScore('', 0, rating), -1);
  assert.equal(answerScore('', 10, rating), 1);
  assert.equal(answerScore('', 5, { type: 'rating', ratingScale: { min: 1, max: 5 } }), 1);
  for (const value of [-1, 11, 3.5, '', 'score 7', null, true]) assert.equal(answerScore('', value, rating), null);
  assert.equal(answerScore('', 0.5, { type: 'rating', scale: { min: 0, max: 1, step: 0.5 } }), 0);
});

test('only canonical binary answers have agreement scores', () => {
  for (const [label, expected] of [['Agree', 1], ['Disagree', -1], ['Unsure', 0]]) {
    assert.equal(answerScore(label, '', { type: 'binary' }), expected);
  }
  for (const questionType of ['multichoice', 'quadratic', 'freeform', 'unknown', '']) {
    for (const value of ['Yes', 'I oppose the support plan', '7']) {
      assert.equal(answerScore(value, value, { questionType }), null);
    }
  }
  assert.equal(answerScore('I agree with some of this', '', { type: 'binary' }), null);
});

test('participants rating six never rank below participants rating five on a zero-to-ten scale', () => {
  const graph = buildParticipantGraph([
    record('five-a', 'rating', 5), record('five-b', 'rating', 5),
    record('six-a', 'rating', 6), record('six-b', 'rating', 6),
  ], [rating], { clusterCount: 2 });
  assert.deepEqual(graph.groups[0].aliases, ['P3', 'P4']);
  assert.deepEqual(graph.groups[1].aliases, ['P1', 'P2']);
  assert.ok(graph.groups[0].averageScore > graph.groups[1].averageScore);
});

test('unscored answers stay qualitative and do not dilute group scores or vote counts', () => {
  const questions = [rating,
    { questionId: 'binary', questionType: 'binary' },
    { questionId: 'text', questionType: 'freeform' },
    { questionId: 'choice', questionType: 'multichoice', options: ['Yes', 'No'] },
  ];
  const graph = buildParticipantGraph([
    record('scored', 'rating', 7),
    record('scored', 'binary', 'Agree'),
    record('scored', 'text', 'support', { text: 'I oppose the support plan' }),
    record('scored', 'choice', 'Yes', { comments: 'A qualitative explanation' }),
    record('unscored', 'text', 'support', { text: 'More discussion, please' }),
    record('unscored', 'rating', 'invalid'),
    record('unscored', 'missing', 'Agree', { questionType: 'binary' }),
  ], questions, { clusterCount: 1 });
  const [group] = graph.groups;
  assert.equal(group.averageScore, 0.7);
  assert.equal(group.topStatements.length, 2);
  for (const statement of group.topStatements) {
    assert.equal(statement.cluster.responded, 1);
    assert.equal(statement.cluster.agree, 1);
    assert.equal(statement.cluster.unsure, 0);
  }
  assert.deepEqual(group.qualitativeResponses.map(response => response.text), [
    'I oppose the support plan', 'A qualitative explanation', 'More discussion, please',
  ]);
  assert.equal(graph.participantCount, 2);
});
