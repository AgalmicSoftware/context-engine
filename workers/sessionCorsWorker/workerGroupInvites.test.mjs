// A group's one-use codes and password, as an admin manages them: only hashes
// and the password's signer are stored, and neither ever comes back out.
import test from 'node:test';
import assert from 'node:assert/strict';

import { hashOneUseSecret } from '../../shared/workerGroupJoin.mjs';
import { createFixture } from './workerGroupTestFixture.mjs';

const SIGNER = `0x${'5c'.repeat(20)}`;
const codes = (count, seed = 0) => Array.from({ length: count }, (_, index) => (seed * 1000 + index + 1).toString(16).padStart(32, '0'));
const hashes = (list) => Promise.all(list.map(hashOneUseSecret));

test('an admin adds one-use codes as hashes, pages through them and revokes them', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const batch = await hashes(codes(3));
  const added = await f.admin('groups/invites/add', { hashes: batch, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
  assert.equal(added.status, 200, JSON.stringify(added));
  assert.equal(added.added, 3);
  assert.deepEqual(added.counts, { unused: 3, used: 0, revoked: 0 });

  const first = await f.admin('groups/invites/list', { limit: 2 });
  assert.equal(first.invites.length, 2);
  assert.ok(first.cursor);
  const second = await f.admin('groups/invites/list', { limit: 2, cursor: first.cursor });
  assert.equal(second.invites.length, 1);
  assert.equal(second.cursor, undefined);
  const listed = [...first.invites, ...second.invites];
  assert.deepEqual(listed.map((invite) => invite.hash).sort(), [...batch].sort());
  assert.ok(listed.every((invite) => invite.state === 'unused' && invite.createdAt && invite.expiresAt));

  // A batch holding a hash already stored is refused whole.
  const again = await f.admin('groups/invites/add', { hashes: [batch[0], ...(await hashes(codes(1, 1)))] });
  assert.equal(again.status, 409);
  assert.equal(again.reason, 'worker_group_invite_exists');
  for (const body of [
    { hashes: [] },
    { hashes: ['not-a-hash'] },
    { hashes: [batch[0].toUpperCase(), batch[0]] },
    { hashes: await hashes(codes(501, 2)) },
    { hashes: await hashes(codes(1, 3)), expiresAt: new Date(Date.now() - 1000).toISOString() },
  ]) {
    const refused = await f.admin('groups/invites/add', body);
    assert.equal(refused.status, 400, JSON.stringify(body).slice(0, 80));
  }
  assert.deepEqual((await f.admin('groups/invites/list')).counts, { unused: 3, used: 0, revoked: 0 });

  const one = await f.admin('groups/invites/revoke', { hashes: [batch[0]] });
  assert.equal(one.revoked, 1);
  const rest = await f.admin('groups/invites/revoke', { allUnused: true });
  assert.equal(rest.revoked, 2);
  assert.deepEqual(rest.counts, { unused: 0, used: 0, revoked: 3 });
  assert.equal((await f.admin('groups/invites/revoke', { allUnused: true })).revoked, 0);
  assert.equal((await f.admin('groups/invites/revoke', { hashes: [batch[0]], allUnused: true })).status, 400);
  assert.ok((await f.admin('groups/invites/list')).invites.every((invite) => invite.state === 'revoked'));

  // Codes live only in the coordinator: nothing about them reaches KV.
  const kvText = JSON.stringify([...f.values]);
  assert.ok(batch.every((hash) => !kvText.includes(hash)));
});

test('codes go only to one-use groups and a password only to password groups', async () => {
  const oneUse = await createFixture({ joinMode: 'one_use' });
  const onOneUse = await oneUse.admin('groups/password/set', { signer: SIGNER });
  assert.equal(onOneUse.status, 409);
  assert.equal(onOneUse.reason, 'worker_group_join_mode_mismatch');

  const password = await createFixture({ joinMode: 'group_password' });
  const onPassword = await password.admin('groups/invites/add', { hashes: await hashes(codes(1)) });
  assert.equal(onPassword.reason, 'worker_group_join_mode_mismatch');
  assert.equal((await password.admin('groups/password/set', { signer: 'not-an-address' })).status, 400);
  const missing = await password.admin('groups/invites/list', { groupId: 'nowhere' });
  assert.equal(missing.status, 404);
});

test('a group password is stored only as its signer, which no answer shows', async () => {
  const f = await createFixture({ joinMode: 'group_password' });
  const before = await f.admin('groups/list');
  assert.equal(before.groups[0].passwordSet, false);
  const set = await f.admin('groups/password/set', { signer: SIGNER });
  assert.equal(set.status, 200, JSON.stringify(set));
  assert.equal(set.passwordSet, true);
  const after = await f.admin('groups/list');
  assert.equal(after.groups[0].passwordSet, true);
  assert.equal(f.groupRecord().signer, SIGNER);
  for (const answer of [set, after, await f.join(1), await f.catalog(1)]) {
    assert.ok(!JSON.stringify(answer).toLowerCase().includes(SIGNER.slice(2)), JSON.stringify(answer));
  }
  assert.ok(!JSON.stringify([...f.values]).includes(SIGNER.slice(2)));
});

test('only admins see whether a password is set or how many codes a group has', async () => {
  const f = await createFixture({ joinMode: 'one_use', listed: true });
  await f.admin('groups/invites/add', { hashes: await hashes(codes(2)) });
  const adminView = (await f.admin('groups/list')).groups[0];
  assert.deepEqual(adminView.invites, { unused: 2, used: 0, revoked: 0 });
  assert.equal(adminView.passwordSet, false);
  const memberView = (await f.catalog(4)).groups[0];
  assert.equal('invites' in memberView || 'admin' in memberView || 'passwordSet' in memberView, false);
});
