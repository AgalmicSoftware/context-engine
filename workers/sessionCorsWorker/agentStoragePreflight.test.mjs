import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimitFaucetSupportWithWorkerDeps } from './rateLimitFaucetSupportBinding.js';
import { fixture } from './agentTestFixture.mjs';
import { createRegistryLoginBootstrapAdaptersWithWorkerDeps } from './registryLoginBootstrapBinding.js';

// Agent uploads are participant writes: they must pass the same session-end,
// current-scope and rate-limit preflight as the public storage upload route.
const hostedFixture = (scopes, rateAllowed = () => true) => {
  const f = fixture({
    createRateLimitFaucetSupportWithWorkerDeps: args => ({
      ...createRateLimitFaucetSupportWithWorkerDeps(args), checkRateLimit: async input => rateAllowed(input),
    }),
    createRegistryLoginBootstrapAdaptersWithWorkerDeps: (args) => ({
      ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args),
      computeScopesForLogin: async () => ({ storage: scopes.storage, groups: true }),
    }),
  });
  f.withCoordinator();
  f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  return f;
};
const storedResponses = (f) => [...f.records.keys()].filter((key) => /responses/.test(key) && !/ce-agent:/.test(key)).length;

const createQuestion = async (f) => {
  const agent = await f.credential({ scopes: ['read_questions', 'pose_questions', 'draft_answers'] });
  await f.request('/api/agent/questions/create', {
    method: 'POST', token: agent.token, body: { questions: [{ prompt: 'Fixture statement', questionType: 'binary' }] },
  });
  const [question] = (await (await f.request('/api/agent/questions', { token: agent.token })).json()).questions;
  return { agent, question };
};
const submit = (f, agent, question) => f.request('/api/agent/preferences', {
  method: 'POST', token: agent.token,
  body: { preferences: [{ questionId: question.questionId, value: 'agree' }], submit: true, humanApproved: true },
});

test('agent submit stores nothing after the storage scope is withdrawn', async () => {
  const scopes = { storage: true };
  const f = hostedFixture(scopes);
  const { agent, question } = await createQuestion(f);
  scopes.storage = false;
  await submit(f, agent, question);
  assert.equal(storedResponses(f), 0);
});

test('agent submit stores nothing after the session has ended', async () => {
  const f = hostedFixture({ storage: true });
  const { agent, question } = await createQuestion(f);
  f.config.sessionEndsAt = '2026-01-01T00:00:00.000Z';
  await submit(f, agent, question);
  assert.equal(storedResponses(f), 0);
});

test('agent uploads enforce participant storage rate limits before storing an answer', async () => {
  let allowed = true, calls = 0;
  const f = hostedFixture({ storage: true }, input => { assert.equal(input.route, 'storage'); calls++; return allowed; });
  const { agent, question } = await createQuestion(f);
  const before = calls; allowed = false;
  const response = await submit(f, agent, question);
  assert.equal(response.status, 422);
  assert.equal(storedResponses(f), 0); assert.ok(calls > before);
});
