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
});
