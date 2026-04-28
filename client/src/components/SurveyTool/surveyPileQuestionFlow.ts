import { isQuestionPromptMasked } from './surveyToolViewState.js';

export type PileQuestionLike = {
  id?: unknown;
  prompt?: unknown;
  promptDecrypted?: boolean;
};

export type PileQuestionResponsesMap = Record<string, Record<string, unknown>>;
export type PileQuestionResponseCounts = Record<string, number>;

const byResponseCountDesc = (
  left: PileQuestionLike,
  right: PileQuestionLike,
  responseCounts: PileQuestionResponseCounts = {}
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
  const normalizedQuestions = Array.isArray(questions) ? questions : [];
  const normalizedResponses = questionResponses && typeof questionResponses === 'object'
    ? questionResponses
    : {};
  const normalizedResponseCounts = responseCounts && typeof responseCounts === 'object'
    ? responseCounts
    : {};
  const normalizedHighlightedIds = highlightedQuestionIds instanceof Set
    ? highlightedQuestionIds
    : new Set<string>();
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

  return isLoggedIn
    ? [...highlighted, ...unanswered, ...answered]
    : [...highlighted, ...unanswered];
};

export const splitPileMaskedQuestions = ({
  questions = [],
}: {
  questions?: PileQuestionLike[] | null;
} = {}) => {
  const normalizedQuestions = Array.isArray(questions) ? questions : [];
  const hiddenQuestions = normalizedQuestions.filter((question) => isQuestionPromptMasked(question));
  const visibleQuestions = normalizedQuestions.filter((question) => !isQuestionPromptMasked(question));

  return {
    hiddenQuestions,
    visibleQuestions,
    hasHiddenGatedQuestions: hiddenQuestions.length > 0,
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
  const loading = normalizedVisibleQuestions.length > 0
    ? false
    : (hasHiddenGatedQuestions
      ? false
      : (settleUnreadyEmpty ? false : (!isQuestionCacheReady || recentRateLimit)));

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
    Math.max(normalizedNextVisibleQuestions.length - 1, 0)
  );
  const pileChanged = !areQuestionListsEquivalent(normalizedPreviousPileQuestions, normalizedNextVisibleQuestions);
  const indexChanged = normalizedPreviousActivePileIndex !== clampedIndex;
  const nextVisibleForHydration = pileChanged
    ? normalizedNextVisibleQuestions
    : normalizedPreviousPileQuestions;
  const nextActiveIndexForHydration = (pileChanged || indexChanged)
    ? clampedIndex
    : normalizedPreviousActivePileIndex;

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
} = {}): boolean => (
  String(nextVisibleSignature || '') === String(currentVisibleSignature || '') &&
  !!nextHiddenGated === !!currentHiddenGated &&
  String(nextFilterSignature || '') === String(currentFilterSignature || '')
);
