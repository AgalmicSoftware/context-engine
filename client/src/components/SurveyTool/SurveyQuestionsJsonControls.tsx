import React from 'react';

import { JsonButtonRow, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import type { SurveyQuestionsJsonPanelDisplayState } from './surveyQuestionsTypes.js';

type SurveyQuestionsJsonControlsProps = {
  copiedQuestionsJson?: boolean;
  copiedResponseJson?: boolean;
  copiedSurveyJson?: boolean;
  hidden?: boolean;
  jsonPanelDisplayState?: Partial<SurveyQuestionsJsonPanelDisplayState>;
  onCopyQuestionsJson: () => void;
  onCopyResponseJson: () => void;
  onCopySurveyJson: () => void;
  onToggleQuestionsJson: () => void;
  onToggleResponseJson: () => void;
  onToggleSurveyJson: () => void;
  questionsJson?: unknown;
  renderJsonTree: (json: unknown) => React.ReactNode;
  responseJson?: unknown;
  surveyJson?: unknown;
};

const SurveyQuestionsJsonControls = React.forwardRef<HTMLDivElement, SurveyQuestionsJsonControlsProps>(
  (
    {
      copiedQuestionsJson = false,
      copiedResponseJson = false,
      copiedSurveyJson = false,
      hidden = false,
      jsonPanelDisplayState = {},
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
    },
    ref,
  ): React.ReactElement | null => {
    if (hidden) {
      return null;
    }

    const {
      showFullSurveyJsonControls = false,
      questionJsonToggleClassName,
      responseJsonToggleClassName,
      showQuestionJsonControls = false,
      showQuestionsJson = false,
      showResponseJson = false,
      showQuestionsJsonPanel = false,
      showResponseJsonPanel = false,
      showSurveyJson = false,
      showSurveyJsonPanel = false,
      surveyJsonPanelClassName,
      surveyJsonRowClassName,
      surveyJsonToggleClassName,
    } = jsonPanelDisplayState;
    const showFullSurveyControls =
      'showFullSurveyJsonControls' in jsonPanelDisplayState ? !!showFullSurveyJsonControls : !showQuestionJsonControls;

    return (
      <div ref={ref}>
        <JsonButtonRow className={surveyJsonRowClassName}>
          {showQuestionJsonControls && (
            <>
              <JsonToggleButton
                label="question .json"
                active={showQuestionsJson}
                onClick={onToggleQuestionsJson}
                className={questionJsonToggleClassName}
              />
              <JsonToggleButton
                label="response .json"
                active={showResponseJson}
                onClick={onToggleResponseJson}
                className={responseJsonToggleClassName}
              />
            </>
          )}
          {showFullSurveyControls && (
            <>
              <JsonToggleButton
                label={showSurveyJson ? 'Hide Survey .json' : 'View Survey .json'}
                active={showSurveyJson}
                onClick={onToggleSurveyJson}
                className={surveyJsonToggleClassName}
              />
              <JsonToggleButton
                label={showResponseJson ? 'Hide Response .json' : 'View Response .json'}
                active={showResponseJson}
                onClick={onToggleResponseJson}
                className={surveyJsonToggleClassName}
              />
            </>
          )}
        </JsonButtonRow>

        {showSurveyJsonPanel && (
          <JsonPanel
            onCopy={onCopySurveyJson}
            copied={copiedSurveyJson}
            copyTitle="Copy Survey Definition JSON"
            className={surveyJsonPanelClassName}
          >
            {renderJsonTree(surveyJson)}
          </JsonPanel>
        )}
        {showQuestionsJsonPanel && (
          <JsonPanel
            onCopy={onCopyQuestionsJson}
            copied={copiedQuestionsJson}
            copyTitle="Copy Question Definition JSON"
            className={surveyJsonPanelClassName}
          >
            {renderJsonTree(questionsJson)}
          </JsonPanel>
        )}
        {showResponseJsonPanel && (
          <JsonPanel
            onCopy={onCopyResponseJson}
            copied={copiedResponseJson}
            copyTitle="Copy Response JSON"
            className={surveyJsonPanelClassName}
          >
            {renderJsonTree(responseJson)}
          </JsonPanel>
        )}
      </div>
    );
  },
);

SurveyQuestionsJsonControls.displayName = 'SurveyQuestionsJsonControls';

export default SurveyQuestionsJsonControls;
