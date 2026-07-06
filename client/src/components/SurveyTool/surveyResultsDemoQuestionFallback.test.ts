import { getPolisDemoQuestionPool } from './surveyPolisDemoQuestionPool';
import {
  applySurveyResultsBuiltInDemoQuestionMetadataFallbackToBucket,
  buildSurveyResultsBuiltInDemoQuestionFallbackMap,
  hasSurveyResultsQuestionResponseEntries,
  isBuiltInDemoPendingQuestionMetadataPlaceholder,
  isSurveyResultsDemoQuestionResultsContext,
} from './surveyResultsDemoQuestionFallback';

const livePorts = {
  isDemoFixtureResponse: (responseData: unknown): boolean => (
    !!responseData &&
    typeof responseData === 'object' &&
    (responseData as { source?: unknown }).source === 'demo-polis-data'
  ),
  parseResponse: (responseData: unknown): unknown => responseData,
};

describe('surveyResultsDemoQuestionFallback', () => {
  it('detects only demo question results context', () => {
    expect(isSurveyResultsDemoQuestionResultsContext({
      effectiveSlug: 'demo',
      viewMode: 'questions',
    })).toBe(true);
    expect(isSurveyResultsDemoQuestionResultsContext({
      effectiveSlug: 'demo',
      viewMode: 'survey',
    })).toBe(false);
    expect(isSurveyResultsDemoQuestionResultsContext({
      effectiveSlug: 'non-demo',
      viewMode: 'questions',
    })).toBe(false);
  });

  it('ignores fixture-only response buckets', () => {
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(hasSurveyResultsQuestionResponseEntries({
      questionResponses: {
        [demoQuestion.id]: {
          responder1: { source: 'demo-polis-data' },
        },
      },
    }, livePorts)).toBe(false);
    expect(hasSurveyResultsQuestionResponseEntries({
      questionResponses: {
        [demoQuestion.id]: {
          responder1: { source: 'live-cache' },
        },
      },
    }, livePorts)).toBe(true);
  });

  it('builds canonical metadata only for live-response pending placeholders', () => {
    const demoQuestion = getPolisDemoQuestionPool()[0];
    const fallbackMap = buildSurveyResultsBuiltInDemoQuestionFallbackMap({
      questions: {
        [demoQuestion.id]: {
          __ceQuestionMetadataPending: true,
          id: demoQuestion.id,
          prompt: '[encrypted]',
        },
      },
      questionResponses: {
        [demoQuestion.id]: {
          responder1: { source: 'live-cache' },
        },
      },
    }, livePorts, ' Demo ');

    expect(fallbackMap).toEqual({
      [demoQuestion.id]: expect.objectContaining({
        creator: '',
        id: demoQuestion.id,
        prompt: demoQuestion.prompt,
        sessionSlug: 'Demo',
        sessionSlugExplicit: true,
      }),
    });
    expect(Array.isArray(fallbackMap[demoQuestion.id].tags)).toBe(true);
  });

  it('keeps existing non-pending metadata', () => {
    const demoQuestion = getPolisDemoQuestionPool()[0];
    const fallbackMap = buildSurveyResultsBuiltInDemoQuestionFallbackMap({
      questions: {
        [demoQuestion.id]: {
          id: demoQuestion.id,
          prompt: 'Existing live metadata',
        },
      },
      questionResponses: {
        [demoQuestion.id]: {
          responder1: { source: 'live-cache' },
        },
      },
    }, livePorts, 'demo');

    expect(fallbackMap).toEqual({});
  });

  it('applies fallback metadata without changing non-demo or empty buckets', () => {
    const demoQuestion = getPolisDemoQuestionPool()[0];
    const bucket = {
      questions: {
        [demoQuestion.id]: {
          __ceQuestionMetadataPending: true,
          id: demoQuestion.id,
          prompt: '[encrypted]',
        },
      },
      questionResponses: {
        [demoQuestion.id]: {
          responder1: { source: 'live-cache' },
        },
      },
    };

    expect(applySurveyResultsBuiltInDemoQuestionMetadataFallbackToBucket({
      bucket,
      effectiveSlug: 'non-demo',
      ports: livePorts,
      viewMode: 'questions',
    })).toBe(bucket);

    const nextBucket = applySurveyResultsBuiltInDemoQuestionMetadataFallbackToBucket({
      bucket,
      bucketSlug: 'demo',
      effectiveSlug: 'demo',
      ports: livePorts,
      viewMode: 'questions',
    });

    expect(nextBucket).not.toBe(bucket);
    expect(nextBucket.questions?.[demoQuestion.id]).toEqual(expect.objectContaining({
      prompt: demoQuestion.prompt,
      sessionSlug: 'demo',
    }));
  });

  it('detects pending metadata placeholders exactly', () => {
    expect(isBuiltInDemoPendingQuestionMetadataPlaceholder({
      __ceQuestionMetadataPending: true,
    })).toBe(true);
    expect(isBuiltInDemoPendingQuestionMetadataPlaceholder({
      __ceQuestionMetadataPending: false,
    })).toBe(false);
  });
});
