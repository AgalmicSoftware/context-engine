import {
  removeKeys,
  safeJsonRead,
} from '../cache/storageJson.js';

const LEGACY_CREATE_SBT_FORM_CACHE_KEY = 'createSbtFormCache';
const SCOPED_CREATE_SBT_FORM_CACHE_KEY_PREFIX = 'dg:createSbtFormCache:';

export const CREATE_SBT_FORM_CACHE_LEGACY_POLICY = Object.freeze({
  legacyKey: LEGACY_CREATE_SBT_FORM_CACHE_KEY,
  scopedKeyPrefix: SCOPED_CREATE_SBT_FORM_CACHE_KEY_PREFIX,
  legacyWritesAllowed: false,
  migration: 'read-migrate-clear',
  removeAfter: 'one public release after scoped create-SBT draft writes are verified',
});

const getSessionStorage = (storageIn) => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch (e) {
    void e;
  }
  return null;
};

const removeCacheKey = (storage, key) => {
  if (!storage || !key) return;
  removeKeys(storage, key);
};

export const normalizeCreateSbtFormCacheSessionSlug = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

export const getScopedCreateSbtFormCacheKey = (sessionSlug = '') => (
  `${SCOPED_CREATE_SBT_FORM_CACHE_KEY_PREFIX}${normalizeCreateSbtFormCacheSessionSlug(sessionSlug)}`
);

const hasNonEmptyText = (value) => String(value || '').trim().length > 0;

const hasNonEmptyList = (value) => (
  Array.isArray(value)
    ? value.some((entry) => hasNonEmptyText(entry))
    : false
);

const hasTagDraft = (value) => {
  if (Array.isArray(value)) {
    return value.some((tag) => hasNonEmptyText(tag));
  }
  if (typeof value !== 'string') return false;
  return value.split(',').some((tag) => hasNonEmptyText(tag));
};

const hasMetadataLockDraft = (value) => {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((gateIds) => hasNonEmptyList(gateIds));
};

const hasSubstantiveDistributionDraft = (value) => {
  if (!value || typeof value !== 'object') return false;

  // Ignore persisted defaults like authoring-chain metadata and only count
  // user-entered distribution changes as substantive draft progress.
  return !!(
    value.isLimited ||
    Number(value.limitedNumber || 0) > 0 ||
    value.hasAdmin ||
    value.isRevocable ||
    value.isTimeLimited ||
    hasNonEmptyText(value.mintingEndTime) ||
    value.unlisted ||
    (hasNonEmptyText(value.distributionOption) && value.distributionOption !== 'anyoneCanMint') ||
    (hasNonEmptyText(value.burnAuth) && value.burnAuth !== 'AdminOnly')
  );
};

export const hasMeaningfulCreateSbtFormPayload = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return false;

  const hasName = hasNonEmptyText(parsed.sbtName);
  if (!hasName) return false;

  const hasAdditionalDraftData = (
    hasNonEmptyText(parsed.sbtDescription) ||
    hasNonEmptyText(parsed.sbtImageUrl) ||
    hasNonEmptyText(parsed._imageDataUrl) ||
    hasTagDraft(parsed.tags) ||
    hasNonEmptyText(parsed.documentUrl) ||
    hasNonEmptyList(parsed.documentURLs) ||
    hasNonEmptyText(parsed.documentIDHashes) ||
    hasNonEmptyText(parsed.groupPassword) ||
    hasMetadataLockDraft(parsed.metadataLockGateIds) ||
    hasSubstantiveDistributionDraft(parsed.sbtDistribution)
  );

  return hasAdditionalDraftData;
};

const readCreateSbtFormPayload = ({ storage, key, clearInvalid = false }) => {
  if (!storage || !key) return null;
  const result = safeJsonRead(
    storage,
    key,
    (parsed) => {
      if (parsed && typeof parsed === 'object') return parsed;
      throw new Error('Create SBT form cache payload must be a JSON object.');
    },
    { clearInvalid }
  );
  return result.ok ? result.value : null;
};

const migrateLegacyCreateSbtFormCache = ({ storage, sessionSlug = '' }) => {
  if (!storage) return;
  const scopedKey = getScopedCreateSbtFormCacheKey(sessionSlug);
  try {
    const legacyValue = storage.getItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
    if (!legacyValue || storage.getItem(scopedKey)) return;
    const legacyPayload = readCreateSbtFormPayload({
      storage,
      key: LEGACY_CREATE_SBT_FORM_CACHE_KEY,
    });
    const legacySessionSlug = legacyPayload &&
      Object.prototype.hasOwnProperty.call(legacyPayload, '_sessionSlug')
      ? normalizeCreateSbtFormCacheSessionSlug(legacyPayload._sessionSlug)
      : null;
    if (
      legacySessionSlug !== null &&
      legacySessionSlug !== normalizeCreateSbtFormCacheSessionSlug(sessionSlug)
    ) {
      return;
    }
    storage.setItem(scopedKey, legacyValue);
    storage.removeItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
  } catch (e) {
    void e;
  }
};

export const hasCachedCreateSbtForm = ({
  sessionSlug,
  storage,
  migrateLegacyToSessionKey = false,
  clearInvalid = false,
} = {}) => {
  const sessionStorageRef = getSessionStorage(storage);
  if (!sessionStorageRef) return false;

  if (sessionSlug !== undefined) {
    if (migrateLegacyToSessionKey) {
      migrateLegacyCreateSbtFormCache({ storage: sessionStorageRef, sessionSlug });
    }
    const scopedPayload = readCreateSbtFormPayload({
      storage: sessionStorageRef,
      key: getScopedCreateSbtFormCacheKey(sessionSlug),
      clearInvalid,
    });
    return hasMeaningfulCreateSbtFormPayload(scopedPayload);
  }

  const legacyPayload = readCreateSbtFormPayload({
    storage: sessionStorageRef,
    key: LEGACY_CREATE_SBT_FORM_CACHE_KEY,
    clearInvalid,
  });
  return hasMeaningfulCreateSbtFormPayload(legacyPayload);
};

export { LEGACY_CREATE_SBT_FORM_CACHE_KEY };
