import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalAnswerKvKey,
  canonicalAnswerSessionKvKey,
  buildQueuedSubmitRecord,
  persistTelegramSubmitRecord,
  processTelegramSubmitQueueBatch,
  queueTelegramSubmitRecord,
  submitRequestSessionKvKey,
  submitRequestUserKvKey,
  telegramSubmitQueueEnabled,
} from './telegramSubmitQueue.mjs';

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

  assert.equal(telegramSubmitQueueEnabled(env), true);
  const queued = await queueTelegramSubmitRecord({
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

  const first = await persistTelegramSubmitRecord({
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
  const second = await persistTelegramSubmitRecord({
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
  const persisted = await persistTelegramSubmitRecord({
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

  const queued = await queueTelegramSubmitRecord({
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

  const result = await processTelegramSubmitQueueBatch({
    messages: [{
      body: { type: 'telegram_submit_direct_v1', record },
      ack: () => { acked = true; },
    }],
  }, {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'true',
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
