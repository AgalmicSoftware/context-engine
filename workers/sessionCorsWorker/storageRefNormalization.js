const STORAGE_BACKENDS = Object.freeze({
  ARWEAVE: 'arweave',
  LIT_ARWEAVE: 'lit-arweave',
  CLOUDFLARE: 'cloudflare',
});

const CLOUDFLARE_REF_ID_RE = /^[a-z0-9][a-z0-9._:-]{5,160}$/i;
const CLOUDFLARE_REF_FORBIDDEN_RE = /(r2:\/\/|d1:\/\/|kv:\/\/|bucket|account|token|secret|private|\/|\\|https?:\/\/)/i;

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value) => toStr(value).trim();

export { STORAGE_BACKENDS };

export const normalizeStorageBackend = (value, fallback = STORAGE_BACKENDS.ARWEAVE) => {
  const raw = trim(value).toLowerCase();
  if (raw === STORAGE_BACKENDS.CLOUDFLARE || raw === 'cf' || raw === 'r2') return STORAGE_BACKENDS.CLOUDFLARE;
  if (raw === STORAGE_BACKENDS.LIT_ARWEAVE || raw === 'lit' || raw === 'lit_arweave' || raw === 'encrypted-arweave') {
    return STORAGE_BACKENDS.LIT_ARWEAVE;
  }
  if (raw === STORAGE_BACKENDS.ARWEAVE || raw === 'ar') return STORAGE_BACKENDS.ARWEAVE;
  return normalizeStorageBackend(fallback, STORAGE_BACKENDS.ARWEAVE);
};

export const isArweaveStorageBackend = (value) => {
  const backend = normalizeStorageBackend(value);
  return backend === STORAGE_BACKENDS.ARWEAVE || backend === STORAGE_BACKENDS.LIT_ARWEAVE;
};

export const isSafeCloudflareStorageRefId = (value) => {
  const id = trim(value);
  return !!id && CLOUDFLARE_REF_ID_RE.test(id) && !CLOUDFLARE_REF_FORBIDDEN_RE.test(id);
};

export const assertNoCloudflarePrivateMaterial = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  if (/(r2:\/\/|d1:\/\/|kv:\/\/|bucket[-_\s]?name|account[-_\s]?id|api[-_\s]?token|worker[-_\s]?token|secret|private[-_\s]?key)/i.test(text)) {
    throw new Error('Cloudflare storage references must not expose private storage identifiers or credentials.');
  }
  return true;
};

const normalizeCloudflareStorageUri = (id) => `/storage/read?id=${encodeURIComponent(id)}`;

export const normalizeStorageRef = (input = {}, opts = {}) => {
  const raw = isObj(input) ? input : {};
  const backend = normalizeStorageBackend(raw.backend || raw.storage, opts.fallbackBackend);
  const id = trim(raw.id || raw.txId || raw.arweaveTxId);
  if (!id) return null;
  if (backend === STORAGE_BACKENDS.CLOUDFLARE && !isSafeCloudflareStorageRefId(id)) return null;
  const ref = { backend, id };
  if (backend === STORAGE_BACKENDS.CLOUDFLARE) {
    ref.uri = normalizeCloudflareStorageUri(id);
  } else {
    ref.uri = backend === STORAGE_BACKENDS.LIT_ARWEAVE ? `lit-arweave://${id}` : `ar://${id}`;
  }
  const contentType = trim(raw.contentType || raw.mime || raw.type);
  if (contentType) ref.contentType = contentType;
  if (backend === STORAGE_BACKENDS.LIT_ARWEAVE || raw.encrypted === true || raw.payloadEncrypted === true) ref.encrypted = true;
  const gate = trim(raw.gate || raw.gateResource || raw.resourceGate);
  if (gate) ref.gate = gate;
  const resource = trim(raw.resource || opts.resource);
  if (resource) ref.resource = resource;
  const createdAt = trim(raw.createdAt);
  if (createdAt) ref.createdAt = createdAt;
  if (backend === STORAGE_BACKENDS.CLOUDFLARE) assertNoCloudflarePrivateMaterial(ref);
  return ref;
};
