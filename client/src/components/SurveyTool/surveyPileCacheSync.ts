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

export const hasAnyPileBaselineInput = (slice: unknown = {}): boolean => {
  const baselineSlice = asPileBaselineSlice(slice);
  const hasVal = (value: unknown) =>
    value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : String(value).length > 0);

  for (const qid in baselineSlice.answers || {}) {
    if (hasVal(baselineSlice.answers?.[qid]?.value)) return true;
  }
  for (const qid in baselineSlice.additionalComments || {}) {
    if (hasVal(baselineSlice.additionalComments?.[qid]?.value)) return true;
  }
  for (const qid in baselineSlice.importance || {}) {
    if (Object.prototype.hasOwnProperty.call(baselineSlice.importance || {}, qid)) return true;
  }
  for (const qid in baselineSlice.conviction || {}) {
    if (Object.prototype.hasOwnProperty.call(baselineSlice.conviction || {}, qid)) return true;
  }

  return false;
};

export const shouldSeedPileBaselineFromPrefill = ({
  editBaseline = null,
  currentSlice = null,
  pendingTotal = 0,
}: {
  editBaseline?: unknown;
  currentSlice?: unknown;
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
  baseline?: unknown;
  renderedIds?: unknown[] | null;
  questionResponses?: Record<string, Record<string, unknown>> | null;
  account?: string | null;
  valuesEqual?: (left: unknown, right: unknown) => boolean;
} = {}): boolean => {
  const baselineSlice = asPileBaselineSlice(baseline);
  if (!baseline || Object.keys(baselineSlice).length === 0) return false;

  const normalizedRenderedIds = Array.isArray(renderedIds) ? renderedIds : [];
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

    if (baselineSlice.conviction && Object.prototype.hasOwnProperty.call(baselineSlice.conviction, questionId)) {
      const baselineConviction = toNumberOrNull(baselineSlice.conviction[questionId]);
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

    if (baselineSlice.importance && Object.prototype.hasOwnProperty.call(baselineSlice.importance, questionId)) {
      const baselineImportance = toNumberOrNull(baselineSlice.importance[questionId]);
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
