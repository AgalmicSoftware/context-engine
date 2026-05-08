import { createHmac, randomBytes } from 'crypto';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { warn } from './log.mjs';
import {
  decryptFromFile,
  encryptToFile,
  isEncryptedFile,
  migrateToEncrypted,
} from './keyEncryption.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(process.env.CE_CC_DATA_DIR || resolve(__dirname, '..', '.data'));
const SECRET_PATH = resolve(DATA_DIR, 'jwt-secret.key');

const TOKEN_EXPIRY_DAYS = Number(process.env.TOKEN_EXPIRY_DAYS) || 30;

function base64urlEncode(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function createAndStoreSecret() {
  mkdirSync(DATA_DIR, { recursive: true });
  const key = randomBytes(48);
  encryptToFile(SECRET_PATH, key);
  return key;
}

function loadOrCreateSecret() {
  if (!existsSync(SECRET_PATH)) {
    return createAndStoreSecret();
  }

  const decrypted = decryptFromFile(SECRET_PATH);
  if (decrypted) {
    return decrypted;
  }

  if (isEncryptedFile(SECRET_PATH)) {
    warn('[auth] Warning: jwt-secret.key could not be decrypted. Regenerating local JWT signing secret.');
    return createAndStoreSecret();
  }

  const legacySecret = readFileSync(SECRET_PATH);
  try {
    migrateToEncrypted(SECRET_PATH);
  } catch (err) {
    warn(`[auth] Warning: failed to migrate jwt-secret.key to encrypted storage (${err.message}).`);
  }
  return legacySecret;
}

let _secret = null;
function secret() {
  if (!_secret) _secret = loadOrCreateSecret();
  return _secret;
}

function hmacSign(data) {
  return createHmac('sha256', secret()).update(data).digest();
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

export function signJwt(payload) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  };
  const payloadJson = JSON.stringify(fullPayload);
  const payloadB64 = base64urlEncode(payloadJson);
  const sig = base64urlEncode(hmacSign(payloadJson));
  return `${payloadB64}.${sig}`;
}

export function verifyJwt(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Missing token.' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'Invalid token format.' };
  }
  const [payloadB64, sigB64] = parts;

  let payloadJson;
  try {
    payloadJson = base64urlDecode(payloadB64).toString('utf8');
  } catch {
    return { ok: false, error: 'Invalid token encoding.' };
  }

  const expectedSig = base64urlEncode(hmacSign(payloadJson));
  if (!timingSafeEqual(expectedSig, sigB64)) {
    return { ok: false, error: 'Invalid token signature.' };
  }

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: 'Invalid token payload.' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now >= payload.exp) {
    return { ok: false, error: 'Token expired.' };
  }

  return { ok: true, payload };
}

// Decode a CE worker token payload without signature verification.
// CE worker tokens use the same payload.signature format but are signed
// with the worker's TOKEN_HMAC_SECRET which we don't have.
// For local use, decoding the payload is sufficient.
export function decodeTokenPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const json = base64urlDecode(parts[0]).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}
