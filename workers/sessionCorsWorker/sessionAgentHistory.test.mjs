import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_AGENT_HISTORY_LIMITS, dispatchSessionAgentHistoryStore, isSessionAgentHistoryBackup, listSessionAgentHistory,
  restoreSessionAgentHistory, sessionAgentHistoryEntry,
} from './sessionAgentHistory.js';
import { SESSION_AGENT_LIMITS } from '../../shared/sessionAgent.mjs';
import { Wallet } from 'ethers';

import { dispatchAdminResultsAnalysisStatusRequest } from './adminResultsAnalysisDispatch.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, signedAdminRequest } from './sessionWorkerRuntimeFixture.mjs';
import { resolveTopLevelRouteSelection } from './topLevelRouteSelection.js';
import { FEATURES } from './workerCapabilities.js';
import { createDurableStorage } from './workerGroupTestFixture.mjs';

const ASKER = `0x${'ab'.repeat(20)}`;
const exchange = (extra = {}) => ({
  day: '2026-11-24',
  answers: 'general',
  question: 'What do people want?',
  answer: 'Shorter meetings.',
  ...extra,
});
const RECORDS = { audiences: [], history: true };

// The store as the session's coordinator runs it; the coordinator holds the
// session's setting as it is now, which `setting.current` stands for.
const createStore = () => {
  const { storage, store } = createDurableStorage();
  const setting = { current: RECORDS };
  const coordinator = { state: { storage }, readSessionConfigAuthority: async () => ({ config: { sessionAgent: setting.current } }) };
  const call = async (operation, payload = {}) => {
    const response = await dispatchSessionAgentHistoryStore(coordinator, operation, { slug: 'salon', ...payload });
    return { status: response.status, body: await response.json() };
  };
  const add = async (extra) => (await call('add', { entry: exchange(extra) })).body.id;
  return { storage, store, call, add, setting };
};

test('a stored chat keeps the exchange and nothing about who asked, unless they chose that', async () => {
  const { call, add, store } = createStore();
  await add();
  await add({ by: ASKER.toUpperCase().replace('0X', '0x'), name: '  Sam’s agent ' });
  const { entries, stored } = (await call('list')).body;
  assert.equal(stored, 2);
  // Newest first.
  assert.deepEqual(entries.map(({ id, ...entry }) => entry), [
    { ...exchange(), by: ASKER, name: 'Sam’s agent' },
    exchange(),
  ]);
  // Nothing else is written: no time of day, and no asker on the anonymous one.
  const anonymous = [...store].find(([key, value]) => key.startsWith('session-agent-history-v1:') && !value.by)[1];
  assert.deepEqual(Object.keys(anonymous).sort(), ['answer', 'answers', 'day', 'question']);
  assert.ok(entries.every((entry) => /^\d{12}$/.test(entry.id)));
});

test('nothing is stored once the session’s setting, as its coordinator holds it, no longer records chats', async () => {
  const { call, add, setting } = createStore();
  await add({ question: 'While it was on?' });
  for (const off of [{ audiences: [] }, { audiences: [], history: false }, null, { audiences: [], history: 'yes' }]) {
    setting.current = off;
    assert.deepEqual(await call('add', { entry: exchange() }), { status: 409, body: { ok: false, reason: 'session_agent_history_off' } });
  }
  // What was stored stays, to be read and cleared.
  assert.deepEqual((await call('list')).body.entries.map((entry) => entry.question), ['While it was on?']);
  assert.equal((await call('delete', { through: '000000000001' })).body.deleted, 1);
});

test('a chat says whom its answer was fit for: an admin, or the groups whose files it drew on', async () => {
  const { call, add } = createStore();
  await add({ scope: 'admin' });
  await add({ groups: ['salon', 'hosts.2026', 'salon'] });
  const [groups, admin] = (await call('list')).body.entries;
  assert.deepEqual([admin.scope, admin.groups, groups.scope, groups.groups], ['admin', undefined, undefined, ['hosts.2026', 'salon']]);
  for (const bad of [{ scope: 'member' }, { scope: true }, { groups: 'salon' }, { groups: ['Not An Id'] }, { groups: Array.from({ length: 41 }, (_, i) => `g${i}`) }]) {
    assert.equal((await call('add', { entry: exchange(bad) })).status, 400, JSON.stringify(bad).slice(0, 60));
  }
});

test('only a whole exchange is stored, and what was sent beside it is dropped', async () => {
  const { call } = createStore();
  for (const bad of [
    { day: '24 Nov' }, { day: '2026-11-24T10:00:00Z' }, { answers: 'admin' }, { question: ' ' }, { answer: '' },
    { question: 'x'.repeat(SESSION_AGENT_LIMITS.questionChars + 1) }, { answer: 'x'.repeat(SESSION_AGENT_LIMITS.answerChars + 1) },
    { by: 'sam' }, { by: '0x12' }, { name: 'x'.repeat(SESSION_AGENT_LIMITS.nameChars + 1) },
  ]) {
    assert.deepEqual(await call('add', { entry: exchange(bad) }), { status: 400, body: { ok: false, reason: 'session_agent_history_invalid' } }, JSON.stringify(bad));
  }
  assert.equal((await call('add', {})).status, 400);
  assert.equal((await call('list')).body.stored, 0);
  // An address or anything else sent under another name never reaches storage, nor how much the answer drew on,
  // which differs by who asks.
  assert.deepEqual(
    sessionAgentHistoryEntry(exchange({ address: ASKER, asker: ASKER, ip: '203.0.113.7', askedAt: '10:00', read: { context: 4, results: true, answers: 1 } })),
    exchange(),
  );
});

test('pages run newest first, and a cursor carries on where the last page stopped', async () => {
  const { call, add } = createStore();
  const ids = [];
  for (let index = 0; index < 5; index += 1) ids.push(await add({ question: `Question ${index}` }));
  const first = (await call('list', { limit: 2 })).body;
  const second = (await call('list', { limit: 2, cursor: first.cursor })).body;
  const third = (await call('list', { limit: 2, cursor: second.cursor })).body;
  assert.deepEqual([...first.entries, ...second.entries, ...third.entries].map((entry) => entry.id), [...ids].reverse());
  assert.equal(third.cursor, undefined);
  for (const bad of [{ limit: 0 }, { limit: SESSION_AGENT_HISTORY_LIMITS.page + 1 }, { cursor: 'nope' }]) {
    assert.equal((await call('list', bad)).status, 400, JSON.stringify(bad));
  }
});

test('an admin deletes named chats, or every one up to the newest they read', async () => {
  const { call, add, storage } = createStore();
  const [a, b, c] = [await add({ question: 'A?' }), await add({ question: 'B?' }), await add({ question: 'C?' })];
  assert.deepEqual((await call('delete', { ids: [b, b, '000000009999'] })).body, { ok: true, deleted: 1, stored: 2 });
  // One stored after the admin's read survives a clear.
  const later = await add({ question: 'D?' });
  assert.deepEqual((await call('delete', { through: c })).body, { ok: true, deleted: 2, stored: 1 });
  assert.deepEqual((await listSessionAgentHistory(storage)).map((entry) => [entry.id, entry.question]), [[later, 'D?']]);
  for (const bad of [{}, { ids: [] }, { ids: ['x'] }, { ids: [a], through: a }, { through: 'x' }]) {
    assert.equal((await call('delete', bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call('rename')).status, 404);
});

test('past the most a session keeps, the oldest chats go first', async () => {
  const { call, add, storage } = createStore();
  // Start just under the cap: the count and the next id are all the store keeps beside the entries.
  await storage.put('session-agent-history-meta-v1', { next: 10_000, stored: SESSION_AGENT_HISTORY_LIMITS.stored - 2 });
  const [first, second, third] = [await add({ question: 'First' }), await add({ question: 'Second' }), await add({ question: 'Third' })];
  assert.deepEqual([first, second, third], ['000000010001', '000000010002', '000000010003']);
  assert.deepEqual((await listSessionAgentHistory(storage)).map((entry) => entry.question), ['Second', 'Third']);
  assert.equal((await call('list')).body.stored, SESSION_AGENT_HISTORY_LIMITS.stored);

  // While a backup runs it holds the chats it began with, so none is dropped under it;
  // the first chat stored after it brings the session back to its limit.
  await storage.put('backup-export-lease', { since: Date.now(), until: Date.now() + 60_000 });
  await add({ question: 'Fourth' });
  await add({ question: 'Fifth' });
  assert.deepEqual((await listSessionAgentHistory(storage)).map((entry) => entry.question), ['Second', 'Third', 'Fourth', 'Fifth']);
  await storage.put('backup-export-lease', { since: 0, until: Date.now() - 1 });
  await add({ question: 'Sixth' });
  assert.deepEqual((await listSessionAgentHistory(storage)).map((entry) => entry.question), ['Fifth', 'Sixth']);
  assert.equal((await call('list')).body.stored, SESSION_AGENT_HISTORY_LIMITS.stored);
});

test('the export reads every stored chat at once, oldest first', async () => {
  const { call, add } = createStore();
  const ids = [await add({ question: 'A?' }), await add({ question: 'B?', by: ASKER })];
  const { entries } = (await call('all')).body;
  assert.deepEqual(entries, [{ id: ids[0], ...exchange({ question: 'A?' }) }, { id: ids[1], ...exchange({ question: 'B?', by: ASKER }) }]);
});

test('a backup’s chats go back under their own ids, and the next chat stored follows them', async () => {
  const source = createStore();
  await source.add({ question: 'A?' });
  await source.add({ question: 'B?', name: 'Sam' });
  await source.call('delete', { ids: ['000000000001'] });
  await source.add({ question: 'C?' });
  const backup = await listSessionAgentHistory(source.storage);
  assert.deepEqual(backup.map((entry) => entry.id), ['000000000002', '000000000003']);
  assert.equal(isSessionAgentHistoryBackup(backup), true);

  const target = createStore();
  const journaled = [];
  const first = await restoreSessionAgentHistory(target.storage, backup, async (key) => { journaled.push(key); });
  assert.deepEqual(first, { written: 2, skipped: 0, conflicts: [] });
  // Each key is told before it is first written, the count's too, so an abandoned restore can take them out.
  assert.deepEqual(journaled, ['session-agent-history-v1:000000000002', 'session-agent-history-v1:000000000003', 'session-agent-history-meta-v1']);
  assert.deepEqual(await listSessionAgentHistory(target.storage), backup);
  assert.equal((await target.call('list')).body.stored, 2);
  // The same restore again writes nothing.
  assert.deepEqual(await restoreSessionAgentHistory(target.storage, backup, async (key) => { journaled.push(key); }), { written: 0, skipped: 2, conflicts: [] });
  assert.equal(journaled.length, 3);
  assert.equal(await target.add({ question: 'D?' }), '000000000004');
  assert.equal((await target.call('list')).body.stored, 3);
});

test('a target holding a different chat under a backup’s id keeps its own, and nothing is written', async () => {
  const source = createStore();
  await source.add({ question: 'A?' });
  await source.add({ question: 'B?' });
  const backup = await listSessionAgentHistory(source.storage);
  const target = createStore();
  await target.add({ question: 'The target’s own chat' });
  const result = await restoreSessionAgentHistory(target.storage, backup);
  assert.deepEqual(result, { written: 0, skipped: 0, conflicts: ['session-agent-history-v1:000000000001'] });
  assert.deepEqual((await listSessionAgentHistory(target.storage)).map((entry) => entry.question), ['The target’s own chat']);
  assert.equal((await target.call('list')).body.stored, 1);
});

test('a backup’s chats must each be a whole exchange under its own id, in order', () => {
  const row = (id, extra = {}) => ({ id, ...exchange(extra) });
  assert.equal(isSessionAgentHistoryBackup([]), true);
  assert.equal(isSessionAgentHistoryBackup([row('000000000001'), row('000000000002', { by: ASKER, name: 'Sam' })]), true);
  assert.equal(isSessionAgentHistoryBackup([row('000000000001', { scope: 'admin' }), row('000000000002', { groups: ['a', 'b'] })]), true);
  for (const bad of [
    [row('000000000001', { scope: 'member' })], [row('000000000001', { groups: ['b', 'a'] })], [row('000000000001', { groups: [] })],
    null, {}, [row('1')], [row('000000000002'), row('000000000001')], [row('000000000001'), row('000000000001')],
    [row('000000000001', { by: ASKER.toUpperCase().replace('0X', '0x') })], [row('000000000001', { askedAt: '10:00' })],
    [row('000000000001', { question: ' padded ' })], [{ id: '000000000001' }], [row('000000000001', { answers: 'admin' })],
    Array.from({ length: SESSION_AGENT_HISTORY_LIMITS.stored + 1 }, (_, index) => row(String(index + 1).padStart(12, '0'))),
  ]) assert.equal(isSessionAgentHistoryBackup(bad), false, JSON.stringify(bad)?.slice(0, 80));
});

test('through the whole Worker: a full admin reads stored chats a page at a time and clears them; no one else does', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('No network in this test.'); });
  assert.ok(FEATURES.includes('session_agent_chats'));
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/admin/session-agent/chats', method: 'GET', request: new Request('https://worker.example/admin/session-agent/chats'),
      deps: { toStr: (value) => String(value ?? '') },
    }),
    { kind: 'admin-session-agent-chats' },
  );
  const resultsAdmin = Wallet.createRandom();
  const { admin, env } = createSessionEnv({
    configOverrides: { resultsAdminAddresses: [resultsAdmin.address.toLowerCase()], sessionAgent: RECORDS },
  });
  for (const extra of [{ question: 'First?' }, { question: 'Second?', by: ASKER, name: 'Sam' }, { question: 'Third?' }]) {
    const added = await callSessionConfigCoordinator({ env, slug: SLUG, path: 'session-agent-history/add', entry: exchange(extra) });
    assert.equal(added.ok, true, JSON.stringify(added));
  }
  const token = await login({ env, wallet: admin });
  const read = async (signIn, query = '') => {
    const response = await fetchWorker(makeRequest(`/admin/session-agent/chats?slug=${SLUG}${query}`, { token: signIn }), env);
    return { ...(await readJson(response.clone())), cache: response.headers.get('cache-control') };
  };
  const listed = await read(token);
  assert.deepEqual([listed.status, listed.cache, listed.body.stored], [200, 'private, no-store', 3]);
  assert.deepEqual(listed.body.entries.map(({ question, by, name }) => [question, by, name]), [
    ['Third?', undefined, undefined], ['Second?', ASKER, 'Sam'], ['First?', undefined, undefined],
  ]);
  const page1 = await read(token, '&limit=2');
  const page2 = await read(token, `&limit=2&cursor=${page1.body.cursor}`);
  assert.deepEqual([...page1.body.entries, ...page2.body.entries], listed.body.entries);
  assert.deepEqual([(await read(token, '&cursor=nope')).status, (await read('')).status], [400, 401]);
  for (const wallet of [resultsAdmin, Wallet.createRandom()]) {
    const refused = await read(await login({ env, wallet }));
    assert.deepEqual([refused.status, refused.body, refused.cache],
      [403, { error: 'Only the session’s admins can read stored chats.' }, 'private, no-store']);
  }

  const newest = listed.body.entries[0].id;
  const refused = await signedAdminRequest({ env, wallet: resultsAdmin, action: 'session-agent/chats/delete', body: { through: newest } });
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  const nameless = await signedAdminRequest({ env, wallet: admin, action: 'session-agent/chats/delete', body: {} });
  assert.deepEqual([nameless.status, nameless.body.error], [400, 'Name the chats to delete.']);
  const one = await signedAdminRequest({ env, wallet: admin, action: 'session-agent/chats/delete', body: { ids: [listed.body.entries[1].id] } });
  assert.deepEqual([one.status, one.body.deleted, one.body.stored], [200, 1, 2]);
  const cleared = await signedAdminRequest({ env, wallet: admin, action: 'session-agent/chats/delete', body: { through: newest } });
  assert.deepEqual([cleared.status, cleared.body.deleted, cleared.body.stored], [200, 2, 0]);
  assert.deepEqual((await read(token)).body.entries, []);
});

test('an agent key, even one minted for an admin, does not read stored chats', async () => {
  const reached = [];
  const response = await dispatchAdminResultsAnalysisStatusRequest({
    chats: true,
    request: new Request('https://worker.example/admin/session-agent/chats?slug=salon'),
    env: {},
    baseHeaders: {},
    slug: 'salon',
    deps: {
      requireAuth: async () => ({ ok: true, slug: 'salon', payload: { sub: ASKER, agentSource: 'agent-key' } }),
      validateAdmin: async () => (reached.push('validateAdmin'), true),
      readCurrentSessionConfig: async () => (reached.push('config'), { config: {} }),
      callSessionAgentHistoryStore: async () => (reached.push('store'), { ok: true, body: { entries: [] } }),
      json: (payload, status, headers) => ({ status, payload, headers }),
    },
  });
  assert.deepEqual([response.status, response.payload.error, response.headers.get('cache-control')],
    [403, 'Only the session’s admins can read stored chats.', 'private, no-store']);
  assert.deepEqual(reached, []);
});
