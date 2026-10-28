import {
  normalizeRatingScale as sharedRatingScale,
  ratingStepFor,
  DEFAULT_RATING_SCALE as SHARED_DEFAULT_RATING_SCALE,
} from '../../../../shared/questions/ratingScale.mjs';

export const RATING_MIN = 0;
export const RATING_MAX = 10;

export type RatingScale = {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  step?: number;
};

export const DEFAULT_RATING_SCALE: RatingScale = { ...SHARED_DEFAULT_RATING_SCALE, step: 1 };

const isBlankRatingValue = (value: unknown): value is string => typeof value === 'string' && value.trim() === '';

export const normalizeRatingScale = (source: unknown): RatingScale => {
  const record = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  return { ...(sharedRatingScale(record) || SHARED_DEFAULT_RATING_SCALE), step: ratingStepFor(record) };
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
