// Many people joining one group at once: a QR code shown to a room. Joins of
// different people must run side by side, not one after another, while the
// member limit, a repeated join and a stranded group change stay exact.
import test from 'node:test';
import assert from 'node:assert/strict';

import { SessionWriteCoordinator, executeCoordinatedSessionConfigMutation } from './sessionWriteCoordinator.js';
import { executeCoordinatedWorkerGroupMutation, readCoordinatedWorkerGroupCatalog, readCoordinatedWorkerGroupMemberships } from './workerGroups.js';

const ADMIN = `0x${'aa'.repeat(20)}`;
const SESSION_ID = `0x${'ab'.repeat(16)}`;
const principal = (index) => ({ kind: 'evm_address', address: `0x${(index + 1).toString(16).padStart(40, '0')}` });

// Durable Object storage whose transactions run one at a time, as the
// runtime's input gates make them.
const createDurableStorage = () => {
  const store = new Map();
  let tail = Promise.resolve();
  const storage = {
    get: async (key) => structuredClone(store.get(key)),
    put: async (key, value) => { store.set(key, structuredClone(value)); },
    delete: async (key) => store.delete(key),
    list: async ({ prefix = '' } = {}) => new Map([...store].filter(([key]) => key.startsWith(prefix))),
    transaction: (callback) => {
      const run = tail.then(async () => {
        const staged = new Map([...store].map(([key, value]) => [key, structuredClone(value)]));
        const result = await callback({
          get: async (key) => structuredClone(staged.get(key)),
          put: async (key, value) => { staged.set(key, structuredClone(value)); },
          delete: async (key) => staged.delete(key),
        });
        store.clear();
        for (const [key, value] of staged) store.set(key, value);
        return result;
      });
      tail = run.catch(() => undefined);
      return run;
    },
  };
  return { storage, store };
};

// KV with a round trip on every call, counting how many calls overlap.
const createSlowKv = (values, { delayMs = 5 } = {}) => {
  let inFlight = 0;
  const kv = {
    maxInFlight: 0,
    failPut: null,
    async call(work) {
      inFlight += 1;
      kv.maxInFlight = Math.max(kv.maxInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return work();
      } finally {
        inFlight -= 1;
      }
    },
    get: (key) => kv.call(() => values.get(key) ?? null),
    put: (key, value) => kv.call(() => {
      if (kv.failPut?.(key)) { kv.failPut = null; throw new Error('KV write unavailable'); }
      values.set(key, value);
    }),
    delete: (key) => kv.call(() => { values.delete(key); }),
    list: ({ prefix = '' } = {}) => kv.call(() => ({
      keys: [...values.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    })),
  };
  return kv;
};

const createFixture = async ({ memberLimit } = {}) => {
  const sessionConfig = { slug: 'fixture', adminAddress: ADMIN, sessionId: SESSION_ID };
  const values = new Map([['session:fixture:config', JSON.stringify(sessionConfig)]]);
  const kv = createSlowKv(values);
  const env = { CE_STORAGE_ENVELOPE_KEK: 'synthetic-test-kek', GROUP_KV: kv, CE_WORKER_GROUPS_BOOTSTRAP: 'fresh-template-v2' };
  const config = new SessionWriteCoordinator({ storage: createDurableStorage().storage }, env);
  env.CE_SESSION_COORDINATOR = { idFromName: (name) => name, get: () => ({ fetch: (url, init) => config.fetch(new Request(url, init)) }) };
  const groupState = createDurableStorage();
  const groups = new SessionWriteCoordinator({ storage: groupState.storage }, env);
  env.CE_WORKER_GROUP_COORDINATOR = { idFromName: (name) => name, get: () => ({ fetch: (url, init) => groups.fetch(new Request(url, init)) }) };
  const current = await (await config.fetch(new Request('https://session-coordinator.internal/session-config/current', {
    method: 'POST', body: JSON.stringify({ slug: 'fixture' }),
  }))).json();
  const expectedAuthority = { actor: ADMIN, revision: current.revision, authzEpoch: current.config?.authzEpoch ?? 0 };
  const mutate = (args) => executeCoordinatedWorkerGroupMutation({ env, slug: 'fixture', sessionId: SESSION_ID, expectedAuthority,
    groupId: 'salon', actorPrincipal: principal(-1), ...args });
  // A config change, such as a new admin or signing everyone out, moves the
  // session's authority on; proofs read before it no longer admit anything.
  const changeConfig = () => executeCoordinatedSessionConfigMutation({ env, slug: 'fixture', existingConfig: sessionConfig,
    expectedAuthority, mutation: { kind: 'set-config', incomingConfig: { adminAddress: `0x${'bb'.repeat(20)}` } } });
  const memberships = async (index) => (await readCoordinatedWorkerGroupMemberships({ env, slug: 'fixture', sessionId: SESSION_ID,
    principal: principal(index) })).groups?.map((group) => group.groupId);
  const created = await mutate({ operation: 'create', principal: undefined,
    input: { groupId: 'salon', label: 'Salon', joinMode: 'open', ...(memberLimit ? { memberLimit } : {}) } });
  assert.equal(created.ok, true, JSON.stringify(created));
  const join = (index) => mutate({ operation: 'join', principal: principal(index), actorPrincipal: principal(index) });
  const groupRecord = () => [...groupState.store].find(([key]) => key.endsWith(':salon') && key.includes('group'))?.[1];
  const memberKeys = () => [...values.keys()].filter((key) => key.startsWith('ce-worker-group-member:'));
  const catalog = (index) => readCoordinatedWorkerGroupCatalog({ env, slug: 'fixture', sessionId: SESSION_ID, groupIds: ['salon'],
    principal: principal(index) });
  const activeMembers = () => [...groupState.store].filter(([key, value]) => key.includes('member') && value?.state === 'active').length;
  return { kv, env, mutate, join, groupRecord, memberKeys, groupState, changeConfig, memberships, catalog, activeMembers };
};

test('a hundred people joining one group at once all get in, side by side', async () => {
  const f = await createFixture();
  f.kv.maxInFlight = 0;
  const results = await Promise.all(Array.from({ length: 100 }, (_, index) => f.join(index)));
  assert.deepEqual(results.filter((result) => !result.ok), []);
  assert.equal(f.groupRecord().memberCount, 100);
  assert.equal(f.memberKeys().length, 100);
  // One at a time, at most one KV call is ever in flight.
  assert.ok(f.kv.maxInFlight >= 50, `KV calls in flight at once: ${f.kv.maxInFlight}`);
});

test('joining at once never takes a group past its member limit', async () => {
  const f = await createFixture({ memberLimit: 10 });
  const results = await Promise.all(Array.from({ length: 30 }, (_, index) => f.join(index)));
  assert.equal(results.filter((result) => result.ok).length, 10);
  assert.deepEqual([...new Set(results.filter((result) => !result.ok).map((result) => result.reason))], ['worker_group_member_cap_exceeded']);
  assert.equal(f.groupRecord().memberCount, 10);
  assert.equal(f.memberKeys().length, 10);
});

test('one person joining several times at once is counted once', async () => {
  const f = await createFixture();
  const results = await Promise.all(Array.from({ length: 5 }, () => f.join(7)));
  assert.deepEqual(results.map((result) => result.ok), [true, true, true, true, true]);
  assert.equal(f.groupRecord().memberCount, 1);
  assert.equal(f.memberKeys().length, 1);
});

test('joins that meet a stranded group change recover it once, then all get in', async () => {
  const f = await createFixture();
  f.kv.failPut = (key) => key.startsWith('ce-worker-group:') && key.endsWith(':salon');
  const update = await f.mutate({ operation: 'update', input: { label: 'Salon 2' } });
  assert.equal(update.reason, 'worker_group_mutation_ambiguous');
  assert.equal(f.groupRecord().phase, 'updating');
  let replays = 0;
  const put = f.kv.put;
  f.kv.put = (key, value) => {
    if (key.startsWith('ce-worker-group:') && key.endsWith(':salon')) replays += 1;
    return put(key, value);
  };
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => f.join(index)));
  assert.deepEqual(results.filter((result) => !result.ok), []);
  assert.equal(replays, 1);
  assert.equal(f.groupRecord().phase, 'active');
  assert.equal(f.groupRecord().memberCount, 20);
});

// Requests reach the coordinator in no fixed order, as on the network. A join
// racing an admin change either lands before it, counted, or after it,
// refused and never written; once the change has finished, every join is refused.
const racedJoins = async (f, change, refusal) => {
  const racing = Array.from({ length: 20 }, (_, index) => f.join(index));
  const changed = await change();
  assert.equal(changed.ok, true, JSON.stringify(changed));
  const after = await Promise.all(Array.from({ length: 10 }, (_, index) => f.join(100 + index)));
  assert.deepEqual([...new Set(after.map((result) => result.reason))], [refusal]);
  const raced = await Promise.all(racing);
  assert.deepEqual(raced.filter((result) => !result.ok && result.reason !== refusal), []);
  return raced.filter((result) => result.ok).length;
};

test('a group deleted mid-burst takes no join after it', async () => {
  const f = await createFixture();
  const admitted = await racedJoins(f, () => f.mutate({ operation: 'delete' }), 'worker_group_not_found');
  assert.equal(f.memberKeys().length, admitted);
});

test('a removal racing the same person\'s repeated joins leaves the count true', async () => {
  const f = await createFixture();
  await Promise.all(Array.from({ length: 10 }, (_, index) => f.join(index)));
  const remove = () => f.mutate({ operation: 'remove-member', principal: principal(3), remover: 'admin' });
  const results = await Promise.all([f.join(3), remove(), f.join(3), remove(), f.join(3), f.join(20)]);
  // Arrival order decides whether person 3 ends in or out; a removal that finds
  // them already gone says so.
  assert.deepEqual(results.filter((result) => !result.ok && result.reason !== 'worker_group_member_not_found'), []);
  assert.equal(f.groupRecord().memberCount, f.activeMembers());
  assert.ok([10, 11].includes(f.groupRecord().memberCount));
});

test('a config change mid-burst refuses every join admitted under the old settings after it', async () => {
  const f = await createFixture();
  const admitted = await racedJoins(f, () => f.changeConfig(), 'session_authority_changed');
  assert.equal(f.groupRecord().memberCount, admitted);
  assert.equal(f.memberKeys().length, admitted);
});

test('reads during a burst show each finished join and never a refused one', async () => {
  const f = await createFixture({ memberLimit: 5 });
  const outcomes = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
    const result = await f.join(index);
    return { index, ok: result.ok, groups: await f.memberships(index) };
  }));
  assert.equal(outcomes.filter(({ ok }) => ok).length, 5);
  for (const { index, ok, groups } of outcomes) assert.deepEqual(groups, ok ? ['salon'] : [], `person ${index}`);
});

test('an edit that closes joining mid-burst admits exactly the joins before it', async () => {
  const f = await createFixture();
  const admitted = await racedJoins(f, () => f.mutate({ operation: 'update', input: { joinMode: 'admin_add' } }),
    'worker_group_join_denied');
  assert.equal(f.groupRecord().memberCount, admitted);
  assert.equal(f.memberKeys().length, admitted);
});

test('a resent join finishes an interrupted one, even after joining closes', async () => {
  const f = await createFixture();
  f.kv.failPut = (key) => key.startsWith('ce-worker-group-member:');
  assert.equal((await f.join(1)).reason, 'worker_group_mutation_ambiguous');
  assert.equal((await f.mutate({ operation: 'update', input: { joinMode: 'admin_add' } })).ok, true);
  const resent = await f.join(1);
  assert.equal(resent.ok, true, JSON.stringify(resent));
  assert.equal(resent.memberCount, 1);
  assert.deepEqual(await f.memberships(1), ['salon']);
  assert.equal((await f.join(2)).reason, 'worker_group_join_denied');
});

test('reads and joins that meet a stranded group change recover it once and all answer', async () => {
  const f = await createFixture();
  await Promise.all(Array.from({ length: 5 }, (_, index) => f.join(index)));
  f.kv.failPut = (key) => key.startsWith('ce-worker-group:') && key.endsWith(':salon');
  assert.equal((await f.mutate({ operation: 'update', input: { label: 'Salon 2' } })).reason, 'worker_group_mutation_ambiguous');
  let replays = 0;
  const put = f.kv.put;
  f.kv.put = (key, value) => {
    if (key.startsWith('ce-worker-group:') && key.endsWith(':salon')) replays += 1;
    return put(key, value);
  };
  const [memberships, catalogs, joins] = await Promise.all([
    Promise.all(Array.from({ length: 5 }, (_, index) => f.memberships(index))),
    Promise.all(Array.from({ length: 5 }, (_, index) => f.catalog(index))),
    Promise.all(Array.from({ length: 5 }, (_, index) => f.join(10 + index))),
  ]);
  assert.equal(replays, 1);
  assert.deepEqual(memberships, Array.from({ length: 5 }, () => ['salon']));
  assert.deepEqual(catalogs.filter((result) => !result.ok), []);
  assert.deepEqual(joins.filter((result) => !result.ok), []);
  assert.equal(f.groupRecord().memberCount, 10);
});

const until = async (check) => {
  for (let waited = 0; !check(); waited += 1) {
    if (waited > 1000) throw new Error('Timed out waiting.');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};
const settleFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Holds the first KV write of the given kind open; records every write's kind.
const holdWrites = (f) => {
  const writes = [];
  const holds = new Map();
  const put = f.kv.put;
  f.kv.put = async (key, value) => {
    const kind = key.startsWith('ce-worker-group-member:') ? 'member' : key.startsWith('ce-worker-group:') ? 'group' : 'other';
    writes.push(kind);
    const hold = holds.get(kind);
    if (hold) { holds.delete(kind); await hold; }
    return put(key, value);
  };
  const hold = (kind) => {
    let release;
    holds.set(kind, new Promise((resolve) => { release = resolve; }));
    return () => release();
  };
  return { writes, hold };
};

for (const operation of ['update', 'delete']) {
  test(`a group ${operation} waits for joins in flight`, async () => {
    const f = await createFixture();
    const { writes, hold } = holdWrites(f);
    const release = hold('member');
    const joining = f.join(1);
    await until(() => writes.includes('member'));
    const change = f.mutate({ operation, ...(operation === 'update' ? { input: { label: 'Salon 2' } } : {}) });
    await settleFor(30);
    assert.equal(writes.includes('group'), false, 'the change wrote while a join was still writing');
    release();
    assert.equal((await joining).ok, true);
    assert.equal((await change).ok, true);
  });
}

test('joins sent during a group update wait for it', async () => {
  const f = await createFixture();
  const { writes, hold } = holdWrites(f);
  const release = hold('group');
  const change = f.mutate({ operation: 'update', input: { label: 'Salon 2' } });
  await until(() => writes.includes('group'));
  const joining = f.join(1);
  await settleFor(30);
  assert.equal(writes.includes('member'), false, 'a join wrote while the update was still writing');
  release();
  assert.equal((await change).ok, true);
  assert.equal((await joining).ok, true);
});
