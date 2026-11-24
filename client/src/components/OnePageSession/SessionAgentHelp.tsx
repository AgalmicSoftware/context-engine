/** @file SessionAgentHelp.tsx: a "?" by a Session Agent choice, its words shown on hover, focus, click or tap. */
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'reactstrap';

import styles from './SessionAgentHelp.module.scss';

type Props = { id: string; label: string; text: string; className?: string };

// A screen reader hears the words as the "?"'s description. While it has focus a mouse leaving it doesn't close
// them: on phones a tap's mouseout closed them at once. They show with the app's tooltips turned off too, since
// a "?" is there only for its words.
const SessionAgentHelp = ({ id, label, text, className }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        id={id}
        className={className}
        data-ce-control-appearance="frameless"
        aria-label={label}
        aria-describedby={`${id}-text`}
        // Safari doesn't focus a button it clicks.
        onClick={(event) => event.currentTarget.focus()}
      >
        <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
      </button>
      <span id={`${id}-text`} className={styles.hidden}>
        {text}
      </span>
      <Tooltip
        target={id}
        placement="bottom"
        trigger="hover focus"
        autohide={false}
        isOpen={open}
        toggle={(event?: { type?: string }) => {
          const keep = event?.type === 'mouseout' && document.activeElement?.id === id;
          setOpen((was) => !was || keep);
        }}
      >
        {text}
      </Tooltip>
    </>
  );
};

export default SessionAgentHelp;
