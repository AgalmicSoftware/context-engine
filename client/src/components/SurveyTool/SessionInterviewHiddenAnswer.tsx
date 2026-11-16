import { useId } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionInterviewDraftCard.module.scss';
import { HIDDEN_DRAFT_NOTE } from './sessionInterviewHiddenDrafts';

const explanation =
  'Give your own answer first so the AI’s prediction cannot influence it. The grey area conceals it until you answer and move on. Only your own answer is submitted.';

// This surface receives no prediction, so hiding it never relies on CSS or ARIA.
export default function SessionInterviewHiddenAnswer() {
  const helpId = `ce-hidden-guess-help-${useId().replace(/:/g, '')}`;
  const descriptionId = `${helpId}-description`;
  return (
    <div className={styles.hiddenAnswer} role="group" aria-label="Hidden AI prediction">
      {/* One line says it is hidden; the grey area below stands in for the guess. */}
      <div className={styles.hiddenAnswerHeading}>
        <p role="status">{HIDDEN_DRAFT_NOTE}</p>
        <button
          type="button"
          id={helpId}
          className={styles.hiddenAnswerHelp}
          aria-label="Why is the prediction hidden?"
          aria-describedby={descriptionId}
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
        <span id={descriptionId} className={styles.srOnly}>
          {explanation}
        </span>
        <UncontrolledTooltip target={helpId} placement="top" trigger="hover focus" autohide={false}>
          {explanation}
        </UncontrolledTooltip>
      </div>
      <div className={styles.hiddenAnswerMask} aria-hidden="true">
        <span />
        <span />
      </div>
    </div>
  );
}
