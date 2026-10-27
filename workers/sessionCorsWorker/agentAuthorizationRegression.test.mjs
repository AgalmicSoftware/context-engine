import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, origin, sessionId, wallet } from './agentTestFixture.mjs';
import { buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';
import { rpcRequest } from './agent/registryQuestionSource.mjs';
import { createRegistryLoginBootstrapAdaptersWithWorkerDeps } from './registryLoginBootstrapBinding.js';

const denial = async (response, status, reason) => {
  assert.equal(response.status, status, await response.clone().text());
  assert.equal((await response.json()).reason, reason);
};
const signedBody = async (action, fields = {}, httpMethod = 'POST') => {
  const body = { action, httpMethod, ...fields, slug: 'fixture', sessionSlug: 'fixture', address: wallet.address,
    nonce: crypto.randomUUID(), audience: origin, expiration: Math.floor(Date.now() / 1000) + 120 };
  body.bodyHash = buildAdminActionBodyHash(body);
  const typed = buildAdminActionTypedData(body);
  body.signature = await wallet.signTypedData(typed.domain, { AdminAction: typed.types.AdminAction }, typed.message);
  return body;
};

test('dispatcher denies missing scopes and service login without session_login before writes', async () => {
  const f = fixture();
  const a = await f.credential({ scopes: ['read_questions'], kind: 'service' });
  const before = f.writes.length;
  await denial(await f.request('/api/agent/preferences', { method: 'POST', token: a.token, body: {} }), 403, 'agent_token_scope_denied');
  await denial(await f.request('/api/agent/client-login/exchange', { method: 'POST', body: { token: a.token } }), 403, 'agent_credential_session_login_denied');
  assert.equal(f.writes.length, before);
});

test('recommend-only credentials cannot auto-apply votes through either input spelling', async () => {
  const f = fixture();
  const a = await f.credential({ scopes: ['read_questions', 'recommend_question_votes'] });
  const before = f.writes.length;
  for (const body of [{ autoApply: true }, { applyMode: 'auto' }]) {
    await denial(await f.request('/api/agent/question-votes/recommend', { method: 'POST', token: a.token, body }), 403, 'agent_token_scope_denied');
  }
  assert.equal(f.writes.length, before);
});

for (const field of ['authzEpoch', 'sessionWorkerOrigin']) test(`dispatcher rejects stale credential ${field}`, async () => {
  const f = fixture(); const a = await f.credential();
  const key = `ce-agent:${sessionId}:agent:credential:v2:${a.tokenHash}`;
  const record = JSON.parse(f.records.get(key));
  record[field] = field === 'authzEpoch' ? 0 : 'https://other.example';
  f.records.set(key, JSON.stringify(record));
  const before = f.writes.length;
  await denial(await f.request('/api/agent/actions', { token: a.token }), 401, 'agent_credential_authority_stale');
  assert.equal(f.writes.length, before);
});

test('login gate loss during an internal authority refresh returns membership denial', async () => {
  let checks = 0;
  const f = fixture({ createRegistryLoginBootstrapAdaptersWithWorkerDeps: args => ({
    ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args),
    computeScopesForLogin: async () => {
      if (++checks > 1) throw new Error('Login gate not met');
      return { storage: true };
    },
  }) });
  const a = await f.credential();
  await denial(await f.request('/api/agent/client-login/exchange', { method: 'POST', body: { token: a.token } }), 403, 'agent_membership_denied');
});

test('signed writes ignore query inputs and bind the HTTP method before state changes', async () => {
  const f = fixture();
  const initial = await signedBody('admin/skill-update', { latestVersion: 'fixture-v1', note: 'Original' });
  assert.equal((await f.request('/api/agent/admin/skill-update', { method: 'POST', body: initial })).status, 200);
  const before = [...f.records];
  await denial(await f.request('/api/agent/admin/skill-update', { method: 'DELETE', body: initial }), 400, 'agent_signed_method_mismatch');
  assert.deepEqual([...f.records], before);
  const queued = await signedBody('question-queue', { questionIds: ['ceq_missing'] });
  const injected = await f.request('/api/agent/question-queue?clear=true', { method: 'POST', body: queued });
  assert.notEqual(injected.status, 200, 'Unsigned clear must not bypass invalid question validation');
  const update = await signedBody('admin/skill-update', { latestVersion: 'fixture-v2' });
  assert.equal((await f.request('/api/agent/admin/skill-update?note=injected', { method: 'POST', body: update })).status, 200);
  assert.ok(!JSON.stringify([...f.records]).includes('injected'));
});

test('registry RPC bounds body size and enforces the deadline after headers', async () => {
  await assert.rejects(rpcRequest({ rpcUrl: 'https://rpc.example', method: 'eth_call', timeoutMs: 20,
    fetchImpl: async () => new Response(new ReadableStream({ start() {} })),
  }), { reason: 'agent_provider_timeout' });
  await assert.rejects(rpcRequest({ rpcUrl: 'https://rpc.example', method: 'eth_call',
    fetchImpl: async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1)),
  }), { reason: 'agent_provider_response_too_large' });
});
