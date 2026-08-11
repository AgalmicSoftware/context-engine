import type { CSSProperties } from 'react';

export type SingleQuestionAggregatorClassNames = {
  aggregatorContainerClassName: string;
  aggregatorParagraphClassName: string;
  aggregatorFreeformAnswerClassName: string;
};

export type SingleQuestionGlobalCacheWindow = Window & {
  __APP_CACHE__?: Record<string, unknown>;
  __QUESTION_CACHE__?: Record<string, unknown>;
  __SURVEY_CACHE__?: Record<string, unknown>;
};

export const joinClassNames = (...parts: unknown[]) => parts.filter(Boolean).join(' ');

export const shallowEqualSingleQuestionRecord = (
  left: Record<string, unknown> | null | undefined,
  right: Record<string, unknown> | null | undefined,
): boolean => {
  if (Object.is(left, right)) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.hasOwn(right, key) && Object.is(left[key], right[key]));
};

export const SINGLE_QUESTION_IMPORTANCE_SLIDER_STYLE: CSSProperties = { width: '200px' };

export const resolveSingleQuestionBookmarkIconStyle = (
  bookmarkSuccess: unknown,
  isBookmarked: unknown,
): CSSProperties => ({
  color: bookmarkSuccess
    ? 'var(--ce-status-success-text)'
    : isBookmarked
      ? 'var(--ce-status-warning)'
      : 'var(--ce-panel-text)',
});

export const buildSingleQuestionMiniPromptButtonClassName = (styleMap: Record<string, string>) =>
  `${styleMap.miniPromptAbbrev} ${styleMap.maskedPromptActionButton}`;

export const buildSingleQuestionReadOnlyBinaryClassName = (styleMap: Record<string, string>, optionClassName: string) =>
  `${styleMap.readOnlyBinary} ${styleMap[optionClassName]}`;

export const resolveSingleQuestionRatingBarStyle = (ratingFillPercent: unknown): CSSProperties => ({
  width: `${ratingFillPercent}%`,
});
