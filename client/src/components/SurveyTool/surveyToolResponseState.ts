import { createLogger } from 'utilities/logging.js';
import {
  normalizeRatingValue,
  RATING_MIN,
} from '../../utilities/survey/ratingValue.js';
import { normalizeQuestionIdKey } from './surveyToolSignatures.js';

type UnknownRecord = Record<string, unknown>;

type RatingResponse = {
  conviction?: unknown;
  importance?: unknown;
} & UnknownRecord;

type RatingSlice = {
  conviction?: Record<string, unknown> | null;
  importance?: Record<string, unknown> | null;
} & UnknownRecord;

type MultichoiceQuestion = {
  type?: unknown;
  singleSelect?: unknown;
  oneSelectionOnly?: unknown;
  singleChoice?: unknown;
} & UnknownRecord;

const surveyLog = createLogger('surveys');

export const toNumberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

export const getNormalizedUiRatingValue = (value: unknown): number => {
  const normalizedValue = normalizeRatingValue(value, RATING_MIN);
  return normalizedValue == null ? RATING_MIN : normalizedValue;
};

export const clampSliderValue = (value: unknown, min: number, max: number): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return min;
  return Math.min(max, Math.max(min, numericValue));
};

export const getConvictionFromResponse = (resp: RatingResponse | null | undefined): number | null => {
  if (!resp || typeof resp !== 'object') return null;
  if (resp.conviction !== undefined && resp.conviction !== null) {
    return toNumberOrNull(resp.conviction);
  }
  if (resp.importance !== undefined && resp.importance !== null) {
    return toNumberOrNull(resp.importance);
  }
  return null;
};

export const getImportanceFromResponse = (resp: RatingResponse | null | undefined): number | null => {
  if (!resp || typeof resp !== 'object') return null;
  if (resp.importance !== undefined && resp.importance !== null) {
    return toNumberOrNull(resp.importance);
  }
  return null;
};

export const buildRatingEnvelopeQidSetFromUserAnswers = (userAnswers: unknown): Set<string> => {
  const out = new Set<string>();
  try {
    const src = (userAnswers && typeof userAnswers === 'object') ? userAnswers as UnknownRecord : null;
    const list = src
      ? (Array.isArray(src.responses) ? src.responses : [src])
      : [];
    list.forEach((row) => {
      const record = (row && typeof row === 'object') ? row as UnknownRecord : {};
      const id = normalizeQuestionIdKey(
        record.questionID || record.questionId || record.questionIDHash || ''
      );
      if (!id) return;
      const impEnv = typeof record.importanceEncrypted === 'string' ? record.importanceEncrypted : '';
      const convEnv = typeof record.convictionEncrypted === 'string' ? record.convictionEncrypted : '';
      if (impEnv || convEnv) out.add(id);
    });
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  return out;
};

export const getConvictionFromSlice = (slice: RatingSlice | null | undefined, qid: string): number | null => {
  if (!slice || !qid) return null;
  if (slice.conviction && Object.prototype.hasOwnProperty.call(slice.conviction, qid)) {
    return toNumberOrNull(slice.conviction[qid]);
  }
  if (slice.importance && Object.prototype.hasOwnProperty.call(slice.importance, qid)) {
    return toNumberOrNull(slice.importance[qid]);
  }
  return null;
};

export const getConvictionFromSliceStrict = (slice: RatingSlice | null | undefined, qid: string): number | null => {
  if (!slice || !qid) return null;
  if (slice.conviction && Object.prototype.hasOwnProperty.call(slice.conviction, qid)) {
    return toNumberOrNull(slice.conviction[qid]);
  }
  return null;
};

export const getImportanceFromSlice = (slice: RatingSlice | null | undefined, qid: string): number | null => {
  if (!slice || !qid) return null;
  if (slice.importance && Object.prototype.hasOwnProperty.call(slice.importance, qid)) {
    return toNumberOrNull(slice.importance[qid]);
  }
  return null;
};

export const normalizeMultichoiceValue = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

export const isSingleSelectMultichoice = (question: MultichoiceQuestion | null | undefined): boolean => {
  if (!question || question.type !== 'multichoice') return false;
  return !!(question.singleSelect || question.oneSelectionOnly || question.singleChoice);
};
