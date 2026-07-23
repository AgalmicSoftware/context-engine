import { removeKeys, safeJsonRead } from '../cache/storageJson.js';

const LEGACY_CREATE_SBT_FORM_CACHE_KEY = 'createSbtFormCache';
const SCOPED_CREATE_SBT_FORM_CACHE_KEY_PREFIX = 'dg:createSbtFormCache:';

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type CreateSbtDraftPayload = Record<string, unknown>;
const CREATE_SBT_CREDENTIAL_FIELDS = Object.freeze([
  'claimCode',
  'claimCodes',
  'groupPassword',
  'groupPasswordInput',
  'invite',
  'inviteCode',
  'inviteCodes',
  'inviteNonce',
  'inviteNonces',
  'invitePayload',
  'invitePayloads',
  'inviteLinks',
  'manualPasswordInput',
  'mintPassword',
  'password',
  'passwordList',
  'sbtCodes',
  'sbtInviteLinks',
]);
const CREATE_SBT_CREDENTIAL_FIELD_SET = new Set(CREATE_SBT_CREDENTIAL_FIELDS.map((field) => field.toLowerCase()));

export const CREATE_SBT_FORM_CACHE_LEGACY_POLICY = Object.freeze({
  legacyKey: LEGACY_CREATE_SBT_FORM_CACHE_KEY,
  scopedKeyPrefix: SCOPED_CREATE_SBT_FORM_CACHE_KEY_PREFIX,
  legacyWritesAllowed: false,
  migration: 'read-migrate-clear',
  removeAfter: 'one public release after scoped create-SBT draft writes are verified',
});

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const sanitizeCreateSbtFormCacheValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeCreateSbtFormCacheValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([field]) => !CREATE_SBT_CREDENTIAL_FIELD_SET.has(field.toLowerCase()))
      .map(([field, nestedValue]) => [field, sanitizeCreateSbtFormCacheValue(nestedValue)]),
  );
};

export const sanitizeCreateSbtFormCachePayload = (value: unknown): CreateSbtDraftPayload | null => {
  if (!isRecord(value) || Array.isArray(value)) return null;
  return sanitizeCreateSbtFormCacheValue(value) as CreateSbtDraftPayload;
};

const getSessionStorage = (storageIn?: StorageLike | null): StorageLike | null => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch (e) {
    void e;
  }
  return null;
};

const removeCacheKey = (storage: StorageLike | null, key: string) => {
  if (!storage || !key) return;
  removeKeys(storage, key);
};

export const normalizeCreateSbtFormCacheSessionSlug = (value: unknown = ''): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

export const getScopedCreateSbtFormCacheKey = (sessionSlug = ''): string =>
  `${SCOPED_CREATE_SBT_FORM_CACHE_KEY_PREFIX}${normalizeCreateSbtFormCacheSessionSlug(sessionSlug)}`;

const hasNonEmptyText = (value: unknown): boolean => String(value || '').trim().length > 0;

const hasNonEmptyList = (value: unknown): boolean =>
  Array.isArray(value) ? value.some((entry) => hasNonEmptyText(entry)) : false;

const hasTagDraft = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some((tag) => hasNonEmptyText(tag));
  }
  if (typeof value !== 'string') return false;
  return value.split(',').some((tag) => hasNonEmptyText(tag));
};

const hasMetadataLockDraft = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return Object.values(value).some((gateIds) => hasNonEmptyList(gateIds));
};

const hasSubstantiveDistributionDraft = (value: unknown): boolean => {
  if (!isRecord(value)) return false;

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

export const hasMeaningfulCreateSbtFormPayload = (parsed: unknown): boolean => {
  if (!isRecord(parsed)) return false;

  const hasName = hasNonEmptyText(parsed.sbtName);
  if (!hasName) return false;

  const hasAdditionalDraftData =
    hasNonEmptyText(parsed.sbtDescription) ||
    hasNonEmptyText(parsed.sbtImageUrl) ||
    hasNonEmptyText(parsed._imageDataUrl) ||
    hasTagDraft(parsed.tags) ||
    hasNonEmptyText(parsed.documentUrl) ||
    hasNonEmptyList(parsed.documentURLs) ||
    hasNonEmptyText(parsed.documentIDHashes) ||
    hasMetadataLockDraft(parsed.metadataLockGateIds) ||
    hasSubstantiveDistributionDraft(parsed.sbtDistribution);

  return hasAdditionalDraftData;
};

const readCreateSbtFormPayload = ({
  storage,
  key,
  clearInvalid = false,
}: {
  storage: StorageLike | null;
  key: string;
  clearInvalid?: boolean;
}): CreateSbtDraftPayload | null => {
  if (!storage || !key) return null;
  const result = safeJsonRead<CreateSbtDraftPayload>(
    storage,
    key,
    (parsed) => {
      if (isRecord(parsed)) return parsed;
      throw new Error('Create SBT form cache payload must be a JSON object.');
    },
    { clearInvalid },
  );
  if (!result.ok) return null;
  const safePayload = sanitizeCreateSbtFormCachePayload(result.value);
  if (!safePayload) return null;
  try {
    const safeJson = JSON.stringify(safePayload);
    if (storage.getItem(key) !== safeJson) storage.setItem(key, safeJson);
  } catch (_) {}
  return safePayload;
};

const migrateLegacyCreateSbtFormCache = ({
  storage,
  sessionSlug = '',
}: {
  storage: StorageLike | null;
  sessionSlug?: string;
}) => {
  if (!storage) return;
  const scopedKey = getScopedCreateSbtFormCacheKey(sessionSlug);
  try {
    const legacyValue = storage.getItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
    if (!legacyValue || storage.getItem(scopedKey)) return;
    const legacyPayload = readCreateSbtFormPayload({
      storage,
      key: LEGACY_CREATE_SBT_FORM_CACHE_KEY,
    });
    const legacySessionSlug =
      legacyPayload && Object.prototype.hasOwnProperty.call(legacyPayload, '_sessionSlug')
        ? normalizeCreateSbtFormCacheSessionSlug(legacyPayload._sessionSlug)
        : null;
    if (legacySessionSlug !== null && legacySessionSlug !== normalizeCreateSbtFormCacheSessionSlug(sessionSlug)) {
      return;
    }
    storage.setItem(scopedKey, JSON.stringify(legacyPayload));
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
}: {
  sessionSlug?: string;
  storage?: StorageLike | null;
  migrateLegacyToSessionKey?: boolean;
  clearInvalid?: boolean;
} = {}): boolean => {
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
