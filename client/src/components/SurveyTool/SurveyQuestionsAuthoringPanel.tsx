import React from 'react';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons';

import { JsonIconButton } from '../Shared/Json/JsonControls';

type SurveyQuestionsAuthoringPanelProps = {
  lockedQuestionsBanner?: React.ReactNode;
  onScrollToTop: () => void;
  onShowJsonAtBottom: () => void;
  renderedEditableQuestions?: React.ReactNode;
  showBackToTopControl?: boolean;
  showInlineSubmit?: boolean;
  showJsonControl?: boolean;
  showLockedQuestionsBanner?: boolean;
  showTopInlineSubmit?: boolean;
  submittedResponseView?: React.ReactNode;
  submitResponseButton?: React.ReactNode;
};

const SurveyQuestionsAuthoringPanel = ({
  lockedQuestionsBanner = null,
  onScrollToTop,
  onShowJsonAtBottom,
  renderedEditableQuestions = null,
  showBackToTopControl = false,
  showInlineSubmit = false,
  showJsonControl = false,
  showLockedQuestionsBanner = false,
  showTopInlineSubmit = false,
  submittedResponseView = null,
  submitResponseButton = null,
}: SurveyQuestionsAuthoringPanelProps): React.ReactElement => (
  <>
    {showTopInlineSubmit && submitResponseButton}
    {showJsonControl && (
      <JsonIconButton
        label=".json"
        onClick={onShowJsonAtBottom}
        title="View JSON"
      />
    )}
    {showLockedQuestionsBanner && lockedQuestionsBanner}
    {renderedEditableQuestions}
    {showInlineSubmit && submitResponseButton}
    {showBackToTopControl && (
      <JsonIconButton
        label="Back to top"
        icon={faCaretUp}
        onClick={onScrollToTop}
        title="Back to top"
      />
    )}
    {submittedResponseView}
  </>
);

export default SurveyQuestionsAuthoringPanel;
