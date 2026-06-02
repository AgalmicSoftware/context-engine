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

export const createSurveyResultsFallbackQuestionBuckets = (): SurveyResultsFallbackQuestionBuckets => ({
  individual: new Map(),
  summary: new Map(),
});

export const getSurveyResultsStableFallbackQuestion = (
  buckets: SurveyResultsFallbackQuestionBuckets,
  questionId: unknown,
  mode: unknown = 'summary'
): SurveyResultsFallbackQuestion => {
  const cacheKey = String(questionId || '');
  const bucket = mode === 'individual' ? buckets.individual : buckets.summary;
  const cached = bucket.get(cacheKey);
  if (cached) return cached;

  const fallback: SurveyResultsFallbackQuestion = mode === 'individual'
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
  bucket.set(cacheKey, fallback);
  return fallback;
};
