import { buildPileResponseCounts } from './surveyPileScopeCacheData';

type PileQuestionLike =
  | {
      id?: unknown;
    }
  | null
  | undefined;

type AreQuestionListsEquivalent = (left: PileQuestionLike[], right: PileQuestionLike[]) => boolean;

export type PileNoNetworkLoadPlan = {
  shouldSkipStateUpdate: boolean;
  shouldClearLastResultSignature: boolean;
  nextLoading: boolean;
  nextState: { loading: boolean } | null;
};

export const buildPileNoNetworkLoadPlan = ({
  currentLoading = false,
  isQuestionCacheReady = false,
  recentRateLimit = false,
}: {
  currentLoading?: boolean;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
} = {}): PileNoNetworkLoadPlan => {
  const nextLoading = !isQuestionCacheReady || !!recentRateLimit;
  const shouldSkipStateUpdate = !!currentLoading === !!nextLoading;

  return {
    shouldSkipStateUpdate,
    shouldClearLastResultSignature: true,
    nextLoading,
    nextState: shouldSkipStateUpdate ? null : { loading: nextLoading },
  };
};

export type PileResponseCountsCachePlan = {
  responseCounts: Record<string, number>;
  nextCacheKey: string;
  nextCacheValue: Record<string, number>;
  reusedCachedCounts: boolean;
};

export const buildPileResponseCountsCachePlan = ({
  cacheKey = '',
  previousCacheKey = '',
  previousCacheValue = null,
  questionResponses = {},
}: {
  cacheKey?: string | null;
  previousCacheKey?: string | null;
  previousCacheValue?: Record<string, number> | null;
  questionResponses?: Record<string, Record<string, unknown>> | null;
} = {}): PileResponseCountsCachePlan => {
  const normalizedCacheKey = String(cacheKey || '');
  const normalizedPreviousCacheKey = String(previousCacheKey || '');
  const reusableCacheValue = previousCacheValue && typeof previousCacheValue === 'object' ? previousCacheValue : null;

  if (normalizedCacheKey && normalizedCacheKey === normalizedPreviousCacheKey && reusableCacheValue) {
    return {
      responseCounts: reusableCacheValue,
      nextCacheKey: normalizedCacheKey,
      nextCacheValue: reusableCacheValue,
      reusedCachedCounts: true,
    };
  }

  const nextResponseCounts = buildPileResponseCounts({
    questionResponses: questionResponses && typeof questionResponses === 'object' ? questionResponses : {},
  });

  return {
    responseCounts: nextResponseCounts,
    nextCacheKey: normalizedCacheKey,
    nextCacheValue: nextResponseCounts,
    reusedCachedCounts: false,
  };
};

export type PileEmptyProbeAction = 'continue-loading-immediately' | 'probe-loading' | 'settle-empty';

export type PileEmptyProbeStatePlan = {
  action: PileEmptyProbeAction;
  shouldClearLastResultSignature: boolean;
  shouldIncrementPileQuestionsGeneration: boolean;
  shouldBumpNoop: boolean;
  nextState: Record<string, unknown> | null;
  nextProbeStartedAtMs: number;
  nextProbeDelayMs: number;
};

export const buildPileEmptyProbeStatePlan = ({
  action = 'settle-empty',
  nextProbeStartedAtMs = 0,
  nextProbeDelayMs = 0,
  previousPileQuestions = [],
  previousAllQuestionsForFilter = [],
  previousLoading = false,
  areQuestionListsEquivalent = (left, right) => left === right,
}: {
  action?: PileEmptyProbeAction;
  nextProbeStartedAtMs?: number | null;
  nextProbeDelayMs?: number | null;
  previousPileQuestions?: PileQuestionLike[] | null;
  previousAllQuestionsForFilter?: PileQuestionLike[] | null;
  previousLoading?: boolean;
  areQuestionListsEquivalent?: AreQuestionListsEquivalent;
} = {}): PileEmptyProbeStatePlan => {
  const normalizedPreviousPileQuestions = Array.isArray(previousPileQuestions) ? previousPileQuestions : [];
  const normalizedPreviousAllQuestions = Array.isArray(previousAllQuestionsForFilter)
    ? previousAllQuestionsForFilter
    : [];

  if (action === 'continue-loading-immediately') {
    const samePile = areQuestionListsEquivalent(normalizedPreviousPileQuestions, []);
    const sameAll = areQuestionListsEquivalent(normalizedPreviousAllQuestions, []);
    const sameLoading = !!previousLoading === true;
    const shouldBumpNoop = samePile && sameAll && sameLoading;
    return {
      action,
      shouldClearLastResultSignature: true,
      shouldIncrementPileQuestionsGeneration: !shouldBumpNoop,
      shouldBumpNoop,
      nextState: shouldBumpNoop ? null : { pileQuestions: [], allQuestionsForFilter: [], loading: true },
      nextProbeStartedAtMs: 0,
      nextProbeDelayMs: 0,
    };
  }

  if (action === 'probe-loading') {
    const alreadyLoading = !!previousLoading;
    return {
      action,
      shouldClearLastResultSignature: true,
      shouldIncrementPileQuestionsGeneration: false,
      shouldBumpNoop: false,
      nextState: alreadyLoading ? null : { loading: true },
      nextProbeStartedAtMs: Math.max(0, Number(nextProbeStartedAtMs || 0)),
      nextProbeDelayMs: Math.max(0, Number(nextProbeDelayMs || 0)),
    };
  }

  return {
    action: 'settle-empty',
    shouldClearLastResultSignature: false,
    shouldIncrementPileQuestionsGeneration: false,
    shouldBumpNoop: false,
    nextState: null,
    nextProbeStartedAtMs: 0,
    nextProbeDelayMs: 0,
  };
};
