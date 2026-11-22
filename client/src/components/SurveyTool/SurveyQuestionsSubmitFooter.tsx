import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faExternalLinkAlt, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import { SubmitCountLabel } from './SubmitCountLabel';
import styles from './SurveyTool.module.scss';
import {
  buildSurveyQuestionsSubmitAuxIconClassName,
  SURVEY_QUESTIONS_SUBMISSION_ERROR_STYLE,
  SURVEY_QUESTIONS_SUBMIT_ICON_STYLE,
  type SurveyQuestionsSubmitFooterDisplayState,
} from './surveyQuestionsTypes.js';

type SurveyQuestionsSubmitFooterProps = {
  displayState?: Partial<SurveyQuestionsSubmitFooterDisplayState>;
  isSingleQuestionView?: boolean;
  isSubmitting?: boolean;
  onPrimarySubmitClick: () => void;
  onRevertPendingChanges: () => void;
  pendingEditCount?: number;
  responseUrl?: string;
  // "Submit (2)": the count shows in the button's corner, and the button takes its name from the full text.
  submitButtonText?: string;
  submissionError?: string;
};

// The Submit button holds a short message whole; a longer one shows its start, then an ellipsis.
export const SUBMIT_BUTTON_MESSAGE_MAX_CHARS = 50;
const ELLIPSIS = '...';

const renderSubmissionErrorText = (submissionError: string): string =>
  submissionError.length > SUBMIT_BUTTON_MESSAGE_MAX_CHARS
    ? `${submissionError.substring(0, SUBMIT_BUTTON_MESSAGE_MAX_CHARS - ELLIPSIS.length)}${ELLIPSIS}`
    : submissionError;

const SurveyQuestionsSubmitFooter = ({
  displayState = {},
  isSingleQuestionView = false,
  isSubmitting = false,
  onPrimarySubmitClick,
  onRevertPendingChanges,
  pendingEditCount = 0,
  responseUrl = '',
  submitButtonText = '',
  submissionError = '',
}: SurveyQuestionsSubmitFooterProps): React.ReactElement => {
  const {
    showSubmitAux = false,
    submitDisabled = false,
    submittedIndicatorActive = false,
    uploadStatusText = 'Saving',
  } = displayState;
  const submitFooterClassName = (isSingleQuestionView ? styles.singleQuestionSubmitFooter : '') || undefined;
  const singleQuestionSubmittedIndicatorActive = !isSingleQuestionView && submittedIndicatorActive;
  const submitButtonClassName =
    [
      isSingleQuestionView ? styles.singleQuestionSubmitButton : '',
      pendingEditCount > 0 ? styles.submitGlow : '',
      singleQuestionSubmittedIndicatorActive ? styles.submittedButtonNoIcon : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const submitAuxClassName =
    [styles.submitAux, isSingleQuestionView ? styles.singleQuestionSubmitAux : ''].filter(Boolean).join(' ') ||
    undefined;
  const submitLinkClassName = isSingleQuestionView ? styles.singleQuestionSubmitLink : undefined;
  const showClearChanges = pendingEditCount > 0 && !isSubmitting && !singleQuestionSubmittedIndicatorActive;
  const showSubmittedResponseLink = singleQuestionSubmittedIndicatorActive && !!responseUrl;
  const showsSubmitLabel = !isSubmitting && !singleQuestionSubmittedIndicatorActive && !submissionError;

  return (
    <div className={submitFooterClassName} id={styles.surveyFooter}>
      <Button
        id={styles.submitSurveyButton}
        data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
        onClick={onPrimarySubmitClick}
        className={submitButtonClassName}
        disabled={submitDisabled}
        aria-label={showsSubmitLabel && submitButtonText ? submitButtonText : undefined}
      >
        {isSubmitting ? (
          <div id={styles.uploadingEncryptingText}>
            <FontAwesomeIcon icon={faSpinner} spin style={SURVEY_QUESTIONS_SUBMIT_ICON_STYLE} />
            {/* Counts seconds from the Submit's start, as every Submit's running label does. */}
            <ElapsedLoadingLabel label={uploadStatusText} />
          </div>
        ) : singleQuestionSubmittedIndicatorActive ? (
          <div className={styles.submittedIndicatorText} data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}>
            Submitted
          </div>
        ) : submissionError ? (
          <div style={SURVEY_QUESTIONS_SUBMISSION_ERROR_STYLE}>
            <FontAwesomeIcon icon={faExclamationCircle} style={SURVEY_QUESTIONS_SUBMIT_ICON_STYLE} />
            {renderSubmissionErrorText(submissionError)}
          </div>
        ) : isSingleQuestionView ? (
          <div className={styles.singleQuestionSubmitButtonContent}>
            <span className={styles.singleQuestionSubmitButtonLabel}>
              <SubmitCountLabel text={submitButtonText} />
            </span>
          </div>
        ) : (
          <SubmitCountLabel text={submitButtonText} />
        )}
      </Button>

      {showSubmitAux && (
        <div className={submitAuxClassName}>
          {showClearChanges && (
            <button
              type="button"
              className={buildSurveyQuestionsSubmitAuxIconClassName(styles, isSingleQuestionView)}
              onClick={onRevertPendingChanges}
              title="Clear changes"
              aria-label="Clear pending changes"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}

          {showSubmittedResponseLink && (
            <a
              href={responseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={submitLinkClassName}
              title="View submitted response"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default SurveyQuestionsSubmitFooter;
