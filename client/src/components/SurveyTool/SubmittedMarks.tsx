import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

// As on the phone card: after a submit, Submit turns into a green "Submitted" for ten seconds, then goes.
export const SUBMITTED_SHOWN_MS = 10_000;

/** The all-questions header's Submit, once a submit has stored every answer. */
export const HeaderSubmittedCheck = (): React.ReactElement | null => {
  const [gone, setGone] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setGone(true), SUBMITTED_SHOWN_MS);
    return () => clearTimeout(timer);
  }, []);
  if (gone) return null;
  return (
    <div className={styles.headerSubmitActions}>
      <div
        className={`${styles.headerSubmitButton} ${styles.headerSubmitDone}`}
        data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}
        role="status"
      >
        Submitted
      </div>
    </div>
  );
};

/** On an all-questions card whose answer is stored and unchanged. */
export const AnswerSavedMark = (): React.ReactElement => (
  <span className={styles.answerSavedMark} title="Your answer to this question is saved.">
    <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
    Saved
  </span>
);
