import { questionMemoryCache } from './agent/registryQuestionCore.mjs';
import { cacheKey } from './agent/registryQuestionCache.mjs';
import { createRegistryLoginBootstrapAdaptersWithWorkerDeps } from './registryLoginBootstrapBinding.js';
import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { fixture, sessionId, origin } from './agentTestFixture.mjs';
import { issueAgentCredential, revokeAgentCredentialHash } from './agent/agentCredentials.mjs';
import { deriveManagedDemoAccount } from './agent/managedAccounts.mjs';
import { buildQueuedSubmitRecord, queueAgentSubmitRecord, AGENT_SUBMIT_QUEUE_MESSAGE_TYPE } from './agent/agentSubmitQueue.mjs';
const questionId = '0x' + '2'.repeat(64);
const pointer = Buffer.alloc(32, 3).toString('base64url');

async function queuedFixture({ uncertain = false, uploadFailure = false } = {}) {
  let uploads = 0, broadcasts = 0;
  const messages = [];
  const f = fixture({
    createRegistryLoginBootstrapAdaptersWithWorkerDeps: args => ({ ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args), computeScopesForLogin: async () => ({ storage: true, arweave: true }) }),
    createWorkerExecutionServicesWithWorkerDeps: args => ({ ...createWorkerExecutionServicesWithWorkerDeps(args), storageRoute: async () => { uploads++; return uploadFailure ? Response.json({ error: 'retry' }, { status: 429, headers: { 'Retry-After': '120' } }) : Response.json({ id: pointer, backend: 'arweave', storageRef: { backend: 'arweave', id: pointer } }); } }),
    fetch: async (_url, init) => {
      const rpc = JSON.parse(init.body);
      if (rpc.method === 'eth_sendRawTransaction') { broadcasts++; if (uncertain) throw new Error('Fixture lost RPC response'); return Response.json({ result: ethers.keccak256(rpc.params[0]) }); }
      return Response.json({ result: { eth_chainId: '0xaa37dc', eth_getTransactionCount: '0x2', eth_gasPrice: '0x3b9aca00', eth_estimateGas: '0x186a0' }[rpc.method] });
    } });
  f.withCoordinator();
  f.config.sessionModeProfile.authority.mode = 'registry_canonical';
  f.config.networkChainId = 11155420;
  f.config.contracts = { surveys: { address: '0x1111111111111111111111111111111111111111' } };
  f.config.agentHttp = { managedAccountSubmitAllowed: true, asyncSubmitEnabled: true };
  f.env.DEFAULT_RPC_URL = 'https://rpc.example';
  f.env.AGENT_RESPONSE_QUEUE = { send: async body => messages.push(structuredClone(body)) };
  f.agentEnv.AGENT_RESPONSE_QUEUE = f.env.AGENT_RESPONSE_QUEUE;
  const principal = { principalId: 'queue-fixture-agent', kind: 'user', adapter: 'http' };
  const account = await deriveManagedDemoAccount({ principal, deploymentId: sessionId, rootSecret: f.env.AGENT_MANAGED_ROOT_SECRET });
  const credential = await issueAgentCredential({ env: f.agentEnv, principal, credentialKind: 'user', sessionSlug: 'fixture', accountAddress: account.accountAddress, scopes: ['draft_answers'] });
  assert.equal(credential.ok, true);
  questionMemoryCache.set(cacheKey(`${sessionId}:1:${account.accountAddress}:fixture`), { ok: true, complete: true, cachedAtMs: Date.now(), questions: [{
    id: questionId, questionId, questionType: 'binary', sessionSlug: 'fixture', prompt: 'Fixture choice', visibility: 'public',
    storageRef: { backend: 'arweave', id: pointer },
  }] });
  async function enqueue(id = 'fixture-request') {
    const record = buildQueuedSubmitRecord({ session: {}, baseRecord: { requestId: id, idempotencyKey: id, sessionId, sessionSlug: 'fixture',
      workerOrigin: origin, sourceCredentialHash: credential.tokenHash, principalId: principal.principalId, accountAddress: account.accountAddress,
      authzEpoch: 1, telegramUserId: principal.principalId, questionId, onChainAnswer: { value: 'Agree', questionType: 'binary' }, answer: { value: 'Agree' } } });
    assert.equal((await queueAgentSubmitRecord({ env: f.agentEnv, record })).ok, true);
    return messages.at(-1);
  }
  async function deliver(body, attempts = 1) {
    let acked = 0, delay;
    const result = await f.queue({ messages: [{ body, attempts, ack: () => acked++, retry: value => { delay = value.delaySeconds; } }] });
    return { result, acked, delay };
  }
  return { f, credential, enqueue, deliver, counts: () => ({ uploads, broadcasts }) };
}

test('registry queue uses current authority, deduplicates delivery and recovers a known result after revocation', async () => {
  const q = await queuedFixture(); const body = await q.enqueue();
  const first = await q.deliver(body); assert.equal(first.result.ok, true, JSON.stringify(first)); assert.equal(first.acked, 1);
  assert.deepEqual(q.counts(), { uploads: 1, broadcasts: 1 });
  assert.equal((await q.deliver(body)).result.ok, true); assert.deepEqual(q.counts(), { uploads: 1, broadcasts: 1 });
  const next = await q.enqueue('second-request');
  await revokeAgentCredentialHash({ env: q.f.agentEnv, tokenHash: q.credential.tokenHash });
  const denied = await q.deliver(next); assert.equal(denied.result.results[0].reason, 'queued_agent_credential_inactive'); assert.equal(denied.acked, 1);
  const key = `ce-agent:${sessionId}:telegram:submit-request:${body.record.requestId}`;
  const known = JSON.parse(q.f.records.get(key)); q.f.records.set(key, JSON.stringify({ ...known, status: 'direct_submit_reconciliation_required' }));
  const recovered = await q.deliver({ ...body, persistenceOnly: true, record: known });
  assert.equal(recovered.result.ok, true, JSON.stringify(recovered)); assert.equal(JSON.parse(q.f.records.get(key)).status, 'direct_submitted');
  assert.deepEqual(q.counts(), { uploads: 1, broadcasts: 1 });
});
test('unknown broadcast outcome keeps its hash and blocks blind queue retries', async () => {
  const q = await queuedFixture({ uncertain: true }); const body = await q.enqueue();
  const first = await q.deliver(body); assert.equal(first.result.results[0].reconciliationRequired, true, JSON.stringify(first));
  assert.equal(first.acked, 1); assert.equal(first.delay, undefined);
  assert.equal((await q.deliver(body)).result.results[0].reconciliationRequired, true);
  assert.deepEqual(q.counts(), { uploads: 1, broadcasts: 1 });
});
test('queue rejects foreign identity and malformed records without external effects', async () => {
  const q = await queuedFixture(); const body = await q.enqueue();
  for (const altered of [{ ...body, record: { ...body.record, sessionId: '0x' + '3'.repeat(32) } }, { type: 'unsupported', record: body.record },
    { type: AGENT_SUBMIT_QUEUE_MESSAGE_TYPE, record: {} }]) assert.equal((await q.deliver(altered)).acked, 1);
  assert.deepEqual(q.counts(), { uploads: 0, broadcasts: 0 });
});

test('publication failure retains the same generation and stale deliveries cannot overwrite it', async () => {
  const q = await queuedFixture(); const body = await q.enqueue();
  const key = `ce-agent:${sessionId}:telegram:submit-request:${body.record.requestId}`;
  const saved = q.f.records.get(key);
  q.f.agentEnv.AGENT_RESPONSE_QUEUE = { send: async () => { throw new Error('Fixture uncertain publication'); } };
  const { enqueueAgentSubmitRecord } = await import('./agent/agentSubmitQueue.mjs');
  await assert.rejects(enqueueAgentSubmitRecord({ env: q.f.agentEnv, record: body.record }));
  assert.equal(q.f.records.get(key), saved);
  const stale = await q.deliver({ ...body, record: { ...body.record, queueGeneration: 'older-generation' } });
  assert.equal(stale.result.results[0].reason, 'stale_submit_delivery'); assert.equal(q.f.records.get(key), saved);
  assert.deepEqual(q.counts(), { uploads: 0, broadcasts: 0 });
});
test('definite upload failures retry with backoff, then terminate at the fourth attempt', async () => {
  const q = await queuedFixture({ uploadFailure: true }); const body = await q.enqueue();
  const first = await q.deliver(body); assert.equal(first.result.results[0].retryable, true, JSON.stringify(first));
  assert.ok(first.delay >= 120); assert.equal(first.acked, 0);
  const last = await q.deliver(body, 4); assert.equal(last.result.results[0].retryable, false, JSON.stringify(last));
  assert.equal(last.acked, 1); assert.equal(q.counts().broadcasts, 0);
});

test('an unexpected queue failure retries instead of acknowledging an unprocessed submission', async () => {
  const q = await queuedFixture(); const body = await q.enqueue();
  Object.defineProperty(q.f.config.agentHttp, 'submitMaxAttempts', { configurable: true,
    get() { throw new Error('Fixture unexpected policy failure'); } });
  const failed = await q.deliver(body);
  assert.equal(failed.acked, 0);
  assert.ok(failed.delay >= 60);
  assert.equal(failed.result.results[0].retryable, true);
  assert.deepEqual(q.counts(), { uploads: 0, broadcasts: 0 });
  delete q.f.config.agentHttp.submitMaxAttempts;
  const retried = await q.deliver(body, 2);
  assert.equal(retried.result.ok, true, JSON.stringify(retried));
  assert.equal(retried.acked, 1);
  assert.deepEqual(q.counts(), { uploads: 1, broadcasts: 1 });
});
