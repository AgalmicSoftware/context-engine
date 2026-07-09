import {
  EMPTY_PILE_RESPONSE_SLICE,
  buildPileAutoDecryptUpdatePlan,
  buildPileComponentUpdatePlan,
  buildPileContextResetState,
  buildPileQuestionProgressSignals,
  pickScopedPileQuestionProgress,
} from './surveyPileLifecycle.js';

describe('surveyPileLifecycle', () => {
  it('scopes pile question progress by slug and derives hydration/completion ticks', () => {
    expect(
      pickScopedPileQuestionProgress({
        progress: { slug: 'edge', phase: 'hydrate' },
        progressSlug: 'edge',
        doesQuestionProgressMatchSlug: (value, slug) => value === slug,
      }),
    ).toEqual({ slug: 'edge', phase: 'hydrate' });

    expect(
      pickScopedPileQuestionProgress({
        progress: { slug: 'other', phase: 'hydrate' },
        progressSlug: 'edge',
        doesQuestionProgressMatchSlug: (value, slug) => value === slug,
      }),
    ).toBeNull();

    expect(
      buildPileQuestionProgressSignals({
        previousProgress: {
          slug: 'edge',
          phase: 'hydrate',
          discoveredQuestions: 4,
          hydratedQuestions: 2,
          pendingMetadataCount: 1,
        },
        nextProgress: {
          slug: 'edge',
          phase: 'complete',
          discoveredQuestions: 4,
          hydratedQuestions: 4,
          pendingMetadataCount: 0,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        prevDiscoveredQuestions: 4,
        nextDiscoveredQuestions: 4,
        prevHydratedQuestions: 2,
        nextHydratedQuestions: 4,
        prevPendingMetadataCount: 1,
        nextPendingMetadataCount: 0,
        progressHydrationTick: true,
        progressCompletedTick: true,
      }),
    );
  });

  it('builds pile context reset state with cleared runtime slices', () => {
    expect(
      buildPileContextResetState({
        submittedSinceLastEdit: true,
      }),
    ).toEqual({
      loading: true,
      pileQuestions: [],
      activePileIndex: 0,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      editBaseline: null,
      surveysResponseState: [{ ...EMPTY_PILE_RESPONSE_SLICE }],
    });
  });

  it('builds auto-decrypt lifecycle plans for blocked resets and refresh sweeps', () => {
    expect(
      buildPileAutoDecryptUpdatePlan({
        providerChanged: true,
        autoDecryptBlocked: true,
        autoDecryptEnabled: true,
      }),
    ).toEqual({
      shouldDisableBlockedAutoDecrypt: true,
      queueAutoDecryptReasons: [],
    });

    expect(
      buildPileAutoDecryptUpdatePlan({
        autoDecryptBlocked: false,
        autoDecryptEnabled: true,
        responseNonceTick: true,
        autoDecryptJustEnabled: true,
        commentsChanged: true,
      }),
    ).toEqual({
      shouldDisableBlockedAutoDecrypt: false,
      queueAutoDecryptReasons: ['pile-state-change', 'pile-enabled', 'pile-comments-toggle'],
    });
  });

  it('builds component update plans for context resets, reloads, and background cleanup', () => {
    expect(
      buildPileComponentUpdatePlan({
        accountChanged: true,
        loading: false,
        showLongLoading: true,
      }),
    ).toEqual({
      shouldResetContext: true,
      cacheUpdatePlan: { action: 'noop', delayMs: 80 },
      shouldClearLongLoading: false,
      shouldDisableBlockedAutoDecrypt: false,
      queueAutoDecryptReasons: [],
    });

    expect(
      buildPileComponentUpdatePlan({
        responseNonceTick: true,
        isOptimistic: false,
        hasLiveEdits: false,
        pileQuestionsLength: 1,
        isQuestionCacheReady: true,
        loading: false,
        showLongLoading: true,
        autoDecryptEnabled: true,
        cacheJustBecameReady: true,
        surveysResponseStateChanged: true,
      }),
    ).toEqual({
      shouldResetContext: false,
      cacheUpdatePlan: { action: 'reload', delayMs: 80 },
      shouldClearLongLoading: true,
      shouldDisableBlockedAutoDecrypt: false,
      queueAutoDecryptReasons: ['pile-state-change'],
    });
  });
});
