import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ethers } from 'ethers';
import {
  createWorkerGroupPasswordKeys,
  formatGroupInviteToken,
  generateOneUseSecret,
  hashOneUseSecret,
  inviteIdOfHash,
  isOneUseSecretHash,
  parseGroupInviteToken,
  workerGroupJoinStatement,
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

test('hashes a claim code the same whatever its case', async () => {
  const hash = await hashOneUseSecret('abcdef0123456789abcdef0123456789');
  assert.ok(isOneUseSecretHash(hash));
  assert.equal(hash, await hashOneUseSecret('ABCDEF0123456789ABCDEF0123456789'));
  assert.equal(hash, createHash('sha256').update('abcdef0123456789abcdef0123456789').digest('hex'));
  assert.equal(inviteIdOfHash(hash), hash.slice(0, 8));
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
