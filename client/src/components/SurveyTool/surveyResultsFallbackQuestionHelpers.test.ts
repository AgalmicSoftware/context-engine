import {
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
});
