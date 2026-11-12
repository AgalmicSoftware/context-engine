import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchSessionAgentOptOutStore } from './sessionAgentOptOuts.js';

// Durable Object storage as the coordinator sees it: list pages by key order.
const createCoordinator = () => {
  const values = new Map();
  const storage = {
    values,
    get: async (key) => values.get(key),
    put: async (key, value) => { values.set(key, value); },
    delete: async (key) => values.delete(key),
    list: async ({ prefix = '', startAfter = '', limit = 1000 } = {}) => new Map([...values]
      .filter(([key]) => key.startsWith(prefix) && key > startAfter)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, limit)),
  };
  return { state: { storage } };
};

const call = async (coordinator, operation, payload) => {
  const response = await dispatchSessionAgentOptOutStore(coordinator, operation, payload);
  return { status: response.status, body: await response.json() };
};

const address = (n) => `0x${n.toString(16).padStart(40, '0')}`;

test('each person is in until they opt out, and can opt back in', async () => {
  const coordinator = createCoordinator();
  // Addresses arrive checksummed and are kept in lower case.
  const person = `0x${'aB'.repeat(20)}`;
  assert.deepEqual((await call(coordinator, 'read', { address: person })).body, { ok: true, optedOut: false });
  assert.deepEqual((await call(coordinator, 'set', { address: person, optedOut: true })).body, { ok: true, optedOut: true });
  assert.deepEqual((await call(coordinator, 'read', { address: person.toLowerCase() })).body, { ok: true, optedOut: true });
  assert.deepEqual((await call(coordinator, 'list')).body, { ok: true, addresses: [person.toLowerCase()] });
  await call(coordinator, 'set', { address: person, optedOut: false });
  assert.deepEqual((await call(coordinator, 'list')).body.addresses, []);
  assert.equal(coordinator.state.storage.values.size, 0);
});

test('the list holds every opt-out, past one page of storage', async () => {
  const coordinator = createCoordinator();
  for (let n = 1; n <= 2001; n += 1) await call(coordinator, 'set', { address: address(n), optedOut: true });
  const { addresses } = (await call(coordinator, 'list')).body;
  assert.equal(addresses.length, 2001);
  assert.equal(new Set(addresses).size, 2001);
});

test('a change needs an address and a yes or no', async () => {
  const coordinator = createCoordinator();
  assert.equal((await call(coordinator, 'set', { address: 'tg:12345', optedOut: true })).status, 400);
  assert.equal((await call(coordinator, 'read', {})).status, 400);
  assert.equal((await call(coordinator, 'set', { address: address(2), optedOut: 'yes' })).status, 400);
  assert.equal((await call(coordinator, 'clear', { address: address(2) })).status, 404);
  assert.equal(coordinator.state.storage.values.size, 0);
});
