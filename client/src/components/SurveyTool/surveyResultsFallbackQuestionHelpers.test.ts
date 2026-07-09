import {
  buildSurveyResultsFallbackQuestionWritePlan,
  createSurveyResultsFallbackQuestionBuckets,
  getSurveyResultsStableFallbackQuestion,
} from './surveyResultsFallbackQuestionHelpers';

describe('surveyResultsFallbackQuestionHelpers', () => {
  it('reuses stable fallback question objects per question and mode', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();

    const summaryA = getSurveyResultsStableFallbackQuestion(buckets, 'q-missing', 'summary');
    const summaryB = getSurveyResultsStableFallbackQuestion(buckets, 'q-missing', 'summary');
    const individualA = getSurveyResultsStableFallbackQuestion(buckets, 'q-missing', 'individual');
    const individualB = getSurveyResultsStableFallbackQuestion(buckets, 'q-missing', 'individual');

    expect(summaryA).toBe(summaryB);
    expect(summaryA).toEqual({ id: 'q-missing', prompt: 'Unknown question' });
    expect(individualA).toBe(individualB);
    expect(individualA).toEqual({
      id: 'q-missing',
      creator: '',
      type: '',
      prompt: '',
    });
    expect(individualA).not.toBe(summaryA);
  });

  it('keeps selected-result fallback writes scoped by mode and identity', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();

    const summary = getSurveyResultsStableFallbackQuestion(buckets, 'Q-Missing', 'summary');
    const individual = getSurveyResultsStableFallbackQuestion(buckets, 'Q-Missing', 'individual');
    const emptySummary = getSurveyResultsStableFallbackQuestion(buckets, '', 'summary');

    expect(buckets.summary.get('Q-Missing')).toBe(summary);
    expect(buckets.individual.get('Q-Missing')).toBe(individual);
    expect(buckets.summary.get('')).toBe(emptySummary);
    expect(buckets.individual.has('')).toBe(false);
    expect(summary).toEqual({
      id: 'Q-Missing',
      prompt: 'Unknown question',
    });
    expect(individual).toEqual({
      id: 'Q-Missing',
      creator: '',
      type: '',
      prompt: '',
    });
    expect(emptySummary).toEqual({
      id: '',
      prompt: 'Unknown question',
    });
  });

  it('plans summary fallback writes without mutating buckets', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();

    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'summary');

    expect(plan).toEqual({
      blockedReason: '',
      fallbackQuestion: {
        id: 'Q-Plan',
        prompt: 'Unknown question',
      },
      payload: {
        id: 'Q-Plan',
        prompt: 'Unknown question',
      },
      shouldWrite: true,
      target: {
        bucketName: 'summary',
        cacheKey: 'Q-Plan',
      },
    });
    expect(plan.payload).toBe(plan.fallbackQuestion);
    expect(buckets.summary.has('Q-Plan')).toBe(false);
  });

  it('plans individual fallback writes with the existing payload shape', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();

    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'individual');

    expect(plan).toEqual({
      blockedReason: '',
      fallbackQuestion: {
        id: 'Q-Plan',
        creator: '',
        type: '',
        prompt: '',
      },
      payload: {
        id: 'Q-Plan',
        creator: '',
        type: '',
        prompt: '',
      },
      shouldWrite: true,
      target: {
        bucketName: 'individual',
        cacheKey: 'Q-Plan',
      },
    });
    expect(plan.payload).toBe(plan.fallbackQuestion);
    expect(buckets.individual.has('Q-Plan')).toBe(false);
  });

  it('blocks fallback writes on cache hits and returns the cached reference', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();
    const cached = { id: 'Q-Plan', prompt: 'Cached fallback' };
    buckets.summary.set('Q-Plan', cached);

    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'summary');

    expect(plan).toEqual({
      blockedReason: 'cache-hit',
      fallbackQuestion: cached,
      payload: null,
      shouldWrite: false,
      target: {
        bucketName: 'summary',
        cacheKey: 'Q-Plan',
      },
    });
    expect(plan.fallbackQuestion).toBe(cached);
  });

  it('recovers selected fallback helper writes after a transient bucket failure', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();
    const originalSet = buckets.summary.set.bind(buckets.summary);
    const error = new Error('fallback bucket write failed');
    const setSpy = jest
      .spyOn(buckets.summary, 'set')
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockImplementation((key, value) => originalSet(key, value));

    expect(() => getSurveyResultsStableFallbackQuestion(buckets, 'Q-Recover', 'summary')).toThrow(error);
    expect(buckets.summary.has('Q-Recover')).toBe(false);

    const recovered = getSurveyResultsStableFallbackQuestion(buckets, 'Q-Recover', 'summary');

    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(buckets.summary.get('Q-Recover')).toBe(recovered);
    expect(recovered).toEqual({
      id: 'Q-Recover',
      prompt: 'Unknown question',
    });

    setSpy.mockRestore();
  });
});
