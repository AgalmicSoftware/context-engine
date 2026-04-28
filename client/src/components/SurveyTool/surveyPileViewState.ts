export const NO_PENDING_PILE_SUBMIT_TEXT = 'No new or changed responses';

export type PilePendingStatsLike = {
  total?: number | null;
};

export type PileSubmitViewState = {
  hasPendingPileChanges: boolean;
  pileSubmittedStateActive: boolean;
  showPileSubmitSuccessBadge: boolean;
  shouldHidePileSubmitButton: boolean;
  finalSubmitText: string;
  pileSubmitResponderHref: string;
};

export type PileSubmitRailViewState = PileSubmitViewState & {
  pileTopRailVisible: boolean;
  showSubmitButton: boolean;
  showSuccessBadgeLink: boolean;
  showSuccessBadgeStatus: boolean;
  showClearPendingButton: boolean;
};

export const buildPileSubmitViewState = ({
  pendingStats,
  isSubmitting = false,
  submittedSinceLastEdit = false,
  submissionComplete = false,
  pileSubmitTempText = '',
  pileSubmitLabel = '',
  account = '',
  isAddress = () => false,
}: {
  pendingStats?: PilePendingStatsLike | null;
  isSubmitting?: boolean;
  submittedSinceLastEdit?: boolean;
  submissionComplete?: boolean;
  pileSubmitTempText?: string | null;
  pileSubmitLabel?: string | null;
  account?: string | null;
  isAddress?: (value: string) => boolean;
} = {}): PileSubmitViewState => {
  const hasPendingPileChanges = Number(pendingStats?.total || 0) > 0;
  const pileSubmittedStateActive = !!(submittedSinceLastEdit || submissionComplete);
  const showPileSubmitSuccessBadge = pileSubmittedStateActive && !isSubmitting;
  const shouldHidePileSubmitButton = (
    !hasPendingPileChanges &&
    !isSubmitting &&
    !pileSubmittedStateActive
  );
  const finalSubmitText = String(pileSubmitTempText || '') || String(pileSubmitLabel || '');

  const pileSubmitResponderAddress = String(account || '').trim();
  const pileSubmitResponderAddressLower =
    pileSubmitResponderAddress && isAddress(pileSubmitResponderAddress)
      ? pileSubmitResponderAddress.toLowerCase()
      : '';

  return {
    hasPendingPileChanges,
    pileSubmittedStateActive,
    showPileSubmitSuccessBadge,
    shouldHidePileSubmitButton,
    finalSubmitText,
    pileSubmitResponderHref: pileSubmitResponderAddressLower
      ? `/u/${pileSubmitResponderAddressLower}`
      : '',
  };
};

export const buildPileSubmitRailViewState = ({
  isSubmitting = false,
  ...rest
}: {
  pendingStats?: PilePendingStatsLike | null;
  isSubmitting?: boolean;
  submittedSinceLastEdit?: boolean;
  submissionComplete?: boolean;
  pileSubmitTempText?: string | null;
  pileSubmitLabel?: string | null;
  account?: string | null;
  isAddress?: (value: string) => boolean;
} = {}): PileSubmitRailViewState => {
  const submitViewState = buildPileSubmitViewState({
    ...rest,
    isSubmitting,
  });

  const pileTopRailVisible = (
    !!isSubmitting ||
    submitViewState.hasPendingPileChanges ||
    submitViewState.pileSubmittedStateActive
  );
  const showSubmitButton = !submitViewState.showPileSubmitSuccessBadge;
  const showSuccessBadgeLink =
    submitViewState.showPileSubmitSuccessBadge &&
    !!submitViewState.pileSubmitResponderHref;
  const showSuccessBadgeStatus =
    submitViewState.showPileSubmitSuccessBadge &&
    !submitViewState.pileSubmitResponderHref;
  const showClearPendingButton = (
    submitViewState.hasPendingPileChanges &&
    !isSubmitting &&
    !submitViewState.pileSubmittedStateActive
  );

  return {
    ...submitViewState,
    pileTopRailVisible,
    showSubmitButton,
    showSuccessBadgeLink,
    showSuccessBadgeStatus,
    showClearPendingButton,
  };
};

export type PileNoPendingSubmitFeedbackPlan = {
  initialText: string;
  restoreText: string;
  clearText: null;
  initialDelayMs: number;
  clearDelayMs: number;
};

export const buildNoPendingPileSubmitFeedbackPlan = ({
  submitLabel = '',
  initialDelayMs = 2000,
  clearDelayMs = 1500,
}: {
  submitLabel?: string | null;
  initialDelayMs?: number;
  clearDelayMs?: number;
} = {}): PileNoPendingSubmitFeedbackPlan => ({
  initialText: NO_PENDING_PILE_SUBMIT_TEXT,
  restoreText: String(submitLabel || ''),
  clearText: null,
  initialDelayMs: Math.max(0, Number(initialDelayMs) || 0),
  clearDelayMs: Math.max(0, Number(clearDelayMs) || 0),
});
