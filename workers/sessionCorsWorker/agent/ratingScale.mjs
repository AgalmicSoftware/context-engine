import { normalizeRatingScale, ratingStepFor, normalizeRatingAnswer, DEFAULT_RATING_SCALE } from '../../../shared/questions/ratingScale.mjs';

const withLegacyScale = (question) => question?.rating_scale && !question?.ratingScale
  ? { ...question, ratingScale: question.rating_scale } : question || {};

export function normalizeAgentRatingScale(question = {}) {
  const record = withLegacyScale(question);
  const { min, max } = normalizeRatingScale(record) || DEFAULT_RATING_SCALE;
  return { min, max, step: ratingStepFor(record) };
}

export function normalizeAgentRatingAnswer(value, question = {}) {
  return normalizeRatingAnswer(value, withLegacyScale(question));
}
