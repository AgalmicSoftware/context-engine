import { isPendingQuestionMetadataPlaceholder } from './surveyQuestionMetadataPlaceholders.js';

type UnknownRecord = Record<string, unknown>;
type PileScopeQuestionCacheItem = UnknownRecord & {
  id?: unknown;
  creator?: unknown;
  tags?: unknown;
};
type PileScopeNetworkCache = UnknownRecord & {
  pendingQuestionMetadata?: UnknownRecord;
  questions?: Record<string, PileScopeQuestionCacheItem>;
  questionResponses?: UnknownRecord;
};

type ScopeSetReader = (scopeSlug: string) => Set<string>;
type MergeQuestionResponses = (target: UnknownRecord, source: UnknownRecord) => UnknownRecord;
type NormalizeQuestionIdKey = (value: unknown) => string;
type EnsureQuestionsNet = (cache: UnknownRecord, networkIdStr: string) => UnknownRecord;
type ReadQuestionsCacheAsync = (scopeSlug: string) => Promise<unknown>;

export type PileScopeCacheSnapshot = {
  allResponses: UnknownRecord;
  allQuestions: UnknownRecord[];
  highlightedQuestionIds: Set<string>;
  pendingMetadataCount: number;
};

const EMPTY_SCOPE_CACHE_SNAPSHOT = (): PileScopeCacheSnapshot => ({
  allResponses: {},
  allQuestions: [],
  highlightedQuestionIds: new Set<string>(),
  pendingMetadataCount: 0,
});

export const buildPileResponseCounts = ({
  questionResponses = {},
}: {
  questionResponses?: UnknownRecord | null;
} = {}): Record<string, number> => {
  const nextResponseCounts: Record<string, number> = {};
  const responses = questionResponses && typeof questionResponses === 'object' ? questionResponses : {};

  Object.keys(responses).forEach((questionId) => {
    const responderMap = responses[questionId];
    nextResponseCounts[questionId] =
      responderMap && typeof responderMap === 'object' ? Object.keys(responderMap).length : 0;
  });

  return nextResponseCounts;
};

export const loadPileScopeCacheSnapshot = async ({
  scopeSlugs = [],
  networkIdStr = '',
  readQuestionsCacheAsync = null,
  ensureQuestionsNet = null,
  getHighlightedQuestionIdsSet = null,
  mergeQuestionResponses = null,
  getBlockedQuestionIdsSet = null,
  normalizeQuestionIdKey = null,
}: {
  scopeSlugs?: unknown;
  networkIdStr?: unknown;
  readQuestionsCacheAsync?: ReadQuestionsCacheAsync | null;
  ensureQuestionsNet?: EnsureQuestionsNet | null;
  getHighlightedQuestionIdsSet?: ScopeSetReader | null;
  mergeQuestionResponses?: MergeQuestionResponses | null;
  getBlockedQuestionIdsSet?: ScopeSetReader | null;
  normalizeQuestionIdKey?: NormalizeQuestionIdKey | null;
} = {}): Promise<PileScopeCacheSnapshot> => {
  const networkId = String(networkIdStr || '');
  if (
    !networkId ||
    !Array.isArray(scopeSlugs) ||
    typeof readQuestionsCacheAsync !== 'function' ||
    typeof ensureQuestionsNet !== 'function' ||
    typeof mergeQuestionResponses !== 'function' ||
    typeof getHighlightedQuestionIdsSet !== 'function' ||
    typeof getBlockedQuestionIdsSet !== 'function' ||
    typeof normalizeQuestionIdKey !== 'function'
  ) {
    return EMPTY_SCOPE_CACHE_SNAPSHOT();
  }

  const snapshot = EMPTY_SCOPE_CACHE_SNAPSHOT();
  const seenQuestionIds = new Set<string>();

  for (const rawScopeSlug of scopeSlugs) {
    const scopeSlug = String(rawScopeSlug ?? '');
    const questionsCache = ensureQuestionsNet((await readQuestionsCacheAsync(scopeSlug)) as UnknownRecord, networkId);
    const networkCache =
      questionsCache &&
      typeof questionsCache === 'object' &&
      questionsCache[networkId] &&
      typeof questionsCache[networkId] === 'object'
        ? (questionsCache[networkId] as PileScopeNetworkCache)
        : { questions: {}, questionResponses: {} };

    snapshot.pendingMetadataCount += Object.keys(networkCache?.pendingQuestionMetadata || {}).length;
    getHighlightedQuestionIdsSet(scopeSlug).forEach((questionId) => {
      snapshot.highlightedQuestionIds.add(String(questionId || '').toLowerCase());
    });
    mergeQuestionResponses(snapshot.allResponses, networkCache.questionResponses || {});

    const blockedQuestionIds = getBlockedQuestionIdsSet(scopeSlug);
    Object.keys(networkCache.questions || {}).forEach((questionId) => {
      const question = networkCache.questions?.[questionId];
      if (isPendingQuestionMetadataPlaceholder(question)) return;
      const normalizedQuestionId = normalizeQuestionIdKey(question?.id || questionId);
      if (!normalizedQuestionId || blockedQuestionIds.has(normalizedQuestionId)) return;
      if (seenQuestionIds.has(normalizedQuestionId)) return;

      seenQuestionIds.add(normalizedQuestionId);
      snapshot.allQuestions.push({
        id: normalizedQuestionId,
        creator: question?.creator || '',
        tags: question?.tags || [],
        ...(question || {}),
        sessionSlug: scopeSlug,
      });
    });
  }

  return snapshot;
};
