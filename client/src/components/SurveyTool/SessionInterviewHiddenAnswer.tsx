import { useId } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionInterviewDraftCard.module.scss';
import { HIDDEN_DRAFT_NOTE } from './sessionInterviewHiddenDrafts';

// Drafts are hidden only while Share for research is on, which keeps the prediction with the answer. Who can
// read answers is said once, in the session's consent text.
const explanation =
  'Answer first, so the AI’s prediction can’t sway you; the grey area hides it until you do. While Share for research is on, the prediction, its confidence and what you changed are saved with your answer.';

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
