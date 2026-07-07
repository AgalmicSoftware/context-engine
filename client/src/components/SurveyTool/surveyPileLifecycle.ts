import { buildPileCacheUpdatePlan, type PileCacheUpdatePlan } from './surveyPileCacheSync.js';
import { updateSubmittedSinceLastEdit } from './surveyToolUtils.js';

export type PileQuestionProgressLike = {
  slug?: unknown;
  phase?: unknown;
  discoveredQuestions?: unknown;
  hydratedQuestions?: unknown;
  pendingMetadataCount?: unknown;
};

export type PileAutoDecryptUpdatePlan = {
  shouldDisableBlockedAutoDecrypt: boolean;
  queueAutoDecryptReasons: string[];
};

export type PileComponentUpdatePlan = {
  shouldResetContext: boolean;
  cacheUpdatePlan: PileCacheUpdatePlan;
  shouldClearLongLoading: boolean;
  shouldDisableBlockedAutoDecrypt: boolean;
  queueAutoDecryptReasons: string[];
};

export const EMPTY_PILE_RESPONSE_SLICE = {
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
};

export const pickScopedPileQuestionProgress = ({
  progress,
  progressSlug = '',
  doesQuestionProgressMatchSlug = () => false,
}: {
  progress?: PileQuestionProgressLike | null;
  progressSlug?: string | null;
  doesQuestionProgressMatchSlug?: (progressSlugValue: unknown, currentSlug: string) => boolean;
} = {}): PileQuestionProgressLike | null => {
  if (!progress || typeof progress !== 'object') return null;
  if (!doesQuestionProgressMatchSlug(progress.slug, String(progressSlug || ''))) return null;
  return progress;
};

export const buildPileQuestionProgressSignals = ({
  previousProgress = null,
  nextProgress = null,
}: {
  previousProgress?: PileQuestionProgressLike | null;
  nextProgress?: PileQuestionProgressLike | null;
} = {}) => {
  const prevDiscoveredQuestions = Math.max(0, Number(previousProgress?.discoveredQuestions || 0));
  const nextDiscoveredQuestions = Math.max(0, Number(nextProgress?.discoveredQuestions || 0));
  const prevHydratedQuestions = Math.max(0, Number(previousProgress?.hydratedQuestions || 0));
  const nextHydratedQuestions = Math.max(0, Number(nextProgress?.hydratedQuestions || 0));
  const prevPendingMetadataCount = Math.max(0, Number(previousProgress?.pendingMetadataCount || 0));
  const nextPendingMetadataCount = Math.max(0, Number(nextProgress?.pendingMetadataCount || 0));

  const progressHydrationTick =
    (nextDiscoveredQuestions !== prevDiscoveredQuestions ||
      nextHydratedQuestions !== prevHydratedQuestions ||
      nextPendingMetadataCount !== prevPendingMetadataCount) &&
    (nextDiscoveredQuestions > 0 || nextHydratedQuestions > 0 || nextPendingMetadataCount > 0);
  const progressCompletedTick =
    String(previousProgress?.phase || '').toLowerCase() === 'hydrate' &&
    String(nextProgress?.phase || '').toLowerCase() !== 'hydrate';

  return {
    prevDiscoveredQuestions,
    nextDiscoveredQuestions,
    prevHydratedQuestions,
    nextHydratedQuestions,
    prevPendingMetadataCount,
    nextPendingMetadataCount,
    progressHydrationTick,
    progressCompletedTick,
  };
};

export const buildPileContextResetState = ({
  submittedSinceLastEdit = false,
}: {
  submittedSinceLastEdit?: boolean;
} = {}) => ({
  loading: true,
  pileQuestions: [],
  activePileIndex: 0,
  submissionComplete: false,
  submittedSinceLastEdit: updateSubmittedSinceLastEdit(submittedSinceLastEdit, 'reset'),
  editBaseline: null,
  surveysResponseState: [{ ...EMPTY_PILE_RESPONSE_SLICE }],
});

export const buildPileAutoDecryptUpdatePlan = ({
  providerChanged = false,
  accountChanged = false,
  autoDecryptBlocked = false,
  autoDecryptEnabled = false,
  nonceTick = false,
  responseNonceTick = false,
  pileQuestionsChanged = false,
  surveysResponseStateChanged = false,
  cacheJustBecameReady = false,
  autoDecryptJustEnabled = false,
  commentsChanged = false,
}: {
  providerChanged?: boolean;
  accountChanged?: boolean;
  autoDecryptBlocked?: boolean;
  autoDecryptEnabled?: boolean;
  nonceTick?: boolean;
  responseNonceTick?: boolean;
  pileQuestionsChanged?: boolean;
  surveysResponseStateChanged?: boolean;
  cacheJustBecameReady?: boolean;
  autoDecryptJustEnabled?: boolean;
  commentsChanged?: boolean;
} = {}): PileAutoDecryptUpdatePlan => {
  const queueAutoDecryptReasons: string[] = [];
  const shouldDisableBlockedAutoDecrypt = !!autoDecryptBlocked && (!!providerChanged || !!accountChanged);

  if (
    autoDecryptEnabled &&
    (nonceTick || responseNonceTick || pileQuestionsChanged || surveysResponseStateChanged || cacheJustBecameReady) &&
    !autoDecryptBlocked
  ) {
    queueAutoDecryptReasons.push('pile-state-change');
  }

  if (autoDecryptJustEnabled && !autoDecryptBlocked) {
    queueAutoDecryptReasons.push('pile-enabled');
  }

  if (autoDecryptEnabled && commentsChanged && !autoDecryptBlocked) {
    queueAutoDecryptReasons.push('pile-comments-toggle');
  }

  return {
    shouldDisableBlockedAutoDecrypt,
    queueAutoDecryptReasons,
  };
};

export const buildPileComponentUpdatePlan = ({
  networkChanged = false,
  accountChanged = false,
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
  showLongLoading = false,
  providerChanged = false,
  autoDecryptBlocked = false,
  autoDecryptEnabled = false,
  pileQuestionsChanged = false,
  surveysResponseStateChanged = false,
  cacheJustBecameReady = false,
  autoDecryptJustEnabled = false,
  commentsChanged = false,
}: {
  networkChanged?: boolean;
  accountChanged?: boolean;
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
  showLongLoading?: boolean;
  providerChanged?: boolean;
  autoDecryptBlocked?: boolean;
  autoDecryptEnabled?: boolean;
  pileQuestionsChanged?: boolean;
  surveysResponseStateChanged?: boolean;
  cacheJustBecameReady?: boolean;
  autoDecryptJustEnabled?: boolean;
  commentsChanged?: boolean;
} = {}): PileComponentUpdatePlan => {
  if (networkChanged || accountChanged) {
    return {
      shouldResetContext: true,
      cacheUpdatePlan: { action: 'noop', delayMs: 80 },
      shouldClearLongLoading: false,
      shouldDisableBlockedAutoDecrypt: false,
      queueAutoDecryptReasons: [],
    };
  }

  const cacheUpdatePlan = buildPileCacheUpdatePlan({
    cacheReadyTick,
    nonceTick,
    responseNonceTick,
    progressHydrationTick,
    progressCompletedTick,
    isOptimistic,
    hasLiveEdits,
    pileQuestionsLength,
    isQuestionCacheReady,
    loading,
  });
  const autoDecryptUpdatePlan = buildPileAutoDecryptUpdatePlan({
    providerChanged,
    accountChanged,
    autoDecryptBlocked,
    autoDecryptEnabled,
    nonceTick,
    responseNonceTick,
    pileQuestionsChanged,
    surveysResponseStateChanged,
    cacheJustBecameReady,
    autoDecryptJustEnabled,
    commentsChanged,
  });

  return {
    shouldResetContext: false,
    cacheUpdatePlan,
    shouldClearLongLoading: !loading && !!isQuestionCacheReady && !!showLongLoading,
    shouldDisableBlockedAutoDecrypt: autoDecryptUpdatePlan.shouldDisableBlockedAutoDecrypt,
    queueAutoDecryptReasons: autoDecryptUpdatePlan.queueAutoDecryptReasons,
  };
};
