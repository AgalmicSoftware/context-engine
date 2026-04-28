import { toNumberOrNull } from './surveyToolResponseState.js';

export type PileCacheUpdatePlanAction =
  | 'check-optimistic-baseline'
  | 'reload'
  | 'skip-live-edits'
  | 'show-loading'
  | 'noop';

export type PileCacheUpdatePlan = {
  action: PileCacheUpdatePlanAction;
  delayMs: number;
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
    !!cacheReadyTick ||
    !!nonceTick ||
    !!responseNonceTick ||
    !!progressHydrationTick ||
    !!progressCompletedTick;
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

  if (
    normalizedPileQuestionsLength === 0 &&
    !hasLiveEdits &&
    !isQuestionCacheReady &&
    !loading
  ) {
    return { action: 'show-loading', delayMs: normalizedReloadDelayMs };
  }

  return { action: 'noop', delayMs: normalizedReloadDelayMs };
};

export const hasAnyPileBaselineInput = (slice: any = {}): boolean => {
  const hasVal = (value: unknown) => (
    value !== undefined &&
    value !== null &&
    (Array.isArray(value) ? value.length > 0 : String(value).length > 0)
  );

  for (const qid in (slice.answers || {})) {
    if (hasVal(slice.answers?.[qid]?.value)) return true;
  }
  for (const qid in (slice.additionalComments || {})) {
    if (hasVal(slice.additionalComments?.[qid]?.value)) return true;
  }
  for (const qid in (slice.importance || {})) {
    if (Object.prototype.hasOwnProperty.call(slice.importance || {}, qid)) return true;
  }
  for (const qid in (slice.conviction || {})) {
    if (Object.prototype.hasOwnProperty.call(slice.conviction || {}, qid)) return true;
  }

  return false;
};

export const shouldSeedPileBaselineFromPrefill = ({
  editBaseline = null,
  currentSlice = null,
  pendingTotal = 0,
}: {
  editBaseline?: unknown;
  currentSlice?: any;
  pendingTotal?: number | null;
} = {}): boolean => {
  if (editBaseline) return false;
  if (hasAnyPileBaselineInput(currentSlice || {})) return false;
  return Number(pendingTotal || 0) <= 0;
};

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
  baseline?: any;
  renderedIds?: unknown[] | null;
  questionResponses?: Record<string, Record<string, unknown>> | null;
  account?: string | null;
  valuesEqual?: (left: unknown, right: unknown) => boolean;
} = {}): boolean => {
  if (!baseline) return false;

  const normalizedRenderedIds = Array.isArray(renderedIds) ? renderedIds : [];
  const normalizedResponses = questionResponses && typeof questionResponses === 'object'
    ? questionResponses
    : {};
  const accountLower = String(account || '').toLowerCase();

  for (const rawQuestionId of normalizedRenderedIds) {
    const questionId = String(rawQuestionId || '');
    if (!questionId) continue;

    const questionIdLower = questionId.toLowerCase();
    const rawEntry = normalizedResponses[questionIdLower]?.[accountLower];

    let cacheEntry: any = null;
    try {
      cacheEntry = typeof rawEntry === 'string' ? JSON.parse(rawEntry) : rawEntry;
    } catch {
      cacheEntry = null;
    }

    const baselineAnswer = baseline.answers?.[questionId];
    const baselineAdditional = baseline.additionalComments?.[questionId];
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
      cacheEntry && (
        (typeof cacheEntry.importanceEncrypted === 'string' && cacheEntry.importanceEncrypted) ||
        (typeof cacheEntry.convictionEncrypted === 'string' && cacheEntry.convictionEncrypted)
      )
    );

    if (baselineAnswer && baselineAnswer.value !== undefined) {
      const cacheValue = cacheEntry?.answer?.value;
      if (!valuesEqual(baselineAnswer.value, cacheValue)) {
        return false;
      }
    }

    if (baselineAdditional && baselineAdditional.value !== undefined) {
      const cacheAdditionalValue = cacheEntry?.additional?.value;
      if (!valuesEqual(baselineAdditional.value, cacheAdditionalValue)) {
        return false;
      }
    }

    if (baseline.conviction && Object.prototype.hasOwnProperty.call(baseline.conviction, questionId)) {
      const baselineConviction = toNumberOrNull(baseline.conviction[questionId]);
      const cacheConvictionRaw =
        cacheEntry?.conviction !== undefined && cacheEntry?.conviction !== null
          ? cacheEntry.conviction
          : cacheEntry?.importance;
      const cacheConviction = toNumberOrNull(cacheConvictionRaw);
      if (cacheConviction === null) {
        if (!baselineResponseEncrypted && !cacheRatingEncrypted) return false;
      } else if (baselineConviction !== cacheConviction) {
        return false;
      }
    }

    if (baseline.importance && Object.prototype.hasOwnProperty.call(baseline.importance, questionId)) {
      const baselineImportance = toNumberOrNull(baseline.importance[questionId]);
      const cacheImportanceRaw =
        cacheEntry?.importance !== undefined && cacheEntry?.importance !== null
          ? cacheEntry.importance
          : cacheEntry?.conviction;
      const cacheImportance = toNumberOrNull(cacheImportanceRaw);
      if (cacheImportance === null) {
        if (!baselineResponseEncrypted && !cacheRatingEncrypted) return false;
      } else if (baselineImportance !== cacheImportance) {
        return false;
      }
    }
  }

  return true;
};
