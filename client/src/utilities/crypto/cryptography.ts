/**
 * @module cryptography
 * @description Envelope v1 encryption — AES-GCM symmetric encryption with Lit Protocol
 *              key wrapping. Provides encrypt/decrypt, key derivation, and hash utilities.
 *
 * Key exports: cryptoUtils
 */
/*
 *
 * Envelope v1 — Single encryption pathway
 * ---------------------------------------------------
 * - Per-field CEK (AES-GCM-256) content encryption
 * - Recipients:
 *    • self-eip712-v1 (EIP-712 ➜ HKDF(SHA-256) KEK) wraps CEK with AES-GCM
 *    • optional lit-sbt-v1 (Lit Protocol ACC) carries ciphertext/dataToEncryptHash + ACC metadata
 * - Public commitments per field: salted Keccak-256 AND Poseidon (same salt, 128–256 bit)
 * - Salt is stored ONLY inside the CEK-encrypted plaintext and surfaced as `zkSalt` on decrypt
 * - No legacy `alg`, no v1 payload support
 *
 * Exported API (names preserved):
 *   - cryptoUtils.getProviderKind(providerLike)
 *   - cryptoUtils._getProvider(providerLike)           // internal normalization
 *   - cryptoUtils.encryptMultipleAnswers(surveyState, optsOrPubKey, extraOpts)
 *   - cryptoUtils.decryptMultipleAnswers(slice, questionPool, account, providerKind, opts)
 *   - cryptoUtils.decryptSingleField(slice, qId, fieldToDecrypt, account, providerKind, opts)
 *   - cryptoUtils.computeContext({ chainId, account, surveyId, qId })
 *   - cryptoUtils.encryptWithPassword(data, password)
 *   - cryptoUtils.decryptWithPassword(encryptedData, password)
 */

/* eslint-env es2020 */

import { Buffer } from 'buffer';
import { ethers, utils } from 'ethers';
import { createLogger } from '../logging';
import { perfDebugDecryptEnvelope } from '../web3/rpcDebugStats.js';

type UnknownRecord = Record<string, unknown>;
type EthereumRequest = { method: string; params?: unknown[] };
type Eip1193Provider = {
  request: (request: EthereumRequest) => Promise<unknown>;
  address?: unknown;
  isPasskeyEoa?: boolean;
  selectedAddress?: unknown;
};
type ProviderLike =
  | string
  | (UnknownRecord & {
      provider?: unknown;
      request?: Eip1193Provider['request'];
    })
  | null
  | undefined;
type ProviderKind = 'wagmi' | 'passkey-eoa' | 'web3auth';
type ByteInput = Uint8Array | ArrayBuffer | ArrayBufferView | ArrayLike<number>;
type MaybePromise<T> = T | Promise<T>;
type PoseidonHashValue = string | number | bigint;
type PoseidonHasher = (inputs: bigint[]) => MaybePromise<PoseidonHashValue>;
type CryptoFieldEntry = UnknownRecord & {
  value?: unknown;
  encrypted?: boolean;
  encryptedPortion?: string | UnknownRecord;
  hash?: string;
  poseidon?: string;
  zkSalt?: unknown;
};
type CryptoAnswerSlice = {
  answers?: Record<string, CryptoFieldEntry>;
  additionalComments?: Record<string, CryptoFieldEntry>;
  importance?: Record<string, unknown>;
};
type CryptoAnswerOutput = {
  answers: Record<string, CryptoFieldEntry>;
  additionalComments: Record<string, CryptoFieldEntry>;
  importance: Record<string, unknown>;
};
type ChainIdInput = unknown;
type SurveyContextInput = {
  chainId?: ChainIdInput;
  account?: unknown;
  surveyId?: unknown;
  qId?: unknown;
  fieldKey?: unknown;
};
type QuestionLike = UnknownRecord & {
  id?: unknown;
  type?: unknown;
  options?: unknown;
};
type QuestionKindMeta = {
  kind: 'freeform' | 'binary' | 'rating' | 'multichoice';
  options: unknown[];
};
type CryptoEncryptOptions = UnknownRecord & {
  provider?: unknown;
  providerLike?: unknown;
  providerKind?: unknown;
  account?: unknown;
  chainId?: ChainIdInput;
  surveyId?: unknown;
  onlyTheseQids?: unknown[];
  questionPool?: unknown;
  lit?: LitOptions;
  hasher?: PoseidonHasher | null;
  poseidon?: PoseidonHasher | null;
  kind?: unknown;
  contextLabel?: unknown;
  label?: unknown;
  qId?: unknown;
};
type CryptoDecryptOptions = UnknownRecord & {
  provider?: unknown;
  providerLike?: unknown;
  providerKind?: unknown;
  account?: unknown;
  chainId?: ChainIdInput;
  surveyId?: string;
  lit?: LitOptions;
  litOpts?: LitOptions;
  throwOnError?: boolean;
  preferLitRecipients?: boolean;
};
type GroupPasswordInput = {
  password?: unknown;
  sbtAddress?: unknown;
  groupPasswordHash?: unknown;
};
type GroupMintAuthorizationInput = GroupPasswordInput & {
  userAddress?: unknown;
  walletScopeSbtAddress?: unknown;
};
type InviteInput = GroupPasswordInput & {
  nonce?: unknown;
  signature?: unknown;
  walletScopeSbtAddress?: unknown;
};
type InviteSignatureVerificationResult = {
  ok: boolean;
  signer?: string;
  usedFallback?: boolean;
  error?: string;
};
type AesGcmOptions = { aadBytes?: BufferSource };
type LitSaveKeyResult = UnknownRecord & {
  ciphertext?: string;
  dataToEncryptHash?: string;
  encryptedSymmetricKey?: string | ByteInput;
  chipotle?: unknown;
};
type LitOptions = UnknownRecord & {
  saveKey?: unknown;
  getKey?: unknown;
  accessControlConditions?: unknown;
  chain?: unknown;
  chainId?: ChainIdInput;
  resourceId?: unknown;
  litNetwork?: unknown;
  connectTimeout?: unknown;
  providerLike?: unknown;
  resourceAbilityRequests?: unknown;
  recipients?: unknown[];
};
type EnvelopeRecipient = UnknownRecord & {
  type?: string;
  lit?: UnknownRecord;
  wrap_iv?: string;
  wrapped_cek?: string;
  nonce?: string | number | null;
};
type Envelope = UnknownRecord & {
  v: unknown;
  cipher?: unknown;
  iv: string;
  ciphertext: string;
  aad: UnknownRecord;
  recipients: EnvelopeRecipient[];
  commitments: UnknownRecord;
  meta?: UnknownRecord;
};
type Commitments = {
  keccakHex: string;
  poseidonHex: string | null;
  saltBytes: Uint8Array;
  saltHex: string;
  canonicalBytes: Uint8Array;
};
type DecryptEnvelopeResult = {
  value: unknown;
  kind: unknown;
  zkSalt: unknown;
};
type DecryptCacheEntry = {
  ok: boolean;
  ts: number;
  value?: DecryptEnvelopeResult;
  errMsg?: string;
};

declare global {
  interface Window {
    __passkeyEoaProvider?: Eip1193Provider & { isPasskeyEoa?: boolean };
    __ceCreatePasskeyEip1193Provider?: () => Eip1193Provider | null;
    web3authProvider?: Eip1193Provider;
    poseidon?: PoseidonHasher;
    poseidon1?: PoseidonHasher;
    Poseidon?: PoseidonHasher;
  }
}

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const toErrorMessage = (err: unknown, fallback = ''): string => {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  const message = String(err || '').trim();
  return message || fallback;
};
const isPromiseLike = <T>(value: unknown): value is PromiseLike<T> =>
  !!value &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as { then?: unknown }).then === 'function';
const toOptionalString = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);
const toUint8Array = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value && typeof value === 'object' && typeof (value as ArrayLike<number>).length === 'number') {
    return new Uint8Array(value as ArrayLike<number>);
  }
  return new Uint8Array([]);
};

/**
 * @typedef {object} CryptoFieldEntry
 * @property {unknown=} value
 * @property {boolean=} encrypted
 * @property {string | Record<string, unknown>=} encryptedPortion
 * @property {string=} hash
 * @property {string=} poseidon
 * @property {string=} zkSalt
 */

/**
 * @typedef {object} CryptoAnswerSlice
 * @property {Record<string, CryptoFieldEntry>=} answers
 * @property {Record<string, CryptoFieldEntry>=} additionalComments
 * @property {Record<string, unknown>=} importance
 */

/**
 * @typedef {object} CryptoEncryptOptions
 * @property {unknown=} provider
 * @property {unknown=} providerLike
 * @property {unknown=} providerKind
 * @property {string=} account
 * @property {number | string | null=} chainId
 * @property {string=} surveyId
 * @property {string[]=} onlyTheseQids
 * @property {Array<Record<string, unknown>>=} questionPool
 * @property {Record<string, unknown>=} lit
 * @property {((inputs: bigint[]) => string | bigint | Promise<string | bigint>) | null=} hasher
 * @property {((inputs: bigint[]) => string | bigint | Promise<string | bigint>) | null=} poseidon
 * @property {string=} kind
 * @property {string=} contextLabel
 * @property {string=} label
 * @property {string=} qId
 */

/**
 * @typedef {object} CryptoDecryptOptions
 * @property {unknown=} provider
 * @property {unknown=} providerLike
 * @property {unknown=} providerKind
 * @property {string=} account
 * @property {number | string | null=} chainId
 * @property {string=} surveyId
 * @property {Record<string, unknown>=} lit
 * @property {Record<string, unknown>=} litOpts
 * @property {boolean=} throwOnError
 */

/**
 * @typedef {object} InviteSignatureVerificationResult
 * @property {boolean} ok
 * @property {string=} signer
 * @property {boolean=} usedFallback
 * @property {string=} error
 */

/**
 * @typedef {object} CryptoUtilsTestApi
 * @property {(options: {
 *   jsonStr: string,
 *   account?: string,
 *   chainId?: number | string | null,
 *   providerLike?: unknown,
 *   litOpts?: Record<string, unknown>
 * }) => string} buildDecryptEnvelopeCacheKey
 */

/**
 * @typedef {object} CryptoUtilsApi
 * @property {(providerLike: unknown) => ('wagmi' | 'passkey-eoa' | 'web3auth')} getProviderKind
 * @property {(providerLike: unknown) => { request: (request: { method: string, params?: unknown[] }) => Promise<unknown> }} _getProvider
 * @property {(surveyState: CryptoAnswerSlice & Record<string, unknown>, optsOrPubKey?: CryptoEncryptOptions | string, extraOpts?: CryptoEncryptOptions) => Promise<CryptoAnswerSlice>} encryptMultipleAnswers
 * @property {(slice: CryptoAnswerSlice & Record<string, unknown>, questionPool?: Array<Record<string, unknown>>, accountOrOpts?: string | CryptoDecryptOptions, providerKind?: string, opts?: CryptoDecryptOptions) => Promise<CryptoAnswerSlice>} decryptMultipleAnswers
 * @property {(slice: CryptoAnswerSlice & Record<string, unknown>, qId: string, fieldToDecrypt: 'answer' | 'additional' | 'both', accountOrOpts?: string | CryptoDecryptOptions, providerKind?: string, opts?: CryptoDecryptOptions) => Promise<CryptoAnswerSlice>} decryptSingleField
 * @property {(input: { chainId?: number | string | null, account?: string, surveyId?: string, qId?: string }) => string} computeContext
 * @property {(qId: string, opts?: { questionPool?: Array<Record<string, unknown>> }) => { kind: 'freeform' | 'binary' | 'rating' | 'multichoice', options: string[] }} getQuestionKindMeta
 * @property {(field: Record<string, unknown>, ctx?: { qId?: string, kind?: string, chainId?: number | string | null, surveyId?: string, optionsForKind?: string[], hasher?: ((inputs: bigint[]) => string | bigint | Promise<string | bigint>) | null }) => Promise<void>} addTopLevelPoseidonIfRequired
 * @property {(identifier: unknown) => string} hashIdentifier
 * @property {(data: unknown, password: string) => Promise<string>} encryptWithPassword
 * @property {(encryptedData: string | { iv?: string, salt?: string, ciphertext?: string }, password: string) => Promise<unknown>} decryptWithPassword
 * @property {(value: unknown, opts?: CryptoEncryptOptions) => Promise<string>} encryptEnvelopeValue
 * @property {(envelopeJson: string | Record<string, unknown>, opts?: CryptoDecryptOptions) => Promise<unknown>} decryptEnvelopeValue
 * @property {(input: { password?: string, sbtAddress?: string }) => string} computeGroupPasswordHash
 * @property {(input: { password?: string, sbtAddress?: string, groupPasswordHash?: string }) => string | null} resolveGroupPasswordWalletScopeAddress
 * @property {(sbtAddress: string, userAddress: string) => string} computeGroupMintMessageHash
 * @property {(input: { password?: string, sbtAddress?: string, userAddress?: string, walletScopeSbtAddress?: string }) => Promise<string>} signGroupMintAuthorization
 * @property {(input: { sbtAddress?: string, nonce?: string | number }) => string} buildInviteMessageHash
 * @property {(input: { password?: string, sbtAddress?: string, nonce?: string | number, walletScopeSbtAddress?: string }) => Promise<string>} signInvite
 * @property {(payload: Record<string, unknown>) => string} encodeInvite
 * @property {(inviteCode: string) => ({ nonce: string, signature: string } | null)} decodeInvite
 * @property {() => string} generateInviteNonce
 * @property {(raw: unknown) => string} normalizeGroupPasswordInput
 * @property {(raw: unknown) => string} encodeGroupPasswordForUrl
 * @property {(input: { sbtAddress?: string, nonce?: string | number, signature?: string, groupPasswordHash?: string }) => InviteSignatureVerificationResult} verifyInviteSignature
 * @property {CryptoUtilsTestApi} __test
 */

const log = createLogger('crypto');
const logCryptoFallback = (e: unknown) => log.warn('crypto fallback:', e);

const requireBigInt = () => {
  if (typeof BigInt !== 'function') {
    throw new Error(
      'BigInt is required for commitments. Use a modern browser: Chrome ≥67, Edge ≥79, Firefox ≥68, Safari/iOS ≥14.',
    );
  }
};

/* ----------------------------- Byte helpers ------------------------------ */

const hexToBytes = (hex: Parameters<typeof utils.arrayify>[0]): Uint8Array => utils.arrayify(hex);
const bytesToHex = (bytes: Parameters<typeof utils.hexlify>[0]): string => utils.hexlify(bytes);
const concatBytes = (...arrs: Array<Uint8Array | null | undefined>): Uint8Array => {
  const total = arrs.reduce((n, a) => n + (a ? a.length : 0), 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    if (!a) continue;
    out.set(a, o);
    o += a.length;
  }
  return out;
};
const normalizeBufferInput = (bytes: ByteInput): Uint8Array | ArrayLike<number> => {
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return bytes;
};
const bufferFromBytes = (bytes: ByteInput) => Buffer.from(normalizeBufferInput(bytes));
const b64encode = (bytes: ByteInput) => bufferFromBytes(bytes).toString('base64');
const b64decode = (b64: unknown): Uint8Array => new Uint8Array(Buffer.from(String(b64 || ''), 'base64'));

const utf8e = (s: unknown): Uint8Array => new TextEncoder().encode(String(s));
const utf8d = (b: BufferSource): string => new TextDecoder().decode(b);

/* -------------------------- Crypto primitives ---------------------------- */

const sha256 = async (bytes: BufferSource): Promise<Uint8Array> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      return new Uint8Array(await subtle.digest('SHA-256', bytes));
    } catch (e) {
      logCryptoFallback(e);
      // Fall through to ethers implementation.
    }
  }
  try {
    const bytesLike =
      bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return utils.arrayify(utils.sha256(bytesLike));
  } catch (_) {
    throw new Error('SHA-256 is not available in this environment.');
  }
};

/* ------------------------- Invite + group helpers ------------------------ */

const base64UrlEncode = (bytesOrStr: string | ByteInput) => {
  const buf = typeof bytesOrStr === 'string' ? Buffer.from(bytesOrStr, 'utf8') : bufferFromBytes(bytesOrStr);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecode = (b64url: unknown) => {
  const s = String(b64url || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return Buffer.from(s + pad, 'base64');
};

const decodeBase64Field = (value: unknown, fieldName: string): Uint8Array => {
  if (typeof value !== 'string') {
    throw new Error(`Invalid encrypted ${fieldName} field format`);
  }
  return new Uint8Array(Buffer.from(value, 'base64'));
};

const buildGroupPasswordSalt = (sbtAddress: unknown) => {
  const rawAddress = typeof sbtAddress === 'string' ? sbtAddress : '';
  const addr = rawAddress && ethers.utils.isAddress(rawAddress) ? ethers.utils.getAddress(rawAddress) : '';
  return ethers.utils.solidityKeccak256(
    ['string', 'address'],
    ['sbt-group-password-v3', addr || ethers.constants.AddressZero],
  );
};

const deriveGroupPasswordWallet = ({ password, sbtAddress }: GroupPasswordInput) => {
  const pwHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(String(password || '')));
  const salt = buildGroupPasswordSalt(sbtAddress);
  const seed = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [pwHash, salt]);
  const tmpSk = ethers.utils.keccak256(ethers.utils.arrayify(seed));
  return new ethers.Wallet(tmpSk);
};

const computeGroupPasswordHash = ({ password, sbtAddress }: GroupPasswordInput) => {
  const tmpWallet = deriveGroupPasswordWallet({ password, sbtAddress });
  const tmpAddress = tmpWallet.address;
  return ethers.utils.solidityKeccak256(['address'], [tmpAddress]);
};

const resolveGroupPasswordWalletScopeAddress = ({ password, sbtAddress, groupPasswordHash }: GroupPasswordInput) => {
  const expectedHash = String(groupPasswordHash || '')
    .trim()
    .toLowerCase();
  if (!expectedHash || expectedHash === ethers.constants.HashZero.toLowerCase()) {
    return null;
  }

  const normalizedSbtAddress =
    typeof sbtAddress === 'string' && ethers.utils.isAddress(sbtAddress) ? ethers.utils.getAddress(sbtAddress) : '';
  if (normalizedSbtAddress) {
    const scopedHash = computeGroupPasswordHash({ password, sbtAddress: normalizedSbtAddress });
    if (scopedHash.toLowerCase() === expectedHash) {
      return normalizedSbtAddress;
    }
  }

  const zeroScopedHash = computeGroupPasswordHash({ password, sbtAddress: '' });
  if (zeroScopedHash.toLowerCase() === expectedHash) {
    return '';
  }

  return null;
};

const computeGroupMintMessageHash = (sbtAddress: string, userAddress: string) => {
  if (!ethers.utils.isAddress(sbtAddress) || !ethers.utils.isAddress(userAddress)) {
    throw new Error('Invalid address passed to computeGroupMintMessageHash');
  }
  return ethers.utils.solidityKeccak256(['address', 'address'], [sbtAddress, userAddress]);
};

const signGroupMintAuthorization = async ({
  password,
  sbtAddress,
  userAddress,
  walletScopeSbtAddress = sbtAddress,
}: GroupMintAuthorizationInput) => {
  const tmpWallet = deriveGroupPasswordWallet({ password, sbtAddress: walletScopeSbtAddress });
  const messageHash = computeGroupMintMessageHash(String(sbtAddress || ''), String(userAddress || ''));
  const signature = await tmpWallet.signMessage(ethers.utils.arrayify(messageHash));
  try {
    return ethers.utils.joinSignature(ethers.utils.splitSignature(signature));
  } catch (e) {
    logCryptoFallback(e);
    return signature;
  }
};

const buildInviteMessageHash = ({ sbtAddress, nonce }: InviteInput) => {
  const normalizedSbtAddress = String(sbtAddress || '');
  if (!ethers.utils.isAddress(normalizedSbtAddress)) {
    throw new Error('Invalid sbtAddress passed to buildInviteMessageHash');
  }
  return ethers.utils.solidityKeccak256(['address', 'uint256'], [normalizedSbtAddress, nonce]);
};

const signInvite = async ({ password, sbtAddress, nonce, walletScopeSbtAddress = sbtAddress }: InviteInput) => {
  const tmpWallet = deriveGroupPasswordWallet({ password, sbtAddress: walletScopeSbtAddress });
  const messageHash = buildInviteMessageHash({ sbtAddress, nonce });
  const signature = await tmpWallet.signMessage(ethers.utils.arrayify(messageHash));
  try {
    return ethers.utils.joinSignature(ethers.utils.splitSignature(signature));
  } catch (e) {
    logCryptoFallback(e);
    return signature;
  }
};

const encodeInvite = (payload: UnknownRecord) => {
  const json = JSON.stringify(payload || {});
  return base64UrlEncode(json);
};

const decodeInvite = (inviteCode: unknown) => {
  try {
    const raw = base64UrlDecode(inviteCode);
    const text = raw.toString('utf8');
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;
    const parsedRecord = isRecord(parsed) ? parsed : {};
    const nonce = parsedRecord.n;
    const signature = parsedRecord.s;
    if (nonce === undefined || nonce === null) return null;
    if (!signature || typeof signature !== 'string') return null;
    if (parsedRecord.c !== undefined && parsedRecord.c !== null) return null; // legacy chain-bound invites are not supported
    return {
      nonce: typeof nonce === 'string' ? nonce : String(nonce),
      signature,
    };
  } catch (e) {
    logCryptoFallback(e);
    return null;
  }
};

const generateInviteNonce = () => {
  let bytes;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
  } else {
    bytes = ethers.utils.randomBytes(12);
  }
  const hex = ethers.utils.hexlify(bytes);
  return ethers.BigNumber.from(hex).toString();
};

const normalizeGroupPasswordInput = (raw: unknown) => {
  const trimmed = String(raw || '').trim();
  const compact = trimmed.replace(/\s+/g, '');
  if (!compact) return '';
  if (ethers.utils.isHexString(compact)) {
    try {
      return ethers.utils.toUtf8String(compact);
    } catch (e) {
      logCryptoFallback(e);
      return compact;
    }
  }
  return compact;
};

const encodeGroupPasswordForUrl = (raw: unknown) => {
  const trimmed = String(raw || '').trim();
  const compact = trimmed.replace(/\s+/g, '');
  if (!compact) return '';
  try {
    return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(compact));
  } catch (_) {
    return '';
  }
};

const verifyInviteSignature = ({
  sbtAddress,
  nonce,
  signature,
  groupPasswordHash,
}: InviteInput): InviteSignatureVerificationResult => {
  try {
    if (!ethers.utils.isAddress(String(sbtAddress || ''))) {
      return { ok: false, error: 'Invalid SBT address.' };
    }
    if (!signature || typeof signature !== 'string') {
      return { ok: false, error: 'Missing invite signature.' };
    }
    if (!groupPasswordHash || groupPasswordHash === ethers.constants.HashZero) {
      return { ok: false, error: 'Missing group password hash.' };
    }

    const expectedHash = String(groupPasswordHash).toLowerCase();
    const matchesHash = (addr: string) => {
      const derived = ethers.utils.solidityKeccak256(['address'], [addr]);
      return derived.toLowerCase() === expectedHash;
    };

    const messageHashNoChain = buildInviteMessageHash({ sbtAddress, nonce });
    const signerNoChain = ethers.utils.verifyMessage(ethers.utils.arrayify(messageHashNoChain), signature);
    if (matchesHash(signerNoChain)) {
      return { ok: true, signer: signerNoChain, usedFallback: true };
    }

    return { ok: false, error: 'Invite signature does not match this group.' };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err, 'Invite signature verification failed.') };
  }
};

/**
 * AES-GCM with AAD (additional authenticated data).
 */
const aesGcmEncrypt = async (key: CryptoKey, plaintextBytes: BufferSource, { aadBytes }: AesGcmOptions = {}) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, ...(aadBytes ? { additionalData: aadBytes } : {}) },
    key,
    plaintextBytes,
  );
  return { iv, ciphertext: new Uint8Array(ciphertext) };
};

const aesGcmDecrypt = async (
  key: CryptoKey,
  iv: BufferSource,
  ciphertextBytes: BufferSource,
  { aadBytes }: AesGcmOptions = {},
) => {
  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, ...(aadBytes ? { additionalData: aadBytes } : {}) },
    key,
    ciphertextBytes,
  );
  return new Uint8Array(plaintext);
};

/* ------------------------ EIP-1193 / provider utils ---------------------- */

const safeLower = (x: unknown) => (typeof x === 'string' ? x.toLowerCase() : x);

/**
 * Determine provider kind by heuristics ('wagmi' | 'passkey-eoa' | 'web3auth').
 * Keep the Web3Auth branch for easy re-enable; it is no-op without a provider.
 */
const getProviderKind = (providerLike: ProviderLike): ProviderKind => {
  try {
    if (typeof providerLike === 'string') {
      const s = providerLike.trim().toLowerCase();
      if (s === 'passkey_eoa' || s === 'passkey-eoa') return 'passkey-eoa';
      if (s === 'web3auth') return 'web3auth';
      return 'wagmi';
    }
    const providerRecord = isRecord(providerLike) ? providerLike : null;
    const p = ((providerRecord && providerRecord.provider) ||
      providerLike ||
      (typeof window !== 'undefined' ? window.ethereum : null)) as
      (UnknownRecord & { provider?: UnknownRecord }) | null;

    // Check for the embedded passkey provider first (must come before other checks).
    if (p && p.isPasskeyEoa === true) {
      return 'passkey-eoa';
    }

    // Keep Web3Auth detection; it is cheap and enables quick re-enable.
    if (
      p &&
      (p.isWeb3Auth === true ||
        p._isWeb3Auth === true ||
        (isRecord(p.session) && (p.session.userInfo || p.session.sessionToken)) ||
        (isRecord(p.provider) && p.provider.isWeb3Auth === true) ||
        String(p?.constructor?.name || '')
          .toLowerCase()
          .includes('web3auth'))
    ) {
      return 'web3auth';
    }
  } catch (e) {
    logCryptoFallback(e);
  }
  return 'wagmi';
};

/**
 * Normalize to an EIP-1193 provider (best effort).
 */
const _getProvider = (providerLike: ProviderLike): Eip1193Provider => {
  const providerRecord = isRecord(providerLike) ? providerLike : null;
  const candidate = ((providerRecord && providerRecord.provider) || providerLike) as
    (UnknownRecord & { provider?: unknown; request?: Eip1193Provider['request']; isPasskeyEoa?: boolean }) | null;

  // Check for embedded passkey provider first.
  if (candidate && candidate.isPasskeyEoa === true && typeof candidate.request === 'function') {
    return candidate as Eip1193Provider;
  }

  if (candidate && typeof candidate.request === 'function') return candidate as Eip1193Provider;
  if (candidate && isRecord(candidate.provider) && typeof candidate.provider.request === 'function') {
    return candidate.provider as Eip1193Provider;
  }

  if (typeof providerLike === 'string') {
    const s = providerLike.trim().toLowerCase();

    // Handle embedded passkey provider strings. Prefer the seeded window global
    // when a signing client is already warm, but synthesize the lazy provider on
    // demand so post-login auth flows can still trigger a passkey assertion only
    // when signing.
    if (s === 'passkey_eoa' || s === 'passkey-eoa') {
      if (typeof window !== 'undefined' && window.__passkeyEoaProvider && window.__passkeyEoaProvider.isPasskeyEoa) {
        return window.__passkeyEoaProvider;
      }
      try {
        const globalBuildPasskeyProvider =
          typeof window !== 'undefined' && typeof window.__ceCreatePasskeyEip1193Provider === 'function'
            ? window.__ceCreatePasskeyEip1193Provider
            : null;
        if (globalBuildPasskeyProvider) {
          const passkeyProvider = globalBuildPasskeyProvider();
          if (
            passkeyProvider &&
            passkeyProvider.isPasskeyEoa === true &&
            typeof passkeyProvider.request === 'function'
          ) {
            if (typeof window !== 'undefined') {
              window.__passkeyEoaProvider = passkeyProvider;
            }
            return passkeyProvider;
          }
        }
        // Avoid a hard module cycle at load time.

        const walletModule = require('../../wallet/passkeyWallet.js');
        const buildPasskeyProvider =
          walletModule?.createPasskeyEip1193Provider || walletModule?.default?.createPasskeyEip1193Provider;
        const passkeyProvider = typeof buildPasskeyProvider === 'function' ? buildPasskeyProvider() : null;
        if (passkeyProvider && passkeyProvider.isPasskeyEoa === true && typeof passkeyProvider.request === 'function') {
          if (typeof window !== 'undefined') {
            window.__passkeyEoaProvider = passkeyProvider;
          }
          return passkeyProvider;
        }
      } catch (e) {
        logCryptoFallback(e);
      }
      throw new Error('Passkey wallet provider not initialized. Please unlock your wallet first.');
    }

    // Keep Web3Auth path for easy re-enable; no overhead without provider.
    if (typeof window !== 'undefined' && s === 'web3auth' && window.web3authProvider) {
      return window.web3authProvider;
    }
  }
  if (typeof window !== 'undefined') {
    if (window.ethereum && typeof window.ethereum.request === 'function') {
      return window.ethereum as Eip1193Provider;
    }
    if (window.web3authProvider) return window.web3authProvider;
  }

  return {
    request: async () => {
      throw new Error('No EIP-1193 provider available.');
    },
  };
};

/* --------------------------- EIP-712 helpers ----------------------------- */

const buildEip712KeyWrap = (
  account: string,
  chainId: ChainIdInput,
  contextHex: string,
  nonce: string | number | null = null,
) => {
  const checksummedAccount = utils.getAddress(account);
  const keyDerivationTypes: Array<{ name: string; type: string }> = [
    { name: 'app', type: 'string' },
    { name: 'purpose', type: 'string' },
    { name: 'account', type: 'address' },
    { name: 'context', type: 'bytes32' },
  ];
  const message: UnknownRecord & {
    app: string;
    purpose: string;
    account: string;
    context: string;
    nonce?: string;
  } = {
    app: 'SurveyTool',
    purpose: 'SURVEY_CEK_WRAP_V1',
    account: checksummedAccount,
    context: contextHex,
  };

  if (nonce !== null && nonce !== undefined) {
    keyDerivationTypes.push({ name: 'nonce', type: 'uint256' });
    message.nonce = String(nonce);
  }

  return {
    domain: {
      name: 'ContextEngineEncKey',
      version: '1',
      chainId: Number(chainId),
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    types: {
      KeyDerivation: keyDerivationTypes,
    },
    primaryType: 'KeyDerivation',
    message,
  };
};

/* --------------------------- EIP-712 helpers ----------------------------- */
/**
 * Normalize provider/account/chainId for EIP-712.
 * - If account is missing, tries eth_accounts then eth_requestAccounts.
 * - Ensures a checksummed 0x… address and numeric chainId.
 */
const _resolveFromAndChainId = async (
  providerLike: ProviderLike,
  opts: { account?: unknown; chainId?: ChainIdInput } = {},
) => {
  const p = _getProvider(providerLike);

  const isValidHexAddr = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-fA-F]{40}$/.test(s);
  const toChecksum = (addr: string) => {
    try {
      return utils.getAddress(addr);
    } catch (_) {
      return addr;
    }
  };
  const normalizeChain = (id: unknown): number | null => {
    if (typeof id === 'number' && Number.isFinite(id)) return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') {
      const t = id.trim();
      if (/^0x/i.test(t)) return parseInt(t, 16);
      const n = Number(t);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  // Resolve "from"
  let from = String(opts.account || '').trim();
  if (!isValidHexAddr(from)) {
    try {
      const accs = await p.request({ method: 'eth_accounts' });
      if (Array.isArray(accs) && accs.length > 0 && isValidHexAddr(accs[0])) {
        from = accs[0];
      }
    } catch (e) {
      logCryptoFallback(e);
    }
  }
  if (!isValidHexAddr(from)) {
    // Explicit user gesture (Decrypt) → allowed to prompt
    const req = await p.request({ method: 'eth_requestAccounts' });
    if (!Array.isArray(req) || req.length === 0 || !isValidHexAddr(req[0])) {
      throw new Error('Could not obtain an account from wallet (eth_requestAccounts failed).');
    }
    from = req[0];
  }
  from = toChecksum(from);

  // Resolve chainId
  let chainIdNum = normalizeChain(opts.chainId);
  if (chainIdNum === null) {
    const raw = await p.request({ method: 'eth_chainId' });
    chainIdNum = normalizeChain(raw);
  }
  if (chainIdNum === null) {
    throw new Error('Unable to determine chainId (eth_chainId failed).');
  }

  return { from, chainId: chainIdNum, provider: p };
};

/**
 * Hardened EIP-712 v4 signer.
 * Call shapes supported:
 *   1) signEip712V4(provider, typedData, opts?)
 *   2) signEip712V4(provider, fromAddress, typedData, opts?)
 */
const signEip712V4 = async (providerLike: ProviderLike, a: unknown, b?: unknown, c?: unknown): Promise<string> => {
  let suppliedFrom: string | null = null;
  let typedData: unknown = null;
  let opts: CryptoDecryptOptions = {};

  if (typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a) && b && typeof b === 'object') {
    // (provider, from, typedData, opts?)
    suppliedFrom = a;
    typedData = b;
    opts = isRecord(c) ? (c as CryptoDecryptOptions) : {};
  } else {
    // (provider, typedData, opts?)
    typedData = a;
    opts = isRecord(b) ? (b as CryptoDecryptOptions) : {};
  }

  const { from, chainId, provider } = await _resolveFromAndChainId(providerLike, {
    account: suppliedFrom || opts.account,
    chainId: opts.chainId,
  });

  // Ensure domain.chainId is numeric (MetaMask requires number here)
  let td = typedData;
  if (typeof td === 'string') {
    try {
      td = JSON.parse(td);
    } catch {
      /* leave as string */
    }
  }
  if (td && typeof td === 'object') {
    const tdRecord = td as UnknownRecord & { domain?: UnknownRecord };
    tdRecord.domain = isRecord(tdRecord.domain) ? tdRecord.domain : {};
    const valid = typeof tdRecord.domain.chainId === 'number' && Number.isFinite(tdRecord.domain.chainId);
    if (!valid) tdRecord.domain.chainId = chainId;
  }
  const payload = typeof td === 'string' ? td : JSON.stringify(td);

  try {
    const signature = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [from, payload],
    });
    return String(signature);
  } catch (e) {
    const msg = toErrorMessage(e);
    if (/must provide an Ethereum address/i.test(msg) || /Invalid input/i.test(msg)) {
      throw new Error(`Wallet rejected EIP-712 request (from/address normalization): ${msg}`);
    }
    throw e;
  }
};

/* -------------------------- Context & AAD -------------------------------- */

/**
 * Compute a deterministic 32-byte context hash for AAD + HKDF info.
 * Includes chainId, account (author), surveyId, qId, and response field slot.
 */
const computeContext = ({ chainId, account, surveyId, qId, fieldKey }: SurveyContextInput) => {
  const cid = chainId === 0 || chainId ? String(chainId) : '';
  const acct = safeLower(account || '');
  const sid = safeLower(surveyId || utils.hexZeroPad('0x0', 32));
  const q = safeLower(qId || '');
  const field = safeLower(fieldKey || '');
  return utils.keccak256(utf8e(`rxc|v1|chain:${cid}|acct:${acct}|survey:${sid}|qid:${q}|field:${field}`));
};

const buildAAD = ({ contextHex, chainId, surveyId, qId, fieldKey }: SurveyContextInput & { contextHex: string }) => ({
  context: contextHex,
  chainId: chainId ?? null,
  surveyId: surveyId ?? null,
  qId: qId ?? null,
  fieldKey: fieldKey ?? null,
});

/* ---------------------- Canonical encoders (commit) ---------------------- */

/**
 * Normalize an arbitrary identifier to a bytes32.
 * - Already 32-byte hex → lowercased passthrough.
 * - Nullish/empty → 0x00…00 (bytes32 zero).
 * - Otherwise → keccak256(toUtf8Bytes(identifier)) via utils.id.
 */
const hashIdentifier = (identifier: unknown) => {
  const s = identifier === null || identifier === undefined ? '' : String(identifier);

  // Accept exact 32-byte hex inputs as-is (normalized to lowercase)
  try {
    if (utils.isHexString(s, 32)) {
      return s.toLowerCase();
    }
  } catch (_) {
    /* fall through to hashing */
  }

  // Empty/null → bytes32 zero
  if (s.trim() === '') {
    return utils.hexZeroPad('0x0', 32);
  }

  // Default: hash string to bytes32
  return utils.id(s);
};

/**
 * Resolve question kind/meta from opts.questionPool.
 */
const getQuestionKindMeta = (qId: unknown, opts: { questionPool?: QuestionLike[] } = {}): QuestionKindMeta => {
  const pool = Array.isArray(opts.questionPool) ? opts.questionPool : [];
  const q = pool.find((it) => it && safeLower(it.id) === safeLower(qId)) || null;
  if (!q) return { kind: 'freeform', options: [] };
  const t = String(q.type || 'freeform').toLowerCase();
  if (t === 'binary') return { kind: 'binary', options: ['Disagree', 'Unsure', 'Agree'] };
  if (t === 'rating') return { kind: 'rating', options: [] };
  if (t === 'multichoice') return { kind: 'multichoice', options: Array.isArray(q.options) ? q.options : [] };
  return { kind: 'freeform', options: [] };
};

const encodeFreeform = (value: unknown) => utf8e(value == null ? '' : String(value));

const encodeBinary = (value: unknown) => {
  const map: Record<string, number> = { Disagree: 0, Unsure: 1, Agree: 2 };
  const raw = String(value);
  const v = map[raw] ?? map[raw.charAt(0).toUpperCase() + raw.slice(1)] ?? 1;
  return new Uint8Array([v & 0xff]);
};

const encodeRating = (value: unknown) => {
  let n = Number(value);
  if (!Number.isFinite(n)) n = 0;
  if (n < 0) n = 0;
  if (n > 10) n = 10;
  return new Uint8Array([n & 0xff]);
};

const encodeMultichoiceBitset = (valueArr: unknown, options: unknown[]) => {
  const opts = Array.isArray(options) ? options : [];
  const chosen = new Set(Array.isArray(valueArr) ? valueArr.map(String) : []);
  const bitLen = Math.max(opts.length, 1);
  const byteLen = Math.ceil(bitLen / 8);
  const bytes = new Uint8Array(byteLen);
  for (let i = 0; i < opts.length; i++) {
    if (chosen.has(String(opts[i]))) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      bytes[byteIdx] |= 1 << bitIdx;
    }
  }
  return bytes;
};

const encodeValueBytes = (kind: unknown, value: unknown, { options = [] }: { options?: unknown[] } = {}) => {
  switch (kind) {
    case 'binary':
      return encodeBinary(value);
    case 'rating':
      return encodeRating(value);
    case 'multichoice':
      return encodeMultichoiceBitset(value, options);
    case 'freeform':
    default:
      return encodeFreeform(value);
  }
};

/* ------------------------ Commitments (Keccak, Poseidon) ----------------------- */

/**
 * Poseidon support notes:
 * - If a real Poseidon is available (e.g., window.poseidon from circomlibjs), we use it.
 * - Otherwise the caller must provide a hasher, or Poseidon commitments are unavailable.
 */
const BN254_P = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

const toField = (bytes: Uint8Array) => {
  // Reduce bytes mod p to a field element.
  let x = 0n;
  for (let i = 0; i < bytes.length; i++) {
    x = (x * 256n + BigInt(bytes[i])) % BN254_P;
  }
  return x;
};

const bigIntToHex32 = (x: bigint) => {
  let h = x.toString(16);
  if (h.length % 2) h = '0' + h;
  if (h.length < 64) h = h.padStart(64, '0');
  return '0x' + h;
};

const normalizePoseidonHashOutput = (out: PoseidonHashValue) => bigIntToHex32(BigInt(out) % BN254_P);

const poseidonHashBytes = (
  parts: Uint8Array[],
  customHasher: PoseidonHasher | null = null,
): string | Promise<string> => {
  requireBigInt();
  const inputs = parts.map((b) => toField(b));

  // 1. Dependency Injection (Highest Priority)
  // Allows caller to provide a ZK-compatible implementation (e.g. poseidon-lite)
  if (customHasher && typeof customHasher === 'function') {
    try {
      const out = customHasher(inputs);
      if (isPromiseLike<PoseidonHashValue>(out)) {
        return out.then((value) => normalizePoseidonHashOutput(value));
      }
      return normalizePoseidonHashOutput(out);
    } catch (e) {
      logCryptoFallback(e);
      // Fall through if custom hasher fails
    }
  }

  try {
    const poseidon =
      (typeof window !== 'undefined' && (window.poseidon || window.poseidon1 || window.Poseidon)) || null;
    if (poseidon && typeof poseidon === 'function') {
      const out = poseidon(inputs); // expected BigInt
      if (isPromiseLike<PoseidonHashValue>(out)) {
        return out.then((value) => normalizePoseidonHashOutput(value));
      }
      return normalizePoseidonHashOutput(out);
    }
  } catch (e) {
    logCryptoFallback(e);
    // fall through to required-hasher error
  }
  throw new Error('Poseidon hasher required but not available');
};

/**
 * Attach top-level `poseidon` to a field ONLY when non-empty.
 *
 * Rules:
 * - Encrypted + masked: value === '*' AND encryptedPortion present
 *     • Read `commitments.poseidon` from CEK envelope (salted) and set as top-level `poseidon`.
 *     • If envelope missing/malformed, do NOT fabricate — skip.
 * - Unencrypted:
 *     • When non-empty (per kind), compute UNSALTED Poseidon over:
 *          poseidonHashBytes([ encodeValueBytes(kind,value,{options}), buildCommitDomainBytes({chainId,surveyId,qId}) ])
 *     • If empty, omit top-level `poseidon`.
 *
 * @param {object} field - { value, encrypted?: boolean, encryptedPortion?: string|object, ... }
 * @param {object} ctx   - { qId, kind: 'freeform'|'binary'|'rating'|'multichoice', chainId, surveyId, optionsForKind?: string[] }
 */
async function addTopLevelPoseidonIfRequired(
  field: CryptoFieldEntry | null | undefined,
  ctx: SurveyContextInput & {
    kind?: unknown;
    optionsForKind?: unknown[];
    hasher?: PoseidonHasher | null;
  } = {},
) {
  try {
    if (!field || typeof field !== 'object') return;

    // Always start from a clean slate: omit poseidon unless we positively add it below.
    if (Object.prototype.hasOwnProperty.call(field, 'poseidon')) {
      try {
        delete field.poseidon;
      } catch (_) {}
    }

    const { qId, kind: rawKind, chainId, surveyId, optionsForKind, hasher } = ctx;
    const kind = String(rawKind || 'freeform').toLowerCase();
    const v = field.value;

    /* ---------- Encrypted masked case: copy salted commitment from envelope ---------- */
    const hasMaskedEncrypted = v === '*' && !!field.encryptedPortion; // treat '*' + envelope as non-empty (even if encrypted=true/false flags vary)

    if (hasMaskedEncrypted) {
      let env: UnknownRecord | null = null;
      try {
        env = typeof field.encryptedPortion === 'string' ? JSON.parse(field.encryptedPortion) : field.encryptedPortion;
      } catch (e) {
        logCryptoFallback(e);
        env = null;
      }
      const commitments = isRecord(env?.commitments) ? env.commitments : null;
      const pHex = commitments?.poseidon;
      if (typeof pHex === 'string' && /^0x[0-9a-fA-F]+$/.test(pHex)) {
        field.poseidon = pHex; // salted from CEK plaintext commitments
      }
      // If malformed or missing, we intentionally do NOT fabricate; just return.
      return;
    }

    /* ----------------------------- Unencrypted non-empty check ----------------------------- */
    let nonEmpty = false;
    if (kind === 'freeform') {
      nonEmpty = typeof v === 'string' && v.trim().length > 0;
    } else if (kind === 'binary') {
      nonEmpty = v === 'Agree' || v === 'Unsure' || v === 'Disagree';
    } else if (kind === 'rating') {
      const hasRatingValue = typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined;
      const n = hasRatingValue ? Number(v) : NaN;
      nonEmpty = Number.isFinite(n);
    } else if (kind === 'multichoice') {
      nonEmpty = Array.isArray(v) && v.length > 0;
    } else {
      // Fallback: be conservative — only obvious non-empties
      nonEmpty = typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : v != null;
    }

    if (!nonEmpty) return; // empty → omit top-level poseidon

    // Required canonicalization + domain sep helpers (already present in this module per context)
    if (
      typeof encodeValueBytes !== 'function' ||
      typeof buildCommitDomainBytes !== 'function' ||
      typeof poseidonHashBytes !== 'function'
    ) {
      // Missing primitives — do not block submission; just skip surfacing.
      return;
    }

    // Canonical bytes + domain sep (unsalted Poseidon for plaintext)
    const canonical = encodeValueBytes(kind, v, { options: Array.isArray(optionsForKind) ? optionsForKind : [] });
    const domain = buildCommitDomainBytes({ chainId, surveyId, qId });

    // poseidonHashBytes may be sync or async in some builds — support both.
    const out = poseidonHashBytes([canonical, domain], hasher);
    if (isPromiseLike<string>(out)) {
      const hex = await out;
      if (typeof hex === 'string') field.poseidon = hex;
    } else if (typeof out === 'string') {
      field.poseidon = out;
    }
  } catch (e) {
    logCryptoFallback(e);
    // Best-effort only; never throw from serialization path.
  }
}

/**
 * Build domain separation bytes for commitments.
 * Spec: include protocol/version & IDs.
 */
const buildCommitDomainBytes = ({ chainId, surveyId, qId }: SurveyContextInput) => {
  const sid = safeLower(surveyId || utils.hexZeroPad('0x0', 32));
  const ds = `rxc|commit|v1|chain:${String(chainId ?? '')}|survey:${sid}|qid:${safeLower(qId || '')}`;
  return utf8e(ds);
};

/**
 * Compute salted commitments for a single field (kind-aware canonicalization).
 * Returns: { keccakHex, poseidonHex, saltBytes, saltHex, canonicalBytes }
 */
const computeSaltedCommitments = async ({
  chainId,
  surveyId,
  qId,
  kind,
  value,
  optionsForKind = [],
  hasher = null,
}: SurveyContextInput & {
  kind: unknown;
  value: unknown;
  optionsForKind?: unknown[];
  hasher?: PoseidonHasher | null;
}): Promise<Commitments> => {
  // Random 128-bit salt per field
  const saltBytes = new Uint8Array(16);
  window.crypto.getRandomValues(saltBytes);
  const saltHex = bytesToHex(saltBytes);

  const domainBytes = buildCommitDomainBytes({ chainId, surveyId, qId });
  const canonicalBytes = encodeValueBytes(kind, value, { options: optionsForKind });

  // keccak256(salt || valueBytes || domain)
  const keccakHex = utils.keccak256(concatBytes(saltBytes, canonicalBytes, domainBytes));

  // poseidon(salt || valueBytes || domain)
  let poseidonHex = null;
  try {
    poseidonHex = await poseidonHashBytes([saltBytes, canonicalBytes, domainBytes], hasher);
  } catch (e) {
    log.warn('Poseidon commitment unavailable, omitting:', toErrorMessage(e) || e);
  }

  return { keccakHex, poseidonHex, saltBytes, saltHex, canonicalBytes };
};

/* -------------------------- v1 envelope utilities ------------------------- */

function assertBytes32Hex(hex: unknown): asserts hex is string {
  if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('context must be 32-byte hex (0x + 64 hex chars)');
  }
}

const isObj = (x: unknown): x is UnknownRecord => isRecord(x);

const stableStringify = (obj: unknown) => {
  // Deterministic stringify for AAD
  return JSON.stringify(obj);
};

const importAesGcmKey = (raw32: BufferSource) =>
  window.crypto.subtle.importKey('raw', raw32, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

const getContextBytes = (contextHex: string) => hexToBytes(contextHex);

/**
 * HKDF KEK derivation for wrapping (EIP-712 signature → HKDF).
 * IKM := SHA-256(signature)
 * salt := 'surveytool:v1'
 * info := contextBytes (32 bytes)
 */
const deriveKekFromSig = async (signatureHex: string, contextBytes: BufferSource) => {
  const sigBytes = hexToBytes(signatureHex);
  const ikm = await sha256(sigBytes);
  const hkdfKey = await window.crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  const kek = await window.crypto.subtle.deriveKey(
    { name: 'HKDF', salt: utf8e('surveytool:v1'), info: contextBytes, hash: 'SHA-256' },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return kek;
};

const wrapCekWithSelfRecipient = async ({
  providerLike,
  account,
  chainId,
  contextHex,
  cekRaw,
}: {
  providerLike: ProviderLike;
  account?: string;
  chainId: ChainIdInput;
  contextHex: string;
  cekRaw: Uint8Array;
}) => {
  assertBytes32Hex(contextHex);
  const provider = _getProvider(providerLike);
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('No EIP-1193 provider available for self recipient.');
  }
  if (!account) throw new Error('Missing account for self recipient.');
  if (chainId === undefined || chainId === null) throw new Error('Missing chainId for self recipient.');

  const nonceBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const nonce = BigInt(bytesToHex(nonceBytes)).toString();
  const typed = buildEip712KeyWrap(account, chainId, contextHex, nonce);
  const sig = await signEip712V4(provider, account, typed);

  const contextBytes = getContextBytes(contextHex);
  const kek = await deriveKekFromSig(sig, contextBytes);

  // AES-GCM wrap (with its own IV), bind context as AAD
  const wrap_iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipher = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: wrap_iv, additionalData: contextBytes },
    kek,
    cekRaw,
  );
  return {
    type: 'self-eip712-v1',
    context: contextHex,
    wrap_iv: b64encode(wrap_iv),
    wrapped_cek: b64encode(new Uint8Array(cipher)),
    nonce,
  };
};

const maybeAddOneLitRecipient = async (
  cekRaw: Uint8Array,
  litOpts?: LitOptions | null,
): Promise<{ type: 'lit-sbt-v1'; lit: UnknownRecord } | null> => {
  if (!isObj(litOpts) || typeof litOpts.saveKey !== 'function') return null;
  const saveKey = litOpts.saveKey as (key: Uint8Array, opts?: UnknownRecord) => Promise<unknown> | unknown;
  if (typeof console !== 'undefined') {
    const conds = Array.isArray(litOpts.accessControlConditions) ? litOpts.accessControlConditions.length : 0;
    log.info('[lit][recipient] saveKey start', {
      litNetwork: litOpts.litNetwork || null,
      chain: litOpts.chain || null,
      hasConditions: !!litOpts.accessControlConditions,
      conditionCount: conds,
      hasResourceId: !!litOpts.resourceId,
    });
  }
  let result: LitSaveKeyResult | null = null;
  try {
    const rawResult = await saveKey(cekRaw, {
      accessControlConditions: litOpts.accessControlConditions,
      chain: litOpts.chain,
      resourceId: litOpts.resourceId,
      litNetwork: litOpts.litNetwork,
      connectTimeout: litOpts.connectTimeout,
      providerLike: litOpts.providerLike,
      resourceAbilityRequests: litOpts.resourceAbilityRequests,
    });
    result = isRecord(rawResult) ? (rawResult as LitSaveKeyResult) : {};
  } catch (err) {
    if (typeof console !== 'undefined') {
      log.error('[lit][recipient] saveKey failed', {
        litNetwork: litOpts.litNetwork || null,
        chain: litOpts.chain || null,
        message: toErrorMessage(err) || err,
      });
    }
    throw err;
  }
  if (typeof console !== 'undefined') {
    log.info('[lit][recipient] saveKey ok', {
      litNetwork: litOpts.litNetwork || null,
      chain: litOpts.chain || null,
      mode: result?.encryptedSymmetricKey ? 'encryptedSymmetricKey' : result?.ciphertext ? 'ciphertext' : 'unknown',
    });
  }

  const litPayload = {
    ...(litOpts.accessControlConditions ? { accessControlConditions: litOpts.accessControlConditions } : {}),
    ...(litOpts.chain ? { chain: litOpts.chain } : {}),
    ...(litOpts.resourceId ? { resourceId: litOpts.resourceId } : {}),
    ...(result?.chipotle ? { chipotle: result.chipotle } : {}),
  };

  if (result?.ciphertext && result?.dataToEncryptHash) {
    return {
      type: 'lit-sbt-v1' as const,
      lit: {
        ...litPayload,
        ciphertext: result.ciphertext,
        dataToEncryptHash: result.dataToEncryptHash,
      },
    };
  }

  if (result?.encryptedSymmetricKey) {
    const eskB64 =
      typeof result.encryptedSymmetricKey === 'string'
        ? result.encryptedSymmetricKey
        : b64encode(toUint8Array(result.encryptedSymmetricKey));
    return {
      type: 'lit-sbt-v1' as const,
      lit: {
        ...litPayload,
        encryptedSymmetricKey: eskB64,
      },
    };
  }

  return null;
};

const maybeAddLitRecipients = async (cekRaw: Uint8Array, litOpts?: LitOptions | null) => {
  if (!isObj(litOpts)) return [];

  const configuredRecipients = Array.isArray(litOpts.recipients) ? litOpts.recipients.filter(Boolean) : [];

  const recipientSpecs = configuredRecipients.length ? configuredRecipients : [litOpts];

  const out: Array<{ type: 'lit-sbt-v1'; lit: UnknownRecord }> = [];
  const dedupe = new Set();

  for (const entry of recipientSpecs) {
    const merged = {
      ...litOpts,
      ...(isObj(entry) ? entry : {}),
    };
    delete merged.recipients;

    const recipient = await maybeAddOneLitRecipient(cekRaw, merged);
    if (!recipient || !recipient.lit) continue;
    const dedupeKey = JSON.stringify({
      accessControlConditions: recipient.lit.accessControlConditions || null,
      chain: recipient.lit.chain || null,
      ciphertext: recipient.lit.ciphertext || null,
      dataToEncryptHash: recipient.lit.dataToEncryptHash || null,
      encryptedSymmetricKey: recipient.lit.encryptedSymmetricKey || null,
      resourceId: recipient.lit.resourceId || null,
    });
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);
    out.push(recipient);
  }

  return out;
};

const buildEnvelope = ({
  iv,
  ciphertextBytes,
  aadObj,
  recipients,
  commitments,
  kind,
}: {
  iv: Uint8Array;
  ciphertextBytes: Uint8Array;
  aadObj: UnknownRecord;
  recipients: EnvelopeRecipient[];
  commitments: Commitments;
  kind: unknown;
}): Envelope => ({
  v: 1,
  cipher: 'aes-gcm-256',
  iv: b64encode(iv),
  aad: aadObj,
  ciphertext: b64encode(ciphertextBytes),
  recipients,
  commitments: {
    keccak256: commitments.keccakHex,
    ...(commitments.poseidonHex ? { poseidon: commitments.poseidonHex } : {}),
  },
  meta: { kind },
});

/**
 * Validate envelope shape and return parsed object.
 * Throws descriptive errors on malformed cases.
 */
const parseEnvelope = (jsonStr: string): Envelope => {
  let env: unknown = null;
  try {
    env = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Encrypted payload is not valid JSON.');
  }
  if (!isObj(env)) throw new Error('Encrypted payload malformed.');
  if (env.v !== 1) throw new Error('Unsupported envelope version (only v1 is accepted).');
  if (env.cipher !== 'aes-gcm-256') throw new Error('Unsupported cipher (expected aes-gcm-256).');
  if (!env.iv || !env.ciphertext || !isObj(env.aad) || !Array.isArray(env.recipients)) {
    throw new Error('Envelope missing required fields.');
  }
  if (!isObj(env.commitments) || !env.commitments.keccak256) {
    throw new Error('Envelope commitments missing.');
  }
  const ivBytes = b64decode(env.iv);
  if (ivBytes.length !== 12) throw new Error('Envelope IV must be exactly 12 bytes (got ' + ivBytes.length + ').');
  const ctBytes = b64decode(env.ciphertext);
  if (!ctBytes || ctBytes.length === 0) throw new Error('Envelope ciphertext is empty after decode.');
  for (const r of env.recipients) {
    if (!r || !r.type) throw new Error('Envelope recipient missing type.');
    if (r.type === 'lit-sbt-v1' && (!r.lit || (!r.lit.ciphertext && !r.lit.encryptedSymmetricKey))) {
      throw new Error('Lit recipient missing ciphertext or encryptedSymmetricKey.');
    }
    if (r.type === 'self-eip712-v1' && (!r.wrap_iv || !r.wrapped_cek)) {
      throw new Error('Self-EIP712 recipient missing wrap_iv or wrapped_cek.');
    }
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(env.commitments.keccak256 || ''))) {
    throw new Error('Envelope keccak256 commitment has invalid format.');
  }
  if (env.commitments.poseidon && !/^0x[0-9a-fA-F]{64}$/.test(String(env.commitments.poseidon || ''))) {
    throw new Error('Envelope poseidon commitment has invalid format.');
  }
  return env as Envelope;
};

const normalizeBindingValue = (value: unknown) => safeLower(value == null ? '' : String(value));

const validateEnvelopeBinding = (
  env: Envelope,
  {
    expectedSurveyId,
    expectedQId,
    expectedFieldKey,
  }: {
    expectedSurveyId?: unknown;
    expectedQId?: unknown;
    expectedFieldKey?: unknown;
  } = {},
) => {
  if (!env || !isObj(env.aad)) return;

  if (expectedSurveyId !== undefined && expectedSurveyId !== null) {
    const actualSurveyId = normalizeBindingValue(env.aad.surveyId);
    const boundSurveyId = normalizeBindingValue(expectedSurveyId);
    if (actualSurveyId !== boundSurveyId) {
      throw new Error('Encrypted payload is bound to a different survey field.');
    }
  }

  if (expectedQId !== undefined && expectedQId !== null) {
    const actualQId = normalizeBindingValue(env.aad.qId);
    const boundQId = normalizeBindingValue(expectedQId);
    if (actualQId !== boundQId) {
      throw new Error('Encrypted payload is bound to a different survey field.');
    }
  }

  if (
    expectedFieldKey !== undefined &&
    expectedFieldKey !== null &&
    env.aad.fieldKey !== undefined &&
    env.aad.fieldKey !== null
  ) {
    const actualFieldKey = normalizeBindingValue(env.aad.fieldKey);
    const boundFieldKey = normalizeBindingValue(expectedFieldKey);
    if (actualFieldKey !== boundFieldKey) {
      throw new Error('Encrypted payload is bound to a different survey field.');
    }
  }
};

/* ------------------------- field encryption (v1) -------------------------- */

/**
 * Encrypt a single field (answer or additional) under CEK and wrap CEK for recipients.
 * Returns { envelopeJson, saltedKeccakHex, saltHex }.
 */
const encryptField = async ({
  providerLike,
  account,
  chainId,
  surveyId,
  qId,
  fieldKey,
  kind,
  value,
  questionPool,
  litOpts,
  hasher,
}: {
  providerLike: ProviderLike;
  account?: string;
  chainId: ChainIdInput;
  surveyId: string;
  qId: string;
  fieldKey?: string;
  kind: unknown;
  value: unknown;
  questionPool?: QuestionLike[];
  litOpts?: LitOptions;
  hasher?: PoseidonHasher | null;
}) => {
  const contextHex = computeContext({ chainId, account, surveyId, qId, fieldKey });
  assertBytes32Hex(contextHex);
  const aadObj = buildAAD({ contextHex, chainId, surveyId, qId, fieldKey });
  const aadBytes = utf8e(stableStringify(aadObj));

  // Resolve options for canonicalization (multichoice), and compute commitments
  const meta = getQuestionKindMeta(qId, { questionPool });
  const optionsForKind = kind === 'multichoice' ? meta.options : [];
  const commits = await computeSaltedCommitments({
    chainId,
    surveyId,
    qId,
    kind,
    value,
    optionsForKind,
    hasher,
  });

  // Plaintext package (salt kept ONLY here)
  const plaintextObj = {
    v: 1,
    value, // exact JS value (string | number | array)
    kind, // freeform | binary | rating | multichoice | additional (freeform)
    salt: commits.saltHex, // keep inside CEK-encrypted payload only
  };
  const plaintextBytes = utf8e(JSON.stringify(plaintextObj));

  // CEK (256-bit) and content AES-GCM
  const cekRaw = new Uint8Array(32);
  window.crypto.getRandomValues(cekRaw);
  const cek = await importAesGcmKey(cekRaw);
  const { iv, ciphertext } = await aesGcmEncrypt(cek, plaintextBytes, { aadBytes });

  // Recipients: self-eip712-v1 (mandatory) + optional lit
  const selfRecipient = await wrapCekWithSelfRecipient({
    providerLike,
    account: account || '',
    chainId,
    contextHex,
    cekRaw,
  });
  const litRecipients = await maybeAddLitRecipients(cekRaw, litOpts);
  const recipients = [selfRecipient, ...litRecipients];

  const envelope = buildEnvelope({
    iv,
    ciphertextBytes: ciphertext,
    aadObj,
    recipients,
    commitments: commits,
    kind,
  });

  return {
    envelopeJson: JSON.stringify(envelope),
    saltedKeccakHex: commits.keccakHex,
    saltHex: commits.saltHex,
  };
};

/* --------------------------- unwrap & decrypt ----------------------------- */

const unwrapCekFromRecipients = async ({
  env,
  account,
  chainId,
  providerLike,
  litOpts,
  preferLitRecipients = false,
}: {
  env: Envelope;
  account?: string;
  chainId: ChainIdInput;
  providerLike: ProviderLike;
  litOpts?: LitOptions;
  preferLitRecipients?: boolean;
}) => {
  const contextHex = env?.aad?.context;
  assertBytes32Hex(contextHex);
  const contextBytes = getContextBytes(contextHex);
  let lastErr = null;

  const litEntries = (env.recipients || []).filter((r) => r && r.type === 'lit-sbt-v1' && isObj(r.lit));
  const tryLitRecipients = async () => {
    if (!litEntries.length || !isObj(litOpts) || typeof litOpts.getKey !== 'function') return null;
    const getKey = litOpts.getKey as (opts?: UnknownRecord) => Promise<unknown> | unknown;
    for (const litEntry of litEntries) {
      const litData = litEntry.lit || {};
      try {
        const cekRaw = await getKey({
          // E2E Lit mock uses this to evaluate access control conditions deterministically.
          requesterAddress: account,
          encryptedSymmetricKey: litData.encryptedSymmetricKey,
          ciphertext: litData.ciphertext,
          dataToEncryptHash: litData.dataToEncryptHash,
          chipotle: litData.chipotle,
          accessControlConditions: litData.accessControlConditions,
          chain: litData.chain,
          resourceId: litData.resourceId,
          litNetwork: litOpts.litNetwork,
          connectTimeout: litOpts.connectTimeout,
          providerLike: litOpts.providerLike,
          resourceAbilityRequests: litOpts.resourceAbilityRequests,
        });
        // Accept either base64 or bytes
        return typeof cekRaw === 'string' ? b64decode(cekRaw) : toUint8Array(cekRaw);
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
      }
    }
    return null;
  };

  const trySelfRecipient = async () => {
    const self = (env.recipients || []).find((r) => r && r.type === 'self-eip712-v1');
    if (!self || typeof self.wrap_iv !== 'string' || typeof self.wrapped_cek !== 'string') return null;
    try {
      const nonce = self.nonce !== null && self.nonce !== undefined ? self.nonce : null;
      const typed = buildEip712KeyWrap(String(account || ''), chainId, contextHex, nonce);
      const provider = _getProvider(providerLike);
      const sig = await signEip712V4(provider, String(account || ''), typed);
      const kek = await deriveKekFromSig(sig, contextBytes);
      const wrapIvBytes = b64decode(self.wrap_iv);
      const wrappedBytes = b64decode(self.wrapped_cek);
      const cekRaw = await aesGcmDecrypt(kek, wrapIvBytes, wrappedBytes, { aadBytes: contextBytes });
      return new Uint8Array(cekRaw);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      return null;
    }
  };

  if (preferLitRecipients) {
    const litCek = await tryLitRecipients();
    if (litCek) return litCek;
    const selfCek = await trySelfRecipient();
    if (selfCek) return selfCek;
  } else {
    const selfCek = await trySelfRecipient();
    if (selfCek) return selfCek;
    const litCek = await tryLitRecipients();
    if (litCek) return litCek;
  }

  throw lastErr || new Error('Unable to unwrap CEK (self and lit paths failed).');
};

/* --------------------------- decrypt memoization -------------------------- */

// Decrypting v1 envelopes can be very expensive (wallet signing + Lit ACC evaluation).
// Cache decrypted plaintext per (account, chainId, providerKind, lit-ready, envelopeHash).
// This primarily reduces repeated "gate checks" for responses when users navigate around the UI.
const DECRYPT_ENVELOPE_CACHE_MAX = 1500;
const DECRYPT_ENVELOPE_FAIL_TTL_MS = 3000;
const DECRYPT_ENVELOPE_SUCCESS_TTL_MS = 1000 * 60 * 10;
const _decryptEnvelopeCache = new Map<string, DecryptCacheEntry>(); // key -> { ok, ts, value? , errMsg? }
const _decryptEnvelopeInFlight = new Map<string, Promise<DecryptEnvelopeResult>>(); // key -> Promise<{ value, kind, zkSalt }>

const normalizeEnvelopeJsonToString = (envelopeJson: unknown) =>
  typeof envelopeJson === 'string' ? envelopeJson : JSON.stringify(envelopeJson || {});

const hashEnvelopeJson = (jsonStr: unknown) => {
  try {
    // Use a short deterministic id instead of the full envelope JSON as a cache key.
    return utils.keccak256(utils.toUtf8Bytes(String(jsonStr || '')));
  } catch (_) {
    return `len:${String(jsonStr || '').length}`;
  }
};

const decryptCacheLruGet = (key: string) => {
  if (!_decryptEnvelopeCache.has(key)) return null;
  const value = _decryptEnvelopeCache.get(key);
  if (!value) return null;
  // Touch LRU
  _decryptEnvelopeCache.delete(key);
  _decryptEnvelopeCache.set(key, value);
  return value;
};

const decryptCacheLruSet = (key: string, entry: DecryptCacheEntry) => {
  if (_decryptEnvelopeCache.has(key)) _decryptEnvelopeCache.delete(key);
  _decryptEnvelopeCache.set(key, entry);
  while (_decryptEnvelopeCache.size > DECRYPT_ENVELOPE_CACHE_MAX) {
    const oldest = _decryptEnvelopeCache.keys().next().value;
    if (!oldest) break;
    _decryptEnvelopeCache.delete(oldest);
  }
};

const buildDecryptEnvelopeCacheKey = ({
  jsonStr,
  account,
  chainId,
  providerLike,
  litOpts,
  preferLitRecipients = false,
}: {
  jsonStr: string;
  account?: unknown;
  chainId?: ChainIdInput;
  providerLike?: ProviderLike;
  litOpts?: LitOptions;
  preferLitRecipients?: boolean;
}) => {
  const acct =
    String(account || '')
      .trim()
      .toLowerCase() || '<anon>';
  const ch = String(chainId ?? '');
  const providerKind = getProviderKind(providerLike);
  const litReady = !!(litOpts && typeof litOpts.getKey === 'function');
  const litNet = litOpts && litOpts.litNetwork ? String(litOpts.litNetwork) : '';
  const envHash = hashEnvelopeJson(jsonStr);
  return [
    acct,
    ch,
    providerKind,
    litReady ? 'lit' : 'no-lit',
    litNet,
    preferLitRecipients ? 'lit-first' : 'self-first',
    envHash,
  ].join('|');
};

const decryptEnvelopeToValue = async ({
  envelopeJson,
  account,
  chainId,
  providerLike,
  litOpts,
  preferLitRecipients = false,
  expectedSurveyId,
  expectedQId,
  expectedFieldKey,
}: {
  envelopeJson: unknown;
  account?: string;
  chainId: ChainIdInput;
  providerLike: ProviderLike;
  litOpts?: LitOptions;
  preferLitRecipients?: boolean;
  expectedSurveyId?: unknown;
  expectedQId?: unknown;
  expectedFieldKey?: unknown;
}): Promise<DecryptEnvelopeResult> => {
  perfDebugDecryptEnvelope('attempt');
  const jsonStr = normalizeEnvelopeJsonToString(envelopeJson);
  const env = parseEnvelope(jsonStr);
  validateEnvelopeBinding(env, { expectedSurveyId, expectedQId, expectedFieldKey });
  const cacheKey = buildDecryptEnvelopeCacheKey({
    jsonStr,
    account,
    chainId,
    providerLike,
    litOpts,
    preferLitRecipients,
  });

  const cached = decryptCacheLruGet(cacheKey);
  if (cached) {
    const ts = Number(cached.ts || 0);
    if (cached.ok) {
      if (cached.value && ts && Date.now() - ts < DECRYPT_ENVELOPE_SUCCESS_TTL_MS) {
        perfDebugDecryptEnvelope('cache_hit');
        return { ...(cached.value || {}) };
      }
      _decryptEnvelopeCache.delete(cacheKey);
    }
    if (!cached.ok) {
      if (ts && Date.now() - ts < DECRYPT_ENVELOPE_FAIL_TTL_MS) {
        perfDebugDecryptEnvelope('error');
        throw new Error(cached.errMsg || 'Decryption failed.');
      }
      // Failure backoff expired, allow retry.
      _decryptEnvelopeCache.delete(cacheKey);
    }
  }

  const inFlight = _decryptEnvelopeInFlight.get(cacheKey);
  if (inFlight) {
    perfDebugDecryptEnvelope('inflight_hit');
    return await inFlight;
  }

  const run = (async () => {
    const cekRaw = await unwrapCekFromRecipients({
      env,
      account,
      chainId,
      providerLike,
      litOpts,
      preferLitRecipients,
    });
    if (!(cekRaw instanceof Uint8Array) || cekRaw.length !== 32) {
      throw new Error('Unwrapped CEK has invalid length.');
    }
    const cek = await importAesGcmKey(cekRaw);

    const aadBytes = utf8e(stableStringify(env.aad));
    const ivBytes = b64decode(env.iv);
    const ciphertextBytes = b64decode(env.ciphertext);

    const ptBytes = await aesGcmDecrypt(cek, ivBytes, ciphertextBytes, { aadBytes });
    let pt = null;
    try {
      pt = JSON.parse(utf8d(ptBytes));
    } catch {
      throw new Error('Decrypted plaintext is not valid JSON.');
    }
    if (!isObj(pt) || pt.v !== 1 || !('value' in pt) || !('salt' in pt)) {
      throw new Error('Decrypted plaintext malformed.');
    }
    return { value: pt.value, kind: pt.kind || env?.meta?.kind || 'freeform', zkSalt: pt.salt };
  })();

  _decryptEnvelopeInFlight.set(cacheKey, run);
  try {
    const result = await run;
    decryptCacheLruSet(cacheKey, { ok: true, ts: Date.now(), value: result });
    return { ...(result || {}) };
  } catch (err) {
    decryptCacheLruSet(cacheKey, { ok: false, ts: Date.now(), errMsg: toErrorMessage(err, 'Decryption failed.') });
    perfDebugDecryptEnvelope('error');
    throw err;
  } finally {
    if (_decryptEnvelopeInFlight.get(cacheKey) === run) {
      _decryptEnvelopeInFlight.delete(cacheKey);
    }
  }
};

/* --------------------------- public API (v1) ------------------------------ */

/**
 * Encrypt only the fields present in `surveyState` and marked `encrypted === true`.
 * Preserves function signature. Supports:
 *   - optsOrPubKey: object form preferred:
 *       { providerKind, account, chainId, surveyId, onlyTheseQids?, questionPool?, lit? }
 *   - legacy string pubKey is ignored (kept for callsite compatibility).
 */
const encryptMultipleAnswers = async (
  surveyState: CryptoAnswerSlice = {},
  optsOrPubKey?: unknown,
  extraOpts?: CryptoEncryptOptions,
): Promise<CryptoAnswerOutput> => {
  const opts = (isRecord(optsOrPubKey) ? (optsOrPubKey as CryptoEncryptOptions) : extraOpts) || {};
  const providerKind = opts.providerKind || 'wagmi';
  const providerLike = (opts.provider || providerKind) as ProviderLike; // match decryptMultipleAnswers pattern
  const account = toOptionalString(opts.account);
  const chainId = opts.chainId;
  const surveyId = toOptionalString(opts.surveyId) || utils.hexZeroPad('0x0', 32);
  const onlySet = Array.isArray(opts.onlyTheseQids) ? new Set(opts.onlyTheseQids.map(String)) : null;
  const questionPool = Array.isArray(opts.questionPool) ? (opts.questionPool as QuestionLike[]) : undefined;
  const litOpts = isObj(opts.lit) ? opts.lit : undefined;
  const hasher = (opts.hasher || opts.poseidon || null) as PoseidonHasher | null;

  const out: CryptoAnswerOutput = {
    answers: {},
    importance: { ...(surveyState.importance || {}) },
    additionalComments: {},
  };

  const handleOne = async (
    qId: string,
    fieldKind: 'answer' | 'additional',
    fieldObj?: CryptoFieldEntry,
  ): Promise<CryptoFieldEntry | undefined> => {
    if (!fieldObj || fieldObj.value === '*' || fieldObj.encrypted !== true) return;
    if (onlySet && !onlySet.has(String(qId))) return;

    const kind = fieldKind === 'additional' ? 'freeform' : getQuestionKindMeta(qId, { questionPool }).kind;

    const { envelopeJson, saltedKeccakHex } = await encryptField({
      providerLike,
      account,
      chainId,
      surveyId,
      qId,
      fieldKey: fieldKind,
      kind,
      value: fieldObj.value,
      questionPool,
      litOpts,
      hasher,
    });

    // Mask value and attach envelope + salted Keccak hash
    const target = {
      encrypted: true,
      value: '*',
      encryptedPortion: envelopeJson,
      hash: saltedKeccakHex,
    };
    return target;
  };

  // answers
  const ansMap = surveyState.answers || {};
  for (const qId of Object.keys(ansMap)) {
    const r = await handleOne(qId, 'answer', ansMap[qId]);
    if (r) out.answers[qId] = { ...(ansMap[qId] || {}), ...r };
  }
  // additional
  const addMap = surveyState.additionalComments || {};
  for (const qId of Object.keys(addMap)) {
    const r = await handleOne(qId, 'additional', addMap[qId]);
    if (r) out.additionalComments[qId] = { ...(addMap[qId] || {}), ...r };
  }

  return out;
};

/**
 * Decrypt all masked fields. Supports BOTH old and new call shapes:
 *   old: decryptMultipleAnswers(slice, questionPool, account, providerKind, opts)
 *   new: decryptMultipleAnswers(slice, questionPool, opts)
 */
const decryptMultipleAnswers = async (
  slice: CryptoAnswerSlice = {},
  questionPool: QuestionLike[] = [],
  a?: unknown,
  b?: unknown,
  c: CryptoDecryptOptions = {},
): Promise<CryptoAnswerOutput> => {
  let account: string | undefined;
  let providerKind: ProviderLike;
  let opts: CryptoDecryptOptions;
  if (isObj(a) && (b === undefined || typeof b !== 'string')) {
    // new shape: (slice, questionPool, opts)
    opts = a as CryptoDecryptOptions;
    account = toOptionalString(opts.account);
    providerKind = (opts.providerKind || 'wagmi') as ProviderLike;
  } else {
    // old shape
    account = typeof a === 'string' ? a : undefined;
    providerKind = typeof b === 'string' ? b : 'wagmi';
    opts = c || {};
  }

  const providerLike = (opts.provider || opts.providerKind || providerKind || 'wagmi') as ProviderLike;
  const chainId = opts.chainId;
  const surveyId = toOptionalString(opts.surveyId) || utils.hexZeroPad('0x0', 32);
  const litOpts = isObj(opts.lit) ? opts.lit : undefined;
  const throwOnError = !!opts.throwOnError;

  const out: CryptoAnswerOutput = { answers: {}, additionalComments: {}, importance: { ...(slice.importance || {}) } };
  let maskedCount = 0;
  let decryptedCount = 0;
  let firstErr: Error | null = null;

  const tryField = async (
    qId: string,
    fieldKey: 'answer' | 'additional',
    fieldObj?: CryptoFieldEntry,
  ): Promise<CryptoFieldEntry | null> => {
    if (!fieldObj || fieldObj.value !== '*') return null;
    if (!fieldObj.encryptedPortion) {
      maskedCount += 1;
      if (throwOnError && !firstErr) {
        firstErr = new Error(`Encrypted payload missing for ${String(qId)}.`);
      }
      return null;
    }
    maskedCount += 1;

    const { value, zkSalt } = await decryptEnvelopeToValue({
      envelopeJson: fieldObj.encryptedPortion,
      account,
      chainId,
      providerLike,
      litOpts,
      expectedSurveyId: surveyId,
      expectedQId: qId,
      expectedFieldKey: fieldKey,
    });
    return { value, zkSalt };
  };

  const answers = slice.answers || {};
  for (const qId of Object.keys(answers)) {
    const entry = await tryField(qId, 'answer', answers[qId]).catch((err) => {
      if (throwOnError && !firstErr) firstErr = err instanceof Error ? err : new Error(String(err));
      return null;
    });
    if (entry) {
      decryptedCount += 1;
      out.answers[qId] = entry;
    }
  }
  const additionalComments = slice.additionalComments || {};
  for (const qId of Object.keys(additionalComments)) {
    const entry = await tryField(qId, 'additional', additionalComments[qId]).catch((err) => {
      if (throwOnError && !firstErr) firstErr = err instanceof Error ? err : new Error(String(err));
      return null;
    });
    if (entry) {
      decryptedCount += 1;
      out.additionalComments[qId] = entry;
    }
  }

  if (throwOnError && maskedCount > 0 && decryptedCount === 0 && firstErr) {
    throw firstErr;
  }

  return out;
};

/**
 * Decrypt a single field. Supports BOTH old and new call shapes:
 *   old: decryptSingleField(slice, qId, fieldToDecrypt, account, providerKind, opts)
 *   new: decryptSingleField(slice, qId, fieldToDecrypt, opts)
 */
const decryptSingleField = async (
  slice: CryptoAnswerSlice = {},
  qId: string,
  fieldToDecrypt: 'answer' | 'additional' | 'both',
  a?: unknown,
  b?: unknown,
  c: CryptoDecryptOptions = {},
): Promise<CryptoAnswerOutput> => {
  let account: string | undefined;
  let providerKind: ProviderLike;
  let opts: CryptoDecryptOptions;
  if (isObj(a) && (b === undefined || typeof b !== 'string')) {
    // new shape: (slice, qId, fieldToDecrypt, opts)
    opts = a as CryptoDecryptOptions;
    account = toOptionalString(opts.account);
    providerKind = (opts.providerKind || 'wagmi') as ProviderLike;
  } else {
    // old shape
    account = typeof a === 'string' ? a : undefined;
    providerKind = typeof b === 'string' ? b : 'wagmi';
    opts = c || {};
  }

  const providerLike = (opts.provider || opts.providerKind || providerKind || 'wagmi') as ProviderLike;
  const chainId = opts.chainId;
  const surveyId = toOptionalString(opts.surveyId) || utils.hexZeroPad('0x0', 32);
  const litOpts = isObj(opts.lit) ? opts.lit : undefined;
  const throwOnError = !!opts.throwOnError;

  const out: CryptoAnswerOutput = { answers: {}, additionalComments: {}, importance: {} };
  let firstErr: Error | null = null;

  const workAnswer = fieldToDecrypt === 'answer' || fieldToDecrypt === 'both' ? slice?.answers?.[qId] : null;
  const workAdditional =
    fieldToDecrypt === 'additional' || fieldToDecrypt === 'both' ? slice?.additionalComments?.[qId] : null;

  if (workAnswer && workAnswer.value === '*' && !workAnswer.encryptedPortion && throwOnError) {
    firstErr = firstErr || new Error(`Encrypted payload missing for answer (${String(qId)}).`);
  }
  if (workAnswer && workAnswer.value === '*' && workAnswer.encryptedPortion) {
    try {
      const { value, zkSalt } = await decryptEnvelopeToValue({
        envelopeJson: workAnswer.encryptedPortion,
        account,
        chainId,
        providerLike,
        litOpts,
        expectedSurveyId: surveyId,
        expectedQId: qId,
        expectedFieldKey: 'answer',
      });
      out.answers[qId] = { value, zkSalt };
    } catch (err) {
      if (throwOnError) {
        firstErr = firstErr || (err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
  if (workAdditional && workAdditional.value === '*' && !workAdditional.encryptedPortion && throwOnError) {
    firstErr = firstErr || new Error(`Encrypted payload missing for additional (${String(qId)}).`);
  }
  if (workAdditional && workAdditional.value === '*' && workAdditional.encryptedPortion) {
    try {
      const { value, zkSalt } = await decryptEnvelopeToValue({
        envelopeJson: workAdditional.encryptedPortion,
        account,
        chainId,
        providerLike,
        litOpts,
        expectedSurveyId: surveyId,
        expectedQId: qId,
        expectedFieldKey: 'additional',
      });
      out.additionalComments[qId] = { value, zkSalt };
    } catch (err) {
      if (throwOnError) {
        firstErr = firstErr || (err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  if (
    throwOnError &&
    firstErr &&
    Object.keys(out.answers).length === 0 &&
    Object.keys(out.additionalComments).length === 0
  ) {
    throw firstErr;
  }

  return out;
};

/* -------------------------- Password-based Encryption -------------------- */

/**
 * Encrypt arbitrary data with a password using PBKDF2 + AES-GCM.
 * Returns a base64-encoded JSON string containing { iv, salt, ciphertext }.
 */
const encryptWithPassword = async (data: unknown, password: string) => {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const passwordBytes = enc.encode(password);

  const keyMaterial = await window.crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const plaintext = enc.encode(JSON.stringify(data));
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plaintext);

  const output = {
    iv: Buffer.from(iv).toString('base64'),
    salt: Buffer.from(salt).toString('base64'),
    ciphertext: Buffer.from(ciphertext).toString('base64'),
  };

  return Buffer.from(JSON.stringify(output)).toString('base64');
};

/**
 * Decrypt data using a password (PBKDF2 + AES-GCM).
 * Input can be a raw object or a base64-encoded JSON string.
 */
const decryptWithPassword = async (encryptedData: string | UnknownRecord, password: string) => {
  let parsed: UnknownRecord;
  try {
    // If input is string, try to parse it as base64 JSON
    if (typeof encryptedData === 'string') {
      const jsonStr = Buffer.from(encryptedData, 'base64').toString('utf8');
      parsed = JSON.parse(jsonStr) as UnknownRecord;
    } else {
      parsed = encryptedData;
    }
  } catch (e) {
    throw new Error('Invalid encrypted data format');
  }

  if (!parsed.salt || !parsed.iv || !parsed.ciphertext) {
    throw new Error('Missing encryption fields (salt, iv, ciphertext)');
  }

  const salt = decodeBase64Field(parsed.salt, 'salt');
  const iv = decodeBase64Field(parsed.iv, 'iv');
  const ciphertext = decodeBase64Field(parsed.ciphertext, 'ciphertext');

  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);

  const keyMaterial = await window.crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  try {
    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    throw new Error('Incorrect password or corrupted data');
  }
};

/**
 * Decrypt an envelope (v1) and return only the plaintext `value`.
 * Useful for non-survey payloads (e.g., group-level secrets).
 */
const decryptEnvelopeValue = async (envelopeJson: unknown, opts: CryptoDecryptOptions = {}) => {
  const jsonStr = typeof envelopeJson === 'string' ? envelopeJson : JSON.stringify(envelopeJson || {});
  const { account, chainId, providerLike, litOpts, preferLitRecipients } = opts || {};
  const { value } = await decryptEnvelopeToValue({
    envelopeJson: jsonStr,
    account: toOptionalString(account),
    chainId,
    providerLike: providerLike as ProviderLike,
    litOpts,
    preferLitRecipients: !!preferLitRecipients,
  });
  return value;
};

/**
 * Encrypt an arbitrary value into a v1 envelope (non-survey use-cases).
 */
const encryptEnvelopeValue = async (value: unknown, opts: CryptoEncryptOptions = {}) => {
  const providerLike = (opts.provider || opts.providerLike || opts.providerKind || 'wagmi') as ProviderLike;
  const account = toOptionalString(opts.account);
  const chainId = opts.chainId;
  const kind = toOptionalString(opts.kind) || 'freeform';
  const contextLabel = toOptionalString(opts.contextLabel) || toOptionalString(opts.label) || 'secret';
  const surveyId = toOptionalString(opts.surveyId) || hashIdentifier(contextLabel);
  const qId = toOptionalString(opts.qId) || `secret:${contextLabel}`;
  const litOpts = isObj(opts.lit) ? opts.lit : undefined;
  const hasher = (opts.hasher || opts.poseidon || null) as PoseidonHasher | null;

  const { envelopeJson } = await encryptField({
    providerLike,
    account,
    chainId,
    surveyId,
    qId,
    kind,
    value,
    questionPool: Array.isArray(opts.questionPool) ? (opts.questionPool as QuestionLike[]) : undefined,
    litOpts,
    hasher,
  });
  return envelopeJson;
};

/* ------------------------------ exports ---------------------------------- */

/** @type {CryptoUtilsApi} */
export const cryptoUtils = {
  /** @type {CryptoUtilsApi['getProviderKind']} */
  getProviderKind,
  /** @type {CryptoUtilsApi['_getProvider']} */
  _getProvider,
  /** @type {CryptoUtilsApi['encryptMultipleAnswers']} */
  encryptMultipleAnswers,
  /** @type {CryptoUtilsApi['decryptMultipleAnswers']} */
  decryptMultipleAnswers,
  /** @type {CryptoUtilsApi['decryptSingleField']} */
  decryptSingleField,
  /** @type {CryptoUtilsApi['computeContext']} */
  computeContext,
  /** @type {CryptoUtilsApi['getQuestionKindMeta']} */
  getQuestionKindMeta,
  /** @type {CryptoUtilsApi['addTopLevelPoseidonIfRequired']} */
  addTopLevelPoseidonIfRequired,
  /** @type {CryptoUtilsApi['hashIdentifier']} */
  hashIdentifier,
  /** @type {CryptoUtilsApi['encryptWithPassword']} */
  encryptWithPassword,
  /** @type {CryptoUtilsApi['decryptWithPassword']} */
  decryptWithPassword,
  /** @type {CryptoUtilsApi['encryptEnvelopeValue']} */
  encryptEnvelopeValue,
  /** @type {CryptoUtilsApi['decryptEnvelopeValue']} */
  decryptEnvelopeValue,
  /** @type {CryptoUtilsApi['computeGroupPasswordHash']} */
  computeGroupPasswordHash,
  /** @type {CryptoUtilsApi['resolveGroupPasswordWalletScopeAddress']} */
  resolveGroupPasswordWalletScopeAddress,
  /** @type {CryptoUtilsApi['computeGroupMintMessageHash']} */
  computeGroupMintMessageHash,
  /** @type {CryptoUtilsApi['signGroupMintAuthorization']} */
  signGroupMintAuthorization,
  /** @type {CryptoUtilsApi['buildInviteMessageHash']} */
  buildInviteMessageHash,
  /** @type {CryptoUtilsApi['signInvite']} */
  signInvite,
  /** @type {CryptoUtilsApi['encodeInvite']} */
  encodeInvite,
  /** @type {CryptoUtilsApi['decodeInvite']} */
  decodeInvite,
  /** @type {CryptoUtilsApi['generateInviteNonce']} */
  generateInviteNonce,
  /** @type {CryptoUtilsApi['normalizeGroupPasswordInput']} */
  normalizeGroupPasswordInput,
  /** @type {CryptoUtilsApi['encodeGroupPasswordForUrl']} */
  encodeGroupPasswordForUrl,
  /** @type {CryptoUtilsApi['verifyInviteSignature']} */
  verifyInviteSignature,
  /** @type {CryptoUtilsApi['__test']} */
  __test: {
    buildDecryptEnvelopeCacheKey,
  },
};
