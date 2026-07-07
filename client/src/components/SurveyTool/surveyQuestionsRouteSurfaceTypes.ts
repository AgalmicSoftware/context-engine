import type React from 'react';

import type {
  SurveyQuestionsAuthoringPanelDisplayState,
  SurveyQuestionsFullLoadingProgressState,
  SurveyQuestionsJsonPanelDisplayState,
  SurveyQuestionsLayoutDisplayState,
  SurveyQuestionsRenderReadinessDescriptor,
  SurveyQuestionsRouteViewDisplayState,
  SurveyQuestionsSubmitFooterDisplayState,
} from './surveyQuestionsTypes.js';

type SurveyQuestionsRouteAnswerRenderer = (
  question: any,
  answers: any,
  index: number,
  isOwnResponse: unknown,
) => React.ReactNode;

type SurveyQuestionsRouteSurveyAnswersRenderer = (responses: any[], isOwnResponse: unknown) => React.ReactNode;

export type SurveyQuestionsRouteTopStripProps = {
  topRef?: React.Ref<HTMLDivElement>;
  displayAnswerMode?: boolean;
  isDecrypting?: boolean;
  isEditing?: boolean;
  isSubmitting?: boolean;
  onDecryptEdit?: () => void;
  onExitEditing?: () => void;
  onStartFresh?: () => void;
  onToggleDisplayAnswerMode?: () => void;
  responseUrl?: string;
  userHasResponse?: boolean;
  userResponseEncrypted?: boolean;
};

export type SurveyQuestionsRouteResponseViewProps = {
  isLoadingResponse?: boolean;
  noResponse?: boolean;
  parsedViewAddressAnswers?: any;
  questionPool?: any[];
  questionPoolReady?: unknown;
  renderQuestionAnswer?: SurveyQuestionsRouteAnswerRenderer;
  renderSurveyAnswers?: SurveyQuestionsRouteSurveyAnswersRenderer;
  responderAddress?: string;
  responseLookupWarning?: React.ReactNode;
  singleQuestionMode?: unknown;
  userAnswers?: any;
  viewAddress?: string;
};

export type SurveyQuestionsRouteAuthoringPanelProps = {
  displayState?: Partial<SurveyQuestionsAuthoringPanelDisplayState>;
  lockedQuestionsBanner?: React.ReactNode;
  onScrollToTop?: () => void;
  onShowJsonAtBottom?: () => void;
  renderedEditableQuestions?: React.ReactNode;
};

export type SurveyQuestionsRouteSubmittedResponseViewProps = {
  isOwnResponse?: unknown;
  isVisible?: boolean;
  questionPool?: any[];
  questionPoolReady?: unknown;
  renderQuestionAnswer?: SurveyQuestionsRouteAnswerRenderer;
  renderSurveyAnswers?: SurveyQuestionsRouteSurveyAnswersRenderer;
  singleQuestionMode?: unknown;
  userAnswers?: any;
};

export type SurveyQuestionsRouteSubmitFooterProps = {
  isSingleQuestionView?: boolean;
  isSubmitting?: boolean;
  onPrimarySubmitClick?: () => void;
  onRevertPendingChanges?: () => void;
  pendingEditCount?: number;
  responseUrl?: string;
  submitButtonText?: React.ReactNode;
  submissionError?: string;
};

export type SurveyQuestionsRouteJsonControlsProps = {
  bottomRef?: React.Ref<HTMLDivElement>;
  copiedQuestionsJson?: boolean;
  copiedResponseJson?: boolean;
  copiedSurveyJson?: boolean;
  hidden?: boolean;
  jsonPanelDisplayState?: Partial<SurveyQuestionsJsonPanelDisplayState>;
  onCopyQuestionsJson?: () => void;
  onCopyResponseJson?: () => void;
  onCopySurveyJson?: () => void;
  onToggleQuestionsJson?: () => void;
  onToggleResponseJson?: () => void;
  onToggleSurveyJson?: () => void;
  questionsJson?: unknown;
  renderJsonTree?: (json: unknown) => React.ReactNode;
  responseJson?: unknown;
  surveyJson?: unknown;
};

export type SurveyQuestionsRouteTagModalProps = {
  onClose?: () => void;
};

export type SurveyQuestionsRouteSurfaceProps = {
  authoringPanelProps?: SurveyQuestionsRouteAuthoringPanelProps;
  jsonControlsProps?: SurveyQuestionsRouteJsonControlsProps;
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  loadingProgressState: SurveyQuestionsFullLoadingProgressState;
  renderReadiness: Partial<SurveyQuestionsRenderReadinessDescriptor>;
  responseViewProps?: SurveyQuestionsRouteResponseViewProps;
  routeViewDisplayState?: Partial<SurveyQuestionsRouteViewDisplayState>;
  submittedResponseViewProps?: SurveyQuestionsRouteSubmittedResponseViewProps;
  submitDisplayState?: Partial<SurveyQuestionsSubmitFooterDisplayState>;
  submitFooterProps?: SurveyQuestionsRouteSubmitFooterProps;
  tagModalProps?: SurveyQuestionsRouteTagModalProps;
  topStripProps?: SurveyQuestionsRouteTopStripProps;
  viewingAnswers?: boolean;
};

export type SurveyQuestionsTopRouteSectionProps = {
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  routeViewDisplayState?: Partial<SurveyQuestionsRouteViewDisplayState>;
  submitDisplayState?: Partial<SurveyQuestionsSubmitFooterDisplayState>;
  topStripProps?: SurveyQuestionsRouteTopStripProps;
};

export type SurveyQuestionsRouteBodySectionProps = {
  authoringPanelProps?: SurveyQuestionsRouteAuthoringPanelProps;
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  responseViewProps?: SurveyQuestionsRouteResponseViewProps;
  routeViewDisplayState?: Partial<SurveyQuestionsRouteViewDisplayState>;
  submittedResponseViewProps?: SurveyQuestionsRouteSubmittedResponseViewProps;
  submitDisplayState?: Partial<SurveyQuestionsSubmitFooterDisplayState>;
  submitFooterProps?: SurveyQuestionsRouteSubmitFooterProps;
  viewingAnswers?: boolean;
};

export type SurveyQuestionsAuthoringRouteSectionProps = {
  authoringPanelProps?: SurveyQuestionsRouteAuthoringPanelProps;
  submittedResponseViewProps?: SurveyQuestionsRouteSubmittedResponseViewProps;
  submitDisplayState?: Partial<SurveyQuestionsSubmitFooterDisplayState>;
  submitFooterProps?: SurveyQuestionsRouteSubmitFooterProps;
};

export type SurveyQuestionsResponseRouteSectionProps = {
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  responseViewProps?: SurveyQuestionsRouteResponseViewProps;
  routeViewDisplayState?: Partial<SurveyQuestionsRouteViewDisplayState>;
};

export type SurveyQuestionsJsonRouteSectionProps = SurveyQuestionsRouteJsonControlsProps;

export type SurveyQuestionsTagModalSlotProps = {
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  tagModalProps?: SurveyQuestionsRouteTagModalProps;
};
