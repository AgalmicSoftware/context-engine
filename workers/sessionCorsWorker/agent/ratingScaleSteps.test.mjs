import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__sessionQuestions } from './sessionQuestions.mjs';
import { normalizeAgentRatingScale, normalizeAgentRatingAnswer } from './ratingScale.mjs';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';

test('stored steps survive long scales without changing submit validation', () => {
  const question = { type: 'rating', questionId: 'q1', scale: { min: 0, max: 100, step: 1 } };
  assert.deepEqual(normalizeAgentRatingScale(question), { min: 0, max: 100, step: 1 });
  assert.equal(normalizeAgentRatingAnswer(51, question), 51);
  const { answerSchema } = buildAgentQuestionAnswerSchema(question);
  assert.equal(answerSchema.step, 1);
  assert.ok(answerSchema.values.length <= 21);
  assert.ok(answerSchema.values.includes(100));
});
test('step and bounds come from the same metadata record', () => {
  const question = { scale: { step: 2 }, ratingScale: { min: 0, max: 10, step: 5 } };
  assert.deepEqual(normalizeAgentRatingScale(question), { min: 0, max: 10, step: 5 });
});
test('decimal and wider scales retain their trusted bounds and step', () => {
  const decimal = { scale: { min: -0.5, max: 0.5, step: 0.1 } };
  assert.deepEqual(normalizeAgentRatingScale(decimal), { min: -0.5, max: 0.5, step: 0.1 });
  assert.equal(normalizeAgentRatingAnswer(0.3, decimal), 0.3);
  assert.equal(normalizeAgentRatingAnswer(0.35, decimal), null);
  const wide = { scale: { min: 0, max: 1000, step: 10 } };
  assert.equal(normalizeAgentRatingAnswer(500, wide), 500);
});

test('cached questions retain the stored step used by cards and submits', () => {
  const qid = `0x${'ab'.repeat(32)}`;
  const normalized = __test__sessionQuestions.normalizeQuestionPayload({ id: qid, type: 'rating', scale: { min: 0, max: 100, step: 1 } });
  assert.equal(normalized.scale.step, 1);
});
