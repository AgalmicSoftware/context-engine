import { ethers } from 'ethers';
import {
  buildOneUseInvitesCsv,
  buildWorkerGroupInviteLink,
  buildWorkerGroupJoinCredentials,
  groupPasswordToken,
  isSharableWorkerGroupToken,
  makeOneUseInvites,
  oneUseInviteToken,
  workerGroupPasswordSigner,
} from './workerGroupSecrets';
import { hashOneUseSecret, workerGroupJoinStatement } from '../../../../shared/workerGroupJoin.mjs';

const sessionId = '0x11111111111111111111111111111111';
const groupId = 'salon-2';
const address = '0x0000000000000000000000000000000000000001';

it('puts the secret only in the link’s fragment', () => {
  const link = new URL(
    buildWorkerGroupInviteLink({
      sessionSlug: 'alpha',
      groupId,
      workerUrl: 'https://worker.example',
      token: groupPasswordToken('river stone lamp'),
    }),
  );
  expect(link.pathname).toBe('/session/alpha');
  expect(link.searchParams.get('joinGroup')).toBe(groupId);
  expect(link.search).not.toContain('river');
  expect(link.hash).toBe('#groupInvite=gp%3Ariver%20stone%20lamp');
  expect(new URL(buildWorkerGroupInviteLink({ sessionSlug: 'alpha', groupId })).hash).toBe('');
});

it('makes one-use codes with the hashes the Worker keeps, and exports them with on-chain columns', async () => {
  const invites = await makeOneUseInvites(3);
  expect(new Set(invites.map(({ secret }) => secret)).size).toBe(3);
  for (const { secret, hash } of invites) expect(hash).toBe(await hashOneUseSecret(secret));
  const csv = buildOneUseInvitesCsv(
    invites.map(({ secret }) => ({ secret, link: `https://x/#groupInvite=${secret}` })),
  );
  expect(csv.split('\n')[0]).toBe('index,password,inviteLink');
  expect(csv.split('\n')[1]).toBe(`0,${invites[0].secret},"https://x/#groupInvite=${invites[0].secret}"`);
  expect(isSharableWorkerGroupToken(oneUseInviteToken(invites[0].secret))).toBe(false);
  await expect(
    buildWorkerGroupJoinCredentials({ token: invites[0].secret, sessionId, groupId, address }),
  ).resolves.toEqual({ secret: invites[0].secret });
});

it('joins with a password’s signature, which only the password’s signer could make', async () => {
  const token = groupPasswordToken('river-stone-lamp-oak-tide');
  expect(isSharableWorkerGroupToken(token)).toBe(true);
  // A link may carry the group id in another case; the Worker lowercases it, so both sides derive from that.
  const result = await buildWorkerGroupJoinCredentials({ token, sessionId, groupId: groupId.toUpperCase(), address });
  const proof = (result as { proof: string }).proof;
  expect(ethers.utils.verifyMessage(workerGroupJoinStatement({ sessionId, groupId, address }), proof)).toBe(
    await workerGroupPasswordSigner('river-stone-lamp-oak-tide', sessionId, groupId.toUpperCase()),
  );
  expect(proof).not.toContain('river');
  await expect(buildWorkerGroupJoinCredentials({ token: 'inv:abc', sessionId, groupId, address })).resolves.toBeNull();
}, 30_000);
