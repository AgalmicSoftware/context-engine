import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ethers } from 'ethers';
import {
  createWorkerGroupPasswordKeys,
  formatGroupInviteToken,
  generateOneUseSecret,
  hashOneUseSecret,
  isOneUseSecretHash,
  parseGroupInviteToken,
  readWorkerGroupMemberCeiling,
  workerOffersGroupJoinChoices,
  formatWorkerGroupReadInvite,
  parseWorkerGroupReadInvite,
  workerGroupJoinStatement,
  workerGroupPasswordProblem,
  workerGroupReadStatement,
} from '../../shared/workerGroupJoin.mjs';

const sessionId = '0x00112233445566778899AABBCCDDEEFF';
const groupId = 'salon-2';
const address = '0x1111111111111111111111111111111111111111';

test('reads the three token forms, and nothing else', () => {
  const secret = 'ABCDEF0123456789abcdef0123456789';
  assert.deepEqual(parseGroupInviteToken(` ${secret} `), {
    kind: 'one_use',
    secret: secret.toLowerCase(),
  });
  assert.deepEqual(parseGroupInviteToken('gp:river-stone-lamp'), {
    kind: 'password',
    password: 'river-stone-lamp',
  });
  // People type the password itself.
  assert.deepEqual(parseGroupInviteToken('river stone lamp'), {
    kind: 'password',
    password: 'river stone lamp',
  });
  assert.deepEqual(parseGroupInviteToken('inv:eyJjIjoxfQ'), { kind: 'invite' });
  for (const unusable of ['', 'gp:short', 'short', null, 42, 'x'.repeat(2001)])
    assert.equal(parseGroupInviteToken(unusable), null, String(unusable));
});

test('formats tokens that parse back to themselves', () => {
  const secret = generateOneUseSecret();
  assert.match(secret, /^[0-9a-f]{32}$/);
  assert.notEqual(secret, generateOneUseSecret());
  assert.deepEqual(parseGroupInviteToken(formatGroupInviteToken({ kind: 'one_use', secret })), {
    kind: 'one_use',
    secret,
  });
  const token = formatGroupInviteToken({
    kind: 'password',
    password: 'ﬁve words long',
  });
  assert.equal(token, 'gp:five words long');
  assert.deepEqual(parseGroupInviteToken(token), {
    kind: 'password',
    password: 'five words long',
  });
  assert.throws(() => formatGroupInviteToken({ kind: 'password', password: 'short' }));
});

test('takes a new password only when a joiner typing it would get it back', () => {
  for (const password of ['river stone lamp', 'ﬁve words long', 'a'.repeat(31)])
    assert.equal(workerGroupPasswordProblem(password), '');
  assert.equal(workerGroupPasswordProblem('short'), 'At least 8 characters.');
  assert.equal(workerGroupPasswordProblem('river stone lamp '), 'No spaces at the start or end.');
  for (const password of ['gp:river stone', 'inv:riverstone', 'A'.repeat(32)])
    assert.equal(workerGroupPasswordProblem(password), 'That reads as a link code. Choose another.');
});

test('hashes a claim code the same whatever its case', async () => {
  const hash = await hashOneUseSecret('abcdef0123456789abcdef0123456789');
  assert.ok(isOneUseSecretHash(hash));
  assert.equal(hash, await hashOneUseSecret('ABCDEF0123456789ABCDEF0123456789'));
  assert.equal(hash, createHash('sha256').update('abcdef0123456789abcdef0123456789').digest('hex'));
  await assert.rejects(hashOneUseSecret('not a code'));
});

test('a password signs a join only for its session, group and address', async () => {
  const keys = createWorkerGroupPasswordKeys(ethers);
  const password = 'river-stone-lamp-oak-tide';
  const signer = await keys.signerOf({ password, sessionId, groupId });
  assert.equal(
    signer,
    await keys.signerOf({
      password,
      sessionId: sessionId.toLowerCase(),
      groupId,
    }),
  );
  assert.notEqual(signer, await keys.signerOf({ password, sessionId, groupId: 'other' }));
  assert.notEqual(signer, await keys.signerOf({ password: 'another-password', sessionId, groupId }));

  const proof = await keys.signJoin({ password, sessionId, groupId, address });
  assert.equal(keys.recoverJoinSigner({ sessionId, groupId, address, proof }), signer);
  // A copied proof joins no one else.
  const other = '0x2222222222222222222222222222222222222222';
  assert.notEqual(keys.recoverJoinSigner({ sessionId, groupId, address: other, proof }), signer);
  assert.equal(
    workerGroupJoinStatement({
      sessionId,
      groupId,
      address: address.toUpperCase().replace('0X', '0x'),
    }),
    `ContextEngine.WorkerGroup.Join:1\nsession:${sessionId.toLowerCase()}\ngroup:${groupId}\naddress:${address}`,
  );
  await assert.rejects(keys.signerOf({ password: 'short', sessionId, groupId }));
});

test('a read proof names its session and group, no address, and joins no one', async () => {
  const keys = createWorkerGroupPasswordKeys(ethers);
  const password = 'river-stone-lamp-oak-tide';
  const signer = await keys.signerOf({ password, sessionId, groupId });
  assert.equal(
    workerGroupReadStatement({ sessionId, groupId }),
    `ContextEngine.WorkerGroup.Read:1\nsession:${sessionId.toLowerCase()}\ngroup:${groupId}`,
  );
  const proof = await keys.signRead({ password, sessionId, groupId });
  assert.equal(ethers.utils.verifyMessage(workerGroupReadStatement({ sessionId, groupId }), proof), signer);
  assert.notEqual(ethers.utils.verifyMessage(workerGroupReadStatement({ sessionId, groupId: 'other' }), proof), signer);
  // It is not a join proof for anyone.
  assert.notEqual(keys.recoverJoinSigner({ sessionId, groupId, address, proof }), signer);

  const header = formatWorkerGroupReadInvite({ groupId, proof });
  assert.equal(header, `${groupId}:${proof}`);
  assert.deepEqual(parseWorkerGroupReadInvite(` ${header} `), { groupId, proof });
  assert.deepEqual(parseWorkerGroupReadInvite(`Salon.2-a:${proof}`), { groupId: 'salon.2-a', proof });
  for (const bad of ['', proof, `:${proof}`, `${groupId}:${proof.slice(0, -2)}`, `${groupId}:${proof}00`,
    `-x:${proof}`, `a b:${proof}`, `${'a'.repeat(200)}:${proof}`, null, 7]) {
    assert.equal(parseWorkerGroupReadInvite(bad), null, String(bad));
  }
});

test('reads the session ceiling and the Worker capability', () => {
  assert.equal(readWorkerGroupMemberCeiling({}), 1000);
  assert.equal(readWorkerGroupMemberCeiling({ groupMemberCeiling: 10000 }), 10000);
  for (const bad of [0, 10001, 2.5, '500'])
    assert.equal(readWorkerGroupMemberCeiling({ groupMemberCeiling: bad }), 1000);
  assert.equal(workerOffersGroupJoinChoices({ groupJoinChoices: true }), true);
  assert.equal(workerOffersGroupJoinChoices({ groupJoinChoices: 'yes' }), false);
  assert.equal(workerOffersGroupJoinChoices(null), false);
});
