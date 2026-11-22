import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import { SubmitCountLabel } from './SubmitCountLabel';

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
  return (
    <Button
      color="primary"
      onClick={() => (viewResults ? onViewResults() : onSubmit())}
      disabled={applying || busy || (submitted && !viewResults) || count === 0}
      className={styles.sessionInterviewSubmitButton}
      data-testid={viewResults ? E2E_TESTIDS.SESSION_INTERVIEW_VIEW_RESULTS : E2E_TESTIDS.SESSION_INTERVIEW_APPLY}
      aria-label={submitted || applying ? undefined : text}
    >
      {viewResults ? (
        'View results'
      ) : submitted ? (
        <>
          <FontAwesomeIcon icon={faCheck} /> Responses submitted
        </>
      ) : applying ? (
        // Counts seconds from the Submit's start, as every Submit's running label does.
        <ElapsedLoadingLabel label="Saving" />
      ) : (
        <SubmitCountLabel text={text} />
      )}
    </Button>
  );
}
