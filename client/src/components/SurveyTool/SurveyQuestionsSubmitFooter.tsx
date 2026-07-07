import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faExclamationCircle,
  faExternalLinkAlt,
  faSpinner,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';
import {
  buildSurveyQuestionsSubmitAuxIconClassName,
  SURVEY_QUESTIONS_SUBMISSION_ERROR_STYLE,
  SURVEY_QUESTIONS_SUBMIT_ICON_STYLE,
} from './surveyQuestionsTypes.js';

type SurveyQuestionsSubmitFooterProps = {
  isSingleQuestionView?: boolean;
  isSubmitting?: boolean;
  onPrimarySubmitClick: () => void;
  onRevertPendingChanges: () => void;
  pendingEditCount?: number;
  responseUrl?: string;
  showSubmitAux?: boolean;
  submitButtonText?: React.ReactNode;
  submitDisabled?: boolean;
  submittedIndicatorActive?: boolean;
  submissionError?: string;
  uploadStatusText?: React.ReactNode;
};

const renderSubmissionErrorText = (submissionError: string): string =>
  submissionError.length > 50 ? `${submissionError.substring(0, 47)}...` : submissionError;

const SurveyQuestionsSubmitFooter = ({
  isSingleQuestionView = false,
  isSubmitting = false,
  onPrimarySubmitClick,
  onRevertPendingChanges,
  pendingEditCount = 0,
  responseUrl = '',
  showSubmitAux = false,
  submitButtonText = '',
  submitDisabled = false,
  submittedIndicatorActive = false,
  submissionError = '',
  uploadStatusText = 'Uploading...',
}: SurveyQuestionsSubmitFooterProps): React.ReactElement => {
  const {
    showSubmitAux = false,
    submitDisabled = false,
    submittedIndicatorActive = false,
    uploadStatusText = 'Uploading...',
  } = displayState;
  const submitFooterClassName =
    [styles.footer, isSingleQuestionView ? styles.singleQuestionSubmitFooter : ''].filter(Boolean).join(' ') ||
    undefined;
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

  return (
    <div className={submitFooterClassName} id={styles.surveyFooter}>
      <Button
        id={styles.submitSurveyButton}
        data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
        onClick={onPrimarySubmitClick}
        className={submitButtonClassName}
        disabled={submitDisabled}
      >
        {isSubmitting ? (
          <div id={styles.uploadingEncryptingText}>
            <FontAwesomeIcon icon={faSpinner} spin style={SURVEY_QUESTIONS_SUBMIT_ICON_STYLE} />
            {uploadStatusText}
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
            <span className={styles.singleQuestionSubmitButtonLabel}>{submitButtonText}</span>
            <FontAwesomeIcon icon={faArrowRight} className={styles.singleQuestionSubmitButtonIcon} />
          </div>
        ) : (
          submitButtonText
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
