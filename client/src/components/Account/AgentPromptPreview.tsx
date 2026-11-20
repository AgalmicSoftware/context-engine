import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import styles from './Account.module.scss';

// A private catalog ticket is masked on screen, as the agent key is; the copied prompt keeps it.
export const maskPromptTicket = (prompt: string): string => prompt.replace(/([?&]ticket=)[^&\s"]+/g, '$1••••••••');

// The caret half of the agent box's split "Copy prompt" button: it opens the whole prompt below, to read.
export const PromptCaret = ({
  textId,
  testId,
  expanded,
  onToggle,
}: {
  textId: string;
  testId: string;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className={`${styles.agentHandoffPrimary} ${styles.agentHandoffCaret}`}
    aria-label="Read the whole prompt"
    aria-expanded={expanded}
    aria-controls={textId}
    onClick={onToggle}
    data-testid={testId}
  >
    <FontAwesomeIcon icon={expanded ? faCaretUp : faCaretDown} />
  </button>
);

// The whole prompt, to read, once the caret opens it. It stays in the page while closed, hidden, so the caret
// has something to control and a refused copy can open and select it. Copying is the Copy prompt button's.
const AgentPromptPreview = ({
  prompt,
  textId,
  testId,
  expanded,
}: {
  prompt: string;
  textId: string;
  testId: string;
  expanded: boolean;
}) => (
  <code id={textId} className={styles.agentHandoffCommand} hidden={!expanded} data-testid={testId}>
    {prompt}
  </code>
);

export default AgentPromptPreview;
