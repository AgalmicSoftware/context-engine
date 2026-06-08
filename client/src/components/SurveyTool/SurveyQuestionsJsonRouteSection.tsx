import React from 'react';

import SurveyQuestionsJsonControls from './SurveyQuestionsJsonControls';
import type { SurveyQuestionsJsonRouteSectionProps } from './surveyQuestionsRouteSurfaceTypes.js';

const noop = () => {};

const SurveyQuestionsJsonRouteSection = ({
  bottomRef,
  copiedQuestionsJson,
  copiedResponseJson,
  copiedSurveyJson,
  hidden,
  jsonPanelDisplayState,
  onCopyQuestionsJson,
  onCopyResponseJson,
  onCopySurveyJson,
  onToggleQuestionsJson,
  onToggleResponseJson,
  onToggleSurveyJson,
  questionsJson,
  renderJsonTree,
  responseJson,
  surveyJson,
}: SurveyQuestionsJsonRouteSectionProps): React.ReactElement | null => (
  <SurveyQuestionsJsonControls
    ref={bottomRef}
    copiedQuestionsJson={copiedQuestionsJson}
    copiedResponseJson={copiedResponseJson}
    copiedSurveyJson={copiedSurveyJson}
    hidden={hidden}
    jsonPanelDisplayState={jsonPanelDisplayState}
    onCopyQuestionsJson={onCopyQuestionsJson || noop}
    onCopyResponseJson={onCopyResponseJson || noop}
    onCopySurveyJson={onCopySurveyJson || noop}
    onToggleQuestionsJson={onToggleQuestionsJson || noop}
    onToggleResponseJson={onToggleResponseJson || noop}
    onToggleSurveyJson={onToggleSurveyJson || noop}
    questionsJson={questionsJson}
    renderJsonTree={renderJsonTree || (() => null)}
    responseJson={responseJson}
    surveyJson={surveyJson}
  />
);

export default SurveyQuestionsJsonRouteSection;
