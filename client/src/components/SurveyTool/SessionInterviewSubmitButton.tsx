import React, { type CSSProperties } from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import { SubmitCountLabel } from './SubmitCountLabel';

const RESPONSES_SUBMITTED = 'Responses submitted';
const SAVING = 'Saving';

/** The interview's Submit, which becomes View results (where offered) once the answers are in. */
export default function SessionInterviewSubmitButton({
  count,
  awaitingLogin,
  joiningGroups,
  applying,
  busy,
  submitted,
  onViewResults,
  onSubmit,
}: {
  /** The answers this Submit sends. */
  count: number;
  awaitingLogin: boolean;
  joiningGroups: boolean;
  applying: boolean;
  /** Drafting or the voice interview is running. */
  busy: boolean;
  submitted: boolean;
  /** Offered after a submit only where the session shows its results. */
  onViewResults?: () => void;
  onSubmit: () => void;
}): React.ReactElement {
  const word = awaitingLogin ? 'Submit after login' : joiningGroups ? 'Submit and join' : 'Submit';
  // "Submit (3)", as on every Submit that sends answers; the button takes its name from it.
  const text = count > 0 ? `${word} (${count})` : word;
  const viewResults = submitted && onViewResults;
  // The words fill the button, so their size follows how many letters show: the tick before "Responses submitted"
  // is about two letters wide, and the seconds while saving are counted as two digits, so the size holds still.
  const shown = viewResults
    ? 'View results'
    : submitted
      ? `  ${RESPONSES_SUBMITTED}`
      : applying
        ? `${SAVING} · 00s`
        : word;
  return (
    <Button
      color="primary"
      onClick={() => (viewResults ? onViewResults() : onSubmit())}
      disabled={applying || busy || (submitted && !viewResults) || count === 0}
      className={`${styles.sessionInterviewSubmitButton} ${styles.sessionInterviewSubmitFill}`}
      style={{ '--ce-submit-fill-letters': shown.length } as CSSProperties}
      data-testid={viewResults ? E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS : E2E_TESTIDS.SESSION_INTERVIEW_APPLY}
      aria-label={submitted || applying ? undefined : text}
    >
      <span className={styles.sessionInterviewSubmitFillText}>
        {viewResults ? (
          'View results'
        ) : submitted ? (
          <>
            <FontAwesomeIcon icon={faCheck} /> {RESPONSES_SUBMITTED}
          </>
        ) : applying ? (
          // Counts seconds from the Submit's start, as every Submit's running label does.
          <ElapsedLoadingLabel label={SAVING} />
        ) : (
          <SubmitCountLabel text={text} />
        )}
      </span>
    </Button>
  );
}
