import React from 'react';

import SurveyQuestionsJsonControls from './SurveyQuestionsJsonControls';
import type { SurveyQuestionsJsonPanelDisplayState } from './surveyQuestionsTypes.js';

const noop = () => {};

type SurveyQuestionsJsonRouteSectionProps = {
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
