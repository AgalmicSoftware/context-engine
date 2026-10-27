import test from 'node:test';
import assert from 'node:assert/strict';
import { world, baseConfig, member, admin, outsider, ethers } from './agentSecurityFixture.mjs';

const A = '0x' + 'a1'.repeat(16);
const show = async (_label, response) => response.status;
const others = Array.from({ length: 4 }, (_, i) => new ethers.Wallet('0x' + String(i + 5).repeat(64)));

test('session_member_aggregate reads canonical coordinator groups/memberCount for the caller only', async () => {
  const cfg = baseConfig('alpha', A);
  cfg.sessionModeProfile.results = { visibility: 'session_member_aggregate', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 3 } };
  const groupKv = new Map();
  const w = world({ sessions: { alpha: cfg }, envExtra: { CE_WORKER_GROUPS_BOOTSTRAP: 'fresh-template-v2', CE_WORKER_GROUPS_KV: {
    get: async k => groupKv.get(k) ?? null, put: async (k, v) => groupKv.set(k, v), delete: async k => groupKv.delete(k),
    list: async ({ prefix = '' } = {}) => ({ keys: [...groupKv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) } } });
  const coord = () => w.env.CE_SESSION_COORDINATOR.get(w.env.CE_SESSION_COORDINATOR.idFromName(`worker-groups:alpha:${A}`));
  const mutate = async (operation, groupId, extra = {}) => {
    const r = await coord().fetch('https://session-coordinator.internal/worker-groups/mutate', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'alpha', sessionId: A, operation, groupId, actorPrincipal: { kind: 'evm_address', address: admin.address }, ...extra }) });
    const j = await r.json(); if (r.status !== 200) throw new Error(`${operation} ${groupId} ${r.status} ${JSON.stringify(j)}`); return j;
  };
  const p = address => ({ principal: { kind: 'evm_address', address } });
  await mutate('create', 'small', { input: { groupId: 'small', label: 'Small', joinMode: 'admin_add', memberVisibility: 'members' } });
  await mutate('create', 'big', { input: { groupId: 'big', label: 'Big', joinMode: 'admin_add', memberVisibility: 'members' } });
  await mutate('add-member', 'small', p(member.address));
  for (const o of others.slice(0, 3)) await mutate('add-member', 'big', p(o.address));
  const agent = await w.credential('alpha');                                          // accountAddress = member
  const stranger = await w.credential('alpha', { principal: 'stranger', accountAddress: outsider.address });
  const paths = ['/api/agent/results?sessionSlug=alpha&view=consensus', '/api/agent/results-image?sessionSlug=alpha&view=consensus',
    '/api/agent/result-view-cache?sessionSlug=alpha&viewType=consensus&dataVersionKey=k1'];
  for (const path of paths) {
    assert.equal(await show(`small-only ${path}`, await w.request(path, { token: agent.token })), 403);
    assert.equal(await show(`no-group ${path}`, await w.request(path, { token: stranger.token })), 403);
  }
  // A big group the caller does not belong to never qualifies them.
  await mutate('add-member', 'big', p(member.address));                               // big now has 4 members incl. caller
  for (const path of paths) assert.notEqual(await show(`member of big ${path}`, await w.request(path, { token: agent.token })), 403);
  assert.equal(await show('stranger still denied', await w.request(paths[0], { token: stranger.token })), 403);
  await mutate('remove-member', 'big', p(member.address));                            // request-time recheck, no cache
  assert.equal(await show('removed from big', await w.request(paths[0], { token: agent.token })), 403);
});

test('membership response without canonical fields fails closed', async () => {
  const cfg = baseConfig('alpha', A);
  cfg.sessionModeProfile.results = { visibility: 'session_member_aggregate', exposure: { aggregateResultsEnabled: true, minGroupSize: 2 } };
  const w = world({ sessions: { alpha: cfg } });
  let shape;
  w.env.CE_WORKER_GROUP_COORDINATOR = { idFromName: n => n, get: () => ({ fetch: async () => Response.json(shape) }) };
  const agent = await w.credential('alpha');
  for (const s of [{ ok: true, memberships: [{ groupId: 'g', memberCount: 99 }] }, { ok: true, groups: [{ groupId: 'g', size: 99 }] },
    { ok: true, groups: [{ groupId: 'g', memberCount: '99' }] }, { ok: false, groups: [{ groupId: 'g', memberCount: 99 }] }]) {
    shape = s;
    assert.notEqual((await w.request('/api/agent/results?sessionSlug=alpha&view=consensus', { token: agent.token })).status, 200);
  }
});
