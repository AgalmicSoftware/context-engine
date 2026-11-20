import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretRight, faCompressAlt, faExpandAlt } from '@fortawesome/free-solid-svg-icons';
import styles from './Account.module.scss';

// A private catalog ticket is masked on screen, as the agent key is; the copied prompt keeps it.
export const maskPromptTicket = (prompt: string): string => prompt.replace(/([?&]ticket=)[^&\s"]+/g, '$1••••••••');

// The arrow half of an option's split "Copy prompt" button: it shows that option's prompt below, to read.
export const PromptCaret = ({
  textId,
  testId,
  label,
  expanded,
  onToggle,
}: {
  textId: string;
  testId: string;
  /** The option's title, so each arrow has its own name. */
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className={`${styles.agentHandoffPrimary} ${styles.agentHandoffCaret}`}
    aria-label={`Show prompt: ${label}`}
    aria-expanded={expanded}
    aria-controls={textId}
    onClick={onToggle}
    data-testid={testId}
  >
    <FontAwesomeIcon icon={expanded ? faCaretDown : faCaretRight} aria-hidden="true" />
  </button>
);

// The whole prompt, to read, once the arrow shows it: a small box, which Expand makes large over the account
// panel and Minimize, Escape or moving focus out of it makes small again, so nothing it covers can be used unseen. It stays in the page while closed, hidden, so the arrow has
// something to control and a refused copy can show and select it. Copying is the Copy prompt button's.
const AgentPromptPreview = ({
  prompt,
  textId,
  testId,
  label,
  expanded,
  tools = null,
}: {
  prompt: string;
  textId: string;
  testId: string;
  label: string;
  expanded: boolean;
  /** More buttons beside Expand, such as the one that shows the key. */
  tools?: React.ReactNode;
}) => {
  const [enlarged, setEnlarged] = useState(false);
  const large = expanded && enlarged;
  const box = useRef<HTMLDivElement>(null);
  // Hidden, it is small when shown again.
  useEffect(() => {
    if (!expanded) setEnlarged(false);
  }, [expanded]);
  // Its top, where Minimize is, in view: on a phone it is taller than the screen.
  useLayoutEffect(() => {
    if (large) box.current?.scrollIntoView?.({ block: 'start' });
  }, [large]);
  useEffect(() => {
    if (!large) return undefined;
    // Captured on the document, ahead of the dialog's own Escape, which would close it.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setEnlarged(false);
    };
    document.addEventListener('keyup', onKeyUp, true);
    return () => document.removeEventListener('keyup', onKeyUp, true);
  }, [large]);
  return (
    <div
      className={
        large ? `${styles.agentHandoffPromptBox} ${styles.agentHandoffPromptLarge}` : styles.agentHandoffPromptBox
      }
      hidden={!expanded}
      ref={box}
      // Focusable, so a click in the text keeps focus inside it.
      tabIndex={-1}
      onBlur={(event) => {
        // Only for focus moving to something it covers, as by Tab: not when the window itself loses focus, as
        // when someone goes to paste the prompt elsewhere.
        const next = event.relatedTarget as Node | null;
        if (large && next && !event.currentTarget.contains(next)) setEnlarged(false);
      }}
      data-testid={`${testId}-box`}
    >
      <div className={styles.agentHandoffPromptTools}>
        {tools}
        <button
          type="button"
          className={styles.agentHandoffButton}
          aria-label={`${large ? 'Minimize' : 'Expand'} prompt: ${label}`}
          onClick={() => setEnlarged(!large)}
          data-testid={`${testId}-size`}
        >
          <FontAwesomeIcon icon={large ? faCompressAlt : faExpandAlt} aria-hidden="true" />
          {large ? 'Minimize' : 'Expand'}
        </button>
      </div>
      <code id={textId} className={styles.agentHandoffCommand} data-testid={testId}>
        {prompt}
      </code>
    </div>
  );
};

export default AgentPromptPreview;
