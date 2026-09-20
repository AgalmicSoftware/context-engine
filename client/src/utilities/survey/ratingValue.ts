export const RATING_MIN = 0;
export const RATING_MAX = 10;

export type RatingScale = {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

export const DEFAULT_RATING_SCALE: RatingScale = {
  min: RATING_MIN,
  max: RATING_MAX,
  minLabel: String(RATING_MIN),
  maxLabel: String(RATING_MAX),
};

const RATING_SCALE_METADATA_KEYS = [
  'min',
  'minimum',
  'max',
  'maximum',
  'minLabel',
  'lowLabel',
  'maxLabel',
  'highLabel',
] as const;

const isBlankRatingValue = (value: unknown): value is string => typeof value === 'string' && value.trim() === '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasMetadataValue = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';

const recordHasRatingScaleMetadata = (record: Record<string, unknown>): boolean =>
  RATING_SCALE_METADATA_KEYS.some((key) => hasMetadataValue(record[key]));

const pickRatingScaleRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const scale = isRecord(record.scale) ? record.scale : null;
  if (scale && recordHasRatingScaleMetadata(scale)) return scale;
  const ratingScale = isRecord(record.ratingScale) ? record.ratingScale : null;
  if (ratingScale && recordHasRatingScaleMetadata(ratingScale)) return ratingScale;
  return scale || ratingScale || record;
};

export const hasRatingScaleMetadata = (source: unknown): boolean => {
  const record = isRecord(source) ? source : {};
  return recordHasRatingScaleMetadata(pickRatingScaleRecord(record)) || recordHasRatingScaleMetadata(record);
};

const toFiniteNumber = (value: unknown): number | null => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeRatingLabel = (value: unknown, fallback: number): string => {
  const label = String(value == null ? '' : value).trim();
  return label || String(fallback);
};

export const normalizeRatingScale = (source: unknown): RatingScale => {
  const record = isRecord(source) ? source : {};
  const scale = pickRatingScaleRecord(record);
  const rawMin = toFiniteNumber(scale.min ?? scale.minimum ?? record.min ?? record.minimum);
  const rawMax = toFiniteNumber(scale.max ?? scale.maximum ?? record.max ?? record.maximum);
  const min = rawMin ?? RATING_MIN;
  const max = rawMax ?? RATING_MAX;
  if (max <= min) return DEFAULT_RATING_SCALE;
  return {
    min,
    max,
    minLabel: normalizeRatingLabel(scale.minLabel ?? scale.lowLabel ?? record.minLabel ?? record.lowLabel, min),
    maxLabel: normalizeRatingLabel(scale.maxLabel ?? scale.highLabel ?? record.maxLabel ?? record.highLabel, max),
  };
};

export const normalizeRatingValue = (
  rawValue: unknown,
  fallback: number | null = null,
  scale: RatingScale = DEFAULT_RATING_SCALE,
): number | null => {
  if (rawValue === undefined || rawValue === null || isBlankRatingValue(rawValue)) {
    return fallback;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return fallback;

  return Math.min(scale.max, Math.max(scale.min, numericValue));
};

export const getRatingFillPercent = (
  rawValue: unknown,
  fallback = RATING_MIN,
  scale: RatingScale = DEFAULT_RATING_SCALE,
): number => {
  const normalizedValue = normalizeRatingValue(rawValue, fallback, scale);
  const safeValue = normalizedValue == null ? fallback : normalizedValue;
  const ratingSpan = scale.max - scale.min;
  if (ratingSpan <= 0) return 0;

  return ((safeValue - scale.min) / ratingSpan) * 100;
};
