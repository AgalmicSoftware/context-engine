import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faRedoAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';

type SessionWizardSessionIdBadgeProps = {
  isRegenerating?: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  renderInfoTooltip: (options: {
    ariaLabel?: string;
    content?: React.ReactNode;
    id?: string;
    placement?: SessionWizardTooltipRenderOptions['placement'];
    testId?: string;
  }) => React.ReactNode;
  sessionIdDisplay?: string;
};

const formatSessionIdBadgeText = (sessionIdDisplay: string): string =>
  sessionIdDisplay.length > 14 ? `${sessionIdDisplay.slice(0, 14)}…` : sessionIdDisplay;

const SessionWizardSessionIdBadge = ({
  isRegenerating = false,
  onCopy,
  onRegenerate,
  renderInfoTooltip,
  sessionIdDisplay = '',
}: SessionWizardSessionIdBadgeProps): React.ReactElement | null => {
  if (!sessionIdDisplay) return null;

  return (
    <span className={styles.sessionIdBadge} title={sessionIdDisplay}>
      {formatSessionIdBadgeText(sessionIdDisplay)}
      <button
        type="button"
        className={styles.iconButton}
        onClick={onRegenerate}
        title="Generate a new session ID"
        aria-label="Generate a new session ID"
      >
        <FontAwesomeIcon icon={faRedoAlt} spin={isRegenerating} />
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onCopy}
        title="Copy session ID"
        aria-label="Copy session ID"
      >
        <FontAwesomeIcon icon={faCopy} />
      </button>
      {renderInfoTooltip({
        id: 'gw-session-id',
        content: 'On-chain session identifier. Use with /admin?sessionId=<uuid>&chainId=<id>.',
        placement: 'bottom',
        testId: 'ce-wizard-tooltip-gw-session-id',
        ariaLabel: 'Session ID info',
      })}
    </span>
  );
};

export { formatSessionIdBadgeText };
export default SessionWizardSessionIdBadge;
