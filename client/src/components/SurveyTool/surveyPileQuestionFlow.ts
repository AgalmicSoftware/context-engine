import { isQuestionPromptMasked } from './surveyToolViewState.js';
import { filterPendingQuestionMetadataPlaceholders } from './surveyQuestionMetadataPlaceholders.js';

export type PileQuestionLike = {
  id?: unknown;
  prompt?: unknown;
  promptDecrypted?: boolean;
};

export type PileQuestionResponsesMap = Record<string, Record<string, unknown>>;
export type PileQuestionResponseCounts = Record<string, number>;
export type PileFilterStateLike = Record<string, unknown>;

export type BuildQuestionListSignature = (questions: PileQuestionLike[]) => string;
export type GetPileVisibleQuestionIds = (questions: PileQuestionLike[], activeIndex: number) => string[];
export type BuildPileVisibleResponseSignature = (
  questionResponses: PileQuestionResponsesMap,
  visibleIds: string[],
  account: string,
) => string;

const byResponseCountDesc = (
  left: PileQuestionLike,
  right: PileQuestionLike,
  responseCounts: PileQuestionResponseCounts = {},
): number => {
  const leftCount = responseCounts[String(left?.id || '').toLowerCase()] || 0;
  const rightCount = responseCounts[String(right?.id || '').toLowerCase()] || 0;
  return rightCount - leftCount;
};

export const sortPileQuestionsByPriority = ({
  questions = [],
  questionResponses = {},
  responseCounts = {},
  highlightedQuestionIds = new Set<string>(),
  account = '',
}: {
  questions?: PileQuestionLike[] | null;
  questionResponses?: PileQuestionResponsesMap | null;
  responseCounts?: PileQuestionResponseCounts | null;
  highlightedQuestionIds?: Set<string> | null;
  account?: string | null;
} = {}): PileQuestionLike[] => {
  const normalizedQuestions = filterPendingQuestionMetadataPlaceholders(Array.isArray(questions) ? questions : []);
  const normalizedResponses = questionResponses && typeof questionResponses === 'object' ? questionResponses : {};
  const normalizedResponseCounts = responseCounts && typeof responseCounts === 'object' ? responseCounts : {};
  const normalizedHighlightedIds = highlightedQuestionIds instanceof Set ? highlightedQuestionIds : new Set<string>();
  const accountLower = String(account || '').toLowerCase();
  const isLoggedIn = !!accountLower;

  const highlighted: PileQuestionLike[] = [];
  const unanswered: PileQuestionLike[] = [];
  const answered: PileQuestionLike[] = [];

  normalizedQuestions.forEach((question) => {
    const questionIdLower = String(question?.id || '').toLowerCase();
    if (!questionIdLower) return;

    if (normalizedHighlightedIds.has(questionIdLower)) {
      highlighted.push(question);
      return;
    }

    if (isLoggedIn) {
      const responderMap = normalizedResponses[questionIdLower] || {};
      if (responderMap[accountLower]) answered.push(question);
      else unanswered.push(question);
      return;
    }

    unanswered.push(question);
  });

  highlighted.sort((left, right) => byResponseCountDesc(left, right, normalizedResponseCounts));
  unanswered.sort((left, right) => byResponseCountDesc(left, right, normalizedResponseCounts));
  answered.sort((left, right) => byResponseCountDesc(left, right, normalizedResponseCounts));

  return isLoggedIn ? [...highlighted, ...unanswered, ...answered] : [...highlighted, ...unanswered];
};

export const splitPileMaskedQuestions = ({
  questions = [],
}: {
  questions?: PileQuestionLike[] | null;
} = {}) => {
  const normalizedQuestions = filterPendingQuestionMetadataPlaceholders(Array.isArray(questions) ? questions : []);
  const hiddenQuestions = normalizedQuestions.filter((question) => isQuestionPromptMasked(question));
  const visibleQuestions = normalizedQuestions.filter((question) => !isQuestionPromptMasked(question));

  return {
    hiddenQuestions,
    visibleQuestions,
    hasHiddenGatedQuestions: hiddenQuestions.length > 0,
  };
};

export type PileQuestionPipelineState = {
  sortedQuestions: PileQuestionLike[];
  visibleQuestions: PileQuestionLike[];
  hiddenQuestions: PileQuestionLike[];
  hasHiddenGatedQuestions: boolean;
};

export const buildPileQuestionPipelineState = ({
  questions = [],
  questionResponses = {},
  responseCounts = {},
  highlightedQuestionIds = new Set<string>(),
  account = '',
}: {
  questions?: PileQuestionLike[] | null;
  questionResponses?: PileQuestionResponsesMap | null;
  responseCounts?: PileQuestionResponseCounts | null;
  highlightedQuestionIds?: Set<string> | null;
  account?: string | null;
} = {}): PileQuestionPipelineState => {
  const sortedQuestions = sortPileQuestionsByPriority({
    questions,
    questionResponses,
    responseCounts,
    highlightedQuestionIds,
    account,
  });
  const { hiddenQuestions, visibleQuestions, hasHiddenGatedQuestions } = splitPileMaskedQuestions({
    questions: sortedQuestions,
  });

  return {
    sortedQuestions,
    visibleQuestions,
    hiddenQuestions,
    hasHiddenGatedQuestions,
  };
};

export const buildPileQuestionLoadState = ({
  visibleQuestions = [],
  hiddenQuestions = [],
  settleUnreadyEmpty = false,
  isQuestionCacheReady = false,
  recentRateLimit = false,
}: {
  visibleQuestions?: PileQuestionLike[] | null;
  hiddenQuestions?: PileQuestionLike[] | null;
  settleUnreadyEmpty?: boolean;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
} = {}) => {
  const normalizedVisibleQuestions = Array.isArray(visibleQuestions) ? visibleQuestions : [];
  const normalizedHiddenQuestions = Array.isArray(hiddenQuestions) ? hiddenQuestions : [];
  const hasHiddenGatedQuestions = normalizedHiddenQuestions.length > 0;
  const loading =
    normalizedVisibleQuestions.length > 0
      ? false
      : hasHiddenGatedQuestions
        ? false
        : settleUnreadyEmpty
          ? false
          : !isQuestionCacheReady || recentRateLimit;

  return {
    hasHiddenGatedQuestions,
    loading,
  };
};

export const buildPileVisibleTransitionPlan = ({
  previousPileQuestions = [],
  previousActivePileIndex = 0,
  nextVisibleQuestions = [],
  areQuestionListsEquivalent = (left: unknown, right: unknown) => left === right,
}: {
  previousPileQuestions?: PileQuestionLike[] | null;
  previousActivePileIndex?: number | null;
  nextVisibleQuestions?: PileQuestionLike[] | null;
  areQuestionListsEquivalent?: (left: PileQuestionLike[], right: PileQuestionLike[]) => boolean;
} = {}) => {
  const normalizedPreviousPileQuestions = Array.isArray(previousPileQuestions) ? previousPileQuestions : [];
  const normalizedNextVisibleQuestions = Array.isArray(nextVisibleQuestions) ? nextVisibleQuestions : [];
  const normalizedPreviousActivePileIndex = Math.max(0, Number(previousActivePileIndex || 0));
  const clampedIndex = Math.min(
    normalizedPreviousActivePileIndex,
    Math.max(normalizedNextVisibleQuestions.length - 1, 0),
  );
  const pileChanged = !areQuestionListsEquivalent(normalizedPreviousPileQuestions, normalizedNextVisibleQuestions);
  const indexChanged = normalizedPreviousActivePileIndex !== clampedIndex;
  const nextVisibleForHydration = pileChanged ? normalizedNextVisibleQuestions : normalizedPreviousPileQuestions;
  const nextActiveIndexForHydration = pileChanged || indexChanged ? clampedIndex : normalizedPreviousActivePileIndex;

  return {
    pileChanged,
    indexChanged,
    clampedIndex,
    nextVisibleForHydration,
    nextActiveIndexForHydration,
  };
};

export const shouldSkipPileFilterStateUpdate = ({
  nextVisibleSignature = '',
  currentVisibleSignature = '',
  nextHiddenGated = false,
  currentHiddenGated = false,
  nextFilterSignature = '',
  currentFilterSignature = '',
}: {
  nextVisibleSignature?: string | null;
  currentVisibleSignature?: string | null;
  nextHiddenGated?: boolean;
  currentHiddenGated?: boolean;
  nextFilterSignature?: string | null;
  currentFilterSignature?: string | null;
} = {}): boolean =>
  String(nextVisibleSignature || '') === String(currentVisibleSignature || '') &&
  !!nextHiddenGated === !!currentHiddenGated &&
  String(nextFilterSignature || '') === String(currentFilterSignature || '');

export type PileFilterResultPlan = {
  nextState: {
    pileQuestions: PileQuestionLike[];
    activePileIndex: number;
    filterState: PileFilterStateLike;
    hasHiddenGatedQuestions: boolean;
  };
  shouldSkipStateUpdate: boolean;
  shouldIncrementPileQuestionsGeneration: boolean;
  nextVisibleSignature: string;
  currentVisibleSignature: string;
  nextFilterSignature: string;
  currentFilterSignature: string;
};

export const buildPileFilterResultPlan = ({
  currentVisibleSignature = '',
  nextVisibleQuestions = [],
  currentFilterState = {},
  nextFilterState = {},
  nextHiddenGated = false,
  currentHiddenGated = false,
  buildQuestionListSignature = () => '',
  serializeFilterState = (filterState: unknown) => JSON.stringify(filterState || {}),
}: {
  currentVisibleSignature?: string | null;
  nextVisibleQuestions?: PileQuestionLike[] | null;
  currentFilterState?: PileFilterStateLike | null;
  nextFilterState?: PileFilterStateLike | null;
  nextHiddenGated?: boolean;
  currentHiddenGated?: boolean;
  buildQuestionListSignature?: BuildQuestionListSignature;
  serializeFilterState?: (filterState: unknown) => string;
} = {}): PileFilterResultPlan => {
  const normalizedVisibleQuestions = Array.isArray(nextVisibleQuestions) ? nextVisibleQuestions : [];
  const normalizedCurrentVisibleSignature = String(currentVisibleSignature || '');
  const nextVisibleSignature = buildQuestionListSignature(normalizedVisibleQuestions);
  const normalizedCurrentFilterState = (
    currentFilterState && typeof currentFilterState === 'object' ? currentFilterState : {}
  ) as PileFilterStateLike;
  const normalizedNextFilterState = (
    nextFilterState && typeof nextFilterState === 'object' ? nextFilterState : {}
  ) as PileFilterStateLike;
  const currentFilterSignature = serializeFilterState(normalizedCurrentFilterState);
  const nextFilterSignature = serializeFilterState(normalizedNextFilterState);
  const shouldSkipStateUpdate = shouldSkipPileFilterStateUpdate({
    nextVisibleSignature,
    currentVisibleSignature: normalizedCurrentVisibleSignature,
    nextHiddenGated,
    currentHiddenGated,
    nextFilterSignature,
    currentFilterSignature,
  });

  return {
    nextState: {
      pileQuestions: normalizedVisibleQuestions,
      activePileIndex: 0,
      filterState: normalizedNextFilterState,
      hasHiddenGatedQuestions: !!nextHiddenGated,
    },
    shouldSkipStateUpdate,
    shouldIncrementPileQuestionsGeneration: !shouldSkipStateUpdate,
    nextVisibleSignature,
    currentVisibleSignature: normalizedCurrentVisibleSignature,
    nextFilterSignature,
    currentFilterSignature,
  };
};

export type PileLoadResultPlan = {
  nextState: Record<string, unknown>;
  nextLoading: boolean;
  nextVisibleForHydration: PileQuestionLike[];
  nextActiveIndexForHydration: number;
  shouldUpdateState: boolean;
  shouldIncrementPileQuestionsGeneration: boolean;
  resultSignature: string;
};

export const buildPileLoadResultPlan = ({
  previousAllQuestionsForFilter = [],
  previousPileQuestions = [],
  previousActivePileIndex = 0,
  previousHasHiddenGatedQuestions = false,
  previousLoading = false,
  sortedQuestions = [],
  sortedVisibleQuestions = [],
  hiddenQuestions = [],
  hasHiddenGatedQuestions = false,
  isFilterActive = false,
  filterSig = '',
  questionResponses = {},
  account = '',
  settleUnreadyEmpty = false,
  isQuestionCacheReady = false,
  recentRateLimit = false,
  areQuestionListsEquivalent = (left: unknown, right: unknown) => left === right,
  buildQuestionListSignature = () => '0:0',
  getPileVisibleQuestionIds = () => [],
  buildPileVisibleResponseSignature = () => '',
}: {
  previousAllQuestionsForFilter?: PileQuestionLike[] | null;
  previousPileQuestions?: PileQuestionLike[] | null;
  previousActivePileIndex?: number | null;
  previousHasHiddenGatedQuestions?: boolean;
  previousLoading?: boolean;
  sortedQuestions?: PileQuestionLike[] | null;
  sortedVisibleQuestions?: PileQuestionLike[] | null;
  hiddenQuestions?: PileQuestionLike[] | null;
  hasHiddenGatedQuestions?: boolean;
  isFilterActive?: boolean;
  filterSig?: string | null;
  questionResponses?: PileQuestionResponsesMap | null;
  account?: string | null;
  settleUnreadyEmpty?: boolean;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
  areQuestionListsEquivalent?: (left: PileQuestionLike[], right: PileQuestionLike[]) => boolean;
  buildQuestionListSignature?: BuildQuestionListSignature;
  getPileVisibleQuestionIds?: GetPileVisibleQuestionIds;
  buildPileVisibleResponseSignature?: BuildPileVisibleResponseSignature;
} = {}): PileLoadResultPlan => {
  const normalizedPreviousAllQuestions = Array.isArray(previousAllQuestionsForFilter)
    ? previousAllQuestionsForFilter
    : [];
  const normalizedPreviousPileQuestions = Array.isArray(previousPileQuestions) ? previousPileQuestions : [];
  const normalizedSortedQuestions = Array.isArray(sortedQuestions) ? sortedQuestions : [];
  const normalizedSortedVisibleQuestions = Array.isArray(sortedVisibleQuestions) ? sortedVisibleQuestions : [];
  const normalizedHiddenQuestions = Array.isArray(hiddenQuestions) ? hiddenQuestions : [];
  const normalizedPreviousActivePileIndex = Math.max(0, Number(previousActivePileIndex || 0));
  const normalizedAccount = String(account || '').toLowerCase();

  const { loading: nextLoading } = buildPileQuestionLoadState({
    visibleQuestions: normalizedSortedVisibleQuestions,
    hiddenQuestions: normalizedHiddenQuestions,
    settleUnreadyEmpty,
    isQuestionCacheReady,
    recentRateLimit,
  });

  const nextState: Record<string, unknown> = {
    allQuestionsForFilter: normalizedSortedQuestions,
    hasHiddenGatedQuestions: !!hasHiddenGatedQuestions,
    loading: nextLoading,
  };

  let shouldUpdateState =
    !areQuestionListsEquivalent(normalizedPreviousAllQuestions, normalizedSortedQuestions) ||
    !!previousHasHiddenGatedQuestions !== !!hasHiddenGatedQuestions ||
    !!previousLoading !== !!nextLoading;
  let nextVisibleForHydration = normalizedPreviousPileQuestions;
  let nextActiveIndexForHydration = normalizedPreviousActivePileIndex;
  let shouldIncrementPileQuestionsGeneration = false;

  if (!isFilterActive) {
    const {
      pileChanged,
      indexChanged,
      clampedIndex,
      nextVisibleForHydration: nextVisiblePlan,
      nextActiveIndexForHydration: nextActivePlan,
    } = buildPileVisibleTransitionPlan({
      previousPileQuestions: normalizedPreviousPileQuestions,
      previousActivePileIndex: normalizedPreviousActivePileIndex,
      nextVisibleQuestions: normalizedSortedVisibleQuestions,
      areQuestionListsEquivalent,
    });

    nextVisibleForHydration = nextVisiblePlan;
    nextActiveIndexForHydration = nextActivePlan;
    if (pileChanged) {
      shouldIncrementPileQuestionsGeneration = true;
      nextState.pileQuestions = normalizedSortedVisibleQuestions;
    }
    if (pileChanged || indexChanged) {
      nextState.activePileIndex = clampedIndex;
    }
    shouldUpdateState = shouldUpdateState || pileChanged || indexChanged;
  }

  const visibleWindowIds = getPileVisibleQuestionIds(nextVisibleForHydration, nextActiveIndexForHydration);
  const visibleResponseSignature = buildPileVisibleResponseSignature(
    questionResponses && typeof questionResponses === 'object' ? questionResponses : {},
    visibleWindowIds,
    normalizedAccount,
  );
  const resultSignature = [
    isFilterActive ? 'f1' : 'f0',
    String(filterSig || ''),
    buildQuestionListSignature(normalizedSortedQuestions),
    buildQuestionListSignature(normalizedSortedVisibleQuestions),
    normalizedHiddenQuestions.length > 0 ? 1 : 0,
    visibleResponseSignature,
  ].join('::');

  return {
    nextState,
    nextLoading,
    nextVisibleForHydration,
    nextActiveIndexForHydration,
    shouldUpdateState,
    shouldIncrementPileQuestionsGeneration,
    resultSignature,
  };
};
