// How the group coordinator stores and checks what admits someone to a group
// that isn't open: one-use codes, kept only as their SHA-256 hashes, and a
// group password, kept only as the address of the key it derives. Neither the
// code nor the password, nor a join's signature, is ever stored or returned.
import * as ethersModule from 'ethers';
import {
	WORKER_GROUP_INVITE_BATCH_MAX,
	hashOneUseSecret,
	isOneUseSecretHash,
	workerGroupJoinStatement,
} from '../../shared/workerGroupJoin.mjs';

// The Worker's ethers is v6 (`verifyMessage`); v5 keeps it under `utils`.
const verifyMessage =
	ethersModule.verifyMessage || ethersModule.utils?.verifyMessage || ethersModule.default?.verifyMessage;
const ONE_USE_SECRET = /^[0-9a-f]{32}$/i;
const JOIN_PROOF = /^0x[0-9a-f]{130}$/i;
const SIGNER = /^0x[0-9a-f]{40}$/i;

export const WORKER_GROUP_INVITE_LIST_MAX = 250;

// Under the group authority's prefix, so session backups and restores carry
// codes with the groups they belong to. Group ids are never reused.
export const workerGroupInvitePrefix = (groupId) => `worker-group-capacity-invite-v3:${encodeURIComponent(groupId)}:`;
export const workerGroupInviteKey = (groupId, hash) => `${workerGroupInvitePrefix(groupId)}${hash}`;

/** A group state's code counts, zero when it has none yet. */
export const workerGroupInviteCounts = (state) => ({
	unused: Math.max(0, Number(state?.invites?.unused) || 0),
	used: Math.max(0, Number(state?.invites?.used) || 0),
	revoked: Math.max(0, Number(state?.invites?.revoked) || 0),
});

/** A batch of new code hashes, or null when it isn't 1–500 distinct 64-hex hashes. */
export const normalizeWorkerGroupInviteHashes = (value, { max = WORKER_GROUP_INVITE_BATCH_MAX } = {}) => {
	if (!Array.isArray(value) || value.length < 1 || value.length > max) return null;
	const hashes = value.map((hash) => (typeof hash === 'string' ? hash.toLowerCase() : ''));
	if (!hashes.every(isOneUseSecretHash) || new Set(hashes).size !== hashes.length) return null;
	return hashes;
};

export const normalizeWorkerGroupSigner = (value) => (typeof value === 'string' && SIGNER.test(value) ? value.toLowerCase() : '');

// Compares without stopping at the first difference.
export const constantTimeEqual = (left, right) => {
	const a = String(left);
	const b = String(right);
	let difference = a.length ^ b.length;
	for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
		difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
	}
	return difference === 0;
};

/**
 * What a join carries, reduced to what the coordinator compares: a one-use code's hash, or the
 * address that signed the join statement for this session, group and joiner. Null when the join
 * carries nothing; `{ kind: 'invalid' }` when what it carries can't be checked.
 */
export const resolveWorkerGroupJoinCredential = async ({ credential, sessionId, groupId, address }) => {
	const secret = credential?.secret;
	const proof = credential?.proof;
	if (secret == null && proof == null) return null;
	if (secret != null && proof != null) return { kind: 'invalid' };
	if (secret != null) {
		return typeof secret === 'string' && ONE_USE_SECRET.test(secret)
			? { kind: 'one_use', hash: await hashOneUseSecret(secret) }
			: { kind: 'invalid' };
	}
	// A principal with no address can't hold a password proof: nothing to check or count.
	if (!address) return null;
	if (typeof proof !== 'string' || !JOIN_PROOF.test(proof)) return { kind: 'invalid' };
	try {
		const signer = verifyMessage(workerGroupJoinStatement({ sessionId, groupId, address }), proof);
		return { kind: 'password', signer: signer.toLowerCase() };
	} catch {
		return { kind: 'invalid' };
	}
};
