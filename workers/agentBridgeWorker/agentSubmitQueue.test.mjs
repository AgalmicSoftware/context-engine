import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalAnswerKvKey,
  canonicalAnswerSessionKvKey,
  buildQueuedSubmitRecord,
  persistAgentSubmitRecord,
  processAgentSubmitQueueBatch,
  processQueuedAgentSubmitRecord,
  queueAgentSubmitRecord,
  submitRequestSessionKvKey,
  submitRequestUserKvKey,
  agentSubmitQueueEnabled,
} from './agentSubmitQueue.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.putCalls = [];
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    this.putCalls.push({ key, value, options });
  }

  async get(key) {
    return this.store.get(key) || null;
  }
}

class MemoryQueue {
  constructor() {
    this.messages = [];
  }

  async send(body, options = {}) {
    this.messages.push({ body, options });
  }
}

test('Telegram submit queue persists accepted responses before async processing', async () => {
  const kv = new MemoryKv();
  const queue = new MemoryQueue();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_RESPONSE_QUEUE: queue,
    AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED: 'true',
  };
  const record = buildQueuedSubmitRecord({
    session: {
      sessionSlug: 'alpha',
      managedAccountSubmitAllowed: true,
    },
    canonicalBody: {
      session: 'alpha',
      questionId: `0x${'12'.repeat(32)}`,
      answerRef: 'telegram_private_answer_ref',
      idempotencyKey: 'idem-1',
    },
    baseRecord: {
      version: 1,
      requestId: 'submit-one',
      idempotencyKey: 'idem-1',
      answerFingerprint: 'fp-1',
      lane: 'telegram_mini_app',
      telegramUserId: '42',
      sessionSlug: 'alpha',
      questionId: `0x${'12'.repeat(32)}`,
      questionIdShort: '0x1212...1212',
      answer: { label: 'Agree', value: 'agree', controlType: 'agree_unsure_disagree' },
      onChainAnswer: {
        questionType: 'agree_unsure_disagree',
        value: 'agree',
        label: 'Agree',
        comments: '',
      },
      createdAt: '2026-05-23T12:00:00.000Z',
    },
  });

  assert.equal(agentSubmitQueueEnabled(env), true);
  const queued = await queueAgentSubmitRecord({
    env,
    kvKey: 'telegram:submit-request:submit-one',
    record,
  });

  assert.equal(queued.ok, true);
  assert.equal(queue.messages.length, 1);
  assert.equal(queue.messages[0].body.type, 'telegram_submit_direct_v1');
  assert.equal(JSON.parse(await kv.get('telegram:submit-request:submit-one')).status, 'submit_queued');
  assert.equal(JSON.parse(await kv.get(submitRequestSessionKvKey(record))).status, 'submit_queued');
  assert.equal(JSON.parse(await kv.get(submitRequestUserKvKey(record))).status, 'submit_queued');
  const canonical = JSON.parse(await kv.get(canonicalAnswerKvKey(record)));
  const canonicalBySession = JSON.parse(await kv.get(canonicalAnswerSessionKvKey(record)));
  assert.equal(canonical.type, 'telegram_canonical_answer');
  assert.equal(canonical.status, 'submit_queued');
  assert.equal(canonical.sessionSlug, 'alpha');
  assert.equal(canonical.questionId, `0x${'12'.repeat(32)}`);
  assert.deepEqual(canonicalBySession, canonical);
  for (const key of [
    canonicalAnswerKvKey(record),
    canonicalAnswerSessionKvKey(record),
  ]) {
    const call = kv.putCalls.find((entry) => entry.key === key);
    assert.ok(call, `expected canonical KV put for ${key}`);
    assert.equal(call.options.expirationTtl, undefined);
  }
  const expectedMetadata = {
    v: 1,
    t: 'submit_request',
    st: 'submit_queued',
    sg: 'alpha',
    u: '42',
    c: '2026-05-23T12:00:00.000Z',
  };
  for (const key of [
    'telegram:submit-request:submit-one',
    submitRequestSessionKvKey(record),
    submitRequestUserKvKey(record),
  ]) {
    const call = kv.putCalls.find((entry) => entry.key === key);
    assert.ok(call, `expected KV put for ${key}`);
    assert.deepEqual(call.options.metadata, expectedMetadata);
  }
});

test('Telegram canonical answer records are durable and last-write-wins', async () => {
  const kv = new MemoryKv();
  const record = buildQueuedSubmitRecord({
    session: {
      sessionSlug: 'alpha',
      managedAccountSubmitAllowed: true,
    },
    canonicalBody: {
      session: 'alpha',
      questionId: 'q-durable',
      answerRef: 'telegram_private_answer_ref',
      idempotencyKey: 'idem-durable',
    },
    baseRecord: {
      version: 1,
      requestId: 'submit-durable',
      idempotencyKey: 'idem-durable',
      answerFingerprint: 'fp-durable',
      lane: 'telegram_mini_app',
      telegramUserId: '42',
      sessionSlug: 'alpha',
      questionId: 'q-durable',
      questionIdShort: 'q-durable',
      answer: { label: 'Unsure', value: 'unsure', controlType: 'agree_unsure_disagree' },
      onChainAnswer: {
        questionType: 'agree_unsure_disagree',
        value: 'unsure',
        label: 'Unsure',
        comments: '',
      },
      createdAt: '2026-05-23T12:00:00.000Z',
    },
  });

  const first = await persistAgentSubmitRecord({
    env: { AGENT_ACTION_KV: kv },
    kvKey: 'telegram:submit-request:submit-durable',
    record,
  });
  const updated = {
    ...record,
    status: 'direct_submitted',
    answer: { ...record.answer, label: 'Agree', value: 'agree' },
    onChainAnswer: { ...record.onChainAnswer, label: 'Agree', value: 'agree' },
    processedAt: '2026-05-23T12:01:00.000Z',
  };
  const second = await persistAgentSubmitRecord({
    env: { AGENT_ACTION_KV: kv },
    kvKey: 'telegram:submit-request:submit-durable',
    record: updated,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const durable = JSON.parse(await kv.get(canonicalAnswerSessionKvKey(updated)));
  assert.equal(durable.status, 'direct_submitted');
  assert.equal(durable.answer.value, 'agree');
  assert.equal(durable.updatedAt, '2026-05-23T12:01:00.000Z');
  const canonicalCalls = kv.putCalls.filter((entry) => entry.key === canonicalAnswerSessionKvKey(updated));
  assert.equal(canonicalCalls.length, 2);
  assert.equal(canonicalCalls.every((entry) => entry.options.expirationTtl === undefined), true);
});

test('Telegram submit records get server timestamps when omitted', async () => {
  const kv = new MemoryKv();
  const record = {
    version: 1,
    requestId: 'submit-missing-created-at',
    idempotencyKey: 'idem-missing-created-at',
    answerFingerprint: 'fp-missing-created-at',
    action: 'submit_response',
    status: 'submit_request_created',
    lane: 'telegram_mini_app',
    telegramUserId: '42',
    sessionSlug: 'alpha',
    questionId: 'q-one',
    questionIdShort: 'q-one',
    answer: { label: 'Agree', value: 'agree', controlType: 'agree_unsure_disagree' },
  };

  const before = Date.now();
  const persisted = await persistAgentSubmitRecord({
    env: { AGENT_ACTION_KV: kv },
    kvKey: 'telegram:submit-request:submit-missing-created-at',
    record,
  });
  const after = Date.now();

  assert.equal(persisted.ok, true);
  const stored = JSON.parse(await kv.get('telegram:submit-request:submit-missing-created-at'));
  const indexed = JSON.parse(await kv.get(submitRequestSessionKvKey(stored)));
  const canonical = JSON.parse(await kv.get(canonicalAnswerSessionKvKey(stored)));
  const storedMs = Date.parse(stored.createdAt);

  assert.equal(Number.isFinite(storedMs), true);
  assert.ok(storedMs >= before && storedMs <= after);
  assert.equal(indexed.createdAt, stored.createdAt);
  assert.equal(canonical.createdAt, stored.createdAt);
  assert.equal(
    kv.putCalls.find((entry) => entry.key === 'telegram:submit-request:submit-missing-created-at')
      ?.options.metadata.c,
    stored.createdAt.slice(0, 32),
  );
});

test('Telegram submit queue caps metadata fields within KV metadata limits', async () => {
  const kv = new MemoryKv();
  const queue = new MemoryQueue();
  const oversizedStatus = `${'direct_submit_failed'.repeat(20)}!@#$`;
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_RESPONSE_QUEUE: queue,
    AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED: 'true',
  };
  const record = buildQueuedSubmitRecord({
    session: {
      sessionSlug: 'alpha',
      managedAccountSubmitAllowed: true,
    },
    canonicalBody: {
      session: 'alpha',
      questionId: `0x${'34'.repeat(32)}`,
      answerRef: 'telegram_private_answer_ref',
      idempotencyKey: 'idem-oversized',
    },
    baseRecord: {
      version: 1,
      requestId: 'submit-oversized',
      idempotencyKey: 'idem-oversized',
      answerFingerprint: 'fp-oversized',
      lane: 'telegram_mini_app',
      telegramUserId: `${'User_'.repeat(80)}!@#$${'9'.repeat(80)}`,
      sessionSlug: 'alpha',
      questionId: `0x${'34'.repeat(32)}`,
      questionIdShort: '0x3434...3434',
      answer: { label: 'Agree', value: 'agree', controlType: 'agree_unsure_disagree' },
      onChainAnswer: {
        questionType: 'agree_unsure_disagree',
        value: 'agree',
        label: 'Agree',
        comments: '',
      },
      createdAt: '2026-05-23T12:00:00.000Z-extra-created-at-value-that-should-be-truncated',
    },
  });
  record.status = oversizedStatus;

  const queued = await queueAgentSubmitRecord({
    env,
    kvKey: 'telegram:submit-request:submit-oversized',
    record,
  });

  assert.equal(queued.ok, true);
  const expectedMetadata = {
    v: 1,
    t: 'submit_request',
    st: safeMetadataToken(record.status, 64),
    sg: 'alpha',
    u: safeMetadataToken(record.telegramUserId, 128),
    c: record.createdAt.slice(0, 32),
  };
  assert.equal(expectedMetadata.st.length, 64);
  assert.equal(expectedMetadata.u.length, 128);
  assert.equal(expectedMetadata.c.length, 32);

  for (const key of [
    'telegram:submit-request:submit-oversized',
    submitRequestSessionKvKey(record),
    submitRequestUserKvKey(record),
  ]) {
    const call = kv.putCalls.find((entry) => entry.key === key);
    assert.ok(call, `expected KV put for ${key}`);
    assert.deepEqual(call.options.metadata, expectedMetadata);
    assert.ok(
      Buffer.byteLength(JSON.stringify(call.options.metadata), 'utf8') <= 1024,
      `expected metadata for ${key} to fit Cloudflare KV metadata limit`,
    );
  }
});

test('Telegram submit queue consumer updates persisted records after processing', async () => {
  const kv = new MemoryKv();
  const record = buildQueuedSubmitRecord({
    session: {
      sessionSlug: 'alpha',
      managedAccountSubmitAllowed: true,
    },
    canonicalBody: {
      session: 'alpha',
      questionId: `0x${'12'.repeat(32)}`,
      answerRef: 'telegram_private_answer_ref',
      idempotencyKey: 'idem-2',
    },
    baseRecord: {
      version: 1,
      requestId: 'submit-two',
      idempotencyKey: 'idem-2',
      answerFingerprint: 'fp-2',
      lane: 'telegram_mini_app',
      telegramUserId: '42',
      sessionSlug: 'alpha',
      questionId: `0x${'12'.repeat(32)}`,
      questionIdShort: '0x1212...1212',
      answer: { label: 'Agree', value: 'agree', controlType: 'agree_unsure_disagree' },
      onChainAnswer: {
        questionType: 'agree_unsure_disagree',
        value: 'agree',
        label: 'Agree',
        comments: '',
      },
      createdAt: '2026-05-23T12:00:00.000Z',
    },
  });
  await kv.put('telegram:submit-request:submit-two', JSON.stringify(record));
  let acked = false;

  const result = await processAgentSubmitQueueBatch({
    messages: [{
      body: { type: 'telegram_submit_direct_v1', record },
      ack: () => { acked = true; },
    }],
  }, {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'true',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
  });

  const stored = JSON.parse(await kv.get('telegram:submit-request:submit-two'));
  const indexed = JSON.parse(await kv.get(submitRequestSessionKvKey(record)));
  assert.equal(result.ok, false);
  assert.equal(acked, true);
  assert.equal(stored.status, 'direct_submit_failed');
  assert.equal(indexed.status, 'direct_submit_failed');
  assert.equal(stored.onChain.reason, 'session_worker_url_missing');
});

function safeMetadataToken(value, cap) {
  return String(value || '').trim().replace(/[^0-9A-Za-z_-]/g, '').slice(0, cap);
}


function queuedFixture() {
  return buildQueuedSubmitRecord({
    session: {
      sessionSlug: 'alpha', managedAccountSubmitAllowed: true, sponsoredFaucetAllowed: false,
      sessionWorkerUrl: 'https://worker.example', surveysAddress: '0x1111111111111111111111111111111111111111',
      chainId: 11155420,
    },
    baseRecord: {
      requestId: 'safe-retry', idempotencyKey: 'idem-safe-retry', telegramUserId: '42',
      sessionSlug: 'alpha', questionId: `0x${'12'.repeat(32)}`,
      onChainAnswer: { questionType: 'freeform', value: 'Approved answer' },
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  });
}

function queueHarness({ fetchFailure = '', waitFailure = false } = {}) {
  const kv = new MemoryKv();
  const calls = [];
  let submits = 0;
  const env = {
    AGENT_ACTION_KV: kv, AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'true',
    DEMO_SIGNER_ROOT_SECRET: 'test-root', AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    AGENT_BRIDGE_FETCH: async (url, init) => {
      calls.push({ url, init });
      if (fetchFailure === 'read') throw new Error('unexpected network request');
      if (String(url).endsWith('/auth/nonce')) {
        if (fetchFailure === 'network') throw new TypeError('network timeout');
        if (typeof fetchFailure === 'number') return Response.json({ error: 'unavailable' }, { status: fetchFailure });
        if (fetchFailure === 'malformed') return Response.json({});
        if (fetchFailure === 'invalid-json') return new Response('{not json', { status: 200 });
        if (['body-timeout', 'body-aborted', 'body-denied'].includes(fetchFailure)) {
          const error = fetchFailure === 'body-aborted' ? new DOMException('body aborted', 'AbortError') : new TypeError('body read timeout');
          return new Response(new ReadableStream({ start(controller) { controller.error(error); } }), { status: fetchFailure === 'body-denied' ? 403 : 200 });
        }
        return Response.json({ nonce: 'nonce-123' });
      }
      if (String(url).endsWith('/auth/login')) {
        if (fetchFailure === 'login-network') throw new TypeError('login timeout');
        if (fetchFailure === 'login-503') return Response.json({ error: 'login unavailable' }, { status: 503 });
        if (fetchFailure === 'login-malformed') return Response.json({});
        return Response.json({ token: 'worker-token' });
      }
      if (String(url).endsWith('/storage/upload')) {
        if (fetchFailure === 'upload') throw new TypeError('upload outcome unknown');
        const id = Buffer.alloc(32, 7).toString('base64url');
        return Response.json({ id, storageRef: { backend: 'arweave', id, resource: 'responses' } });
      }
      throw new Error('unexpected request');
    },
    AGENT_BRIDGE_CONTRACT_FACTORY: () => ({
      submitResponses: async () => {
        submits += 1;
        return { hash: `0x${'56'.repeat(32)}`, wait: async () => {
          if (waitFailure) throw new Error('receipt timeout');
          return { blockNumber: 100 };
        } };
      },
    }),
  };
  return { env, kv, calls, submits: () => submits };
}

async function runQueueMessage(env, record = queuedFixture()) {
  let acked = 0;
  let retried = 0;
  const outcome = await processAgentSubmitQueueBatch({ messages: [{
    body: { type: 'telegram_submit_direct_v1', record },
    ack: () => { acked += 1; }, retry: () => { retried += 1; },
  }] }, env);
  return { ...outcome, acked, retried };
}

for (const failure of ['network', 'body-timeout', 'body-aborted', 'login-network', 'login-503', 408, 429, 500, 503]) {
  test(`queue retries safe pre-upload authentication failure: ${failure}`, async () => {
    const h = queueHarness({ fetchFailure: failure });
    const result = await runQueueMessage(h.env);
    assert.equal(result.retried, 1);
    assert.equal(result.acked, 0);
    assert.equal(result.results[0].retryable, true);
    assert.equal(h.calls.some(({ url }) => url.endsWith('/storage/upload')), false);
    assert.equal(h.submits(), 0);
  });
}

for (const failure of [400, 401, 403, 404, 'malformed', 'invalid-json', 'login-malformed', 'body-denied']) {
  test(`queue acknowledges terminal authentication failure: ${failure}`, async () => {
    const h = queueHarness({ fetchFailure: failure });
    const result = await runQueueMessage(h.env);
    assert.equal(result.retried, 0);
    assert.equal(result.acked, 1);
    assert.equal(h.submits(), 0);
  });
}

test('a failed KV read retries before any submission; missing KV fails closed', async () => {
  const h = queueHarness({ fetchFailure: 'read' });
  h.kv.get = async () => { throw new Error('KV unavailable'); };
  const result = await runQueueMessage(h.env);
  assert.equal(result.retried, 1);
  assert.equal(result.acked, 0);
  assert.equal(h.calls.length, 0);
  delete h.env.AGENT_ACTION_KV;
  const missing = await runQueueMessage(h.env);
  assert.equal(missing.results[0].reason, 'action_kv_unavailable');
  assert.equal(h.calls.length, 0);
});

test('delayed queues use execution time for SIWE and retain answer creation time', async () => {
  const h = queueHarness();
  const record = queuedFixture();
  const now = new Date('2026-10-17T01:30:00.000Z');
  const result = await processQueuedAgentSubmitRecord({ env: h.env, record, now });
  assert.equal(result.ok, true);
  const login = JSON.parse(h.calls.find(({ url }) => url.endsWith('/auth/login')).init.body);
  assert.ok(login.message.includes(`Issued At: ${now.toISOString()}`));
  const uploaded = JSON.parse(h.calls.find(({ url }) => url.endsWith('/storage/upload')).init.body).data;
  assert.equal(uploaded.timeStamp, Date.parse(record.createdAt));
  const stored = JSON.parse(await h.kv.get('telegram:submit-request:safe-retry'));
  assert.equal(stored.createdAt, record.createdAt);
  assert.equal(stored.processedAt, now.toISOString());
});

test('ambiguous upload failure needs reconciliation and is not automatically resubmitted', async () => {
  const h = queueHarness({ fetchFailure: 'upload' });
  const first = await runQueueMessage(h.env);
  assert.equal(first.retried, 0);
  assert.equal(first.acked, 1);
  assert.equal(first.results[0].reconciliationRequired, true);
  const count = h.calls.length;
  const replay = await runQueueMessage(h.env);
  assert.equal(replay.retried, 0);
  assert.equal(replay.results[0].reconciliationRequired, true);
  assert.equal(h.calls.length, count);
});

test('receipt timeout preserves transaction and storage identifiers without retrying', async () => {
  const h = queueHarness({ waitFailure: true });
  const result = await runQueueMessage(h.env);
  assert.equal(result.retried, 0);
  assert.equal(result.results[0].reconciliationRequired, true);
  assert.equal(result.results[0].onChain.txHash, `0x${'56'.repeat(32)}`);
  assert.equal(result.results[0].onChain.storageId, Buffer.alloc(32, 7).toString('base64url'));
  assert.equal(h.submits(), 1);
});

test('post-submit KV failure preserves diagnostics and never retries a fresh submission', async () => {
  const h = queueHarness();
  const createContract = h.env.AGENT_BRIDGE_CONTRACT_FACTORY;
  h.env.AGENT_BRIDGE_CONTRACT_FACTORY = (...args) => {
    const contract = createContract(...args);
    return { submitResponses: async (...params) => {
      const tx = await contract.submitResponses(...params);
      h.kv.put = async () => { throw new Error('KV unavailable'); };
      return tx;
    } };
  };
  const result = await runQueueMessage(h.env);
  assert.equal(result.retried, 0);
  assert.equal(result.acked, 1);
  assert.equal(result.results[0].reconciliationRequired, true);
  assert.equal(result.results[0].onChain.txHash, `0x${'56'.repeat(32)}`);
  assert.equal(h.submits(), 1);
});

test('an unreadable existing record fails closed without submission', async () => {
  const h = queueHarness();
  await h.kv.put('telegram:submit-request:safe-retry', '{broken json');
  const result = await runQueueMessage(h.env);
  assert.equal(result.acked, 1);
  assert.equal(result.retried, 0);
  assert.equal(result.results[0].reason, 'submit_request_record_invalid');
  assert.equal(h.calls.length, 0);
});

test('failed bookkeeping after a safe auth failure may retry without submitting', async () => {
  const h = queueHarness({ fetchFailure: 503 });
  h.kv.put = async () => { throw new Error('KV write unavailable'); };
  const result = await runQueueMessage(h.env);
  assert.equal(result.retried, 1);
  assert.equal(result.acked, 0);
  assert.equal(result.results[0].reconciliationRequired, false);
  assert.equal(result.results[0].onChain.reason, 'worker_auth_failed');
  assert.equal(h.submits(), 0);
});
