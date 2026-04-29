export type CacheBootstrapReady = {
  status: 'ready';
  cacheState: { netIdStr: string; questionsCache: Record<string, any> };
  questionData: any;
  recentPayloadForAccount: any;
};

export type CacheBootstrapSeeded = {
  status: 'seeded-from-recent';
  cacheState: { netIdStr: string; questionsCache: Record<string, any> } | null;
  questionData: any;
  recentPayloadForAccount: any;
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
  ensureQuestionsNet = (cache, _netId) => cache,
  pickBetterQuestionPayload = (_current, next) => next,
  areQuestionPayloadsEquivalent = (left, right) => left === right,
  writeQuestionsCache = async () => {},
}: {
  questionId?: string;
  effectiveSingleSlug?: string;
  responderAddress?: string;
  account?: string;
  resolveCacheState?: (slug: string) => Promise<{ netIdStr: string; questionsCache: Record<string, any> } | null>;
  readRecentPayload?: (questionId: string) => any;
  canUseRecentPayload?: (payload: any, account: string) => boolean;
  resolveBootstrapNetworkId?: (slug: string) => string;
  updateCacheAtomic?: (key: string, slug: string, updater: (current: any) => any) => Promise<any>;
  ensureQuestionsNet?: (cache: any, netId: string) => any;
  pickBetterQuestionPayload?: (current: any, next: any) => any;
  areQuestionPayloadsEquivalent?: (left: any, right: any) => boolean;
  writeQuestionsCache?: (slug: string, cache: any) => Promise<any>;
} = {}): Promise<CacheBootstrapResult> => {
  let qData: any = null;
  const recentPayload = readRecentPayload(questionId);
  const recentPayloadForAccount = canUseRecentPayload(recentPayload, account)
    ? { ...recentPayload, id: questionId }
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
