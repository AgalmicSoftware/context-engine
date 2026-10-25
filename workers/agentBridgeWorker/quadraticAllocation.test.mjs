import { buildDraftEditMetricSummary } from './agentDraftEditMetrics.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';
import { canonicalAgentOnlyAnswerProjection, semanticFingerprintForAgentOnlyAnswer, __test__agentOnlyMode } from './agentOnlyMode.mjs';
import { __test__agentHttp } from './agentHttp.mjs';
import { buildAgentResponsePayload } from './onChainResponses.mjs';

const question = { questionId: 'q1', questionType: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 25 };

test('quadratic schemas retain the budget and option order', () => {
  const { answerSchema } = buildAgentQuestionAnswerSchema(question);
  assert.deepEqual(answerSchema, { kind: 'quadratic', options: question.options, voiceCredits: 25 });
});

test('Predicted agent answers enforce the same quadratic budget', () => {
  const schema = buildAgentQuestionAnswerSchema(question).answerSchema;
  for (const value of [[3, -4], [0, 0]]) {
    assert.equal(__test__agentOnlyMode.normalizeAnswerForSchema({ value }, schema).ok, true);
  }
  for (const value of [[5, -1], [1], ['3', -4], [1.5, 0], [Infinity, 0]]) {
    assert.equal(__test__agentOnlyMode.normalizeAnswerForSchema({ value }, schema).ok, false);
  }
});

test('Telegram response payloads preserve signed values and reject overspending', () => {
  const answer = { questionType: 'quadratic', value: [3, -4] };
  const payload = buildAgentResponsePayload({ questionRef: question, answer });
  assert.equal(payload.type, 'quadratic');
  assert.deepEqual(payload.answer.value, [3, -4]);
  assert.equal(payload.answer.hash, '');
  assert.throws(() => buildAgentResponsePayload({ questionRef: question, answer: { ...answer, value: [4, -4] } }), /exceeds/);
});


test('agent fingerprints preserve the sign, position, and repeated neutral votes', async () => {
  const schema = buildAgentQuestionAnswerSchema(question).answerSchema;
  assert.deepEqual(canonicalAgentOnlyAnswerProjection({ value: [0, 0] }, schema), { value: [0, 0] });
  assert.notEqual(await semanticFingerprintForAgentOnlyAnswer({ value: [3, -4] }, schema), await semanticFingerprintForAgentOnlyAnswer({ value: [-4, 3] }, schema));
});


test('agent handoff questions and drafts preserve custom budgets and numeric allocations', () => {
  assert.equal(__test__agentHttp.publicAgentQuestion(question).voiceCredits, 25);
  const draft = __test__agentHttp.normalizeDraftForQuestion({ value: [3, -4] }, question);
  assert.deepEqual(draft.value, { questionType: 'quadratic', value: [3, -4], comments: '' });
  assert.match(draft.label, /Parks: \+3; Transit: -4/);
  assert.equal(__test__agentHttp.normalizeDraftForQuestion({ value: [4, -4] }, question), null);
});


test('draft metrics compare allocations positionally without storing the respondent votes', () => {
  const summary = buildDraftEditMetricSummary({ questionType: 'quadratic', draftAnswer: { value: [3, -4, 0] }, sentAnswer: { value: [-4, 3, 0] } });
  assert.equal(summary.answerChanged, true);
  assert.equal(summary.changedOptionCount, 2);
  assert.equal(summary.questionType, 'quadratic');
  assert.equal(Object.hasOwn(summary, 'values'), false);
  assert.equal(buildDraftEditMetricSummary({ questionType: 'quadratic_allocation', draftAnswer: { value: [0, 0] }, sentAnswer: { value: [0, 0] } }).answerChanged, false);
});
