import assert from 'node:assert/strict';
import test from 'node:test';

import { SESSION_CONFIG_COORDINATION_ERROR, callSessionConfigCoordinator } from './sessionConfigAuthority.js';

test('a coordinator call that throws logs why, without the session or its data', async (t) => {
  const lines = [];
  t.mock.method(console, 'warn', (...args) => lines.push(args.join(' ')));
  t.mock.method(Date, 'now', () => 1_800_000_000_000);
  const overloaded = Object.assign(new Error('Durable Object is overloaded. Too many requests queued.'), { retryable: true, overloaded: true });
  const env = { CE_SESSION_COORDINATOR: { idFromName: (name) => name, get: () => ({ fetch: async () => { throw overloaded; } }) } };

  const result = await callSessionConfigCoordinator({ env, slug: 'private-salon', path: 'current' });
  assert.deepEqual(result, { ok: false, status: 503, body: { error: SESSION_CONFIG_COORDINATION_ERROR } });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Too many requests queued/);
  assert.match(lines[0], /"retryable":true/);
  assert.match(lines[0], /"overloaded":true/);
  assert.doesNotMatch(lines[0], /private-salon/);

  // A burst logs one line a second and counts the rest.
  await callSessionConfigCoordinator({ env, slug: 'private-salon', path: 'mutate', mutation: {} });
  assert.equal(lines.length, 1);
});
