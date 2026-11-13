import { ethers } from 'ethers';
import {
  createWorkerGroupPasswordKeys,
  formatGroupInviteToken,
  generateOneUseSecret,
  hashOneUseSecret,
  parseGroupInviteToken,
  WORKER_GROUP_INVITE_FRAGMENT_KEY,
  workerGroupPasswordProblem,
} from '../../../../shared/workerGroupJoin.mjs';
import { buildWorkerGroupAutoJoinPath } from './workerGroupAutoJoin';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { setWorkerGroupPassword, type PostSignedWorkerGroupRequest } from './workerGroupPorts';

// The browser side of a group's secrets: it makes them, carries them in a link's fragment (never sent to a
// server) and turns them into what a join sends. Neither a password nor a claim code reaches the Worker.

const keys = createWorkerGroupPasswordKeys(ethers);
// The Worker's canonical ids (it lowercases group ids), so the admin and the joiner derive alike.
const canonical = (sessionId: string) => normalizeWorkerCanonicalSessionIdHex(sessionId) || sessionId;
const groupKey = (groupId: string) => groupId.toLowerCase();

/** The address the Worker stores for a group password. */
export const workerGroupPasswordSigner = (password: string, sessionId: string, groupId: string) =>
  keys.signerOf({ password, sessionId: canonical(sessionId), groupId: groupKey(groupId) });

/** A group's join link, with its secret in the fragment when there is one. */
export const buildWorkerGroupInviteLink = ({
  sessionSlug,
  groupId,
  workerUrl,
  token = '',
}: {
  sessionSlug: string;
  groupId: string;
  workerUrl?: string;
  token?: string;
}): string => {
  const url = new URL(buildWorkerGroupAutoJoinPath(sessionSlug, groupId, workerUrl), window.location.origin);
  if (token) url.hash = `${WORKER_GROUP_INVITE_FRAGMENT_KEY}=${encodeURIComponent(token)}`;
  return url.toString();
};

export type OneUseInvite = { secret: string; hash: string };

/** A batch of one-use claim codes, with the hashes the Worker keeps. */
export const makeOneUseInvites = (count: number): Promise<OneUseInvite[]> =>
  Promise.all(
    Array.from({ length: count }, async () => {
      const secret = generateOneUseSecret();
      return { secret, hash: await hashOneUseSecret(secret) };
    }),
  );

export const oneUseInviteToken = (secret: string) => formatGroupInviteToken({ kind: 'one_use', secret });
export const groupPasswordToken = (password: string) => formatGroupInviteToken({ kind: 'password', password });

/** On-chain columns: index, the claim code and its link. */
export const buildOneUseInvitesCsv = (links: { secret: string; link: string }[]): string =>
  ['index,password,inviteLink', ...links.map(({ secret, link }, index) => `${index},${secret},"${link}"`)].join('\n');

export type WorkerGroupJoinCredentials = { secret: string } | { proof: string };

/**
 * What a join sends for a held token: the claim code, or a password's signature for this address. A password takes
 * about a second to stretch. Null for a token that isn't usable yet (an invite code).
 */
export const buildWorkerGroupJoinCredentials = async ({
  token,
  sessionId,
  groupId,
  address,
}: {
  token: string;
  sessionId: string;
  groupId: string;
  address: string;
}): Promise<WorkerGroupJoinCredentials | null> => {
  const parsed = parseGroupInviteToken(token);
  if (parsed?.kind === 'one_use') return { secret: parsed.secret };
  if (parsed?.kind === 'password') {
    if (!address) throw new Error('Sign in with a wallet or passkey account to use a group password.');
    return {
      proof: await keys.signJoin({
        password: parsed.password,
        sessionId: canonical(sessionId),
        groupId: groupKey(groupId),
        address,
      }),
    };
  }
  return null;
};

/** A Group Password token can be handed on (as a recording's claims do); a one-use code would be spent. */
export const isSharableWorkerGroupToken = (token: string): boolean => parseGroupInviteToken(token)?.kind === 'password';

/** Sets or replaces a Group Password group's password: only its signer address reaches the Worker. */
export const saveWorkerGroupPassword = async ({
  password,
  groupId,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  password: string;
  groupId: string;
  sessionId: string;
  sessionSlug: string;
  postSignedRequest: PostSignedWorkerGroupRequest;
}) => {
  const problem = workerGroupPasswordProblem(password);
  if (problem) throw new Error(`Group password: ${problem}`);
  const signer = await workerGroupPasswordSigner(password, sessionId, groupId);
  return setWorkerGroupPassword({ groupId, sessionId, sessionSlug, postSignedRequest, signer });
};
