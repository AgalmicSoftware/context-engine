import {
  NO_PENDING_PILE_SUBMIT_TEXT,
  buildNoPendingPileSubmitFeedbackPlan,
  buildPileSubmitRailViewState,
  buildPileSubmitViewState,
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
});
