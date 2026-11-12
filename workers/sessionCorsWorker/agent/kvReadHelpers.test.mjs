import test from 'node:test';
import assert from 'node:assert/strict';
import { listKvRecordsByPrefix } from './kvReadHelpers.mjs';
import { agentStoragePrefix, createAgentStorage } from './storage.mjs';

class MemoryKv {
  constructor(entries = [], {
    pageSize = Infinity,
    rejectList = false,
    rejectGetKeys = [],
    maxReplyBytes = 25 * 1000 * 1000,
  } = {}) {
    this.store = new Map(entries);
    this.pageSize = pageSize;
    this.rejectList = rejectList;
    this.rejectGetKeys = new Set(rejectGetKeys);
    this.maxReplyBytes = maxReplyBytes;
    this.listCalls = [];
    this.getCalls = [];
  }

  async list(options = {}) {
    if (this.rejectList) throw new Error('list failed');
    const { prefix = '', limit = 1000, cursor = '' } = options;
    this.listCalls.push({ prefix, limit, cursor });
    const keys = Array.from(this.store.keys()).filter((key) => key.startsWith(prefix));
    const start = cursor ? Number(cursor) : 0;
    const cappedLimit = Math.min(limit, this.pageSize);
    const pageKeys = keys.slice(start, start + cappedLimit);
    const next = start + pageKeys.length;
    return {
      keys: pageKeys.map((name) => ({ name })),
      list_complete: next >= keys.length,
      cursor: String(next),
    };
  }

  // Like the KV binding, an array of up to 100 keys is one bulk read, and a
  // reply over 25 MB fails.
  async get(keys) {
    this.getCalls.push(keys);
    if (!Array.isArray(keys) || keys.length > 100) throw new Error('expected a bulk read');
    if (keys.some((key) => this.rejectGetKeys.has(key))) throw new Error('get failed');
    const values = new Map(keys.map((key) => [key, this.store.get(key) ?? null]));
    const replyBytes = [...values.values()].reduce((sum, value) => sum + (value?.length || 0), 0);
    if (replyBytes > this.maxReplyBytes) throw new Error('KV GET_BULK failed: 413 Payload Too Large');
    return values;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async delete(key) {
    this.store.delete(key);
  }
}

test('listKvRecordsByPrefix preserves paged KV order and adds the source key', async () => {
  const kv = new MemoryKv([
    ['record:a', '{"id":"a","createdAt":"2026-09-05T10:00:00.000Z"}'],
    ['record:b', '{"id":"b","key":"stored-key"}'],
    ['other:c', '{"id":"c"}'],
    ['record:d', '{"id":"d"}'],
  ], { pageSize: 2 });

  const records = await listKvRecordsByPrefix({ AGENT_ACTION_KV: kv }, 'record:', { limit: Infinity });

  assert.deepEqual(records, [
    { id: 'a', createdAt: '2026-09-05T10:00:00.000Z', key: 'record:a' },
    { id: 'b', key: 'record:b' },
    { id: 'd', key: 'record:d' },
  ]);
  assert.deepEqual(kv.listCalls, [
    { prefix: 'record:', limit: 1000, cursor: '' },
    { prefix: 'record:', limit: 1000, cursor: '2' },
  ]);
});

test('listKvRecordsByPrefix skips malformed values but rejects unavailable KV records', async () => {
  const kv = new MemoryKv([
    ['record:valid', '{"ok":true}'],
    ['record:broken', '{"ok":'],
    ['record:array', '[{"ok":true}]'],
    ['record:string', '"plain"'],
    ['record:missing', '{"ok":false}'],
  ], { rejectGetKeys: ['record:missing'] });

  await assert.rejects(listKvRecordsByPrefix({ AGENT_ACTION_KV: kv }, 'record:', { limit: Infinity }), /get failed/);
  // The failed batch is read again in halves until the failing key fails alone.
  assert.deepEqual(kv.getCalls, [
    ['record:valid', 'record:broken', 'record:array', 'record:string', 'record:missing'],
    ['record:valid', 'record:broken', 'record:array'],
    ['record:string', 'record:missing'],
    ['record:string'],
    ['record:missing'],
  ]);
});

test('listKvRecordsByPrefix reads a bulk reply over 25 MB in smaller parts', async () => {
  // About the largest answer record one 512 KiB request can store. Agent
  // storage reports the refusal only as agent_storage_unavailable.
  const comments = 'x'.repeat(512 * 1024);
  const sessionId = `0x${'1'.repeat(32)}`;
  const kv = new MemoryKv(Array.from({ length: 60 }, (_, index) => [
    `${agentStoragePrefix(sessionId)}record:${String(index).padStart(2, '0')}`, JSON.stringify({ index, comments }),
  ]));

  const records = await listKvRecordsByPrefix({ AGENT_ACTION_KV: createAgentStorage({ kv, sessionId }) }, 'record:', {
    select: (record) => ({ index: record.index }),
  });

  assert.deepEqual(records.map((record) => record.index), Array.from({ length: 60 }, (_, index) => index));
  assert.deepEqual(kv.getCalls.map((keys) => keys.length), [60, 30, 30]);
});

test('listKvRecordsByPrefix reads each listed page 100 keys at a time and keeps selected rows', async () => {
  const kv = new MemoryKv(Array.from({ length: 1001 }, (_, index) => [
    `record:${String(index).padStart(4, '0')}`, JSON.stringify({ index }),
  ]));

  const records = await listKvRecordsByPrefix({ AGENT_ACTION_KV: kv }, 'record:', {
    select: (record) => (record.index % 2 ? null : { index: record.index }),
  });

  assert.equal(records.length, 501);
  assert.deepEqual(records.at(-1), { index: 1000 });
  assert.equal(kv.listCalls.length, 2);
  assert.deepEqual(kv.getCalls.map((keys) => keys.length), [...Array(10).fill(100), 1]);
});

test('listKvRecordsByPrefix respects finite limits and caps infinite page reads at 1000', async () => {
  const kv = new MemoryKv([
    ['record:1', '{"id":1}'],
    ['record:2', '{"id":2}'],
    ['record:3', '{"id":3}'],
  ]);

  const limited = await listKvRecordsByPrefix({ AGENT_ACTION_KV: kv }, 'record:', { limit: '2.8' });
  assert.deepEqual(limited, [
    { id: 1, key: 'record:1' },
    { id: 2, key: 'record:2' },
  ]);
  assert.equal(kv.listCalls[0].limit, 2);

  const all = await listKvRecordsByPrefix({ AGENT_ACTION_KV: kv }, 'record:', { limit: Infinity });
  assert.equal(all.length, 3);
  assert.equal(kv.listCalls[1].limit, 1000);
});

test('listKvRecordsByPrefix propagates KV provider failures', async () => {
  assert.deepEqual(await listKvRecordsByPrefix({}, 'record:', { limit: Infinity }), []);
  await assert.rejects(listKvRecordsByPrefix({
    AGENT_ACTION_KV: new MemoryKv([], { rejectList: true }),
  }, 'record:', { limit: Infinity }), /list failed/);
});

test('listKvRecordsByPrefix supports caller-specific JSON decoding', async () => {
  const kv = new MemoryKv([
    ['record:encoded', 'encoded'],
  ]);
  const parseCalls = [];
  const records = await listKvRecordsByPrefix({ AGENT_ACTION_KV: kv }, 'record:', {
    limit: Infinity,
    parseJson(value, fallback) {
      parseCalls.push({ value, fallback });
      return value === 'encoded' ? { decoded: true } : fallback;
    },
  });

  assert.deepEqual(records, [{ decoded: true, key: 'record:encoded' }]);
  assert.deepEqual(parseCalls, [{ value: 'encoded', fallback: null }]);
});
