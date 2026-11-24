import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import test from 'node:test';

import {
  SESSION_CONFIG_COORDINATION_ERROR, callSessionConfigCoordinator, shareResultsAnalysisStatusRead,
} from './sessionConfigAuthority.js';
import { ensureSessionLitAuthorizationSigner } from './sessionLitAuthorizationCoordinator.js';

// Turns the event loop until `ready()`, running `each` before every turn, for at
// most five real seconds. Each coordinator call hashes its name off the main
// thread first, so a read starts some turns later, more on a slow machine, never
// a fixed few. Some tests mock setTimeout, so the bound is read from the clock.
const until = async (ready, each = () => {}) => {
  const deadline = performance.now() + 5_000;
  while (!ready() && performance.now() < deadline) {
    each();
    await new Promise((resolve) => setImmediate(resolve));
  }
};

// Whether `pending` settles within those five seconds, running `each` before every turn.
const settles = async (pending, each) => {
  let settled = false;
  const done = () => { settled = true; };
  pending.then(done, done);
  await until(() => settled, each);
  return settled;
};

// Moves mocked time on in small steps, so each waiting request looks again.
const advance = async (t, ms) => {
  for (let passed = 0; passed < ms; passed += 10) {
    t.mock.timers.tick(10);
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const SETTINGS = { ok: true, config: { slug: 'salon' }, revision: 3 };

// The runtime ends a read with the request that made it: the read never
// answers, and any other request awaiting it fails ("This promise was created
// by a request that has since ended"). So requests share a read in flight by
// waiting for its result on their own timers, never by awaiting it.
test('a config read whose request ended holds up others for at most a second, then one read serves them', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let calls = 0;
  const fetch = async () => (calls += 1) === 1 ? new Promise(() => {}) : Response.json(SETTINGS);
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch }) } };
  const read = () => callSessionConfigCoordinator({ env, slug: 'salon', path: 'current' });

  read();
  await until(() => calls === 1);
  assert.equal(calls, 1);
  const later = Promise.all([read(), read()]);
  await advance(t, 990);
  assert.equal(calls, 1, 'within the second they wait for the read in flight');
  await advance(t, 20);
  await until(() => calls === 2);
  assert.equal(calls, 2, 'after the second one of them reads again');
  // The other takes that read's answer when it next looks, well before the old ten seconds.
  const tickUntil = (ms) => () => { if (Date.now() < ms) t.mock.timers.tick(10); };
  assert.ok(await settles(later, tickUntil(1_500)), 'the later reads waited well past the second');
  for (const result of await later) assert.deepEqual(result.body, SETTINGS);
  assert.equal(calls, 2, 'one read served both');
});

test('a failed config read gives those waiting its busy answer, and the next request reads again', async () => {
  const held = [];
  const fetch = () => new Promise((resolve, reject) => held.push({ resolve, reject }));
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch }) } };
  const read = () => callSessionConfigCoordinator({ env, slug: 'salon', path: 'current', cache: true });

  const first = read();
  await until(() => held.length === 1);
  const second = read();
  held[0].reject(new Error('Network connection lost.'));
  // A coordinator that cannot answer one read would not answer another made at
  // once; each caller gets the busy answer that clients send again later.
  for (const result of await Promise.all([first, second])) {
    assert.equal(result.status, 503);
    assert.equal(result.body.error, SESSION_CONFIG_COORDINATION_ERROR);
  }
  assert.equal(held.length, 1);
  const next = read();
  await until(() => held.length === 2);
  held[1].resolve(Response.json(SETTINGS));
  assert.deepEqual((await next).body, SETTINGS);
});

test('an AI Views status read that ends without an answer fails only its own request; the next is shared, frozen', async () => {
  let calls = 0;
  let endFirst;
  const ended = new Error('This promise was created by a request that has since ended, so it can never settle.');
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({}) } };
  const read = () => shareResultsAnalysisStatusRead({
    env, slug: 'salon', cache: true,
    read: () => (calls += 1) === 1 ? new Promise((resolve, reject) => { endFirst = reject; }) : Promise.resolve({ ok: true, state: { jobState: 'succeeded' } }),
  });

  const first = read();
  await until(() => calls === 1);
  const later = Promise.all([read(), read()]);
  endFirst(ended);
  await assert.rejects(first, ended);
  assert.ok(await settles(later), 'the later reads never answered');
  const [one, two] = await later;
  assert.deepEqual(one, { ok: true, state: { jobState: 'succeeded' } });
  assert.equal(two, one, 'they share one read');
  assert.ok(Object.isFrozen(one.state));
  assert.equal(await read(), one, 'and reuse it within the second');
  assert.equal(calls, 2);
});

// A coordinator whose config reads wait until released, and whose other calls
// count as changes.
const controlled = () => {
  const held = [];
  let revision = 1;
  let reads = 0;
  const fetch = async (url) => {
    if (!new URL(url).pathname.endsWith('/current')) { revision += 1; return Response.json({ ok: false }); }
    reads += 1;
    const answered = revision;
    await new Promise((resolve) => held.push(resolve));
    return Response.json({ ok: true, config: { slug: 'salon' }, revision: answered });
  };
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch }) } };
  const cachedRead = () => callSessionConfigCoordinator({ env, slug: 'salon', path: 'current', cache: true });
  // Waits until `count` config reads are waiting to be released.
  const waiting = async (count) => {
    await until(() => held.length >= count);
    assert.equal(held.length, count, `expected ${count} config read(s) waiting`);
  };
  // Releases waiting reads until `pending` answers, and gives its answer.
  const answer = async (pending) => {
    let settled = false;
    const done = () => { settled = true; };
    pending.then(done, done);
    await until(() => settled, () => held.splice(0).forEach((release) => release()));
    assert.ok(settled, 'the config read never answered');
    return pending;
  };
  // Another Worker instance: its own binding object, and so its own copy.
  const elsewhere = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch }) } };
  return { env, elsewhere, held, cachedRead, waiting, answer, reads: () => reads };
};

// The runtime's rule, made strict: a promise belongs to the request that made
// it, and another request that attaches to it gets the runtime's error, even
// when the first request has already answered and ended.
const requests = new AsyncLocalStorage();
const REQUEST_ENDED = 'This promise was created by a request that has since ended, so it can never settle.';
class RequestPromise extends Promise {
  constructor(executor) {
    super(executor);
    this.request = requests.getStore();
  }
  then(onFulfilled, onRejected) {
    if (!this.request || requests.getStore() === this.request) return super.then(onFulfilled, onRejected);
    return super.then(() => { throw new Error(REQUEST_ENDED); }, () => { throw new Error(REQUEST_ENDED); }).then(onFulfilled, onRejected);
  }
}

test('requests sharing a read never attach to the promise of the request that started it, which may answer and end first', async () => {
  const env = { CE_SESSION_COORDINATOR: {} };
  let answer = null;
  let calls = 0;
  const read = () => new RequestPromise((resolve) => {
    calls += 1;
    answer = () => resolve({ ok: true, state: { jobState: 'succeeded' } });
  });
  const ask = (request) => requests.run({ request }, () => shareResultsAnalysisStatusRead({ env, slug: 'salon', read }));

  const first = ask('first');
  await until(() => answer);
  const others = ['second', 'third', 'fourth'].map(ask);
  answer();
  assert.deepEqual(await first, { ok: true, state: { jobState: 'succeeded' } });
  for (const result of await Promise.allSettled(others)) {
    assert.equal(result.status, 'fulfilled', result.reason?.message);
    assert.deepEqual(result.value, { ok: true, state: { jobState: 'succeeded' } });
  }
  assert.equal(calls, 1);
});

test('a read in flight across a config change is not kept or passed on', async () => {
  const c = controlled();
  const before = c.cachedRead();
  // The read is on its way, holding the old config, before the change.
  await c.waiting(1);
  const waiting = c.cachedRead();
  await new Promise((resolve) => setImmediate(resolve));
  await callSessionConfigCoordinator({ env: c.env, slug: 'salon', path: 'mutate', mutation: {} });
  assert.equal((await c.answer(before)).body.revision, 1);
  assert.equal((await c.answer(waiting)).body.revision, 2, 'the one waiting reads again');
  assert.equal((await c.answer(c.cachedRead())).body.revision, 2);
  assert.equal(c.reads(), 2);
});

test('a fresh read never takes a copy that finished before it came', async () => {
  const c = controlled();
  assert.equal((await c.answer(c.cachedRead())).body.revision, 1);
  // Another instance changes the config; this one's copy is still within its second.
  await callSessionConfigCoordinator({ env: c.elsewhere, slug: 'salon', path: 'mutate', mutation: {} });
  assert.equal((await c.answer(c.cachedRead())).body.revision, 1);
  const fresh = callSessionConfigCoordinator({ env: c.env, slug: 'salon', path: 'current' });
  assert.equal((await c.answer(fresh)).body.revision, 2);
  assert.equal(c.reads(), 2);
});

test('reads arriving together, fresh or not, share the one in flight', async () => {
  const c = controlled();
  const fresh = () => callSessionConfigCoordinator({ env: c.env, slug: 'salon', path: 'current' });
  const reads = [c.cachedRead(), fresh(), c.cachedRead(), fresh()];
  await c.waiting(1);
  for (const pending of reads) assert.equal((await c.answer(pending)).body.revision, 1);
  assert.equal(c.reads(), 1);
});

test('an older read that finishes last does not replace a newer copy', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const c = controlled();
  const older = c.cachedRead();
  await c.waiting(1);
  const joined = c.cachedRead();
  // Another instance changes the config while the first read is stuck; after a second the joiner reads again.
  await callSessionConfigCoordinator({ env: c.elsewhere, slug: 'salon', path: 'mutate', mutation: {} });
  await advance(t, 1_010);
  await c.waiting(2);
  // The newer read answers first; the stuck one answers last, with the older config.
  const [stuck, fresh] = c.held.splice(0);
  fresh();
  assert.equal((await joined).body.revision, 2);
  stuck();
  assert.equal((await older).body.revision, 1);
  assert.equal((await c.answer(c.cachedRead())).body.revision, 2);
  assert.equal(c.reads(), 2);
});

test('Lit setup drops the copy of the config it may change', async () => {
  const c = controlled();
  await c.answer(c.cachedRead());
  await ensureSessionLitAuthorizationSigner({ env: c.env, slug: 'salon' }).catch(() => {});
  await c.answer(c.cachedRead());
  assert.equal(c.reads(), 2);
});

test('group joins and Session Agent opt-outs keep the copy; a settings change drops it', async () => {
  const c = controlled();
  await c.answer(c.cachedRead());
  for (const path of ['worker-groups/mutate', 'session-agent/read', 'session-agent/set', 'session-agent/list']) {
    await callSessionConfigCoordinator({ env: c.env, slug: 'salon', path });
    await c.answer(c.cachedRead());
  }
  // Before, each of these four calls cost the next request a fresh read.
  assert.equal(c.reads(), 1);
  await callSessionConfigCoordinator({ env: c.env, slug: 'salon', path: 'mutate', mutation: {} });
  await c.answer(c.cachedRead());
  assert.equal(c.reads(), 2);
});
