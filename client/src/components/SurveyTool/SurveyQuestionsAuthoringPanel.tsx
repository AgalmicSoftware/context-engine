import React from 'react';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons';

import { JsonIconButton } from '../Shared/Json/JsonControls';
import type {
  SurveyQuestionsAuthoringPanelDisplayState,
  SurveyQuestionsSubmitFooterDisplayState,
} from './surveyQuestionsTypes.js';

type SurveyQuestionsAuthoringPanelProps = {
  displayState?: Partial<SurveyQuestionsAuthoringPanelDisplayState>;
  lockedQuestionsBanner?: React.ReactNode;
  onScrollToTop: () => void;
  onShowJsonAtBottom: () => void;
  renderedEditableQuestions?: React.ReactNode;
  submitDisplayState?: Partial<
    Pick<SurveyQuestionsSubmitFooterDisplayState, 'showInlineSubmit' | 'showTopInlineSubmit'>
  >;
  submittedResponseView?: React.ReactNode;
  submitResponseButton?: React.ReactNode;
};

const SurveyQuestionsAuthoringPanel = ({
  displayState = {},
  lockedQuestionsBanner = null,
  onScrollToTop,
  onShowJsonAtBottom,
  renderedEditableQuestions = null,
  submitDisplayState = {},
  submittedResponseView = null,
  submitResponseButton = null,
}: SurveyQuestionsAuthoringPanelProps): React.ReactElement => {
  const { showBackToTopControl = false, showJsonControl = false, showLockedQuestionsBanner = false } = displayState;
  const { showInlineSubmit = false, showTopInlineSubmit = false } = submitDisplayState;

  return (
    <>
      {showTopInlineSubmit && submitResponseButton}
      {showJsonControl && <JsonIconButton label=".json" onClick={onShowJsonAtBottom} title="View JSON" />}
      {showLockedQuestionsBanner && lockedQuestionsBanner}
      {renderedEditableQuestions}
      {showInlineSubmit && submitResponseButton}
      {showBackToTopControl && (
        <JsonIconButton label="Back to top" icon={faCaretUp} onClick={onScrollToTop} title="Back to top" />
      )}
      {submittedResponseView}
    </>
  );
};

export default SurveyQuestionsAuthoringPanel;
