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

export const SBT_MASKED_FIELD_VALUE = '[encrypted]';

export const LEGACY_SBT_ENCRYPTED_FIELD_KEYS = Object.freeze({
  name: Object.freeze(['nameEncrypted', 'encryptedName']),
  description: Object.freeze(['descriptionEncrypted', 'encryptedDescription']),
  tags: Object.freeze(['tagsEncrypted', 'encryptedTags']),
  documentURLs: Object.freeze(['documentURLsEncrypted', 'docUrlsEncrypted']),
  image: Object.freeze(['imageEncrypted', 'encryptedImage']),
} as const);

export type SbtEncryptedFieldKey = keyof typeof LEGACY_SBT_ENCRYPTED_FIELD_KEYS;

export const isSbtDisplayMetadataRecord = (value: unknown): value is SbtDisplayMetadataRecord => (
  !!value && typeof value === 'object'
);

const readSbtRecordValue = (value: unknown, key: string): unknown => (
  isSbtDisplayMetadataRecord(value) ? value[key] : undefined
);

export const getSbtDisplayAddressLower = (value: unknown): string => toStr(value).trim().toLowerCase();

export const normalizeSbtDisplayChainId = (value: unknown): number => {
  const chainId = Number(value);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : 0;
};

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
  const encryptedFields = isSbtDisplayMetadataRecord(info.encryptedFields)
    ? info.encryptedFields
    : null;
  if (
    encryptedFields &&
    Object.prototype.hasOwnProperty.call(encryptedFields, key) &&
    encryptedFields[key]
  ) {
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
  const candidates = nameLocked
    ? [info.name]
    : [
        info.name,
        info.title,
      ];
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

export const resolveSbtCacheEntryFromBucket = (
  bucket: unknown,
  addressLower: unknown
): unknown | null => {
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

export const resolveSbtCacheEntryChainId = (entry: unknown, netKey: unknown = ''): number => (
  normalizeSbtDisplayChainId(
    readSbtRecordValue(readSbtRecordValue(entry, 'sbtInfo'), 'chainID') ||
    readSbtRecordValue(readSbtRecordValue(entry, 'sbtInfo'), 'chainId') ||
    readSbtRecordValue(entry, 'chainID') ||
    readSbtRecordValue(entry, 'chainId') ||
    netKey
  )
);

export const resolveSbtDisplayNameFromCacheValue = (
  cacheValue: unknown,
  addressLower: unknown,
  { expectedChainId = 0 }: { expectedChainId?: unknown } = {}
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
