import React from 'react';

import SurveyQuestionsAuthoringRouteSection from './SurveyQuestionsAuthoringRouteSection';
import SurveyQuestionsResponseRouteSection from './SurveyQuestionsResponseRouteSection';
import type { SurveyQuestionsRouteBodySectionProps } from './surveyQuestionsRouteSurfaceTypes.js';

const SurveyQuestionsRouteBodySection = ({
  authoringPanelProps,
  layoutDisplayState,
  responseViewProps,
  routeViewDisplayState,
  submittedResponseViewProps,
  submitDisplayState,
  submitFooterProps,
  viewingAnswers = false,
}: SurveyQuestionsRouteBodySectionProps): React.ReactElement =>
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
  );

export default SurveyQuestionsRouteBodySection;
