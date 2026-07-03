import { toStr } from './stringCoercion.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hmacKeyCache = new Map();

const getBase64Encoder = (deps) => {
  if (typeof deps?.btoa === 'function') return deps.btoa;
  if (typeof globalThis.btoa === 'function') return globalThis.btoa.bind(globalThis);
  throw new Error('btoa unavailable');
};

const getBase64Decoder = (deps) => {
  if (typeof deps?.atob === 'function') return deps.atob;
  if (typeof globalThis.atob === 'function') return globalThis.atob.bind(globalThis);
  throw new Error('atob unavailable');
};

const getCryptoSubtle = (deps) => {
  const cryptoImpl = deps?.crypto || globalThis.crypto;
  if (cryptoImpl?.subtle) return cryptoImpl.subtle;
  throw new Error('crypto.subtle unavailable');
};

const getHmacKeyCache = (deps) => deps?.hmacKeyCache || hmacKeyCache;

export const base64UrlEncode = (bytes, deps) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = getBase64Encoder(deps)(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const base64UrlDecode = (b64url, deps) => {
  const raw = toStr(b64url).replace(/-/g, '+').replace(/_/g, '/');
  const pad = raw.length % 4 ? '='.repeat(4 - (raw.length % 4)) : '';
  const binary = getBase64Decoder(deps)(raw + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i += 1) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return res === 0;
};

export const getHmacKey = async (secret, deps) => {
  const keyText = toStr(secret);
  if (!keyText) return null;
  const cache = getHmacKeyCache(deps);
  if (cache.has(keyText)) return cache.get(keyText);
  const key = await getCryptoSubtle(deps).importKey(
    'raw',
    encoder.encode(keyText),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  cache.set(keyText, key);
  return key;
};

export const signHmac = async (payload, secret, deps) => {
  const key = await getHmacKey(secret, deps);
  if (!key) throw new Error('TOKEN_HMAC_SECRET is missing.');
  const sig = await getCryptoSubtle(deps).sign('HMAC', key, encoder.encode(payload));
  return new Uint8Array(sig);
};

export const signToken = async (payload, secret, deps) => {
  const payloadJson = JSON.stringify(payload);
  const sigBytes = await signHmac(payloadJson, secret, deps);
  return `${base64UrlEncode(encoder.encode(payloadJson), deps)}.${base64UrlEncode(sigBytes, deps)}`;
};

export const verifyToken = async (token, secret, deps) => {
  const raw = toStr(token);
  const parts = raw.split('.');
  if (parts.length !== 2) return { ok: false, error: 'Invalid token format.' };
  const payloadPart = parts[0];
  const sigPart = parts[1];
  let payloadJson = '';
  try {
    payloadJson = decoder.decode(base64UrlDecode(payloadPart, deps));
  } catch {
    return { ok: false, error: 'Invalid token payload.' };
  }
  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: 'Invalid token payload JSON.' };
  }

  let expectedSig;
  try {
    const sigBytes = await signHmac(payloadJson, secret, deps);
    expectedSig = base64UrlEncode(sigBytes, deps);
  } catch (err) {
    return { ok: false, error: err?.message || 'Token signing error.' };
  }
  if (!timingSafeEqual(expectedSig, sigPart)) {
    return { ok: false, error: 'Invalid token signature.' };
  }
  const exp = Number(payload?.exp || 0);
  if (!exp || Number.isNaN(exp)) return { ok: false, error: 'Token missing exp.' };
  const now = Math.floor((typeof deps?.now === 'function' ? deps.now() : Date.now()) / 1000);
  if (now >= exp) return { ok: false, error: 'Token expired.' };
  if (typeof payload?.sub !== 'undefined' && typeof payload.sub !== 'string') {
    return { ok: false, error: 'Token sub must be a string.' };
  }
  if (
    typeof payload?.scopes !== 'undefined' &&
    (typeof payload.scopes !== 'object' || payload.scopes === null || Array.isArray(payload.scopes))
  ) {
    return { ok: false, error: 'Token scopes must be an object.' };
  }
  if (typeof payload?.slug !== 'undefined' && typeof payload.slug !== 'string') {
    return { ok: false, error: 'Token slug must be a string.' };
  }
  if (typeof payload?.jti !== 'undefined' && typeof payload.jti !== 'string') {
    return { ok: false, error: 'Token jti must be a string.' };
  }

  return { ok: true, payload };
};
