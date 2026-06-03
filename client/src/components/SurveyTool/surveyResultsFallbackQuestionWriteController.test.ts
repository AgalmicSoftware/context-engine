import {
  buildSurveyResultsFallbackQuestionWritePlan,
  createSurveyResultsFallbackQuestionBuckets,
} from './surveyResultsFallbackQuestionHelpers';
import {
  runSurveyResultsFallbackQuestionWriteController,
} from './surveyResultsFallbackQuestionWriteController';

describe('surveyResultsFallbackQuestionWriteController', () => {
  it('dispatches selected fallback writes with target bucket, key, and payload order', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();
    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'summary');
    const writeFallbackQuestion = jest.fn();

    const result = runSurveyResultsFallbackQuestionWriteController({
      plan,
      ports: {
        writeFallbackQuestion,
      },
    });

    expect(writeFallbackQuestion).toHaveBeenCalledTimes(1);
    expect(writeFallbackQuestion).toHaveBeenCalledWith(
      'summary',
      'Q-Plan',
      plan.payload
    );
    expect(result).toEqual({
      attempted: true,
      fallbackQuestion: plan.fallbackQuestion,
      ok: true,
      statePatch: {},
      target: {
        bucketName: 'summary',
        cacheKey: 'Q-Plan',
      },
    });
    expect(result.fallbackQuestion).toBe(plan.fallbackQuestion);
  });

  it('does not dispatch selected fallback writes when the plan is cache-hit blocked', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();
    const cached = { id: 'Q-Plan', prompt: 'Cached fallback' };
    buckets.summary.set('Q-Plan', cached);
    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'summary');
    const writeFallbackQuestion = jest.fn();

    const result = runSurveyResultsFallbackQuestionWriteController({
      plan,
      ports: {
        writeFallbackQuestion,
      },
    });

    expect(writeFallbackQuestion).not.toHaveBeenCalled();
    expect(result).toEqual({
      attempted: false,
      fallbackQuestion: cached,
      ok: false,
      statePatch: {},
      target: {
        bucketName: 'summary',
        cacheKey: 'Q-Plan',
      },
    });
    expect(result.fallbackQuestion).toBe(cached);
  });

  it('does not dispatch selected fallback writes when no write port is injected', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();
    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'individual');

    const result = runSurveyResultsFallbackQuestionWriteController({ plan });

    expect(result).toEqual({
      attempted: false,
      fallbackQuestion: plan.fallbackQuestion,
      ok: false,
      statePatch: {},
      target: {
        bucketName: 'individual',
        cacheKey: 'Q-Plan',
      },
    });
    expect(buckets.individual.has('Q-Plan')).toBe(false);
  });
});
