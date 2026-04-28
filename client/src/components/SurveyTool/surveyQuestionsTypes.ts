import { updateSubmittedSinceLastEdit } from './surveyToolUtils.js';
import type { ResponseSlice, UnknownRecord } from './surveyToolTypes.js';

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

export type SurveyAutoDecryptDisabledStatePatch = {
  autoDecryptEnabled: boolean;
  decryptingByKey: Record<string, unknown>;
};

export type SurveyCanDecryptOtherResponsesStatePatch = {
  canDecryptOtherResponses: boolean;
  canDecryptOtherResponsesStatus: string;
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
  bookmarkedQuestions: new Set<string>(),
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
