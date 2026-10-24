import test from 'node:test';
import assert from 'node:assert/strict';
import { listKvRecordsByPrefix } from './kvReadHelpers.mjs';

class MemoryKv {
  constructor(entries = [], {
    pageSize = Infinity,
    rejectList = false,
    rejectGetKeys = [],
  } = {}) {
    this.store = new Map(entries);
    this.pageSize = pageSize;
    this.rejectList = rejectList;
    this.rejectGetKeys = new Set(rejectGetKeys);
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

  async get(key) {
    this.getCalls.push(key);
    if (this.rejectGetKeys.has(key)) throw new Error('get failed');
    return this.store.get(key) || null;
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

test('listKvRecordsByPrefix skips malformed, array, scalar, and unreadable KV values', async () => {
  const kv = new MemoryKv([
    ['record:valid', '{"ok":true}'],
    ['record:broken', '{"ok":'],
    ['record:array', '[{"ok":true}]'],
    ['record:string', '"plain"'],
    ['record:missing', '{"ok":false}'],
  ], { rejectGetKeys: ['record:missing'] });

  const records = await listKvRecordsByPrefix({ AGENT_ACTION_KV: kv }, 'record:', { limit: Infinity });

  assert.deepEqual(records, [{ ok: true, key: 'record:valid' }]);
  assert.deepEqual(kv.getCalls, [
    'record:valid',
    'record:broken',
    'record:array',
    'record:string',
    'record:missing',
  ]);
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

test('listKvRecordsByPrefix returns empty results when KV access fails or is unavailable', async () => {
  assert.deepEqual(await listKvRecordsByPrefix({}, 'record:', { limit: Infinity }), []);
  assert.deepEqual(await listKvRecordsByPrefix({
    AGENT_ACTION_KV: new MemoryKv([], { rejectList: true }),
  }, 'record:', { limit: Infinity }), []);
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
