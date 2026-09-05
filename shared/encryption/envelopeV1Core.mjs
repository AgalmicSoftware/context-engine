/**
 * Shared Envelope v1 pure-crypto core. Consumed by both browser client and CE-CC (Node 20+).
 * No browser globals, no Lit, no wallet provider resolution, no Node-specific keys.
 * Signing is provided via a `signTypedData(domain, types, message)` callback.
 */

import { Buffer } from 'buffer';
import { ethers } from 'ethers';

const { utils } = ethers;

/* ----------------------------- Infrastructure ----------------------------- */

export const requireBigInt = () => {
  if (typeof BigInt !== 'function') {
    throw new Error(
      'BigInt is required for commitments. Use a modern browser: Chrome >=67, Edge >=79, Firefox >=68, Safari/iOS >=14.'
    );
  }
};

export const getCrypto = () => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || !cryptoApi.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Web Crypto API with subtle crypto and getRandomValues is not available.');
  }
  return cryptoApi;
};

export const BN254_P =
  BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

/* -------------------------- Bytes and text helpers ------------------------- */

export const hexToBytes = (hex) => utils.arrayify(hex);
export const bytesToHex = (bytes) => utils.hexlify(bytes);

export const concatBytes = (...arrs) => {
  const total = arrs.reduce((n, a) => n + (a ? a.length : 0), 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrs) {
    if (!arr) continue;
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
};

export const b64encode = (bytes) => Buffer.from(bytes).toString('base64');
export const b64decode = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));
export const utf8e = (s) => new TextEncoder().encode(String(s));
export const utf8d = (bytes) => new TextDecoder().decode(bytes);
export const safeLower = (value) => (typeof value === 'string' ? value.toLowerCase() : value);
export const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
export const stableStringify = (obj) => JSON.stringify(obj);

export const assertBytes32Hex = (value, label = 'value') => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be 32-byte hex (0x + 64 hex chars)`);
  }
};

export const getContextBytes = (contextHex) => hexToBytes(contextHex);

/* ---------------------------- Hashing and AES ----------------------------- */

export const sha256 = async (bytes) => {
  try {
    return new Uint8Array(await getCrypto().subtle.digest('SHA-256', bytes));
  } catch (_) {
    // Fall through to ethers fallback. Shared core stays logger-free.
  }
  try {
    return utils.arrayify(utils.sha256(bytes));
  } catch (_) {
    throw new Error('SHA-256 is not available in this environment.');
  }
};

export const importAesGcmKey = (raw32) =>
  getCrypto().subtle.importKey('raw', raw32, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

export const aesGcmEncrypt = async (key, plaintextBytes, { aadBytes } = {}) => {
  const cryptoApi = getCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv, ...(aadBytes ? { additionalData: aadBytes } : {}) },
    key,
    plaintextBytes
  );
  return { iv, ciphertext: new Uint8Array(ciphertext) };
};

export const aesGcmDecrypt = async (key, iv, ciphertextBytes, { aadBytes } = {}) => {
  const plaintext = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv, ...(aadBytes ? { additionalData: aadBytes } : {}) },
    key,
    ciphertextBytes
  );
  return new Uint8Array(plaintext);
};

export const deriveKekFromSig = async (signatureHex, contextBytes) => {
  const cryptoApi = getCrypto();
  const sigBytes = hexToBytes(signatureHex);
  const ikm = await sha256(sigBytes);
  const hkdfKey = await cryptoApi.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey(
    { name: 'HKDF', salt: utf8e('surveytool:v1'), info: contextBytes, hash: 'SHA-256' },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/* --------------------------- Context/AAD/EIP-712 -------------------------- */

export const buildEip712KeyWrap = (account, chainId, contextHex, nonce = null) => {
  const checksummedAccount = utils.getAddress(account);
  const keyDerivationTypes = [
    { name: 'app', type: 'string' },
    { name: 'purpose', type: 'string' },
    { name: 'account', type: 'address' },
    { name: 'context', type: 'bytes32' },
  ];
  const message = {
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

const computeContextValue = ({ chainId, account, surveyId, qId, fieldKey }, bindFieldKey) => {
  const cid = chainId === 0 || chainId ? String(chainId) : '';
  const acct = safeLower(account || '');
  const sid = safeLower(surveyId || utils.hexZeroPad('0x0', 32));
  const q = safeLower(qId || '');
  const fieldBinding = bindFieldKey ? `|field:${safeLower(fieldKey || '')}` : '';
  return utils.keccak256(utf8e(`rxc|v1|chain:${cid}|acct:${acct}|survey:${sid}|qid:${q}${fieldBinding}`));
};

// CE-CC shipped v1 without a field slot in the context. Keep that wire format stable.
export const computeContext = (input) => computeContextValue(input, false);

// Browser response fields have always included their answer/additional slot.
export const computeResponseFieldContext = (input) => computeContextValue(input, true);

export const buildAAD = ({ contextHex, chainId, surveyId, qId }) => ({
  context: contextHex,
  chainId: chainId ?? null,
  surveyId: surveyId ?? null,
  qId: qId ?? null,
});

export const buildResponseFieldAAD = ({ contextHex, chainId, surveyId, qId, fieldKey }) => ({
  context: contextHex,
  chainId: chainId ?? null,
  surveyId: surveyId ?? null,
  qId: qId ?? null,
  fieldKey: fieldKey ?? null,
});

export const hashIdentifier = (identifier) => {
  const value = identifier === null || identifier === undefined ? '' : String(identifier);
  try {
    if (utils.isHexString(value, 32)) return value.toLowerCase();
  } catch (_) {}
  if (value.trim() === '') return utils.hexZeroPad('0x0', 32);
  return utils.id(value);
};

/* ------------------------- Canonical value encoders ------------------------ */

export const encodeFreeform = (value) => utf8e(value == null ? '' : String(value));

export const encodeBinary = (value) => {
  const map = { Disagree: 0, Unsure: 1, Agree: 2 };
  const v =
    map[String(value)] ?? (map[String(value).charAt(0).toUpperCase() + String(value).slice(1)] ?? 1);
  return new Uint8Array([v & 0xff]);
};

export const encodeRating = (value) => {
  let n = Number(value);
  if (!Number.isFinite(n)) n = 0;
  if (n < 0) n = 0;
  if (n > 10) n = 10;
  return new Uint8Array([n & 0xff]);
};

export const encodeMultichoiceBitset = (valueArr, options) => {
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

export const encodeValueBytes = (kind, value, { options = [] } = {}) => {
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

/* -------------------------------- Field math ------------------------------- */

export const toField = (bytes) => {
  let x = 0n;
  for (let i = 0; i < bytes.length; i++) {
    x = (x * 256n + BigInt(bytes[i])) % BN254_P;
  }
  return x;
};

export const bigIntToHex32 = (x) => {
  let h = x.toString(16);
  if (h.length % 2) h = `0${h}`;
  if (h.length < 64) h = h.padStart(64, '0');
  return `0x${h}`;
};

export const normalizePoseidonHashOutput = (out) => bigIntToHex32(BigInt(out) % BN254_P);

export const poseidonHashBytes = async (inputBytes, customHasher = null) => {
  requireBigInt();
  if (typeof customHasher !== 'function') {
    throw new Error('Poseidon hasher required but not available');
  }
  try {
    const inputs = inputBytes.map((bytes) => toField(bytes));
    const out = await customHasher(inputs);
    return normalizePoseidonHashOutput(out);
  } catch (_) {
    throw new Error('Poseidon hasher required but not available');
  }
};

/* ------------------------------- Commit helpers --------------------------- */

export const buildCommitDomainBytes = ({ chainId, surveyId, qId }) => {
  const sid = safeLower(surveyId || utils.hexZeroPad('0x0', 32));
  const domain = `rxc|commit|v1|chain:${String(chainId ?? '')}|survey:${sid}|qid:${safeLower(qId || '')}`;
  return utf8e(domain);
};

export const computeSaltedCommitments = async ({
  chainId,
  surveyId,
  qId,
  kind,
  value,
  optionsForKind = [],
  hasher = null,
}) => {
  const cryptoApi = getCrypto();
  const saltBytes = new Uint8Array(16);
  cryptoApi.getRandomValues(saltBytes);
  const salt = bytesToHex(saltBytes);

  const domainBytes = buildCommitDomainBytes({ chainId, surveyId, qId });
  const canonicalBytes = encodeValueBytes(kind, value, { options: optionsForKind });
  const keccak256 = utils.keccak256(concatBytes(saltBytes, canonicalBytes, domainBytes));
  let poseidon = null;

  try {
    poseidon = await poseidonHashBytes([saltBytes, canonicalBytes, domainBytes], hasher);
  } catch (_) {
    // Poseidon unavailable: preserve null for CE-CC compatibility. buildEnvelope omits null.
  }

  return {
    salt,
    keccak256,
    poseidon,
  };
};

/* ------------------------------- Envelope shape --------------------------- */

export const buildEnvelopeObject = ({
  iv,
  ciphertextBytes,
  aadObj,
  recipients,
  commitments,
  kind,
}) => ({
    v: 1,
    cipher: 'aes-gcm-256',
    iv: b64encode(iv),
    aad: aadObj,
    ciphertext: b64encode(ciphertextBytes),
    recipients,
    commitments: {
      keccak256: commitments.keccak256,
      ...(commitments.poseidon ? { poseidon: commitments.poseidon } : {}),
    },
    meta: { kind },
  });

export const buildEnvelope = (input) => JSON.stringify(buildEnvelopeObject(input));

export const parseEnvelope = (jsonStr) => {
  if (typeof jsonStr !== 'string') {
    throw new Error('envelope must be a JSON string');
  }

  let env = null;
  try {
    env = JSON.parse(jsonStr);
  } catch (_) {
    throw new Error('envelope is not valid JSON');
  }

  if (!isObj(env)) throw new Error('envelope must be a JSON object');
  if (env.v !== 1) throw new Error('envelope version must be 1');
  if (env.cipher !== 'aes-gcm-256') throw new Error('envelope cipher must be aes-gcm-256');
  if (typeof env.iv !== 'string') throw new Error('envelope iv must be a string');
  const ivBytes = b64decode(env.iv);
  if (ivBytes.length !== 12) throw new Error(`envelope iv must decode to exactly 12 bytes (got ${ivBytes.length})`);
  if (!isObj(env.aad)) throw new Error('envelope aad must be an object');
  if (typeof env.ciphertext !== 'string') throw new Error('envelope ciphertext must be a string');
  const ciphertextBytes = b64decode(env.ciphertext);
  if (ciphertextBytes.length === 0) throw new Error('envelope ciphertext must decode to non-empty bytes');
  if (!Array.isArray(env.recipients)) {
    throw new Error('envelope recipients must be an array');
  }
  for (let i = 0; i < env.recipients.length; i++) {
    const recipient = env.recipients[i];
    if (!isObj(recipient) || typeof recipient.type !== 'string' || recipient.type.length === 0) {
      throw new Error('envelope recipient type must be a string');
    }
    if (recipient.type === 'self-eip712-v1') {
      const prefix = `envelope recipient[${i}] self-eip712-v1`;
      if (
        Object.prototype.hasOwnProperty.call(recipient, 'context') &&
        (typeof recipient.context !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(recipient.context))
      ) {
        throw new Error(`${prefix} context must be 32-byte hex`);
      }
      if (typeof recipient.wrap_iv !== 'string' || recipient.wrap_iv.length === 0) {
        throw new Error(`${prefix} is missing wrap_iv`);
      }
      const wrapIvBytes = b64decode(recipient.wrap_iv);
      if (wrapIvBytes.length !== 12) {
        throw new Error(`${prefix} wrap_iv must decode to exactly 12 bytes (got ${wrapIvBytes.length})`);
      }
      if (typeof recipient.wrapped_cek !== 'string' || recipient.wrapped_cek.length === 0) {
        throw new Error(`${prefix} is missing wrapped_cek`);
      }
      const wrappedCekBytes = b64decode(recipient.wrapped_cek);
      if (wrappedCekBytes.length === 0) {
        throw new Error(`${prefix} wrapped_cek must decode to non-empty bytes`);
      }
      if (
        Object.prototype.hasOwnProperty.call(recipient, 'nonce') &&
        (typeof recipient.nonce !== 'string' || recipient.nonce.length === 0)
      ) {
        throw new Error(`${prefix} nonce must be a non-empty string`);
      }
    }
  }
  if (!isObj(env.commitments)) throw new Error('envelope commitments must be an object');
  if (
    typeof env.commitments.keccak256 !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(env.commitments.keccak256)
  ) {
    throw new Error('envelope commitments.keccak256 must be 32-byte hex');
  }
  if (
    typeof env.commitments.poseidon === 'string' &&
    env.commitments.poseidon.length > 0 &&
    !/^0x[0-9a-fA-F]{64}$/.test(env.commitments.poseidon)
  ) {
    throw new Error('envelope commitments.poseidon must be 32-byte hex');
  }

  return env;
};

export const normalizeBindingValue = (value) => safeLower(value == null ? '' : String(value));

export const validateEnvelopeBinding = (env, { expectedSurveyId, expectedQId } = {}) => {
  if (!env || !isObj(env.aad)) return;

  if (expectedSurveyId !== undefined && expectedSurveyId !== null) {
    const actualSurveyId = normalizeBindingValue(env.aad.surveyId);
    const boundSurveyId = normalizeBindingValue(expectedSurveyId);
    if (actualSurveyId !== boundSurveyId) {
      throw new Error('envelope binding mismatch: surveyId');
    }
  }

  if (expectedQId !== undefined && expectedQId !== null) {
    const actualQId = normalizeBindingValue(env.aad.qId);
    const boundQId = normalizeBindingValue(expectedQId);
    if (actualQId !== boundQId) {
      throw new Error('envelope binding mismatch: qId');
    }
  }
};

/* ---------------------------- Self-recipient wrap -------------------------- */

export const wrapCekWithSelfRecipient = async ({
  signTypedData,
  account,
  chainId,
  contextHex,
  cekRaw,
}) => {
  assertBytes32Hex(contextHex, 'context');
  if (typeof signTypedData !== 'function') {
    throw new Error('Missing signTypedData callback for self recipient.');
  }
  if (!account) throw new Error('Missing account for self recipient.');
  if (chainId === undefined || chainId === null) throw new Error('Missing chainId for self recipient.');

  const cryptoApi = getCrypto();
  const nonceBytes = cryptoApi.getRandomValues(new Uint8Array(32));
  const nonce = BigInt(bytesToHex(nonceBytes)).toString();
  const typed = buildEip712KeyWrap(account, chainId, contextHex, nonce);
  const sig = await signTypedData(typed.domain, typed.types, typed.message);

  const contextBytes = getContextBytes(contextHex);
  const kek = await deriveKekFromSig(sig, contextBytes);

  const wrap_iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const cipher = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: wrap_iv, additionalData: contextBytes },
    kek,
    cekRaw
  );

  return {
    type: 'self-eip712-v1',
    context: contextHex,
    wrap_iv: b64encode(wrap_iv),
    wrapped_cek: b64encode(new Uint8Array(cipher)),
    nonce,
  };
};
