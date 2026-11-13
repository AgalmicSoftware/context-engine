// Two Durable Objects (session config and its groups) over a KV with a real
// round trip, for tests of group joins under load and with secrets.
import assert from 'node:assert/strict';

import { SessionWriteCoordinator, executeCoordinatedSessionConfigMutation } from './sessionWriteCoordinator.js';
import {
  dispatchAdminWorkerGroupRequest,
  executeCoordinatedWorkerGroupMutation,
  readCoordinatedWorkerGroupCatalog,
  readCoordinatedWorkerGroupMemberships,
} from './workerGroups.js';

export const ADMIN = `0x${'aa'.repeat(20)}`;
export const SESSION_ID = `0x${'ab'.repeat(16)}`;
export const principal = (index) => ({ kind: 'evm_address', address: `0x${(index + 1).toString(16).padStart(40, '0')}` });

// Durable Object storage whose transactions run one at a time, as the
// runtime's input gates make them.
export const createDurableStorage = () => {
  const store = new Map();
  let tail = Promise.resolve();
  const storage = {
    get: async (key) => structuredClone(store.get(key)),
    put: async (key, value) => { store.set(key, structuredClone(value)); },
    delete: async (key) => store.delete(key),
    list: async ({ prefix = '', startAfter = '', limit = Infinity } = {}) => new Map([...store]
      .filter(([key]) => key.startsWith(prefix) && (!startAfter || key > startAfter))
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .slice(0, limit)
      .map(([key, value]) => [key, structuredClone(value)])),
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
export const createSlowKv = (values, { delayMs = 5 } = {}) => {
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

export const createFixture = async ({ memberLimit, groupMemberCeiling, joinMode = 'open', listed } = {}) => {
  const sessionConfig = { slug: 'fixture', adminAddress: ADMIN, sessionId: SESSION_ID,
    ...(groupMemberCeiling ? { groupMemberCeiling } : {}) };
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
    input: { groupId: 'salon', label: 'Salon', joinMode, ...(memberLimit ? { memberLimit } : {}),
      ...(listed === undefined ? {} : { listed }) } });
  assert.equal(created.ok, true, JSON.stringify(created));
  const join = (index) => mutate({ operation: 'join', principal: principal(index), actorPrincipal: principal(index) });
  const groupRecord = () => [...groupState.store].find(([key]) => key.endsWith(':salon') && key.includes('group'))?.[1];
  const memberKeys = () => [...values.keys()].filter((key) => key.startsWith('ce-worker-group-member:'));
  const catalog = (index) => readCoordinatedWorkerGroupCatalog({ env, slug: 'fixture', sessionId: SESSION_ID, groupIds: ['salon'],
    principal: principal(index) });
  const activeMembers = () => [...groupState.store].filter(([key, value]) => key.includes('member') && value?.state === 'active').length;
  // An admin action through the signed admin route, as the Admin page sends it.
  const admin = async (action, body = {}) => {
    const response = await dispatchAdminWorkerGroupRequest({ action, body: { sessionId: SESSION_ID, groupId: 'salon', ...body },
      config: sessionConfig, env, slug: 'fixture', adminAddress: ADMIN, expectedAuthority, headers: {},
      deps: { json: (payload, status) => ({ status, body: payload }) } });
    return { status: response.status, ...response.body };
  };
  return { kv, env, mutate, join, groupRecord, memberKeys, groupState, changeConfig, memberships, catalog, activeMembers,
    admin, sessionConfig, values };
};
