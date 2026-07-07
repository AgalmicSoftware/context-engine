import type { ReactNode } from 'react';

import { isQuestionPromptMasked, shouldShowPileFullLoadingState } from './surveyToolViewState.js';

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

export type PileWorkspaceViewState = {
  activeQuestion: unknown | null;
  activePromptMasked: boolean;
  hasVisibleQuestions: boolean;
  hydrateDiscovered: number;
  hydrateDone: number;
  pendingMetadataCount: number;
  hasPendingMetadataRetries: boolean;
  isHydrating: boolean;
  hasTerminalScanError: boolean;
  scanErrorMessage: string;
  hydrationProgressSettled: boolean;
  priorResponsesHydrating: boolean;
  hasScanOrHydrationWork: boolean;
  hasConcreteHiddenQuestions: boolean;
  hasUnhydratedGatedQuestions: boolean;
  preferGatedEmptyState: boolean;
  showGatedEmptyState: boolean;
  showFilteredEmptyState: boolean;
  allowUnreadyEmptySettlement: boolean;
  isStillLoading: boolean;
  showMiniBackgroundSpinner: boolean;
};

export type EarlyVisiblePileQuestion = {
  id: string | number;
  prompt?: ReactNode;
  promptDecrypted?: boolean;
};

export const buildPileLoadingElapsedPatch = (loadingElapsedSec: unknown) => ({
  loadingElapsedSec: Number(loadingElapsedSec || 0),
});

export const buildPileShowLongLoadingPatch = (showLongLoading: unknown) => ({
  showLongLoading: !!showLongLoading,
});

export const buildPileLoadingPatch = (loading: unknown) => ({
  loading: !!loading,
});

export const buildPileNavCounterVisiblePatch = (navCounterVisible: unknown) => ({
  navCounterVisible: !!navCounterVisible,
});

export const buildPileSubmitTempTextPatch = (pileSubmitTempText: unknown) => ({
  pileSubmitTempText,
});

export const buildPileFilterActivePatch = (isFilterActive: unknown) => ({
  isFilterActive: !!isFilterActive,
});

export const buildPileSubmissionCompletePatch = (submissionComplete: unknown) => ({
  submissionComplete: !!submissionComplete,
});

export const resolveEarlyVisiblePileQuestions = ({
  pileQuestions = [],
  questionPool = [],
  isFilterActive = false,
}: {
  pileQuestions?: EarlyVisiblePileQuestion[] | null;
  questionPool?: EarlyVisiblePileQuestion[] | null;
  isFilterActive?: boolean;
} = {}): EarlyVisiblePileQuestion[] => {
  const normalizedPileQuestions = Array.isArray(pileQuestions) ? pileQuestions : [];
  if (normalizedPileQuestions.length > 0) return normalizedPileQuestions;
  if (isFilterActive) return normalizedPileQuestions;

  const normalizedQuestionPool = Array.isArray(questionPool) ? questionPool : [];
  if (normalizedQuestionPool.length === 0) return normalizedPileQuestions;
  return normalizedQuestionPool.filter(
    (question) => question?.id != null && !isQuestionPromptMasked(question as Record<string, unknown> | null),
  );
};

export const shouldPreferPileGatedEmptyState = ({
  hasConcreteHiddenQuestions = false,
  hasVisibleQuestions = false,
  firstBoot = false,
  cacheHasLoaded = true,
  recentRateLimit = false,
  hasPendingMetadataRetries = false,
}: {
  hasConcreteHiddenQuestions?: boolean;
  hasVisibleQuestions?: boolean;
  firstBoot?: boolean;
  cacheHasLoaded?: boolean | null;
  recentRateLimit?: boolean;
  hasPendingMetadataRetries?: boolean;
} = {}): boolean => {
  if (!hasConcreteHiddenQuestions) return false;
  if (hasVisibleQuestions) return false;
  if (firstBoot) return false;
  if (cacheHasLoaded === false) return false;
  if (recentRateLimit) return false;
  if (hasPendingMetadataRetries) return false;
  return true;
};

export const buildPileWorkspaceViewState = ({
  pileQuestions = [],
  activePileIndex = 0,
  loading = false,
  hiddenMaskedQuestionIds = [],
  hasHiddenGatedQuestions = false,
  firstBoot = false,
  cacheHasLoaded = true,
  isQuestionCacheReady = false,
  recentRateLimit = false,
  scanRemainingBlocks = 0,
  hydrateDiscovered = 0,
  hydrateDone = 0,
  pendingMetadataCount = 0,
  questionScanPhase = '',
  questionScanErrorMessage = '',
  isHydratingPriorResponses = false,
  isFilterActive = false,
  hasFilterBaseQuestions = false,
  hasSessionQuestionGate = false,
}: {
  pileQuestions?: unknown[] | null;
  activePileIndex?: number | null;
  loading?: boolean;
  hiddenMaskedQuestionIds?: unknown[] | null;
  hasHiddenGatedQuestions?: boolean;
  firstBoot?: boolean;
  cacheHasLoaded?: boolean | null;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
  scanRemainingBlocks?: number | null;
  hydrateDiscovered?: number | null;
  hydrateDone?: number | null;
  pendingMetadataCount?: number | null;
  questionScanPhase?: string | null;
  questionScanErrorMessage?: string | null;
  isHydratingPriorResponses?: boolean;
  isFilterActive?: boolean;
  hasFilterBaseQuestions?: boolean;
  hasSessionQuestionGate?: boolean;
} = {}): PileWorkspaceViewState => {
  const normalizedPileQuestions = Array.isArray(pileQuestions) ? pileQuestions : [];
  const normalizedActiveIndex = Math.max(0, Number(activePileIndex || 0));
  const activeQuestion =
    normalizedPileQuestions.length > 0
      ? normalizedPileQuestions[normalizedActiveIndex] || normalizedPileQuestions[0] || null
      : null;
  const activePromptMasked = isQuestionPromptMasked(activeQuestion as Record<string, unknown> | null);
  const hasVisibleQuestions = normalizedPileQuestions.length > 0;
  const normalizedHiddenMaskedQuestionIds = Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [];
  const normalizedHydrateDiscovered = Math.max(0, Number(hydrateDiscovered || 0));
  const normalizedHydrateDone = Math.max(0, Number(hydrateDone || 0));
  const normalizedPendingMetadataCount = Math.max(0, Number(pendingMetadataCount || 0));
  const normalizedScanRemainingBlocks = Math.max(0, Number(scanRemainingBlocks || 0));
  const normalizedQuestionScanPhase = String(questionScanPhase || '').toLowerCase();
  const hasPendingMetadataRetries = normalizedPendingMetadataCount > 0;
  const isHydrating = normalizedQuestionScanPhase === 'hydrate';
  const hasTerminalScanError = normalizedQuestionScanPhase === 'error';
  const scanErrorMessage = hasTerminalScanError
    ? String(questionScanErrorMessage || 'Unable to load questions for this session.')
    : '';
  const hydrationProgressSettled = isHydrating && normalizedHydrateDone >= normalizedHydrateDiscovered;
  const priorResponsesHydrating = !!isHydratingPriorResponses;
  const hasScanOrHydrationWork =
    (normalizedQuestionScanPhase === 'scan' && normalizedScanRemainingBlocks > 0) ||
    (isHydrating && (normalizedHydrateDone < normalizedHydrateDiscovered || hasPendingMetadataRetries));
  const hasConcreteHiddenQuestions = !!hasHiddenGatedQuestions || normalizedHiddenMaskedQuestionIds.length > 0;
  const hasUnhydratedGatedQuestions =
    !!hasSessionQuestionGate &&
    !hasVisibleQuestions &&
    !hasConcreteHiddenQuestions &&
    (normalizedHydrateDiscovered > 0 || normalizedPendingMetadataCount > 0 || !!isQuestionCacheReady);
  const preferGatedEmptyState = shouldPreferPileGatedEmptyState({
    hasConcreteHiddenQuestions,
    hasVisibleQuestions,
    firstBoot,
    cacheHasLoaded,
    recentRateLimit,
    hasPendingMetadataRetries,
  });
  const showGatedEmptyState = hasConcreteHiddenQuestions || hasUnhydratedGatedQuestions || preferGatedEmptyState;
  const showFilteredEmptyState =
    !hasVisibleQuestions && !!isFilterActive && !!hasFilterBaseQuestions && !showGatedEmptyState;
  const allowUnreadyEmptySettlement =
    (!hasVisibleQuestions &&
      !firstBoot &&
      cacheHasLoaded !== false &&
      !isQuestionCacheReady &&
      !recentRateLimit &&
      !hasScanOrHydrationWork &&
      !hasPendingMetadataRetries &&
      hydrationProgressSettled) ||
    preferGatedEmptyState ||
    hasUnhydratedGatedQuestions;
  const isStillLoading = shouldShowPileFullLoadingState({
    loading,
    hasVisibleQuestions,
    firstBoot,
    isQuestionCacheReady: !!isQuestionCacheReady,
    recentRateLimit,
    hasScanOrHydrationWork,
    allowUnreadyEmptySettlement,
    allowFilteredEmptySettlement: showFilteredEmptyState,
    hasTerminalScanError,
  });
  const showMiniBackgroundSpinner =
    hasVisibleQuestions && (priorResponsesHydrating || loading || hasScanOrHydrationWork || recentRateLimit);

  return {
    activeQuestion,
    activePromptMasked,
    hasVisibleQuestions,
    hydrateDiscovered: normalizedHydrateDiscovered,
    hydrateDone: normalizedHydrateDone,
    pendingMetadataCount: normalizedPendingMetadataCount,
    hasPendingMetadataRetries,
    isHydrating,
    hasTerminalScanError,
    scanErrorMessage,
    hydrationProgressSettled,
    priorResponsesHydrating,
    hasScanOrHydrationWork,
    hasConcreteHiddenQuestions,
    hasUnhydratedGatedQuestions,
    preferGatedEmptyState,
    showGatedEmptyState,
    showFilteredEmptyState,
    allowUnreadyEmptySettlement,
    isStillLoading,
    showMiniBackgroundSpinner,
  };
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
  const shouldHidePileSubmitButton = !hasPendingPileChanges && !isSubmitting && !pileSubmittedStateActive;
  const finalSubmitText = String(pileSubmitTempText || '') || String(pileSubmitLabel || '');

  const pileSubmitResponderAddress = String(account || '').trim();
  const pileSubmitResponderAddressLower =
    pileSubmitResponderAddress && isAddress(pileSubmitResponderAddress) ? pileSubmitResponderAddress.toLowerCase() : '';

  return {
    hasPendingPileChanges,
    pileSubmittedStateActive,
    showPileSubmitSuccessBadge,
    shouldHidePileSubmitButton,
    finalSubmitText,
    pileSubmitResponderHref: pileSubmitResponderAddressLower ? `/u/${pileSubmitResponderAddressLower}` : '',
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

  const pileTopRailVisible =
    !!isSubmitting || submitViewState.hasPendingPileChanges || submitViewState.pileSubmittedStateActive;
  const showSubmitButton = !submitViewState.showPileSubmitSuccessBadge;
  const showSuccessBadgeLink = submitViewState.showPileSubmitSuccessBadge && !!submitViewState.pileSubmitResponderHref;
  const showSuccessBadgeStatus = submitViewState.showPileSubmitSuccessBadge && !submitViewState.pileSubmitResponderHref;
  const showClearPendingButton =
    submitViewState.hasPendingPileChanges && !isSubmitting && !submitViewState.pileSubmittedStateActive;

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
