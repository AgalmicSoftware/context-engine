import React from 'react';
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
  const tooltipText = toStr(content).trim();
  if (!enabled || !id || !tooltipText) return null;

  return (
    <>
      <span
        id={id}
        className={styles.tooltipTrigger}
        data-testid={testId || undefined}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
      >
        <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} />
      </span>
      <CETooltip
        placement={placement}
        trigger="hover focus click"
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
