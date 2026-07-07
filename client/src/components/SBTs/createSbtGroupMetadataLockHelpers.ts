export const METADATA_LOCK_FIELDS = Object.freeze(['name', 'description', 'tags', 'documentURLs', 'image']);

type BuildCreateSbtMetadataLockSelectionStateArgs = {
  gateOptions?: unknown;
  metadataLockGateIds?: unknown;
};
type CreateSbtMetadataLockSelectionState = {
  descriptionSelectedGateIds: string[];
  docsSelectedGateIds: string[];
  imageSelectedGateIds: string[];
  nameSelectedGateIds: string[];
  tagsSelectedGateIds: string[];
  validGateIds: unknown[];
};
type ResolveCreateSbtMetadataFieldGateIdsArgs = {
  fieldKey?: string;
  gatesLowerLabel?: unknown;
  lockMap?: Record<string, unknown>;
  validGateIds?: unknown[];
};
type ResolveCreateSbtEncryptedFieldGateValueArgs = {
  selectedGateIds?: unknown;
  validGateIds?: unknown[];
};
type WriteCreateSbtEncryptedFieldGateArgs = ResolveCreateSbtEncryptedFieldGateValueArgs & {
  fieldKey?: unknown;
  target?: Record<string, unknown> | null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeGateIds = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((entry: unknown) => {
    const id = String(entry || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
};

export const areStringArraysEqual = (a?: unknown[], b?: unknown[]): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i] || '') !== String(b[i] || '')) return false;
  }
  return true;
};

export const createEmptyMetadataLockGateIds = (): Record<string, string[]> => ({
  name: [],
  description: [],
  tags: [],
  documentURLs: [],
  image: [],
});

export const normalizeMetadataLockGateIds = (value?: unknown): Record<string, string[]> => {
  const source = isPlainObject(value) ? value : {};
  const next = createEmptyMetadataLockGateIds();
  METADATA_LOCK_FIELDS.forEach((fieldKey) => {
    next[fieldKey] = normalizeGateIds(source[fieldKey]);
  });
  return next;
};

export const normalizeCreateSbtSelectedGateIds = (value: unknown, validGateIds: unknown[] = []): string[] => {
  const normalized = normalizeGateIds(value);
  if (!Array.isArray(validGateIds) || validGateIds.length === 0) return normalized;
  const validGateSet = new Set<unknown>(validGateIds);
  return normalized.filter((gateId) => validGateSet.has(gateId));
};

export const normalizeCreateSbtMetadataLockGateIdsForValidGates = (
  metadataLockGateIds: unknown = {},
  validGateIds: unknown[] = [],
): Record<string, string[]> => {
  const normalizedMetadataLocks = normalizeMetadataLockGateIds(metadataLockGateIds);
  return METADATA_LOCK_FIELDS.reduce<Record<string, string[]>>((acc, fieldKey) => {
    acc[fieldKey] = normalizeCreateSbtSelectedGateIds(normalizedMetadataLocks[fieldKey], validGateIds);
    return acc;
  }, createEmptyMetadataLockGateIds());
};

export const getCreateSbtValidGateIds = (gateOptions: unknown): unknown[] =>
  (Array.isArray(gateOptions) ? gateOptions : [])
    .map((opt: unknown) => (isPlainObject(opt) ? opt.id : null))
    .filter(Boolean);

export const buildCreateSbtMetadataLockSelectionState = ({
  gateOptions = [],
  metadataLockGateIds = {},
}: BuildCreateSbtMetadataLockSelectionStateArgs = {}): CreateSbtMetadataLockSelectionState => {
  const validGateIds = getCreateSbtValidGateIds(gateOptions);
  const normalizedMetadataLocks = normalizeMetadataLockGateIds(metadataLockGateIds);
  return {
    validGateIds,
    nameSelectedGateIds: normalizeCreateSbtSelectedGateIds(normalizedMetadataLocks.name, validGateIds),
    descriptionSelectedGateIds: normalizeCreateSbtSelectedGateIds(normalizedMetadataLocks.description, validGateIds),
    tagsSelectedGateIds: normalizeCreateSbtSelectedGateIds(normalizedMetadataLocks.tags, validGateIds),
    docsSelectedGateIds: normalizeCreateSbtSelectedGateIds(normalizedMetadataLocks.documentURLs, validGateIds),
    imageSelectedGateIds: normalizeCreateSbtSelectedGateIds(normalizedMetadataLocks.image, validGateIds),
  };
};

export const resolveCreateSbtEncryptedFieldGateValue = ({
  selectedGateIds = [],
  validGateIds = [],
}: ResolveCreateSbtEncryptedFieldGateValueArgs = {}): string | string[] | null => {
  const normalized = normalizeCreateSbtSelectedGateIds(selectedGateIds, validGateIds);
  if (!normalized.length) return null;
  return normalized.length === 1 ? normalized[0] : normalized;
};

export const writeCreateSbtEncryptedFieldGate = ({
  fieldKey = '',
  selectedGateIds = [],
  target = null,
  validGateIds = [],
}: WriteCreateSbtEncryptedFieldGateArgs = {}): boolean => {
  const fieldGateValue = resolveCreateSbtEncryptedFieldGateValue({ selectedGateIds, validGateIds });
  if (!fieldGateValue || !target || typeof target !== 'object') return false;
  target[String(fieldKey || '')] = fieldGateValue;
  return true;
};

export const resolveCreateSbtLegacyDescriptionLockGateIds = ({
  parsed = {},
  gateOptions = [],
}: {
  parsed?: unknown;
  gateOptions?: unknown;
} = {}): unknown[] => {
  const parsedRecord = isPlainObject(parsed) ? parsed : {};
  const legacyDescriptionAddresses = new Set<string>(
    (Array.isArray(parsedRecord.descriptionGateSBTs) ? parsedRecord.descriptionGateSBTs : [])
      .map((entry: unknown) =>
        String((isPlainObject(entry) ? entry.address : entry) || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
  if (legacyDescriptionAddresses.size === 0) return [];
  return (Array.isArray(gateOptions) ? gateOptions : [])
    .filter((gate: unknown) => {
      const gateRecord = isPlainObject(gate) ? gate : {};
      const sbtAddresses = Array.isArray(gateRecord.sbtAddresses) ? gateRecord.sbtAddresses : [];
      if (sbtAddresses.length !== 1) return false;
      return legacyDescriptionAddresses.has(String(sbtAddresses[0] || '').toLowerCase());
    })
    .map((gate: unknown) => (isPlainObject(gate) ? gate.id : null))
    .filter(Boolean);
};

export const resolveCreateSbtRestoredMetadataLockGateIds = ({
  parsed = {},
  gateOptions = [],
}: {
  parsed?: unknown;
  gateOptions?: unknown;
} = {}): Record<string, string[]> => {
  const parsedRecord = isPlainObject(parsed) ? parsed : {};
  const cachedMetadataLockGateIds = normalizeMetadataLockGateIds(parsedRecord.metadataLockGateIds);
  const legacyDescriptionLockGateIds = resolveCreateSbtLegacyDescriptionLockGateIds({
    parsed: parsedRecord,
    gateOptions,
  });
  return normalizeMetadataLockGateIds({
    ...cachedMetadataLockGateIds,
    description:
      normalizeGateIds(cachedMetadataLockGateIds.description).length > 0
        ? cachedMetadataLockGateIds.description
        : normalizeGateIds(parsedRecord.descriptionLockGateIds).length > 0
          ? parsedRecord.descriptionLockGateIds
          : legacyDescriptionLockGateIds,
    tags:
      normalizeGateIds(cachedMetadataLockGateIds.tags).length > 0
        ? cachedMetadataLockGateIds.tags
        : parsedRecord.tagsLockGateIds,
    documentURLs:
      normalizeGateIds(cachedMetadataLockGateIds.documentURLs).length > 0
        ? cachedMetadataLockGateIds.documentURLs
        : parsedRecord.docsLockGateIds,
  });
};

export const getMetadataFieldLockGateIds = (lockMap?: Record<string, unknown>, fieldKey = ''): string[] =>
  normalizeGateIds(lockMap?.[fieldKey]);

export const resolveCreateSbtMetadataFieldGateIds = ({
  fieldKey = '',
  gatesLowerLabel = 'gates',
  lockMap = {},
  validGateIds = [],
}: ResolveCreateSbtMetadataFieldGateIdsArgs = {}): string[] => {
  const rawGateIds = getMetadataFieldLockGateIds(lockMap, fieldKey);
  const knownGateIds = new Set<unknown>(Array.isArray(validGateIds) ? validGateIds : []);
  const selectedGateIds = rawGateIds.filter((gateId) => knownGateIds.has(gateId));
  if (rawGateIds.length > 0 && selectedGateIds.length !== rawGateIds.length) {
    const gatesLower = String(gatesLowerLabel || 'gates');
    throw new Error(
      `${fieldKey} encryption ${gatesLower} could not be resolved. Please reselect the lock or configure valid ${gatesLower}.`,
    );
  }
  return selectedGateIds;
};

export const areMetadataLockGateMapsEqual = (a?: Record<string, unknown>, b?: Record<string, unknown>): boolean =>
  METADATA_LOCK_FIELDS.every((fieldKey) =>
    areStringArraysEqual(getMetadataFieldLockGateIds(a, fieldKey), getMetadataFieldLockGateIds(b, fieldKey)),
  );
