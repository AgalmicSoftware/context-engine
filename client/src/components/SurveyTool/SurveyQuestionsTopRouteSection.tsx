import React from 'react';

import SurveyQuestionsTopStrip from './SurveyQuestionsTopStrip';
import type { SurveyQuestionsTopRouteSectionProps } from './surveyQuestionsRouteSurfaceTypes.js';

const noop = () => {};

const SurveyQuestionsTopRouteSection = ({
  layoutDisplayState = {},
  routeViewDisplayState = {},
  submitDisplayState = {},
  topStripProps = {},
}: SurveyQuestionsTopRouteSectionProps): React.ReactElement => {
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

  return (
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
  );
};

export default SurveyQuestionsTopRouteSection;
