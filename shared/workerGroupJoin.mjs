// How a person joins a Worker-hosted group, shared by the browser, the Session Worker and the MCP.
// A group's id never admits anyone on its own: only Public URL ('open') groups join without a secret.
// The secret is a group password, from which the browser derives a key that signs a join statement,
// or a one-use claim code, of which the Worker stores only the SHA-256 hash.

import { GROUP_JOIN_CHOICES_FIELD } from './workerSessionPublicConfig.mjs';

export const WORKER_GROUP_JOIN_MODES = Object.freeze(['open', 'one_use', 'group_password', 'admin_add']);
// Every refusal before a valid secret, so a refusal never shows whether a group exists.
export const WORKER_GROUP_JOIN_REFUSED = 'worker_group_join_refused';
export const WORKER_GROUP_MEMBER_CEILING_DEFAULT = 1000;
export const WORKER_GROUP_MEMBER_CEILING_MAX = 10000;
export const WORKER_GROUP_INVITE_BATCH_MAX = 500;
// The Worker never shows a password's signer, so a guess can be checked only by sending it to the Worker,
// after 600,000 rounds of stretching. Wrong tries aren't limited, so a short password is the risk.
export const WORKER_GROUP_PASSWORD_MIN_LENGTH = 8;
export const WORKER_GROUP_INVITE_FRAGMENT_KEY = 'groupInvite';
// The session setting for the most members a group may have.
export const WORKER_GROUP_MEMBER_CEILING_FIELD = 'groupMemberCeiling';

export const isWorkerGroupMemberCeiling = (value) =>
  Number.isSafeInteger(value) && value >= 1 && value <= WORKER_GROUP_MEMBER_CEILING_MAX;

/** A session config's member ceiling, or the default when it has none. */
export const readWorkerGroupMemberCeiling = (config) => {
  const value = config && typeof config === 'object' ? config[WORKER_GROUP_MEMBER_CEILING_FIELD] : undefined;
  return isWorkerGroupMemberCeiling(value) ? value : WORKER_GROUP_MEMBER_CEILING_DEFAULT;
};

/** Whether the session's Worker offers One-use URLs, Group Password and unlisted groups. */
export const workerOffersGroupJoinChoices = (config) =>
  !!config && typeof config === 'object' && config[GROUP_JOIN_CHOICES_FIELD] === true;

const PASSWORD_PREFIX = 'gp:';
const INVITE_PREFIX = 'inv:';
const ONE_USE_SECRET = /^[0-9a-f]{32}$/i;
const SECRET_HASH = /^[0-9a-f]{64}$/;
const JOIN_STATEMENT = 'ContextEngine.WorkerGroup.Join:1';
const PASSWORD_DERIVATION = 'ce-worker-group-password-v1';
const PASSWORD_PBKDF2_ITERATIONS = 600000;
const MAX_TOKEN_LENGTH = 2000;

const normalizePassword = (password) => (typeof password === 'string' ? password.normalize('NFKC') : '');

/** Whether a typed or generated group password is long enough. */
export const isWorkerGroupPasswordLongEnough = (password) =>
  Array.from(normalizePassword(password)).length >= WORKER_GROUP_PASSWORD_MIN_LENGTH;

/**
 * A link's or a typed token: `gp:<password>`, a 32-hex one-use claim code, or `inv:…` (an invite code, not
 * accepted yet). A bare word is read as a password, since that is what people type. Null when unusable.
 */
export const parseGroupInviteToken = (text) => {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value || value.length > MAX_TOKEN_LENGTH) return null;
  if (value.startsWith(INVITE_PREFIX)) return { kind: 'invite' };
  if (ONE_USE_SECRET.test(value)) return { kind: 'one_use', secret: value.toLowerCase() };
  const password = normalizePassword(value.startsWith(PASSWORD_PREFIX) ? value.slice(PASSWORD_PREFIX.length) : value);
  return isWorkerGroupPasswordLongEnough(password) ? { kind: 'password', password } : null;
};

/**
 * Why an admin's new group password can't be used, or '' when it can. Joiners' text is parsed as a token
 * (trimmed, a `gp:` prefix dropped, 32 hex characters read as a claim code), so a password must parse back to itself.
 */
export const workerGroupPasswordProblem = (password) => {
  const normalized = normalizePassword(password);
  if (!isWorkerGroupPasswordLongEnough(normalized)) return `At least ${WORKER_GROUP_PASSWORD_MIN_LENGTH} characters.`;
  if (normalized !== normalized.trim()) return 'No spaces at the start or end.';
  const parsed = parseGroupInviteToken(normalized);
  return parsed?.kind === 'password' && parsed.password === normalized
    ? ''
    : 'That reads as a link code. Choose another.';
};

/** The token a link carries for a password or a one-use claim code. */
export const formatGroupInviteToken = ({ kind, password, secret }) => {
  if (kind === 'one_use' && typeof secret === 'string' && ONE_USE_SECRET.test(secret)) return secret.toLowerCase();
  if (kind === 'password' && isWorkerGroupPasswordLongEnough(password))
    return `${PASSWORD_PREFIX}${normalizePassword(password)}`;
  throw new Error('A group password of at least 8 characters, or a 32-character claim code, is required.');
};

const randomBytes = (length) => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};
const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** A one-use claim code: 128 random bits as 32 lowercase hex characters. */
export const generateOneUseSecret = () => hex(randomBytes(16));

/** The hash the Worker stores and compares: SHA-256 of the code's lowercase hex text, as 64 lowercase hex. */
export const hashOneUseSecret = async (secret) => {
  if (typeof secret !== 'string' || !ONE_USE_SECRET.test(secret))
    throw new Error('A 32-character claim code is required.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret.toLowerCase()));
  return hex(new Uint8Array(digest));
};

export const isOneUseSecretHash = (value) => typeof value === 'string' && SECRET_HASH.test(value);

/** What a password-derived key signs (EIP-191), binding the session, the group and the joiner's address. */
export const workerGroupJoinStatement = ({ sessionId, groupId, address }) =>
  `${JOIN_STATEMENT}\nsession:${String(sessionId).toLowerCase()}\ngroup:${String(groupId)}\naddress:${String(address).toLowerCase()}`;

const READ_STATEMENT = 'ContextEngine.WorkerGroup.Read:1';
// The header that carries a read invite: `<groupId>:<signature>`. Group ids never contain ':'.
export const WORKER_GROUP_READ_INVITE_HEADER = 'X-CE-Group-Invite';
// Why a private session refused a request: it carried no invite and isn't a member's, or its invite doesn't hold
// (wrong or changed password, a group the rule no longer names, a deleted group, or unreadable).
export const PRIVATE_SESSION_INVITE_REQUIRED = 'private_session_invite_required';
export const PRIVATE_SESSION_INVITE_INVALID = 'private_session_invite_invalid';
export const PRIVATE_SESSION_UNAVAILABLE = 'private_session_unavailable';
const READ_PROOF = /^0x[0-9a-f]{130}$/i;

/**
 * What a password-derived key signs (EIP-191) to read a private session signed out: the session and group, and no
 * address, so it proves the password without joining anyone. Reading spends nothing.
 */
export const workerGroupReadStatement = ({ sessionId, groupId }) =>
  `${READ_STATEMENT}\nsession:${String(sessionId).toLowerCase()}\ngroup:${String(groupId)}`;

const READ_STATEMENT_V2 = 'ContextEngine.WorkerGroup.Read:2';
/** What a Session Worker lists when it takes read proofs that name the Worker they are for. */
export const WORKER_GROUP_READ_PROOF_V2_FEATURE = 'group_read_proof_v2';
const READ_HEADER_V2 = /^v2:([^:]+):(0x[0-9a-f]{130})$/i;

/** An origin as a read proof names it, or '' when the value isn't one. */
export const workerGroupReadOrigin = (value) => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin.toLowerCase() : '';
  } catch {
    return '';
  }
};

/**
 * The read statement that also names the Session Worker it is for. A proof of the first form reads the session
 * on any Worker that holds it, so one sent to a Worker that only claims to be the session's could be used at the
 * real one. This form is refused by every Worker but the one at `workerOrigin`.
 */
export const workerGroupReadStatementV2 = ({ sessionId, groupId, workerOrigin }) =>
  `${READ_STATEMENT_V2}\nsession:${String(sessionId).toLowerCase()}\ngroup:${String(groupId)}\nworker:${workerGroupReadOrigin(workerOrigin)}`;

/** The header value for a read proof; `version: 2` for one that names its Worker. */
export const formatWorkerGroupReadInvite = ({ groupId, proof, version = 1 }) =>
  `${version === 2 ? 'v2:' : ''}${String(groupId)}:${String(proof)}`;

/** A header value as `{ groupId, proof, version }`, or null when it isn't one. */
export const parseWorkerGroupReadInvite = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > 300) return null;
  // `v2:<group>:<proof>`; a group that happens to be called "v2" has one colon, not two.
  const second = text.match(READ_HEADER_V2);
  const at = text.lastIndexOf(':');
  if (!second && at < 1) return null;
  const groupId = (second ? second[1] : text.slice(0, at)).toLowerCase();
  const proof = second ? second[2] : text.slice(at + 1);
  return /^[a-z0-9][a-z0-9._-]*$/.test(groupId) && READ_PROOF.test(proof) ? { groupId, proof, version: second ? 2 : 1 } : null;
};

/**
 * The group password's keys, as the SBT group password's (PBKDF2-SHA256, 600,000 iterations) but salted with the
 * session and group, so one password gives different keys in different groups. Pass an ethers v5 instance.
 */
export const createWorkerGroupPasswordKeys = (ethers) => {
  if (!ethers?.utils || !ethers?.Wallet) throw new Error('An ethers v5-compatible API is required.');
  const deriveWallet = async ({ password, sessionId, groupId }) => {
    const normalized = normalizePassword(password);
    if (!isWorkerGroupPasswordLongEnough(normalized))
      throw new Error('A group password of at least 8 characters is required.');
    if (!sessionId || !groupId) throw new Error('A group password needs its session and group.');
    const salt = ethers.utils.arrayify(
      ethers.utils.solidityKeccak256(
        ['string', 'string', 'string'],
        [PASSWORD_DERIVATION, String(sessionId).toLowerCase(), String(groupId)],
      ),
    );
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('Group passwords need WebCrypto (crypto.subtle).');
    const key = await subtle.importKey('raw', ethers.utils.toUtf8Bytes(normalized), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations: PASSWORD_PBKDF2_ITERATIONS,
      },
      key,
      256,
    );
    return new ethers.Wallet(ethers.utils.keccak256(new Uint8Array(bits)));
  };
  return Object.freeze({
    deriveWallet,
    /** The address the Worker stores for the password; it never sees the password. */
    signerOf: async (input) => (await deriveWallet(input)).address,
    /** The join proof for `address`, signed with the password's key. */
    signJoin: async ({ address, ...input }) =>
      (await deriveWallet(input)).signMessage(
        workerGroupJoinStatement({
          sessionId: input.sessionId,
          groupId: input.groupId,
          address,
        }),
      ),
    /** The read proof for this session and group, signed with the password's key. */
    signRead: async (input) =>
      (await deriveWallet(input)).signMessage(
        workerGroupReadStatement({ sessionId: input.sessionId, groupId: input.groupId }),
      ),
    /** The read proof for this session and group at one Session Worker, which no other Worker accepts. */
    signReadFor: async ({ workerOrigin, ...input }) => {
      if (!workerGroupReadOrigin(workerOrigin)) throw new Error('A read proof needs the Session Worker it is for.');
      return (await deriveWallet(input)).signMessage(
        workerGroupReadStatementV2({ sessionId: input.sessionId, groupId: input.groupId, workerOrigin }),
      );
    },
    /** The signer a proof was made with (the Worker compares it with the stored one). */
    recoverJoinSigner: ({ sessionId, groupId, address, proof }) =>
      ethers.utils.verifyMessage(workerGroupJoinStatement({ sessionId, groupId, address }), proof),
  });
};
