import {
  buildPileEmptyProbeStatePlan,
  buildPileNoNetworkLoadPlan,
  buildPileResponseCountsCachePlan,
} from './surveyPileLoadController';

describe('surveyPileLoadController', () => {
  it('builds unresolved-network loading plans without redundant state updates', () => {
    expect(
      buildPileNoNetworkLoadPlan({
        currentLoading: true,
        isQuestionCacheReady: false,
        recentRateLimit: false,
      }),
    ).toEqual({
      shouldSkipStateUpdate: true,
      shouldClearLastResultSignature: true,
      nextLoading: true,
      nextState: null,
    });

    expect(
      buildPileNoNetworkLoadPlan({
        currentLoading: false,
        isQuestionCacheReady: true,
        recentRateLimit: true,
      }),
    ).toEqual({
      shouldSkipStateUpdate: false,
      shouldClearLastResultSignature: true,
      nextLoading: true,
      nextState: { loading: true },
    });
  });

  it('reuses cached pile response counts when the scoped cache key is unchanged', () => {
    const cachedCounts = { q1: 3, q2: 1 };

    expect(
      buildPileResponseCountsCachePlan({
        cacheKey: 'edge|84532|9',
        previousCacheKey: 'edge|84532|9',
        previousCacheValue: cachedCounts,
        questionResponses: {
          q1: { '0xabc': { answer: { value: 'yes' } } },
        },
      }),
    ).toEqual({
      responseCounts: cachedCounts,
      nextCacheKey: 'edge|84532|9',
      nextCacheValue: cachedCounts,
      reusedCachedCounts: true,
    });
  });

  it('rebuilds pile response counts when the scoped cache key changes', () => {
    expect(
      buildPileResponseCountsCachePlan({
        cacheKey: 'edge|84532|10',
        previousCacheKey: 'edge|84532|9',
        previousCacheValue: { q1: 99 },
        questionResponses: {
          q1: {
            '0xabc': { answer: { value: 'yes' } },
            '0xdef': { answer: { value: 'no' } },
          },
          q2: {
            '0xabc': { answer: { value: 'yes' } },
          },
        },
      }),
    ).toEqual({
      responseCounts: { q1: 2, q2: 1 },
      nextCacheKey: 'edge|84532|10',
      nextCacheValue: { q1: 2, q2: 1 },
      reusedCachedCounts: false,
    });
  });

  it('builds immediate-empty probe plans that avoid redundant resets when already loading empty', () => {
    expect(
      buildPileEmptyProbeStatePlan({
        action: 'continue-loading-immediately',
        previousPileQuestions: [],
        previousAllQuestionsForFilter: [],
        previousLoading: true,
        areQuestionListsEquivalent: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      }),
    ).toEqual({
      action: 'continue-loading-immediately',
      shouldClearLastResultSignature: true,
      shouldIncrementPileQuestionsGeneration: false,
      shouldBumpNoop: true,
      nextState: null,
      nextProbeStartedAtMs: 0,
      nextProbeDelayMs: 0,
    });

    expect(
      buildPileEmptyProbeStatePlan({
        action: 'continue-loading-immediately',
        previousPileQuestions: [{ id: 'q1' }],
        previousAllQuestionsForFilter: [{ id: 'q1' }],
        previousLoading: false,
        areQuestionListsEquivalent: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      }),
    ).toEqual({
      action: 'continue-loading-immediately',
      shouldClearLastResultSignature: true,
      shouldIncrementPileQuestionsGeneration: true,
      shouldBumpNoop: false,
      nextState: { pileQuestions: [], allQuestionsForFilter: [], loading: true },
      nextProbeStartedAtMs: 0,
      nextProbeDelayMs: 0,
    });
  });

  it('builds probe-loading plans that preserve the next probe schedule and only flip loading when needed', () => {
    expect(
      buildPileEmptyProbeStatePlan({
        action: 'probe-loading',
        nextProbeStartedAtMs: 5000,
        nextProbeDelayMs: 320,
        previousLoading: false,
      }),
    ).toEqual({
      action: 'probe-loading',
      shouldClearLastResultSignature: true,
      shouldIncrementPileQuestionsGeneration: false,
      shouldBumpNoop: false,
      nextState: { loading: true },
      nextProbeStartedAtMs: 5000,
      nextProbeDelayMs: 320,
    });

    expect(
      buildPileEmptyProbeStatePlan({
        action: 'probe-loading',
        nextProbeStartedAtMs: 9000,
        nextProbeDelayMs: 160,
        previousLoading: true,
      }),
    ).toEqual({
      action: 'probe-loading',
      shouldClearLastResultSignature: true,
      shouldIncrementPileQuestionsGeneration: false,
      shouldBumpNoop: false,
      nextState: null,
      nextProbeStartedAtMs: 9000,
      nextProbeDelayMs: 160,
    });
  });
});
