import { buildDraftEditMetricSummary } from './telegramDraftEditMetrics.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTelegramQuestionAnswerSchema, buildTelegramQuestionCard } from './questionUi.mjs';
import { __test__telegramMiniApp } from './telegramMiniApp.mjs';
import { canonicalAgentOnlyAnswerProjection, semanticFingerprintForAgentOnlyAnswer, __test__telegramAgentOnlyMode } from './telegramAgentOnlyMode.mjs';
import { __test__telegramAgentHandoff } from './telegramAgentHandoff.mjs';
import { buildTelegramResponsePayload } from './onChainResponses.mjs';

const question = { questionId: 'q1', questionType: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 25 };

test('quadratic schemas and cards retain the budget and option order', () => {
  const { answerSchema } = buildTelegramQuestionAnswerSchema(question);
  assert.deepEqual(answerSchema, { kind: 'quadratic', options: question.options, voiceCredits: 25 });
  const card = buildTelegramQuestionCard(question);
  assert.equal(card.questionType, 'quadratic');
  assert.equal(card.voiceCredits, 25);
  assert.ok(card.controls.some((control) => control.controlType === 'quadratic_allocation'));
});

test('Mini App and predicted agent answers enforce the same quadratic budget', () => {
  const schema = buildTelegramQuestionAnswerSchema(question).answerSchema;
  for (const value of [[3, -4], [0, 0]]) {
    assert.equal(__test__telegramMiniApp.normalizeMiniAnswer({ value }, question).ok, true);
    assert.equal(__test__telegramAgentOnlyMode.normalizeAnswerForSchema({ value }, schema).ok, true);
  }
  for (const value of [[5, -1], [1], ['3', -4], [1.5, 0], [Infinity, 0]]) {
    assert.equal(__test__telegramMiniApp.normalizeMiniAnswer({ value }, question).ok, false);
    assert.equal(__test__telegramAgentOnlyMode.normalizeAnswerForSchema({ value }, schema).ok, false);
  }
});

test('Telegram response payloads preserve signed values and reject overspending', () => {
  const answer = { questionType: 'quadratic', value: [3, -4] };
  const payload = buildTelegramResponsePayload({ questionRef: question, answer });
  assert.equal(payload.type, 'quadratic');
  assert.deepEqual(payload.answer.value, [3, -4]);
  assert.equal(payload.answer.hash, '');
  assert.throws(() => buildTelegramResponsePayload({ questionRef: question, answer: { ...answer, value: [4, -4] } }), /exceeds/);
});


test('agent fingerprints preserve the sign, position, and repeated neutral votes', async () => {
  const schema = buildTelegramQuestionAnswerSchema(question).answerSchema;
  assert.deepEqual(canonicalAgentOnlyAnswerProjection({ value: [0, 0] }, schema), { value: [0, 0] });
  assert.notEqual(await semanticFingerprintForAgentOnlyAnswer({ value: [3, -4] }, schema), await semanticFingerprintForAgentOnlyAnswer({ value: [-4, 3] }, schema));
});

test('Mini App results sum the latest allocation per respondent and omit locked questions', () => {
  const records = [
    { questionId: 'q1', telegramUserId: 'a', createdAt: '2026-01-01', answer: { value: [5, 0] } },
    { questionId: 'q1', telegramUserId: 'a', createdAt: '2026-01-02', answer: { value: [3, -4] } },
    { questionId: 'q1', telegramUserId: 'b', createdAt: '2026-01-02', answer: { value: [-2, 4] } },
    { questionId: 'q1', telegramUserId: 'c', createdAt: '2026-01-02', answer: { value: [5, 5] } },
  ];
  const rows = __test__telegramMiniApp.buildQuadraticResultRows(records, [question]);
  assert.equal(rows[0].totalResponders, 2);
  assert.equal(rows[0].excludedResponses, 1);
  assert.deepEqual(rows[0].options, [
    { label: 'Parks', positive: 3, negative: -2, net: 1 },
    { label: 'Transit', positive: 4, negative: -4, net: 0 },
  ]);
  assert.deepEqual(__test__telegramMiniApp.buildQuadraticResultRows(records, [{ ...question, locked: true }]), []);
});


test('agent handoff questions and drafts preserve custom budgets and numeric allocations', () => {
  assert.equal(__test__telegramAgentHandoff.publicAgentQuestion(question).voiceCredits, 25);
  const draft = __test__telegramAgentHandoff.normalizeDraftForQuestion({ value: [3, -4] }, question);
  assert.deepEqual(draft.value, { questionType: 'quadratic', value: [3, -4], comments: '' });
  assert.match(draft.label, /Parks: \+3; Transit: -4/);
  assert.equal(__test__telegramAgentHandoff.normalizeDraftForQuestion({ value: [4, -4] }, question), null);
});


test('draft metrics compare allocations positionally without storing the respondent votes', () => {
  const summary = buildDraftEditMetricSummary({ questionType: 'quadratic', draftAnswer: { value: [3, -4, 0] }, sentAnswer: { value: [-4, 3, 0] } });
  assert.equal(summary.answerChanged, true);
  assert.equal(summary.changedOptionCount, 2);
  assert.equal(summary.questionType, 'quadratic');
  assert.equal(Object.hasOwn(summary, 'values'), false);
  assert.equal(buildDraftEditMetricSummary({ questionType: 'quadratic_allocation', draftAnswer: { value: [0, 0] }, sentAnswer: { value: [0, 0] } }).answerChanged, false);
});
