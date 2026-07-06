import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addWorkerGroupMember,
  createWorkerGroup,
  deleteWorkerGroup,
  isWorkerGroupMember,
  listWorkerGroupMemberships,
  normalizeWorkerGroupPrincipal,
  resolveWorkerGroupPrincipal,
  updateWorkerGroup,
  workerGroupsRoute,
} from './workerGroups.js';

const json = (body, status = 200, headers = {}) => ({ body, status, headers });

const createMockKv = () => {
  const store = new Map();
  return {
    store,
    async put(key, value) { store.set(key, value); },
    async get(key) { return store.get(key) || null; },
    async list({ prefix = '' } = {}) {
      return { keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })) };
    },
  };
};

const actor = { kind: 'evm_address', address: '0x0000000000000000000000000000000000000abc' };
const member = { kind: 'evm_address', address: '0x0000000000000000000000000000000000000def' };

test('worker group CRUD stores memberships separately and enforces caps', async () => {
  const kv = createMockKv();
  const env = {
    CE_WORKER_GROUPS_KV: kv,
    CE_WORKER_GROUP_MAX_GROUPS_PER_SESSION: '1',
    CE_WORKER_GROUP_MAX_MEMBERS_PER_GROUP: '1',
  };
  const deps = {
    now: () => Date.parse('2026-02-03T04:05:06.000Z'),
    randomUUID: () => 'group-alpha',
  };
  const created = await createWorkerGroup({
    env,
    slug: 'session-a',
    input: {
      label: 'Review cohort',
      description: 'Internal review access',
      joinMode: 'admin_add',
      memberVisibility: 'members',
    },
    actorPrincipal: actor,
    deps,
  });
  assert.equal(created.ok, true);
  assert.equal(created.group.groupId, 'group-alpha');

  const duplicate = await createWorkerGroup({
    env,
    slug: 'session-a',
    input: { groupId: 'group-beta', label: 'Overflow', joinMode: 'admin_add' },
    actorPrincipal: actor,
    deps: { ...deps, randomUUID: () => 'group-beta' },
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'worker_group_session_cap_exceeded');

  const added = await addWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'group-alpha',
    principal: member,
    actorPrincipal: actor,
    deps,
  });
  assert.equal(added.ok, true);
  assert.equal(added.member.principalKey, 'evm_address:0x0000000000000000000000000000000000000def');
  assert.equal([...kv.store.keys()].some((key) => key.startsWith('ce-worker-group-member:session-a:group-alpha:')), true);

  const overflow = await addWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'group-alpha',
    principal: { kind: 'telegram', principalId: 'telegram:test-user-2' },
    actorPrincipal: actor,
    deps,
  });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.reason, 'worker_group_member_cap_exceeded');

  const membership = await isWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'group-alpha',
    principal: member,
  });
  assert.equal(membership.ok, true);

  const denied = await isWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'group-alpha',
    principal: { kind: 'evm_address', address: '0x0000000000000000000000000000000000000bad' },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'worker_group_membership_denied');
});

test('worker groups operate on storage index KV without a D1 binding', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  const created = await createWorkerGroup({
    env,
    slug: 'session-a',
    input: { groupId: 'fresh-worker', label: 'Fresh worker', joinMode: 'admin_add' },
    actorPrincipal: actor,
  });
  assert.equal(created.ok, true);
  assert.equal(created.store, 'kv');

  const added = await addWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'fresh-worker',
    principal: member,
    actorPrincipal: actor,
  });
  assert.equal(added.ok, true);
  assert.equal(added.store, 'kv');

  const membership = await isWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'fresh-worker',
    principal: member,
  });
  assert.equal(membership.ok, true);
  assert.equal(membership.store, 'kv');

  const memberships = await listWorkerGroupMemberships({ env, slug: 'session-a', principal: member });
  assert.equal(memberships.ok, true);
  assert.equal(memberships.store, 'kv');
  assert.deepEqual(memberships.memberships.map((entry) => entry.group.groupId), ['fresh-worker']);
});

test('worker groups reject deferred join modes and malformed principals fail closed', async () => {
  const env = { CE_WORKER_GROUPS_KV: createMockKv() };
  const password = await createWorkerGroup({
    env,
    slug: 'session-a',
    input: { label: 'Deferred join', joinMode: 'password' },
    actorPrincipal: actor,
    deps: { randomUUID: () => 'deferred' },
  });
  assert.equal(password.ok, false);
  assert.equal(password.reason, 'join_mode_not_implemented');

  assert.deepEqual(normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: '' }), {
    ok: false,
    reason: 'invalid_telegram_principal',
  });
  assert.deepEqual(resolveWorkerGroupPrincipal({}), {
    ok: false,
    reason: 'missing_principal',
  });
  assert.deepEqual(resolveWorkerGroupPrincipal({
    authScopes: { agentGrant: { grantId: 'grant:test-1' } },
  }).principal, {
    kind: 'agent',
    grantId: 'grant:test-1',
  });
});

test('worker group EVM principal normalization uses getAddress while matching lower-case keys', async () => {
  const normalized = normalizeWorkerGroupPrincipal(
    { kind: 'evm_address', address: '0x0000000000000000000000000000000000000def' },
    {
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      getAddress: () => '0x0000000000000000000000000000000000000DEF',
    },
  );
  assert.equal(normalized.ok, true);
  assert.equal(normalized.principal.address, '0x0000000000000000000000000000000000000DEF');
  assert.equal(normalized.key, 'evm_address:0x0000000000000000000000000000000000000def');
});

test('member routes respect visibility and open join mode', async () => {
  const kv = createMockKv();
  const env = { CE_WORKER_GROUPS_KV: kv };
  await createWorkerGroup({
    env,
    slug: 'session-a',
    input: { groupId: 'open-review', label: 'Open review', joinMode: 'open', memberVisibility: 'admin_only' },
    actorPrincipal: actor,
  });
  await createWorkerGroup({
    env,
    slug: 'session-a',
    input: { groupId: 'session-visible', label: 'Visible', joinMode: 'admin_add', memberVisibility: 'session' },
    actorPrincipal: actor,
  });

  const visibleResponse = await workerGroupsRoute({
    path: '/groups/list',
    method: 'GET',
    request: new Request('https://worker.example/groups/list'),
    env,
    slug: 'session-a',
    requesterAddress: member.address,
    authScopes: {},
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(visibleResponse.status, 200);
  assert.deepEqual(visibleResponse.body.groups.map((group) => group.groupId), ['session-visible']);

  const joinResponse = await workerGroupsRoute({
    path: '/groups/join',
    method: 'POST',
    request: new Request('https://worker.example/groups/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId: 'open-review' }),
    }),
    env,
    slug: 'session-a',
    requesterAddress: member.address,
    authScopes: {},
    baseHeaders: {},
    deps: { json, now: () => Date.parse('2026-02-03T04:05:06.000Z') },
  });
  assert.equal(joinResponse.status, 200);

  const memberships = await listWorkerGroupMemberships({ env, slug: 'session-a', principal: member });
  assert.equal(memberships.ok, true);
  assert.deepEqual(memberships.memberships.map((entry) => entry.group.groupId), ['open-review']);
});

test('worker group deletion revokes membership checks', async () => {
  const env = { CE_WORKER_GROUPS_KV: createMockKv() };
  await createWorkerGroup({
    env,
    slug: 'session-a',
    input: { groupId: 'temporary', label: 'Temporary', joinMode: 'admin_add' },
    actorPrincipal: actor,
  });
  await addWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'temporary',
    principal: member,
    actorPrincipal: actor,
  });
  assert.equal((await isWorkerGroupMember({ env, slug: 'session-a', groupId: 'temporary', principal: member })).ok, true);

  const deleted = await deleteWorkerGroup({
    env,
    slug: 'session-a',
    groupId: 'temporary',
    actorPrincipal: actor,
  });
  assert.equal(deleted.ok, true);

  const afterDelete = await isWorkerGroupMember({
    env,
    slug: 'session-a',
    groupId: 'temporary',
    principal: member,
  });
  assert.equal(afterDelete.ok, false);
  assert.equal(afterDelete.reason, 'worker_group_not_found');
});

test('worker group updates keep join mode implementation fail-closed', async () => {
  const env = { CE_WORKER_GROUPS_KV: createMockKv() };
  await createWorkerGroup({
    env,
    slug: 'session-a',
    input: { groupId: 'reviewers', label: 'Reviewers', joinMode: 'admin_add' },
    actorPrincipal: actor,
  });
  const updated = await updateWorkerGroup({
    env,
    slug: 'session-a',
    groupId: 'reviewers',
    input: { label: 'Reviewers v2', memberVisibility: 'session' },
    actorPrincipal: actor,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.group.label, 'Reviewers v2');
  assert.equal(updated.group.memberVisibility, 'session');

  const invite = await updateWorkerGroup({
    env,
    slug: 'session-a',
    groupId: 'reviewers',
    input: { joinMode: 'invite' },
    actorPrincipal: actor,
  });
  assert.equal(invite.ok, false);
  assert.equal(invite.reason, 'join_mode_not_implemented');
});
