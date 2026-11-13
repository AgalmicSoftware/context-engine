import assert from 'node:assert/strict';
import test from 'node:test';

import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { ensureSessionLitAuthorizationSigner } from './sessionLitAuthorizationCoordinator.js';

// Turns the event loop until `ready()`, running `each` before every turn, for at
// most five real seconds. Each coordinator call hashes its name off the main
// thread first, so a read starts some turns later, more on a slow machine, never
// a fixed few. These tests mock setTimeout, so the bound is read from the clock.
const until = async (ready, each = () => {}) => {
  const deadline = performance.now() + 5_000;
  while (!ready() && performance.now() < deadline) {
    each();
    await new Promise((resolve) => setImmediate(resolve));
  }
};

test('a shared config read that never settles is replaced, not joined forever', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  // The first read's request was cancelled, so its call never answers.
  const fetch = async () => (calls += 1) === 1 ? new Promise(() => {}) : Response.json({ ok: true, config: { slug: 'salon' }, revision: 3 });
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch }) } };
  const read = () => callSessionConfigCoordinator({ env, slug: 'salon', path: 'current' });

  read();
  const settle = (pending) => Promise.race([pending, new Promise((resolve) => setImmediate(resolve, 'waiting'))]);
  // The first read must be the one that never answers before anything else can reach the coordinator.
  await until(() => calls === 1);
  assert.equal(calls, 1);
  const joined = [read(), read()];
  assert.equal(await settle(joined[0]), 'waiting');
  t.mock.timers.tick(10_000);
  for (const result of await Promise.all(joined)) assert.deepEqual(result.body, { ok: true, config: { slug: 'salon' }, revision: 3 });
  // Both stalled readers moved to one new read.
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

test('a read in flight across a config change is not kept', async () => {
  const c = controlled();
  const before = c.cachedRead();
  // The read is on its way, holding the old config, before the change.
  await c.waiting(1);
  await callSessionConfigCoordinator({ env: c.env, slug: 'salon', path: 'mutate', mutation: {} });
  assert.equal((await c.answer(before)).body.revision, 1);
  assert.equal((await c.answer(c.cachedRead())).body.revision, 2);
  assert.equal(c.reads(), 2);
});

test('a stalled read that finishes late does not replace a newer copy', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const c = controlled();
  const stalled = c.cachedRead();
  await c.waiting(1);
  const joined = c.cachedRead();
  await new Promise((resolve) => setImmediate(resolve));
  // Another instance changes the config while the first read is stuck; the joiner gives up and reads again.
  await callSessionConfigCoordinator({ env: c.elsewhere, slug: 'salon', path: 'mutate', mutation: {} });
  t.mock.timers.tick(10_000);
  await c.waiting(2);
  // The new read answers first; the stuck one answers last, with the older config.
  const [stuck, fresh] = c.held.splice(0);
  fresh();
  assert.equal((await joined).body.revision, 2);
  stuck();
  await stalled;
  assert.equal((await c.answer(c.cachedRead())).body.revision, 2);
});

test('Lit setup drops the copy of the config it may change', async () => {
  const c = controlled();
  await c.answer(c.cachedRead());
  await ensureSessionLitAuthorizationSigner({ env: c.env, slug: 'salon' }).catch(() => {});
  await c.answer(c.cachedRead());
  assert.equal(c.reads(), 2);
});
