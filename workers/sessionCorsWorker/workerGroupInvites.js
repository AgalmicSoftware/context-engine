// How the group coordinator stores and checks what admits someone to a group
// that isn't open: one-use codes, kept only as their SHA-256 hashes, and a
// group password, kept only as the address of the key it derives. Neither the
// code nor the password, nor a join's signature, is ever stored or returned.
import * as ethersModule from 'ethers';
import {
	WORKER_GROUP_INVITE_BATCH_MAX,
	hashOneUseSecret,
	isOneUseSecretHash,
	parseWorkerGroupReadInvite,
	workerGroupJoinStatement,
	WORKER_GROUP_READ_CODE_MAX_AGE_SECONDS,
	workerGroupReadCodeMac,
	workerGroupReadCodeStatement,
	workerGroupReadOrigin,
	workerGroupReadStatement,
	workerGroupReadStatementV2,
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

/**
 * A read invite header as `{ groupId, signer }`: the group it names and the key that signed its read statement for
 * this session. Null when there is no header; `{ invalid: true }` when there is one that can't be read. A proof
 * that names its Worker is checked against `workerOrigin`, this Worker's own address as the request reached it:
 * one made for another Worker recovers another signer, and one checked without an origin is unreadable.
 */
export const readWorkerGroupReadInvite = ({ header, sessionId, workerOrigin, now }) => {
	if (header == null || String(header).trim() === '') return null;
	const parsed = parseWorkerGroupReadInvite(header);
	if (!parsed || !sessionId) return { invalid: true };
	if (parsed.version === 'code') {
		// A one-use code's proof: for this Worker, and not yet past the hour it may name. Whether it matches a
		// code that is still unused is the group coordinator's to say.
		const forOrigin = workerGroupReadOrigin(workerOrigin);
		const nowSeconds = Math.floor((Number.isFinite(now) ? now : Date.now()) / 1000);
		if (!forOrigin || parsed.expires <= nowSeconds || parsed.expires > nowSeconds + WORKER_GROUP_READ_CODE_MAX_AGE_SECONDS + 60) return { invalid: true };
		return {
			groupId: parsed.groupId,
			code: {
				hashPrefix: parsed.hashPrefix,
				mac: parsed.mac,
				statement: workerGroupReadCodeStatement({ sessionId, groupId: parsed.groupId, workerOrigin: forOrigin, expires: parsed.expires }),
			},
		};
	}
	const origin = parsed.version === 2 ? workerGroupReadOrigin(workerOrigin) : '';
	if (parsed.version === 2 && !origin) return { invalid: true };
	try {
		const statement = parsed.version === 2
			? workerGroupReadStatementV2({ sessionId, groupId: parsed.groupId, workerOrigin: origin })
			: workerGroupReadStatement({ sessionId, groupId: parsed.groupId });
		const signer = verifyMessage(statement, parsed.proof);
		return { groupId: parsed.groupId, signer: signer.toLowerCase() };
	} catch {
		return { invalid: true };
	}
};

// Reading with a one-use code is off unless the Worker is deployed with CE_GROUP_CODE_READS set to "on". While
// off, the Worker does not list the capability and refuses every code proof like any other unreadable invite, so
// nothing is asked to send one. It is off by default because the hash kept for an unused code is enough to make
// a proof: until codes have a read key of their own, a listing of codes or a backup would hold read access.
export const workerGroupCodeReadsOn = (env) => String(env?.CE_GROUP_CODE_READS ?? '').trim().toLowerCase() === 'on';

// Wrong one-use code proofs one sender may offer a session's groups before further ones go unlooked-at for the
// rest of the window. Kept in the coordinator's memory: a read writes nothing, and a restart only forgives.
export const WORKER_GROUP_READ_CODE_MISSES = Object.freeze({ limit: 20, windowMs: 10 * 60 * 1000, senders: 2000 });
/** Counts for `createWorkerGroupReadCodeMisses().blocked(from, now)` and `.miss(from, now)`. */
export const createWorkerGroupReadCodeMisses = ({ limit, windowMs, senders } = WORKER_GROUP_READ_CODE_MISSES) => {
	const counts = new Map();
	const live = (from, nowMs) => {
		const entry = counts.get(from);
		if (entry && entry.resetAt <= nowMs) counts.delete(from);
		return counts.get(from);
	};
	// A request with no sender is the Worker's own, made for a caller it has already let in: never counted.
	return {
		blocked: (from, nowMs) => !!from && (live(from, nowMs)?.count ?? 0) >= limit,
		miss: (from, nowMs) => {
			if (!from) return;
			const entry = live(from, nowMs);
			if (entry) entry.count += 1;
			else {
				// Full: the oldest sender's count goes, which only ever forgives.
				if (counts.size >= senders) counts.delete(counts.keys().next().value);
				counts.set(from, { count: 1, resetAt: nowMs + windowMs });
			}
		},
	};
};

const READ_CODE_PROOF = Object.freeze({ hashPrefix: /^[0-9a-f]{16}$/, mac: /^[0-9a-f]{64}$/ });
/** A one-use code's read proof as the coordinator takes it, or null. */
export const normalizeWorkerGroupReadCode = (value) => {
	const code = value && typeof value === 'object' ? value : {};
	return typeof code.statement === 'string' && code.statement.length <= 600 &&
		READ_CODE_PROOF.hashPrefix.test(code.hashPrefix || '') && READ_CODE_PROOF.mac.test(code.mac || '')
		? { hashPrefix: code.hashPrefix, mac: code.mac, statement: code.statement }
		: null;
};
/**
 * Whether a read proof was made with one of a group's codes that is still unused. `candidates` are the stored
 * codes whose hash starts as the proof says, as `[hash, invite]`. Nothing is written: a read spends no code.
 */
export const matchesUnusedWorkerGroupInvite = async ({ code, candidates, nowMs }) => {
	let matched = false;
	for (const [hash, invite] of candidates) {
		const expiresAt = Date.parse(invite?.expiresAt ?? '');
		if (invite?.state !== 'unused' || expiresAt <= nowMs) continue;
		// Every candidate is checked, so the time taken says nothing of which one matched.
		if (constantTimeEqual(await workerGroupReadCodeMac({ codeHash: hash, statement: code.statement }), code.mac)) matched = true;
	}
	return matched;
};
