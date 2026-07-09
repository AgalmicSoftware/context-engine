import {
  buildSurveyResultsFallbackQuestionWritePlan,
  createSurveyResultsFallbackQuestionBuckets,
} from './surveyResultsFallbackQuestionHelpers';
import { runSurveyResultsFallbackQuestionWriteController } from './surveyResultsFallbackQuestionWriteController';

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
    expect(writeFallbackQuestion).toHaveBeenCalledWith('summary', 'Q-Plan', plan.payload);
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

  it('propagates selected fallback write port failures', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();
    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'summary');
    const error = new Error('fallback write failed');
    const writeFallbackQuestion = jest.fn(() => {
      throw error;
    });

    expect(() =>
      runSurveyResultsFallbackQuestionWriteController({
        plan,
        ports: {
          writeFallbackQuestion,
        },
      }),
    ).toThrow(error);

    expect(writeFallbackQuestion).toHaveBeenCalledTimes(1);
    expect(writeFallbackQuestion).toHaveBeenCalledWith('summary', 'Q-Plan', plan.payload);
  });

  it('allows a subsequent successful selected fallback write after a port failure', () => {
    const buckets = createSurveyResultsFallbackQuestionBuckets();
    const plan = buildSurveyResultsFallbackQuestionWritePlan(buckets, 'Q-Plan', 'summary');
    const error = new Error('fallback write failed');
    const firstWriteFallbackQuestion = jest.fn(() => {
      throw error;
    });
    const secondWriteFallbackQuestion = jest.fn();

    expect(() =>
      runSurveyResultsFallbackQuestionWriteController({
        plan,
        ports: {
          writeFallbackQuestion: firstWriteFallbackQuestion,
        },
      }),
    ).toThrow(error);

    const result = runSurveyResultsFallbackQuestionWriteController({
      plan,
      ports: {
        writeFallbackQuestion: secondWriteFallbackQuestion,
      },
    });

    expect(secondWriteFallbackQuestion).toHaveBeenCalledTimes(1);
    expect(secondWriteFallbackQuestion).toHaveBeenCalledWith('summary', 'Q-Plan', plan.payload);
    expect(result.attempted).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.fallbackQuestion).toBe(plan.fallbackQuestion);
  });
});
