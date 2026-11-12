import assert from 'node:assert/strict';
import test from 'node:test';

import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { ensureSessionLitAuthorizationSigner } from './sessionLitAuthorizationCoordinator.js';

test('a shared config read that never settles is replaced, not joined forever', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  // The first read's request was cancelled, so its call never answers.
  const fetch = async () => (calls += 1) === 1 ? new Promise(() => {}) : Response.json({ ok: true, config: { slug: 'salon' }, revision: 3 });
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch }) } };
  const read = () => callSessionConfigCoordinator({ env, slug: 'salon', path: 'current' });

  read();
  const settle = (pending) => Promise.race([pending, new Promise((resolve) => setImmediate(resolve, 'waiting'))]);
  await new Promise((resolve) => setImmediate(resolve));
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
  const releaseAll = async () => {
    for (let round = 0; round < 5; round += 1) { await new Promise((resolve) => setImmediate(resolve)); held.splice(0).forEach((release) => release()); }
  };
  // Another Worker instance: its own binding object, and so its own copy.
  const elsewhere = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch }) } };
  return { env, elsewhere, held, cachedRead, releaseAll, reads: () => reads };
};

test('a read in flight across a config change is not kept', async () => {
  const c = controlled();
  const before = c.cachedRead();
  await new Promise((resolve) => setImmediate(resolve));
  await callSessionConfigCoordinator({ env: c.env, slug: 'salon', path: 'mutate', mutation: {} });
  await c.releaseAll();
  assert.equal((await before).body.revision, 1);
  const after = c.cachedRead();
  await c.releaseAll();
  assert.equal((await after).body.revision, 2);
  assert.equal(c.reads(), 2);
});

test('a stalled read that finishes late does not replace a newer copy', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const c = controlled();
  const stalled = c.cachedRead();
  await new Promise((resolve) => setImmediate(resolve));
  const joined = c.cachedRead();
  await new Promise((resolve) => setImmediate(resolve));
  // Another instance changes the config while the first read is stuck; the joiner gives up and reads again.
  await callSessionConfigCoordinator({ env: c.elsewhere, slug: 'salon', path: 'mutate', mutation: {} });
  t.mock.timers.tick(10_000);
  for (let round = 0; round < 5 && c.held.length < 2; round += 1) await new Promise((resolve) => setImmediate(resolve));
  // The new read answers first; the stuck one answers last, with the older config.
  const [stuck, fresh] = c.held.splice(0);
  fresh();
  assert.equal((await joined).body.revision, 2);
  stuck();
  await stalled;
  const cached = c.cachedRead();
  await c.releaseAll();
  assert.equal((await cached).body.revision, 2);
});

test('Lit setup drops the copy of the config it may change', async () => {
  const c = controlled();
  const first = c.cachedRead();
  await c.releaseAll();
  await first;
  await ensureSessionLitAuthorizationSigner({ env: c.env, slug: 'salon' }).catch(() => {});
  const next = c.cachedRead();
  await c.releaseAll();
  await next;
  assert.equal(c.reads(), 2);
});
