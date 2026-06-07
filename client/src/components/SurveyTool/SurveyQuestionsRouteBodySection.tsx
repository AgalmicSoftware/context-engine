import React from 'react';

import SurveyQuestionsAuthoringRouteSection from './SurveyQuestionsAuthoringRouteSection';
import SurveyQuestionsResponseRouteSection from './SurveyQuestionsResponseRouteSection';
import type {
  SurveyQuestionsAuthoringPanelDisplayState,
  SurveyQuestionsLayoutDisplayState,
  SurveyQuestionsRouteViewDisplayState,
  SurveyQuestionsSubmitFooterDisplayState,
} from './surveyQuestionsTypes.js';

type SurveyQuestionsRouteResponseViewProps = {
  isLoadingResponse?: boolean;
  noResponse?: boolean;
  parsedViewAddressAnswers?: any;
  questionPool?: any[];
  questionPoolReady?: unknown;
  renderQuestionAnswer?: (
    question: any,
    answers: any,
    index: number,
    isOwnResponse: unknown
  ) => React.ReactNode;
  renderSurveyAnswers?: (
    responses: any[],
    isOwnResponse: unknown
  ) => React.ReactNode;
  responderAddress?: string;
  responseLookupWarning?: React.ReactNode;
  singleQuestionMode?: unknown;
  userAnswers?: any;
  viewAddress?: string;
};

type SurveyQuestionsRouteAuthoringPanelProps = {
  displayState?: Partial<SurveyQuestionsAuthoringPanelDisplayState>;
  lockedQuestionsBanner?: React.ReactNode;
  onScrollToTop?: () => void;
  onShowJsonAtBottom?: () => void;
  renderedEditableQuestions?: React.ReactNode;
};

type SurveyQuestionsRouteSubmittedResponseViewProps = {
  isOwnResponse?: unknown;
  isVisible?: boolean;
  questionPool?: any[];
  questionPoolReady?: unknown;
  renderQuestionAnswer?: (
    question: any,
    answers: any,
    index: number,
    isOwnResponse: unknown
  ) => React.ReactNode;
  renderSurveyAnswers?: (
    responses: any[],
    isOwnResponse: unknown
  ) => React.ReactNode;
  singleQuestionMode?: unknown;
  userAnswers?: any;
};

type SurveyQuestionsRouteSubmitFooterProps = {
  isSingleQuestionView?: boolean;
  isSubmitting?: boolean;
  onPrimarySubmitClick?: () => void;
  onRevertPendingChanges?: () => void;
  pendingEditCount?: number;
  responseUrl?: string;
  submitButtonText?: string;
  submissionError?: string;
};

type SurveyQuestionsRouteBodySectionProps = {
  authoringPanelProps?: SurveyQuestionsRouteAuthoringPanelProps;
  layoutDisplayState?: Partial<SurveyQuestionsLayoutDisplayState>;
  responseViewProps?: SurveyQuestionsRouteResponseViewProps;
  routeViewDisplayState?: Partial<SurveyQuestionsRouteViewDisplayState>;
  submittedResponseViewProps?: SurveyQuestionsRouteSubmittedResponseViewProps;
  submitDisplayState?: Partial<SurveyQuestionsSubmitFooterDisplayState>;
  submitFooterProps?: SurveyQuestionsRouteSubmitFooterProps;
  viewingAnswers?: boolean;
};

const SurveyQuestionsRouteBodySection = ({
  authoringPanelProps,
  layoutDisplayState,
  responseViewProps,
  routeViewDisplayState,
  submittedResponseViewProps,
  submitDisplayState,
  submitFooterProps,
  viewingAnswers = false,
}: SurveyQuestionsRouteBodySectionProps): React.ReactElement => (
  viewingAnswers ? (
    <SurveyQuestionsResponseRouteSection
      layoutDisplayState={layoutDisplayState}
      responseViewProps={responseViewProps}
      routeViewDisplayState={routeViewDisplayState}
    />
  ) : (
    <SurveyQuestionsAuthoringRouteSection
      authoringPanelProps={authoringPanelProps}
      submittedResponseViewProps={submittedResponseViewProps}
      submitDisplayState={submitDisplayState}
      submitFooterProps={submitFooterProps}
    />
  )
);

export default SurveyQuestionsRouteBodySection;
