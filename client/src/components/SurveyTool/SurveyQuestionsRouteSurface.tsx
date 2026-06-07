import React from 'react';

import TagModal from '../TagPage/TagModal';
import SurveyQuestionsAuthoringRouteSection from './SurveyQuestionsAuthoringRouteSection';
import SurveyQuestionsJsonRouteSection from './SurveyQuestionsJsonRouteSection';
import SurveyQuestionsLoadingState from './SurveyQuestionsLoadingState';
import SurveyQuestionsResponseRouteSection from './SurveyQuestionsResponseRouteSection';
import SurveyQuestionsTopStrip from './SurveyQuestionsTopStrip';
import type {
  SurveyQuestionsAuthoringPanelDisplayState,
  SurveyQuestionsFullLoadingProgressState,
  SurveyQuestionsJsonPanelDisplayState,
  SurveyQuestionsLayoutDisplayState,
  SurveyQuestionsRenderReadinessDescriptor,
  SurveyQuestionsRouteViewDisplayState,
  SurveyQuestionsSubmitFooterDisplayState,
} from './surveyQuestionsTypes.js';

const noop = () => {};

type SurveyQuestionsRouteTopStripProps = {
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

type SurveyQuestionsRouteJsonControlsProps = {
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

type SurveyQuestionsRouteTagModalProps = {
  onClose?: () => void;
};

type SurveyQuestionsRouteSurfaceProps = {
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

const SurveyQuestionsRouteSurface = ({
  authoringPanelProps = {},
  jsonControlsProps = {},
  layoutDisplayState = {},
  loadingProgressState,
  renderReadiness,
  responseViewProps = {},
  routeViewDisplayState = {},
  submittedResponseViewProps = {},
  submitDisplayState = {},
  submitFooterProps = {},
  tagModalProps = {},
  topStripProps = {},
  viewingAnswers = false,
}: SurveyQuestionsRouteSurfaceProps): React.ReactElement => {
  if (renderReadiness.shouldShowLoadingState) {
    return (
      <SurveyQuestionsLoadingState progressState={loadingProgressState} />
    );
  }

  const topStripLayoutDisplayState = {
    topSectionClassName: layoutDisplayState.topSectionClassName,
  };
  const topStripRouteViewDisplayState = {
    isOwnResponse: routeViewDisplayState.isOwnResponse,
    isSingleQuestionView: routeViewDisplayState.isSingleQuestionView,
    showViewAnswersButton: routeViewDisplayState.showViewAnswersButton,
    viewAnswersButtonText: routeViewDisplayState.viewAnswersButtonText || '',
  };
  const topStripSubmitDisplayState = {
    submittedStateActive: !!submitDisplayState.submittedStateActive,
  };

  const activeTagModalTag = layoutDisplayState.activeTagModalTag || null;

  return (
    <div className={layoutDisplayState.surveyPageClassName}>
      <SurveyQuestionsTopStrip
        ref={topStripProps.topRef}
        displayAnswerMode={topStripProps.displayAnswerMode}
        isDecrypting={topStripProps.isDecrypting}
        isEditing={topStripProps.isEditing}
        isSubmitting={topStripProps.isSubmitting}
        layoutDisplayState={topStripLayoutDisplayState}
        onDecryptEdit={topStripProps.onDecryptEdit || noop}
        onExitEditing={topStripProps.onExitEditing || noop}
        onStartFresh={topStripProps.onStartFresh || noop}
        onToggleDisplayAnswerMode={topStripProps.onToggleDisplayAnswerMode || noop}
        responseUrl={topStripProps.responseUrl}
        routeViewDisplayState={topStripRouteViewDisplayState}
        submitDisplayState={topStripSubmitDisplayState}
        userHasResponse={topStripProps.userHasResponse}
        userResponseEncrypted={topStripProps.userResponseEncrypted}
      />

      {viewingAnswers ? (
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
      )}

      <SurveyQuestionsJsonRouteSection
        bottomRef={jsonControlsProps.bottomRef}
        copiedQuestionsJson={jsonControlsProps.copiedQuestionsJson}
        copiedResponseJson={jsonControlsProps.copiedResponseJson}
        copiedSurveyJson={jsonControlsProps.copiedSurveyJson}
        hidden={jsonControlsProps.hidden}
        jsonPanelDisplayState={jsonControlsProps.jsonPanelDisplayState}
        onCopyQuestionsJson={jsonControlsProps.onCopyQuestionsJson || noop}
        onCopyResponseJson={jsonControlsProps.onCopyResponseJson || noop}
        onCopySurveyJson={jsonControlsProps.onCopySurveyJson || noop}
        onToggleQuestionsJson={jsonControlsProps.onToggleQuestionsJson || noop}
        onToggleResponseJson={jsonControlsProps.onToggleResponseJson || noop}
        onToggleSurveyJson={jsonControlsProps.onToggleSurveyJson || noop}
        questionsJson={jsonControlsProps.questionsJson}
        renderJsonTree={jsonControlsProps.renderJsonTree || (() => null)}
        responseJson={jsonControlsProps.responseJson}
        surveyJson={jsonControlsProps.surveyJson}
      />
      {layoutDisplayState.useTagModal && (
        <TagModal
          isOpen={!!activeTagModalTag}
          toggle={tagModalProps.onClose || noop}
          activeTag={activeTagModalTag}
        />
      )}
    </div>
  );
};

export default SurveyQuestionsRouteSurface;
