import {
  NO_PENDING_PILE_SUBMIT_TEXT,
  buildPileWorkspaceViewState,
  buildNoPendingPileSubmitFeedbackPlan,
  buildPileSubmitRailViewState,
  buildPileSubmitViewState,
  shouldPreferPileGatedEmptyState,
} from './surveyPileViewState.js';

describe('surveyPileViewState', () => {
  it('builds the pile submit success-badge presentation state', () => {
    expect(buildPileSubmitViewState({
      pendingStats: { total: 0 },
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      pileSubmitTempText: '',
      pileSubmitLabel: 'Submit 0',
      account: ' 0xABCD ',
      isAddress: (value) => value === '0xABCD',
    })).toEqual({
      hasPendingPileChanges: false,
      pileSubmittedStateActive: true,
      showPileSubmitSuccessBadge: true,
      shouldHidePileSubmitButton: false,
      finalSubmitText: 'Submit 0',
      pileSubmitResponderHref: '/u/0xabcd',
    });
  });

  it('builds the hidden-idle submit presentation state when nothing is pending', () => {
    expect(buildPileSubmitViewState({
      pendingStats: { total: 0 },
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      pileSubmitTempText: 'No new or changed responses',
      pileSubmitLabel: 'Submit 0',
    })).toEqual({
      hasPendingPileChanges: false,
      pileSubmittedStateActive: false,
      showPileSubmitSuccessBadge: false,
      shouldHidePileSubmitButton: true,
      finalSubmitText: 'No new or changed responses',
      pileSubmitResponderHref: '',
    });
  });

  it('builds the staged no-pending pile submit feedback plan', () => {
    expect(buildNoPendingPileSubmitFeedbackPlan({
      submitLabel: 'Submit 0',
    })).toEqual({
      initialText: NO_PENDING_PILE_SUBMIT_TEXT,
      restoreText: 'Submit 0',
      clearText: null,
      initialDelayMs: 2000,
      clearDelayMs: 1500,
    });
  });

  it('builds the pile submit rail state for pending and submitted branches', () => {
    expect(buildPileSubmitRailViewState({
      pendingStats: { total: 2 },
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      pileSubmitTempText: '',
      pileSubmitLabel: 'Submit 2',
      account: '',
    })).toEqual({
      hasPendingPileChanges: true,
      pileSubmittedStateActive: false,
      showPileSubmitSuccessBadge: false,
      shouldHidePileSubmitButton: false,
      finalSubmitText: 'Submit 2',
      pileSubmitResponderHref: '',
      pileTopRailVisible: true,
      showSubmitButton: true,
      showSuccessBadgeLink: false,
      showSuccessBadgeStatus: false,
      showClearPendingButton: true,
    });

    expect(buildPileSubmitRailViewState({
      pendingStats: { total: 0 },
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      pileSubmitTempText: '',
      pileSubmitLabel: 'Submit 0',
      account: '0xABCD',
      isAddress: (value) => value === '0xABCD',
    })).toEqual({
      hasPendingPileChanges: false,
      pileSubmittedStateActive: true,
      showPileSubmitSuccessBadge: true,
      shouldHidePileSubmitButton: false,
      finalSubmitText: 'Submit 0',
      pileSubmitResponderHref: '/u/0xabcd',
      pileTopRailVisible: true,
      showSubmitButton: false,
      showSuccessBadgeLink: true,
      showSuccessBadgeStatus: false,
      showClearPendingButton: false,
    });
  });

  it('prefers gated pile empty state only after load settles and hidden questions remain', () => {
    expect(shouldPreferPileGatedEmptyState({
      hasConcreteHiddenQuestions: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      cacheHasLoaded: true,
      recentRateLimit: false,
      hasPendingMetadataRetries: false,
    })).toBe(true);

    expect(shouldPreferPileGatedEmptyState({
      hasConcreteHiddenQuestions: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      cacheHasLoaded: false,
      recentRateLimit: false,
      hasPendingMetadataRetries: false,
    })).toBe(false);
  });

  it('builds filtered-empty pile workspace state once filters settle the empty result', () => {
    expect(buildPileWorkspaceViewState({
      pileQuestions: [],
      activePileIndex: 0,
      loading: true,
      hiddenMaskedQuestionIds: [],
      hasHiddenGatedQuestions: false,
      firstBoot: false,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      scanRemainingBlocks: 37500,
      hydrateDiscovered: 0,
      hydrateDone: 0,
      pendingMetadataCount: 0,
      questionScanPhase: 'scan',
      isHydratingPriorResponses: false,
      isFilterActive: true,
      hasFilterBaseQuestions: true,
    })).toEqual(expect.objectContaining({
      activeQuestion: null,
      activePromptMasked: false,
      hasVisibleQuestions: false,
      showFilteredEmptyState: true,
      showGatedEmptyState: false,
      isStillLoading: false,
      showMiniBackgroundSpinner: false,
    }));
  });

  it('builds active-question pile workspace state for masked prompts during background refresh', () => {
    expect(buildPileWorkspaceViewState({
      pileQuestions: [
        { id: 'q1', prompt: 'First question', promptDecrypted: true },
        { id: 'q2', prompt: '[encrypted]', promptDecrypted: false },
      ],
      activePileIndex: 1,
      loading: false,
      hiddenMaskedQuestionIds: [],
      hasHiddenGatedQuestions: false,
      firstBoot: false,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      scanRemainingBlocks: 12,
      hydrateDiscovered: 0,
      hydrateDone: 0,
      pendingMetadataCount: 0,
      questionScanPhase: 'scan',
      isHydratingPriorResponses: false,
      isFilterActive: false,
      hasFilterBaseQuestions: true,
    })).toEqual(expect.objectContaining({
      activeQuestion: { id: 'q2', prompt: '[encrypted]', promptDecrypted: false },
      activePromptMasked: true,
      hasVisibleQuestions: true,
      hasScanOrHydrationWork: true,
      isStillLoading: false,
      showMiniBackgroundSpinner: true,
    }));
  });
});
