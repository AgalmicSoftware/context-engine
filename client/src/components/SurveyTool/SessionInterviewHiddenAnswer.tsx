import React, { useId } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionInterviewDraftCard.module.scss';

const explanation =
  'Give your own answer first so the AI’s guess cannot influence it. The grey area conceals the guess until you answer and move on. Only your own answer is submitted.';

// This surface receives no prediction, so hiding it never relies on CSS or ARIA.
export default function SessionInterviewHiddenAnswer({ note }: { note?: string }) {
  const helpId = `ce-hidden-guess-help-${useId().replace(/:/g, '')}`;
  const descriptionId = `${helpId}-description`;
  return (
    <div className={styles.hiddenAnswer} role="group" aria-label="Hidden AI guess">
      <div className={styles.hiddenAnswerHeading}>
        <strong>AI guess hidden</strong>
        <button
          type="button"
          id={helpId}
          className={styles.hiddenAnswerHelp}
          aria-label="Why is the AI guess hidden?"
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
      <p role="status">{note}</p>
    </div>
  );
}
