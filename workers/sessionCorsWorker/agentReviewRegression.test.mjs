import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, wallet, origin, sessionId } from './agentTestFixture.mjs';
import { createRegistryLoginBootstrapAdaptersWithWorkerDeps } from './registryLoginBootstrapBinding.js';
import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';
import { questionMemoryCache } from './agent/registryQuestionCore.mjs';
import { cacheKey } from './agent/registryQuestionCache.mjs';
import { deriveManagedDemoAccount } from './agent/managedAccounts.mjs';
import { issueAgentCredential } from './agent/agentCredentials.mjs';
import { buildQueuedSubmitRecord, queueAgentSubmitRecord } from './agent/agentSubmitQueue.mjs';
import { ethers } from 'ethers';
import { buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';
import { loadWrappedStatements } from './agent/wrappedStatements.mjs';
test('warmRegistryCache', async () => {
  let allowed = true;
  const f = fixture({ fetch: async () => Response.json({ result: '0x64' }), createWorkerExecutionServicesWithWorkerDeps: args => ({ ...createWorkerExecutionServicesWithWorkerDeps(args), storageRoute: async () => allowed ? Response.json({ sessionSlug: 'fixture', questionType: 'binary', prompt: 'Private gated source text' }) : Response.json({}, { status: 403 }) }), createRegistryLoginBootstrapAdaptersWithWorkerDeps: args => ({
    ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args), computeScopesForLogin: async () => ({ storage: allowed }),
  }) });
  f.config.sessionModeProfile.authority.mode = 'registry_canonical';
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'sbt_gate', encryption: 'none' } };
  f.config.networkChainId = 11155420; f.config.contracts = { surveys: { address: '0x' + '1'.repeat(40) } };
  f.config.blockLimits = { start: 1, end: 100 }; f.env.DEFAULT_RPC_URL = 'https://rpc.example';
  const a = await f.credential();
  // Model a cache populated while the current caller passed storage admission.
  const key = cacheKey(`${sessionId}:1:${wallet.address}:fixture`);
  questionMemoryCache.set(key, { ok: true, complete: true, cachedAtMs: Date.now(), questionStorageBackend: 'cloudflare', indexedFromBlock: 1, indexedToBlock: 100, targetFromBlock: 1, targetToBlock: 100, questions: [{
    questionId: '0x' + '2'.repeat(64), sessionSlug: 'fixture', questionType: 'binary',
    prompt: 'Private gated source text', questionText: 'Private gated source text', visibility: 'public',
    storageRef: { backend: 'cloudflare', id: Buffer.alloc(32, 3).toString('base64url'), resource: 'questions' },
  }] });
  const before = await f.request('/api/agent/questions', { token: a.token });
  allowed = false;
  const after = await f.request('/api/agent/questions', { token: a.token });
  const body = await after.json();
  assert.equal(before.status, 200);
  assert.ok(!JSON.stringify(body).includes('Private gated source text'));
  questionMemoryCache.get(key).cachedAtMs = 1;
  const refreshed = await f.request('/api/agent/questions', { token: a.token });
  assert.equal(refreshed.status, 200, await refreshed.clone().text());
  assert.ok(!(await refreshed.text()).includes('Private gated source text'));
  questionMemoryCache.delete(key);
});

test('typedSubmissions', async () => {
  const f = fixture(); f.withCoordinator(); f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  f.config.agentHttp.managedAccountSubmitAllowed = true;
  const a = await f.credential({ scopes: ['read_questions', 'pose_questions', 'draft_answers'] });
  const create = await f.request('/api/agent/questions/create', { method: 'POST', token: a.token, body: { questions: [
    { prompt: 'Allocate fixture votes', questionType: 'quadratic', options: ['A', 'B'], voiceCredits: 9 },
    { prompt: 'Pick exactly one fixture', questionType: 'multichoice', options: ['A', 'B'], singleSelect: true },
  ] } });
  assert.equal(create.status, 200);
  const qs = (await (await f.request('/api/agent/questions', { token: a.token })).json()).questions;
  for (const [kind, answer] of [['quadratic', { value: [1, -1] }], ['multichoice', { values: ['not-an-option'] }], ['multichoice', { values: ['A', 'B'] }]]) {
    const response = await f.request('/api/agent/preferences', { method: 'POST', token: a.token, body: {
      preferences: [{ questionId: qs.find(q => q.questionType === kind).questionId, ...answer }], submit: true, humanApproved: true,
    } });
    const body = await response.json();
    if (kind === 'quadratic') { assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.submittedCount, 1); }
    else { assert.notEqual(body.submittedCount, 1); assert.equal(body.savedCount || 0, 0); }
  }
});

test('grantLostBeforeBroadcast', async () => {
  let allowed = true, uploads = 0, broadcasts = 0; const checks = [], messages = [];
  const f = fixture({
    createRegistryLoginBootstrapAdaptersWithWorkerDeps: args => ({ ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args),
      computeScopesForLogin: async () => { checks.push(allowed); return { storage: allowed, arweave: allowed }; } }),
    createWorkerExecutionServicesWithWorkerDeps: args => ({ ...createWorkerExecutionServicesWithWorkerDeps(args),
      storageRoute: async () => { uploads++; allowed = false; return Response.json({ id: Buffer.alloc(32, 3).toString('base64url'), backend: 'arweave' }); } }),
    fetch: async (_url, init) => {
      const rpc = JSON.parse(init.body);
      if (rpc.method === 'eth_sendRawTransaction') { broadcasts++; return Response.json({ result: ethers.keccak256(rpc.params[0]) }); }
      return Response.json({ result: { eth_chainId: '0xaa37dc', eth_getTransactionCount: '0x2', eth_gasPrice: '0x3b9aca00', eth_estimateGas: '0x186a0' }[rpc.method] });
    },
  });
  f.withCoordinator(); f.config.sessionModeProfile.authority.mode = 'registry_canonical'; f.config.networkChainId = 11155420;
  f.config.contracts = { surveys: { address: '0x' + '1'.repeat(40) } };
  f.config.agentHttp = { managedAccountSubmitAllowed: true, asyncSubmitEnabled: true };
  f.env.DEFAULT_RPC_URL = 'https://rpc.example';
  f.env.AGENT_RESPONSE_QUEUE = { send: async body => messages.push(body) }; f.agentEnv.AGENT_RESPONSE_QUEUE = f.env.AGENT_RESPONSE_QUEUE;
  const principal = { principalId: 'queue-review-fixture', kind: 'user', adapter: 'http' };
  const account = await deriveManagedDemoAccount({ principal, deploymentId: sessionId, rootSecret: f.env.AGENT_MANAGED_ROOT_SECRET });
  const c = await issueAgentCredential({ env: f.agentEnv, principal, credentialKind: 'user', sessionSlug: 'fixture', accountAddress: account.accountAddress, scopes: ['draft_answers'] });
  const record = buildQueuedSubmitRecord({ session: {}, baseRecord: {
    requestId: 'review-repro', idempotencyKey: 'review-repro', sessionId, sessionSlug: 'fixture', workerOrigin: origin,
    sourceCredentialHash: c.tokenHash, principalId: principal.principalId, accountAddress: account.accountAddress,
    authzEpoch: 1, telegramUserId: principal.principalId, questionId: '0x' + '2'.repeat(64),
    onChainAnswer: { value: 'Agree', questionType: 'binary' }, answer: { value: 'Agree' },
  } });
  questionMemoryCache.set(cacheKey(`${sessionId}:1:${account.accountAddress}:fixture`), { ok: true, complete: true, cachedAtMs: Date.now(), questions: [{ id: record.questionId, questionId: record.questionId, questionType: 'binary', sessionSlug: 'fixture', visibility: 'public', prompt: 'Fixture public question', storageRef: { backend: 'arweave', id: Buffer.alloc(32, 3).toString('base64url') } }] });
  await queueAgentSubmitRecord({ env: f.agentEnv, record });
  const result = await f.queue({ messages: [{ body: messages[0], attempts: 1, ack() {}, retry() {} }] });
  assert.equal(uploads, 1); assert.equal(broadcasts, 0); assert.ok(checks.includes(false));
  assert.equal(result.results[0].reconciliationRequired, false);
  assert.equal(result.results[0].retryable, false);
});

test('aggregateMembershipShape', async () => {
  const f = fixture({ createWorkerExecutionServicesWithWorkerDeps: args => ({ ...createWorkerExecutionServicesWithWorkerDeps(args), storageRoute: async () => Response.json({ items: [], listComplete: true }) }) }); f.config.sessionModeProfile.results = { visibility: 'session_member_aggregate' };
  f.env.CE_SESSION_COORDINATOR = { idFromName: n => n, get: () => ({ fetch: async url => {
    // Exact property name from SessionWriteCoordinator.executeWorkerGroupMemberships.
    if (url.endsWith('/worker-groups/memberships')) return Response.json({ ok: true, groups: [{ groupId: 'fixture-members', memberCount: 10 }] });
    throw new Error('Unexpected internal call');
  } }) };
  const a = await f.credential();
  const response = await f.request('/api/agent/results?view=consensus', { token: a.token });
  assert.equal(response.status, 200, await response.clone().text());
});

test('resultViewCacheGate', async () => {
  let storageReads = 0, allowed = true;
  const f = fixture({
    createRegistryLoginBootstrapAdaptersWithWorkerDeps: args => ({
      ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args), computeScopesForLogin: async () => ({ storage: true }),
    }),
    createWorkerExecutionServicesWithWorkerDeps: args => ({ ...createWorkerExecutionServicesWithWorkerDeps(args),
      storageRoute: async ({ path, request }) => { storageReads++;
        if (path === '/storage/list') return Response.json({ items: new URL(request.url).searchParams.get('resource') === 'questions' ? [{ storageRef: { backend: 'cloudflare', id: 'fixture-question', resource: 'questions' } }] : [], listComplete: true });
        return allowed ? Response.json({ id: 'fixture-question', sessionSlug: 'fixture', prompt: 'Private fixture source', questionType: 'binary' }) : Response.json({}, { status: 403 });
      },
    }),
  });
  f.config.sessionModeProfile.authority.mode = 'worker_canonical';
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'sbt_gate', encryption: 'none' } };
  const path = '/api/agent/result-view-cache';
  const input = { viewType: 'consensus', dataVersionKey: 'review-gated-data-v1', value: { label: 'Analysis of private gated source' },
    httpMethod: 'POST', action: 'result-view-cache', slug: 'fixture', sessionSlug: 'fixture', address: wallet.address,
    nonce: crypto.randomUUID(), audience: origin, expiration: Math.floor(Date.now() / 1000) + 120 };
  input.bodyHash = buildAdminActionBodyHash(input);
  const typed = buildAdminActionTypedData(input);
  input.signature = await wallet.signTypedData(typed.domain, { AdminAction: typed.types.AdminAction }, typed.message);
  const saved = await f.request(path, { method: 'POST', body: input });
  assert.equal(saved.status, 200, await saved.clone().text());
  const c = await issueAgentCredential({ env: f.agentEnv, principal: { principalId: 'unprivileged-result-reader', kind: 'user', adapter: 'http' },
    sessionSlug: 'fixture', accountAddress: new ethers.Wallet('0x' + '34'.repeat(32)).address, scopes: ['read_questions'], credentialKind: 'user' });
  allowed = false;
  const got = await f.request(`${path}?viewType=consensus&dataVersionKey=review-gated-data-v1`, { token: c.token });
  assert.equal(got.status, 200); const result = await got.json();
  assert.equal(result.cached, false); assert.ok(!JSON.stringify(result).includes(input.value.label)); assert.ok(storageReads > 0);
});

test('continuous statements follow current selection without shared writes', async () => {
  const f = fixture(); f.withCoordinator();
  const a = await f.credential({ scopes: ['read_questions', 'pose_questions'] });
  const created = await f.request('/api/agent/questions/create', { method: 'POST', token: a.token, body: {
    questions: [{ prompt: 'Historical fixture question', questionType: 'binary' }, { prompt: 'New current fixture question', questionType: 'freeform' }],
  } });
  assert.equal(created.status, 200, await created.clone().text());

  const qids = [...f.records.values()].map(v => { try { return JSON.parse(v); } catch { return {}; } }).filter(v => v.questionId && v.prompt).map(q => q.questionId);
  async function configure(id) {
    const response = await f.request('/api/agent/admin/agent-only/config', { method: 'POST', token: a.token,
      body: { questionSourceMode: 'agent_only_proposals', enabledQuestionIds: [id] } });
    assert.equal(response.status, 200, await response.clone().text());
  }
  await configure(qids[0]);
  const old = await loadWrappedStatements({ env: f.agentEnv, sessionSlug: 'fixture' });
  assert.equal(old.ok, true, JSON.stringify(old));
  await configure(qids[1]);
  const reread = await loadWrappedStatements({ env: f.agentEnv, sessionSlug: 'fixture' });
  assert.ok(old.space.statements.length > 0);
  assert.equal(reread.ok, true);
  assert.ok(reread.space.statements.every(statement => statement.text === 'New current fixture question'));
  assert.ok(![...f.records.keys()].some(key => key.includes('agent-mode-window')));
});
