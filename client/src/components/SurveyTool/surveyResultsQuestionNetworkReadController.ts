import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { normalizeSurveyResultsBlockNumber } from './surveyResultsBlockNumbers.js';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsQuestionRecord = SurveyResultsRecord & {
  __ceQuestionMetadataPending?: unknown;
  id?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
};

export type SurveyResultsQuestionResponsesByResponder = Record<string, unknown>;
export type SurveyResultsQuestionResponsesByQuestion = Record<string, SurveyResultsQuestionResponsesByResponder>;

export type SurveyResultsQuestionBucketRecord = SurveyResultsRecord & {
  questionResponses?: SurveyResultsQuestionResponsesByQuestion;
  questionResponsesLatestBlock?: unknown;
  questions?: Record<string, SurveyResultsQuestionRecord>;
  questionsLatestBlock?: unknown;
};

export type SurveyResultsScopedQuestionNetworkData = {
  questionResponses: SurveyResultsQuestionResponsesByQuestion;
  questionResponsesLatestBlock: number;
  questions: Record<string, SurveyResultsQuestionRecord>;
  questionsLatestBlock: number;
};

export type SurveyResultsScopedQuestionNetworkEntry = {
  bucket?: SurveyResultsQuestionBucketRecord | null;
  slug?: unknown;
};

export type SurveyResultsScopedQuestionNetworkOptions = {
  allowedScopeSlugs?: Set<string> | unknown[] | null;
  requireAuthoritativeBinding?: boolean;
};

export type SurveyResultsScopedQuestionNetworkMemo = {
  bucketRefs?: unknown[];
  netIdStr?: string;
  requireAuthoritativeBinding?: boolean;
  result?: SurveyResultsScopedQuestionNetworkData;
  slugsKey?: string;
  viewMode?: unknown;
};

export type SurveyResultsQuestionNetworkReadControllerPorts = {
  readQuestionBucket?: (slug: string, netIdStr: string) => unknown;
};

export type SurveyResultsQuestionNetworkAsyncReadControllerPorts = {
  peekQuestionBucket?: (slug: string, netIdStr: string) => unknown;
  readQuestionBucket?: (slug: string, netIdStr: string) => Promise<unknown> | unknown;
};

export type SurveyResultsQuestionNetworkReadControllerArgs = {
  netIdStr?: unknown;
  ports?: SurveyResultsQuestionNetworkReadControllerPorts;
  previousMemo?: SurveyResultsScopedQuestionNetworkMemo | null;
  questionReadSlugs?: unknown[] | null;
  requireAuthoritativeBinding?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsQuestionNetworkAsyncReadControllerArgs = {
  netIdStr?: unknown;
  ports?: SurveyResultsQuestionNetworkAsyncReadControllerPorts;
  questionReadSlugs?: unknown[] | null;
  requireAuthoritativeBinding?: unknown;
};

export type SurveyResultsQuestionNetworkReadControllerResult = {
  memo: SurveyResultsScopedQuestionNetworkMemo | null;
  memoHit: boolean;
  result: SurveyResultsScopedQuestionNetworkData;
};

export type SurveyResultsQuestionNetworkAsyncReadControllerResult = {
  result: SurveyResultsScopedQuestionNetworkData;
  statePatch: SurveyResultsRecord;
};

type SurveyResultsQuestionResponseMergeOptions = {
  allowedQuestionIds?: Set<string> | null;
};

type SurveyResultsScopedQuestionOptions = {
  allowedScopeSlugs?: Set<string> | unknown[] | null;
  bucketSlug?: unknown;
  question?: SurveyResultsQuestionRecord;
  requireAuthoritativeBinding?: boolean;
};

export const EMPTY_SCOPED_QUESTION_NETWORK_DATA = Object.freeze({
  questions: {},
  questionResponses: {},
  questionsLatestBlock: 0,
  questionResponsesLatestBlock: 0,
}) as SurveyResultsScopedQuestionNetworkData;

const EMPTY_QUESTION_BUCKET: SurveyResultsQuestionBucketRecord = Object.freeze({
  questionsLatestBlock: 0,
  questions: {},
  questionResponses: {},
  questionResponsesLatestBlock: 0,
});

const hasOwn = (obj: unknown, key: PropertyKey): boolean => !!obj && Object.prototype.hasOwnProperty.call(obj, key);

const toSlugList = (value: unknown[] | null | undefined): string[] =>
  Array.isArray(value) ? value.map((slug) => String(slug || '')) : [];

const toQuestionBucket = (value: unknown): SurveyResultsQuestionBucketRecord =>
  value && typeof value === 'object' ? (value as SurveyResultsQuestionBucketRecord) : EMPTY_QUESTION_BUCKET;

function mergeQuestionResponsesByQuestion(
  accumulator: SurveyResultsQuestionResponsesByQuestion = {},
  questionResponses: unknown = {},
  options: SurveyResultsQuestionResponseMergeOptions = {},
): SurveyResultsQuestionResponsesByQuestion {
  const target = accumulator && typeof accumulator === 'object' ? accumulator : {};
  const source =
    questionResponses && typeof questionResponses === 'object'
      ? (questionResponses as SurveyResultsQuestionResponsesByQuestion)
      : {};
  const allowedQuestionIds = options.allowedQuestionIds instanceof Set ? options.allowedQuestionIds : null;
  Object.keys(source).forEach((questionId) => {
    const lowerQuestionId = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!lowerQuestionId) return;
    if (allowedQuestionIds && !allowedQuestionIds.has(lowerQuestionId)) return;
    const responderMap = source[questionId];
    if (!responderMap || typeof responderMap !== 'object') return;
    if (!target[lowerQuestionId] || typeof target[lowerQuestionId] !== 'object') {
      target[lowerQuestionId] = {};
    }
    const targetResponderMap = target[lowerQuestionId];
    Object.keys(responderMap).forEach((responder) => {
      targetResponderMap[responder] = responderMap[responder];
    });
  });
  return target;
}

const hasAuthoritativeQuestionSessionSlug = (question: SurveyResultsQuestionRecord = {}): boolean =>
  hasOwn(question, 'sessionSlug') && question?.sessionSlugExplicit === true;

const isPendingQuestionMetadataPlaceholder = (question: SurveyResultsQuestionRecord = {}): boolean =>
  !!question && question.__ceQuestionMetadataPending === true;

const resolveScopedQuestionSessionSlug = (
  question: SurveyResultsQuestionRecord = {},
  bucketSlug: unknown = '',
): string => {
  const normalizedBucketSlug = normalizeSessionSlug(bucketSlug || '');
  const normalizedQuestionSlug = normalizeSessionSlug(question?.sessionSlug || '');
  if (hasAuthoritativeQuestionSessionSlug(question)) return normalizedQuestionSlug;
  if (hasOwn(question, 'sessionSlug') && question?.sessionSlugExplicit === false) {
    return normalizedBucketSlug;
  }
  return normalizedQuestionSlug || normalizedBucketSlug;
};

const shouldKeepScopedQuestion = ({
  question = {},
  bucketSlug = '',
  allowedScopeSlugs = [],
  requireAuthoritativeBinding = false,
}: SurveyResultsScopedQuestionOptions = {}): boolean => {
  const scopeSet =
    allowedScopeSlugs instanceof Set
      ? allowedScopeSlugs
      : new Set(
          (Array.isArray(allowedScopeSlugs) ? allowedScopeSlugs : []).map((slug) => normalizeSessionSlug(slug || '')),
        );
  if (!scopeSet.size) return true;
  const normalizedQuestionSlug = normalizeSessionSlug(question?.sessionSlug || '');
  if (isPendingQuestionMetadataPlaceholder(question)) return false;
  if (requireAuthoritativeBinding) {
    return hasAuthoritativeQuestionSessionSlug(question) && scopeSet.has(normalizedQuestionSlug);
  }
  return scopeSet.has(resolveScopedQuestionSessionSlug(question, bucketSlug));
};

export function mergeScopedQuestionNetworkData(
  networkEntries: SurveyResultsScopedQuestionNetworkEntry[] = [],
  options: SurveyResultsScopedQuestionNetworkOptions = {},
): SurveyResultsScopedQuestionNetworkData {
  if (!Array.isArray(networkEntries) || networkEntries.length === 0) {
    return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
  }

  const mergedQuestions: Record<string, SurveyResultsQuestionRecord> = {};
  const mergedQuestionResponses: SurveyResultsQuestionResponsesByQuestion = {};
  const allowedScopeSlugs =
    options.allowedScopeSlugs instanceof Set
      ? options.allowedScopeSlugs
      : new Set(
          (Array.isArray(options.allowedScopeSlugs) ? options.allowedScopeSlugs : []).map((slug) =>
            normalizeSessionSlug(slug || ''),
          ),
        );
  const requireAuthoritativeBinding = options.requireAuthoritativeBinding === true;
  let questionsLatestBlock = 0;
  let questionResponsesLatestBlock = 0;

  networkEntries.forEach(({ slug = '', bucket = {} }) => {
    const questionBucket = toQuestionBucket(bucket);
    const allowedQuestionIds: Set<string> = new Set();
    const questions =
      questionBucket.questions && typeof questionBucket.questions === 'object' ? questionBucket.questions : {};
    Object.keys(questions).forEach((questionId) => {
      const lowerQuestionId = String(questionId || '')
        .trim()
        .toLowerCase();
      if (!lowerQuestionId) return;
      const question = questions[questionId] || {};
      if (
        !shouldKeepScopedQuestion({
          question,
          bucketSlug: slug,
          allowedScopeSlugs,
          requireAuthoritativeBinding,
        })
      )
        return;
      allowedQuestionIds.add(lowerQuestionId);
      if (Object.prototype.hasOwnProperty.call(mergedQuestions, lowerQuestionId)) return;
      mergedQuestions[lowerQuestionId] = {
        id: question?.id || questionId,
        ...(question || {}),
        sessionSlug: resolveScopedQuestionSessionSlug(question, slug),
      };
    });

    mergeQuestionResponsesByQuestion(mergedQuestionResponses, questionBucket.questionResponses || {}, {
      allowedQuestionIds,
    });
    questionsLatestBlock = Math.max(
      questionsLatestBlock,
      normalizeSurveyResultsBlockNumber(questionBucket.questionsLatestBlock),
    );
    questionResponsesLatestBlock = Math.max(
      questionResponsesLatestBlock,
      normalizeSurveyResultsBlockNumber(questionBucket.questionResponsesLatestBlock),
    );
  });

  return {
    questions: mergedQuestions,
    questionResponses: mergedQuestionResponses,
    questionsLatestBlock,
    questionResponsesLatestBlock,
  };
}

export const runSurveyResultsQuestionNetworkReadController = ({
  netIdStr = '',
  ports = {},
  previousMemo = null,
  questionReadSlugs = [],
  requireAuthoritativeBinding = false,
  viewMode = 'questions',
}: SurveyResultsQuestionNetworkReadControllerArgs = {}): SurveyResultsQuestionNetworkReadControllerResult => {
  const normalizedNetIdStr = String(netIdStr || '');
  if (!normalizedNetIdStr) {
    return {
      memo: null,
      memoHit: false,
      result: EMPTY_SCOPED_QUESTION_NETWORK_DATA,
    };
  }

  const slugs = toSlugList(questionReadSlugs);
  const slugsKey = slugs.join('|');
  const authoritativeOnly = requireAuthoritativeBinding === true;
  const entries: SurveyResultsScopedQuestionNetworkEntry[] = slugs.map((slug) => ({
    slug,
    bucket: toQuestionBucket(
      typeof ports.readQuestionBucket === 'function'
        ? ports.readQuestionBucket(slug, normalizedNetIdStr)
        : EMPTY_QUESTION_BUCKET,
    ),
  }));
  const bucketRefs = entries.map((entry) => entry.bucket);
  const memo: SurveyResultsScopedQuestionNetworkMemo = previousMemo || {};
  const memoMatches =
    memo.viewMode === viewMode &&
    memo.netIdStr === normalizedNetIdStr &&
    memo.slugsKey === slugsKey &&
    memo.requireAuthoritativeBinding === authoritativeOnly &&
    Array.isArray(memo.bucketRefs) &&
    memo.bucketRefs.length === bucketRefs.length &&
    memo.bucketRefs.every((bucket, index) => bucket === bucketRefs[index]);
  if (memoMatches) {
    return {
      memo,
      memoHit: true,
      result: memo.result || EMPTY_SCOPED_QUESTION_NETWORK_DATA,
    };
  }

  const result = mergeScopedQuestionNetworkData(entries, {
    allowedScopeSlugs: slugs,
    requireAuthoritativeBinding: authoritativeOnly,
  });
  return {
    memo: {
      viewMode,
      netIdStr: normalizedNetIdStr,
      slugsKey,
      requireAuthoritativeBinding: authoritativeOnly,
      bucketRefs,
      result,
    },
    memoHit: false,
    result,
  };
};

export const runSurveyResultsQuestionNetworkAsyncReadController = async ({
  netIdStr = '',
  ports = {},
  questionReadSlugs = [],
  requireAuthoritativeBinding = false,
}: SurveyResultsQuestionNetworkAsyncReadControllerArgs = {}): Promise<SurveyResultsQuestionNetworkAsyncReadControllerResult> => {
  const normalizedNetIdStr = String(netIdStr || '');
  if (!normalizedNetIdStr) {
    return {
      result: EMPTY_SCOPED_QUESTION_NETWORK_DATA,
      statePatch: {},
    };
  }

  const slugs = toSlugList(questionReadSlugs);
  const entries: SurveyResultsScopedQuestionNetworkEntry[] = await Promise.all(
    slugs.map(async (slug) => {
      let bucket =
        typeof ports.peekQuestionBucket === 'function' ? ports.peekQuestionBucket(slug, normalizedNetIdStr) : null;
      if (!bucket || typeof bucket !== 'object' || Object.keys(bucket).length === 0) {
        bucket =
          typeof ports.readQuestionBucket === 'function'
            ? await ports.readQuestionBucket(slug, normalizedNetIdStr)
            : EMPTY_QUESTION_BUCKET;
      }
      return {
        slug,
        bucket: toQuestionBucket(bucket),
      };
    }),
  );

  return {
    result: mergeScopedQuestionNetworkData(entries, {
      allowedScopeSlugs: slugs,
      requireAuthoritativeBinding: requireAuthoritativeBinding === true,
    }),
    statePatch: {},
  };
};
