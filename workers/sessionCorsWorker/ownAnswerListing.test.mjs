import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { buildIndexKey, storageIndexPutOptions } from './storageRouteExecution.js';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

// A person's own answers (`mine=true`) are found by their author in the index's
// list metadata, so other people's answers are passed over unread.
const session = { sessionId: SESSION_ID, sessionSlug: SLUG };
const answer = (questionID) => ({ questionID, answer: { value: 'Agree', encrypted: false }, ...session });

const setup = async () => {
  const created = createSessionEnv();
  const { env } = created;
  const kv = env.CE_STORAGE_INDEX_KV;
  const admin = await login({ env, wallet: created.admin });
  for (const id of ['q-1', 'q-2']) {
    assert.equal((await uploadJson({ env, token: admin, resource: 'questions', data: { id, type: 'binary', prompt: `Statement ${id}`, ...session } })).status, 200);
  }
  const me = Wallet.createRandom();
  const token = await login({ env, wallet: me });
  const other = await login({ env, wallet: Wallet.createRandom() });
  const template = await uploadJson({ env, token: other, resource: 'responses', data: answer('q-1') });
  const base = JSON.parse(await kv.get(buildIndexKey({ slug: SLUG, resource: 'responses', id: template.body.id })));
  // Other people's answers, as the upload route indexes them, or as rows
  // written before answers carried their author.
  const seed = async (count, { withAuthor = true, prefix = 'x', responder } = {}) => {
    for (let index = 0; index < count; index += 1) {
      const metadata = { ...base, id: `${base.id.slice(0, 20)}${prefix}${index}`, responder: responder || `0x${(index + 1).toString(16).padStart(40, '0')}` };
      await kv.put(buildIndexKey({ slug: SLUG, resource: 'responses', id: metadata.id }), JSON.stringify(metadata), withAuthor ? storageIndexPutOptions(metadata) : undefined);
    }
  };
  let kvReads = 0;
  let bulk = false;
  const get = kv.get.bind(kv);
  kv.get = async (key, type) => {
    if (bulk) return get(key, type);
    kvReads += Array.isArray(key) ? key.length : 1;
    bulk = Array.isArray(key);
    try { return await get(key, type); } finally { bulk = false; }
  };
  const listMine = async () => {
    let cursor = '';
    let requests = 0;
    const items = [];
    do {
      const page = await readJson(await fetchWorker(makeRequest(`/storage/list?resource=responses&mine=true&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { token }), env));
      assert.equal(page.status, 200, JSON.stringify(page.body));
      requests += 1;
      items.push(...page.body.items);
      cursor = page.body.listComplete ? '' : page.body.cursor;
    } while (cursor);
    return { requests, items, responders: new Set(items.map((item) => item.metadata.responder)) };
  };
  return { env, kv, me: me.address.toLowerCase(), token, seed, listMine, reads: () => kvReads, upload: (id) => uploadJson({ env, token, resource: 'responses', data: answer(id) }) };
};

test('a person finds their own answers among 34,000 others in a few requests, reading only their own rows', async () => {
  const s = await setup();
  await s.seed(34_000);
  assert.equal((await s.upload('q-1')).status, 200);
  assert.equal((await s.upload('q-2')).status, 200);
  const before = s.reads();
  const mine = await s.listMine();
  assert.equal(mine.items.length, 2);
  assert.deepEqual([...mine.responders], [s.me]);
  assert.ok(mine.requests <= 4, `${mine.requests} requests`);
  assert.equal(s.reads() - before, 2, 'only the two own rows are read');
});

test('rows stored before answers named their author are still read and checked', async () => {
  const s = await setup();
  await s.seed(2_800, { withAuthor: false });
  await s.seed(3, { withAuthor: false, prefix: 'mine', responder: s.me });
  assert.equal((await s.upload('q-1')).status, 200);
  const mine = await s.listMine();
  assert.equal(mine.items.length, 4);
  assert.deepEqual([...mine.responders], [s.me]);
  assert.ok(mine.requests <= 3, `${mine.requests} requests`);
});

test('list metadata naming a person never returns someone else\'s answer to them', async () => {
  const s = await setup();
  // The stored row is another person's, whatever its list metadata says.
  await s.seed(1, { prefix: 'forged' });
  const [key] = [...(await s.kv.list({ prefix: buildIndexKey({ slug: SLUG, resource: 'responses', id: 'z' }).replace(/z$/, '') })).keys]
    .map((entry) => entry.name).filter((name) => name.includes('forged'));
  await s.kv.put(key, await s.kv.get(key), { metadata: { responder: s.me } });
  assert.equal((await s.upload('q-1')).status, 200);
  const mine = await s.listMine();
  assert.equal(mine.items.length, 1);
  assert.deepEqual([...mine.responders], [s.me]);
});
