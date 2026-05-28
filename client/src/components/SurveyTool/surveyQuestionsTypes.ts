import { updateSubmittedSinceLastEdit } from './surveyToolUtils.js';
import type { ResponseSlice, UnknownRecord } from './surveyToolTypes.js';
import {
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  normalizeQuestionProgressSlug,
} from './surveyToolViewState.js';

export type SurveyQuestionsProps = UnknownRecord & {
  displayAnswerMode?: boolean;
  isStandalone?: boolean;
  singleQuestionMode?: boolean;
  questionPool?: unknown[];
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

export type SurveyQuestionsState = UnknownRecord & {
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

  const expectedIds = Array.isArray(questionPoolExpectedIds)
    ? questionPoolExpectedIds
    : [];
  const pendingIds = Array.isArray(questionPoolPendingIds)
    ? questionPoolPendingIds
    : [];
  const pendingCount = pendingIds.length;

  return {
    expectedIds,
    pendingIds,
    pendingCount,
    isIncomplete: expectedIds.length > 0 && pendingCount > 0,
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

export const toggleShowJsonState = (
  prevState: { showJson?: unknown } = {}
): SurveyShowJsonStatePatch => ({
  showJson: !prevState.showJson,
});

export const buildDecryptEditStartState = (): SurveyDecryptEditStartStatePatch => ({
  isDecrypting: true,
  submissionError: '',
  suppressPrefill: true,
});

export const buildDecryptEditFailureState = (
  submissionError: unknown = 'Decryption failed.'
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
  parsedViewAddressAnswers: unknown = null
): SurveyParsedViewAddressAnswersStatePatch => ({
  parsedViewAddressAnswers,
});

export const buildDisplayAnswerModeState = (
  displayAnswerMode: unknown
): SurveyDisplayAnswerModeStatePatch => ({
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

export const buildSubmissionErrorState = (
  submissionError: unknown
): SurveySubmissionErrorStatePatch => ({
  submissionError,
});

export const buildResponseLoadingResetState = (
  submittedSinceLastEdit: unknown
): SurveyResponseLoadingResetStatePatch => ({
  isLoadingResponse: true,
  submissionError: '',
  submissionComplete: false,
  submittedSinceLastEdit,
});

export const buildSurveyChangedResetState = (
  submittedSinceLastEdit: unknown
): SurveyChangedResetStatePatch => ({
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
  submittedSinceLastEdit: unknown
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
  submissionError: unknown = 'No new or changed responses to submit.'
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

export const buildSurveysResponseStatePatch = (
  surveysResponseState: unknown
): SurveyResponseStatePatch => ({
  surveysResponseState,
});

export const buildSurveyUserEditResponseStatePatch = (
  surveysResponseState: unknown,
  submittedSinceLastEdit: unknown
): SurveyUserEditResponseStatePatch => ({
  surveysResponseState,
  isEditing: true,
  submittedSinceLastEdit,
});

export const buildPrefillQueuedAfterCacheState = (
  prefillQueuedAfterCache: unknown
): SurveyPrefillQueuedAfterCacheStatePatch => ({
  prefillQueuedAfterCache: !!prefillQueuedAfterCache,
});

export const buildHydratingPriorResponsesState = (
  isHydratingPriorResponses: unknown
): SurveyHydratingPriorResponsesStatePatch => ({
  isHydratingPriorResponses: !!isHydratingPriorResponses,
});

export const buildBookmarkedQuestionsState = (
  questions: unknown[] | null | undefined = []
): SurveyBookmarkedQuestionsStatePatch => ({
  bookmarkedQuestions: new Set(
    (Array.isArray(questions) ? questions : []).map((questionId) => String(questionId))
  ),
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

export const buildSurveyQuestionsLockAudienceGateClassName = (
  styleMap: Record<string, string>,
  active: unknown
) => `${styleMap.convictionToggleLine} ${styleMap.lockAudienceGateButton} ${active ? styleMap.convictionToggleButtonActive : ''}`;

export const buildSurveyQuestionsLockAudiencePopoverClassName = (
  styleMap: Record<string, string>,
  isPileVisualContext: unknown
) => `${styleMap.lockAudiencePopover} ${isPileVisualContext ? styleMap.pileLockAudiencePopover : ''}`;

export const buildSurveyQuestionsLockAudienceToggleClassName = (
  styleMap: Record<string, string>,
  active: unknown
) => `${styleMap.convictionToggleLine} ${active ? styleMap.convictionToggleButtonActive : ''}`;

export const resolveSurveyQuestionsIconGlowClassName = (
  styleMap: Record<string, string>,
  showGlow: unknown
) => showGlow ? styleMap.iconGlow : undefined;

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
  width: `${isHydrating
    ? (Number(hydrateDiscovered) > 0
      ? Math.round((Math.min(Number(hydrateDone), Number(hydrateDiscovered)) / Number(hydrateDiscovered)) * 100)
      : 0)
    : scanPercent}%`,
});

export const buildSurveyQuestionsFullLoadingProgressState = ({
  questionScanProgress = null,
  progressSlug = '',
}: {
  questionScanProgress?: SurveyQuestionsQuestionScanProgress;
  progressSlug?: unknown;
} = {}): SurveyQuestionsFullLoadingProgressState => {
  const normalizedProgressSlug = normalizeQuestionProgressSlug(String(progressSlug || ''));
  const matchedProgress = questionScanProgress &&
    doesQuestionProgressMatchSlug(String(questionScanProgress.slug || ''), normalizedProgressSlug)
    ? questionScanProgress
    : null;
  const scanProgressDisplay = buildQuestionScanProgressDisplay(matchedProgress);
  const hydrateDiscovered = Math.max(0, Number(matchedProgress?.discoveredQuestions || 0));
  const hydrateDone = Math.max(0, Number(matchedProgress?.hydratedQuestions || 0));
  const isHydrating = matchedProgress?.phase === 'hydrate';
  const hasFullLoadingProgress = (scanProgressDisplay.requestedTotalBlocks > 0) || isHydrating;
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
    metaRightText: isHydrating
      ? `${hydrateDoneClamped} / ${hydrateDiscovered}`
      : scanProgressDisplay.metaRightText,
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
  isSingleQuestionView: unknown
) => {
  const className = `${styleMap.iconButton} ${isSingleQuestionView ? styleMap.singleQuestionSubmitIconButton : ''}`.trim();
  return className || undefined;
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
  const showSurveyJsonPanel = !!showSurveyJson && !isStandalone && !singleQuestionMode;
  const showQuestionsJsonPanel = !!showQuestionsJson && showQuestionJsonControls;
  const showResponseJsonPanel = !!showResponseJson;
  const surveyJsonToggleClassName = isSingleQuestionView ? styleMap.singleQuestionJsonToggle : undefined;
  const surveyJsonRowClassName = [
    styleMap.surveyJsonRow,
    isSingleQuestionView ? styleMap.singleQuestionJsonRow : '',
  ].filter(Boolean).join(' ') || undefined;
  const questionJsonToggleClassName = [
    surveyJsonToggleClassName,
    isSingleQuestionView ? styleMap.singleQuestionJsonToggleQuestion : '',
  ].filter(Boolean).join(' ') || undefined;
  const responseJsonToggleClassName = [
    surveyJsonToggleClassName,
    isSingleQuestionView ? styleMap.singleQuestionJsonToggleResponse : '',
  ].filter(Boolean).join(' ') || undefined;

  return {
    showQuestionJsonControls,
    showSurveyJsonPanel,
    showQuestionsJsonPanel,
    showResponseJsonPanel,
    surveyJsonRowClassName,
    surveyJsonToggleClassName,
    questionJsonToggleClassName,
    responseJsonToggleClassName,
    surveyJsonPanelClassName: isSingleQuestionView ? styleMap.singleQuestionJsonPanel : undefined,
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
      ? (userAnswers || jsonPreview)
      : (parsedViewAddressAnswers || { info: 'Loading viewed response...' }),
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
  const surveyPageClassName = [
    isSingleQuestionView ? styleMap.singleQuestionPage : '',
    isSingleQuestionView && viewingAnswers ? styleMap.singleQuestionReadPage : '',
  ].filter(Boolean).join(' ') || undefined;

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
    (viewAddress &&
      account &&
      viewAddress.toLowerCase() === account.toLowerCase()) ||
    (responderAddress &&
      account &&
      responderAddress.toLowerCase() === account.toLowerCase()) ||
    (!viewAddress && !responderAddress && account && userHasResponse);
  const isSingleQuestionView =
    singleQuestionMode ||
    (isStandalone && Array.isArray(questionPool) && questionPool.length === 1);
  const showViewAnswersButton =
    (viewAddress || responderAddress) && (!isOwnResponse || !isEditing);
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
    !isSingle && (
      (pendingCount > 0 && !isSubmitting && !singleQuestionSubmittedIndicatorActive) ||
      (singleQuestionSubmittedIndicatorActive && !!responseUrl)
    );
  const uploadStatusText =
    isSubmitting &&
    Number(currentStep || 0) === 1 &&
    !!hasEncryptedAnswers
      ? 'Encrypting...'
      : 'Uploading...';
  const submitDisabled = !!(
    isSubmitting ||
    (singleQuestionMode && hasMaskedCurrentQuestionPayload)
  );
  const canEditQuestions = !userHasResponse || !!startFresh || !!isEditing;
  const hasPendingEdits = !!isDirty || pendingCount > 0;
  const genericShowInlineSubmit = !useHeaderSubmit && (
    canEditQuestions
      ? hasPendingEdits || submittedIndicatorActive
      : submittedIndicatorActive
  );
  const showInlineSubmit = isSingle
    ? hasPendingEdits
    : genericShowInlineSubmit;

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

export const buildCopiedQuestionsJsonState = (copiedQuestionsJson: unknown) => ({
  copiedQuestionsJson: !!copiedQuestionsJson,
});

export const buildCopiedResponseJsonState = (copiedResponseJson: unknown) => ({
  copiedResponseJson: !!copiedResponseJson,
});

export const buildCopiedSurveyJsonState = (copiedSurveyJson: unknown) => ({
  copiedSurveyJson: !!copiedSurveyJson,
});

export const buildInitialSurveyQuestionsState = (
  props: SurveyQuestionsProps = {}
): SurveyQuestionsState => ({
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
