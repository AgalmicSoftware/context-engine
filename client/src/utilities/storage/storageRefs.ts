/** @file storageRefs.ts */

import { toStr } from '../shared/primitives.js';

export const STORAGE_BACKENDS = Object.freeze({
  ARWEAVE: 'arweave',
  LIT_ARWEAVE: 'lit-arweave',
  CLOUDFLARE: 'cloudflare',
} as const);

export const STORAGE_RESOURCE_KEYS = Object.freeze({
  DOCS_CONTEXT: 'docsContext',
  QUESTIONS: 'questions',
  SURVEYS: 'surveys',
  RESPONSES: 'responses',
  GENERATED: 'generatedArtifacts',
  MEDIA: 'media',
} as const);

export type StorageBackend = (typeof STORAGE_BACKENDS)[keyof typeof STORAGE_BACKENDS];

type UnknownRecord = Record<string, unknown>;

export interface StorageRef extends UnknownRecord {
  backend: StorageBackend;
  id: string;
  uri?: string;
  contentType?: string;
  encrypted?: true;
  gate?: string;
  resource?: string;
  createdAt?: string;
}

interface NormalizeStorageRefOptions extends UnknownRecord {
  fallbackBackend?: unknown;
  legacyArweaveTxId?: unknown;
  encrypted?: unknown;
  resource?: unknown;
}

interface LegacyStorageRefOptions extends NormalizeStorageRefOptions {
  backend?: unknown;
  contentType?: unknown;
  gate?: unknown;
}

const ARWEAVE_TX_ID_RE = /^[a-z0-9_-]{43}$/i;
const CLOUDFLARE_REF_ID_RE = /^[a-z0-9][a-z0-9._:-]{5,160}$/i;
const CLOUDFLARE_REF_FORBIDDEN_RE = /(r2:\/\/|d1:\/\/|kv:\/\/|\/|\\|https?:\/\/)/i;

const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);

const trim = (value: unknown): string => toStr(value).trim();

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {'arweave' | 'lit-arweave' | 'cloudflare'}
 */
export const normalizeStorageBackend = (
  value: unknown,
  fallback: unknown = STORAGE_BACKENDS.ARWEAVE,
): StorageBackend => {
  const raw = trim(value).toLowerCase();
  if (raw === STORAGE_BACKENDS.CLOUDFLARE || raw === 'cf' || raw === 'r2') {
    return STORAGE_BACKENDS.CLOUDFLARE;
  }
  if (
    raw === STORAGE_BACKENDS.LIT_ARWEAVE ||
    raw === 'lit' ||
    raw === 'lit_arweave' ||
    raw === 'encrypted-arweave' ||
    raw === 'encrypted_arweave'
  ) {
    return STORAGE_BACKENDS.LIT_ARWEAVE;
  }
  if (raw === STORAGE_BACKENDS.ARWEAVE || raw === 'ar') {
    return STORAGE_BACKENDS.ARWEAVE;
  }
  return normalizeStorageBackend(fallback, STORAGE_BACKENDS.ARWEAVE);
};

export const isArweaveStorageBackend = (value: unknown): boolean => {
  const backend = normalizeStorageBackend(value);
  return backend === STORAGE_BACKENDS.ARWEAVE || backend === STORAGE_BACKENDS.LIT_ARWEAVE;
};

export const isCloudflareStorageBackend = (value: unknown): boolean =>
  normalizeStorageBackend(value) === STORAGE_BACKENDS.CLOUDFLARE;

export const isArweaveTxId = (value: unknown): boolean => ARWEAVE_TX_ID_RE.test(trim(value));

export const isSafeCloudflareStorageRefId = (value: unknown): boolean => {
  const id = trim(value);
  return !!id && CLOUDFLARE_REF_ID_RE.test(id) && !CLOUDFLARE_REF_FORBIDDEN_RE.test(id);
};

const normalizeCreatedAt = (value: unknown): string => {
  const raw = trim(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

const normalizeCloudflareStorageUri = (value: unknown, id: string): string => {
  const raw = trim(value);
  if (!raw) return id ? `/storage/read?id=${encodeURIComponent(id)}` : '';
  if (/^\/storage\/read(?:\?|$)/.test(raw)) return raw;
  return id ? `/storage/read?id=${encodeURIComponent(id)}` : '';
};

const normalizeArweaveStorageUri = (backend: StorageBackend, value: unknown, id: string): string => {
  const raw = trim(value);
  if (raw && /^(ar|arweave|https?):\/\//i.test(raw)) return raw;
  if (!id) return '';
  return backend === STORAGE_BACKENDS.LIT_ARWEAVE ? `lit-arweave://${id}` : `ar://${id}`;
};

export const normalizeStorageRef = (
  input: unknown,
  {
    fallbackBackend = STORAGE_BACKENDS.ARWEAVE,
    legacyArweaveTxId = '',
    encrypted = undefined,
    resource = '',
  }: NormalizeStorageRefOptions = {},
): StorageRef | null => {
  const raw = isObj(input) ? input : trim(input) ? { id: trim(input) } : {};
  const backend = normalizeStorageBackend(raw.backend || raw.storage || raw.profile, fallbackBackend);
  const legacyTxId = trim(raw.arweaveTxId || raw.txId || legacyArweaveTxId);
  const rawId = trim(raw.id || raw.key || legacyTxId);

  let id = rawId;
  if (backend === STORAGE_BACKENDS.CLOUDFLARE) {
    id = isSafeCloudflareStorageRefId(rawId) ? rawId : '';
  } else if (!id && legacyTxId) {
    id = legacyTxId;
  }

  if (!id) return null;

  const next: StorageRef = {
    backend,
    id,
  };

  const uri =
    backend === STORAGE_BACKENDS.CLOUDFLARE
      ? normalizeCloudflareStorageUri(raw.uri || raw.url, id)
      : normalizeArweaveStorageUri(backend, raw.uri || raw.url, id);
  if (uri) next.uri = uri;

  const contentType = trim(raw.contentType || raw.mime || raw.type);
  if (contentType) next.contentType = contentType;

  const isEncrypted =
    encrypted === undefined
      ? backend === STORAGE_BACKENDS.LIT_ARWEAVE || raw.encrypted === true || raw.payloadEncrypted === true
      : encrypted === true;
  if (isEncrypted) next.encrypted = true;

  const gate = trim(raw.gate || raw.gateResource || raw.resourceGate);
  if (gate) next.gate = gate;

  const normalizedResource = trim(raw.resource || resource);
  if (normalizedResource) next.resource = normalizedResource;

  const createdAt = normalizeCreatedAt(raw.createdAt);
  if (createdAt) next.createdAt = createdAt;

  return next;
};

export const deriveStorageRefFromLegacyArweaveTxId = (
  arweaveTxId: unknown,
  opts: LegacyStorageRefOptions = {},
): StorageRef | null => {
  const txId = trim(arweaveTxId);
  if (!txId) return null;
  return normalizeStorageRef(
    {
      backend: opts.backend || (opts.encrypted ? STORAGE_BACKENDS.LIT_ARWEAVE : STORAGE_BACKENDS.ARWEAVE),
      id: txId,
      contentType: opts.contentType,
      gate: opts.gate,
      resource: opts.resource,
    },
    opts,
  );
};

export const resolvePayloadStorageRef = (record: unknown, opts: LegacyStorageRefOptions = {}): StorageRef | null => {
  const raw = isObj(record) ? record : {};
  const isEncrypted = opts.encrypted ?? raw.encrypted ?? raw.payloadEncrypted;
  const fallbackBackend =
    opts.fallbackBackend || (isEncrypted ? STORAGE_BACKENDS.LIT_ARWEAVE : STORAGE_BACKENDS.ARWEAVE);
  // Regression guard: storageRef is the canonical read path; legacy Arweave ids
  // are fallback-only and must not override Cloudflare refs.
  const ref = raw.storageRef
    ? normalizeStorageRef(raw.storageRef, {
        ...opts,
        fallbackBackend,
        legacyArweaveTxId: raw.arweaveTxId || raw.txId,
        encrypted: isEncrypted,
      })
    : null;
  if (ref) return ref;
  return deriveStorageRefFromLegacyArweaveTxId(raw.arweaveTxId || raw.txId, {
    ...opts,
    contentType: raw.contentType || raw.mime || opts.contentType,
    encrypted: isEncrypted,
    backend: raw.backend || raw.storage || raw.profile || opts.backend,
    gate: raw.gate || raw.gateResource || raw.resourceGate || opts.gate,
    resource: raw.resource || opts.resource,
  });
};

export const getLegacyArweaveTxId = (record: unknown, opts: NormalizeStorageRefOptions = {}): string => {
  if (!isObj(record)) return trim(record);
  const storageRef = record.storageRef
    ? normalizeStorageRef(record.storageRef, {
        ...opts,
        legacyArweaveTxId: record.arweaveTxId || record.txId || opts.legacyArweaveTxId,
      })
    : null;
  if (storageRef) {
    return isArweaveStorageBackend(storageRef.backend) ? storageRef.id : '';
  }
  return trim(record.arweaveTxId || record.txId || opts.legacyArweaveTxId);
};

export const attachStorageRefCompatibilityFields = (
  record: unknown,
  opts: LegacyStorageRefOptions = {},
): UnknownRecord => {
  const source = isObj(record) ? { ...record } : {};
  const storageRef = resolvePayloadStorageRef(source, opts);
  if (!storageRef) return source;
  source.storageRef = storageRef;
  const arweaveTxId = getLegacyArweaveTxId(source, opts);
  if (arweaveTxId && isArweaveStorageBackend(storageRef.backend)) {
    source.arweaveTxId = arweaveTxId;
  }
  return source;
};

export const storageRefFromLegacyArweaveTxId = deriveStorageRefFromLegacyArweaveTxId;
export const normalizeStorageRefForRecord = resolvePayloadStorageRef;
export const withStorageRefCompatibility = attachStorageRefCompatibilityFields;

export const assertNoCloudflarePrivateMaterial = (value: unknown): true => {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  if (
    /(r2:\/\/|d1:\/\/|kv:\/\/|bucket[-_\s]?name|account[-_\s]?id|api[-_\s]?token|worker[-_\s]?token|secret|private[-_\s]?key)/i.test(
      text as string,
    )
  ) {
    throw new Error('Cloudflare storage references must not expose private storage identifiers or credentials.');
  }
  return true;
};
