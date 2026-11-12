import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';
import { archiveAgentProposedQuestion, persistAgentProposedQuestion } from './agent/agentQuestionProposals.mjs';
import { createAgentStorage } from './agent/storage.mjs';

const session = { sessionId: SESSION_ID, sessionSlug: SLUG };
const answer = (questionID, value = 'Agree') => ({ questionID, answer: { value, encrypted: false }, ...session });
const sealed = { ciphertext: 'opaque', dataToEncryptHash: 'hash' };
const uploadSealed = async ({ env, token }) => readJson(await fetchWorker(makeRequest('/storage/upload', {
  method: 'POST',
  token,
  body: { data: sealed, contentType: 'application/json', resource: 'responses', encrypted: true },
}), env));

const setup = async ({ questions = ['q-a'], configOverrides } = {}) => {
  const created = createSessionEnv({ configOverrides });
  const adminToken = await login({ env: created.env, wallet: created.admin });
  for (const id of questions) {
    const stored = await uploadJson({ env: created.env, token: adminToken, resource: 'questions', data: { id, type: 'binary', prompt: `Agree with ${id}?`, ...session } });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
  }
  return { ...created, person: () => login({ env: created.env, wallet: Wallet.createRandom() }) };
};

// Stores rows until one is refused; returns how many were stored.
const fill = async (upload, most = 30) => {
  for (let row = 0; row < most; row += 1) {
    const stored = await upload(row);
    if (stored.status !== 200) {
      assert.equal(stored.body.reason, 'response_limit_rows', JSON.stringify(stored.body));
      return row;
    }
  }
  return most;
};

test('a session that reads its answers refuses one it cannot read', async () => {
  const { env, person } = await setup();
  const refused = await uploadSealed({ env, token: await person() });
  assert.equal(refused.status, 422, JSON.stringify(refused.body));
  assert.equal(refused.body.reason, 'response_unreadable');
});

test("a Lit session's sealed answers still count toward the row limit", async () => {
  const lit = { gate: 'none', encryption: 'lit' };
  const base = createSessionEnv().config;
  // Lit sessions keep no readable questions here, so the limit is the floor of five.
  const { env, person } = await setup({ questions: [], configOverrides: {
    storageProfile: { ...base.storageProfile, payloadAccessControl: lit },
    sessionModeProfile: { ...base.sessionModeProfile, storage: { backend: 'cloudflare', payloadAccessControl: lit } },
  } });
  const token = await person();
  assert.equal(await fill(() => uploadSealed({ env, token })), 5);
});

test("agents' proposed questions raise the row limit until archived", async () => {
  const { env, person } = await setup();
  const agentKv = { AGENT_ACTION_KV: createAgentStorage({ kv: env.GROUP_KV, sessionId: SESSION_ID }) };
  const proposed = await persistAgentProposedQuestion({ env: agentKv, sessionSlug: SLUG, prompt: 'Agents should vote?', questionType: 'binary' });
  assert.equal(proposed.ok, true, JSON.stringify(proposed));
  const token = await person();
  assert.equal(await fill((row) => uploadJson({ env, token, resource: 'responses', data: answer('q-a', row % 2 ? 'Agree' : 'Disagree') })), 10);

  await archiveAgentProposedQuestion({ env: agentKv, sessionSlug: SLUG, questionId: proposed.questionId });
  const next = await person();
  assert.equal(await fill(() => uploadJson({ env, token: next, resource: 'responses', data: answer('q-a') })), 5);
});

test('a bundle carries its answers in responses alone', async () => {
  const { env, person } = await setup({ questions: ['q-a', 'q-b'] });
  const token = await person();
  for (const extra of [{ questionID: 'q-made-up' }, { answer: { value: 'not checked' } }]) {
    const mixed = await uploadJson({ env, token, resource: 'responses', data: { surveyID: 's-1', ...session, responses: [answer('q-a')], ...extra } });
    assert.equal(mixed.status, 400, JSON.stringify(mixed.body));
  }
  const bundle = await uploadJson({ env, token, resource: 'responses', data: { surveyID: 's-1', ...session, responses: [answer('q-a'), answer('q-b')] } });
  assert.equal(bundle.status, 200, JSON.stringify(bundle.body));
});
