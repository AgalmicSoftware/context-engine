import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { getPolisDemoQuestionPool } from './surveyPolisDemoQuestionPool.js';

type SurveyResultsDemoQuestionRecord = Record<string, unknown> & {
  __ceQuestionMetadataPending?: unknown;
  id?: unknown;
  tags?: unknown;
};

type SurveyResultsDemoQuestionBucket = Record<string, unknown> & {
  questionResponses?: Record<string, unknown>;
  questions?: Record<string, unknown>;
};

export type SurveyResultsDemoQuestionFallbackPorts = {
  isDemoFixtureResponse: (responseData: unknown) => boolean;
  parseResponse: (responseData: unknown) => unknown;
};

export const isSurveyResultsDemoQuestionResultsContext = ({
  effectiveSlug = '',
  viewMode = 'questions',
}: {
  effectiveSlug?: unknown;
  viewMode?: unknown;
} = {}): boolean => (
  String(viewMode || '').trim().toLowerCase() === 'questions' &&
  isDemoSessionSlug(String(effectiveSlug || ''))
);

export const hasSurveyResultsQuestionResponseEntries = (
  bucket: SurveyResultsDemoQuestionBucket | null | undefined,
  ports: SurveyResultsDemoQuestionFallbackPorts
): boolean => {
  const questionResponses = bucket?.questionResponses;
  if (!questionResponses || typeof questionResponses !== 'object') return false;
  return Object.values(questionResponses).some((responderMap) => (
    !!responderMap &&
    typeof responderMap === 'object' &&
    Object.values(responderMap as Record<string, unknown>).some((responseData) => (
      !ports.isDemoFixtureResponse(ports.parseResponse(responseData))
    ))
  ));
};

export const isBuiltInDemoPendingQuestionMetadataPlaceholder = (
  question: SurveyResultsDemoQuestionRecord | null | undefined
): boolean => (
  !!question && question.__ceQuestionMetadataPending === true
);

export const buildSurveyResultsBuiltInDemoQuestionFallbackMap = (
  bucket: SurveyResultsDemoQuestionBucket | null | undefined,
  ports: SurveyResultsDemoQuestionFallbackPorts,
  bucketSlug: unknown = ''
): Record<string, SurveyResultsDemoQuestionRecord> => {
  const normalizedBucketSlug = normalizeSessionSlug(bucketSlug || '');
  const existingQuestions = bucket?.questions && typeof bucket.questions === 'object'
    ? bucket.questions
    : {};
  const responseQuestionIds = new Set<string>();
  Object.entries(bucket?.questionResponses || {}).forEach(([qid, responderMap]) => {
    const questionId = String(qid || '').trim().toLowerCase();
    if (!questionId || !responderMap || typeof responderMap !== 'object') return;
    const hasLiveResponse = Object.values(responderMap as Record<string, unknown>).some((responseData) => (
      !ports.isDemoFixtureResponse(ports.parseResponse(responseData))
    ));
    if (hasLiveResponse) responseQuestionIds.add(questionId);
  });
  const out: Record<string, SurveyResultsDemoQuestionRecord> = {};
  getPolisDemoQuestionPool().forEach((entry) => {
    const questionId = String(entry?.id || '').trim().toLowerCase();
    if (!questionId) return;
    if (!responseQuestionIds.has(questionId)) return;
    const existingQuestion = existingQuestions[questionId] as SurveyResultsDemoQuestionRecord | undefined;
    if (
      Object.prototype.hasOwnProperty.call(existingQuestions, questionId) &&
      !isBuiltInDemoPendingQuestionMetadataPlaceholder(existingQuestion)
    ) {
      return;
    }
    out[questionId] = {
      ...entry,
      creator: '',
      id: questionId,
      sessionSlug: normalizedBucketSlug,
      sessionSlugExplicit: true,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
    };
  });
  return out;
};

export const applySurveyResultsBuiltInDemoQuestionMetadataFallbackToBucket = ({
  bucket,
  bucketSlug = '',
  effectiveSlug = '',
  ports,
  viewMode = 'questions',
}: {
  bucket: SurveyResultsDemoQuestionBucket | null | undefined;
  bucketSlug?: unknown;
  effectiveSlug?: unknown;
  ports: SurveyResultsDemoQuestionFallbackPorts;
  viewMode?: unknown;
}): SurveyResultsDemoQuestionBucket => {
  const sourceBucket = bucket && typeof bucket === 'object'
    ? bucket
    : {};
  if (!isSurveyResultsDemoQuestionResultsContext({ effectiveSlug, viewMode })) {
    return sourceBucket;
  }
  if (!hasSurveyResultsQuestionResponseEntries(sourceBucket, ports)) {
    return sourceBucket;
  }
  const fallbackQuestions = buildSurveyResultsBuiltInDemoQuestionFallbackMap(
    sourceBucket,
    ports,
    bucketSlug
  );
  if (Object.keys(fallbackQuestions).length === 0) return sourceBucket;
  return {
    ...sourceBucket,
    questions: {
      ...(sourceBucket.questions || {}),
      ...fallbackQuestions,
    },
  };
};
