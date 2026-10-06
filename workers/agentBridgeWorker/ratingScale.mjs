import { normalizeRatingScale, hasRatingScaleMetadata } from '../../shared/questions/ratingScale.mjs';
import { DEFAULT_RATING_SCALE } from './constants.mjs';

export function normalizeTelegramRatingScale(question = {}) {
  const record = question?.rating_scale && !question?.ratingScale
    ? { ...question, ratingScale: question.rating_scale } : question || {};
  const shared = normalizeRatingScale(record) || DEFAULT_RATING_SCALE;
  // Follow the same metadata precedence as the shared bounds reader; a step-only
  // legacy record must not replace the step of the record that supplies the bounds.
  const stepSource = [record.scale, record.ratingScale].find((value) =>
    value && typeof value === 'object' && !Array.isArray(value) && hasRatingScaleMetadata(value)) || record;
  const storedStep = Number(stepSource.step);
  const step = Number.isFinite(storedStep) && storedStep > 0
    ? storedStep : Math.max(1, Math.ceil((shared.max - shared.min) / 20));
  return { min: shared.min, max: shared.max, step };
}

export function normalizeTelegramRatingAnswer(value, question = {}) {
  if (value == null || String(value).trim() === '') return null;
  const numeric = Number(value);
  const { min, max, step } = normalizeTelegramRatingScale(question);
  const index = (numeric - min) / step;
  return Number.isFinite(numeric) && numeric >= min && numeric <= max && Math.abs(index - Math.round(index)) < 1e-8
    ? numeric : null;
}
