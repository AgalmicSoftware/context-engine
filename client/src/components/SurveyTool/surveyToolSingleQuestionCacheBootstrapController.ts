import type { UnknownRecord } from './surveyToolTypes';

type QuestionPayload = UnknownRecord & {
  creator?: unknown;
  id?: string;
  tags?: unknown;
};

type QuestionsCache = Record<string, {
  questions: Record<string, QuestionPayload>;
} & UnknownRecord>;

type CacheState = {
  netIdStr: string;
  questionsCache: QuestionsCache;
};

type SeededHydrationPlan = {
  questionData: QuestionPayload;
  isLoadingResponse: boolean;
};

type CacheBootstrapFlowRetryPlan = {
  reason: string;
  retryingPhase: string;
  exhaustedPhase: string;
  exhaustedStatePatch: UnknownRecord;
};

export type CacheBootstrapFlowContinue = {
  action: 'continue';
  cacheState: CacheState;
  questionData: QuestionPayload | null;
  recentPayloadForAccount: QuestionPayload | null;
  seededHydration: SeededHydrationPlan | null;
};

export type CacheBootstrapFlowStop = {
  action: 'stop';
  debugPhase: string;
  fallbackStatePatch: UnknownRecord;
  logMissingCacheState: boolean;
  preserveCurrentPoolPatch: UnknownRecord | null;
  retryPlan: CacheBootstrapFlowRetryPlan | null;
  seededHydration: SeededHydrationPlan | null;
};

export type CacheBootstrapFlowPlan =
  | CacheBootstrapFlowContinue
  | CacheBootstrapFlowStop;

export type CacheBootstrapReady = {
  status: 'ready';
  cacheState: CacheState;
  questionData: QuestionPayload | null;
  recentPayloadForAccount: QuestionPayload | null;
};

export type CacheBootstrapSeeded = {
  status: 'seeded-from-recent';
  cacheState: CacheState | null;
  questionData: QuestionPayload;
  recentPayloadForAccount: QuestionPayload;
  shouldBootstrapViewedResponse: boolean;
  fallbackNetId: string;
};

export type CacheBootstrapMissing = {
  status: 'missing-cache-state';
};

export type CacheBootstrapResult =
  | CacheBootstrapReady
  | CacheBootstrapSeeded
  | CacheBootstrapMissing;

const buildMissingCacheStateStopPlan = (
  seededHydration: SeededHydrationPlan | null = null,
): CacheBootstrapFlowStop => ({
  action: 'stop',
  debugPhase: 'missing-cache-state',
  fallbackStatePatch: { isLoadingResponse: false },
  logMissingCacheState: true,
  preserveCurrentPoolPatch: { isLoadingResponse: false },
  retryPlan: null,
  seededHydration,
});

export const resolveSingleQuestionCacheBootstrapFlowPlan = ({
  cacheBootstrapResult = null,
}: {
  cacheBootstrapResult?: CacheBootstrapResult | null;
} = {}): CacheBootstrapFlowPlan => {
  if (!cacheBootstrapResult || cacheBootstrapResult.status === 'missing-cache-state') {
    return buildMissingCacheStateStopPlan();
  }

  if (cacheBootstrapResult.status === 'ready') {
    return {
      action: 'continue',
      cacheState: cacheBootstrapResult.cacheState,
      questionData: cacheBootstrapResult.questionData,
      recentPayloadForAccount: cacheBootstrapResult.recentPayloadForAccount,
      seededHydration: null,
    };
  }

  const seededHydration = {
    questionData: cacheBootstrapResult.questionData,
    isLoadingResponse: cacheBootstrapResult.shouldBootstrapViewedResponse,
  };

  if (cacheBootstrapResult.shouldBootstrapViewedResponse) {
    return {
      action: 'stop',
      debugPhase: '',
      fallbackStatePatch: {},
      logMissingCacheState: false,
      preserveCurrentPoolPatch: null,
      retryPlan: {
        reason: 'recent-payload-waiting-for-response-bootstrap',
        retryingPhase: 'recent-payload-response-bootstrap-retrying',
        exhaustedPhase: 'recent-payload-response-bootstrap-exhausted',
        exhaustedStatePatch: {
          viewAddressAnswers: '',
          parsedViewAddressAnswers: null,
          noResponse: true,
          responseLookupWarning: '',
          isLoadingResponse: false,
        },
      },
      seededHydration,
    };
  }

  if (!cacheBootstrapResult.fallbackNetId) {
    return {
      action: 'stop',
      debugPhase: 'recent-payload-missing-network',
      fallbackStatePatch: { isLoadingResponse: false },
      logMissingCacheState: false,
      preserveCurrentPoolPatch: null,
      retryPlan: null,
      seededHydration,
    };
  }

  if (!cacheBootstrapResult.cacheState) {
    return buildMissingCacheStateStopPlan(seededHydration);
  }

  return {
    action: 'continue',
    cacheState: cacheBootstrapResult.cacheState,
    questionData: cacheBootstrapResult.questionData,
    recentPayloadForAccount: cacheBootstrapResult.recentPayloadForAccount,
    seededHydration,
  };
};

export const buildSingleQuestionSeededHydrationState = ({
  prevState = {},
  questionData = null,
  isLoadingResponse = false,
  mergeSurveyResponseState = (previous: unknown) => previous,
}: {
  prevState?: UnknownRecord;
  questionData?: QuestionPayload | null;
  isLoadingResponse?: unknown;
  mergeSurveyResponseState?: (
    previousResponseState: unknown,
    questionPool: QuestionPayload[],
    surveyIndex: number
  ) => unknown;
} = {}) => {
  const seededQuestion = { ...((questionData || {}) as QuestionPayload), id: questionData?.id };
  const previousResponseState =
    prevState.surveysResponseState ||
    [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }];

  return {
    questionPool: [seededQuestion],
    surveysResponseState: mergeSurveyResponseState(previousResponseState, [seededQuestion], 0),
    viewAddressAnswers: '',
    parsedViewAddressAnswers: null,
    noResponse: false,
    isLoadingResponse: !!isLoadingResponse,
  };
};

export const resolveSingleQuestionCacheBootstrap = async ({
  questionId = '',
  effectiveSingleSlug = '',
  responderAddress = '',
  account = '',
  resolveCacheState = async () => null,
  readRecentPayload = () => null,
  canUseRecentPayload = () => false,
  resolveBootstrapNetworkId = () => '',
  updateCacheAtomic = async () => null,
  ensureQuestionsNet = (cache, _netId) => cache as QuestionsCache,
  pickBetterQuestionPayload = (_current, next) => next,
  areQuestionPayloadsEquivalent = (left, right) => left === right,
  writeQuestionsCache = async () => {},
}: {
  questionId?: string;
  effectiveSingleSlug?: string;
  responderAddress?: string;
  account?: string;
  resolveCacheState?: (slug: string) => Promise<CacheState | null>;
  readRecentPayload?: (questionId: string) => unknown;
  canUseRecentPayload?: (payload: unknown, account: string) => boolean;
  resolveBootstrapNetworkId?: (slug: string) => string;
  updateCacheAtomic?: (key: string, slug: string, updater: (current: unknown) => QuestionsCache) => Promise<unknown>;
  ensureQuestionsNet?: (cache: unknown, netId: string) => QuestionsCache;
  pickBetterQuestionPayload?: (current: QuestionPayload | null, next: QuestionPayload) => QuestionPayload | null;
  areQuestionPayloadsEquivalent?: (left: QuestionPayload | null, right: QuestionPayload) => boolean;
  writeQuestionsCache?: (slug: string, cache: QuestionsCache) => Promise<unknown>;
} = {}): Promise<CacheBootstrapResult> => {
  let qData: QuestionPayload | null = null;
  const recentPayload = readRecentPayload(questionId);
  const recentPayloadForAccount = canUseRecentPayload(recentPayload, account)
    ? { ...(recentPayload as UnknownRecord), id: questionId }
    : null;
  let cacheState = await resolveCacheState(effectiveSingleSlug);

  if (!cacheState) {
    if (!recentPayloadForAccount) {
      return { status: 'missing-cache-state' };
    }

    const shouldBootstrapViewedResponse = !!responderAddress;
    qData = { ...recentPayloadForAccount, id: questionId };
    if (!qData.creator) qData.creator = '';
    if (!Array.isArray(qData.tags)) qData.tags = [];

    const fallbackNetId = resolveBootstrapNetworkId(effectiveSingleSlug);
    if (fallbackNetId) {
      const bootstrapCache = await updateCacheAtomic('questionsCache', effectiveSingleSlug, (current) => {
        const nextCache = ensureQuestionsNet(
          (current && typeof current === 'object') ? current : {},
          fallbackNetId,
        );
        nextCache[fallbackNetId].questions[questionId] = {
          ...(nextCache[fallbackNetId].questions[questionId] || {}),
          ...qData,
          id: questionId,
        };
        return nextCache;
      });
      cacheState = {
        netIdStr: fallbackNetId,
        questionsCache: ensureQuestionsNet(bootstrapCache || {}, fallbackNetId),
      };
    }

    return {
      status: 'seeded-from-recent',
      cacheState,
      questionData: qData,
      recentPayloadForAccount,
      shouldBootstrapViewedResponse,
      fallbackNetId,
    };
  }

  const { netIdStr, questionsCache } = cacheState;
  qData = questionsCache[netIdStr].questions?.[questionId];

  if (!qData && recentPayloadForAccount) {
    qData = { ...recentPayloadForAccount, id: questionId };
    questionsCache[netIdStr].questions[questionId] = {
      ...(questionsCache[netIdStr].questions[questionId] || {}),
      ...qData,
    };
    void writeQuestionsCache(effectiveSingleSlug, questionsCache);
  }

  if (qData && recentPayloadForAccount) {
    const pickedFromRecent = pickBetterQuestionPayload(qData, recentPayloadForAccount) || qData;
    const normalizedPicked = { ...pickedFromRecent, id: questionId };
    const shouldWriteRecentUpgrade = !areQuestionPayloadsEquivalent(qData, normalizedPicked);
    qData = normalizedPicked;
    if (shouldWriteRecentUpgrade) {
      questionsCache[netIdStr].questions[questionId] = normalizedPicked;
      void writeQuestionsCache(effectiveSingleSlug, questionsCache);
    }
  }

  return {
    status: 'ready',
    cacheState,
    questionData: qData,
    recentPayloadForAccount,
  };
};
