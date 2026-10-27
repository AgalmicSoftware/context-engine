import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createAgentEnvironment } from './agent/authority.mjs';
import { createAgentServices } from './agent/services.mjs';
import { loadAgentCredentialHash } from './agent/agentCredentials.mjs';
import { fixture, enforceKvWriteLimit, sessionId, origin, wallet } from './agentTestFixture.mjs';
import { createRegistryLoginBootstrapAdaptersWithWorkerDeps } from './registryLoginBootstrapBinding.js';
import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';
import { questionMemoryCache } from './agent/registryQuestionCore.mjs';
import { cacheKey } from './agent/registryQuestionCache.mjs';
import { deriveManagedDemoAccount } from './agent/managedAccounts.mjs';
import { issueAgentCredential } from './agent/agentCredentials.mjs';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { submitAgentResponseOnChain } from './agent/onChainResponses.mjs';
import { SUBMITTED_RESULT_STATUSES } from './agent/agentSubmitQueue.mjs';

const pointer = Buffer.alloc(32, 3).toString('base64url');
const requestRecords = f => [...f.records.entries()].filter(([key]) => key.startsWith(`ce-agent:${sessionId}:telegram:submit-request:`)).map(([, value]) => JSON.parse(value));
const storedResponses = f => [...f.records.keys()].filter(key => /responses/.test(key) && !key.startsWith('ce-agent:')).length;
async function submissionFixture({ registry = false, queued = false } = {}) {
  const state = { revision: 1, uploads: 0, broadcasts: 0, rpcDown: false, bump: false, pending: false, payloads: [], messages: [], messageOptions: [] };
  let config;
  const f = fixture({
    readCurrentSessionConfig: async () => ({ config, revision: state.revision }),
    createRegistryLoginBootstrapAdaptersWithWorkerDeps: args => ({ ...createRegistryLoginBootstrapAdaptersWithWorkerDeps(args), computeScopesForLogin: async () => ({ storage: true, arweave: true, groups: true }) }),
    createWorkerExecutionServicesWithWorkerDeps: args => {
      const real = createWorkerExecutionServicesWithWorkerDeps(args);
      return { ...real, storageRoute: async input => {
        if (input.path !== '/storage/upload') return real.storageRoute(input);
        const payload = await input.request.clone().json();
        if (payload.resource !== 'responses') return real.storageRoute(input);
        state.uploads++; state.payloads.push(payload.data);
        if (state.pending) { state.pending = false; return Response.json({ reason: 'upload_in_progress' }, { status: 503 }); }
        const response = registry ? Response.json({ id: pointer, backend: 'arweave', storageRef: { backend: 'arweave', id: pointer } }) : await real.storageRoute(input);
        if (!registry && state.bump) { state.bump = false; state.revision++; }
        if (state.lostReply && response.ok) { state.lostReply = false; return Response.json({ reason: 'fixture_lost_reply' }, { status: 503 }); }
        return response;
      } };
    },
    fetch: async (_url, init) => {
      const rpc = JSON.parse(init.body);
      if (state.rpcDown) return new Response('Fixture RPC outage', { status: 503 });
      if (rpc.method === 'eth_sendRawTransaction') {
        state.broadcasts++;
        if (state.bump) { state.bump = false; state.revision++; }
        return Response.json({ result: ethers.keccak256(rpc.params[0]) });
      }
      return Response.json({ result: { eth_chainId: '0xaa37dc', eth_getTransactionCount: '0x2', eth_gasPrice: '0x3b9aca00', eth_estimateGas: '0x186a0' }[rpc.method] });
    },
  });
  config = f.config; const coordinated = f.withCoordinator();
  f.env.CE_STORAGE_INDEX_KV = f.env.GROUP_KV;
  f.config.storageProfile = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  f.config.agentHttp = { managedAccountSubmitAllowed: true, asyncSubmitEnabled: queued };
  let credential, qid;
  if (registry) {
    f.config.sessionModeProfile.authority.mode = 'registry_canonical';
    f.config.storageProfile.backend = 'arweave';
    f.config.networkChainId = 11155420;
    f.config.contracts = { surveys: { address: '0x' + '1'.repeat(40) } };
    f.env.DEFAULT_RPC_URL = 'https://rpc.example';
    f.env.AGENT_RESPONSE_QUEUE = { send: async (body, options) => { state.messages.push(structuredClone(body)); state.messageOptions.push(options); } };
    const principal = { principalId: `durability-${queued ? 'queue' : 'direct'}`, kind: 'user', adapter: 'http' };
    const account = await deriveManagedDemoAccount({ principal, deploymentId: sessionId, rootSecret: f.env.AGENT_MANAGED_ROOT_SECRET });
    credential = await issueAgentCredential({ env: f.agentEnv, principal, credentialKind: 'user', sessionSlug: 'fixture', accountAddress: account.accountAddress, scopes: ['read_questions', 'draft_answers'] });
    qid = '0x' + '2'.repeat(64);
    for (const revision of [1, 2]) questionMemoryCache.set(cacheKey(`${sessionId}:${revision}:${account.accountAddress}:fixture`), {
      ok: true, complete: true, cachedAtMs: Date.now(), questions: [{ id: qid, questionId: qid, questionType: 'binary', sessionSlug: 'fixture', prompt: 'Fixture statement', visibility: 'public', storageRef: { backend: 'arweave', id: pointer } }],
    });
  } else {
    credential = await f.credential({ scopes: ['read_questions', 'pose_questions', 'draft_answers'] });
    const made = await f.request('/api/agent/questions/create', { method: 'POST', token: credential.token, body: { questions: [{ prompt: 'Fixture statement', questionType: 'binary' }] } });
    assert.equal(made.status, 200, await made.clone().text());
    qid = (await (await f.request('/api/agent/questions', { token: credential.token })).json()).questions[0].questionId;
  }
  const submit = (extra = {}) => f.request('/api/agent/preferences', { method: 'POST', token: credential.token,
    body: { preferences: [{ questionId: qid, value: 'agree' }], submit: true, humanApproved: true, ...extra } });
  return { f, state, submit, coordinated, credential, qid, listQuestions: () => f.request('/api/agent/questions', { token: credential.token }) };
}

for (const registry of [false, true]) test(`direct ${registry ? 'registry' : 'hosted'} submission records a known outcome after the revision changes`, async () => {
  const { f, state, submit } = await submissionFixture({ registry });
  state.bump = true;
  const first = await submit(); assert.equal(first.status, 200, await first.clone().text());
  assert.equal(requestRecords(f)[0].status, 'direct_submitted');
  const retry = await submit(); assert.equal(retry.status, 200, await retry.clone().text());
  assert.equal((await retry.json()).submitted[0].replayed, true);
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, registry ? 1 : 0);
  if (!registry) assert.equal(storedResponses(f), 1);
});

test('RPC preparation failures retry the queue without another upload or uncertain broadcast', async () => {
  const { f, state, submit } = await submissionFixture({ registry: true, queued: true });
  state.rpcDown = true;
  assert.equal((await submit()).status, 200);
  const body = state.messages[0]; let delay;
  const first = await f.queue({ messages: [{ body, attempts: 1, ack() {}, retry: value => { delay = value.delaySeconds; } }] });
  assert.equal(first.results[0].retryable, true, JSON.stringify(first)); assert.ok(delay >= 60);
  assert.equal(first.results[0].reconciliationRequired, false);
  assert.equal(state.broadcasts, 0); assert.equal(state.uploads, 1);
  state.rpcDown = false;
  const retry = await f.queue({ messages: [{ body, attempts: 2, ack() {}, retry() { assert.fail('successful retry'); } }] });
  assert.equal(retry.ok, true, JSON.stringify(retry));
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, 1);
});

test('direct RPC preparation failures retry without duplicating the retained upload', async () => {
  const { f, state, submit } = await submissionFixture({ registry: true });
  state.rpcDown = true;
  const first = await submit(); assert.equal(first.status, 422);
  const failed = requestRecords(f)[0];
  assert.equal(failed.status, 'direct_submit_failed');
  assert.equal(failed.onChain.retryable, true);
  assert.equal(failed.onChain.reconciliationRequired, false);
  assert.equal(state.broadcasts, 0);
  state.rpcDown = false;
  const retry = await submit(); assert.equal(retry.status, 200, await retry.clone().text());
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, 1);
});

test('overlapping identical hosted submissions replay one durable success', async () => {
  const { f, state, submit } = await submissionFixture();
  let ready, release;
  const successReached = new Promise(resolve => { ready = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const put = f.env.GROUP_KV.put.bind(f.env.GROUP_KV);
  f.env.GROUP_KV.put = async (key, value, options) => {
    if (key.includes(':telegram:canonical-answer:v1:') && JSON.parse(value).status === 'direct_submitted') { ready(); await held; }
    return put(key, value, options);
  };
  const first = submit(); await successReached;
  await new Promise(resolve => setTimeout(resolve, 5));
  const second = submit(); await new Promise(resolve => setTimeout(resolve, 15)); release();
  for (const response of await Promise.all([first, second])) assert.equal(response.status, 200, await response.clone().text());
  assert.equal(storedResponses(f), 1); assert.equal(requestRecords(f)[0].status, 'direct_submitted');
  assert.ok(state.payloads.every(payload => JSON.stringify(payload) === JSON.stringify(state.payloads[0])));
});

test('hosted receipt in-progress is retryable and reuses the original payload timestamp', async () => {
  const { f, state, submit } = await submissionFixture();
  state.pending = true;
  const first = await submit(); const failure = await first.json();
  assert.equal(failure.skipped[0].retryable, true);
  assert.equal(requestRecords(f)[0].onChain.reconciliationRequired, false);
  const retry = await submit(); assert.equal(retry.status, 200, await retry.clone().text());
  assert.deepEqual(state.payloads[0], state.payloads[1]); assert.equal(storedResponses(f), 1);
});

test('disabled direct submission reports failure and is not counted as an answer', async () => {
  const { f, state, submit } = await submissionFixture();
  f.config.agentHttp.managedAccountSubmitAllowed = false;
  const response = await submit(); const body = await response.json();
  assert.equal(body.ok, false); assert.equal(body.submittedCount, 0); assert.equal(state.uploads, 0);
  assert.equal(body.skipped[0].reason, 'direct_submit_disabled');
  assert.ok(!SUBMITTED_RESULT_STATUSES.includes('submit_request_created'));
  assert.ok(requestRecords(f).every(record => !SUBMITTED_RESULT_STATUSES.includes(record.status)));
});


test('independent isolates share submission bytes and a late failed outcome cannot replace success', async () => {
  const { persistAgentSubmitRequest: submitA } = await import('./agent/answerSubmission.mjs?durability-isolate=a');
  const { persistAgentSubmitRequest: submitB } = await import('./agent/answerSubmission.mjs?durability-isolate=b');
  const f = fixture(); f.withCoordinator(); f.config.agentHttp.managedAccountSubmitAllowed = true;
  const credential = await f.credential();
  const loaded = await loadAgentCredentialHash({ env: f.agentEnv, tokenHash: credential.tokenHash });
  let releaseUploads, releaseSuccess;
  const bothUploads = new Promise(resolve => { releaseUploads = resolve; });
  const successPersisted = new Promise(resolve => { releaseSuccess = resolve; });
  const payloads = [];
  const environment = () => {
    const env = createAgentEnvironment({ env: f.env, config: f.config, revision: 1, slug: 'fixture', origin });
    env.AGENT_CONTEXT.address = wallet.address;
    env.AGENT_CONTEXT.auth = { delegation: loaded.record };
    const services = createAgentServices({ env: f.env, agentEnv: env, deps: {
      readCurrentSessionConfig: async () => ({ config: f.config, revision: 1 }),
      computeScopesForLogin: async () => ({ storage: true }),
    } });
    env.AGENT_SERVICES = { ...services,
      persistSubmitOutcome: async record => {
        const result = await services.persistSubmitOutcome(record);
        if (record.status === 'direct_submitted') releaseSuccess();
        return result;
      },
      storage: async (path, { body } = {}) => {
        if (path.startsWith('/storage/list')) return Response.json({ items: [{ storageRef: { backend: 'cloudflare', id: 'qref', resource: 'questions' }, metadata: {} }], listComplete: true });
        if (path.startsWith('/storage/read')) return Response.json({ questionId: 'ceq_fixture', sessionSlug: 'fixture', prompt: 'Fixture question', questionType: 'binary' });
        payloads.push(body.data);
        const index = payloads.length;
        if (index === 2) releaseUploads();
        await bothUploads;
        if (index === 2) {
          await successPersisted;
          return Response.json({ error: 'upload_in_progress' }, { status: 503 });
        }
        return Response.json({ id: 'stored', storageRef: { id: 'stored', backend: 'cloudflare' } });
      },
    };
    return env;
  };
  const args = savedAt => ({ normalized: { user: { telegramUserId: 'fixture-principal' }, chat: {} }, sessionSlug: 'fixture', selectedQuestionId: 'ceq_fixture',
    draft: { status: 'draft_saved', sessionSlug: 'fixture', questionId: 'ceq_fixture', answerLabel: 'Agree', answerValue: '"Agree"', controlType: 'agree_unsure_disagree', origin: { savedAt }, selectedAt: savedAt } });
  const results = await Promise.all([
    submitA({ env: environment(), ...args('2026-01-01T00:00:00.001Z'), createdAt: '2026-10-27T12:00:00.001Z' }),
    submitB({ env: environment(), ...args('2026-01-01T00:00:00.002Z'), createdAt: '2026-10-27T12:00:00.002Z' }),
  ]);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.ok(results.every(result => result.ok && result.status === 'direct_submitted'), JSON.stringify(results));
  const stored = [...f.records.values()].map(value => JSON.parse(value)).filter(record => record.onChain);
  assert.equal(stored.length, 5);
  assert.ok(stored.every(record => record.status === 'direct_submitted'));
  const record = requestRecords(f)[0];
  assert.equal(record.draftProvenance.submittedAt, record.createdAt);
  assert.ok(record.draftProvenance.draftToSubmitMs > 0);
  assert.ok(Date.parse(record.createdAt) > Date.parse(record.draftProvenance.origin.savedAt));
});


for (const registry of [false, true]) test(`coordinator repairs a partial ${registry ? 'registry' : 'hosted'} outcome projection after one second without repeating effects`, async () => {
  const { f, state, submit, coordinated } = await submissionFixture({ registry });
  let time = Date.now(), fail = true;
  coordinated.coordinator.now = () => time;
  const put = f.env.GROUP_KV.put.bind(f.env.GROUP_KV);
  f.env.GROUP_KV.put = async (key, value, options) => {
    if (fail && key.includes(':telegram:submit-request:') && JSON.parse(value).status === 'direct_submitted') {
      fail = false; throw new Error('Fixture projection unavailable');
    }
    return put(key, value, options);
  };
  const limited = enforceKvWriteLimit(f.env.GROUP_KV, () => time);
  const response = await submit();
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(requestRecords(f).length, 0);
  const journal = [...coordinated.durable.entries()].find(([key]) => key.startsWith('ce-agent-submit:'))[1];
  assert.equal(journal.status, 'direct_submitted');
  assert.equal(journal.kvProjection.pending, true);
  assert.equal(await coordinated.storage.getAlarm(), time + 1000);
  const beforeRepair = limited.writes.length;
  // Simulate an isolate restart. No queue binding or repeated user request is needed.
  const restarted = new SessionWriteCoordinator({ storage: coordinated.storage }, f.env, { now: () => time });
  time += 999;
  await restarted.alarm();
  assert.equal(limited.writes.length, beforeRepair, 'repair must not wait or write before its due time');
  time += 1;
  await restarted.alarm();
  assert.equal(requestRecords(f)[0].status, 'direct_submitted');
  assert.deepEqual(limited.rejected, []);
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, registry ? 1 : 0);
  assert.ok(![...coordinated.durable.keys()].some(key => key.startsWith('ce-agent-submit-projection:')));
});

for (const registry of [false, true]) test(`failed durable ${registry ? 'registry' : 'hosted'} admission retries with no prior effect`, async () => {
  const { f, state, submit, coordinated } = await submissionFixture({ registry });
  const put = coordinated.storage.put;
  let fail = true;
  coordinated.storage.put = async (key, value) => {
    if (fail && key.startsWith('ce-agent-submit:') && value.onChain?.stage === 'admitted') {
      fail = false; throw new Error('Fixture durable intent unavailable');
    }
    return put(key, value);
  };
  assert.equal((await submit()).status, 422);
  assert.equal(state.uploads, 0); assert.equal(state.broadcasts, 0);
  const retried = await submit();
  assert.equal(retried.status, 200, await retried.clone().text());
  assert.equal(requestRecords(f)[0].status, 'direct_submitted');
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, registry ? 1 : 0);
});


test('a lost hosted reply replays the exact stored payload after a question prompt edit', async () => {
  const { f, state, submit, listQuestions, coordinated } = await submissionFixture();
  assert.equal((await (await listQuestions()).json()).questions[0].prompt, 'Fixture statement');
  state.lostReply = true;
  assert.equal((await submit()).status, 422);
  assert.equal(storedResponses(f), 1);
  const editedPrompt = 'Edited fixture question';
  // The proposal is this fixture's authoritative question source. Change it,
  // and prove the public reader sees the edit before attempting receipt replay.
  for (const [key, value] of f.records) if (key.includes(':telegram:proposed-question:')) {
    f.records.set(key, JSON.stringify({ ...JSON.parse(value), prompt: editedPrompt }));
  }
  assert.equal((await (await listQuestions()).json()).questions[0].prompt, editedPrompt);
  const retried = await submit();
  assert.equal(retried.status, 200, await retried.clone().text());
  assert.equal(state.uploads, 2);
  assert.deepEqual(state.payloads[0], state.payloads[1]);
  assert.equal(storedResponses(f), 1);
  coordinated.coordinator.now = () => Date.now() + 1000;
  await coordinated.coordinator.alarm();
  assert.equal(requestRecords(f)[0].status, 'direct_submitted');
});


for (const registry of [false, true]) test(`a lost ${registry ? 'registry' : 'hosted'} admission reply does not strand a request before effects`, async () => {
  const { f, state, submit } = await submissionFixture({ registry });
  const get = f.env.CE_SESSION_COORDINATOR.get;
  let lose = true;
  f.env.CE_SESSION_COORDINATOR.get = id => {
    const stub = get(id);
    return { fetch: async (url, init) => {
      const response = await stub.fetch(url, init);
      if (lose && url.endsWith('/agent-submit/begin') && response.ok) {
        lose = false; return Response.json({ ok: false, reason: 'fixture_lost_admission_reply' }, { status: 503 });
      }
      return response;
    } };
  };
  assert.equal((await submit()).status, 422);
  assert.equal(state.uploads, 0); assert.equal(state.broadcasts, 0);
  const retried = await submit();
  assert.equal(retried.status, 200, await retried.clone().text());
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, registry ? 1 : 0);
});

for (const registry of [false, true]) test(`fast ${registry ? 'registry' : 'hosted'} submits succeed with one KV write per key per second`, async () => {
  const { f, state, submit, coordinated } = await submissionFixture({ registry });
  const time = Date.now();
  coordinated.coordinator.now = () => time;
  const limited = enforceKvWriteLimit(f.env.GROUP_KV, () => time);
  const response = await submit();
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, registry ? 1 : 0);
  assert.equal(requestRecords(f)[0].status, 'direct_submitted');
  assert.deepEqual(limited.rejected, []);
  const projections = limited.writes.filter(({ key }) => /:(canonical-answer|canonical-answer-by-session|submit-request|submit-request-by-session|submit-request-by-user):/.test(key));
  assert.equal(projections.length, 5, 'only the finished outcome is projected');
});

for (const supplied of ['2031-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', 'query']) test(`submission provenance ignores caller createdAt: ${supplied}`, async () => {
  const { f, state, submit, credential, qid } = await submissionFixture();
  const before = Date.now();
  const response = supplied === 'query'
    ? await f.request('/api/agent/preferences?createdAt=2031-01-01T00%3A00%3A00.000Z', { method: 'POST', token: credential.token,
      body: { preferences: [{ questionId: qid, value: 'agree' }], submit: true, humanApproved: true } })
    : await submit({ createdAt: supplied });
  const after = Date.now();
  assert.equal(response.status, 200, await response.clone().text());
  const record = requestRecords(f)[0];
  assert.ok(Date.parse(record.createdAt) >= before && Date.parse(record.createdAt) <= after);
  assert.equal(state.payloads[0].timeStamp, Date.parse(record.createdAt));
  assert.equal(record.draftProvenance.submittedAt, record.createdAt);
  assert.ok(Date.parse(record.draftProvenance.origin.savedAt) >= before && Date.parse(record.draftProvenance.origin.savedAt) <= after);
  assert.ok(record.draftProvenance.draftToSubmitMs >= 0 && record.draftProvenance.draftToSubmitMs <= after - before);
});

test('a lost re-admission reply retains an uploaded registry payload through cleanup and retry', async () => {
  const { f, state, submit, coordinated } = await submissionFixture({ registry: true });
  state.rpcDown = true;
  assert.equal((await submit()).status, 422);
  const saved = requestRecords(f)[0];
  assert.equal(saved.onChain.storageId, pointer);
  const get = f.env.CE_SESSION_COORDINATOR.get;
  let lose = true;
  f.env.CE_SESSION_COORDINATOR.get = id => {
    const stub = get(id);
    return { fetch: async (url, init) => {
      const response = await stub.fetch(url, init);
      if (lose && url.endsWith('/agent-submit/begin') && response.ok) {
        lose = false; return Response.json({ ok: false, reason: 'fixture_lost_readmission_reply' }, { status: 503 });
      }
      return response;
    } };
  };
  assert.equal((await submit()).status, 422);
  const retained = [...coordinated.durable.entries()].find(([key]) => key.startsWith('ce-agent-submit:'))[1];
  assert.equal(retained.onChain.storageId, pointer);
  state.rpcDown = false;
  const response = await submit();
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, 1);
});


for (const registry of [false, true]) test(`invalid ${registry ? 'registry' : 'hosted'} payloads fail before admission`, async () => {
  let admissions = 0, effects = 0;
  const env = { AGENT_DIRECT_SUBMIT_ENABLED: 'true', DEFAULT_RPC_URL: 'https://rpc.example',
    AGENT_CONTEXT: { address: wallet.address, sessionId, origin, config: { agentHttp: { managedAccountSubmitAllowed: true } } },
    AGENT_SERVICES: { current: async () => ({}), upload: async () => { effects++; throw new Error('Unexpected upload'); } } };
  const session = { sessionSlug: 'fixture', managedAccountSubmitAllowed: true, corsWorkerUrl: origin, surveysAddress: '0x' + '1'.repeat(40),
    networkChainId: 11155420, contracts: { surveys: { address: '0x' + '1'.repeat(40) } },
    sessionModeProfile: { authority: { mode: registry ? 'registry_canonical' : 'worker_canonical' } } };
  for (const question of [
    { questionType: 'rating', ratingMin: 1, ratingMax: 5 },
    { questionType: 'multichoice', options: ['First', 'Second'], maxSelections: 1 },
    { questionType: 'quadratic', options: ['First', 'Second'], quadraticBudget: 9 },
  ]) {
    const result = await submitAgentResponseOnChain({ env, session, account: { accountAddress: wallet.address },
      questionRef: { ...question, questionId: '0x' + '2'.repeat(64) }, answer: { value: 'invalid' }, idempotencyKey: 'invalid-payload',
      beforeUpload: async () => { admissions++; }, fetchImpl: async () => { effects++; throw new Error('Unexpected fetch'); } });
    assert.equal(result.retryable, false, JSON.stringify(result));
    assert.equal(result.status, 422, JSON.stringify(result));
    assert.equal(result.ok, false);
  }
  assert.equal(admissions, 0); assert.equal(effects, 0);
});

test('a queued answer made invalid by a schema edit fails permanently before admission', async () => {
  const { f, state, submit, qid, coordinated } = await submissionFixture({ registry: true, queued: true });
  assert.equal((await submit()).status, 200);
  for (const cached of questionMemoryCache.values()) {
    const question = cached.questions?.find(row => row.questionId === qid);
    if (question) Object.assign(question, { questionType: 'multichoice', options: ['First', 'Second'], maxSelections: 1 });
  }
  let acked = 0;
  const result = await f.queue({ messages: [{ body: state.messages[0], attempts: 1, ack: () => { acked++; },
    retry: () => assert.fail('invalid payload must not retry') }] });
  assert.equal(result.results[0].retryable, false, JSON.stringify(result));
  assert.equal(result.results[0].reason, 'multichoice_answer_invalid');
  assert.equal(acked, 1); assert.equal(state.uploads, 0); assert.equal(state.broadcasts, 0);
  assert.equal([...coordinated.durable.keys()].filter(key => key.startsWith('ce-agent-submit:')).length, 0);
  assert.ok(requestRecords(f).every(record => !SUBMITTED_RESULT_STATUSES.includes(record.status)));
});


test('a queued broadcast stays successful when KV projection is rate limited and repairs without repeating effects', async () => {
  const { f, state, submit } = await submissionFixture({ registry: true, queued: true });
  let time = Date.now();
  const limited = enforceKvWriteLimit(f.env.GROUP_KV, () => time);
  assert.equal((await submit()).status, 200);
  const delivery = state.messages[0];
  time += 1000;
  const consume = body => f.queue({ messages: [{ body, attempts: 1, ack() {}, retry: () => assert.fail('known success must not retry effects') }] });
  const finished = await consume(delivery);
  assert.equal(finished.ok, true, JSON.stringify(finished));
  assert.equal(finished.results[0].status, 'direct_submitted');
  assert.equal(finished.results[0].reconciliationRequired, false);
  assert.equal(finished.results[0].projectionPending, true);
  assert.ok(limited.rejected.length > 0, 'the test must exercise the per-key KV limit');
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, 1);
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[1].persistenceOnly, true);
  assert.ok(state.messageOptions[1].delaySeconds >= 1);
  time += state.messageOptions[1].delaySeconds * 1000;
  assert.equal((await consume(state.messages[1])).ok, true);
  assert.equal(requestRecords(f)[0].status, 'direct_submitted');
  assert.equal((await consume(delivery)).ok, true);
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, 1);
});


test('a queued success does not claim durable repair when both KV and the recovery queue fail', async () => {
  const { f, state, submit } = await submissionFixture({ registry: true, queued: true });
  let time = Date.now();
  enforceKvWriteLimit(f.env.GROUP_KV, () => time);
  assert.equal((await submit()).status, 200);
  time += 1000;
  f.env.AGENT_RESPONSE_QUEUE.send = async () => { throw new Error('Fixture recovery queue unavailable'); };
  const result = await f.queue({ messages: [{ body: state.messages[0], attempts: 1, ack() {}, retry() {} }] });
  assert.equal(result.ok, false);
  assert.equal(result.results[0].persistenceOnlyQueued, false);
  assert.equal(result.results[0].reason, 'submit_result_persistence_failed');
  assert.equal(result.results[0].onChain.ok, true, 'the known effect is still retained in the diagnostic outcome');
  assert.equal(state.uploads, 1); assert.equal(state.broadcasts, 1);
});
