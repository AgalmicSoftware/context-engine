import { toStr } from '../shared/primitives.js';

export type SbtDisplayMetadataRecord = Record<string, unknown> & {
  name?: unknown;
  title?: unknown;
  symbol?: unknown;
  contractName?: unknown;
  description?: unknown;
  encryptedFields?: unknown;
};

export type SbtCacheEntryLike = Record<string, unknown> & {
  sbtAddress?: unknown;
  sbtInfo?: unknown;
  chainID?: unknown;
  chainId?: unknown;
};

export type SbtCacheNameHit = {
  name: string;
  info: unknown;
  netKey: string;
  chainId: number | null;
  entry: unknown;
};

export type SbtMetadataLookupDecision = {
  status: 'missing' | 'unnamed' | 'named';
  hasMetadataRecord: boolean;
  name: string;
  shouldMarkFailure: boolean;
  shouldClearFailure: boolean;
  shouldUseResult: boolean;
};

export const SBT_MASKED_FIELD_VALUE = '[encrypted]';

export const LEGACY_SBT_ENCRYPTED_FIELD_KEYS = Object.freeze({
  name: Object.freeze(['nameEncrypted', 'encryptedName']),
  description: Object.freeze(['descriptionEncrypted', 'encryptedDescription']),
  tags: Object.freeze(['tagsEncrypted', 'encryptedTags']),
  documentURLs: Object.freeze(['documentURLsEncrypted', 'docUrlsEncrypted']),
  image: Object.freeze(['imageEncrypted', 'encryptedImage']),
} as const);

export type SbtEncryptedFieldKey = keyof typeof LEGACY_SBT_ENCRYPTED_FIELD_KEYS;

export const isSbtDisplayMetadataRecord = (value: unknown): value is SbtDisplayMetadataRecord =>
  !!value && typeof value === 'object';

const readSbtRecordValue = (value: unknown, key: string): unknown =>
  isSbtDisplayMetadataRecord(value) ? value[key] : undefined;

export const getSbtDisplayAddressLower = (value: unknown): string => toStr(value).trim().toLowerCase();

export const normalizeSbtDisplaySlug = (value: unknown): string => toStr(value).trim().toLowerCase();

export const normalizeSbtDisplayChainId = (value: unknown): number => {
  const chainId = Number(value);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : 0;
};

export const buildSbtDisplayLabelMemoKey = ({
  addressLower = '',
  preferredSlug = '',
  chainId = null,
}: {
  addressLower?: unknown;
  preferredSlug?: unknown;
  chainId?: unknown;
} = {}): string =>
  `${toStr(addressLower).trim().toLowerCase()}|${normalizeSbtDisplaySlug(preferredSlug)}|${normalizeSbtDisplayChainId(chainId)}`;

export const buildSbtDisplayRetryStateKey = ({
  addressLower = '',
  slug = '',
  chainId = null,
}: {
  addressLower?: unknown;
  slug?: unknown;
  chainId?: unknown;
} = {}): string =>
  `${addressLower === undefined ? '' : String(addressLower)}|${normalizeSbtDisplaySlug(slug)}|${Number(chainId || 0) || 0}`;

export const buildSbtDisplayInflightLookupKey = (retryKey: unknown): string =>
  `${retryKey === undefined ? '' : String(retryKey)}|lookup`;

export const resolveSbtDisplayRetryAllowed = (retryStateEntry: unknown, now: unknown): boolean => {
  const retryAt = Number(readSbtRecordValue(retryStateEntry, 'nextRetryAt') || 0);
  return !Number.isFinite(retryAt) || retryAt <= Number(now);
};

export const shouldWriteSbtDisplayLabelMemoEntry = ({
  memoKey,
  value,
}: {
  memoKey?: unknown;
  value?: unknown;
} = {}): boolean => {
  const key = toStr(memoKey).trim();
  return !!(key && value && typeof value === 'object' && readSbtRecordValue(value, 'name'));
};

export const shouldPersistSbtDisplayMetadata = (metadata: unknown): boolean => isSbtDisplayMetadataRecord(metadata);

export const getLegacySbtEncryptedFieldKeys = (fieldKey: unknown): readonly string[] => {
  const key = toStr(fieldKey) as SbtEncryptedFieldKey;
  if (!key) return [];
  return LEGACY_SBT_ENCRYPTED_FIELD_KEYS[key] || [];
};

export const isSbtMetadataFieldLocked = (info: unknown, fieldKey: unknown): boolean => {
  if (!isSbtDisplayMetadataRecord(info) || !fieldKey) return false;
  const key = toStr(fieldKey);
  if (!key) return false;
  if (info[`${key}Locked`] === true) return true;
  const encryptedFields = isSbtDisplayMetadataRecord(info.encryptedFields) ? info.encryptedFields : null;
  if (encryptedFields && Object.prototype.hasOwnProperty.call(encryptedFields, key) && encryptedFields[key]) {
    return true;
  }
  return getLegacySbtEncryptedFieldKeys(key).some((legacyKey) => !!info[legacyKey]);
};

export const getSbtMetadataDescriptionText = (info: unknown): string => {
  const record = isSbtDisplayMetadataRecord(info) ? info : null;
  const description = toStr(record?.description).trim();
  if (description) return description;
  return isSbtMetadataFieldLocked(record, 'description') ? SBT_MASKED_FIELD_VALUE : '';
};

export const getSbtMetadataDisplayNameValue = (info: unknown): string => {
  if (!isSbtDisplayMetadataRecord(info)) return '';
  const nameLocked = isSbtMetadataFieldLocked(info, 'name');
  const candidates = nameLocked ? [info.name] : [info.name, info.title];
  if (!nameLocked) {
    candidates.push(info.symbol);
    candidates.push(info.contractName);
  }
  for (const candidate of candidates) {
    const name = toStr(candidate).trim();
    if (name) return name;
  }
  if (nameLocked) return SBT_MASKED_FIELD_VALUE;
  return '';
};

export const resolveSbtMetadataLookupDecision = (metadata: unknown): SbtMetadataLookupDecision => {
  if (!isSbtDisplayMetadataRecord(metadata)) {
    return {
      status: 'missing',
      hasMetadataRecord: false,
      name: '',
      shouldMarkFailure: true,
      shouldClearFailure: false,
      shouldUseResult: false,
    };
  }

  const name = getSbtMetadataDisplayNameValue(metadata);
  if (!name) {
    return {
      status: 'unnamed',
      hasMetadataRecord: true,
      name: '',
      shouldMarkFailure: true,
      shouldClearFailure: false,
      shouldUseResult: false,
    };
  }

  return {
    status: 'named',
    hasMetadataRecord: true,
    name,
    shouldMarkFailure: false,
    shouldClearFailure: true,
    shouldUseResult: true,
  };
};

export const resolveSbtCacheEntryFromBucket = (bucket: unknown, addressLower: unknown): unknown | null => {
  if (!isSbtDisplayMetadataRecord(bucket)) return null;
  const sbtList = isSbtDisplayMetadataRecord(bucket.sbtList) ? bucket.sbtList : null;
  if (!sbtList) return null;

  const addressKey = toStr(addressLower);
  if (sbtList[addressKey]) return sbtList[addressKey];

  for (const entry of Object.values(sbtList)) {
    const lower = getSbtDisplayAddressLower(readSbtRecordValue(entry, 'sbtAddress'));
    if (lower && lower === addressKey) return entry;
  }

  return null;
};

export const resolveSbtCacheEntryChainId = (entry: unknown, netKey: unknown = ''): number =>
  normalizeSbtDisplayChainId(
    readSbtRecordValue(readSbtRecordValue(entry, 'sbtInfo'), 'chainID') ||
      readSbtRecordValue(readSbtRecordValue(entry, 'sbtInfo'), 'chainId') ||
      readSbtRecordValue(entry, 'chainID') ||
      readSbtRecordValue(entry, 'chainId') ||
      netKey,
  );

export const resolveSbtDisplayNameFromCacheValue = (
  cacheValue: unknown,
  addressLower: unknown,
  { expectedChainId = 0 }: { expectedChainId?: unknown } = {},
): SbtCacheNameHit | null => {
  if (!isSbtDisplayMetadataRecord(cacheValue)) return null;
  const expected = normalizeSbtDisplayChainId(expectedChainId);
  const addressKey = toStr(addressLower);

  for (const netKey of Object.keys(cacheValue)) {
    const bucket = cacheValue[netKey];
    const entry = resolveSbtCacheEntryFromBucket(bucket, addressKey);
    if (!entry) continue;
    const chainId = resolveSbtCacheEntryChainId(entry, netKey);
    if (expected > 0 && chainId !== expected) continue;
    const info = readSbtRecordValue(entry, 'sbtInfo') || null;
    const name = getSbtMetadataDisplayNameValue(info);
    if (!name) continue;
    return {
      name,
      info,
      netKey,
      chainId: chainId || null,
      entry,
    };
  }

  return null;
};

export const resolveSbtDisplayCacheWriteNetKey = ({
  cacheObj,
  addressLower = '',
  chainId = null,
  info = null,
}: {
  cacheObj?: unknown;
  addressLower?: unknown;
  chainId?: unknown;
  info?: unknown;
} = {}): string => {
  const cache = isSbtDisplayMetadataRecord(cacheObj) ? cacheObj : {};
  const infoChainId = normalizeSbtDisplayChainId(
    readSbtRecordValue(info, 'chainID') || readSbtRecordValue(info, 'chainId') || 0,
  );
  const preferredChainId = normalizeSbtDisplayChainId(chainId);
  const preferredNetKey = preferredChainId > 0 ? String(preferredChainId) : '';
  const infoNetKey = infoChainId > 0 ? String(infoChainId) : '';
  const entryNetKeys: string[] = [];

  for (const netKey of Object.keys(cache)) {
    const entry = resolveSbtCacheEntryFromBucket(cache[netKey], addressLower);
    if (!entry) continue;
    entryNetKeys.push(netKey);
  }

  if (preferredNetKey && entryNetKeys.includes(preferredNetKey)) {
    return preferredNetKey;
  }
  if (infoNetKey && entryNetKeys.includes(infoNetKey)) {
    return infoNetKey;
  }
  if (preferredNetKey) {
    return preferredNetKey;
  }
  if (infoNetKey) {
    return infoNetKey;
  }
  if (entryNetKeys.length > 0) {
    return entryNetKeys[0];
  }

  const existingKeys = Object.keys(cache).filter((key) => key && key !== 'undefined');
  if (existingKeys.length === 1) return existingKeys[0];

  return '';
};

export const buildSbtDisplayCacheEntry = ({
  existingEntry = null,
  checksum = '',
  metadata = null,
  slug = '',
}: {
  existingEntry?: unknown;
  checksum?: unknown;
  metadata?: unknown;
  slug?: unknown;
} = {}): Record<string, unknown> => {
  const existing = isSbtDisplayMetadataRecord(existingEntry) ? existingEntry : {};
  const existingInfoValue = readSbtRecordValue(existing, 'sbtInfo');
  const existingInfo = isSbtDisplayMetadataRecord(existingInfoValue) ? existingInfoValue : {};
  const metadataRecord = isSbtDisplayMetadataRecord(metadata) ? metadata : {};
  return {
    ...existing,
    sbtAddress: checksum,
    sbtInfo: { ...existingInfo, ...metadataRecord },
    slug,
  };
};
