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
  workerGroupReadOrigin,
  workerGroupReadStatementV2,
  buildWorkerGroupReadCodeInvite,
  workerGroupReadCodeMac,
  workerGroupReadCodeStatement,
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
  assert.deepEqual(parseWorkerGroupReadInvite(` ${header} `), { groupId, proof, version: 1 });
  assert.deepEqual(parseWorkerGroupReadInvite(`Salon.2-a:${proof}`), { groupId: 'salon.2-a', proof, version: 1 });
  // The form that names its Worker is marked, and a group called "v2" is still a group.
  assert.deepEqual(parseWorkerGroupReadInvite(`v2:Salon.2-a:${proof}`), { groupId: 'salon.2-a', proof, version: 2 });
  assert.deepEqual(parseWorkerGroupReadInvite(`v2:${proof}`), { groupId: 'v2', proof, version: 1 });
  assert.equal(formatWorkerGroupReadInvite({ groupId, proof, version: 2 }), `v2:${groupId}:${proof}`);
  for (const bad of [`v2:a:b:${proof}`, `v3:${groupId}:${proof}`, `v2::${proof}`]) assert.equal(parseWorkerGroupReadInvite(bad), null, bad);
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

test('a read proof that names its Worker is no proof for any other Worker, or for the form that names none', async () => {
  const keys = createWorkerGroupPasswordKeys(ethers);
  const password = 'river-stone-lamp-oak-tide';
  const signer = await keys.signerOf({ password, sessionId, groupId });
  const workerOrigin = 'https://ce-salon.example.workers.dev';
  assert.equal(
    workerGroupReadStatementV2({ sessionId, groupId, workerOrigin: `${workerOrigin.toUpperCase()}/path?x=1` }),
    `ContextEngine.WorkerGroup.Read:2\nsession:${sessionId.toLowerCase()}\ngroup:${groupId}\nworker:${workerOrigin}`,
  );
  const proof = await keys.signReadFor({ password, sessionId, groupId, workerOrigin });
  assert.equal(ethers.utils.verifyMessage(workerGroupReadStatementV2({ sessionId, groupId, workerOrigin }), proof), signer);
  for (const other of ['https://impostor.example', 'http://ce-salon.example.workers.dev', 'https://ce-salon.example.workers.dev:8443']) {
    assert.notEqual(ethers.utils.verifyMessage(workerGroupReadStatementV2({ sessionId, groupId, workerOrigin: other }), proof), signer, other);
  }
  assert.notEqual(ethers.utils.verifyMessage(workerGroupReadStatement({ sessionId, groupId }), proof), signer);
  assert.notEqual(keys.recoverJoinSigner({ sessionId, groupId, address, proof }), signer);
  for (const bad of ['', 'not a url', 'ftp://files.example', undefined]) {
    await assert.rejects(keys.signReadFor({ password, sessionId, groupId, workerOrigin: bad }), /needs the Session Worker/);
    assert.equal(workerGroupReadOrigin(bad), '');
  }
});

test('a one-use code’s read proof carries the start of its hash and a keyed hash, never the code', async () => {
  const code = '0123456789ABCDEF0123456789abcdef';
  const hash = await hashOneUseSecret(code);
  const input = { codeHash: hash, sessionId, groupId: 'by-code', workerOrigin: 'https://Worker.example/path', expires: 1795000000 };
  const header = await buildWorkerGroupReadCodeInvite(input);
  const statement = workerGroupReadCodeStatement(input);
  assert.equal(statement, `ContextEngine.WorkerGroup.ReadCode:1\nsession:${sessionId.toLowerCase()}\ngroup:by-code\nworker:https://worker.example\nexpires:1795000000`);
  const mac = await workerGroupReadCodeMac({ codeHash: hash, statement });
  assert.equal(header, `c1:by-code:${hash.slice(0, 16)}:1795000000:${mac}`);
  assert.equal(header.includes(hash) || header.toLowerCase().includes(code.toLowerCase()), false);
  assert.deepEqual(parseWorkerGroupReadInvite(header), { groupId: 'by-code', version: 'code', hashPrefix: hash.slice(0, 16), expires: 1795000000, mac });
  // Any other session, group, Worker, time or code gives another keyed hash.
  for (const other of [{ sessionId: '0x01' }, { groupId: 'salon' }, { workerOrigin: 'https://other.example' }, { expires: 1795000001 }]) {
    assert.notEqual((await buildWorkerGroupReadCodeInvite({ ...input, ...other })).split(':')[4], mac);
  }
  assert.notEqual(await workerGroupReadCodeMac({ codeHash: await hashOneUseSecret('f'.repeat(32)), statement }), mac);
  await assert.rejects(buildWorkerGroupReadCodeInvite({ ...input, codeHash: code }), /hash is required/);
  await assert.rejects(buildWorkerGroupReadCodeInvite({ ...input, workerOrigin: 'not a url' }), /needs the Session Worker/);
  for (const bad of [`c1:by-code:${hash.slice(0, 15)}:1795000000:${mac}`, `c1:by-code:${hash.slice(0, 16)}:17950:${mac}`,
    `c1:by-code:${hash.slice(0, 16)}:1795000000:${mac.slice(2)}`, `c1:-x:${hash.slice(0, 16)}:1795000000:${mac}`, `c1:by-code:${code}`, `c2:by-code:${hash.slice(0, 16)}:1795000000:${mac}`]) {
    assert.equal(parseWorkerGroupReadInvite(bad), null, bad);
  }
});
