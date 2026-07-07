import type { UnknownRecord } from './surveyToolTypes';

type QuestionPayload = UnknownRecord & {
  id?: string;
};

type QuestionsCache = Record<
  string,
  {
    questions: Record<string, QuestionPayload | null>;
  } & UnknownRecord
>;

export type MetadataBootstrapCacheState = {
  netIdStr: string;
  questionsCache: QuestionsCache;
};

export type MetadataBootstrapReady = {
  status: 'ready';
  questionData: QuestionPayload | null;
  effectiveSingleSlug: string;
  cacheState: MetadataBootstrapCacheState;
};

export type MetadataBootstrapUnavailable = {
  status: 'unavailable';
  effectiveSingleSlug: string;
  fetchedAny: boolean;
  timedOutFetchCount: number;
  retryReason: string;
};

export type MetadataBootstrapMissingCacheState = {
  status: 'missing-cache-state';
};

export type MetadataBootstrapSkipped = {
  status: 'skipped';
  questionData: QuestionPayload;
  cacheState: MetadataBootstrapCacheState;
};

export type MetadataBootstrapResult =
  MetadataBootstrapReady | MetadataBootstrapUnavailable | MetadataBootstrapMissingCacheState | MetadataBootstrapSkipped;

export type MetadataBootstrapFetchResult = {
  questionData: QuestionPayload | null;
  effectiveSingleSlug: string;
  fetchedAny: boolean;
  timedOutFetchCount: number;
};

export type MetadataBootstrapNormalizationResult = {
  normalizedQuestionData: QuestionPayload | null;
  shouldWriteQuestionPayload: boolean;
};

export type ResolveSingleQuestionMetadataBootstrapArgs = {
  questionId?: string;
  questionData?: QuestionPayload | null;
  effectiveSingleSlug?: string;
  cacheState?: MetadataBootstrapCacheState | null;
  fetchCandidateSlugs?: string[];
  fetchTimeoutMs?: number;
  fetchTimeoutRecoveryMs?: number;
  forceRefetch?: boolean;
  loginComplete?: boolean;
  hasAccount?: boolean;
  isMaskedQuestionPayload?: (payload: QuestionPayload | null) => boolean;
  fetchSingleQuestionMetadataCandidates?: (args: UnknownRecord) => Promise<MetadataBootstrapFetchResult>;
  getQuestionData?: (slug: string) => Promise<unknown>;
  pickBetterQuestionPayload?: (current: QuestionPayload | null, next: QuestionPayload) => QuestionPayload | null;
  areQuestionPayloadsEquivalent?: (left: QuestionPayload | null, right: QuestionPayload) => boolean;
  normalizeSingleQuestionMetadataForCache?: (args: UnknownRecord) => MetadataBootstrapNormalizationResult;
  resolveCacheState?: (slug: string) => Promise<MetadataBootstrapCacheState | null>;
  writeQuestionsCache?: (slug: string, cache: QuestionsCache) => Promise<unknown>;
};

export const resolveSingleQuestionMetadataBootstrap = async ({
  questionId = '',
  questionData = null,
  effectiveSingleSlug = '',
  cacheState = null,
  fetchCandidateSlugs = [],
  fetchTimeoutMs = 8000,
  fetchTimeoutRecoveryMs = 20000,
  forceRefetch = false,
  loginComplete = false,
  hasAccount = false,
  isMaskedQuestionPayload = () => false,
  fetchSingleQuestionMetadataCandidates: fetchMetadata = async () => ({
    questionData: null,
    effectiveSingleSlug: '',
    fetchedAny: false,
    timedOutFetchCount: 0,
  }),
  getQuestionData = async () => null,
  pickBetterQuestionPayload = (_current, next) => next,
  areQuestionPayloadsEquivalent = (left, right) => left === right,
  normalizeSingleQuestionMetadataForCache: normalizeMetadata = () => ({
    normalizedQuestionData: null,
    shouldWriteQuestionPayload: false,
  }),
  resolveCacheState = async () => null,
  writeQuestionsCache = async () => {},
}: ResolveSingleQuestionMetadataBootstrapArgs = {}): Promise<MetadataBootstrapResult> => {
  const shouldRefetchMasked = !!questionData && isMaskedQuestionPayload(questionData) && loginComplete && hasAccount;

  if (!questionData || shouldRefetchMasked || forceRefetch) {
    const metadataFetchResult = await fetchMetadata({
      initialQuestionData: questionData,
      effectiveSingleSlug,
      fetchCandidateSlugs,
      fetchTimeoutMs,
      fetchTimeoutRecoveryMs,
      getQuestionData,
      pickBetterQuestionPayload,
      isMaskedQuestionPayload,
    });

    let qData = metadataFetchResult.questionData;
    const nextEffectiveSingleSlug = metadataFetchResult.effectiveSingleSlug;

    const nextCacheState = await resolveCacheState(nextEffectiveSingleSlug);
    if (!nextCacheState) {
      return { status: 'missing-cache-state' };
    }

    const { netIdStr, questionsCache } = nextCacheState;

    try {
      if (qData && qData.id !== questionId) qData.id = questionId;
    } catch (_error) {
      // Ignore immutable payload/id write failures and continue with normalized output.
    }

    if (!qData && !questionsCache[netIdStr].questions?.[questionId]) {
      return {
        status: 'unavailable',
        effectiveSingleSlug: nextEffectiveSingleSlug,
        fetchedAny: !!metadataFetchResult.fetchedAny,
        timedOutFetchCount: Number(metadataFetchResult.timedOutFetchCount || 0),
        retryReason: metadataFetchResult.fetchedAny
          ? 'no-question-data-yet'
          : metadataFetchResult.timedOutFetchCount > 0
            ? 'question-fetch-timeout'
            : 'question-fetch-unavailable',
      };
    }

    if (!qData) {
      qData = questionsCache[netIdStr].questions?.[questionId];
    }

    const existingCached = questionsCache[netIdStr].questions?.[questionId] || null;
    const { normalizedQuestionData, shouldWriteQuestionPayload } = normalizeMetadata({
      questionId,
      questionData: qData,
      existingCachedQuestionData: existingCached,
      pickBetterQuestionPayload,
      areQuestionPayloadsEquivalent,
    });

    if (shouldWriteQuestionPayload) {
      questionsCache[netIdStr].questions[questionId] = normalizedQuestionData;
      void writeQuestionsCache(nextEffectiveSingleSlug, questionsCache);
    }

    return {
      status: 'ready',
      questionData: normalizedQuestionData,
      effectiveSingleSlug: nextEffectiveSingleSlug,
      cacheState: nextCacheState,
    };
  }

  return {
    status: 'skipped',
    questionData,
    cacheState: cacheState as MetadataBootstrapCacheState,
  };
};
