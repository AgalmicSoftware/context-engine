export const RATING_MIN = 0;
export const RATING_MAX = 10;

const isBlankRatingValue = (value) => (
  typeof value === 'string' && value.trim() === ''
);

export const normalizeRatingValue = (rawValue, fallback = null) => {
  if (rawValue === undefined || rawValue === null || isBlankRatingValue(rawValue)) {
    return fallback;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return fallback;

  return Math.min(RATING_MAX, Math.max(RATING_MIN, numericValue));
};

export const getRatingFillPercent = (rawValue, fallback = RATING_MIN) => {
  const normalizedValue = normalizeRatingValue(rawValue, fallback);
  const safeValue = normalizedValue == null ? fallback : normalizedValue;
  const ratingSpan = RATING_MAX - RATING_MIN;
  if (ratingSpan <= 0) return 0;

  return ((safeValue - RATING_MIN) / ratingSpan) * 100;
};
