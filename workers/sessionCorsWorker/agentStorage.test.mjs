import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentStorage, agentStoragePrefix } from './agent/storage.mjs';

const firstId = '0x11111111111111111111111111111111';
const secondId = '0x22222222222222222222222222222222';
const memory = () => {
  const rows = new Map();
  return { rows, get: async (key) => rows.get(key) ?? null,
    put: async (key, value) => rows.set(key, value), delete: async (key) => rows.delete(key),
    list: async ({ prefix, cursor = '', limit }) => {
      const keys = [...rows.keys()].filter((key) => key.startsWith(prefix)).sort();
      const offset = Number(cursor) || 0;
      return { keys: keys.slice(offset, offset + limit).map((name) => ({ name })),
        list_complete: offset + limit >= keys.length, cursor: String(offset + limit) };
    } };
};
const bind = (kv, sessionId) => createAgentStorage({ kv, sessionId, cursorSecret: 'fixture-cursor-signing-only' });

test('agent state stays within immutable session identity on a shared namespace', async () => {
  const kv = memory(); const a = bind(kv, firstId); const b = bind(kv, secondId);
  await a.put('draft:participant:request', 'first');
  await b.put('draft:participant:request', 'second');
  assert.equal(await a.get('draft:participant:request'), 'first');
  assert.equal(await b.get('draft:participant:request'), 'second');
  assert.deepEqual((await a.list()).keys.map((x) => x.name), ['draft:participant:request']);
  await a.delete('draft:participant:request');
  assert.equal(await b.get('draft:participant:request'), 'second');
  assert.ok([...kv.rows.keys()].every((key) => key.startsWith('ce-agent:')));
});

test('agent cursors bind both session and requested inner prefix', async () => {
  const kv = memory(); const a = bind(kv, firstId); const b = bind(kv, secondId);
  await a.put('draft:a', 'a'); await a.put('draft:b', 'b');
  const first = await a.list({ prefix: 'draft:', limit: 1 });
  const second = await a.list({ prefix: 'draft:', limit: 1, cursor: first.cursor });
  assert.deepEqual(second.keys.map((x) => x.name), ['draft:b']);
  await assert.rejects(b.list({ prefix: 'draft:', cursor: first.cursor }), /agent_cursor_invalid/);
  await assert.rejects(a.list({ prefix: 'credential:', cursor: first.cursor }), /agent_cursor_invalid/);
  await assert.rejects(a.list({ prefix: 'draft:', cursor: `${first.cursor}changed` }), /agent_cursor_invalid/);
});

test('provider leakage and incomplete cursor metadata fail closed', async () => {
  const kv = memory();
  kv.list = async () => ({ keys: [{ name: `${agentStoragePrefix(secondId)}draft:a` }], list_complete: true });
  await assert.rejects(bind(kv, firstId).list(), /agent_storage_scope_mismatch/);
  kv.list = async () => ({ keys: [], list_complete: false });
  await assert.rejects(bind(kv, firstId).list(), /agent_storage_cursor_missing/);
  assert.equal(createAgentStorage({ kv: {}, sessionId: firstId }), null);
  assert.throws(() => agentStoragePrefix('same-slug'), /agent_session_identity_invalid/);
});
