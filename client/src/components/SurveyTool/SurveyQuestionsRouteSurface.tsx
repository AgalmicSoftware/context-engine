import React from 'react';

import SurveyQuestionsJsonRouteSection from './SurveyQuestionsJsonRouteSection';
import SurveyQuestionsLoadingState from './SurveyQuestionsLoadingState';
import SurveyQuestionsRouteBodySection from './SurveyQuestionsRouteBodySection';
import SurveyQuestionsTagModalSlot from './SurveyQuestionsTagModalSlot';
import SurveyQuestionsTopRouteSection from './SurveyQuestionsTopRouteSection';
import type { SurveyQuestionsRouteSurfaceProps } from './surveyQuestionsRouteSurfaceTypes.js';

const noop = () => {};

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
    return <SurveyQuestionsLoadingState progressState={loadingProgressState} />;
  }

  return (
    <div className={layoutDisplayState.surveyPageClassName}>
      <SurveyQuestionsTopRouteSection
        layoutDisplayState={layoutDisplayState}
        routeViewDisplayState={routeViewDisplayState}
        submitDisplayState={submitDisplayState}
        topStripProps={topStripProps}
      />

      <SurveyQuestionsRouteBodySection
        authoringPanelProps={authoringPanelProps}
        layoutDisplayState={layoutDisplayState}
        responseViewProps={responseViewProps}
        routeViewDisplayState={routeViewDisplayState}
        submittedResponseViewProps={submittedResponseViewProps}
        submitDisplayState={submitDisplayState}
        submitFooterProps={submitFooterProps}
        viewingAnswers={viewingAnswers}
      />

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
      <SurveyQuestionsTagModalSlot layoutDisplayState={layoutDisplayState} tagModalProps={tagModalProps} />
    </div>
  );
};

export default SurveyQuestionsRouteSurface;
