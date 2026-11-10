import test from 'node:test';
import assert from 'node:assert/strict';
import { ratingConformance } from '../../../shared/questions/ratingConformance.mjs';
import { normalizeDraftForQuestion } from './participation.mjs';
import { buildAgentResponsePayload } from './onChainResponses.mjs';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';
import { normalizeAnswerForSchema, ratingValuesFromSchema } from './wrappedAnswers.mjs';

for (const { name, scale, input, expected } of ratingConformance) {
  const question = { questionId: 'q-rating', type: 'rating', questionType: 'rating', scale };
  test(`agent HTTP drafts and submission: ${name}`, () => {
    const draft = normalizeDraftForQuestion({ value: input }, question);
    assert.equal(draft?.value.value ?? null, expected);
    const submit = () => buildAgentResponsePayload({ questionRef: question, answer: { value: input } });
    if (expected === null) assert.throws(submit, /rating_answer_invalid/);
    else assert.equal(submit().answer.value, expected);
  });
  test(`Wrapped rating: ${name}`, () => {
    const schema = buildAgentQuestionAnswerSchema(question).answerSchema;
    assert.ok(schema.values.length <= 21);
    const result = normalizeAnswerForSchema({ value: input }, schema);
    assert.equal(result.ok, expected !== null);
    if (result.ok) assert.equal(result.answer.value, expected);
  });
}

test('Wrapped suggestions preserve fractional bounds and steps', () => {
  assert.deepEqual(ratingValuesFromSchema({ min: -0.5, max: 0.5, step: 0.1 }),
    [-0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.deepEqual(ratingValuesFromSchema({ min: 0.1, max: 0.3, step: 0.1 }), [0.1, 0.2, 0.3]);
  assert.equal(normalizeAnswerForSchema({ value: 'no' }, { kind: 'choice', values: ['yes', 'no'] }).answer.value, 'no');
});
