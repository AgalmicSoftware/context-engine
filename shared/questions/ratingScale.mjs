// Canonical rating-scale contract shared by browser, Session Worker and bridge consumers.
const trim = (value) => String(value == null ? '' : value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const RATING_SCALE_METADATA_KEYS = [
  'min',
  'minimum',
  'max',
  'maximum',
  'minLabel',
  'lowLabel',
  'maxLabel',
  'highLabel',
];

const hasMetadataValue = (value) => value !== undefined && value !== null && trim(value) !== '';

const recordHasRatingScaleMetadata = (record = {}) =>
  RATING_SCALE_METADATA_KEYS.some((key) => hasMetadataValue(record[key]));

const pickRatingScaleRecord = (question = {}) => {
  const scale = isObj(question.scale) ? question.scale : null;
  if (scale && recordHasRatingScaleMetadata(scale)) return scale;
  const ratingScale = isObj(question.ratingScale) ? question.ratingScale : null;
  if (ratingScale && recordHasRatingScaleMetadata(ratingScale)) return ratingScale;
  return scale || ratingScale || question;
};

export const hasRatingScaleMetadata = (question = {}) =>
  recordHasRatingScaleMetadata(pickRatingScaleRecord(question)) || recordHasRatingScaleMetadata(question);

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeRatingLabel = (value, fallback) => {
  const label = trim(value);
  return label || String(fallback);
};

export const normalizeRatingScale = (question = {}) => {
  if (!hasRatingScaleMetadata(question)) return null;

  const scale = pickRatingScaleRecord(question);
  const min = toFiniteNumber(scale.min ?? scale.minimum ?? question.min ?? question.minimum);
  const max = toFiniteNumber(scale.max ?? scale.maximum ?? question.max ?? question.maximum);
  const normalizedMin = min ?? 0;
  const normalizedMax = max ?? 10;
  if (normalizedMax <= normalizedMin) {
    return { min: 0, max: 10, minLabel: '0', maxLabel: '10' };
  }
  return {
    min: normalizedMin,
    max: normalizedMax,
    minLabel: normalizeRatingLabel(
      scale.minLabel ?? scale.lowLabel ?? question.minLabel ?? question.lowLabel,
      normalizedMin,
    ),
    maxLabel: normalizeRatingLabel(
      scale.maxLabel ?? scale.highLabel ?? question.maxLabel ?? question.highLabel,
      normalizedMax,
    ),
  };
};
