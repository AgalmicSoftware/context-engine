import assert from 'node:assert/strict';
import test from 'node:test';

import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';

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
