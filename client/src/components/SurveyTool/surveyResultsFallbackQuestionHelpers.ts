import { runSurveyResultsFallbackQuestionWriteController } from './surveyResultsFallbackQuestionWriteController';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsFallbackQuestion = SurveyResultsRecord & {
  creator?: string;
  id: unknown;
  prompt: string;
  type?: string;
};

export type SurveyResultsFallbackQuestionBuckets = {
  individual: Map<string, SurveyResultsFallbackQuestion>;
  summary: Map<string, SurveyResultsFallbackQuestion>;
};

export type SurveyResultsFallbackQuestionBucketName = 'individual' | 'summary';

export type SurveyResultsFallbackQuestionWritePlan = {
  blockedReason: '' | 'cache-hit';
  fallbackQuestion: SurveyResultsFallbackQuestion;
  payload: SurveyResultsFallbackQuestion | null;
  shouldWrite: boolean;
  target: {
    bucketName: SurveyResultsFallbackQuestionBucketName;
    cacheKey: string;
  };
};

export const createSurveyResultsFallbackQuestionBuckets = (): SurveyResultsFallbackQuestionBuckets => ({
  individual: new Map(),
  summary: new Map(),
});

export const buildSurveyResultsFallbackQuestionWritePlan = (
  buckets: SurveyResultsFallbackQuestionBuckets,
  questionId: unknown,
  mode: unknown = 'summary',
): SurveyResultsFallbackQuestionWritePlan => {
  const cacheKey = String(questionId || '');
  const bucketName: SurveyResultsFallbackQuestionBucketName = mode === 'individual' ? 'individual' : 'summary';
  const bucket = buckets[bucketName];
  const cached = bucket.get(cacheKey);
  const target = { bucketName, cacheKey };
  if (cached) {
    return {
      blockedReason: 'cache-hit',
      fallbackQuestion: cached,
      payload: null,
      shouldWrite: false,
      target,
    };
  }

  const fallback: SurveyResultsFallbackQuestion =
    mode === 'individual'
      ? {
          id: questionId,
          creator: '',
          type: '',
          prompt: '',
        }
      : {
          id: questionId,
          prompt: 'Unknown question',
        };

  return {
    blockedReason: '',
    fallbackQuestion: fallback,
    payload: fallback,
    shouldWrite: true,
    target,
  };
};

export const getSurveyResultsStableFallbackQuestion = (
  buckets: SurveyResultsFallbackQuestionBuckets,
  questionId: unknown,
  mode: unknown = 'summary',
): SurveyResultsFallbackQuestion => {
  const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, questionId, mode);
  const result = runSurveyResultsFallbackQuestionWriteController({
    plan,
    ports: {
      writeFallbackQuestion: (bucketName, cacheKey, payload) => {
        buckets[bucketName].set(cacheKey, payload);
      },
    },
  });
  return result.fallbackQuestion || plan.fallbackQuestion;
};
