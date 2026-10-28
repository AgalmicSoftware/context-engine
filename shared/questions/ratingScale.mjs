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

export const DEFAULT_RATING_SCALE = Object.freeze({ min: 0, max: 10, minLabel: '0', maxLabel: '10' });

export const ratingStepFor = (question = {}) => {
  // A step-only record cannot override the record supplying the bounds.
  const source = [question.scale, question.ratingScale].find((record) =>
    isObj(record) && recordHasRatingScaleMetadata(record)) || question;
  const step = Number(source.step);
  return Number.isFinite(step) && step > 0 ? step : 1;
};

const decimalPlaces = (value) => {
  const [coefficient, exponent = '0'] = String(value).split('e');
  return Math.max(0, (coefficient.split('.')[1]?.length || 0) - Number(exponent));
};

export const normalizeRatingAnswer = (value, question = {}) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  const { min, max } = normalizeRatingScale(question) || DEFAULT_RATING_SCALE;
  const step = ratingStepFor(question);
  const index = (number - min) / step;
  if (!Number.isFinite(number) || number < min || number > max || !Number.isFinite(index) ||
      Math.abs(index - Math.round(index)) > 1e-9) return null;
  // Preserve the grid's origin as well as its step, removing floating point noise.
  const precision = Math.min(100, Math.max(decimalPlaces(step), decimalPlaces(min)));
  return Number((min + Math.round(index) * step).toFixed(precision));
};
