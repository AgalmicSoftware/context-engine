// A group's one-use codes and password: an admin manages them, and a join
// spends a code or proves the password in the same step that takes its seat.
// Only hashes and the password's signer are stored; neither comes back out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import { hashOneUseSecret, workerGroupJoinStatement } from '../../shared/workerGroupJoin.mjs';
import { SESSION_ID, createFixture, principal } from './workerGroupTestFixture.mjs';
import { listWorkerGroups } from './workerGroups.js';

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

const REFUSED = { ok: false, status: 403, reason: 'worker_group_join_refused' };
const passwordKey = (seed) => new Wallet(`0x${seed.repeat(32)}`);
const proofFor = (key, index, groupId = 'salon') =>
  key.signMessage(workerGroupJoinStatement({ sessionId: SESSION_ID, groupId, address: principal(index).address }));
const inviteState = async (f, hash) => (await f.admin('groups/invites/list')).invites.find((invite) => invite.hash === hash)?.state;

test('twenty people racing with one code: exactly one gets in, and joining again needs no code', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const [code, spare] = codes(2);
  await f.admin('groups/invites/add', { hashes: await hashes([code, spare]) });
  const raced = await Promise.all(Array.from({ length: 20 }, (_, index) => f.join(index, { secret: code })));
  const admitted = raced.filter((result) => result.ok);
  assert.equal(admitted.length, 1);
  assert.ok(raced.filter((result) => !result.ok).every((result) => result.reason === REFUSED.reason));
  const winner = raced.indexOf(admitted[0]);
  assert.equal((await f.join(winner)).ok, true);
  assert.equal((await f.join(winner, { secret: spare })).ok, true);
  assert.equal(await inviteState(f, await hashOneUseSecret(spare)), 'unused');
  assert.deepEqual((await f.admin('groups/invites/list')).counts, { unused: 1, used: 1, revoked: 0 });
  assert.equal(f.groupRecord().memberCount, 1);
  // Upper-case codes are the same code.
  assert.equal((await f.join(30, { secret: spare.toUpperCase() })).ok, true);
});

test('every way in that fails before a valid code or password gets the same refusal', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const [used, revoked, expiring, fresh] = codes(4);
  await f.admin('groups/invites/add', { hashes: await hashes([used, revoked, fresh]) });
  await f.admin('groups/invites/add', { hashes: await hashes([expiring]), expiresAt: new Date(Date.now() + 60).toISOString() });
  assert.equal((await f.join(1, { secret: used })).ok, true);
  await f.admin('groups/invites/revoke', { hashes: await hashes([revoked]) });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const password = await createFixture({ joinMode: 'group_password' });
  const key = passwordKey('11');
  const closed = await createFixture({ joinMode: 'admin_add' });
  const refusals = [
    await f.join(2),
    await f.join(2, { secret: codes(1, 9)[0] }),
    await f.join(2, { secret: used }),
    await f.join(2, { secret: revoked }),
    await f.join(2, { secret: expiring }),
    await f.join(2, { secret: 'not-a-code' }),
    await f.join(2, { proof: await proofFor(key, 2) }),
    await f.mutate({ operation: 'join', groupId: 'nowhere', principal: principal(2), actorPrincipal: principal(2) }),
    await password.join(2, { proof: await proofFor(key, 2) }),
    await closed.join(2, { secret: fresh }),
  ];
  await password.admin('groups/password/set', { signer: key.address });
  refusals.push(
    await password.join(2),
    await password.join(2, { proof: await proofFor(passwordKey('22'), 2) }),
    await password.join(2, { proof: await proofFor(key, 3) }),
    await password.join(2, { proof: await proofFor(key, 2, 'other') }),
    await password.join(2, { secret: fresh, proof: await proofFor(key, 2) }),
  );
  refusals.forEach((result, index) => assert.deepEqual(result, REFUSED, `refusal ${index}`));
  assert.equal(await inviteState(f, await hashOneUseSecret(fresh)), 'unused');
  assert.equal((await password.join(2, { proof: await proofFor(key, 2) })).ok, true);
});

test('a full or closed group says so only after a valid code, and keeps the code', async () => {
  const f = await createFixture({ joinMode: 'one_use', memberLimit: 1 });
  const [first, second] = codes(2);
  await f.admin('groups/invites/add', { hashes: await hashes([first, second]) });
  assert.equal((await f.join(1, { secret: first })).ok, true);
  assert.deepEqual(await f.join(2), REFUSED);
  assert.equal((await f.join(2, { secret: second })).reason, 'worker_group_member_cap_exceeded');
  assert.equal(await inviteState(f, await hashOneUseSecret(second)), 'unused');
  assert.equal((await f.mutate({ operation: 'update', input: { memberLimit: 5, joinEndsAt: new Date(Date.now() - 1000).toISOString() } })).ok, true);
  assert.deepEqual(await f.join(2), REFUSED);
  assert.equal((await f.join(2, { secret: second })).reason, 'worker_group_join_ended');
  assert.equal(await inviteState(f, await hashOneUseSecret(second)), 'unused');
});

test('thirty password joins against a limit of 25 admit exactly 25; a new password shuts the old one out', async () => {
  const f = await createFixture({ joinMode: 'group_password', memberLimit: 25 });
  const key = passwordKey('11');
  await f.admin('groups/password/set', { signer: key.address });
  const proofs = await Promise.all(Array.from({ length: 30 }, (_, index) => proofFor(key, index)));
  const raced = await Promise.all(proofs.map((proof, index) => f.join(index, { proof })));
  assert.equal(raced.filter((result) => result.ok).length, 25);
  assert.ok(raced.filter((result) => !result.ok).every((result) => result.reason === 'worker_group_member_cap_exceeded'));
  assert.equal(f.groupRecord().memberCount, 25);
  await f.mutate({ operation: 'update', input: { memberLimit: 50 } });
  await f.admin('groups/password/set', { signer: passwordKey('22').address });
  assert.deepEqual(await f.join(26, { proof: proofs[26] }), REFUSED);
  assert.equal((await f.join(27, { proof: await proofFor(passwordKey('22'), 27) })).ok, true);
  assert.equal(f.groupRecord().memberCount, 26);
});

test('leaving a join mode voids its password or codes, so switching back revives neither', async () => {
  const password = await createFixture({ joinMode: 'group_password' });
  const key = passwordKey('11');
  await password.admin('groups/password/set', { signer: key.address });
  // An update that keeps the mode keeps the password.
  assert.equal((await password.mutate({ operation: 'update', input: { memberLimit: 40 } })).ok, true);
  assert.equal((await password.join(0, { proof: await proofFor(key, 0) })).ok, true);
  for (const joinMode of ['admin_add', 'group_password']) {
    assert.equal((await password.mutate({ operation: 'update', input: { joinMode } })).ok, true);
  }
  assert.equal((await password.admin('groups/list')).groups[0].passwordSet, false);
  assert.deepEqual(await password.join(1, { proof: await proofFor(key, 1) }), REFUSED);

  const oneUse = await createFixture({ joinMode: 'one_use' });
  const list = codes(2);
  await oneUse.admin('groups/invites/add', { hashes: await hashes(list) });
  assert.equal((await oneUse.join(0, { secret: list[0] })).ok, true);
  for (const joinMode of ['open', 'one_use']) {
    assert.equal((await oneUse.mutate({ operation: 'update', input: { joinMode } })).ok, true);
  }
  const after = await oneUse.admin('groups/invites/list');
  assert.deepEqual(after.counts, { unused: 0, used: 1, revoked: 1 });
  assert.deepEqual(await oneUse.join(1, { secret: list[1] }), REFUSED);
});

test('a join that fails after spending its code gives the code back; a resent one spends nothing more', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const [code, other] = codes(2);
  const [hash] = await hashes([code]);
  await f.admin('groups/invites/add', { hashes: await hashes([code, other]) });
  // The group's KV record vanishes: a definite failure after the seat was taken.
  const groupKey = [...f.values.keys()].find((key) => key.startsWith('ce-worker-group:'));
  const record = f.values.get(groupKey);
  f.values.delete(groupKey);
  assert.equal((await f.join(1, { secret: code })).ok, false);
  f.values.set(groupKey, record);
  assert.equal(await inviteState(f, hash), 'unused');
  assert.deepEqual((await f.admin('groups/invites/list')).counts, { unused: 2, used: 0, revoked: 0 });
  assert.equal(f.groupRecord().memberCount, 0);

  // An answer lost after the code was spent: the resend finishes that join.
  f.kv.failPut = (key) => key.startsWith('ce-worker-group-member:');
  assert.equal((await f.join(1, { secret: code })).reason, 'worker_group_mutation_ambiguous');
  assert.equal((await f.join(1, { secret: code })).ok, true);
  assert.equal((await f.join(1)).ok, true);
  assert.deepEqual((await f.admin('groups/invites/list')).counts, { unused: 1, used: 1, revoked: 0 });
  assert.equal(f.groupRecord().memberCount, 1);
});

test('no code, proof or password signer is ever written to KV or a pending intent', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const [code] = codes(1);
  await f.admin('groups/invites/add', { hashes: await hashes([code]) });
  f.kv.failPut = (key) => key.startsWith('ce-worker-group-member:');
  await f.join(1, { secret: code });
  const password = await createFixture({ joinMode: 'group_password' });
  const key = passwordKey('11');
  await password.admin('groups/password/set', { signer: key.address });
  const proof = await proofFor(key, 1);
  password.kv.failPut = (name) => name.startsWith('ce-worker-group-member:');
  await password.join(1, { proof });
  const stored = JSON.stringify([...f.values, ...f.groupState.store, ...password.values, ...password.groupState.store]);
  assert.equal(stored.includes(code), false);
  assert.equal(stored.includes(proof.slice(2, 40)), false);
  assert.equal(JSON.stringify([...password.values]).includes(key.address.slice(2).toLowerCase()), false);
});

test('a hundred people join at once with their own codes, or with one password', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const list = codes(100);
  await f.admin('groups/invites/add', { hashes: await hashes(list) });
  const byCode = await Promise.all(list.map((code, index) => f.join(index, { secret: code })));
  assert.equal(byCode.filter((result) => result.ok).length, 100, JSON.stringify(byCode.find((result) => !result.ok)));
  assert.equal(f.activeMembers(), 100);
  assert.deepEqual((await f.admin('groups/invites/list')).counts, { unused: 0, used: 100, revoked: 0 });

  const password = await createFixture({ joinMode: 'group_password' });
  const key = passwordKey('11');
  await password.admin('groups/password/set', { signer: key.address });
  const proofs = await Promise.all(list.map((_, index) => proofFor(key, index)));
  const byPassword = await Promise.all(proofs.map((proof, index) => password.join(index, { proof })));
  assert.equal(byPassword.filter((result) => result.ok).length, 100);
  assert.equal(password.activeMembers(), 100);
});

test('ten wrong guesses stop that person guessing, in any group, for the hour', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  assert.equal((await f.mutate({ operation: 'create', input: { groupId: 'second', label: 'Second', joinMode: 'one_use' } })).ok, true);
  const [good, other, later] = codes(3);
  await f.admin('groups/invites/add', { hashes: await hashes([good, other, later]) });
  await f.admin('groups/invites/add', { groupId: 'second', hashes: await hashes([good]) });
  for (const index of codes(10, 5).keys()) assert.deepEqual(await f.join(1, { secret: codes(10, 5)[index] }), REFUSED);
  assert.deepEqual(await f.join(1, { secret: good }), REFUSED);
  assert.deepEqual(await f.mutate({ operation: 'join', groupId: 'second', principal: principal(1), actorPrincipal: principal(1),
    credential: { secret: good } }), REFUSED);
  assert.equal(await inviteState(f, await hashOneUseSecret(good)), 'unused');
  assert.equal((await f.join(2, { secret: good })).ok, true);
  const realNow = f.groups.now;
  f.groups.now = () => realNow() + 60 * 60 * 1000;
  assert.equal((await f.join(1, { secret: other })).ok, true);
});

test('300 wrong passwords at a group close it to passwords for the hour, and tell its admins', async () => {
  const f = await createFixture({ joinMode: 'group_password' });
  const key = passwordKey('11');
  await f.admin('groups/password/set', { signer: key.address });
  assert.equal((await f.join(0, { proof: await proofFor(key, 0) })).ok, true);
  const wrong = passwordKey('22');
  for (let start = 0; start < 300; start += 50) {
    await Promise.all(Array.from({ length: 50 }, async (_, index) => {
      const person = 10 + Math.floor((start + index) / 10);
      return f.join(person, { proof: await proofFor(wrong, person) });
    }));
  }
  assert.equal((await f.admin('groups/list')).groups[0].guessLimited, true);
  assert.deepEqual(await f.join(1, { proof: await proofFor(key, 1) }), REFUSED);
  assert.equal((await f.join(0)).ok, true);
  const realNow = f.groups.now;
  f.groups.now = () => realNow() + 60 * 60 * 1000;
  assert.equal((await f.admin('groups/list')).groups[0].guessLimited, false);
  assert.equal((await f.join(1, { proof: await proofFor(key, 1) })).ok, true);
});

test('a new password reopens a group that wrong guesses closed', async () => {
  const f = await createFixture({ joinMode: 'group_password' });
  await f.admin('groups/password/set', { signer: passwordKey('11').address });
  const wrong = passwordKey('22');
  for (let start = 0; start < 300; start += 50) {
    await Promise.all(Array.from({ length: 50 }, async (_, index) => {
      const person = 10 + Math.floor((start + index) / 10);
      return f.join(person, { proof: await proofFor(wrong, person) });
    }));
  }
  assert.equal((await f.admin('groups/list')).groups[0].guessLimited, true);
  const fresh = passwordKey('33');
  await f.admin('groups/password/set', { signer: fresh.address });
  assert.equal((await f.admin('groups/list')).groups[0].guessLimited, false);
  assert.equal((await f.join(1, { proof: await proofFor(fresh, 1) })).ok, true);
});

test('wrong codes from many people never close a one-use group to the right code', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const [good] = codes(1);
  await f.admin('groups/invites/add', { hashes: await hashes([good]) });
  const wrong = codes(300, 7);
  for (let start = 0; start < 300; start += 50) {
    await Promise.all(wrong.slice(start, start + 50).map((code, index) => f.join(10 + Math.floor((start + index) / 10), { secret: code })));
  }
  assert.equal((await f.admin('groups/list')).groups[0].guessLimited, false);
  assert.equal((await f.join(1, { secret: good })).ok, true);
});

test('proofs before a password is set are not counted as guesses', async () => {
  const f = await createFixture({ joinMode: 'group_password' });
  const key = passwordKey('11');
  for (let attempt = 0; attempt < 12; attempt += 1) assert.deepEqual(await f.join(1, { proof: await proofFor(key, 1) }), REFUSED);
  await f.admin('groups/password/set', { signer: key.address });
  assert.equal((await f.join(1, { proof: await proofFor(key, 1) })).ok, true);
});

test('joins to an open group, and joins with no code, never count as guesses', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const [good] = codes(1);
  await f.admin('groups/invites/add', { hashes: await hashes([good]) });
  for (let attempt = 0; attempt < 12; attempt += 1) assert.deepEqual(await f.join(1), REFUSED);
  assert.equal((await f.join(1, { secret: good })).ok, true);
  const open = await createFixture();
  for (let attempt = 0; attempt < 12; attempt += 1) await open.join(1, { secret: codes(1, attempt)[0] });
  assert.equal([...open.groupState.store.keys()].some((key) => key.startsWith('worker-group-guesses')), false);
});

test('the guessing hour runs from the first wrong guess, not the latest', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  const [good] = codes(1);
  await f.admin('groups/invites/add', { hashes: await hashes([good]) });
  const start = Date.now();
  f.groups.now = () => start;
  for (const code of codes(9, 4)) await f.join(1, { secret: code });
  f.groups.now = () => start + 50 * 60 * 1000;
  await f.join(1, { secret: codes(1, 6)[0] });
  assert.deepEqual(await f.join(1, { secret: good }), REFUSED);
  f.groups.now = () => start + 61 * 60 * 1000;
  assert.equal((await f.join(1, { secret: good })).ok, true);
});

test('a code revoked while its join is still settling stays revoked if that join fails', async () => {
  for (const revoke of [(hash) => ({ hashes: [hash] }), () => ({ allUnused: true })]) {
    const f = await createFixture({ joinMode: 'one_use' });
    const [code] = codes(1);
    const [hash] = await hashes([code]);
    await f.admin('groups/invites/add', { hashes: [hash] });
    f.kv.failPut = (key) => key.startsWith('ce-worker-group-member:');
    assert.equal((await f.join(1, { secret: code })).reason, 'worker_group_mutation_ambiguous');
    assert.equal((await f.admin('groups/invites/revoke', revoke(hash))).status, 200);
    // The join's replay then fails for good, and gives its code back.
    const groupKey = [...f.values.keys()].find((key) => key.startsWith('ce-worker-group:'));
    const record = f.values.get(groupKey);
    f.values.delete(groupKey);
    await f.join(1);
    f.values.set(groupKey, record);
    assert.equal(await inviteState(f, hash), 'revoked');
    assert.deepEqual((await f.admin('groups/invites/list')).counts, { unused: 0, used: 0, revoked: 1 });
    assert.deepEqual(await f.join(2, { secret: code }), REFUSED);
  }
});

test('a person out of guesses still joins open groups, even with a stray code', async () => {
  const f = await createFixture({ joinMode: 'one_use' });
  for (const code of codes(10, 3)) await f.join(1, { secret: code });
  assert.equal((await f.mutate({ operation: 'create', input: { groupId: 'open', label: 'Open', joinMode: 'open' } })).ok, true);
  assert.equal((await f.mutate({ operation: 'join', groupId: 'open', principal: principal(1), actorPrincipal: principal(1),
    credential: { secret: codes(1)[0] } })).ok, true);
});

test('an open group an older Worker hid from lists stays hidden until an admin lists it', async () => {
  const f = await createFixture({ joinMode: 'open', memberVisibility: 'members' });
  // Stored as an older Worker stored it: no listing choice in either copy.
  const kvKey = [...f.values.keys()].find((key) => key.startsWith('ce-worker-group:') && key.endsWith(':salon'));
  const { listed: _kv, ...kvGroup } = JSON.parse(f.values.get(kvKey));
  f.values.set(kvKey, JSON.stringify(kvGroup));
  const [stateKey, state] = [...f.groupState.store].find(([, value]) => value === f.groupRecord());
  const { listed: _state, ...olderState } = state;
  f.groupState.store.set(stateKey, olderState);
  const strangerSees = async () => {
    const result = await listWorkerGroups({ env: f.env, slug: 'fixture', sessionId: SESSION_ID,
      actorPrincipalResult: { principal: principal(7) }, expectedGroupCount: 1 });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.groups.map((group) => group.groupId);
  };
  assert.deepEqual(await strangerSees(), []);
  // An edit that doesn't name the choice keeps the old visibility.
  assert.equal((await f.mutate({ operation: 'update', input: { memberLimit: 30 } })).ok, true);
  assert.deepEqual(await strangerSees(), []);
  assert.equal((await f.mutate({ operation: 'update', input: { listed: true } })).ok, true);
  assert.deepEqual(await strangerSees(), ['salon']);
});

test('a new group stores its listing, so member visibility never moves it; an open one is always listed', async () => {
  const strangerSees = async (f) => (await listWorkerGroups({ env: f.env, slug: 'fixture', sessionId: SESSION_ID,
    actorPrincipalResult: { principal: principal(7) }, expectedGroupCount: 1 })).groups.map((group) => group.groupId);
  const open = await createFixture({ joinMode: 'open', memberVisibility: 'members' });
  assert.deepEqual(await strangerSees(open), ['salon']);
  const added = await createFixture({ joinMode: 'admin_add', memberVisibility: 'session' });
  assert.deepEqual(await strangerSees(added), ['salon']);
  assert.equal((await added.mutate({ operation: 'update', input: { memberVisibility: 'members' } })).ok, true);
  assert.deepEqual(await strangerSees(added), ['salon']);
});
