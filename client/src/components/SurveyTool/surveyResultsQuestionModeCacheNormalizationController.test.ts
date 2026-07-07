import {
  normalizeSurveyResultsQuestionModeCache,
  type SurveyResultsQuestionModeCacheNormalizationPorts,
} from './surveyResultsQuestionModeCacheNormalizationController';

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const createPorts = (): SurveyResultsQuestionModeCacheNormalizationPorts => ({
  isDemoPolisFixtureResponse: (responseData) => (
    toRecord(responseData).source === 'demo-polis-data'
  ),
  isResponseAllowedForSessionSlug: (responseData, requiredSessionSlug) => {
    if (!requiredSessionSlug) return true;
    return String(toRecord(responseData).sessionSlug || '').trim().toLowerCase() === requiredSessionSlug;
  },
  parseResponse: (responseData) => {
    if (typeof responseData !== 'string') return responseData;
    return JSON.parse(responseData);
  },
});

describe('surveyResultsQuestionModeCacheNormalizationController', () => {
  it('keeps live cached responses byte-identical while filtering demo and wrong-session rows', () => {
    const alphaRaw = JSON.stringify({
      answer: { value: 'Alpha' },
      sessionSlug: 'demo',
      timeStamp: 2,
    });
    const wrongSessionRaw = JSON.stringify({
      answer: { value: 'Wrong session' },
      sessionSlug: 'other',
    });
    const demoRaw = JSON.stringify({
      source: 'demo-polis-data',
      sessionSlug: 'demo',
    });
    const betaResponse = {
      answer: { value: 'Beta' },
      sessionSlug: 'demo',
      timeStamp: 3,
    };

    const result = normalizeSurveyResultsQuestionModeCache({
      ports: createPorts(),
      questionResponses: {
        'Q-One': {
          '0xAAA': alphaRaw,
          '0xBBB': wrongSessionRaw,
          '0xCCC': demoRaw,
        },
        'Q-Two': {
          '0xDDD': betaResponse,
        },
        '  ': {
          '0xEEE': { answer: { value: 'ignored' }, sessionSlug: 'demo' },
        },
      },
      questions: {
        'Q-One': { id: 'Q-One', prompt: 'Live one' },
        'Q-Two': { id: 'Q-Two', prompt: 'Live two' },
        'Q-Polis': { id: 'Q-Polis', prompt: 'Fixture', source: 'demo-polis-data' },
      },
      requiredSessionSlug: 'demo',
    });

    expect(result.questionResponses).toEqual({
      'q-one': {
        '0xAAA': alphaRaw,
      },
      'q-two': {
        '0xDDD': betaResponse,
      },
    });
    expect(result.liveQuestionIds).toEqual(new Set(['q-one', 'q-two']));
    expect(result.questions).toEqual({
      'q-one': { id: 'Q-One', prompt: 'Live one' },
      'q-two': { id: 'Q-Two', prompt: 'Live two' },
    });
  });

  it('keeps non-demo question metadata even when no live response exists', () => {
    const result = normalizeSurveyResultsQuestionModeCache({
      ports: createPorts(),
      questionResponses: {},
      questions: {
        q1: { id: 'q1', prompt: 'No responses yet' },
        qdemo: { id: 'qdemo', prompt: 'Fixture', source: 'demo-polis-data' },
      },
    });

    expect(result.questionResponses).toEqual({});
    expect(result.questions).toEqual({
      q1: { id: 'q1', prompt: 'No responses yet' },
    });
  });
});
