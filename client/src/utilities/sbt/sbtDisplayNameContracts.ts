import { toStr } from '../shared/primitives.js';

export type SbtDisplayMetadataRecord = Record<string, unknown> & {
  name?: unknown;
  title?: unknown;
  symbol?: unknown;
  contractName?: unknown;
  description?: unknown;
  encryptedFields?: unknown;
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
