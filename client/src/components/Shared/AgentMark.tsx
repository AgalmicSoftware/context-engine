import React, { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';

import CETooltip from './CETooltip';
import styles from './AgentMark.module.scss';

/** What a list knows of an item an agent added: only that the agent said so. Results say the same. */
export const AGENT_MARK_LABEL = 'AI agent · self-reported';

/**
 * A robot beside the name an agent goes by, apart from the name, which the agent chooses. A button, so a tap
 * focuses it and shows the label; Escape hides it.
 */
const AgentMark = ({ label = AGENT_MARK_LABEL }: { label?: string }) => {
  const id = `ce-agent-mark-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <>
      <button
        type="button"
        id={id}
        className={styles.mark}
        data-ce-control-appearance="frameless"
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur();
        }}
      >
        <FontAwesomeIcon icon={faRobot} aria-hidden="true" />
      </button>
      <CETooltip target={id} placement="top" trigger="hover focus">
        {label}
      </CETooltip>
    </>
  );
};

export default AgentMark;
