import {
  resolveSessionSurveyAvailability,
  type MainSiteRouteCapabilityContext,
} from './mainSiteRouteCapabilityRuntime';

jest.mock('../../utilities/survey/workerCanonicalCacheIdentity', () => ({
  resolveWorkerCanonicalCacheIdentity: jest.fn(() => ({ key: 'this-worker' })),
  workerCanonicalCacheIdentityMatches: jest.fn(
    (node: { identity?: string } | null, expected: { key: string }) => node?.identity === expected.key,
  ),
}));

type Input = Parameters<typeof resolveSessionSurveyAvailability>[0];
const contextFor = (cacheScope: string) => ({ cacheScope }) as MainSiteRouteCapabilityContext;
const cacheOf = (value: unknown) => value as Input['cache'];
const resolve = (overrides: Partial<Input> = {}) =>
  resolveSessionSurveyAvailability({
    cache: cacheOf({ 84532: { surveys: {} } }),
    context: contextFor('84532'),
    sessionConfig: { slug: 'meadow' },
    sessionSlug: 'meadow',
    cacheReady: true,
    cacheError: false,
    ...overrides,
  });

describe('resolveSessionSurveyAvailability', () => {
  it('is none only once the session loaded without error and holds no surveys', () => {
    expect(resolve()).toBe('none');
  });

  it('is some when the session holds a survey, or its config highlights one', () => {
    expect(resolve({ cache: cacheOf({ 84532: { surveys: { s1: {} } } }) })).toBe('some');
    expect(resolve({ sessionConfig: { slug: 'meadow', HIGHLIGHTED_SURVEY_IDS: ['s1'] } })).toBe('some');
    // Surveys already seen stay offered while a refresh is still loading.
    expect(resolve({ cache: cacheOf({ 84532: { surveys: { s1: {} } } }), cacheReady: false })).toBe('some');
  });

  it('is unknown while loading, after a failed load, or with no cache for the session', () => {
    expect(resolve({ cacheReady: false })).toBe('unknown');
    expect(resolve({ cacheError: true })).toBe('unknown');
    expect(resolve({ cache: null })).toBe('unknown');
    expect(resolve({ cache: cacheOf({ 11155111: { surveys: {} } }) })).toBe('unknown');
    expect(resolve({ context: contextFor('') })).toBe('unknown');
  });

  it("reads a Worker session's cache only when that Worker wrote it", () => {
    const worker = { context: contextFor('worker') };
    expect(resolve({ ...worker, cache: cacheOf({ worker: { identity: 'this-worker', surveys: {} } }) })).toBe('none');
    expect(resolve({ ...worker, cache: cacheOf({ worker: { identity: 'other-worker', surveys: {} } }) })).toBe(
      'unknown',
    );
    expect(resolve({ ...worker, cache: cacheOf({ worker: { identity: 'other-worker', surveys: { s1: {} } } }) })).toBe(
      'unknown',
    );
  });
});
