import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { toStr } from './stringCoercion.js';

// Questions and surveys are addressed by an id inside their payload, and many
// uploads can share one id. These helpers decide which upload is the real one.
export const OWNED_STORAGE_RESOURCES = Object.freeze(['questions', 'surveys']);

const trim = (value) => toStr(value).trim();
const lower = (value) => trim(value).toLowerCase();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const isOwnedStorageResource = (resource) => OWNED_STORAGE_RESOURCES.includes(trim(resource));

const recordKey = (kind, { slug, resource, resourceId = '' }) => (
  `ce-storage-${kind}:${sessionSlugStorageKey(slug)}:${trim(resource)}:${lower(resourceId)}`
);

const readJsonRecord = async (index, key) => {
  const raw = await index.get(key);
  if (raw == null || raw === '') return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return isObj(value) ? value : null;
  } catch {
    return null;
  }
};

// Owner of ids stored before first-writer records existed. Their author was
// never recorded, so only a session admin may upload them again.
export const LEGACY_STORAGE_OWNER = 'legacy-admin-only';

// First-writer index: who first uploaded each id. KV is eventually consistent,
// so this is an early 409 for later uploads; readers still pick the canonical
// version from per-upload metadata with selectCanonicalStorageVersions.
export const readStorageResourceOwner = ({ index, slug, resource, resourceId }) => (
  readJsonRecord(index, recordKey('owner', { slug, resource, resourceId }))
);

export const writeStorageResourceOwner = ({ index, slug, resource, resourceId, uploader, storageRefId, createdAt }) => (
  index.put(recordKey('owner', { slug, resource, resourceId }), JSON.stringify({
    version: 1,
    resource: trim(resource),
    resourceId: lower(resourceId),
    uploader: lower(uploader),
    storageRefId: trim(storageRefId),
    createdAt: trim(createdAt),
  }))
);

export const isStorageResourceHidden = async ({ index, slug, resource, resourceId }) => (
  (await readJsonRecord(index, recordKey('hidden', { slug, resource, resourceId })))?.hidden === true
);

export const writeStorageResourceHidden = ({ index, slug, resource, resourceId, hidden, actor, updatedAt }) => {
  const key = recordKey('hidden', { slug, resource, resourceId });
  if (!hidden) return index.delete(key);
  return index.put(key, JSON.stringify({
    version: 1,
    hidden: true,
    resource: trim(resource),
    resourceId: lower(resourceId),
    updatedBy: lower(actor),
    updatedAt: trim(updatedAt),
  }));
};

export const listHiddenStorageResourceIds = async ({ index, slug, resource, budget }) => {
  const prefix = recordKey('hidden', { slug, resource });
  const ids = new Set();
  let cursor = '';
  const seenCursors = new Set();
  do {
    budget?.operation();
    const listed = await index.list({ prefix, ...(cursor ? { cursor } : {}), ...(budget ? { limit: 100 } : {}) });
    (Array.isArray(listed?.keys) ? listed.keys : []).forEach((entry) => {
      budget?.rows();
      if (budget) budget.metadata(entry);
      const id = trim(entry?.name || entry).slice(prefix.length);
      if (id) ids.add(id);
    });
    cursor = listed?.list_complete === false ? trim(listed?.cursor) : '';
    if (listed?.list_complete === false && (!cursor || seenCursors.has(cursor))) throw new Error('Cloudflare hidden-resource cursor is unavailable or did not advance.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return ids;
};

export { isAdminStorageVersion, isPreferredStorageVersion, selectCanonicalStorageVersions } from '../../shared/storage/canonicalStorageVersions.mjs';
