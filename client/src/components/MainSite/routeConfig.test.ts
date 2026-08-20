import {
  KNOWN_ROUTE_PREFIXES,
  QUESTION_RESULTS_RE,
  SURVEY_RESULTS_RE,
  VALID_SURVEY_ID_RE,
  isStaticNonCacheRoute,
} from './routeConfig.js';

describe('routeConfig', () => {
  it('tracks the known MainSite route prefixes', () => {
    expect(KNOWN_ROUTE_PREFIXES.has('survey')).toBe(true);
    expect(KNOWN_ROUTE_PREFIXES.has('session')).toBe(true);
    expect(KNOWN_ROUTE_PREFIXES.has('docs')).toBe(true);
    expect(KNOWN_ROUTE_PREFIXES.has('contracts')).toBe(true);
    expect(KNOWN_ROUTE_PREFIXES.has('posts')).toBe(true);
    expect(KNOWN_ROUTE_PREFIXES.has('benchmarks')).toBe(true);
    expect(KNOWN_ROUTE_PREFIXES.has('unknown')).toBe(false);
  });

  it('identifies static non-cache routes', () => {
    expect(isStaticNonCacheRoute('/debate')).toBe(true);
    expect(isStaticNonCacheRoute('/tag/governance')).toBe(true);
    expect(isStaticNonCacheRoute('/contracts/0xabc')).toBe(true);
    expect(isStaticNonCacheRoute('/docs')).toBe(true);
    expect(isStaticNonCacheRoute('/docs/0xabc')).toBe(true);
    expect(isStaticNonCacheRoute('/docs/privacy')).toBe(true);
    expect(isStaticNonCacheRoute('/posts')).toBe(true);
    expect(isStaticNonCacheRoute('/posts/')).toBe(true);
    expect(isStaticNonCacheRoute('/posts/first-post')).toBe(true);
    expect(isStaticNonCacheRoute('/benchmarks')).toBe(true);
    expect(isStaticNonCacheRoute('/benchmarks/')).toBe(true);
    expect(isStaticNonCacheRoute('/surveys')).toBe(false);
    expect(isStaticNonCacheRoute('/session/edge')).toBe(false);
  });

  it('matches valid survey ids and results routes', () => {
    const surveyId = `0x${'a'.repeat(64)}`;

    expect(VALID_SURVEY_ID_RE.test(surveyId)).toBe(true);
    expect(VALID_SURVEY_ID_RE.test('0xabc')).toBe(false);

    expect(`/survey/${surveyId}/results`.match(SURVEY_RESULTS_RE)).toEqual(expect.arrayContaining([surveyId]));
    expect(`/survey/${surveyId}/results/filtered`.match(SURVEY_RESULTS_RE)).toEqual(
      expect.arrayContaining([surveyId, 'filtered']),
    );
    expect('/survey/not-a-survey/results'.match(SURVEY_RESULTS_RE)).toBeNull();
  });

  it('matches question results routes with optional filter segments', () => {
    expect('/questions/results'.match(QUESTION_RESULTS_RE)).toEqual(
      expect.arrayContaining(['/questions/results', undefined]),
    );
    expect('/questions/results/responded'.match(QUESTION_RESULTS_RE)).toEqual(
      expect.arrayContaining(['/questions/results/responded', 'responded']),
    );
    expect('/questions'.match(QUESTION_RESULTS_RE)).toBeNull();
  });
});
