type UnknownRecord = Record<string, unknown>;

const SLICE_TOKEN_HASH_SEED_PRIMARY = 2166136261;
const SLICE_TOKEN_HASH_SEED_SECONDARY = 2246822519;
const SLICE_TOKEN_MAX_DEPTH = 24;

export const normalizeQuestionIdKey = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const mixFnvHashText = (hash: number, input: unknown): number => {
  let next = hash >>> 0;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    next ^= text.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
};

const buildTextHashToken = (prefix: string, value: unknown): string => {
  const text = String(value || '');
  const primary = mixFnvHashText(SLICE_TOKEN_HASH_SEED_PRIMARY, text);
  const secondary = mixFnvHashText(SLICE_TOKEN_HASH_SEED_SECONDARY, `${text.length}|${text}`);
  return `${prefix}:${text.length}:${primary >>> 0}:${secondary >>> 0}`;
};

const buildSliceTokenInternal = (value: unknown, depth: number, traversal: { seen: WeakSet<object> }): string => {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'string') return buildTextHashToken('s', value);
  if (typeof value === 'number') return `d:${Number.isNaN(value) ? 'NaN' : String(value)}`;
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0';
  if (typeof value === 'bigint') return `bi:${String(value)}`;
  if (value instanceof Date) return `dt:${Number(value.getTime() || 0)}`;
  if (Array.isArray(value)) {
    if (depth >= SLICE_TOKEN_MAX_DEPTH) return `a:${value.length}:max-depth`;
    let primary = SLICE_TOKEN_HASH_SEED_PRIMARY;
    let secondary = SLICE_TOKEN_HASH_SEED_SECONDARY;
    for (let i = 0; i < value.length; i += 1) {
      const entryToken = buildSliceTokenInternal(value[i], depth + 1, traversal);
      primary = mixFnvHashText(primary, `i:${i}`);
      primary = mixFnvHashText(primary, entryToken);
      secondary = mixFnvHashText(secondary, entryToken);
      secondary = mixFnvHashText(secondary, `i:${i}:${entryToken.length}`);
    }
    return `a:${value.length}:${primary >>> 0}:${secondary >>> 0}`;
  }
  if (typeof value === 'object') {
    if (traversal.seen.has(value as object)) return 'c';
    if (depth >= SLICE_TOKEN_MAX_DEPTH) {
      const keysAtDepth = Object.keys(value as UnknownRecord).sort();
      return buildTextHashToken('o-depth', keysAtDepth.join('|'));
    }
    traversal.seen.add(value as object);
    try {
      const keys = Object.keys(value as UnknownRecord).sort();
      let primary = SLICE_TOKEN_HASH_SEED_PRIMARY;
      let secondary = SLICE_TOKEN_HASH_SEED_SECONDARY;
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const entryToken = buildSliceTokenInternal((value as UnknownRecord)[key], depth + 1, traversal);
        primary = mixFnvHashText(primary, `k:${key}`);
        primary = mixFnvHashText(primary, entryToken);
        secondary = mixFnvHashText(secondary, `${key}:${entryToken.length}`);
        secondary = mixFnvHashText(secondary, entryToken);
      }
      return `o:${keys.length}:${primary >>> 0}:${secondary >>> 0}`;
    } finally {
      traversal.seen.delete(value as object);
    }
  }
  return `${typeof value}:${String(value)}`;
};

export const buildSliceToken = (value: unknown): string =>
  buildSliceTokenInternal(value, 0, { seen: new WeakSet<object>() });

const buildResponseFieldToken = (field: unknown): string => {
  if (!field || typeof field !== 'object') {
    return `p:${buildSliceToken(field)}`;
  }
  const row = field as UnknownRecord;
  return [
    `v:${buildSliceToken(row.value)}`,
    `e:${row.encrypted ? 1 : 0}`,
    `ep:${buildSliceToken(row.encryptedPortion)}`,
    `a:${buildSliceToken(row.encryptionAudience)}`,
    `g:${buildSliceToken(row.encryptionGateId)}`,
    `m:${buildSliceToken(row.audienceMode)}`,
  ].join('|');
};

const buildQuestionMapSignature = (
  map: unknown,
  {
    responseField = false,
    normalizedIdFilter = null,
  }: { responseField?: boolean; normalizedIdFilter?: Set<string> | null } = {},
): string => {
  if (!map || typeof map !== 'object') return '0:0:0';
  const keys = Object.keys(map as UnknownRecord).sort();
  if (keys.length === 0) return '0:0:0';
  const filterSet = normalizedIdFilter instanceof Set ? normalizedIdFilter : null;
  let hash = SLICE_TOKEN_HASH_SEED_PRIMARY;
  let hashSecondary = SLICE_TOKEN_HASH_SEED_SECONDARY;
  let includedCount = 0;
  for (let i = 0; i < keys.length; i += 1) {
    const rawKey = keys[i];
    const normalizedKey = normalizeQuestionIdKey(rawKey);
    if (filterSet && (!normalizedKey || !filterSet.has(normalizedKey))) continue;
    includedCount += 1;
    hash = mixFnvHashText(hash, normalizedKey);
    hashSecondary = mixFnvHashText(hashSecondary, `${normalizedKey.length}:${normalizedKey}`);
    const value = (map as UnknownRecord)[rawKey];
    const token = responseField ? buildResponseFieldToken(value) : buildSliceToken(value);
    hash = mixFnvHashText(hash, token);
    hashSecondary = mixFnvHashText(hashSecondary, `${token.length}:${token}`);
  }
  if (includedCount === 0) return '0:0:0';
  return `${includedCount}:${hash >>> 0}:${hashSecondary >>> 0}`;
};

export const buildSurveyResponseSliceSignature = (
  slice: UnknownRecord = {},
  { normalizedIdFilter = null }: { normalizedIdFilter?: Set<string> | null } = {},
): string => {
  const safeSlice = slice && typeof slice === 'object' ? slice : {};
  return [
    buildQuestionMapSignature(safeSlice.answers, { responseField: true, normalizedIdFilter }),
    buildQuestionMapSignature(safeSlice.additionalComments, { responseField: true, normalizedIdFilter }),
    buildQuestionMapSignature(safeSlice.importance, { normalizedIdFilter }),
    buildQuestionMapSignature(safeSlice.conviction, { normalizedIdFilter }),
  ].join('|');
};

export const buildRenderedIdsSignature = (ids: unknown = []): string =>
  Array.isArray(ids)
    ? ids
        .map((id) => normalizeQuestionIdKey(id))
        .filter(Boolean)
        .join('|')
    : '';

export const buildQuestionIdScopeSignature = (list: unknown = []): string =>
  Array.isArray(list)
    ? Array.from(
        new Set(
          list
            .map((question) =>
              String((question as UnknownRecord)?.id || '')
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      )
        .sort()
        .join('|')
    : '';
