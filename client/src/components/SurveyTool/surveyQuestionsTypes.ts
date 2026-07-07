import type { ReactNode } from 'react';
import { updateSubmittedSinceLastEdit } from './surveyToolUtils';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import type { ResponseSlice, UnknownRecord } from './surveyToolTypes.js';
import {
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  normalizeQuestionProgressSlug,
} from './surveyToolViewState.js';
import { filterPendingQuestionMetadataPlaceholders } from './surveyQuestionMetadataPlaceholders.js';

export type SurveyQuestionsLegacyRecord = Record<string, any>;
export type SurveyQuestionsLegacyValue = SurveyQuestionsLegacyRecord[string];

export type SurveyQuestionsProps = SurveyQuestionsLegacyRecord & {
  displayAnswerMode?: boolean;
  isStandalone?: boolean;
  runtimeStrategy?: SurveyQuestionsRuntimeStrategy;
  singleQuestionMode?: boolean;
  questionPool?: unknown[];
};

export type SurveyQuestionsRuntimeEngine = SurveyQuestionsLegacyRecord & {
  props: SurveyQuestionsProps;
  state: SurveyQuestionsState;
  setState: (...args: unknown[]) => unknown;
};

export type SurveyQuestionsRuntimeStrategy = {
  buildInitialState?: (engine: SurveyQuestionsRuntimeEngine) => Partial<SurveyQuestionsState> | null | undefined;
  componentDidMount?: (engine: SurveyQuestionsRuntimeEngine) => unknown;
  componentDidUpdate?: (
    engine: SurveyQuestionsRuntimeEngine,
    prevProps: SurveyQuestionsProps,
    prevState: SurveyQuestionsState,
  ) => unknown;
  componentWillUnmount?: (engine: SurveyQuestionsRuntimeEngine) => unknown;
  getAnsweredQuestionsCount?: (engine: SurveyQuestionsRuntimeEngine) => number;
  getCurrentRenderedQuestionIds?: (engine: SurveyQuestionsRuntimeEngine) => unknown[];
  getPendingEditStats?: (engine: SurveyQuestionsRuntimeEngine, surveyIndexParam?: unknown) => unknown;
  render?: (engine: SurveyQuestionsRuntimeEngine) => ReactNode;
  showTransientSubmitFeedback?: (
    engine: SurveyQuestionsRuntimeEngine,
    message?: string,
    durationMs?: number,
  ) => unknown;
  toggleComments?: (engine: SurveyQuestionsRuntimeEngine, questionId: unknown, defaultOpen?: boolean) => unknown;
};

export type SurveyQuestionPoolStatePatch = {
  questionPool: unknown[];
  questionPoolExpectedIds: string[];
  questionPoolPendingIds: string[];
};

export type SurveyQuestionPoolLoadState = {
  expectedIds: string[];
  pendingIds: string[];
  pendingCount: number;
  isIncomplete: boolean;
};

type SurveyQuestionsQuestionScanProgress = {
  slug?: unknown;
  phase?: unknown;
  discoveredQuestions?: unknown;
  hydratedQuestions?: unknown;
  totalBlocks?: unknown;
  requestedTotalBlocks?: unknown;
  wasCapped?: boolean;
  scannedBlocks?: unknown;
  remainingBlocks?: unknown;
} | null;

export type SurveyQuestionsFullLoadingProgressState = {
  questionScanProgress: SurveyQuestionsQuestionScanProgress;
  scanProgressDisplay: ReturnType<typeof buildQuestionScanProgressDisplay>;
  hydrateDiscovered: number;
  hydrateDone: number;
  isHydrating: boolean;
  hasFullLoadingProgress: boolean;
  metaLeftText: string;
  metaRightText: string;
  fillStyle: { width: string };
};

export type SurveyQuestionsJsonPanelDisplayState = {
  showQuestionJsonControls: boolean;
  showSurveyJsonPanel: boolean;
  showQuestionsJsonPanel: boolean;
  showResponseJsonPanel: boolean;
  surveyJsonRowClassName: string | undefined;
  surveyJsonToggleClassName: string | undefined;
  questionJsonToggleClassName: string | undefined;
  responseJsonToggleClassName: string | undefined;
  surveyJsonPanelClassName: string | undefined;
};

export type SurveyQuestionsJsonForDisplayState = {
  jsonForDisplay: unknown;
};

export type SurveyQuestionsLayoutDisplayState = {
  activeTagModalTag: string;
  responseViewClassName: string | undefined;
  surveyPageClassName: string | undefined;
  topSectionClassName: string | undefined;
  useTagModal: boolean;
};

export type SurveyQuestionsRouteViewDisplayState = {
  viewedAddressRaw: string;
  viewedAddressLower: string;
  shortenedViewAddress: string;
  isOwnResponse: unknown;
  isSingleQuestionView: unknown;
  showViewAnswersButton: unknown;
  viewAnswersButtonText: string;
};

export type SurveyQuestionsSubmitFooterDisplayState = {
  submittedStateActive: boolean;
  submittedIndicatorActive: boolean;
  singleQuestionSubmittedIndicatorActive: boolean;
  showSubmitAux: boolean;
  uploadStatusText: string;
  submitDisabled: boolean;
  canEditQuestions: boolean;
  hasPendingEdits: boolean;
  genericShowInlineSubmit: boolean;
  showInlineSubmit: boolean;
  showTopInlineSubmit: boolean;
};

export type SurveyAutoDecryptDisabledStatePatch = {
  autoDecryptEnabled: boolean;
  decryptingByKey: Record<string, unknown>;
};

export type SurveyClearedDecryptingByKeyStatePatch = {
  decryptingByKey: Record<string, unknown>;
};

export type SurveyCanDecryptOtherResponsesStatePatch = {
  canDecryptOtherResponses: boolean;
  canDecryptOtherResponsesStatus: string;
};

export type SurveyHasherStatePatch = {
  hasher: unknown;
};

export type SurveyJsonPreviewStatePatch = {
  jsonPreview: unknown;
};

export type SurveyShowJsonStatePatch = {
  showJson: boolean;
};

export type SurveyDecryptEditStartStatePatch = {
  isDecrypting: boolean;
  submissionError: string;
  suppressPrefill: boolean;
};

export type SurveyDecryptEditFailureStatePatch = {
  isDecrypting: boolean;
  submissionError: string;
};

export type SurveyResponseEditCompleteStatePatch = {
  isEditing: boolean;
  userHasResponse: boolean;
  userResponseEncrypted: boolean;
};

export type SurveyParsedViewAddressAnswersStatePatch = {
  parsedViewAddressAnswers: unknown;
};

export type SurveyDisplayAnswerModeStatePatch = {
  displayAnswerMode: unknown;
};

export type SurveyResponseModeStatePatch = {
  displayAnswerMode: boolean;
  isEditing: boolean;
};

export type SurveySubmissionErrorStatePatch = {
  submissionError: unknown;
};

export type SurveyResponseLoadingResetStatePatch = {
  isLoadingResponse: boolean;
  submissionError: string;
  submissionComplete: boolean;
  submittedSinceLastEdit: unknown;
};

export type SurveyChangedResetStatePatch = {
  userHasResponse: boolean;
  userAnswers: null;
  parsedViewAddressAnswers: null;
  noResponse: boolean;
  questionPool: unknown[];
  questionPoolExpectedIds: string[];
  questionPoolPendingIds: string[];
  isEditing: boolean;
  surveysResponseState: unknown[];
  jsonPreview: string;
  submissionError: string;
  submissionComplete: boolean;
  submittedSinceLastEdit: unknown;
};

export type SurveyAccountViewResetStatePatch = {
  isLoadingResponse: boolean;
  userHasResponse: boolean;
  userAnswers: null;
  isEditing: boolean;
  parsedViewAddressAnswers: unknown;
  noResponse: unknown;
  submissionError: string;
  submissionComplete: boolean;
  submittedSinceLastEdit: unknown;
};

export type SurveyStandaloneAuthResetStatePatch = {
  isEditing: boolean;
  submissionError: string;
  submissionComplete: boolean;
  submittedSinceLastEdit: unknown;
};

export type SurveySubmitStartStatePatch = {
  isSubmitting: boolean;
  submitProgress: number;
  currentStep: number;
  submissionError: string;
};

export type SurveySubmitPreparationErrorStatePatch = {
  isSubmitting: boolean;
  submitProgress: number;
  submissionError: string;
};

export type SurveySubmitSuccessStatePatch = {
  isSubmitting: boolean;
  submitProgress: number;
  submissionComplete: boolean;
  submittedSinceLastEdit: unknown;
  currentStep: number;
  suppressPrefill: boolean;
  responseUrl: unknown;
  surveysResponseState: unknown;
  editBaseline: unknown;
  userAnswers: unknown;
  userHasResponse: boolean;
  userResponseEncrypted: boolean;
  isDirty: boolean;
  modifiedCount: number;
  pileDiscardedEdits: boolean;
  hasEncryptedChanges: boolean;
};

export type SurveySubmitFailureStatePatch = {
  isSubmitting: boolean;
  submitProgress: number;
  submissionComplete: boolean;
  submittedSinceLastEdit: unknown;
  submissionError: string;
};

export type SurveyCurrentStepStatePatch = {
  currentStep: number;
};

export type SurveyResponseStatePatch = {
  surveysResponseState: unknown;
};

export type SurveyUserEditResponseStatePatch = SurveyResponseStatePatch & {
  isEditing: boolean;
  submittedSinceLastEdit: unknown;
};

export type SurveyBookmarkedQuestionsStatePatch = {
  bookmarkedQuestions: Set<string>;
};

export type SurveyPrefillQueuedAfterCacheStatePatch = {
  prefillQueuedAfterCache: boolean;
};

export type SurveyHydratingPriorResponsesStatePatch = {
  isHydratingPriorResponses: boolean;
};

export type SurveyAutoDecryptToggleStatePatch = {
  autoDecryptEnabled: boolean;
};

export type SurveyDisplayAnswerModeToggleStatePatch = {
  displayAnswerMode: boolean;
  isEditing: boolean;
};

export type SurveyQuestionsJsonToggleStatePatch = {
  showQuestionsJson: boolean;
};

export type SurveyResponseJsonToggleStatePatch = {
  showResponseJson: boolean;
};

export type SurveySurveyJsonToggleStatePatch = {
  showSurveyJson: boolean;
};

export type SurveyCommentsToggleStatePatch = {
  showComments: Record<string, unknown>;
};

export type SurveyGateSbtNameRevisionStatePatch = {
  gateSbtNameRevision: number;
};

export type SurveyLockedGateDetailsExpandedStatePatch = {
  lockedGateDetailsExpanded: boolean;
};

export type SurveyLockAudienceGateDetailsStatePatch = {
  lockAudienceGateDetailsByQuestion: Record<string, string>;
};

export type SurveyLockAudienceMenuStatePatch = {
  lockAudienceMenuByQuestion: Record<string, true>;
  lockAudienceGateDetailsByQuestion: Record<string, unknown> | undefined;
};

export type SurveyRenderedQuestionPayloadPoolsStatePatch = {
  questionPool: unknown;
  pileQuestions: unknown;
  allQuestionsForFilter: unknown;
};

export type SurveyDecryptingByKeyStatePatch = {
  decryptingByKey: Record<string, unknown>;
};

export type SurveyVisiblePileQuestionsAfterPromptDecryptStatePatch = {
  pileQuestions: unknown[];
  hasHiddenGatedQuestions: boolean;
  activePileIndex: number;
};

export type SurveyAutoDecryptAttemptedStatePatch = {
  autoDecryptAttempted: Record<string, unknown>;
};

export type SurveyResponseHydrationInvalidatedStatePatch = {
  isLoadingResponse: boolean;
};

export type SurveyInitialResponseStatePatch = {
  surveysResponseState: unknown;
  editBaseline: unknown;
};

export type SurveyInitialStandaloneResponseStatePatch = SurveyInitialResponseStatePatch & {
  jsonPreview: unknown;
};

export type SurveyQuestionPoolResponseMergeStatePatch = {
  questionPool?: unknown[];
  surveysResponseState: unknown;
  editBaseline: unknown;
};

export type SurveyResponseMergeStatePatch = {
  surveysResponseState: unknown;
};

export type SurveyEditStatsStatePatch = {
  modifiedCount: number;
  encryptedModifiedCount: number;
  hasEncryptedChanges: boolean;
  isDirty: boolean;
  submissionComplete?: boolean;
  submittedSinceLastEdit?: boolean;
};

export type SurveyFetchedQuestionPoolStatePatch = {
  questionPool: unknown[];
  questionPoolExpectedIds: string[];
  questionPoolPendingIds: string[];
};

export type SurveyEncryptionResponseStatePatch = {
  surveysResponseState: unknown[];
  lockAudienceMenuByQuestion: unknown;
  lockAudienceGateDetailsByQuestion: unknown;
  submittedSinceLastEdit: unknown;
};

export type SurveyResponseFetchLoadingStatePatch = {
  isLoadingResponse: boolean;
  responseLookupWarning: string;
};

export type SurveyViewedResponseStatePatch = {
  viewAddressAnswers: string;
  parsedViewAddressAnswers: unknown;
  noResponse: boolean;
  responseLookupWarning: string;
};

export type SurveyUserResponseFoundStatePatch = {
  userHasResponse: boolean;
  userResponseEncrypted: boolean;
  startFresh: boolean;
  userAnswers: unknown;
  submissionComplete?: boolean;
};

export type SurveyUserResponseMissingStatePatch = {
  userHasResponse: boolean;
  userResponseEncrypted: boolean;
  userAnswers: null;
};

export type SurveySingleQuestionPoolFallbackStatePatch = {
  isLoadingResponse: boolean;
  questionPool: unknown[];
};

export type SurveySingleQuestionRetryLoadingStatePatch = {
  isLoadingResponse: boolean;
};

export type SurveySingleQuestionPlaceholderHydrationStatePatch = {
  questionPool: unknown[];
  surveysResponseState: unknown;
  isLoadingResponse: boolean;
  noResponse: boolean;
  responseLookupWarning: string;
};

export type SurveySingleQuestionReadyHydrationStatePatch = {
  questionPool: unknown[];
  surveysResponseState: unknown;
};

export type SurveyQuestionsState = SurveyQuestionsLegacyRecord & {
  surveysResponseState: ResponseSlice[];
  displayAnswerMode: boolean | undefined;
  viewAddressAnswers: string;
  noResponse: boolean;
  responseLookupWarning: string;
  userHasResponse: boolean;
  userResponseEncrypted: boolean;
  startFresh: boolean;
  userAnswers: unknown;
  isDecrypting: boolean;
  jsonPreview: string;
  isEditing: boolean;
  isSubmitting: boolean;
  submitProgress: number;
  submissionComplete: boolean;
  submittedSinceLastEdit: boolean;
  responseUrl: string;
  submissionError: string;
  currentStep: number;
  questionPool: unknown[];
  questionPoolExpectedIds: string[];
  questionPoolPendingIds: string[];
  showJson: boolean;
  showQuestionsJson: boolean;
  showResponseJson: boolean;
  copiedQuestionsJson: boolean;
  copiedResponseJson: boolean;
  isLoadingResponse: boolean;
  parsedViewAddressAnswers: unknown;
  decryptionNonce: number;
  bookmarkedQuestions: Set<string>;
  showSurveyJson: boolean;
  copiedSurveyJson: boolean;
  modifiedCount: number;
  pileDiscardedEdits: boolean;
  encryptedModifiedCount: number;
  isDirty: boolean;
  hasEncryptedChanges: boolean;
  autoDecryptEnabled: boolean;
  autoDecryptAttempted: Record<string, unknown>;
  showComments: Record<string, unknown>;
  lockAudienceMenuByQuestion: Record<string, unknown>;
  lockAudienceGateDetailsByQuestion: Record<string, unknown>;
  sliderModeByQuestion: Record<string, unknown>;
  sliderToggleExpandedByQuestion: Record<string, unknown>;
  activeTagModalTag: string;
  prefillQueuedAfterCache: boolean;
  isHydratingPriorResponses: boolean;
  decryptingByKey: Record<string, unknown>;
  bulkPromptReloading: boolean;
  lockedGateDetailsExpanded: boolean;
  gateSbtNameRevision: number;
  hasher: unknown;
  canDecryptOtherResponses: boolean;
  canDecryptOtherResponsesStatus: string;
};

export const buildClearedSurveyQuestionPoolState = (): SurveyQuestionPoolStatePatch => ({
  questionPool: [],
  questionPoolExpectedIds: [],
  questionPoolPendingIds: [],
});

export const publishSurveyQuestionPoolIfCurrent = ({
  isStaleRun = () => false,
  publishQuestionPool = () => {},
  warnMissing = false,
}: {
  isStaleRun?: () => boolean;
  publishQuestionPool?: (options: { warnMissing: boolean }) => void;
  warnMissing?: boolean;
} = {}): boolean => {
  if (isStaleRun()) return false;
  publishQuestionPool({ warnMissing });
  return true;
};

export const buildSurveyQuestionPoolLoadState = ({
  isStandalone = false,
  singleQuestionMode = false,
  questionPoolExpectedIds,
  questionPoolPendingIds,
}: {
  isStandalone?: boolean;
  singleQuestionMode?: boolean;
  questionPoolExpectedIds?: unknown;
  questionPoolPendingIds?: unknown;
} = {}): SurveyQuestionPoolLoadState => {
  if (isStandalone || singleQuestionMode) {
    return {
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    };
  }

  const expectedIds = Array.isArray(questionPoolExpectedIds) ? questionPoolExpectedIds : [];
  const pendingIds = Array.isArray(questionPoolPendingIds) ? questionPoolPendingIds : [];
  const pendingCount = pendingIds.length;

  return {
    expectedIds,
    pendingIds,
    pendingCount,
    isIncomplete: expectedIds.length > 0 && pendingCount > 0,
  };
};

export const isSurveyQuestionsMaskedPromptText = (prompt: unknown): boolean =>
  String(prompt || '').trim() === '[encrypted]';

export const buildSurveyQuestionsMaskedQuestionVisibility = ({
  isMaskedPromptText = isSurveyQuestionsMaskedPromptText,
  questionPool = null,
  singleQuestionMode = false,
}: {
  isMaskedPromptText?: (prompt: unknown) => boolean;
  questionPool?: unknown;
  singleQuestionMode?: unknown;
} = {}): SurveyQuestionsMaskedQuestionVisibilityState => {
  const fullQuestionPool = filterPendingQuestionMetadataPlaceholders(Array.isArray(questionPool) ? questionPool : []);
  const isPromptMasked =
    typeof isMaskedPromptText === 'function' ? isMaskedPromptText : isSurveyQuestionsMaskedPromptText;
  if (singleQuestionMode) {
    return {
      fullQuestionPool,
      visibleQuestionPool: fullQuestionPool,
      hiddenMaskedQuestionIds: [],
    };
  }

  const visibleQuestionPool: unknown[] = [];
  const hiddenMaskedQuestionIds: string[] = [];
  fullQuestionPool.forEach((question) => {
    const questionRecord = question !== null && typeof question === 'object' ? (question as UnknownRecord) : {};
    const masked = isPromptMasked(questionRecord.prompt) && !questionRecord.promptDecrypted;
    if (!masked) {
      visibleQuestionPool.push(question);
      return;
    }
    const questionId = String(questionRecord.id || '')
      .trim()
      .toLowerCase();
    if (questionId) hiddenMaskedQuestionIds.push(questionId);
  });

  return {
    fullQuestionPool,
    visibleQuestionPool,
    hiddenMaskedQuestionIds,
  };
};

export const buildSurveyQuestionsRenderReadinessDescriptor = ({
  displayAnswerMode = false,
  fullQuestionPool = null,
  hiddenMaskedQuestionIds = null,
  isQuestionCacheReady = false,
  isStandalone = false,
  parsedViewAddressAnswers = null,
  questionPool = null,
  singleQuestionMode = false,
  surveyIndex = 0,
  surveysResponseState = null,
  visibleQuestionPool = null,
}: {
  displayAnswerMode?: unknown;
  fullQuestionPool?: unknown;
  hiddenMaskedQuestionIds?: unknown;
  isQuestionCacheReady?: unknown;
  isStandalone?: unknown;
  parsedViewAddressAnswers?: unknown;
  questionPool?: unknown;
  singleQuestionMode?: unknown;
  surveyIndex?: unknown;
  surveysResponseState?: unknown;
  visibleQuestionPool?: unknown;
} = {}): SurveyQuestionsRenderReadinessDescriptor => {
  const isSingleQuestion = !!singleQuestionMode;
  const standalone = !!isStandalone;
  const normalizedSurveyIndex = standalone || isSingleQuestion ? 0 : Number(surveyIndex || 0);
  const responses = Array.isArray(surveysResponseState) ? surveysResponseState : [];
  const currentSurveyResponseState =
    responses.length > normalizedSurveyIndex ? (responses[normalizedSurveyIndex] as ResponseSlice) : null;
  const normalizedQuestionPool = filterPendingQuestionMetadataPlaceholders(
    Array.isArray(questionPool) ? questionPool : [],
  );
  const normalizedFullQuestionPool = Array.isArray(fullQuestionPool)
    ? filterPendingQuestionMetadataPlaceholders(fullQuestionPool)
    : normalizedQuestionPool;
  const normalizedVisibleQuestionPool = Array.isArray(visibleQuestionPool)
    ? filterPendingQuestionMetadataPlaceholders(visibleQuestionPool)
    : normalizedQuestionPool;
  const normalizedHiddenMaskedQuestionIds = Array.isArray(hiddenMaskedQuestionIds)
    ? hiddenMaskedQuestionIds.map((questionId) => String(questionId))
    : [];
  const questionPoolReady = normalizedFullQuestionPool.length > 0;
  const canFallThroughDisplayAnswerMode = !!displayAnswerMode && !!parsedViewAddressAnswers;
  const shouldShowLoadingState = !!(
    (!currentSurveyResponseState ||
      (isSingleQuestion && !questionPoolReady && !displayAnswerMode) ||
      (!isSingleQuestion && !standalone && !questionPoolReady && !displayAnswerMode)) &&
    !canFallThroughDisplayAnswerMode
  );
  const gatedEmptyStateReady = !!(
    !isSingleQuestion &&
    normalizedFullQuestionPool.length > 0 &&
    normalizedVisibleQuestionPool.length === 0 &&
    isQuestionCacheReady
  );

  return {
    surveyIndex: normalizedSurveyIndex,
    currentSurveyResponseState,
    fullQuestionPool: normalizedFullQuestionPool,
    visibleQuestionPool: normalizedVisibleQuestionPool,
    hiddenMaskedQuestionIds: normalizedHiddenMaskedQuestionIds,
    questionPoolReady,
    gatedEmptyStateReady,
    hasHiddenMaskedQuestions: normalizedHiddenMaskedQuestionIds.length > 0,
    canFallThroughDisplayAnswerMode,
    shouldShowLoadingState,
  };
};

export const buildAutoDecryptDisabledState = (): SurveyAutoDecryptDisabledStatePatch => ({
  autoDecryptEnabled: false,
  decryptingByKey: {},
});

export const buildClearedDecryptingByKeyState = (): SurveyClearedDecryptingByKeyStatePatch => ({
  decryptingByKey: {},
});

export const buildCanDecryptOtherResponsesState = ({
  canDecrypt = false,
  status = 'unknown',
}: {
  canDecrypt?: boolean;
  status?: string;
} = {}): SurveyCanDecryptOtherResponsesStatePatch => ({
  canDecryptOtherResponses: !!canDecrypt,
  canDecryptOtherResponsesStatus: String(status || 'unknown'),
});

export const buildHasherState = (hasher: unknown): SurveyHasherStatePatch => ({
  hasher,
});

export const buildJsonPreviewState = (jsonPreview: unknown): SurveyJsonPreviewStatePatch => ({
  jsonPreview,
});

export const buildShowJsonState = (showJson: unknown): SurveyShowJsonStatePatch => ({
  showJson: !!showJson,
});

export const toggleShowJsonState = (prevState: { showJson?: unknown } = {}): SurveyShowJsonStatePatch => ({
  showJson: !prevState.showJson,
});

export const buildAutoDecryptToggleState = (
  prevState: { autoDecryptEnabled?: unknown } = {},
): SurveyAutoDecryptToggleStatePatch => ({
  autoDecryptEnabled: !prevState.autoDecryptEnabled,
});

export const buildDisplayAnswerModeToggleState = (
  prevState: { displayAnswerMode?: unknown } = {},
): SurveyDisplayAnswerModeToggleStatePatch => {
  const displayAnswerMode = !prevState.displayAnswerMode;
  return {
    displayAnswerMode,
    isEditing: displayAnswerMode,
  };
};

export const buildQuestionsJsonToggleState = (
  prevState: { showQuestionsJson?: unknown } = {},
): SurveyQuestionsJsonToggleStatePatch => ({
  showQuestionsJson: !prevState.showQuestionsJson,
});

export const buildResponseJsonToggleState = (
  prevState: { showResponseJson?: unknown } = {},
): SurveyResponseJsonToggleStatePatch => ({
  showResponseJson: !prevState.showResponseJson,
});

export const buildSurveyJsonToggleState = (
  prevState: { showSurveyJson?: unknown } = {},
): SurveySurveyJsonToggleStatePatch => ({
  showSurveyJson: !prevState.showSurveyJson,
});

export const buildCommentsToggleState = (
  prevState: { showComments?: Record<string, unknown> } = {},
  questionId: unknown,
  defaultOpen: unknown = false,
): SurveyCommentsToggleStatePatch => {
  const key = String(questionId);
  const current = typeof prevState?.showComments?.[key] === 'boolean' ? prevState.showComments[key] : !!defaultOpen;
  return {
    showComments: {
      ...prevState.showComments,
      [key]: !current,
    },
  };
};

export const buildGateSbtNameRevisionState = (
  prevState: { gateSbtNameRevision?: unknown } = {},
): SurveyGateSbtNameRevisionStatePatch => ({
  gateSbtNameRevision: Number(prevState.gateSbtNameRevision || 0) + 1,
});

export const buildLockedGateDetailsExpandedState = (
  prevState: { lockedGateDetailsExpanded?: unknown } = {},
): SurveyLockedGateDetailsExpandedStatePatch => ({
  lockedGateDetailsExpanded: !prevState.lockedGateDetailsExpanded,
});

export const buildLockAudienceGateDetailsState = (
  prevState: { lockAudienceGateDetailsByQuestion?: Record<string, unknown> } = {},
  key: unknown,
  forceOpen: unknown = null,
  normalizedGateId = '',
  normalizeGateLabelText: (value: unknown) => string = (value) => String(value || ''),
): SurveyLockAudienceGateDetailsStatePatch => {
  const stateKey = String(key || '');
  const current = normalizeGateLabelText(prevState.lockAudienceGateDetailsByQuestion?.[stateKey] || '');
  const nextValue =
    typeof forceOpen === 'string' ? (current === normalizedGateId ? '' : normalizedGateId) : forceOpen ? current : '';
  return {
    lockAudienceGateDetailsByQuestion: nextValue ? { [stateKey]: nextValue } : {},
  };
};

export const buildLockAudienceMenuState = (
  prevState: {
    lockAudienceMenuByQuestion?: Record<string, unknown>;
    lockAudienceGateDetailsByQuestion?: Record<string, unknown>;
  } = {},
  key: unknown,
  forceOpen: unknown = null,
): SurveyLockAudienceMenuStatePatch => {
  const stateKey = String(key || '');
  const current = !!prevState.lockAudienceMenuByQuestion?.[stateKey];
  const nextValue = forceOpen === null ? !current : !!forceOpen;
  return {
    lockAudienceMenuByQuestion: nextValue ? { [stateKey]: true } : {},
    lockAudienceGateDetailsByQuestion: nextValue ? prevState.lockAudienceGateDetailsByQuestion : {},
  };
};

export const buildRenderedQuestionPayloadPoolsState = (
  prevState: {
    questionPool?: unknown;
    pileQuestions?: unknown;
    allQuestionsForFilter?: unknown;
  } = {},
  questionId: unknown,
  questionPayload: unknown,
  deps: {
    pickBetterQuestionPayload: (existing: unknown, incoming: unknown) => unknown;
    areQuestionPayloadsEquivalent: (left: unknown, right: unknown) => boolean;
  },
): SurveyRenderedQuestionPayloadPoolsStatePatch | null => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid || !questionPayload) return null;

  let didChange = false;
  const patchList = (list: unknown) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    return list.map((item) => {
      const itemId = String((item as UnknownRecord | null | undefined)?.id || '').toLowerCase();
      if (itemId !== qid) return item;
      const picked = deps.pickBetterQuestionPayload(item, questionPayload) || questionPayload;
      const merged = { ...(item as UnknownRecord), ...(picked as UnknownRecord), id: qid };
      if (deps.areQuestionPayloadsEquivalent(item, merged)) {
        return item;
      }
      didChange = true;
      return merged;
    });
  };

  const nextQuestionPool = patchList(prevState.questionPool);
  const nextPileQuestions = patchList(prevState.pileQuestions);
  const nextAllQuestionsForFilter = patchList(prevState.allQuestionsForFilter);
  if (!didChange) return null;
  return {
    questionPool: nextQuestionPool,
    pileQuestions: nextPileQuestions,
    allQuestionsForFilter: nextAllQuestionsForFilter,
  };
};

export const buildDecryptingByKeyState = (
  prevState: { decryptingByKey?: Record<string, unknown> } = {},
  key: unknown,
  isDecrypting: unknown,
): SurveyDecryptingByKeyStatePatch => ({
  decryptingByKey: {
    ...(prevState.decryptingByKey || {}),
    [String(key)]: !!isDecrypting,
  },
});

export const buildVisiblePileQuestionsAfterPromptDecryptState = (
  prevState: {
    activePileIndex?: unknown;
    allQuestionsForFilter?: unknown;
    filterState?: unknown;
    hasHiddenGatedQuestions?: unknown;
    isFilterActive?: unknown;
    pileQuestions?: unknown;
  } = {},
  deps: {
    isFilterStateActive: (filterState: unknown) => boolean;
    isMaskedPromptText: (prompt: unknown) => boolean;
  },
): SurveyVisiblePileQuestionsAfterPromptDecryptStatePatch | null => {
  const source = Array.isArray(prevState.allQuestionsForFilter) ? prevState.allQuestionsForFilter : null;
  if (!source || !source.length) return null;
  const isFilterActive = !!prevState.isFilterActive || deps.isFilterStateActive(prevState.filterState);
  if (isFilterActive) return null;

  const visible = source.filter(
    (question) =>
      !(
        question &&
        deps.isMaskedPromptText((question as UnknownRecord)?.prompt) &&
        !(question as UnknownRecord)?.promptDecrypted
      ),
  );
  const hasHidden = source.some(
    (question) =>
      question &&
      deps.isMaskedPromptText((question as UnknownRecord)?.prompt) &&
      !(question as UnknownRecord)?.promptDecrypted,
  );

  const prevPile = Array.isArray(prevState.pileQuestions) ? prevState.pileQuestions : [];
  const activePileIndex = prevState.activePileIndex as number;
  const currentActiveId =
    prevPile.length > 0 && prevPile[activePileIndex]
      ? String((prevPile[activePileIndex] as UnknownRecord | null | undefined)?.id || '').toLowerCase()
      : '';
  const activeIdxFromId = currentActiveId
    ? visible.findIndex(
        (question) =>
          String((question as UnknownRecord | null | undefined)?.id || '').toLowerCase() === currentActiveId,
      )
    : -1;
  const nextActiveIndex =
    activeIdxFromId >= 0
      ? activeIdxFromId
      : Math.min(Number(prevState.activePileIndex || 0), Math.max(visible.length - 1, 0));

  const sameOrder =
    prevPile.length === visible.length &&
    prevPile.every(
      (question, idx) =>
        String((question as UnknownRecord | null | undefined)?.id || '').toLowerCase() ===
        String((visible[idx] as UnknownRecord | null | undefined)?.id || '').toLowerCase(),
    );
  if (
    sameOrder &&
    prevState.hasHiddenGatedQuestions === hasHidden &&
    Number(prevState.activePileIndex || 0) === nextActiveIndex
  ) {
    return null;
  }

  return {
    pileQuestions: visible,
    hasHiddenGatedQuestions: hasHidden,
    activePileIndex: nextActiveIndex,
  };
};

export const buildAutoDecryptAttemptedState = (
  prevState: { autoDecryptAttempted?: Record<string, unknown> } = {},
  key: unknown,
): SurveyAutoDecryptAttemptedStatePatch => ({
  autoDecryptAttempted: {
    ...(prevState.autoDecryptAttempted || {}),
    [String(key)]: true,
  },
});

export const buildResponseHydrationInvalidatedState = (): SurveyResponseHydrationInvalidatedStatePatch => ({
  isLoadingResponse: false,
});

export const buildInitialSurveyResponseState = ({
  surveysResponseState = [],
  editBaseline = null,
}: {
  surveysResponseState?: unknown;
  editBaseline?: unknown;
} = {}): SurveyInitialResponseStatePatch => ({
  surveysResponseState,
  editBaseline,
});

export const buildInitialStandaloneResponseState = ({
  surveysResponseState = [],
  editBaseline = null,
  jsonPreview = '',
}: {
  surveysResponseState?: unknown;
  editBaseline?: unknown;
  jsonPreview?: unknown;
} = {}): SurveyInitialStandaloneResponseStatePatch => ({
  surveysResponseState,
  editBaseline,
  jsonPreview,
});

export const buildQuestionPoolResponseMergeState = (
  prevState: { surveysResponseState?: unknown; editBaseline?: unknown } = {},
  {
    includeQuestionPool = false,
    mergeSurveyResponseState,
    questionPool = [],
    surveyIndex = 0,
  }: {
    includeQuestionPool?: boolean;
    mergeSurveyResponseState: (currentState: unknown, newQuestionPool: unknown, surveyIndex: unknown) => unknown;
    questionPool?: unknown[];
    surveyIndex?: unknown;
  },
): SurveyQuestionPoolResponseMergeStatePatch => {
  const patch: SurveyQuestionPoolResponseMergeStatePatch = {
    surveysResponseState: mergeSurveyResponseState(prevState.surveysResponseState, questionPool, surveyIndex),
    editBaseline: (
      mergeSurveyResponseState(
        [prevState.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
        questionPool,
        0,
      ) as unknown[]
    )[0],
  };
  if (includeQuestionPool) {
    patch.questionPool = questionPool;
  }
  return patch;
};

export const buildSurveyResponseMergeState = (
  prevState: { surveysResponseState?: unknown } = {},
  {
    mergeSurveyResponseState,
    questionPool = [],
    surveyIndex = 0,
  }: {
    mergeSurveyResponseState: (currentState: unknown, newQuestionPool: unknown, surveyIndex: unknown) => unknown;
    questionPool?: unknown[];
    surveyIndex?: unknown;
  },
): SurveyResponseMergeStatePatch => ({
  surveysResponseState: mergeSurveyResponseState(prevState.surveysResponseState, questionPool, surveyIndex),
});

export const buildEditStatsState = ({
  encryptedModifiedCount = 0,
  hasEncryptedChanges = false,
  isDirty = false,
  modifiedCount = 0,
  shouldRelatchSubmitted = false,
  shouldResetSubmitted = false,
}: {
  encryptedModifiedCount?: number;
  hasEncryptedChanges?: boolean;
  isDirty?: boolean;
  modifiedCount?: number;
  shouldRelatchSubmitted?: boolean;
  shouldResetSubmitted?: boolean;
} = {}): SurveyEditStatsStatePatch => {
  const updates: SurveyEditStatsStatePatch = {
    modifiedCount,
    encryptedModifiedCount,
    hasEncryptedChanges,
    isDirty,
  };
  if (shouldResetSubmitted) updates.submissionComplete = false;
  if (shouldRelatchSubmitted) updates.submittedSinceLastEdit = true;
  return updates;
};

export const buildFetchedQuestionPoolState = (
  prevState: {
    questionPool?: unknown;
    questionPoolExpectedIds?: unknown;
    questionPoolPendingIds?: unknown;
  } = {},
  {
    areQuestionPayloadsEquivalent,
    buildQuestionIdScopeSignature,
    expectedQuestionIds = [],
    normalizeQuestionIdKey,
    onNoop = () => {},
    pendingQuestionIds = [],
    pickBetterQuestionPayload,
    questionPool = [],
  }: {
    areQuestionPayloadsEquivalent: (left: unknown, right: unknown) => boolean;
    buildQuestionIdScopeSignature: (questionPool: unknown) => string;
    expectedQuestionIds?: string[];
    normalizeQuestionIdKey: (questionId: unknown) => string;
    onNoop?: () => void;
    pendingQuestionIds?: string[];
    pickBetterQuestionPayload: (existing: unknown, incoming: unknown) => unknown;
    questionPool?: unknown[];
  },
): SurveyFetchedQuestionPoolStatePatch | null => {
  const prevQuestionPool = Array.isArray(prevState?.questionPool) ? prevState.questionPool : [];
  const prevExpectedQuestionIds = Array.isArray(prevState?.questionPoolExpectedIds)
    ? prevState.questionPoolExpectedIds
    : [];
  const prevPendingQuestionIds = Array.isArray(prevState?.questionPoolPendingIds)
    ? prevState.questionPoolPendingIds
    : [];
  const prevQuestionPoolById = new Map<string, unknown>();
  prevQuestionPool.forEach((entry) => {
    const key = normalizeQuestionIdKey((entry as UnknownRecord | null | undefined)?.id);
    if (!key || prevQuestionPoolById.has(key)) return;
    prevQuestionPoolById.set(key, entry);
  });

  const mergedQuestionPool = questionPool.map((entry) => {
    const key = normalizeQuestionIdKey((entry as UnknownRecord | null | undefined)?.id);
    if (!key) return entry;
    const existing = prevQuestionPoolById.get(key);
    if (!existing) return entry;
    const picked = pickBetterQuestionPayload(existing, entry) || entry;
    if (picked === existing) return existing;
    const normalized = { ...(picked as UnknownRecord), id: key };
    return areQuestionPayloadsEquivalent(existing, normalized) ? existing : normalized;
  });

  const nextQuestionPoolSig = buildQuestionIdScopeSignature(questionPool);
  const prevQuestionPoolSig = buildQuestionIdScopeSignature(prevQuestionPool);
  const expectedIdsUnchanged =
    prevExpectedQuestionIds.length === expectedQuestionIds.length &&
    prevExpectedQuestionIds.every((qid, index) => qid === expectedQuestionIds[index]);
  const pendingIdsUnchanged =
    prevPendingQuestionIds.length === pendingQuestionIds.length &&
    prevPendingQuestionIds.every((qid, index) => qid === pendingQuestionIds[index]);
  if (prevQuestionPoolSig === nextQuestionPoolSig) {
    const hasSemanticChange =
      prevQuestionPool.length !== mergedQuestionPool.length ||
      prevQuestionPool.some((entry, idx) => entry !== mergedQuestionPool[idx]);
    if (!hasSemanticChange && expectedIdsUnchanged && pendingIdsUnchanged) {
      onNoop();
      return null;
    }
  }
  return {
    questionPool: mergedQuestionPool,
    questionPoolExpectedIds: expectedQuestionIds,
    questionPoolPendingIds: pendingQuestionIds,
  };
};

const createEmptyResponseSlice = () => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

export const buildAnswerEncryptionToggleResponseState = (
  prevState: {
    lockAudienceGateDetailsByQuestion?: unknown;
    lockAudienceMenuByQuestion?: unknown;
    submittedSinceLastEdit?: boolean;
    surveysResponseState?: unknown;
  } = {},
  {
    buildEncryptionTogglePlan,
    deps,
    newEncryptedState,
    questionId,
    surveyIndex = 0,
  }: {
    buildEncryptionTogglePlan: (
      questionId: string,
      field: 'answer',
      newEncryptedState: unknown,
      slice: UnknownRecord,
      deps: UnknownRecord,
    ) => UnknownRecord;
    deps: UnknownRecord;
    newEncryptedState: unknown;
    questionId: string;
    surveyIndex?: number;
  },
): SurveyEncryptionResponseStatePatch => {
  const arr = Array.isArray(prevState.surveysResponseState) ? [...prevState.surveysResponseState] : [];
  while (arr.length <= surveyIndex) arr.push(createEmptyResponseSlice());
  const slice = { ...((arr[surveyIndex] as UnknownRecord | undefined) || createEmptyResponseSlice()) };

  const plan = buildEncryptionTogglePlan(questionId, 'answer', newEncryptedState, slice, deps);

  slice.answers = { ...((slice.answers as UnknownRecord | undefined) || {}), [questionId]: plan.nextFieldState };
  if (plan.nextAdditionalState) {
    slice.additionalComments = {
      ...((slice.additionalComments as UnknownRecord | undefined) || {}),
      [questionId]: plan.nextAdditionalState,
    };
  }
  arr[surveyIndex] = slice;

  return {
    surveysResponseState: arr,
    lockAudienceMenuByQuestion: plan.clearMenus ? {} : prevState.lockAudienceMenuByQuestion,
    lockAudienceGateDetailsByQuestion: plan.clearMenus ? {} : prevState.lockAudienceGateDetailsByQuestion,
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(prevState.submittedSinceLastEdit, 'user_edit'),
  };
};

export const buildAdditionalEncryptionToggleResponseState = (
  prevState: {
    lockAudienceGateDetailsByQuestion?: unknown;
    lockAudienceMenuByQuestion?: unknown;
    submittedSinceLastEdit?: boolean;
    surveysResponseState?: unknown;
  } = {},
  {
    buildEncryptionTogglePlan,
    deps,
    newEncryptedState,
    questionId,
    surveyIndex = 0,
  }: {
    buildEncryptionTogglePlan: (
      questionId: string,
      field: 'additional',
      newEncryptedState: unknown,
      slice: UnknownRecord,
      deps: UnknownRecord,
    ) => UnknownRecord;
    deps: UnknownRecord;
    newEncryptedState: unknown;
    questionId: string;
    surveyIndex?: number;
  },
): SurveyEncryptionResponseStatePatch => {
  const arr = Array.isArray(prevState.surveysResponseState) ? [...prevState.surveysResponseState] : [];
  while (arr.length <= surveyIndex) arr.push(createEmptyResponseSlice());
  const slice = { ...((arr[surveyIndex] as UnknownRecord | undefined) || createEmptyResponseSlice()) };

  const plan = buildEncryptionTogglePlan(questionId, 'additional', newEncryptedState, slice, deps);

  slice.additionalComments = {
    ...((slice.additionalComments as UnknownRecord | undefined) || {}),
    [questionId]: plan.nextFieldState,
  };
  arr[surveyIndex] = slice;

  return {
    surveysResponseState: arr,
    lockAudienceMenuByQuestion: plan.clearMenus ? {} : prevState.lockAudienceMenuByQuestion,
    lockAudienceGateDetailsByQuestion: plan.clearMenus ? {} : prevState.lockAudienceGateDetailsByQuestion,
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(prevState.submittedSinceLastEdit, 'user_edit'),
  };
};

export const buildAnswerEncryptionAudienceState = (
  prevState: { submittedSinceLastEdit?: boolean; surveysResponseState?: unknown } = {},
  {
    audience,
    buildAnswerAudienceSelectionPlan,
    buildSurveyResponseStateArray,
    deps,
    gateId = '',
    questionId,
    surveyIndex = 0,
  }: {
    audience: unknown;
    buildAnswerAudienceSelectionPlan: (
      questionId: string,
      audience: unknown,
      gateId: string,
      slice: UnknownRecord,
      deps: UnknownRecord,
    ) => UnknownRecord;
    buildSurveyResponseStateArray: (args: UnknownRecord) => unknown[];
    deps: UnknownRecord;
    gateId?: string;
    questionId: string;
    surveyIndex?: number;
  },
): SurveyEncryptionResponseStatePatch => {
  const arr = buildSurveyResponseStateArray({
    prevSurveysResponseState: prevState.surveysResponseState,
    surveyIndex,
  });
  const slice = { ...((arr[surveyIndex] as UnknownRecord | undefined) || createEmptyResponseSlice()) };

  const plan = buildAnswerAudienceSelectionPlan(questionId, audience, gateId, slice, deps);

  slice.answers = { ...((slice.answers as UnknownRecord | undefined) || {}), [questionId]: plan.nextAnswerState };
  slice.additionalComments = {
    ...((slice.additionalComments as UnknownRecord | undefined) || {}),
    [questionId]: plan.nextAdditionalState,
  };
  arr[surveyIndex] = slice;

  return {
    surveysResponseState: arr,
    lockAudienceMenuByQuestion: {},
    lockAudienceGateDetailsByQuestion: {},
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(prevState.submittedSinceLastEdit, 'user_edit'),
  };
};

export const buildAdditionalEncryptionAudienceState = (
  prevState: { submittedSinceLastEdit?: boolean; surveysResponseState?: unknown } = {},
  {
    audience,
    buildAdditionalAudienceSelectionPlan,
    buildSurveyResponseStateArray,
    deps,
    gateId = '',
    questionId,
    surveyIndex = 0,
  }: {
    audience: unknown;
    buildAdditionalAudienceSelectionPlan: (
      questionId: string,
      audience: unknown,
      gateId: string,
      slice: UnknownRecord,
      deps: UnknownRecord,
    ) => UnknownRecord;
    buildSurveyResponseStateArray: (args: UnknownRecord) => unknown[];
    deps: UnknownRecord;
    gateId?: string;
    questionId: string;
    surveyIndex?: number;
  },
): SurveyEncryptionResponseStatePatch => {
  const arr = buildSurveyResponseStateArray({
    prevSurveysResponseState: prevState.surveysResponseState,
    surveyIndex,
  });
  const slice = { ...((arr[surveyIndex] as UnknownRecord | undefined) || createEmptyResponseSlice()) };

  const { nextAdditionalState } = buildAdditionalAudienceSelectionPlan(questionId, audience, gateId, slice, deps);

  slice.additionalComments = {
    ...((slice.additionalComments as UnknownRecord | undefined) || {}),
    [questionId]: nextAdditionalState,
  };

  arr[surveyIndex] = slice;
  return {
    surveysResponseState: arr,
    lockAudienceMenuByQuestion: {},
    lockAudienceGateDetailsByQuestion: {},
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(prevState.submittedSinceLastEdit, 'user_edit'),
  };
};

export const buildSurveyResponseFetchLoadingState = (): SurveyResponseFetchLoadingStatePatch => ({
  isLoadingResponse: true,
  responseLookupWarning: '',
});

export const buildViewedSurveyResponseState = (
  prevState: { parsedViewAddressAnswers?: unknown } = {},
  viewAnswers: unknown,
  mergeDecryptedViewedResponse: (previousAnswers: unknown, nextAnswers: unknown) => unknown,
): SurveyViewedResponseStatePatch => {
  const merged = mergeDecryptedViewedResponse(prevState.parsedViewAddressAnswers, viewAnswers);
  return {
    viewAddressAnswers: JSON.stringify(merged),
    parsedViewAddressAnswers: merged,
    noResponse: false,
    responseLookupWarning: '',
  };
};

export const buildViewedSurveyNoResponseState = (noResponse: unknown = true): SurveyViewedResponseStatePatch => ({
  viewAddressAnswers: '',
  parsedViewAddressAnswers: null,
  noResponse: !!noResponse,
  responseLookupWarning: '',
});

export const buildUserSurveyResponseFoundState = ({
  hasEncrypted = false,
  resetSubmissionComplete = false,
  userAnswers = null,
}: {
  hasEncrypted?: unknown;
  resetSubmissionComplete?: boolean;
  userAnswers?: unknown;
} = {}): SurveyUserResponseFoundStatePatch => {
  const patch: SurveyUserResponseFoundStatePatch = {
    userHasResponse: true,
    userResponseEncrypted: !!hasEncrypted,
    startFresh: false,
    userAnswers,
  };
  if (resetSubmissionComplete) {
    patch.submissionComplete = false;
  }
  return patch;
};

export const buildUserSurveyResponseMissingState = (): SurveyUserResponseMissingStatePatch => ({
  userHasResponse: false,
  userResponseEncrypted: false,
  userAnswers: null,
});

export const buildSingleQuestionPoolFallbackState = (): SurveySingleQuestionPoolFallbackStatePatch => ({
  isLoadingResponse: false,
  questionPool: [],
});

export const buildSingleQuestionRetryLoadingState = (): SurveySingleQuestionRetryLoadingStatePatch => ({
  isLoadingResponse: true,
});

export const buildSingleQuestionPlaceholderHydrationState = (
  prevState: { surveysResponseState?: unknown } = {},
  {
    mergeSurveyResponseState,
    placeholderQuestion,
  }: {
    mergeSurveyResponseState: (currentState: unknown, newQuestionPool: unknown, surveyIndex: unknown) => unknown;
    placeholderQuestion: unknown;
  },
): SurveySingleQuestionPlaceholderHydrationStatePatch => ({
  questionPool: [placeholderQuestion],
  surveysResponseState: mergeSurveyResponseState(
    prevState.surveysResponseState || [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
    [placeholderQuestion],
    0,
  ),
  isLoadingResponse: false,
  noResponse: false,
  responseLookupWarning: '',
});

export const buildSingleQuestionReadyHydrationState = (
  prevState: { surveysResponseState?: unknown } = {},
  {
    mergeSurveyResponseState,
    questionData,
  }: {
    mergeSurveyResponseState: (currentState: unknown, newQuestionPool: unknown, surveyIndex: unknown) => unknown;
    questionData: UnknownRecord;
  },
): SurveySingleQuestionReadyHydrationStatePatch => {
  const hydratedQuestion = { ...questionData, id: questionData.id };
  return {
    questionPool: [hydratedQuestion],
    surveysResponseState: mergeSurveyResponseState(
      prevState.surveysResponseState || [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      [hydratedQuestion],
      0,
    ),
  };
};

export const buildDecryptEditStartState = (): SurveyDecryptEditStartStatePatch => ({
  isDecrypting: true,
  submissionError: '',
  suppressPrefill: true,
});

export const buildDecryptEditFailureState = (
  submissionError: unknown = 'Decryption failed.',
): SurveyDecryptEditFailureStatePatch => ({
  isDecrypting: false,
  submissionError: String(submissionError || 'Decryption failed.'),
});

export const buildResponseEditCompleteState = (): SurveyResponseEditCompleteStatePatch => ({
  isEditing: false,
  userHasResponse: true,
  userResponseEncrypted: true,
});

export const buildParsedViewAddressAnswersState = (
  parsedViewAddressAnswers: unknown = null,
): SurveyParsedViewAddressAnswersStatePatch => ({
  parsedViewAddressAnswers,
});

export const buildDisplayAnswerModeState = (displayAnswerMode: unknown): SurveyDisplayAnswerModeStatePatch => ({
  displayAnswerMode,
});

export const buildViewingResponseModeState = (): SurveyResponseModeStatePatch => ({
  displayAnswerMode: true,
  isEditing: false,
});

export const buildEditingResponseModeState = (): SurveyResponseModeStatePatch => ({
  displayAnswerMode: false,
  isEditing: true,
});

export const buildSubmissionErrorState = (submissionError: unknown): SurveySubmissionErrorStatePatch => ({
  submissionError,
});

export const buildResponseLoadingResetState = (
  submittedSinceLastEdit: unknown,
): SurveyResponseLoadingResetStatePatch => ({
  isLoadingResponse: true,
  submissionError: '',
  submissionComplete: false,
  submittedSinceLastEdit,
});

export const buildSurveyChangedResetState = (submittedSinceLastEdit: unknown): SurveyChangedResetStatePatch => ({
  userHasResponse: false,
  userAnswers: null,
  parsedViewAddressAnswers: null,
  noResponse: false,
  questionPool: [],
  questionPoolExpectedIds: [],
  questionPoolPendingIds: [],
  isEditing: false,
  surveysResponseState: [],
  jsonPreview: '',
  submissionError: '',
  submissionComplete: false,
  submittedSinceLastEdit,
});

export const buildSurveyAccountViewResetState = ({
  noResponse = false,
  parsedViewAddressAnswers = null,
  submittedSinceLastEdit = false,
}: {
  noResponse?: unknown;
  parsedViewAddressAnswers?: unknown;
  submittedSinceLastEdit?: unknown;
} = {}): SurveyAccountViewResetStatePatch => ({
  isLoadingResponse: true,
  userHasResponse: false,
  userAnswers: null,
  isEditing: false,
  parsedViewAddressAnswers,
  noResponse,
  submissionError: '',
  submissionComplete: false,
  submittedSinceLastEdit,
});

export const buildStandaloneAuthResetState = (
  submittedSinceLastEdit: unknown,
): SurveyStandaloneAuthResetStatePatch => ({
  isEditing: false,
  submissionError: '',
  submissionComplete: false,
  submittedSinceLastEdit,
});

export const buildSubmitStartState = (): SurveySubmitStartStatePatch => ({
  isSubmitting: true,
  submitProgress: 0,
  currentStep: 1,
  submissionError: '',
});

export const buildSubmitPreparationErrorState = (
  submissionError: unknown = 'No new or changed responses to submit.',
): SurveySubmitPreparationErrorStatePatch => ({
  isSubmitting: false,
  submitProgress: 0,
  submissionError: String(submissionError || 'No new or changed responses to submit.'),
});

// Regression guard: keep optimistic response state, baseline, and completion flag aligned;
// cache refreshers use submissionComplete to avoid overwriting the just-submitted draft.
export const buildSubmitSuccessState = ({
  editBaseline = null,
  hasEncrypted = false,
  responseUrl = '',
  submittedSinceLastEdit = false,
  surveysResponseState = [],
  userAnswers = null,
}: {
  editBaseline?: unknown;
  hasEncrypted?: unknown;
  responseUrl?: unknown;
  submittedSinceLastEdit?: unknown;
  surveysResponseState?: unknown;
  userAnswers?: unknown;
} = {}): SurveySubmitSuccessStatePatch => ({
  isSubmitting: false,
  submitProgress: 100,
  submissionComplete: true,
  submittedSinceLastEdit,
  currentStep: 3,
  suppressPrefill: false,
  responseUrl,
  surveysResponseState,
  editBaseline,
  userAnswers,
  userHasResponse: true,
  userResponseEncrypted: !!hasEncrypted,
  isDirty: false,
  modifiedCount: 0,
  pileDiscardedEdits: false,
  hasEncryptedChanges: false,
});

export const buildSubmitFailureState = ({
  submittedSinceLastEdit = false,
  submissionError = 'Submission failed.',
}: {
  submittedSinceLastEdit?: unknown;
  submissionError?: unknown;
} = {}): SurveySubmitFailureStatePatch => ({
  isSubmitting: false,
  submitProgress: 0,
  submissionComplete: false,
  submittedSinceLastEdit,
  submissionError: String(submissionError || 'Submission failed.'),
});

export const buildCurrentStepState = (currentStep: unknown): SurveyCurrentStepStatePatch => ({
  currentStep: Number(currentStep || 0),
});

export const buildSurveysResponseStatePatch = (surveysResponseState: unknown): SurveyResponseStatePatch => ({
  surveysResponseState,
});

export const buildSurveyUserEditResponseStatePatch = (
  surveysResponseState: unknown,
  submittedSinceLastEdit: unknown,
): SurveyUserEditResponseStatePatch => ({
  surveysResponseState,
  isEditing: true,
  submittedSinceLastEdit,
});

export const buildPrefillQueuedAfterCacheState = (
  prefillQueuedAfterCache: unknown,
): SurveyPrefillQueuedAfterCacheStatePatch => ({
  prefillQueuedAfterCache: !!prefillQueuedAfterCache,
});

export const buildHydratingPriorResponsesState = (
  isHydratingPriorResponses: unknown,
): SurveyHydratingPriorResponsesStatePatch => ({
  isHydratingPriorResponses: !!isHydratingPriorResponses,
});

export const buildBookmarkedQuestionsState = (
  questions: unknown[] | null | undefined = [],
): SurveyBookmarkedQuestionsStatePatch => ({
  bookmarkedQuestions: new Set((Array.isArray(questions) ? questions : []).map((questionId) => String(questionId))),
});

export const buildBulkPromptReloadingState = (bulkPromptReloading: unknown) => ({
  bulkPromptReloading: !!bulkPromptReloading,
});

export const buildActiveTagModalState = (activeTagModalTag: unknown = '') => ({
  activeTagModalTag: String(activeTagModalTag || '').trim(),
});

export const buildSurveyQuestionsJsonTreeItemStyle = (level: unknown) => ({
  marginLeft: `${Number(level) * 20}px`,
});

export const buildSurveyQuestionsLockAudienceGateClassName = (styleMap: Record<string, string>, active: unknown) =>
  `${styleMap.convictionToggleLine} ${styleMap.lockAudienceGateButton} ${active ? styleMap.convictionToggleButtonActive : ''}`;

export const buildSurveyQuestionsLockAudiencePopoverClassName = (
  styleMap: Record<string, string>,
  isPileVisualContext: unknown,
) => `${styleMap.lockAudiencePopover} ${isPileVisualContext ? styleMap.pileLockAudiencePopover : ''}`;

export const buildSurveyQuestionsLockAudienceToggleClassName = (styleMap: Record<string, string>, active: unknown) =>
  `${styleMap.convictionToggleLine} ${active ? styleMap.convictionToggleButtonActive : ''}`;

export const resolveSurveyQuestionsIconGlowClassName = (styleMap: Record<string, string>, showGlow: unknown) =>
  showGlow ? styleMap.iconGlow : undefined;

export const SURVEY_QUESTIONS_SUBMIT_ICON_STYLE = {
  marginRight: '10px',
};

export const SURVEY_QUESTIONS_SUBMISSION_ERROR_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'red',
};

export const buildSurveyQuestionsFullLoadingProgressFillStyle = ({
  hydrateDiscovered = 0,
  hydrateDone = 0,
  isHydrating = false,
  scanPercent = 0,
}: {
  hydrateDiscovered?: unknown;
  hydrateDone?: unknown;
  isHydrating?: unknown;
  scanPercent?: unknown;
} = {}) => ({
  width: `${
    isHydrating
      ? Number(hydrateDiscovered) > 0
        ? Math.round((Math.min(Number(hydrateDone), Number(hydrateDiscovered)) / Number(hydrateDiscovered)) * 100)
        : 0
      : scanPercent
  }%`,
});

export const buildSurveyQuestionsFullLoadingProgressState = ({
  questionScanProgress = null,
  progressSlug = '',
}: {
  questionScanProgress?: SurveyQuestionsQuestionScanProgress;
  progressSlug?: unknown;
} = {}): SurveyQuestionsFullLoadingProgressState => {
  const normalizedProgressSlug = normalizeQuestionProgressSlug(String(progressSlug || ''));
  const matchedProgress =
    questionScanProgress &&
    doesQuestionProgressMatchSlug(String(questionScanProgress.slug || ''), normalizedProgressSlug)
      ? questionScanProgress
      : null;
  const scanProgressDisplay = buildQuestionScanProgressDisplay(matchedProgress);
  const hydrateDiscovered = Math.max(0, Number(matchedProgress?.discoveredQuestions || 0));
  const hydrateDone = Math.max(0, Number(matchedProgress?.hydratedQuestions || 0));
  const isHydrating = matchedProgress?.phase === 'hydrate';
  const hasFullLoadingProgress = scanProgressDisplay.requestedTotalBlocks > 0 || isHydrating;
  const hydrateDoneClamped = Math.min(hydrateDone, hydrateDiscovered);

  return {
    questionScanProgress: matchedProgress,
    scanProgressDisplay,
    hydrateDiscovered,
    hydrateDone,
    isHydrating,
    hasFullLoadingProgress,
    metaLeftText: isHydrating
      ? `${Math.max(0, hydrateDiscovered - hydrateDoneClamped)} items left`
      : scanProgressDisplay.metaLeftText,
    metaRightText: isHydrating ? `${hydrateDoneClamped} / ${hydrateDiscovered}` : scanProgressDisplay.metaRightText,
    fillStyle: buildSurveyQuestionsFullLoadingProgressFillStyle({
      hydrateDiscovered,
      hydrateDone,
      isHydrating,
      scanPercent: scanProgressDisplay.percentComplete,
    }),
  };
};

export const buildSurveyQuestionsSubmitAuxIconClassName = (
  styleMap: Record<string, string>,
  isSingleQuestionView: unknown,
) => {
  const className =
    `${styleMap.iconButton} ${isSingleQuestionView ? styleMap.singleQuestionSubmitIconButton : ''}`.trim();
  return className || undefined;
};

export const buildSurveyQuestionsAuthoringPanelDisplayState = ({
  canEditQuestions = false,
  hasCurrentSurveyResponseState = false,
  hideEmbeddedDebugUi = false,
  questionPoolReady = false,
  singleQuestionMode = false,
}: {
  canEditQuestions?: unknown;
  hasCurrentSurveyResponseState?: unknown;
  hideEmbeddedDebugUi?: unknown;
  questionPoolReady?: unknown;
  singleQuestionMode?: unknown;
} = {}): SurveyQuestionsAuthoringPanelDisplayState => {
  const showAuthoringControls = !!canEditQuestions && !singleQuestionMode;
  const showDebugAuthoringControls = !hideEmbeddedDebugUi && showAuthoringControls;

  return {
    showBackToTopControl: showAuthoringControls,
    showJsonControl: showDebugAuthoringControls,
    showLockedQuestionsBanner: !!(
      !hideEmbeddedDebugUi &&
      canEditQuestions &&
      questionPoolReady &&
      hasCurrentSurveyResponseState
    ),
  };
};

export const buildSurveyQuestionsAuthoringRouteReadinessDescriptor = ({
  canEditQuestions = false,
  gatedEmptyStateReady = false,
  hasCurrentSurveyResponseState = false,
  questionPoolReady = false,
  visibleQuestionPool = [],
}: {
  canEditQuestions?: unknown;
  gatedEmptyStateReady?: unknown;
  hasCurrentSurveyResponseState?: unknown;
  questionPoolReady?: unknown;
  visibleQuestionPool?: unknown;
} = {}): SurveyQuestionsAuthoringRouteReadinessDescriptor => {
  const visibleQuestionCount = Array.isArray(visibleQuestionPool) ? visibleQuestionPool.length : 0;
  const hasVisibleQuestions = visibleQuestionCount > 0;

  return {
    canEditQuestions: !!canEditQuestions,
    gatedEmptyStateReady: !!gatedEmptyStateReady,
    hasCurrentSurveyResponseState: !!hasCurrentSurveyResponseState,
    hasVisibleQuestions,
    questionPoolReady: !!questionPoolReady,
    shouldRenderEditableQuestions: !!(
      canEditQuestions &&
      questionPoolReady &&
      hasCurrentSurveyResponseState &&
      !gatedEmptyStateReady &&
      hasVisibleQuestions
    ),
    visibleQuestionCount,
  };
};

export const buildSurveyQuestionsJsonPanelDisplayState = ({
  isSingleQuestionView = false,
  isStandalone = false,
  singleQuestionMode = false,
  showQuestionsJson = false,
  showResponseJson = false,
  showSurveyJson = false,
  styleMap = {},
}: {
  isSingleQuestionView?: unknown;
  isStandalone?: unknown;
  singleQuestionMode?: unknown;
  showQuestionsJson?: unknown;
  showResponseJson?: unknown;
  showSurveyJson?: unknown;
  styleMap?: Record<string, string>;
} = {}): SurveyQuestionsJsonPanelDisplayState => {
  const showQuestionJsonControls = !!(singleQuestionMode || isStandalone);
  const showFullSurveyJsonControls = !isStandalone && !singleQuestionMode;
  const showSurveyJsonPanel = !!showSurveyJson && !isStandalone && !singleQuestionMode;
  const showQuestionsJsonPanel = !!showQuestionsJson && showQuestionJsonControls;
  const showResponseJsonPanel = !!showResponseJson;
  const surveyJsonToggleClassName = isSingleQuestionView ? styleMap.singleQuestionJsonToggle : undefined;
  const surveyJsonRowClassName =
    [styleMap.surveyJsonRow, isSingleQuestionView ? styleMap.singleQuestionJsonRow : ''].filter(Boolean).join(' ') ||
    undefined;
  const questionJsonToggleClassName =
    [surveyJsonToggleClassName, isSingleQuestionView ? styleMap.singleQuestionJsonToggleQuestion : '']
      .filter(Boolean)
      .join(' ') || undefined;
  const responseJsonToggleClassName =
    [surveyJsonToggleClassName, isSingleQuestionView ? styleMap.singleQuestionJsonToggleResponse : '']
      .filter(Boolean)
      .join(' ') || undefined;

  return {
    showFullSurveyJsonControls,
    showQuestionJsonControls,
    showQuestionsJson: !!showQuestionsJson,
    showSurveyJsonPanel,
    showQuestionsJsonPanel,
    showResponseJson: !!showResponseJson,
    showResponseJsonPanel,
    showSurveyJson: !!showSurveyJson,
    surveyJsonRowClassName,
    surveyJsonToggleClassName,
    questionJsonToggleClassName,
    responseJsonToggleClassName,
    surveyJsonPanelClassName: isSingleQuestionView ? styleMap.singleQuestionJsonPanel : undefined,
  };
};

export const buildSurveyQuestionsJsonPreviewDisplayState = ({
  jsonPreview = null,
  questionPool = null,
  viewingAnswers = false,
}: {
  jsonPreview?: unknown;
  questionPool?: unknown;
  viewingAnswers?: unknown;
} = {}): SurveyQuestionsJsonPreviewDisplayState => {
  const canUseJsonPreview = !viewingAnswers || Array.isArray(questionPool);

  return {
    canUseJsonPreview,
    jsonPreview: canUseJsonPreview ? jsonPreview || {} : null,
  };
};

export const buildSurveyQuestionsJsonForDisplayState = ({
  isOwnResponse,
  jsonPreview = null,
  noResponse,
  parsedViewAddressAnswers = null,
  responderAddress,
  singleQuestionMode,
  userAnswers = null,
  viewAddress,
  viewingAnswers,
}: {
  isOwnResponse?: unknown;
  jsonPreview?: unknown;
  noResponse?: unknown;
  parsedViewAddressAnswers?: unknown;
  responderAddress?: unknown;
  singleQuestionMode?: unknown;
  userAnswers?: unknown;
  viewAddress?: unknown;
  viewingAnswers?: unknown;
} = {}): SurveyQuestionsJsonForDisplayState => {
  if (!viewingAnswers) {
    return { jsonForDisplay: jsonPreview };
  }

  if (noResponse) {
    return {
      jsonForDisplay: {
        message: `No response found for ${singleQuestionMode ? 'question' : 'survey'} from address: ${
          viewAddress || responderAddress || 'N/A'
        }`,
      },
    };
  }

  return {
    jsonForDisplay: isOwnResponse
      ? userAnswers || jsonPreview
      : parsedViewAddressAnswers || { info: 'Loading viewed response...' },
  };
};

export const buildSurveyQuestionsLayoutDisplayState = ({
  activeTagModalTag = '',
  isSingleQuestionView = false,
  isStandalone = false,
  singleQuestionMode = false,
  styleMap = {},
  viewingAnswers = false,
}: {
  activeTagModalTag?: unknown;
  isSingleQuestionView?: unknown;
  isStandalone?: unknown;
  singleQuestionMode?: unknown;
  styleMap?: Record<string, string>;
  viewingAnswers?: unknown;
} = {}): SurveyQuestionsLayoutDisplayState => {
  const useTagModal = !singleQuestionMode && !isStandalone;
  const surveyPageClassName =
    [
      isSingleQuestionView ? styleMap.singleQuestionPage : '',
      isSingleQuestionView && viewingAnswers ? styleMap.singleQuestionReadPage : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return {
    activeTagModalTag: useTagModal ? String(activeTagModalTag || '').trim() : '',
    responseViewClassName: isSingleQuestionView ? styleMap.singleQuestionResponseView : undefined,
    surveyPageClassName,
    topSectionClassName: isSingleQuestionView ? styleMap.singleQuestionTopBar : undefined,
    useTagModal,
  };
};

export const buildSurveyQuestionsRouteViewDisplayState = ({
  account,
  isEditing,
  isStandalone,
  questionPool,
  responderAddress,
  shortenAddress,
  singleQuestionMode,
  userHasResponse,
  viewAddress,
  viewingAnswers,
}: {
  account?: string;
  isEditing?: unknown;
  isStandalone?: unknown;
  questionPool?: unknown;
  responderAddress?: string;
  shortenAddress?: (address: string, notClickable: boolean) => string;
  singleQuestionMode?: unknown;
  userHasResponse?: unknown;
  viewAddress?: string;
  viewingAnswers?: unknown;
} = {}): SurveyQuestionsRouteViewDisplayState => {
  const viewedAddressRaw = String(viewAddress || responderAddress || '').trim();
  const viewedAddressLower = viewedAddressRaw.toLowerCase();
  const shortenedViewAddress = viewedAddressRaw
    ? (shortenAddress || ((address: string) => address))(viewedAddressRaw, false)
    : '';
  const isOwnResponse =
    (viewAddress && account && viewAddress.toLowerCase() === account.toLowerCase()) ||
    (responderAddress && account && responderAddress.toLowerCase() === account.toLowerCase()) ||
    (!viewAddress && !responderAddress && account && userHasResponse);
  const isSingleQuestionView =
    singleQuestionMode || (isStandalone && Array.isArray(questionPool) && questionPool.length === 1);
  const showViewAnswersButton = (viewAddress || responderAddress) && (!isOwnResponse || !isEditing);
  const viewAnswersButtonText = viewingAnswers
    ? ` Fill out ${singleQuestionMode ? 'question' : 'survey'}`
    : ` View ${shortenedViewAddress} ${singleQuestionMode ? 'answer' : 'answers'}`;

  return {
    viewedAddressRaw,
    viewedAddressLower,
    shortenedViewAddress,
    isOwnResponse,
    isSingleQuestionView,
    showViewAnswersButton,
    viewAnswersButtonText,
  };
};

export const buildSurveyQuestionsSubmitFooterDisplayState = ({
  currentStep = 0,
  hasEncryptedAnswers = false,
  hasMaskedCurrentQuestionPayload = false,
  isDirty = false,
  isEditing = false,
  isLoadingResponse = false,
  isSingleQuestionView = false,
  isSubmitting = false,
  pendingEditCount = 0,
  responseUrl = '',
  singleQuestionMode = false,
  startFresh = false,
  submissionComplete = false,
  submittedSinceLastEdit = false,
  useHeaderSubmit = false,
  userHasResponse = false,
}: {
  currentStep?: unknown;
  hasEncryptedAnswers?: unknown;
  hasMaskedCurrentQuestionPayload?: unknown;
  isDirty?: unknown;
  isEditing?: unknown;
  isLoadingResponse?: unknown;
  isSingleQuestionView?: unknown;
  isSubmitting?: unknown;
  pendingEditCount?: unknown;
  responseUrl?: unknown;
  singleQuestionMode?: unknown;
  startFresh?: unknown;
  submissionComplete?: unknown;
  submittedSinceLastEdit?: unknown;
  useHeaderSubmit?: unknown;
  userHasResponse?: unknown;
} = {}): SurveyQuestionsSubmitFooterDisplayState => {
  const pendingCount = Number(pendingEditCount || 0);
  const isSingle = !!isSingleQuestionView;
  const submittedStateActive = !!(submittedSinceLastEdit || submissionComplete);
  const submittedIndicatorActive = submittedStateActive && !isLoadingResponse;
  const singleQuestionSubmittedIndicatorActive = !isSingle && submittedIndicatorActive;
  const showSubmitAux =
    !isSingle &&
    ((pendingCount > 0 && !isSubmitting && !singleQuestionSubmittedIndicatorActive) ||
      (singleQuestionSubmittedIndicatorActive && !!responseUrl));
  const uploadStatusText =
    isSubmitting && Number(currentStep || 0) === 1 && !!hasEncryptedAnswers ? 'Encrypting...' : 'Uploading...';
  const submitDisabled = !!(isSubmitting || (singleQuestionMode && hasMaskedCurrentQuestionPayload));
  const canEditQuestions = !userHasResponse || !!startFresh || !!isEditing;
  const hasPendingEdits = !!isDirty || pendingCount > 0;
  const genericShowInlineSubmit =
    !useHeaderSubmit && (canEditQuestions ? hasPendingEdits || submittedIndicatorActive : submittedIndicatorActive);
  const showInlineSubmit = isSingle ? hasPendingEdits : genericShowInlineSubmit;

  return {
    submittedStateActive,
    submittedIndicatorActive,
    singleQuestionSubmittedIndicatorActive,
    showSubmitAux,
    uploadStatusText,
    submitDisabled,
    canEditQuestions,
    hasPendingEdits,
    genericShowInlineSubmit,
    showInlineSubmit,
    showTopInlineSubmit: showInlineSubmit && !isSingle,
  };
};

const normalizeSubmitReadinessCount = (value: unknown): number => {
  const count = Number(value || 0);
  return Number.isFinite(count) ? count : 0;
};

export const buildSurveyQuestionsSubmitReadinessDescriptor = ({
  currentStep = 0,
  isSubmitting = false,
  pendingStats = null,
  resolveMaskedCurrentQuestionPayload,
  singleQuestionMode = false,
}: {
  currentStep?: unknown;
  isSubmitting?: unknown;
  pendingStats?: { total?: unknown; encrypted?: unknown } | null;
  resolveMaskedCurrentQuestionPayload?: () => unknown;
  singleQuestionMode?: unknown;
} = {}): SurveyQuestionsSubmitReadinessDescriptor => {
  const normalizedCurrentStep = normalizeSubmitReadinessCount(currentStep);
  const normalizedPendingStats = pendingStats || {};
  const pendingEditCount = normalizeSubmitReadinessCount(normalizedPendingStats.total);
  const encryptedPendingEditCount = normalizeSubmitReadinessCount(normalizedPendingStats.encrypted);
  const submitting = !!isSubmitting;
  const isSingleQuestion = !!singleQuestionMode;
  const shouldCheckMaskedCurrentQuestionPayload = !submitting && isSingleQuestion;
  const hasMaskedCurrentQuestionPayload = shouldCheckMaskedCurrentQuestionPayload
    ? !!resolveMaskedCurrentQuestionPayload?.()
    : false;
  const hasEncryptedAnswers = submitting && normalizedCurrentStep === 1 && encryptedPendingEditCount > 0;

  return {
    currentStep: normalizedCurrentStep,
    encryptedPendingEditCount,
    hasEncryptedAnswers,
    hasMaskedCurrentQuestionPayload,
    isSubmitting: submitting,
    pendingEditCount,
    shouldCheckMaskedCurrentQuestionPayload,
    singleQuestionMode: isSingleQuestion,
    uploadPhase: hasEncryptedAnswers ? 'encrypting' : 'uploading',
  };
};

export const buildSurveyQuestionsPrimarySubmitPlan = ({
  account = '',
  draftSlug = '',
  isStandalone = false,
  isSubmitting = false,
  pendingEditCount = 0,
  questionID = '',
  singleQuestionMode = false,
  submissionComplete = false,
  submitGuardActive = false,
  submittedSinceLastEdit = false,
  surveyId = '',
}: {
  account?: unknown;
  draftSlug?: unknown;
  isStandalone?: unknown;
  isSubmitting?: unknown;
  pendingEditCount?: unknown;
  questionID?: unknown;
  singleQuestionMode?: unknown;
  submissionComplete?: unknown;
  submitGuardActive?: unknown;
  submittedSinceLastEdit?: unknown;
  surveyId?: unknown;
} = {}): SurveyQuestionsPrimarySubmitPlan => {
  if (isSubmitting) {
    return { action: 'inert', reason: 'submitting', path: '' };
  }
  if (submitGuardActive) {
    return { action: 'inert', reason: 'submit_guard', path: '' };
  }

  const pendingCount = Number(pendingEditCount || 0);
  const hasPendingEdits = pendingCount > 0;
  const completed = !!submissionComplete;
  const submittedStateActive = !!(submittedSinceLastEdit || completed);
  if (submittedStateActive && !completed && !hasPendingEdits) {
    return { action: 'inert', reason: 'submitted_without_new_edits', path: '' };
  }

  if (completed && !hasPendingEdits) {
    const accountLower = String(account || '').toLowerCase();
    if (!accountLower) {
      return { action: 'inert', reason: 'missing_account', path: '' };
    }
    if (singleQuestionMode) {
      const questionIdLower = String(questionID || '').toLowerCase();
      if (!questionIdLower) {
        return { action: 'inert', reason: 'missing_question_id', path: '' };
      }
      return {
        action: 'navigate',
        reason: 'completed_single_question_response',
        path: buildQuestionRoutePath(questionIdLower, {
          responderAddress: accountLower,
          sessionSlug: draftSlug,
        }),
      };
    }
    if (!isStandalone) {
      const surveyIdLower = String(surveyId || '').toLowerCase();
      if (!surveyIdLower) {
        return { action: 'inert', reason: 'missing_survey_id', path: '' };
      }
      const normalizedDraftSlug = String(draftSlug || '');
      return {
        action: 'navigate',
        reason: 'completed_survey_response',
        path: `/survey/${surveyIdLower}/${accountLower}${normalizedDraftSlug ? `?session=${encodeURIComponent(normalizedDraftSlug)}` : ''}`,
      };
    }
    return { action: 'inert', reason: 'completed_standalone_response', path: '' };
  }

  return {
    action: 'submit',
    reason: hasPendingEdits ? 'pending_edits' : 'submit_requested',
    path: '',
  };
};

export const buildCopiedQuestionsJsonState = (copiedQuestionsJson: unknown) => ({
  copiedQuestionsJson: !!copiedQuestionsJson,
});

export const buildCopiedResponseJsonState = (copiedResponseJson: unknown) => ({
  copiedResponseJson: !!copiedResponseJson,
});

export const buildCopiedSurveyJsonState = (copiedSurveyJson: unknown) => ({
  copiedSurveyJson: !!copiedSurveyJson,
});

export const buildInitialSurveyQuestionsState = (props: SurveyQuestionsProps = {}): SurveyQuestionsState => ({
  surveysResponseState: [],
  displayAnswerMode: props.displayAnswerMode,
  viewAddressAnswers: '',
  noResponse: false,
  responseLookupWarning: '',
  userHasResponse: false,
  userResponseEncrypted: false,
  startFresh: false,
  userAnswers: null,
  isDecrypting: false,
  jsonPreview: '',
  isEditing: false,
  isSubmitting: false,
  submitProgress: 0,
  submissionComplete: false,
  submittedSinceLastEdit: updateSubmittedSinceLastEdit(false, 'reset'),
  responseUrl: '',
  submissionError: '',
  currentStep: 0,
  questionPool: props.isStandalone || props.singleQuestionMode ? props.questionPool || [] : [],
  questionPoolExpectedIds: [],
  questionPoolPendingIds: [],
  showJson: false,
  showQuestionsJson: false,
  showResponseJson: false,
  copiedQuestionsJson: false,
  copiedResponseJson: false,
  isLoadingResponse: false,
  parsedViewAddressAnswers: null,
  decryptionNonce: 0,
  ...buildBookmarkedQuestionsState(),
  showSurveyJson: false,
  copiedSurveyJson: false,
  modifiedCount: 0,
  pileDiscardedEdits: false,
  encryptedModifiedCount: 0,
  isDirty: false,
  hasEncryptedChanges: false,
  autoDecryptEnabled: false,
  autoDecryptAttempted: {},
  showComments: {},
  lockAudienceMenuByQuestion: {},
  lockAudienceGateDetailsByQuestion: {},
  sliderModeByQuestion: {},
  sliderToggleExpandedByQuestion: {},
  activeTagModalTag: '',
  prefillQueuedAfterCache: false,
  isHydratingPriorResponses: false,
  decryptingByKey: {},
  bulkPromptReloading: false,
  lockedGateDetailsExpanded: false,
  gateSbtNameRevision: 0,
  hasher: null,
  ...buildCanDecryptOtherResponsesState(),
});
