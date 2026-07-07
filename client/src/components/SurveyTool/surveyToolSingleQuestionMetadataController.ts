import type { UnknownRecord } from './surveyToolTypes';

type QuestionPayload = UnknownRecord & {
  creator?: unknown;
  encryption?: unknown;
  id?: string;
  sessionName?: unknown;
  optionsDecrypted?: unknown;
  prompt?: unknown;
  promptDecrypted?: unknown;
  tags?: unknown;
  tagsDecrypted?: unknown;
  type?: unknown;
};

type QuestionsCache = Record<
  string,
  {
    questions?: Record<string, QuestionPayload>;
  } & UnknownRecord
>;

type CacheState = {
  netIdStr: string;
  questionsCache: QuestionsCache;
} | null;

const normalizeQuestionId = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildSingleQuestionEncryptedMetadataPlaceholder = ({
  questionId = '',
  sessionSlug = '',
  existingQuestionData = null,
}: {
  questionId?: unknown;
  sessionSlug?: unknown;
  existingQuestionData?: QuestionPayload | null;
} = {}): QuestionPayload | null => {
  const normalizedQuestionId = normalizeQuestionId(questionId);
  if (!normalizedQuestionId) return null;

  const existing = isRecord(existingQuestionData) ? existingQuestionData : {};
  const type = String(existing.type || '').trim() || 'freeform';
  const sessionName = String(existing.sessionName || sessionSlug || '').trim();
  const encryption = isRecord(existing.encryption)
    ? existing.encryption
    : {
        enabled: true,
        status: 'metadata-pending',
        targets: {
          questions: true,
        },
      };

  return {
    ...existing,
    id: normalizedQuestionId,
    type,
    prompt: '[encrypted]',
    tags: Array.isArray(existing.tags) ? existing.tags : [],
    ...(sessionName ? { sessionName } : {}),
    encryption,
    __ceQuestionMetadataPending: true,
  };
};

export const resolveSingleQuestionCacheState = async ({
  slug = '',
  questionId = '',
  resolveQuestionBootstrapContext = () => ({ networkIdStr: '' }),
  readQuestionsCacheAsync = async () => null,
  ensureQuestionsNet = (cache: unknown) => cache as QuestionsCache,
}: {
  slug?: unknown;
  questionId?: unknown;
  resolveQuestionBootstrapContext?: (slug: string) => { networkIdStr?: string | null | undefined };
  readQuestionsCacheAsync?: (slug: string) => Promise<unknown>;
  ensureQuestionsNet?: (cache: unknown, netId: string) => QuestionsCache;
} = {}): Promise<CacheState> => {
  const normalizedSlug = String(slug || '');
  const normalizedQuestionId = normalizeQuestionId(questionId);
  const context = resolveQuestionBootstrapContext(normalizedSlug);
  let netIdStr = String(context?.networkIdStr || '').trim();
  const rawCache = await readQuestionsCacheAsync(normalizedSlug);
  if (!rawCache || typeof rawCache !== 'object') return null;
  const rawQuestionsCache = rawCache as QuestionsCache;

  if (!netIdStr) {
    const preferredNet = Object.keys(rawQuestionsCache).find((key) => {
      const bucket = rawQuestionsCache[key];
      return !!(bucket && bucket.questions && bucket.questions[normalizedQuestionId]);
    });
    const fallbackNet =
      preferredNet ||
      Object.keys(rawQuestionsCache).find(
        (key) => rawQuestionsCache[key] && typeof rawQuestionsCache[key] === 'object',
      );
    if (!fallbackNet) return null;
    netIdStr = String(fallbackNet || '').trim();
  }

  if (!netIdStr) return null;
  const questionsCache = ensureQuestionsNet(rawCache, netIdStr);
  if (!questionsCache[netIdStr]) {
    questionsCache[netIdStr] = {
      questionsLatestBlock: 0,
      questions: {},
      questionResponses: {},
      questionResponsesLatestBlock: 0,
    };
  }
  if (!questionsCache[netIdStr].questions) questionsCache[netIdStr].questions = {};
  return { netIdStr, questionsCache };
};

const fetchValueWithTimeout = async ({
  pending = Promise.resolve(null),
  timeoutMs = 8000,
}: {
  pending?: Promise<unknown>;
  timeoutMs?: number;
}) =>
  new Promise<{
    value: unknown;
    timedOut: boolean;
    pending: Promise<unknown> | null;
  }>((resolve) => {
    let settled = false;
    const finalize = (result: { value: unknown; timedOut: boolean; pending: Promise<unknown> | null }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };
    const timeoutId = setTimeout(() => finalize({ value: null, timedOut: true, pending }), timeoutMs);
    pending
      .then((value) => finalize({ value, timedOut: false, pending: null }))
      .catch(() => finalize({ value: null, timedOut: false, pending: null }));
  });

const waitForTimedOutFetchRecovery = async ({
  timedOutFetches = [],
  timeoutRecoveryMs = 20000,
}: {
  timedOutFetches?: Array<{ slug: string; pending: Promise<unknown> }>;
  timeoutRecoveryMs?: number;
}) => {
  if (!Array.isArray(timedOutFetches) || timedOutFetches.length === 0) return null;

  return new Promise<{ slug: string; payload: QuestionPayload } | null>((resolve) => {
    let settled = false;
    let pendingCount = timedOutFetches.length;
    const finalize = (result: { slug: string; payload: QuestionPayload } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };
    const timeoutId = setTimeout(() => finalize(null), timeoutRecoveryMs);

    timedOutFetches.forEach(({ slug, pending }) => {
      Promise.resolve(pending)
        .then((value) => {
          if (settled) return;
          if (value && typeof value === 'object') {
            finalize({ slug, payload: value as QuestionPayload });
            return;
          }
          pendingCount -= 1;
          if (pendingCount <= 0) finalize(null);
        })
        .catch(() => {
          pendingCount -= 1;
          if (!settled && pendingCount <= 0) finalize(null);
        });
    });
  });
};

export const fetchSingleQuestionMetadataCandidates = async ({
  initialQuestionData = null,
  effectiveSingleSlug = '',
  fetchCandidateSlugs = [],
  fetchTimeoutMs = 8000,
  fetchTimeoutRecoveryMs = 20000,
  getQuestionData = async () => null,
  pickBetterQuestionPayload = (_current, next) => next,
  isMaskedQuestionPayload = () => false,
}: {
  initialQuestionData?: QuestionPayload | null;
  effectiveSingleSlug?: unknown;
  fetchCandidateSlugs?: unknown[];
  fetchTimeoutMs?: number;
  fetchTimeoutRecoveryMs?: number;
  getQuestionData?: (slug: string) => Promise<unknown>;
  pickBetterQuestionPayload?: (current: QuestionPayload | null, next: QuestionPayload) => QuestionPayload | null;
  isMaskedQuestionPayload?: (payload: QuestionPayload) => boolean;
} = {}) => {
  let bestQuestionData = initialQuestionData || null;
  let bestSlug = String(effectiveSingleSlug || '');
  let fetchedAny = false;
  const timedOutFetches: Array<{ slug: string; pending: Promise<unknown> }> = [];

  for (const rawCandidateSlug of Array.isArray(fetchCandidateSlugs) ? fetchCandidateSlugs : []) {
    const candidateSlug = String(rawCandidateSlug || '');
    if (!candidateSlug) continue;
    const pending = Promise.resolve(getQuestionData(candidateSlug)).catch(() => null);
    const attemptResult = await fetchValueWithTimeout({
      pending,
      timeoutMs: fetchTimeoutMs,
    });
    if (attemptResult?.timedOut && attemptResult?.pending) {
      timedOutFetches.push({ slug: candidateSlug, pending: attemptResult.pending });
    }
    const fetched =
      attemptResult?.value && typeof attemptResult.value === 'object' ? (attemptResult.value as QuestionPayload) : null;
    if (!fetched) continue;
    fetchedAny = true;
    const picked = pickBetterQuestionPayload(bestQuestionData, fetched);
    if (picked) {
      bestQuestionData = picked;
      bestSlug = candidateSlug;
    }
    const decrypted = !!(picked && (picked.promptDecrypted || picked.optionsDecrypted || picked.tagsDecrypted));
    if (decrypted || (picked && !isMaskedQuestionPayload(picked))) break;
  }

  if (!bestQuestionData && timedOutFetches.length > 0) {
    const recovered = await waitForTimedOutFetchRecovery({
      timedOutFetches,
      timeoutRecoveryMs: fetchTimeoutRecoveryMs,
    });
    if (recovered?.payload) {
      fetchedAny = true;
      const picked = pickBetterQuestionPayload(bestQuestionData, recovered.payload);
      if (picked) {
        bestQuestionData = picked;
        bestSlug = recovered.slug || bestSlug;
      }
    }
  }

  return {
    questionData: bestQuestionData,
    effectiveSingleSlug: bestSlug,
    fetchedAny,
    timedOutFetchCount: timedOutFetches.length,
  };
};

export const normalizeSingleQuestionMetadataForCache = ({
  questionId = '',
  questionData = null,
  existingCachedQuestionData = null,
  pickBetterQuestionPayload = (_current, next) => next,
  areQuestionPayloadsEquivalent = (left: unknown, right: unknown) => left === right,
}: {
  questionId?: unknown;
  questionData?: QuestionPayload | null;
  existingCachedQuestionData?: QuestionPayload | null;
  pickBetterQuestionPayload?: (current: QuestionPayload | null, next: QuestionPayload) => QuestionPayload | null;
  areQuestionPayloadsEquivalent?: (left: unknown, right: unknown) => boolean;
} = {}) => {
  const normalizedQuestionId = normalizeQuestionId(questionId);
  if (!questionData || !normalizedQuestionId) {
    return {
      normalizedQuestionData: null,
      shouldWriteQuestionPayload: false,
    };
  }

  const normalizedInput = {
    ...questionData,
    id: normalizedQuestionId,
  };
  if (!normalizedInput.creator) normalizedInput.creator = '';
  if (!Array.isArray(normalizedInput.tags)) normalizedInput.tags = [];

  const selectedForCache = pickBetterQuestionPayload(existingCachedQuestionData, normalizedInput) || normalizedInput;
  const normalizedQuestionData = {
    ...selectedForCache,
    id: normalizedQuestionId,
  };
  if (!normalizedQuestionData.creator) normalizedQuestionData.creator = '';
  if (!Array.isArray(normalizedQuestionData.tags)) normalizedQuestionData.tags = [];

  return {
    normalizedQuestionData,
    shouldWriteQuestionPayload: !areQuestionPayloadsEquivalent(existingCachedQuestionData, normalizedQuestionData),
  };
};
