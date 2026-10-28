import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../agentTestFixture.mjs';
import * as submitted from './submittedResults.mjs';
import { buildAgentPolisDataset } from './results.mjs';
import { buildParticipantGraph } from './participantResults.mjs';
import { canonicalAnswerSessionKvKey, persistAgentSubmitRecord, submitRequestSessionKvKey } from './agentSubmitQueue.mjs';
import { loadAgentQuestionAnswerState } from './questions.mjs';

const jsonOk = async response => {
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};
const current = records => submitted.selectCurrentSubmittedAnswers(records);
const answer = (overrides = {}) => ({
  sessionSlug: 'fixture', telegramUserId: 'participant', questionId: 'question',
  createdAt: '2026-10-28T00:00:00.000Z', requestId: 'first', label: 'Agree', ...overrides,
});

test('current answer selection orders revisions, timestamps, request ids and exact ties independently of input order', () => {
  const cases = [
    [answer(), answer({ requestId: 'second', label: 'Disagree' })],
    [answer({ requestId: 'z', answerRevision: 1 }), answer({ requestId: 'a', answerRevision: 2, label: 'Disagree' })],
    [answer({ requestId: 'z' }), answer({ requestId: 'a', createdAt: '2026-10-28T00:00:01.000Z', label: 'Disagree' })],
    [answer(), answer({ label: 'Disagree' })],
  ];
  for (const rows of cases) {
    assert.deepEqual(current(rows), [rows[1]]);
    assert.deepEqual(current([...rows].reverse()), current(rows));
  }
  const rows = [answer(), answer({ telegramUserId: 'other' }), answer({ sessionSlug: 'other' }),
    answer({ questionId: 'other' }), answer({ telegramUserId: '' }), answer({ telegramUserId: '' })];
  assert.equal(current(rows).length, rows.length, 'distinct scopes and anonymous records remain separate');
  assert.deepEqual(current([...rows].reverse()), current(rows));
});

test('revisions select within a participant question while selected answers stay chronological', () => {
  const selected = answer({ requestId: 'first', answerRevision: 3, createdAt: '2026-10-28T00:00:01.000Z' });
  const superseded = answer({ requestId: 'old', answerRevision: 2, createdAt: '2026-10-28T00:00:04.000Z' });
  const otherQuestion = answer({ questionId: 'other', requestId: 'a', answerRevision: 1, createdAt: '2026-10-28T00:00:02.000Z' });
  const otherParticipant = answer({ telegramUserId: 'other', requestId: 'b', createdAt: '2026-10-28T00:00:02.000Z' });
  const rows = [otherParticipant, superseded, otherQuestion, selected];
  const expected = [selected, otherQuestion, otherParticipant];
  assert.deepEqual(current(rows), expected);
  assert.deepEqual(current([...rows].reverse()), expected);
});

test('one current answer agrees across summary, Polis and participant graph', () => {
  const rows = [answer(), answer({ requestId: 'second', label: 'Disagree' })];
  const sourceQuestions = [{ questionId: 'question', questionType: 'binary', prompt: 'A fixture question' }];
  const sourceRecords = current(rows);
  const [summary] = submitted.summarizeQuestionResults(sourceRecords, sourceQuestions);
  assert.equal(summary.total, 1);
  assert.deepEqual(summary.counts, [['Disagree', 1]]);
  assert.equal(summary.hasDifference, false);
  const polis = buildAgentPolisDataset({ sourceRecords: rows, sourceQuestions });
  assert.equal(polis.responseCount, 1);
  assert.deepEqual(polis.responses.question.map(row => row.value), ['Disagree']);
  const graph = buildParticipantGraph(sourceRecords, sourceQuestions);
  assert.equal(graph.participantCount, 1);
  assert.deepEqual(graph.participants[0].answers, [{ question: 'Q1', label: 'Disagree' }]);
  const twoParticipants = current([...rows, answer({ telegramUserId: 'other' })]);
  const [twoSummary] = submitted.summarizeQuestionResults(twoParticipants, sourceQuestions);
  assert.equal(twoSummary.total, 2);
  assert.equal(twoSummary.participants, 2);
  assert.deepEqual(twoSummary.counts, [['Agree', 1], ['Disagree', 1]]);
  assert.equal(buildAgentPolisDataset({ sourceRecords: twoParticipants, sourceQuestions }).responseCount, 2);
  assert.equal(buildParticipantGraph(twoParticipants, sourceQuestions).participantCount, 2);

});

test('HTTP aggregates, topic map and answered state count current submissions while the history loader retains edits', async () => {
  const f = fixture(); f.withCoordinator(); f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  const agent = await f.credential({ scopes: ['read_questions', 'pose_questions', 'draft_answers'] });
  await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: agent.token,
    body: { questions: [{ prompt: 'Would a fixture garden help?', questionType: 'binary', tags: ['garden'] }] } }));
  const [question] = (await jsonOk(await f.request('/api/agent/questions', { token: agent.token }))).questions;
  for (const value of ['Agree', 'Disagree']) {
    const result = await jsonOk(await f.request('/api/agent/preferences', { method: 'POST', token: agent.token,
      body: { preferences: [{ questionId: question.questionId, value }], submit: true, humanApproved: true } }));
    assert.equal(result.submittedCount, 1);
  }
  for (const view of ['consensus', 'difference']) {
    const result = await jsonOk(await f.request(`/api/agent/results?view=${view}`, { token: agent.token }));
    assert.equal(result.responseCount, 1);
    assert.equal(result.questions[0].total, 1);
    assert.deepEqual(result.questions[0].counts, [{ label: 'Disagree', count: 1 }]);
    assert.equal(result.questions[0].hasDifference, false);
  }
  const topics = await jsonOk(await f.request('/api/agent/results?view=topic-map', { token: agent.token }));
  assert.equal(topics.counts.responses, 1);
  assert.equal((await submitted.loadSubmittedResultRecords(f.agentEnv, 'fixture')).length, 2);
});

test('the question answered state uses the same revision and request-id ordering', async () => {
  const f = fixture();
  const rows = [
    answer({ requestId: 'z-old', answerRevision: 1, createdAt: '2026-10-28T01:00:00Z' }),
    answer({ requestId: 'a-new', answerRevision: 2, label: 'Unsure' }),
    answer({ requestId: 'b-new', answerRevision: 2, label: 'Disagree' }),
  ];
  for (const record of rows) await persistAgentSubmitRecord({ env: f.agentEnv,
    record: { ...record, status: 'direct_submitted', answer: { label: record.label, value: record.label } } });
  const state = await loadAgentQuestionAnswerState({ env: f.agentEnv,
    context: { session: { sessionSlug: 'fixture' }, storageContext: { user: { telegramUserId: 'participant' } } },
    questions: [{ questionId: 'question', sessionSlug: 'fixture' }],
  });
  assert.equal(state.answeredCount, 1);
  assert.equal([...state.answeredByRef.values()][0].myAnswer.value, 'Disagree');
});

test('duplicate request copies prefer later timestamps regardless of answer revision', () => {
  const older = answer({ answerRevision: 9 });
  const newer = answer({ answerRevision: 1, createdAt: '2026-10-28T00:00:01.000Z', label: 'Disagree' });
  assert.deepEqual(submitted.dedupeSubmitRecords([older, newer]), [newer]);
  assert.deepEqual(submitted.dedupeSubmitRecords([newer, older]), [newer]);
});

test('a later-listed canonical copy survives a tied stale submission index', async () => {
  const f = fixture();
  const indexed = answer({ status: 'submit_queued', answer: { label: 'Disagree', value: 'Disagree' } });
  const canonical = { ...indexed, status: 'direct_submitted' };
  await f.agentEnv.AGENT_ACTION_KV.put(submitRequestSessionKvKey(indexed), JSON.stringify(indexed));
  await f.agentEnv.AGENT_ACTION_KV.put(canonicalAnswerSessionKvKey(canonical), JSON.stringify(canonical));
  const rows = await submitted.loadSubmittedResultRecords(f.agentEnv, 'fixture');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].requestId, canonical.requestId);
  assert.equal(rows[0].label, 'Disagree');
});
