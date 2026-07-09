import {
  buildPileEmptyProbePlan,
  buildPileLoadFailureState,
  buildPileLoadProgressState,
} from './surveyPileLoadPlanner';

describe('surveyPileLoadPlanner', () => {
  it('derives pile load progress signals for hydrate settlement and unready-empty fallback', () => {
    expect(
      buildPileLoadProgressState({
        scopedProgress: {
          phase: 'hydrate',
          discoveredQuestions: 4,
          hydratedQuestions: 4,
        },
        cacheHasLoaded: true,
        isQuestionCacheReady: false,
        recentRateLimit: false,
      }),
    ).toEqual({
      scanTotalBlocks: 0,
      scanRemainingBlocks: 0,
      hydrateDiscovered: 4,
      hydrateDone: 4,
      hasScanOrHydrationWork: false,
      hydrationProgressSettled: true,
      canSettleUnreadyEmpty: true,
    });
  });

  it('keeps unready-empty settlement closed while a recent rate limit is active', () => {
    expect(
      buildPileLoadProgressState({
        scopedProgress: {
          phase: 'hydrate',
          discoveredQuestions: 4,
          hydratedQuestions: 4,
        },
        cacheHasLoaded: true,
        isQuestionCacheReady: false,
        recentRateLimit: true,
      }),
    ).toEqual({
      scanTotalBlocks: 0,
      scanRemainingBlocks: 0,
      hydrateDiscovered: 4,
      hydrateDone: 4,
      hasScanOrHydrationWork: false,
      hydrationProgressSettled: true,
      canSettleUnreadyEmpty: false,
    });
  });

  it('keeps pile loading immediately when cold boot, metadata retries, or active work are present', () => {
    expect(
      buildPileEmptyProbePlan({
        cacheHasLoaded: false,
        isQuestionCacheReady: true,
        nowMs: 5000,
      }),
    ).toEqual(
      expect.objectContaining({
        action: 'continue-loading-immediately',
        nextProbeStartedAtMs: 0,
        nextProbeDelayMs: 0,
      }),
    );

    expect(
      buildPileEmptyProbePlan({
        cacheHasLoaded: true,
        isQuestionCacheReady: false,
        hasPendingMetadataRetries: true,
        nowMs: 5000,
      }),
    ).toEqual(
      expect.objectContaining({
        action: 'continue-loading-immediately',
      }),
    );

    expect(
      buildPileEmptyProbePlan({
        cacheHasLoaded: true,
        isQuestionCacheReady: true,
        hasScanOrHydrationWork: true,
        nowMs: 5000,
      }),
    ).toEqual(
      expect.objectContaining({
        action: 'continue-loading-immediately',
      }),
    );

    expect(
      buildPileEmptyProbePlan({
        cacheHasLoaded: true,
        isQuestionCacheReady: true,
        recentRateLimit: true,
        emptyReadyProbeStartedAtMs: 2500,
        nowMs: 5000,
      }),
    ).toEqual(
      expect.objectContaining({
        action: 'continue-loading-immediately',
        nextProbeStartedAtMs: 0,
        nextProbeDelayMs: 0,
      }),
    );
  });

  it('schedules an empty probe window before settling uncertain empty piles', () => {
    expect(
      buildPileEmptyProbePlan({
        cacheHasLoaded: true,
        isQuestionCacheReady: true,
        scopedProgress: {
          phase: 'scan',
          totalBlocks: 100,
          remainingBlocks: 0,
          discoveredQuestions: 0,
          hydratedQuestions: 0,
        },
        emptyReadyProbeStartedAtMs: 1000,
        nowMs: 3000,
      }),
    ).toEqual({
      action: 'probe-loading',
      nextProbeStartedAtMs: 1000,
      nextProbeDelayMs: 900,
      progressIndicatesDefinitiveEmpty: false,
    });
  });

  it('settles immediately when progress proves the empty pile is definitive', () => {
    expect(
      buildPileEmptyProbePlan({
        cacheHasLoaded: true,
        isQuestionCacheReady: false,
        canSettleUnreadyEmpty: true,
        hydrationProgressSettled: true,
        scopedProgress: {
          phase: 'hydrate',
          discoveredQuestions: 0,
          hydratedQuestions: 0,
        },
        hydrateDiscovered: 0,
        hydrateDone: 0,
        emptyReadyProbeStartedAtMs: 1000,
        nowMs: 1000,
      }),
    ).toEqual({
      action: 'settle-empty',
      nextProbeStartedAtMs: 0,
      nextProbeDelayMs: 0,
      progressIndicatesDefinitiveEmpty: true,
    });

    expect(
      buildPileEmptyProbePlan({
        cacheHasLoaded: true,
        isQuestionCacheReady: true,
        scopedProgress: {
          phase: 'scan',
          totalBlocks: 0,
          remainingBlocks: 0,
          discoveredQuestions: 0,
          hydratedQuestions: 0,
        },
        scanTotalBlocks: 0,
        scanRemainingBlocks: 0,
        hydrateDiscovered: 0,
        hydrateDone: 0,
        nowMs: 2500,
      }),
    ).toEqual({
      action: 'settle-empty',
      nextProbeStartedAtMs: 0,
      nextProbeDelayMs: 0,
      progressIndicatesDefinitiveEmpty: true,
    });
  });

  it('builds pile load failure fallbacks that keep warming only when cache is unready or rate-limited', () => {
    expect(
      buildPileLoadFailureState({
        isQuestionCacheReady: false,
        recentRateLimit: false,
      }),
    ).toEqual({ loading: true });

    expect(
      buildPileLoadFailureState({
        isQuestionCacheReady: true,
        recentRateLimit: true,
      }),
    ).toEqual({ loading: true });

    expect(
      buildPileLoadFailureState({
        isQuestionCacheReady: true,
        recentRateLimit: false,
      }),
    ).toEqual({ loading: false });
  });
});
