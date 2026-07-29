import bufferModule from 'buffer/';
import { cryptoUtils } from '../crypto/cryptography.js';
import { toStr } from '../shared/primitives.js';
import { buildPublicRoute } from '../ui/publicUrl.js';
import { arweaveClient } from './arweaveClient.js';

type LooseRecord = Record<string, any>;

export const SPONSORED_BUNDLE_TYPE = 'contextengine-sponsored-bundle';
export const SPONSORED_BUNDLE_VERSION = 1;
export const SPONSORED_BUNDLE_CIPHER = 'password-aes-gcm';
export const SPONSORED_BUNDLE_SECRET_BYTES = 32;
export const SPONSORED_BUNDLE_SUPPORTED_FIELDS = Object.freeze([
  'openaiKey',
  'anthropicKey',
  'openrouterKey',
  'arweaveJwk',
  'faucetPrivateKey',
  'customRpcUrl',
  'litApiBase',
  'litGroupId',
  'litPkpId',
  'litActionCid',
  'litAccountApiKey',
  'litUsageApiKey',
  'bootstrapWorkerUrl',
  'deployGrantToken',
  'faucetGrantToken',
]);

const isObj = (value: unknown): value is LooseRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const Buffer = bufferModule?.Buffer || bufferModule;
const base64UrlEncode = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const getDefaultSponsoredSessionPath = () => buildPublicRoute('/new');

const createSponsoredBundleError = (code: string, message: string) => {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
};

export const generateSponsoredBundleSecret = (byteLength = SPONSORED_BUNDLE_SECRET_BYTES): string => {
  const resolvedByteLength = Number(byteLength || 0) || SPONSORED_BUNDLE_SECRET_BYTES;
  const runtimeGlobal = globalThis as any;
  const runtimeWindow = typeof window !== 'undefined' ? (window as any) : null;
  const cryptoApi =
    (typeof globalThis !== 'undefined' && runtimeGlobal?.crypto?.getRandomValues ? runtimeGlobal.crypto : null) ||
    (runtimeWindow?.crypto?.getRandomValues ? runtimeWindow.crypto : null);
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generator unavailable.');
  }
  const bytes = new Uint8Array(resolvedByteLength);
  cryptoApi.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

export const normalizeSponsoredBundlePayload = (raw: unknown) => {
  const payload = isObj(raw) ? raw : {};
  const next: LooseRecord = {};
  SPONSORED_BUNDLE_SUPPORTED_FIELDS.forEach((key) => {
    next[key] = toStr(payload[key] || '').trim();
  });
  const meta = isObj(payload.meta) ? payload.meta : {};
  next.meta = {
    label: toStr(meta.label || '').trim(),
    createdAt: toStr(meta.createdAt || '').trim(),
    createdBy: toStr(meta.createdBy || '').trim(),
    expiresAt: toStr(meta.expiresAt || '').trim(),
    sourceSessionSlug: toStr(meta.sourceSessionSlug || '').trim(),
    sourceWorkerUrl: toStr(meta.sourceWorkerUrl || '').trim(),
  };
  return next;
};

export const normalizeSparseSponsoredBundlePayload = (raw: unknown) => {
  const payload = isObj(raw) ? raw : {};
  const next: LooseRecord = {};
  SPONSORED_BUNDLE_SUPPORTED_FIELDS.forEach((key) => {
    const value = toStr(payload[key] || '').trim();
    if (value) next[key] = value;
  });
  const meta = isObj(payload.meta) ? payload.meta : {};
  next.meta = {
    label: toStr(meta.label || '').trim(),
    createdAt: toStr(meta.createdAt || '').trim(),
    createdBy: toStr(meta.createdBy || '').trim(),
    expiresAt: toStr(meta.expiresAt || '').trim(),
    sourceSessionSlug: toStr(meta.sourceSessionSlug || '').trim(),
    sourceWorkerUrl: toStr(meta.sourceWorkerUrl || '').trim(),
  };
  return next;
};

export const hasSponsoredBundleFields = (bundle: LooseRecord = {}): boolean =>
  SPONSORED_BUNDLE_SUPPORTED_FIELDS.some((key) => {
    if (key === 'bootstrapWorkerUrl') {
      return false;
    }
    return !!toStr(bundle?.[key] || '').trim();
  });

export const buildSponsoredBundlePlaintext = ({
  openaiKey = '',
  anthropicKey = '',
  openrouterKey = '',
  arweaveJwk = '',
  faucetPrivateKey = '',
  customRpcUrl = '',
  litApiBase = '',
  litGroupId = '',
  litPkpId = '',
  litActionCid = '',
  litAccountApiKey = '',
  litUsageApiKey = '',
  bootstrapWorkerUrl = '',
  deployGrantToken = '',
  faucetGrantToken = '',
  meta = {},
}: {
  openaiKey?: unknown;
  anthropicKey?: unknown;
  openrouterKey?: unknown;
  arweaveJwk?: unknown;
  faucetPrivateKey?: unknown;
  customRpcUrl?: unknown;
  litApiBase?: unknown;
  litGroupId?: unknown;
  litPkpId?: unknown;
  litActionCid?: unknown;
  litAccountApiKey?: unknown;
  litUsageApiKey?: unknown;
  bootstrapWorkerUrl?: unknown;
  deployGrantToken?: unknown;
  faucetGrantToken?: unknown;
  meta?: LooseRecord;
} = {}) => {
  return normalizeSparseSponsoredBundlePayload({
    openaiKey,
    anthropicKey,
    openrouterKey,
    arweaveJwk,
    faucetPrivateKey,
    // `customRpcKey` is intentionally unsupported in sponsored bundles for now.
    customRpcUrl,
    ...(toStr(litApiBase).trim() ? { litApiBase } : {}),
    ...(toStr(litGroupId).trim() ? { litGroupId } : {}),
    ...(toStr(litPkpId).trim() ? { litPkpId } : {}),
    ...(toStr(litActionCid).trim() ? { litActionCid } : {}),
    ...(toStr(litAccountApiKey).trim() ? { litAccountApiKey } : {}),
    ...(toStr(litUsageApiKey).trim() ? { litUsageApiKey } : {}),
    bootstrapWorkerUrl,
    deployGrantToken,
    faucetGrantToken,
    meta,
  });
};

export const buildSponsoredBundleEnvelope = ({ encryptedData }: { encryptedData?: unknown } = {}) => {
  const encrypted = toStr(encryptedData || '').trim();
  if (!encrypted) {
    throw createSponsoredBundleError('invalid_bundle', 'Sponsored bundle is missing encrypted data.');
  }
  return {
    type: SPONSORED_BUNDLE_TYPE,
    version: SPONSORED_BUNDLE_VERSION,
    cipher: SPONSORED_BUNDLE_CIPHER,
    encryptedData: encrypted,
  };
};

export const parseSponsoredBundleEnvelope = (rawEnvelope: unknown) => {
  let parsed = rawEnvelope;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (_) {
      throw createSponsoredBundleError('invalid_bundle', 'Sponsored bundle is not valid JSON.');
    }
  }
  if (!isObj(parsed)) {
    throw createSponsoredBundleError('invalid_bundle', 'Sponsored bundle must be an object.');
  }
  if (toStr(parsed.type).trim() !== SPONSORED_BUNDLE_TYPE) {
    throw createSponsoredBundleError('invalid_bundle', 'Sponsored bundle type is invalid.');
  }
  if (Number(parsed.version || 0) !== SPONSORED_BUNDLE_VERSION) {
    throw createSponsoredBundleError('invalid_bundle', 'Sponsored bundle version is invalid.');
  }
  if (toStr(parsed.cipher).trim() !== SPONSORED_BUNDLE_CIPHER) {
    throw createSponsoredBundleError('invalid_bundle', 'Sponsored bundle cipher is invalid.');
  }
  if (!toStr(parsed.encryptedData || '').trim()) {
    throw createSponsoredBundleError('invalid_bundle', 'Sponsored bundle is missing encrypted data.');
  }
  return parsed;
};

export const decryptSponsoredBundleEnvelope = async ({
  envelope,
  secret,
}: {
  envelope?: unknown;
  secret?: unknown;
} = {}) => {
  const parsedEnvelope = parseSponsoredBundleEnvelope(envelope);
  const password = toStr(secret || '').trim();
  if (!password) {
    throw createSponsoredBundleError('malformed_link', 'Sponsored link is missing a decryption key.');
  }
  try {
    const decrypted = await cryptoUtils.decryptWithPassword(parsedEnvelope.encryptedData, password);
    return normalizeSparseSponsoredBundlePayload(decrypted);
  } catch (error: any) {
    throw createSponsoredBundleError('decrypt_failed', error?.message || 'Failed to decrypt sponsored bundle.');
  }
};

export const isSponsoredBundleExpired = (bundle: any, nowMs = Date.now()): boolean => {
  const expiresAt = toStr(bundle?.meta?.expiresAt || '').trim();
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (!Number.isFinite(ts)) return false;
  return ts <= Number(nowMs || 0);
};

export const readSponsoredBundleFromArweave = async ({
  txId,
  secret,
  arweaveOpts = {},
}: {
  txId?: unknown;
  secret?: unknown;
  arweaveOpts?: LooseRecord;
} = {}) => {
  const resolvedTxId = toStr(txId || '').trim();
  if (!resolvedTxId) {
    throw createSponsoredBundleError('malformed_link', 'Sponsored link is missing a bundle id.');
  }
  const raw = await arweaveClient.downloadDataFromArweave(resolvedTxId, arweaveOpts);
  const envelope = parseSponsoredBundleEnvelope(raw);
  const bundle = await decryptSponsoredBundleEnvelope({ envelope, secret });
  if (!hasSponsoredBundleFields(bundle)) {
    throw createSponsoredBundleError('empty_bundle', 'Sponsored bundle has no supported credentials.');
  }
  if (isSponsoredBundleExpired(bundle)) {
    throw createSponsoredBundleError('expired_bundle', 'Sponsored bundle has expired.');
  }
  return {
    txId: resolvedTxId,
    envelope,
    bundle,
  };
};

export const buildSponsoredSessionUrl = ({
  txId,
  origin,
  path = '',
}: {
  txId?: unknown;
  origin?: unknown;
  path?: unknown;
} = {}) => {
  const resolvedTxId = toStr(txId || '').trim();
  if (!resolvedTxId) {
    throw new Error('Sponsored bundle txId is required.');
  }
  const baseOrigin = toStr(
    origin || (typeof window !== 'undefined' && window.location ? window.location.origin : ''),
  ).trim();
  const normalizedPath = toStr(path || getDefaultSponsoredSessionPath()).trim() || getDefaultSponsoredSessionPath();
  const search = `?sponsored=${encodeURIComponent(resolvedTxId)}`;
  return `${baseOrigin}${normalizedPath}${search}`;
};

export const uploadSponsoredBundle = async ({
  secret,
  label,
  expiresAt = '',
  createdAt = new Date().toISOString(),
  createdBy = '',
  arweaveJwk = '',
  workerUrl,
  sessionSlug,
  sessionConfig,
  context,
  adminAuth,
  skipAuth = false,
  bundle = {},
  tags,
}: {
  secret?: unknown;
  label?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
  createdBy?: unknown;
  arweaveJwk?: unknown;
  workerUrl?: unknown;
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  context?: unknown;
  adminAuth?: unknown;
  skipAuth?: boolean;
  bundle?: LooseRecord;
  tags?: unknown;
} = {}) => {
  const password = toStr(secret || '').trim();
  if (!password) throw new Error('Sponsored bundle secret is required.');
  const plaintext = buildSponsoredBundlePlaintext({
    ...bundle,
    meta: {
      ...(bundle?.meta && typeof bundle.meta === 'object' ? bundle.meta : {}),
      label,
      createdAt,
      createdBy,
      expiresAt,
    },
  });
  if (!hasSponsoredBundleFields(plaintext)) {
    throw new Error('Sponsored bundle must include at least one supported credential.');
  }
  const encryptedData = await cryptoUtils.encryptWithPassword(plaintext, password);
  const envelope = buildSponsoredBundleEnvelope({ encryptedData });
  const txId = await arweaveClient.uploadDataToArweave(envelope, 'json', {
    arweaveJwk,
    workerUrl,
    sessionSlug,
    sessionConfig,
    context,
    adminAuth,
    skipAuth,
    tags,
  });
  return {
    txId: toStr(txId || '').trim(),
    envelope,
    url: buildSponsoredSessionUrl({ txId }),
  };
};
