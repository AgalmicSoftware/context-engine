import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAgentHttpRequest } from './agentHttp.mjs';
import { issueAgentCredential, AGENT_CREDENTIAL_DEFAULT_SCOPES, loadAgentCredential } from './agentCredentials.mjs';
import { createWorkerRuntime } from '../sessionCorsWorker/worker.js';
import { putSessionSecrets } from '../sessionCorsWorker/sessionConfigSecretsStore.js';
import { installSessionCoordinatorBinding, decodeTokenPayload } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { buildQuestionRecord, buildResponseRecord } from '../../mcp/lib/records.mjs';

const origin = 'https://client.example.test';
const workerOrigin = 'https://session.example.test';
const sessionId = `0x${'12'.repeat(16)}`;
const memoryKv = () => {
  const values = new Map();
  return { values, get: async key => values.get(key) ?? null,
    put: async (key, value) => values.set(key, value), delete: async key => values.delete(key),
    list: async ({ prefix = '' } = {}) => ({ keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
};

const fixture = async ({ kind = 'service', scopes = ['read_groups'], ttlSeconds = 5 * 60 * 60 } = {}) => {
  const config = { slug: 'fixture', sessionId, adminAddress: `0x${'a'.repeat(40)}`, allowOrigins: [origin],
    corsWorkerUrl: workerOrigin, scopes: { ai: true, arweave: true, groups: true }, ai: { model: 'gpt-4o-mini' },
    workerAuthority: { version: 1, participantScopes: ['ai', 'storage', 'groups'] },
    sessionModeProfile: {
      profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
      identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'none' }, surfaces: { web: true, telegram: false, miniApp: false, agentHttp: true, mcp: false, ceCc: false },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
      export: { scope: 'all_session' },
    },
    storageProfile: { type: 'session_storage_profile', version: 'session-storage-profile-v1', backend: 'cloudflare', sessionOwned: true,
      resources: { docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active' },
      payloadAccessControl: { gate: 'none', encryption: 'none', mode: 'public_read', enforcement: 'session_worker_public_read', litRequired: false } },
  };
  const kv = memoryKv();
  const workerEnv = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv,
    TOKEN_HMAC_SECRET: 'synthetic-client-login-key', CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), LOGIN_TRUSTED_ORIGINS: origin });
  await kv.put('session:fixture:config', JSON.stringify(config));
  await putSessionSecrets(workerEnv, 'fixture', { openaiKey: 'synthetic-provider-key' });
  const providerCalls = [];
  const worker = createWorkerRuntime(workerEnv, { fetch: async (url, init) => {
    assert.equal(new URL(url).origin, 'https://api.openai.com');
    providerCalls.push({ url, init });
    return Response.json({ choices: [{ message: { content: 'Fixture output' } }] });
  }, rpcFetch: async () => assert.fail('This fixture must not call a chain') });
  const workerCalls = [];
  const fetchImpl = (url, init) => {
    assert.equal(new URL(url).origin, workerOrigin);
    workerCalls.push(new URL(url).pathname);
    return worker.fetch(new Request(url, init), workerEnv);
  };
  const env = { AGENT_ACTION_KV: memoryKv(), DEMO_SIGNER_ROOT_SECRET: 'synthetic-agent-root',
    AGENT_BRIDGE_DEPLOYMENT_ID: 'fixture-deployment', AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: origin,
    AGENT_BRIDGE_WORKER_LOGIN_ORIGIN: origin, AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({ defaultSessionSlug: 'fixture', riskCeiling: 'submit', sessions: [{
      sessionSlug: 'fixture', sessionIdHex: sessionId, sessionWorkerUrl: workerOrigin,
      sessionModeProfile: config.sessionModeProfile, managedAccountSubmitAllowed: true,
    }] }) };
  const issued = await issueAgentCredential({ env, sessionSlug: 'fixture', credentialKind: kind, scopes, ttlSeconds,
    principal: { principalId: `fixture-${kind}`, kind, adapter: 'service' } });
  assert.equal(issued.ok, true);
  const exchange = () => handleAgentHttpRequest({ env, fetchImpl,
    request: new Request('https://bridge.example.test/api/agent/client-login/exchange', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ sessionSlug: 'fixture', token: issued.token }) }) });
  const workerRequest = (path, token, body) => fetchImpl(`${workerOrigin}${path}`, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Session-Slug': 'fixture' },
    body: JSON.stringify(body) });
  return { env, kv, issued, exchange, workerRequest, providerCalls, workerCalls };
};

test('read-groups service credentials cannot obtain or use Worker write or AI authority', async () => {
  assert.equal(AGENT_CREDENTIAL_DEFAULT_SCOPES.includes('session_login'), false);
  const f = await fixture();
  const response = await f.exchange();
  const body = await response.json();
  assert.equal(response.status, 403, body.reason || 'Exchange unexpectedly issued credentials');
  assert.equal(body.reason, 'agent_credential_session_login_denied');
  assert.equal(body.workerCredential, undefined);
  assert.equal(body.bridgeCredential, undefined);
  assert.deepEqual(f.workerCalls, [], 'Denied exchange must not sign the managed account into the Worker');
  for (const [path, payload] of [
    ['/storage/upload', { resource: 'questions', backend: 'cloudflare', data: {} }],
    ['/storage/upload', { resource: 'responses', backend: 'cloudflare', data: {} }],
    ['/ai', { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Fixture' }] }],
  ]) assert.equal((await f.workerRequest(path, f.issued.token, payload)).status, 401);
  for (const path of ['/questions/create', '/onboarding', '/agent-only/answers/bulk']) {
    const denied = await handleAgentHttpRequest({ env: f.env, fetchImpl: async () => assert.fail('No upstream call is authorized'),
      request: new Request(`https://bridge.example.test/api/agent${path}`, { method: 'POST',
        headers: { Authorization: `Bearer ${f.issued.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionSlug: 'fixture' }) }) });
    assert.equal(denied.status, 403, `${path}: ${await denied.text()}`);
  }
  assert.equal(f.providerCalls.length, 0);
  assert.equal([...f.kv.values.keys()].some(key => key.startsWith('ce-storage:')), false);
});

for (const kind of ['service', 'user']) test(`${kind} exchange with permitted session login reaches real Worker handlers`, async () => {
  const f = await fixture({ kind, scopes: kind === 'service' ? ['read_groups', 'session_login'] : ['read_groups'] });
  const response = await f.exchange();
  const body = await response.json();
  assert.equal(response.status, 200, body.reason);
  const token = body.workerCredential.token;
  const claims = decodeTokenPayload(token);
  assert.equal(claims.sub, body.accountAddress);
  assert.equal(claims.sessionId, sessionId);
  assert.ok(claims.exp * 1000 <= Date.parse(f.issued.record.expiresAt));
  const bridge = await loadAgentCredential({ env: f.env, token: body.bridgeCredential.token });
  assert.equal(bridge.ok, true);
  assert.ok(Date.parse(bridge.record.expiresAt) <= Date.parse(f.issued.record.expiresAt));
  const session = { sessionSlug: 'fixture', sessionId, sessionName: 'Fixture' };
  const question = buildQuestionRecord({ creator: body.accountAddress, type: 'binary', prompt: 'A synthetic policy question?', session });
  assert.equal(question.ok, true);
  const answer = buildResponseRecord({ question: question.record, value: 'Agree', responder: body.accountAddress, session });
  assert.equal(answer.ok, true);
  for (const [resource, data] of [['questions', question.record], ['responses', answer.record]]) {
    const uploaded = await f.workerRequest('/storage/upload', token, { backend: 'cloudflare', resource, data, contentType: 'application/json',
      tags: [{ name: 'CE-SessionId', value: sessionId }, { name: 'CE-SessionSlug', value: 'fixture' }, { name: 'CE-Resource', value: resource },
        { name: 'CE-ResourceId', value: question.id }], ...(resource === 'responses' ? { requestId: 'fixture-answer' } : {}) });
    assert.equal(uploaded.status, 200, await uploaded.text());
  }
  const ai = await f.workerRequest('/ai', token, { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Fixture' }] });
  assert.equal(ai.status, 200, await ai.text());
  assert.equal(f.providerCalls.length, 1);
});

for (const kind of ['service', 'user']) test(`${kind} exchange refuses a Worker token that outlives its source`, async () => {
  const f = await fixture({ kind, scopes: ['read_groups', 'session_login'], ttlSeconds: 60 * 60 });
  const response = await f.exchange();
  const body = await response.json();
  assert.equal(response.status, 403, body.reason || 'Exchange unexpectedly issued credentials');
  assert.equal(body.reason, 'agent_credential_expiry_too_short');
  assert.equal(body.workerCredential, undefined);
  assert.equal(body.bridgeCredential, undefined);
  assert.equal(f.providerCalls.length, 0);
});
