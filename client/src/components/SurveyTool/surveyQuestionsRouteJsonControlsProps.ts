import type React from 'react';

import type { SurveyQuestionsRouteJsonControlsProps } from './surveyQuestionsRouteSurfaceTypes.js';

export type SurveyQuestionsRouteJsonCopyType = 'questions' | 'response' | 'survey';

export type BuildSurveyQuestionsRouteJsonControlsPropsArgs = {
  bottomRef?: React.Ref<HTMLDivElement>;
  copiedQuestionsJson?: boolean;
  copiedResponseJson?: boolean;
  copiedSurveyJson?: boolean;
  copyJsonToClipboard: (json: unknown, type: SurveyQuestionsRouteJsonCopyType) => void;
  hidden?: boolean;
  jsonPanelDisplayState?: SurveyQuestionsRouteJsonControlsProps['jsonPanelDisplayState'];
  onToggleQuestionsJson?: SurveyQuestionsRouteJsonControlsProps['onToggleQuestionsJson'];
  onToggleResponseJson?: SurveyQuestionsRouteJsonControlsProps['onToggleResponseJson'];
  onToggleSurveyJson?: SurveyQuestionsRouteJsonControlsProps['onToggleSurveyJson'];
  questionsJson?: unknown;
  renderJsonTree?: SurveyQuestionsRouteJsonControlsProps['renderJsonTree'];
  responseJson?: unknown;
  surveyJson?: unknown;
};

export const buildSurveyQuestionsRouteJsonControlsProps = ({
  bottomRef,
  copiedQuestionsJson,
  copiedResponseJson,
  copiedSurveyJson,
  copyJsonToClipboard,
  hidden,
  jsonPanelDisplayState,
  onToggleQuestionsJson,
  onToggleResponseJson,
  onToggleSurveyJson,
  questionsJson,
  renderJsonTree,
  responseJson,
  surveyJson,
}: BuildSurveyQuestionsRouteJsonControlsPropsArgs): SurveyQuestionsRouteJsonControlsProps => ({
  bottomRef,
  copiedQuestionsJson,
  copiedResponseJson,
  copiedSurveyJson,
  hidden,
  jsonPanelDisplayState,
  onCopyQuestionsJson: () => copyJsonToClipboard(questionsJson, 'questions'),
  onCopyResponseJson: () => copyJsonToClipboard(responseJson, 'response'),
  onCopySurveyJson: () => copyJsonToClipboard(surveyJson, 'survey'),
  onToggleQuestionsJson,
  onToggleResponseJson,
  onToggleSurveyJson,
  questionsJson,
  renderJsonTree,
  responseJson,
  surveyJson,
});
