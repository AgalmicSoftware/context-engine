import React from 'react';

import SurveyQuestionsAuthoringPanel from './SurveyQuestionsAuthoringPanel';
import SurveyQuestionsSubmittedResponseView from './SurveyQuestionsSubmittedResponseView';
import SurveyQuestionsSubmitFooter from './SurveyQuestionsSubmitFooter';
import type { SurveyQuestionsAuthoringRouteSectionProps } from './surveyQuestionsRouteSurfaceTypes.js';

const noop = () => {};

const SurveyQuestionsAuthoringRouteSection = ({
  authoringPanelProps = {},
  submittedResponseViewProps = {},
  submitDisplayState = {},
  submitFooterProps = {},
}: SurveyQuestionsAuthoringRouteSectionProps): React.ReactElement => {
  const submitResponseButton = (
    <SurveyQuestionsSubmitFooter
      displayState={submitDisplayState}
      isSingleQuestionView={submitFooterProps.isSingleQuestionView}
      isSubmitting={submitFooterProps.isSubmitting}
      onPrimarySubmitClick={submitFooterProps.onPrimarySubmitClick || noop}
      onRevertPendingChanges={submitFooterProps.onRevertPendingChanges || noop}
      pendingEditCount={submitFooterProps.pendingEditCount}
      responseUrl={submitFooterProps.responseUrl}
      submitButtonText={submitFooterProps.submitButtonText}
      submissionError={submitFooterProps.submissionError}
    />
  );

  const submittedResponseView = (
    <SurveyQuestionsSubmittedResponseView
      isOwnResponse={submittedResponseViewProps.isOwnResponse}
      isVisible={submittedResponseViewProps.isVisible}
      questionPool={submittedResponseViewProps.questionPool}
      questionPoolReady={submittedResponseViewProps.questionPoolReady}
      renderQuestionAnswer={submittedResponseViewProps.renderQuestionAnswer || (() => null)}
      renderSurveyAnswers={submittedResponseViewProps.renderSurveyAnswers || (() => null)}
      singleQuestionMode={submittedResponseViewProps.singleQuestionMode}
      userAnswers={submittedResponseViewProps.userAnswers}
    />
  );

  return (
    <SurveyQuestionsAuthoringPanel
      displayState={authoringPanelProps.displayState}
      lockedQuestionsBanner={authoringPanelProps.lockedQuestionsBanner}
      onScrollToTop={authoringPanelProps.onScrollToTop || noop}
      onShowJsonAtBottom={authoringPanelProps.onShowJsonAtBottom || noop}
      renderedEditableQuestions={authoringPanelProps.renderedEditableQuestions}
      submitDisplayState={submitDisplayState}
      submittedResponseView={submittedResponseView}
      submitResponseButton={submitResponseButton}
    />
  );
};

export default SurveyQuestionsAuthoringRouteSection;
