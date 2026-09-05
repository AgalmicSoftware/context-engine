import { sessionSlugStorageKey } from '../sessionCorsWorker/sessionSlugResolution.js';

export const SESSION_SECRETS_ENVELOPE_VERSION = 1;
export const SESSION_SECRETS_ENVELOPE_KIND = 'session-secrets';
export const SESSION_SECRETS_ENVELOPE_CIPHER = 'AES-256-GCM';
export const SESSION_SECRETS_ENVELOPE_KEY_REF = 'worker_secret:CE_STORAGE_ENVELOPE_KEK';
export const SESSION_SECRETS_CURRENT_KEK_NAME = 'CE_STORAGE_ENVELOPE_KEK';
export const SESSION_SECRETS_PREVIOUS_KEK_NAME = 'CE_STORAGE_ENVELOPE_PREVIOUS_KEK';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const AES_GCM = 'AES-GCM';
const KEY_DERIVATION_DOMAIN = 'ce-session-secrets-kek:v1';

const isRecord = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const normalizeTimestampMs = (value) => {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1e12 ? Math.trunc(raw) : Math.trunc(raw * 1000);
};

const cloneRecord = (value) => (
  isRecord(value) ? { ...value } : {}
);

const toTrimmedString = (value) => (
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
);

const getCryptoImpl = (deps = {}) => {
  const cryptoImpl = deps.crypto || globalThis.crypto;
  if (!cryptoImpl?.subtle) {
    throw new Error('WebCrypto subtle crypto is required for session secret encryption.');
  }
  return cryptoImpl;
};

const randomBytes = (length, deps = {}) => {
  const supplied = typeof deps.randomBytes === 'function' ? deps.randomBytes(length) : null;
  if (supplied && supplied.length >= length) {
    return new Uint8Array(supplied).slice(0, length);
  }
  const bytes = new Uint8Array(length);
  const cryptoImpl = getCryptoImpl(deps);
  const getRandomValues = typeof deps.getRandomValues === 'function'
    ? deps.getRandomValues
    : cryptoImpl.getRandomValues?.bind(cryptoImpl);
  if (typeof getRandomValues !== 'function') {
    throw new Error('Secure randomness is required for session secret encryption.');
  }
  getRandomValues(bytes);
  return bytes;
};

const bytesToBase64url = (value) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || []);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64urlToBytes = (value) => {
  const text = toTrimmedString(value);
  if (!/^[A-Za-z0-9_-]+$/.test(text)) {
    throw new Error('Invalid encrypted session secrets encoding.');
  }
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const buildAad = (slug) => [
  'ce-session-secrets',
  `v${SESSION_SECRETS_ENVELOPE_VERSION}`,
  sessionSlugStorageKey(slug),
  SESSION_SECRETS_ENVELOPE_KEY_REF,
].join(':');

const resolveKek = (env = {}, previous = false, deps = {}) => {
  if (typeof deps.getSessionSecretsKek === 'function') {
    return deps.getSessionSecretsKek({
      name: previous ? SESSION_SECRETS_PREVIOUS_KEK_NAME : SESSION_SECRETS_CURRENT_KEK_NAME,
      previous,
    });
  }
  return previous
    ? env?.[SESSION_SECRETS_PREVIOUS_KEK_NAME]
    : env?.[SESSION_SECRETS_CURRENT_KEK_NAME];
};

const importKek = async (secret, usages, deps = {}) => {
  const material = toTrimmedString(secret);
  if (!material) throw new Error(`${SESSION_SECRETS_CURRENT_KEK_NAME} is missing.`);
  const cryptoImpl = getCryptoImpl(deps);
  const digest = await cryptoImpl.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${KEY_DERIVATION_DOMAIN}\0${material}`),
  );
  return cryptoImpl.subtle.importKey('raw', digest, { name: AES_GCM }, false, usages);
};

export const isSessionSecretsEnvelope = (value) => (
  isRecord(value) &&
  Number(value.v || 0) === SESSION_SECRETS_ENVELOPE_VERSION &&
  value.kind === SESSION_SECRETS_ENVELOPE_KIND
);

export const isEncryptedSessionSecretsEnvelope = (value) => (
  isSessionSecretsEnvelope(value) &&
  value.cipher === SESSION_SECRETS_ENVELOPE_CIPHER &&
  value.keyRef === SESSION_SECRETS_ENVELOPE_KEY_REF &&
  typeof value.aad === 'string' &&
  typeof value.iv === 'string' &&
  typeof value.encryptedSecrets === 'string'
);

const hasEncryptedSessionSecretsFields = (value) => (
  isRecord(value) &&
  ['cipher', 'keyRef', 'aad', 'iv', 'encryptedSecrets']
    .some((field) => Object.prototype.hasOwnProperty.call(value, field))
);

export const unwrapSessionSecretsEnvelope = (value) => {
  if (!isRecord(value)) return null;
  if (
    hasEncryptedSessionSecretsFields(value) &&
    (
      value.kind === SESSION_SECRETS_ENVELOPE_KIND ||
      Object.prototype.hasOwnProperty.call(value, 'v') ||
      Object.prototype.hasOwnProperty.call(value, 'version')
    )
  ) {
    throw new Error('Invalid or encrypted session secrets require authenticated decryption.');
  }
  if (isSessionSecretsEnvelope(value)) {
    return cloneRecord(value.secrets);
  }
  if (Number(value.version || 0) === SESSION_SECRETS_ENVELOPE_VERSION && isRecord(value.secrets)) {
    return cloneRecord(value.secrets);
  }
  return cloneRecord(value);
};

export const buildEncryptedSessionSecretsEnvelope = async (
  secrets,
  {
    env = {},
    slug = '',
    now,
    previousEnvelope,
    ...deps
  } = {},
) => {
  const nowMs = normalizeTimestampMs(typeof now === 'function' ? now() : Date.now()) || Date.now();
  const previousCreatedAt = isSessionSecretsEnvelope(previousEnvelope)
    ? normalizeTimestampMs(previousEnvelope.createdAt)
    : 0;
  const aad = buildAad(slug);
  const iv = randomBytes(12, deps);
  const key = await importKek(resolveKek(env, false, deps), ['encrypt'], deps);
  const ciphertext = await getCryptoImpl(deps).subtle.encrypt(
    {
      name: AES_GCM,
      iv,
      additionalData: textEncoder.encode(aad),
    },
    key,
    textEncoder.encode(JSON.stringify(cloneRecord(secrets))),
  );
  return {
    v: SESSION_SECRETS_ENVELOPE_VERSION,
    kind: SESSION_SECRETS_ENVELOPE_KIND,
    createdAt: previousCreatedAt || nowMs,
    updatedAt: nowMs,
    cipher: SESSION_SECRETS_ENVELOPE_CIPHER,
    keyRef: SESSION_SECRETS_ENVELOPE_KEY_REF,
    aad,
    iv: bytesToBase64url(iv),
    encryptedSecrets: bytesToBase64url(new Uint8Array(ciphertext)),
  };
};

export const decryptSessionSecretsEnvelope = async (
  value,
  { env = {}, slug = '', ...deps } = {},
) => {
  if (!isEncryptedSessionSecretsEnvelope(value)) {
    throw new Error('Invalid encrypted session secrets envelope.');
  }
  const aad = buildAad(slug);
  if (value.aad !== aad) {
    throw new Error('Encrypted session secrets identity mismatch.');
  }
  const iv = base64urlToBytes(value.iv);
  if (iv.length !== 12) throw new Error('Invalid encrypted session secrets IV.');
  const ciphertext = base64urlToBytes(value.encryptedSecrets);
  const attempts = [false, true];
  let attempted = false;
  for (const previous of attempts) {
    const secret = resolveKek(env, previous, deps);
    if (!toTrimmedString(secret)) continue;
    attempted = true;
    try {
      const key = await importKek(secret, ['decrypt'], deps);
      const plaintext = await getCryptoImpl(deps).subtle.decrypt(
        {
          name: AES_GCM,
          iv,
          additionalData: textEncoder.encode(aad),
        },
        key,
        ciphertext,
      );
      const parsed = JSON.parse(textDecoder.decode(plaintext));
      if (!isRecord(parsed)) throw new Error('Decrypted session secrets are invalid.');
      return cloneRecord(parsed);
    } catch {
      // Try the bounded previous-key fallback before failing closed.
    }
  }
  if (!attempted) throw new Error(`${SESSION_SECRETS_CURRENT_KEK_NAME} is missing.`);
  throw new Error('Session secrets decryption failed.');
};
