import { base64UrlEncode } from './tokenSigning.js';

const AUTH_TOKEN_RECORD_VALUE = '1';

const toTokenPart = (value) => String(value ?? '').trim();

const toSubjectPart = (value) => toTokenPart(value).toLowerCase();

const getAuthTokenKv = (env) => env?.GROUP_KV;

const fillRandomValues = (bytes, deps) => {
  if (typeof deps?.getRandomValues === 'function') {
    return deps.getRandomValues(bytes);
  }
  const cryptoImpl = globalThis.crypto;
  if (typeof cryptoImpl?.getRandomValues === 'function') {
    return cryptoImpl.getRandomValues(bytes);
  }
  throw new Error('crypto.getRandomValues unavailable.');
};

export const buildAuthTokenKey = ({ slug, sub, jti } = {}) => {
  const slugPart = toTokenPart(slug);
  const subPart = toSubjectPart(sub);
  const jtiPart = toTokenPart(jti);
  if (!slugPart || !subPart || !jtiPart) return '';
  return `authToken:${slugPart}:${subPart}:${jtiPart}`;
};

export const buildAuthTokenJti = (deps = {}) => {
  if (typeof deps?.randomUUID === 'function') {
    return toTokenPart(deps.randomUUID());
  }
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return toTokenPart(globalThis.crypto.randomUUID());
  }

  const bytes = new Uint8Array(16);
  fillRandomValues(bytes, deps);
  const encode = typeof deps?.base64UrlEncode === 'function'
    ? deps.base64UrlEncode
    : base64UrlEncode;
  return toTokenPart(encode(bytes));
};

export const persistAuthTokenRecord = async ({
  env,
  slug,
  sub,
  jti,
  ttlSeconds,
} = {}) => {
  const key = buildAuthTokenKey({ slug, sub, jti });
  const numericTtl = Number(ttlSeconds);
  const kv = getAuthTokenKv(env);
  if (!key || !Number.isFinite(numericTtl) || numericTtl <= 0 || typeof kv?.put !== 'function') {
    throw new Error('Auth token store unavailable.');
  }

  await kv.put(key, AUTH_TOKEN_RECORD_VALUE, {
    expirationTtl: Math.floor(numericTtl),
  });
};

export const validateAuthTokenRecord = async ({
  env,
  payload,
  slug,
} = {}) => {
  const hasJti = Object.prototype.hasOwnProperty.call(payload || {}, 'jti');
  if (!hasJti) return { ok: true, legacy: true };

  const key = buildAuthTokenKey({
    slug: slug || payload?.slug,
    sub: payload?.sub,
    jti: payload?.jti,
  });
  const kv = getAuthTokenKv(env);
  if (!key || typeof kv?.get !== 'function') {
    return { ok: false, error: 'Invalid token.' };
  }

  const marker = await kv.get(key);
  if (!marker) return { ok: false, error: 'Invalid token.' };
  return { ok: true, legacy: false };
};

export const revokeAuthTokenRecord = async ({
  env,
  slug,
  sub,
  jti,
} = {}) => {
  const key = buildAuthTokenKey({ slug, sub, jti });
  const kv = getAuthTokenKv(env);
  if (!key || typeof kv?.delete !== 'function') return false;
  await kv.delete(key);
  return true;
};
