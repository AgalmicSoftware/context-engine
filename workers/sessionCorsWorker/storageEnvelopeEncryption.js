import { getOrCreateCoordinatedStorageEnvelopeSessionKey } from './sessionWriteCoordinator.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const STORAGE_ENVELOPE_KEK_SECRET_NAME = 'CE_STORAGE_ENVELOPE_KEK';
export const STORAGE_ENVELOPE_PREVIOUS_KEK_SECRET_NAME = 'CE_STORAGE_ENVELOPE_PREVIOUS_KEK';
const ENVELOPE_VERSION = 1;
const AES_GCM = 'AES-GCM';
const AES_256_GCM = 'AES-256-GCM';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const trim = (value) => toStr(value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const cloneJson = (value) => JSON.parse(JSON.stringify(value || {}));

const safeSlugPart = (value) => trim(value || 'general').toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'general';

export const bytesToBase64url = (bytes) => {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(source).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  let binary = '';
  source.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const base64urlToBytes = (value) => {
  const text = trim(value);
  if (!text) return new Uint8Array();
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export const toUint8Array = async (value) => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value?.arrayBuffer === 'function') return new Uint8Array(await value.arrayBuffer());
  if (typeof value === 'string') return textEncoder.encode(value);
  return new Uint8Array(value || []);
};

const getCryptoImpl = (deps = {}) => {
  const cryptoImpl = deps.crypto || globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('WebCrypto subtle crypto is required for storage envelope encryption.');
  return cryptoImpl;
};

const randomBytes = (length, deps = {}) => {
  const supplied = typeof deps.randomBytes === 'function' ? deps.randomBytes(length) : null;
  if (supplied && supplied.length >= length) return new Uint8Array(supplied).slice(0, length);
  const bytes = new Uint8Array(length);
  const getRandomValues = typeof deps.getRandomValues === 'function'
    ? deps.getRandomValues
    : getCryptoImpl(deps).getRandomValues?.bind(getCryptoImpl(deps));
  if (typeof getRandomValues !== 'function') {
    throw new Error('Secure randomness is required for storage envelope encryption.');
  }
  getRandomValues(bytes);
  return bytes;
};

const nowIso = (deps = {}) => new Date(deps.now?.() || Date.now()).toISOString();

const importAesKey = async (keyBytes, usages, deps = {}) => (
  getCryptoImpl(deps).subtle.importKey('raw', keyBytes, { name: AES_GCM }, false, usages)
);

const deriveDeploymentKeyBytes = async (secret, deps = {}) => {
  const material = trim(secret);
  if (!material) throw new Error(`${STORAGE_ENVELOPE_KEK_SECRET_NAME} is missing.`);
  const digest = await getCryptoImpl(deps).subtle.digest('SHA-256', textEncoder.encode(material));
  return new Uint8Array(digest);
};

const readDeploymentSecret = ({ env = {}, previous = false, deps = {} } = {}) => {
  if (typeof deps.getStorageEnvelopeKek === 'function') {
    return deps.getStorageEnvelopeKek({
      provider: 'worker_secret',
      name: previous ? STORAGE_ENVELOPE_PREVIOUS_KEK_SECRET_NAME : STORAGE_ENVELOPE_KEK_SECRET_NAME,
      previous,
    });
  }
  return previous
    ? env?.[STORAGE_ENVELOPE_PREVIOUS_KEK_SECRET_NAME]
    : env?.[STORAGE_ENVELOPE_KEK_SECRET_NAME];
};

const importDeploymentKek = async ({ env = {}, previous = false, deps = {} } = {}) => {
  const secret = readDeploymentSecret({ env, previous, deps });
  const keyBytes = await deriveDeploymentKeyBytes(secret, deps);
  return importAesKey(keyBytes, ['encrypt', 'decrypt'], deps);
};

const aesEncrypt = async ({ keyBytes, plaintextBytes, aad = '', deps = {} }) => {
  const iv = randomBytes(12, deps);
  const key = await importAesKey(keyBytes, ['encrypt'], deps);
  const params = { name: AES_GCM, iv };
  if (aad) params.additionalData = textEncoder.encode(aad);
  const ciphertext = await getCryptoImpl(deps).subtle.encrypt(params, key, plaintextBytes);
  return {
    iv: bytesToBase64url(iv),
    ciphertext: new Uint8Array(ciphertext),
  };
};

const aesDecrypt = async ({ keyBytes, iv, ciphertextBytes, aad = '', deps = {} }) => {
  const key = await importAesKey(keyBytes, ['decrypt'], deps);
  const params = { name: AES_GCM, iv: base64urlToBytes(iv) };
  if (aad) params.additionalData = textEncoder.encode(aad);
  const plaintext = await getCryptoImpl(deps).subtle.decrypt(params, key, ciphertextBytes);
  return new Uint8Array(plaintext);
};

const wrapBytesWithKey = async ({ wrappingKey, plaintextBytes, aad = '', deps = {} }) => {
  const iv = randomBytes(12, deps);
  const params = { name: AES_GCM, iv };
  if (aad) params.additionalData = textEncoder.encode(aad);
  const ciphertext = await getCryptoImpl(deps).subtle.encrypt(params, wrappingKey, plaintextBytes);
  return {
    alg: AES_256_GCM,
    wrapAlg: 'AES-GCM-KW-v1',
    iv: bytesToBase64url(iv),
    wrappedKey: bytesToBase64url(new Uint8Array(ciphertext)),
  };
};

const unwrapBytesWithKey = async ({ wrappingKey, wrapped, aad = '', deps = {} }) => {
  if (!isObj(wrapped) || !trim(wrapped.iv) || !trim(wrapped.wrappedKey)) {
    throw new Error('Invalid wrapped storage envelope key.');
  }
  const params = { name: AES_GCM, iv: base64urlToBytes(wrapped.iv) };
  if (aad) params.additionalData = textEncoder.encode(aad);
  const plaintext = await getCryptoImpl(deps).subtle.decrypt(params, wrappingKey, base64urlToBytes(wrapped.wrappedKey));
  return new Uint8Array(plaintext);
};

const readSessionKeyRecord = (config = {}) => {
  const envelope = isObj(config.storageEnvelope) ? config.storageEnvelope : {};
  return isObj(envelope.sessionKey) ? envelope.sessionKey : null;
};

const isCoordinatorWrappedSessionKeyRecord = (record, slug) => {
  if (!isObj(record)) return false;
  const createdAt = trim(record.createdAt);
  const createdAtMs = Date.parse(createdAt);
  return (
    record.version === ENVELOPE_VERSION &&
    record.keyProvider === 'worker_secret' &&
    record.alg === AES_256_GCM &&
    record.wrapAlg === 'AES-GCM-KW-v1' &&
    Number.isFinite(createdAtMs) &&
    new Date(createdAtMs).toISOString() === createdAt &&
    trim(record.keyId) === `session:${safeSlugPart(slug)}:${createdAt}` &&
    /^[A-Za-z0-9_-]{16}$/.test(trim(record.iv)) &&
    /^[A-Za-z0-9_-]{64}$/.test(trim(record.wrappedKey))
  );
};

const unwrapSessionKeyBytes = async ({ env, config, slug, deps = {} }) => {
  const record = readSessionKeyRecord(config);
  if (!record) throw new Error('Storage envelope session key is missing.');
  const aad = `ce-storage-envelope:session:${safeSlugPart(slug)}`;
  const attempts = [false, true];
  let lastError = null;
  for (const previous of attempts) {
    if (previous && !trim(readDeploymentSecret({ env, previous, deps }))) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const deploymentKey = await importDeploymentKek({ env, previous, deps });
      // eslint-disable-next-line no-await-in-loop
      return await unwrapBytesWithKey({ wrappingKey: deploymentKey, wrapped: record, aad, deps });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Storage envelope session key unwrap failed.');
};

export const ensureStorageEnvelopeSessionKey = async ({ env, config, slug, deps = {} }) => {
  const existing = readSessionKeyRecord(config);
  let candidateRecord = existing;
  if (existing && !isCoordinatorWrappedSessionKeyRecord(existing, slug)) {
    // Verify the legacy bytes with the current/fallback KEK, but never rewrap
    // them during an upload. Rewrapping could silently bind the session to a
    // mistaken current secret; only the coordinator metadata is normalized.
    await unwrapSessionKeyBytes({ env, config, slug, deps });
    const createdAt = nowIso(deps);
    candidateRecord = {
      version: ENVELOPE_VERSION,
      keyProvider: 'worker_secret',
      keyId: `session:${safeSlugPart(slug)}:${createdAt}`,
      createdAt,
      alg: AES_256_GCM,
      wrapAlg: 'AES-GCM-KW-v1',
      iv: existing.iv,
      wrappedKey: existing.wrappedKey,
    };
  } else if (!candidateRecord) {
    const keyBytes = randomBytes(32, deps);
    const deploymentKey = await importDeploymentKek({ env, deps });
    const createdAt = nowIso(deps);
    candidateRecord = {
      version: ENVELOPE_VERSION,
      keyProvider: 'worker_secret',
      keyId: `session:${safeSlugPart(slug)}:${createdAt}`,
      createdAt,
      ...await wrapBytesWithKey({
        wrappingKey: deploymentKey,
        plaintextBytes: keyBytes,
        aad: `ce-storage-envelope:session:${safeSlugPart(slug)}`,
        deps,
      }),
    };
  }

  const coordinate = deps.getOrCreateCoordinatedStorageEnvelopeSessionKey ||
    getOrCreateCoordinatedStorageEnvelopeSessionKey;
  const coordinated = await coordinate({
    env,
    slug,
    baseConfig: config,
    candidateRecord,
  });
  const nextConfig = coordinated?.config;
  if (!isObj(nextConfig) || !readSessionKeyRecord(nextConfig)) {
    throw new Error('Session config coordination returned no wrapped session key.');
  }
  return {
    keyBytes: await unwrapSessionKeyBytes({ env, config: nextConfig, slug, deps }),
    config: nextConfig,
    created: !existing && coordinated.created === true,
  };
};

export const encryptPayloadWithStorageEnvelope = async ({
  env,
  config,
  slug,
  payloadId,
  plaintextBytes,
  contentType,
  accessConditions,
  conditionRef,
  deps = {},
}) => {
  const sessionKey = await ensureStorageEnvelopeSessionKey({ env, config, slug, deps });
  const dekBytes = randomBytes(32, deps);
  const aad = `ce-storage-envelope:payload:${safeSlugPart(slug)}:${payloadId}`;
  const encryptedPayload = await aesEncrypt({
    keyBytes: dekBytes,
    plaintextBytes,
    aad,
    deps,
  });
  const sessionWrappingKey = await importAesKey(sessionKey.keyBytes, ['encrypt'], deps);
  const wrappedDek = await wrapBytesWithKey({
    wrappingKey: sessionWrappingKey,
    plaintextBytes: dekBytes,
    aad: `${aad}:dek`,
    deps,
  });

  return {
    ciphertextBytes: encryptedPayload.ciphertext,
    config: sessionKey.config,
    envelope: {
      version: ENVELOPE_VERSION,
      encryption: 'worker_envelope',
      keyProvider: 'worker_secret',
      payloadAlg: AES_256_GCM,
      payloadIv: encryptedPayload.iv,
      dek: {
        version: ENVELOPE_VERSION,
        keyId: `payload:${payloadId}:dek`,
        ...wrappedDek,
      },
      conditionRef: conditionRef || 'gate_fallback',
      ...(isObj(accessConditions) ? { accessConditions: cloneJson(accessConditions) } : {}),
      contentType: trim(contentType) || 'application/octet-stream',
      encryptedAt: nowIso(deps),
    },
  };
};

export const decryptPayloadWithStorageEnvelope = async ({
  env,
  config,
  slug,
  payloadId,
  ciphertextBytes,
  envelope,
  deps = {},
}) => {
  if (!isObj(envelope) || envelope.encryption !== 'worker_envelope') {
    throw new Error('Storage envelope metadata is missing.');
  }
  const sessionKeyBytes = await unwrapSessionKeyBytes({ env, config, slug, deps });
  const sessionWrappingKey = await importAesKey(sessionKeyBytes, ['decrypt'], deps);
  const aad = `ce-storage-envelope:payload:${safeSlugPart(slug)}:${payloadId}`;
  const dekBytes = await unwrapBytesWithKey({
    wrappingKey: sessionWrappingKey,
    wrapped: envelope.dek,
    aad: `${aad}:dek`,
    deps,
  });
  return aesDecrypt({
    keyBytes: dekBytes,
    iv: envelope.payloadIv,
    ciphertextBytes,
    aad,
    deps,
  });
};

const resolveAuditKv = (env = {}) => env.CE_STORAGE_AUDIT_KV || env.CE_STORAGE_INDEX_KV || env.STORAGE_INDEX_KV || env.STORAGE_KV || null;

const auditSuffix = (deps = {}) => {
  if (typeof deps.randomUUID === 'function') return trim(deps.randomUUID());
  try {
    return bytesToBase64url(randomBytes(12, deps));
  } catch {
    return trim(Date.now());
  }
};

export const writeStorageEnvelopeKeyReleaseAudit = async ({
  env = {},
  slug,
  payloadId,
  principal,
  conditionMatched,
  deps = {},
} = {}) => {
  const timestamp = nowIso(deps);
  const entry = {
    version: ENVELOPE_VERSION,
    event: 'storage_envelope_key_release',
    sessionSlug: safeSlugPart(slug),
    payloadId: trim(payloadId),
    principal: trim(principal).toLowerCase() || 'anonymous',
    conditionMatched: isObj(conditionMatched) ? cloneJson(conditionMatched) : conditionMatched || 'gate_fallback',
    timestamp,
  };
  const kv = resolveAuditKv(env);
  if (!kv || typeof kv.put !== 'function') {
    throw new Error('Storage envelope audit store is not configured.');
  }
  await kv.put(
    `ce-storage-audit:${entry.sessionSlug}:${entry.payloadId}:${timestamp}:${auditSuffix(deps)}`,
    JSON.stringify(entry),
  );
  return { ok: true, store: 'kv', entry };
};
