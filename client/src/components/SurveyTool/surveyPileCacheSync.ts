import type { ResponseValuesEqual } from './responseValueEquality';
import { toNumberOrNull } from './surveyToolResponseState.js';

export type PileCacheUpdatePlanAction =
  'check-optimistic-baseline' | 'reload' | 'skip-live-edits' | 'show-loading' | 'noop';

export type PileCacheUpdatePlan = {
  action: PileCacheUpdatePlanAction;
  delayMs: number;
};
type PileBaselineField = Record<string, unknown> & {
  value?: unknown;
  encrypted?: unknown;
  encryptedPortion?: unknown;
};
type PileBaselineSlice = Record<string, unknown> & {
  answers?: Record<string, PileBaselineField>;
  additionalComments?: Record<string, PileBaselineField>;
  importance?: Record<string, unknown>;
  conviction?: Record<string, unknown>;
};
type PileCacheEntry = Record<string, unknown> & {
  answer?: PileBaselineField;
  additional?: PileBaselineField;
  importance?: unknown;
  conviction?: unknown;
  importanceEncrypted?: unknown;
  convictionEncrypted?: unknown;
};

export const buildPileCacheUpdatePlan = ({
  cacheReadyTick = false,
  nonceTick = false,
  responseNonceTick = false,
  progressHydrationTick = false,
  progressCompletedTick = false,
  isOptimistic = false,
  hasLiveEdits = false,
  pileQuestionsLength = 0,
  isQuestionCacheReady = false,
  loading = false,
  reloadDelayMs = 80,
}: {
  cacheReadyTick?: boolean;
  nonceTick?: boolean;
  responseNonceTick?: boolean;
  progressHydrationTick?: boolean;
  progressCompletedTick?: boolean;
  isOptimistic?: boolean;
  hasLiveEdits?: boolean;
  pileQuestionsLength?: number | null;
  isQuestionCacheReady?: boolean;
  loading?: boolean;
  reloadDelayMs?: number | null;
} = {}): PileCacheUpdatePlan => {
  const hasCacheSignal =
    !!cacheReadyTick || !!nonceTick || !!responseNonceTick || !!progressHydrationTick || !!progressCompletedTick;
  const normalizedReloadDelayMs = Math.max(0, Number(reloadDelayMs || 0));
  const normalizedPileQuestionsLength = Math.max(0, Number(pileQuestionsLength || 0));

  if (hasCacheSignal) {
    if (isOptimistic) {
      return { action: 'check-optimistic-baseline', delayMs: normalizedReloadDelayMs };
    }
    if (!hasLiveEdits) {
      return { action: 'reload', delayMs: normalizedReloadDelayMs };
    }
    return { action: 'skip-live-edits', delayMs: normalizedReloadDelayMs };
  }

  if (normalizedPileQuestionsLength === 0 && !hasLiveEdits && !isQuestionCacheReady && !loading) {
    return { action: 'show-loading', delayMs: normalizedReloadDelayMs };
  }

  return { action: 'noop', delayMs: normalizedReloadDelayMs };
};

const asPileBaselineSlice = (value: unknown): PileBaselineSlice =>
  value && typeof value === 'object' ? (value as PileBaselineSlice) : {};

const defaultValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }
  return left === right;
};

export const isPileCacheConsistentWithBaseline = ({
  baseline = null,
  renderedIds = [],
  questionResponses = {},
  account = '',
  valuesEqual = defaultValuesEqual,
}: {
  baseline?: unknown;
  renderedIds?: unknown[] | null;
  questionResponses?: Record<string, Record<string, unknown>> | null;
  account?: string | null;
  valuesEqual?: ResponseValuesEqual;
} = {}): boolean => {
  const baselineSlice = asPileBaselineSlice(baseline);
  if (!baseline || Object.keys(baselineSlice).length === 0) return false;

  const normalizedRenderedIds = Array.isArray(renderedIds) ? renderedIds : [];
  if (normalizedRenderedIds.length === 0) return false;
  const normalizedResponses = questionResponses && typeof questionResponses === 'object' ? questionResponses : {};
  const accountLower = String(account || '').toLowerCase();

  for (const rawQuestionId of normalizedRenderedIds) {
    const questionId = String(rawQuestionId || '');
    if (!questionId) continue;

    const questionIdLower = questionId.toLowerCase();
    const rawEntry = normalizedResponses[questionIdLower]?.[accountLower];

    let cacheEntry: PileCacheEntry | null = null;
    try {
      const parsedEntry = typeof rawEntry === 'string' ? JSON.parse(rawEntry) : rawEntry;
      cacheEntry = parsedEntry && typeof parsedEntry === 'object' ? (parsedEntry as PileCacheEntry) : null;
    } catch {
      cacheEntry = null;
    }

    const baselineAnswer = baselineSlice.answers?.[questionId];
    const baselineAdditional = baselineSlice.additionalComments?.[questionId];
    const baselineAnswerEncrypted = !!(
      baselineAnswer &&
      (baselineAnswer.encrypted || baselineAnswer.encryptedPortion || baselineAnswer.value === '*')
    );
    const baselineAdditionalEncrypted = !!(
      baselineAdditional &&
      (baselineAdditional.encrypted || baselineAdditional.encryptedPortion || baselineAdditional.value === '*')
    );
    const baselineResponseEncrypted = baselineAnswerEncrypted || baselineAdditionalEncrypted;
    const cacheRatingEncrypted = !!(
      cacheEntry &&
      ((typeof cacheEntry.importanceEncrypted === 'string' && cacheEntry.importanceEncrypted) ||
        (typeof cacheEntry.convictionEncrypted === 'string' && cacheEntry.convictionEncrypted))
    );

    if (baselineAnswer && baselineAnswer.value !== undefined) {
      const cacheValue = cacheEntry?.answer?.value;
      if (!valuesEqual(baselineAnswer.value, cacheValue, questionId, 'answer')) {
        return false;
      }
    }

    if (baselineAdditional && baselineAdditional.value !== undefined) {
      const cacheAdditionalValue = cacheEntry?.additional?.value;
      if (!valuesEqual(baselineAdditional.value, cacheAdditionalValue, questionId, 'additional')) {
        return false;
      }
    }

    if (baselineSlice.conviction && Object.prototype.hasOwnProperty.call(baselineSlice.conviction, questionId)) {
      const baselineConviction = toNumberOrNull(baselineSlice.conviction[questionId]);
      const cacheConviction =
        cacheEntry?.conviction !== undefined && cacheEntry?.conviction !== null
          ? toNumberOrNull(cacheEntry.conviction)
          : null;
      if (cacheConviction === null) {
        if (!baselineResponseEncrypted && !cacheRatingEncrypted) return false;
      } else if (baselineConviction !== cacheConviction) {
        return false;
      }
    }

    if (baselineSlice.importance && Object.prototype.hasOwnProperty.call(baselineSlice.importance, questionId)) {
      const baselineImportance = toNumberOrNull(baselineSlice.importance[questionId]);
      const cacheImportance =
        cacheEntry?.importance !== undefined && cacheEntry?.importance !== null
          ? toNumberOrNull(cacheEntry.importance)
          : null;
      if (cacheImportance === null) {
        if (!baselineResponseEncrypted && !cacheRatingEncrypted) return false;
      } else if (baselineImportance !== cacheImportance) {
        return false;
      }
    }
  }

  return true;
};
