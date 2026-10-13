import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import { toStr } from '../../utilities/shared/primitives.js';
import styles from './SessionWizard.module.scss';

export type SessionWizardTooltipRenderOptions = {
  id?: string;
  content?: React.ReactNode;
  placement?: React.ComponentProps<typeof CETooltip>['placement'];
  testId?: string;
  ariaLabel?: string;
};

type SessionWizardInfoTooltipProps = SessionWizardTooltipRenderOptions & {
  enabled: boolean;
};

const SessionWizardInfoTooltip = ({
  enabled,
  id,
  content,
  placement = 'right',
  testId = '',
  ariaLabel = 'Show more info',
}: SessionWizardInfoTooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!enabled) setIsOpen(false);
  }, [enabled]);
  const tooltipText = toStr(content).trim();
  if (!enabled || !id || !tooltipText) return null;

  return (
    <>
      <span
        id={id}
        className={styles.tooltipTrigger}
        data-testid={testId || undefined}
        data-ce-control-appearance="frameless"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-describedby={isOpen ? `${id}-content` : undefined}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} />
      </span>
      {/* A tap can produce hover, focus, and click; each should open help rather than toggle it. */}
      <CETooltip
        id={`${id}-content`}
        isOpen={isOpen}
        placement={placement}
        trigger="manual"
        target={id}
        className={styles.tooltipBubble}
        delay={0}
        container="body"
      >
        {content}
      </CETooltip>
    </>
  );
};

export default SessionWizardInfoTooltip;
