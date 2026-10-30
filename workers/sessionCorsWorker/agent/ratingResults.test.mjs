import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../agentTestFixture.mjs';
import { persistAgentSubmitRecord } from './agentSubmitQueue.mjs';
import { loadSubmittedResultRecords } from './submittedResults.mjs';
import { publicAgentQuestion } from './questions.mjs';
import { buildParticipantGraph } from './participantResults.mjs';
import { buildResultsImage } from './resultImage.mjs';

const jsonOk = async response => {
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};

for (const { scale, values, score } of [
  { scale: { min: 1, max: 5, step: 1 }, values: [5, 5, 1, 1], score: 1 },
  { scale: { min: 0, max: 2, step: 0.5 }, values: [1.5, 1.5, 0.5, 0.5], score: 0.5 },
]) test(`HTTP results retain ${scale.min}–${scale.max} step ${scale.step} ratings in JSON and image counts`, async () => {
  const f = fixture(); f.withCoordinator(); f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } };
  f.config.sessionModeProfile.results = { visibility: 'public_full_if_storage_public',
    exposure: { anonymizedGroupsEnabled: true, minGroupSize: 2 } };
  const agent = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  await jsonOk(await f.request('/api/agent/questions/create', { method: 'POST', token: agent.token,
    body: { questions: [{ prompt: 'Rate this fixture proposal.', questionType: 'rating', ratingScale: scale }] } }));
  const [question] = (await jsonOk(await f.request('/api/agent/questions', { token: agent.token }))).questions;
  for (const [index, value] of values.entries()) {
    await persistAgentSubmitRecord({ env: f.agentEnv, record: {
      sessionSlug: 'fixture', telegramUserId: `participant-${index}`, requestId: `request-${index}`,
      questionId: question.questionId, questionType: 'rating', createdAt: '2026-10-28T00:00:00.000Z',
      status: 'direct_submitted', answer: { label: String(value), value },
    } });
  }
  const result = await jsonOk(await f.request('/api/agent/results?view=groups', { token: agent.token }));
  assert.deepEqual(result.groups.map(group => [group.averageScore, group.size]), [[score, 2], [-score, 2]]);
  assert.equal(result.participantCount, 4);
  for (const [index, group] of result.groups.entries()) {
    const statement = group.topStatements[0];
    assert.deepEqual([statement.cluster.agree, statement.cluster.disagree, statement.cluster.unsure, statement.cluster.responded],
      index === 0 ? [2, 0, 0, 2] : [0, 2, 0, 2]);
    assert.deepEqual([statement.overall.agree, statement.overall.disagree, statement.overall.unsure, statement.overall.responded], [2, 2, 0, 4]);
  }
  const records = await loadSubmittedResultRecords(f.agentEnv, 'fixture');
  const graph = buildParticipantGraph(records, [{ ...question, scale }]);
  const expected = buildResultsImage({ mode: 'group', sessionTitle: 'fixture', responseCount: 4,
    participants: graph.participants, groups: graph.groups });
  const response = await f.request('/api/agent/results-image?view=groups', { token: agent.token });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(Buffer.compare(Buffer.from(await response.arrayBuffer()), expected.bytes), 0);
});

test('public rating questions carry normalized bounds and steps without leaking locked metadata', () => {
  const scale = { min: 1, max: 5, step: 0.5 };
  for (const metadata of [{ scale }, { ratingScale: scale }, scale]) {
    const question = publicAgentQuestion({ questionId: 'rating', questionType: 'rating', prompt: 'Fixture', ...metadata });
    assert.deepEqual(question.scale, { ...scale, minLabel: '1', maxLabel: '5' });
    assert.equal(publicAgentQuestion({ ...metadata, questionType: 'rating', locked: true }).scale, undefined);
  }
});
