import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import worker from './worker.js';
import { persistAgentSubmitRequest } from './agentSessionRuntime.mjs';
import { __test__sessionQuestions } from './sessionQuestions.mjs';
import {
  buildQueuedSubmitRecord, processAgentSubmitQueueBatch, queueAgentSubmitRecord,
  submitRequestKvKey, SUBMITTED_RESULT_STATUSES,
  SUBMIT_QUEUE_MAX_ATTEMPTS,
} from './agentSubmitQueue.mjs';

const QID = `0x${'ab'.repeat(32)}`;
const STORAGE_ID = Buffer.alloc(32, 9).toString('base64url');
class MemoryKv {
  store = new Map();
  failPut = false;
  miss = false;
  async get(key) { return this.miss ? null : this.store.get(key) ?? null; }
  async put(key, value) { if (this.failPut) throw new Error('KV unavailable'); this.store.set(key, value); }
  async list({ prefix = '' } = {}) { return { list_complete: true, keys: [...this.store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; }
}
function fixture() {
  return buildQueuedSubmitRecord({
    session: { sessionSlug: 'alpha', managedAccountSubmitAllowed: true, sessionWorkerUrl: 'https://worker.example', surveysAddress: '0x1111111111111111111111111111111111111111', chainId: 11155420 },
    baseRecord: { requestId: 'recovery-fixture', idempotencyKey: 'recovery-idem', telegramUserId: '42', sessionSlug: 'alpha', questionId: QID,
      onChainAnswer: { questionType: 'freeform', value: 'Approved answer' }, createdAt: '2026-01-01T00:00:00.000Z' },
  });
}
function harness({ fault = '' } = {}) {
  const kv = new MemoryKv();
  const sent = [];
  const calls = [];
  const uploads = [];
  const hashes = [];
  const state = { fault, now: 0, nonces: 0 };
  const env = {
    AGENT_ACTION_KV: kv, AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED: 'true',
    AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'true', DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy', DEFAULT_RPC_URL: 'https://rpc.example',
    AGENT_RESPONSE_QUEUE: { send: async (body, options) => { sent.push({ body, options }); } },
    AGENT_BRIDGE_FETCH: async (url, init) => {
      calls.push(url);
      if (url.endsWith('/auth/nonce')) {
        if (state.fault === 'nonce-503') return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
        if (state.fault === 'nonce-limit' && state.now < 60 && ++state.nonces > 5) return Response.json({ error: 'nonce rate limit' }, { status: 429, headers: { 'Retry-After': '60' } });
        return Response.json({ nonce: 'test-nonce' });
      }
      if (url.endsWith('/auth/login')) return Response.json({ token: 'test-token' });
      if (url.endsWith('/storage/upload')) {
        if (state.fault === 'upload-403' || state.fault === 'upload-429') return Response.json({ error: 'rejected before storing' }, { status: state.fault === 'upload-403' ? 403 : 429 });
        uploads.push(JSON.parse(init.body).data);
        if (state.fault === 'upload-503') return Response.json({ error: 'upstream failed after storage' }, { status: 503 });
        if (state.fault === 'persistence') kv.failPut = true;
        return Response.json({ id: STORAGE_ID, storageRef: { id: STORAGE_ID, backend: 'arweave', resource: 'responses' } });
      }
      if (url === 'https://rpc.example') {
        const { method, params } = JSON.parse(init.body);
        if (method === 'eth_sendRawTransaction') {
          const hash = ethers.utils.keccak256(params[0]);
          hashes.push(hash);
          if (state.fault === 'broadcast-body') return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('body lost')); } }), { status: 200 });
          if (state.fault === 'broadcast-missing') return Response.json({ jsonrpc: '2.0', id: 1 });
          return Response.json({ jsonrpc: '2.0', id: 1, result: hash });
        }
        return Response.json({ jsonrpc: '2.0', id: 1, result: { eth_chainId: '0xaa37dc', eth_getTransactionCount: '0x0', eth_gasPrice: '0x3b9aca00', eth_estimateGas: '0x186a0' }[method] });
      }
      throw new Error(`Unexpected request ${url}`);
    },
  };
  return { env, kv, sent, state, calls, uploads, hashes };
}
async function deliver(h, { record = fixture(), attempts = 1, body = null } = {}) {
  let acked = 0;
  const retries = [];
  const result = await processAgentSubmitQueueBatch({ messages: [{
    body: body || { type: 'telegram_submit_direct_v1', version: 1, requestId: record.requestId, record }, attempts,
    ack() { acked += 1; }, retry(options) { retries.push(options); },
  }] }, h.env);
  return { ...result, acked, retries };
}

test('safe queue retries back off, then persist a recoverable terminal failure before acknowledging exhaustion', async () => {
  const h = harness({ fault: 'nonce-503' });
  const delays = [];
  for (let attempts = 1; attempts <= 4; attempts += 1) {
    const result = await deliver(h, { attempts });
    if (attempts < 4) { assert.equal(result.retries.length, 1); delays.push(result.retries[0]?.delaySeconds); }
    else { assert.equal(result.acked, 1); assert.equal(result.retries.length, 0); }
  }
  assert.ok(delays[0] >= 60);
  assert.ok(delays[1] > delays[0] && delays[2] > delays[1]);
  const stored = JSON.parse(await h.kv.get(submitRequestKvKey('recovery-fixture')));
  assert.equal(stored.status, 'direct_submit_failed');
  assert.equal(stored.onChain.retryExhausted, true);
  assert.equal(stored.onChain.safeToRetry, true);
  assert.equal(SUBMITTED_RESULT_STATUSES.includes(stored.status), false);
  assert.equal(h.uploads.length, 0);
});

test('eight queued answers recover from the nonce five-per-minute limit without immediate retry loops', async () => {
  const h = harness({ fault: 'nonce-limit' });
  const pending = [];
  for (let i = 0; i < 8; i += 1) {
    const record = { ...fixture(), requestId: `nonce-${i}` };
    const result = await deliver(h, { record });
    if (result.retries.length) { assert.ok(result.retries[0]?.delaySeconds >= 60); pending.push(record); }
  }
  assert.equal(pending.length, 3);
  h.state.now = 60;
  for (const record of pending) assert.equal((await deliver(h, { record, attempts: 2 })).ok, true);
  assert.equal(h.uploads.length, 8);
  assert.equal(h.hashes.length, 8);
});

for (const interrupted of [false, true]) {
  test(`provider Retry-After controls queue backpressure even with interrupted body: ${interrupted}`, async () => {
    const h = harness();
    h.env.AGENT_BRIDGE_FETCH = async () => interrupted
      ? new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('response interrupted')); } }), { status: 503, headers: { 'Retry-After': '180' } })
      : Response.json({ error: 'nonce capacity unavailable' }, { status: 429, headers: { 'Retry-After': '180' } });
    const result = await deliver(h);
    assert.equal(result.retries[0].delaySeconds, 180);
    assert.equal(h.uploads.length, 0);
  });
}

for (const [fault, retry] of [['upload-403', false], ['upload-429', true], ['upload-503', false]]) {
  test(`${fault} distinguishes a definite rejection from an unknown storage outcome`, async () => {
    const h = harness({ fault });
    const result = await deliver(h);
    assert.equal(result.retries.length, retry ? 1 : 0);
    assert.equal(result.results[0].reconciliationRequired, fault === 'upload-503');
    assert.equal(h.hashes.length, 0);
  });
}

for (const fault of ['broadcast-body', 'broadcast-missing']) {
  test(`${fault} retains the locally known hash as an uncertain outcome`, async () => {
    const h = harness({ fault });
    const result = await deliver(h);
    assert.equal(result.results[0].reconciliationRequired, true);
    assert.equal(result.results[0].onChain.txHash, h.hashes[0]);
    assert.equal(result.results[0].onChain.storageId, STORAGE_ID);
    assert.equal(result.retries.length, 0);
    await deliver(h);
    assert.equal(h.hashes.length, 1);
  });
}

test('result persistence failure retains IDs in a recovery message whose replay performs only persistence', async () => {
  const h = harness({ fault: 'persistence' });
  const result = await deliver(h);
  assert.equal(result.acked, 1);
  assert.equal(h.sent.length, 1);
  const recovery = h.sent[0].body;
  assert.equal(recovery.persistenceOnly, true);
  assert.equal(recovery.record.onChain.txHash, h.hashes[0]);
  assert.equal(recovery.record.onChain.storageId, STORAGE_ID);
  const count = h.calls.length;
  h.kv.failPut = false;
  assert.equal((await deliver(h, { body: recovery })).ok, true);
  assert.equal(h.calls.length, count);
  await deliver(h);
  assert.equal(h.calls.length, count);
  const stored = JSON.parse(await h.kv.get(submitRequestKvKey('recovery-fixture')));
  assert.equal(stored.status, 'direct_submitted');
  assert.equal(stored.createdAt, fixture().createdAt);
});

test('a visible intent suppresses redelivery while the first upload is in flight', async () => {
  const h = harness();
  const fetch = h.env.AGENT_BRIDGE_FETCH;
  let release;
  let started;
  const uploadStarted = new Promise(resolve => { started = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  h.env.AGENT_BRIDGE_FETCH = async (...args) => {
    if (args[0].endsWith('/storage/upload')) { started(); await held; }
    return fetch(...args);
  };
  const first = deliver(h);
  await uploadStarted;
  const before = h.calls.length;
  const duplicate = await deliver(h);
  assert.equal(duplicate.results[0].replayed, true);
  assert.equal(duplicate.results[0].reconciliationRequired, true);
  assert.equal(h.calls.length, before);
  release();
  assert.equal((await first).ok, true);
  assert.equal(h.hashes.length, 1);
});

test('recovery retries retain the exact outcome through exhaustion for the configured dead-letter queue', async () => {
  const h = harness({ fault: 'persistence' });
  await deliver(h);
  const recovery = h.sent[0].body;
  const calls = h.calls.length;
  const deadLetters = [];
  for (let attempts = 1; attempts <= 4; attempts += 1) {
    const result = await deliver(h, { body: recovery, attempts });
    assert.equal(result.acked, 0);
    assert.equal(result.retries.length, 1);
    if (attempts === 4) deadLetters.push(structuredClone(recovery));
  }
  assert.equal(h.calls.length, calls);
  assert.equal(deadLetters[0].record.onChain.txHash, h.hashes[0]);
  h.kv.failPut = false;
  await deliver(h, { body: deadLetters[0] });
  assert.equal(h.calls.length, calls);
  assert.equal(JSON.parse(await h.kv.get(submitRequestKvKey(recovery.requestId))).status, 'direct_submitted');
});

test('recovery is bound to its exact request and does not overwrite a newer explicit attempt', async () => {
  const h = harness({ fault: 'persistence' });
  await queueAgentSubmitRecord({ env: h.env, record: fixture() });
  const original = h.sent[0].body;
  await deliver(h, { body: original });
  const recovery = h.sent[1].body;
  h.kv.failPut = false;
  const calls = h.calls.length;
  const wrong = await deliver(h, { body: { ...recovery, requestId: 'different-request' } });
  assert.equal(wrong.results[0].reason, 'submit_recovery_record_invalid');
  const changed = await deliver(h, { body: { ...recovery, record: { ...recovery.record, questionId: `0x${'cd'.repeat(32)}` } } });
  assert.equal(changed.results[0].reason, 'submit_recovery_request_mismatch');
  await queueAgentSubmitRecord({ env: h.env, record: fixture() });
  const next = h.sent.at(-1).body;
  assert.notEqual(next.record.queueGeneration, original.record.queueGeneration);
  const stale = await deliver(h, { body: recovery });
  assert.equal(stale.results[0].reason, 'stale_submit_recovery');
  await deliver(h, { body: original });
  assert.equal(h.calls.length, calls);
  assert.equal(JSON.parse(await h.kv.get(submitRequestKvKey(original.requestId))).status, 'submit_queued');
});

test('failed terminal-status persistence after safe auth can recover without leaving an intent', async () => {
  const h = harness({ fault: 'nonce-503' });
  h.kv.failPut = true;
  for (let attempts = 1; attempts <= 4; attempts += 1) await deliver(h, { attempts });
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].body.record.status, 'direct_submit_failed');
  assert.equal(h.sent[0].body.record.onChain.safeToRetry, true);
  h.kv.failPut = false;
  await deliver(h, { body: h.sent[0].body });
  const record = JSON.parse(await h.kv.get(submitRequestKvKey('recovery-fixture')));
  assert.equal(record.status, 'direct_submit_failed');
  assert.equal(record.onChain.retryExhausted, true);
  assert.equal(h.uploads.length, 0);
});

test('terminal recovery after a failed replay read cannot relabel an uncertain existing submission as safe', async () => {
  const h = harness();
  const uncertain = { ...fixture(), status: 'direct_submit_reconciliation_required', onChain: { ok: false, reconciliationRequired: true, txHash: `0x${'34'.repeat(32)}` } };
  await h.kv.put(submitRequestKvKey(uncertain.requestId), JSON.stringify(uncertain));
  const get = h.kv.get.bind(h.kv);
  h.kv.get = async () => { throw new Error('read unavailable'); };
  await deliver(h, { attempts: 4 });
  h.kv.get = get;
  await deliver(h, { body: h.sent[0].body });
  const retained = JSON.parse(await h.kv.get(submitRequestKvKey(uncertain.requestId)));
  assert.equal(retained.status, 'direct_submit_reconciliation_required');
  assert.equal(retained.onChain.txHash, uncertain.onChain.txHash);
  assert.equal(retained.onChain.safeToRetry, undefined);
  assert.equal(h.calls.length, 0);
});

test('failure of both result KV and recovery publication surfaces public diagnostics without resending', async t => {
  const h = harness({ fault: 'persistence' });
  h.env.AGENT_RESPONSE_QUEUE.send = async () => { throw new Error('queue unavailable'); };
  const diagnostics = [];
  t.mock.method(console, 'error', value => diagnostics.push(value));
  const result = await deliver(h);
  assert.equal(result.results[0].diagnosticsRetained, false);
  assert.equal(result.retries.length, 0);
  assert.equal(diagnostics[0].txHash, h.hashes[0]);
  assert.equal(diagnostics[0].storageId, STORAGE_ID);
  assert.equal(JSON.stringify(diagnostics).includes('Approved answer'), false);
  assert.equal(JSON.stringify(diagnostics).includes('unit-root'), false);
  h.kv.failPut = false;
  await deliver(h);
  assert.equal(h.hashes.length, 1);
});

test('queue publication uses the same creation timestamp as persistence even when the consumer misses KV', async () => {
  const h = harness();
  const record = { ...fixture(), createdAt: null };
  await queueAgentSubmitRecord({ env: h.env, record });
  const stored = JSON.parse(await h.kv.get(submitRequestKvKey(record.requestId)));
  assert.equal(h.sent[0].body.record.createdAt, stored.createdAt);
  h.kv.miss = true;
  await deliver(h, { body: h.sent[0].body });
  assert.equal(h.uploads[0].timeStamp, Date.parse(stored.createdAt));
});

test('the example consumer budget matches application exhaustion and retains failed recovery in a DLQ', () => {
  const config = readFileSync(new URL('./wrangler.example.toml', import.meta.url), 'utf8');
  const retries = Number(config.match(/^# max_retries = (\d+)$/m)[1]);
  const attempts = Number(config.match(/^AGENT_BRIDGE_SUBMIT_MAX_ATTEMPTS = "(\d+)"$/m)[1]);
  assert.equal(attempts, SUBMIT_QUEUE_MAX_ATTEMPTS);
  assert.equal(attempts, retries + 1);
  assert.match(config, /^# dead_letter_queue = ".+"$/m);
});

test('an upload rejection carrying a storage identifier remains uncertain and retains that identifier', async () => {
  const h = harness();
  const fetch = h.env.AGENT_BRIDGE_FETCH;
  h.env.AGENT_BRIDGE_FETCH = async (...args) => args[0].endsWith('/storage/upload')
    ? Response.json({ error: 'post-storage refusal', storageRef: { backend: 'arweave', id: STORAGE_ID } }, { status: 403 }) : fetch(...args);
  const result = await deliver(h);
  assert.equal(result.results[0].reconciliationRequired, true);
  assert.equal(result.results[0].onChain.storageId, STORAGE_ID);
  assert.equal(result.retries.length, 0);
});

test('a changed request between authentication and admission is never overwritten or submitted', async () => {
  const h = harness();
  const record = fixture();
  await h.kv.put(submitRequestKvKey(record.requestId), JSON.stringify(record));
  const fetch = h.env.AGENT_BRIDGE_FETCH;
  const changedId = `0x${'cd'.repeat(32)}`;
  h.env.AGENT_BRIDGE_FETCH = async (...args) => {
    if (args[0].endsWith('/auth/login')) await h.kv.put(submitRequestKvKey(record.requestId), JSON.stringify({ ...record, questionId: changedId }));
    return fetch(...args);
  };
  const result = await deliver(h);
  assert.equal(h.uploads.length, 0);
  assert.equal(result.retries.length, 0);
  assert.equal(JSON.parse(await h.kv.get(submitRequestKvKey(record.requestId))).questionId, changedId);
});

function producerInput(h) {
  h.env.AGENT_BRIDGE_SESSION_POLICY_JSON = JSON.stringify({ defaultSessionSlug: 'alpha', sessions: [{ ...fixture().sessionSnapshot, telegramBridgeEnabled: true }] });
  return { env: h.env, normalized: { user: { telegramUserId: '42' }, chat: { chatId: '42', type: 'private' } },
    draft: { status: 'draft_saved', sessionSlug: 'alpha', questionId: QID, controlType: 'text', answerLabel: 'Approved answer', answerValue: 'Approved answer' },
    sessionSlug: 'alpha', selectedQuestionId: QID };
}

test('the retained HTTP submit producer fails closed when its replay read fails', async () => {
  const h = harness();
  const input = producerInput(h);
  await persistAgentSubmitRequest(input);
  const get = h.kv.get.bind(h.kv);
  h.kv.get = async key => { if (key.startsWith('telegram:submit-request:')) throw new Error('replay unavailable'); return get(key); };
  const result = await persistAgentSubmitRequest(input);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'submit_request_read_failed');
  assert.equal(h.sent.length, 1);
  assert.equal(h.calls.length, 0);
});

for (const accepted of [false, true]) {
  test(`an explicit retry recovers queue publication with accepted=${accepted} without replacing its generation`, async () => {
    const h = harness();
    const input = producerInput(h);
    const send = h.env.AGENT_RESPONSE_QUEUE.send;
    h.env.AGENT_RESPONSE_QUEUE.send = async (...args) => {
      if (accepted) await send(...args);
      throw new Error('queue acknowledgement unavailable');
    };
    const failed = await persistAgentSubmitRequest(input);
    assert.equal(failed.ok, false);
    const before = JSON.parse(await h.kv.get(submitRequestKvKey(failed.requestId)));
    h.env.AGENT_RESPONSE_QUEUE.send = send;
    const retried = await persistAgentSubmitRequest(input);
    assert.equal(retried.ok, true);
    assert.equal(retried.queued, true);
    assert.equal(h.sent.length, accepted ? 2 : 1);
    assert.deepEqual(h.sent.at(-1).body.record, before);
    assert.deepEqual(JSON.parse(await h.kv.get(submitRequestKvKey(failed.requestId))), before);
    for (const sent of h.sent) await deliver(h, { body: sent.body });
    assert.equal(h.hashes.length, 1);
    const completed = await persistAgentSubmitRequest(input);
    assert.equal(completed.status, 'direct_submitted');
    assert.equal(h.sent.length, accepted ? 2 : 1);
  });
}

test('a pending queue retry reports another enqueue failure without claiming success', async () => {
  const h = harness();
  const input = producerInput(h);
  h.env.AGENT_RESPONSE_QUEUE.send = async () => { throw new Error('queue unavailable'); };
  const first = await persistAgentSubmitRequest(input);
  const second = await persistAgentSubmitRequest(input);
  assert.equal(first.ok, false);
  assert.equal(second.ok, false);
  assert.equal(second.retryable, true);
  assert.equal(h.calls.length, 0);
});

test('an uncertain queue publication cannot fall through to a synchronous broadcast', async () => {
  const h = harness();
  const input = producerInput(h);
  const send = h.env.AGENT_RESPONSE_QUEUE.send;
  h.env.AGENT_RESPONSE_QUEUE.send = async (...args) => { await send(...args); throw new Error('queue acknowledgement lost'); };
  const result = await persistAgentSubmitRequest(input);
  assert.equal(result.ok, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.sent.length, 1);
  await deliver(h, { body: h.sent[0].body });
  assert.equal(h.hashes.length, 1);
});

async function prepareHttpSubmit(h, sessionOverrides = {}) {
  __test__sessionQuestions.clearCaches();
  Object.assign(h.env, {
    AGENT_BRIDGE_AGENT_API_TOKEN: 'test-agent-credential', QUESTION_FETCH: async () => { throw new Error('no live reads'); },
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({ defaultSessionSlug: 'alpha', riskCeiling: 'submit', sessions: [{
      ...fixture().sessionSnapshot, ...sessionOverrides, telegramBridgeEnabled: true, telegramGroupOpenAccess: true,
    }] }),
  });
  const question = __test__sessionQuestions.normalizeQuestionPayload({ id: QID, sessionSlug: 'alpha', type: 'freeform', prompt: 'Your answer?' }, { questionId: QID, pointerId: 'x'.repeat(43), sessionSlug: 'alpha' });
  await h.kv.put(`${__test__sessionQuestions.QUESTION_CACHE_PREFIX}alpha`, JSON.stringify({ ok: true, complete: true, cachedAtMs: Date.now(), sessionSlug: 'alpha', questions: [question], questionCount: 1, indexedFromBlock: 1, indexedToBlock: 100 }));
  await seedLegacySessionBinding(h.env);
  return () => new Request('https://bridge.example/api/agent/preferences', { method: 'POST', headers: { authorization: 'Bearer test-agent-credential', 'content-type': 'application/json' }, body: JSON.stringify({ telegramUserId: '42', groupChatId: '-100123', sessionSlug: 'alpha', submit: true, humanApproved: true, preferences: { answersByQuestionId: { [QID]: { text: 'Approved answer' } } } }) });
}

test('the actual Agent HTTP producer and Worker queue recover an exhausted safe failure on explicit resubmit', async () => {
  const h = harness({ fault: 'nonce-503' });
  const request = await prepareHttpSubmit(h);
  const first = await worker.fetch(request(), h.env);
  assert.equal(first.status, 200, JSON.stringify(await first.json()));
  assert.equal(h.sent.length, 1);
  const body = h.sent[0].body;
  for (let attempts = 1; attempts <= 4; attempts += 1) await worker.queue({ messages: [{ body, attempts, ack() {}, retry() {} }] }, h.env);
  const failed = JSON.parse(await h.kv.get(submitRequestKvKey(body.requestId)));
  assert.equal(failed.status, 'direct_submit_failed');
  h.state.fault = '';
  const retry = await worker.fetch(request(), h.env);
  assert.equal(retry.status, 200, JSON.stringify(await retry.json()));
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[1].body.record.createdAt, body.record.createdAt);
  const fetch = h.env.AGENT_BRIDGE_FETCH;
  let release;
  let started;
  const uploadStarted = new Promise(resolve => { started = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  h.env.AGENT_BRIDGE_FETCH = async (...args) => {
    if (args[0].endsWith('/storage/upload')) { started(); await held; }
    return fetch(...args);
  };
  const processing = worker.queue({ messages: [{ body: h.sent[1].body, attempts: 1, ack() {}, retry() {} }] }, h.env);
  await uploadStarted;
  const duplicate = await worker.fetch(request(), h.env);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).submitted[0].status, 'direct_submit_reconciliation_required');
  assert.equal(h.sent.length, 2);
  release();
  await processing;
  const completed = JSON.parse(await h.kv.get(submitRequestKvKey(body.requestId)));
  assert.equal(completed.status, 'direct_submitted');
  assert.equal(h.hashes.length, 1);
});

for (const failure of [
  { name: 'disabled direct submission', reason: 'direct_submit_disabled', env: { AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'false' } },
  { name: 'missing Worker URL', reason: 'session_worker_url_missing', session: { sessionWorkerUrl: '' } },
  { name: 'invalid Surveys address', reason: 'surveys_address_missing', session: { surveysAddress: 'invalid' } },
  { name: 'invalid Surveys checksum', reason: 'surveys_address_missing', session: { surveysAddress: '0xAbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } },
  { name: 'missing RPC URL', reason: 'rpc_url_missing', env: { DEFAULT_RPC_URL: '' } },
  { name: 'unavailable auth transport', reason: 'fetch_unavailable', env: { AGENT_BRIDGE_FETCH: {} } },
  { name: 'missing account secret', reason: 'managed_account_unavailable', env: { DEMO_SIGNER_ROOT_SECRET: '' } },
  { name: 'blank account secret', reason: 'managed_account_unavailable', env: { DEMO_SIGNER_ROOT_SECRET: '  ' } },
]) {
  test(`${failure.name} persists a terminal safe failure and permits one explicit HTTP resubmission after repair`, async () => {
    const h = harness();
    const originalEnv = { ...h.env };
    const request = await prepareHttpSubmit(h, failure.session);
    const first = await worker.fetch(request(), h.env);
    assert.equal(first.status, 200, JSON.stringify(await first.json()));
    assert.equal(h.sent.length, 1);
    const body = h.sent[0].body;
    Object.assign(h.env, failure.env);
    const result = await deliver(h, { body });
    assert.equal(result.acked, 1);
    assert.equal(result.retries.length, 0);
    const failed = JSON.parse(await h.kv.get(submitRequestKvKey(body.requestId)));
    assert.equal(failed.status, 'direct_submit_failed');
    assert.equal(failed.onChain.reason, failure.reason);
    assert.equal(failed.onChain.safeToRetry, true);
    assert.equal(h.uploads.length, 0);
    assert.equal(h.hashes.length, 0);
    for (const key of Object.keys(failure.env || {})) h.env[key] = originalEnv[key];
    await prepareHttpSubmit(h);
    const retry = await worker.fetch(request(), h.env);
    assert.equal(retry.status, 200, JSON.stringify(await retry.json()));
    assert.equal(h.sent.length, 2);
    assert.equal(h.sent[1].body.requestId, body.requestId);
    assert.equal(h.sent[1].body.record.createdAt, body.record.createdAt);
    await deliver(h, { body: h.sent[1].body });
    await deliver(h, { body: h.sent[1].body });
    const completed = JSON.parse(await h.kv.get(submitRequestKvKey(body.requestId)));
    assert.equal(completed.status, 'direct_submitted');
    assert.equal(h.hashes.length, 1);
  });
}

for (const invalid of ['request mismatch', 'unreadable record']) {
  test(`pre-effect account failure leaves ${invalid} untouched`, async () => {
    const h = harness();
    const record = fixture();
    const raw = invalid === 'request mismatch' ? JSON.stringify({ ...record, questionId: `0x${'cd'.repeat(32)}` }) : '{broken';
    await h.kv.put(submitRequestKvKey(record.requestId), raw);
    h.env.DEMO_SIGNER_ROOT_SECRET = '';
    const result = await deliver(h, { record });
    assert.equal(result.results[0].reason, 'submit_request_record_invalid');
    assert.equal(await h.kv.get(submitRequestKvKey(record.requestId)), raw);
    assert.equal(h.calls.length, 0);
  });
}

test('a terminal auth failure cannot overwrite an intent admitted by another delivery', async () => {
  const h = harness();
  const record = fixture();
  const uncertain = { ...record, status: 'direct_submit_reconciliation_required', onChain: { ok: false, reconciliationRequired: true, reason: 'submission_in_progress', submissionAttemptId: 'another-attempt' } };
  await h.kv.put(submitRequestKvKey(record.requestId), JSON.stringify(record));
  h.env.AGENT_BRIDGE_FETCH = async () => {
    await h.kv.put(submitRequestKvKey(record.requestId), JSON.stringify(uncertain));
    return Response.json({ error: 'forbidden' }, { status: 403 });
  };
  const result = await deliver(h, { record });
  assert.equal(result.results[0].reconciliationRequired, true);
  assert.deepEqual(JSON.parse(await h.kv.get(submitRequestKvKey(record.requestId))), uncertain);
  assert.equal(h.uploads.length, 0);
});

for (const reason of ['legacy_failure', 'broadcast_outcome_unknown']) {
  test(`explicit HTTP resubmission never infers safety for ${reason}`, async () => {
    const h = harness();
    const request = await prepareHttpSubmit(h);
    await worker.fetch(request(), h.env);
    const record = h.sent[0].body.record;
    const failed = { ...record, status: 'direct_submit_failed', onChain: { ok: false, reason, ...(reason === 'broadcast_outcome_unknown' ? { txHash: `0x${'56'.repeat(32)}` } : {}) } };
    await h.kv.put(submitRequestKvKey(record.requestId), JSON.stringify(failed));
    const retry = await worker.fetch(request(), h.env);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).submitted[0].status, 'direct_submit_failed');
    assert.equal(h.sent.length, 1);
    assert.deepEqual(JSON.parse(await h.kv.get(submitRequestKvKey(record.requestId))), failed);
    assert.equal(h.calls.length, 0);
  });

  test(`persistence-only recovery never marks an existing ${reason} safe`, async () => {
    const h = harness();
    const record = fixture();
    await h.kv.put(submitRequestKvKey(record.requestId), JSON.stringify(record));
    h.env.DEMO_SIGNER_ROOT_SECRET = '';
    h.kv.failPut = true;
    await deliver(h, { record });
    assert.equal(h.sent[0].body.persistenceOnly, true);
    h.kv.failPut = false;
    const failed = { ...record, status: 'direct_submit_failed', onChain: { ok: false, reason, ...(reason === 'broadcast_outcome_unknown' ? { txHash: `0x${'56'.repeat(32)}` } : {}) } };
    await h.kv.put(submitRequestKvKey(record.requestId), JSON.stringify(failed));
    await deliver(h, { body: h.sent[0].body });
    assert.deepEqual(JSON.parse(await h.kv.get(submitRequestKvKey(record.requestId))), failed);
    assert.equal(h.calls.length, 0);
  });
}

for (const invalid of ['session admission', 'question identifier']) {
  test(`pre-effect ${invalid} rejection is terminal and explicitly safe to retry`, async () => {
    const h = harness();
    const record = fixture();
    if (invalid === 'session admission') record.sessionSnapshot.managedAccountSubmitAllowed = false;
    else record.questionId = 'not-bytes32';
    await queueAgentSubmitRecord({ env: h.env, record });
    const result = await deliver(h, { body: h.sent[0].body });
    assert.equal(result.acked, 1);
    assert.equal(result.retries.length, 0);
    const failed = JSON.parse(await h.kv.get(submitRequestKvKey(record.requestId)));
    assert.equal(failed.status, 'direct_submit_failed');
    assert.equal(failed.onChain.safeToRetry, true);
    assert.equal(h.calls.length, 0);
  });
}

// Historical bindings remain readable without recreating a removed chat workflow.
async function seedLegacySessionBinding(env) {
  await env.AGENT_ACTION_KV.put('telegram:group-session:-100123', JSON.stringify({ sessionSlug: 'alpha' }));
  await env.AGENT_ACTION_KV.put('telegram:private-session:42', JSON.stringify({ sessionSlug: 'alpha', groupChatId: '-100123' }));
}
