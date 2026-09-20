import React, { useRef } from 'react';
import CETooltip from '../Shared/CETooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';

type BullhornToggleButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  active?: boolean;
};

export const buildBullhornToggleButtonClassName = ({
  active = false,
  activeClassName = '',
  baseClassName = '',
  bullhornClassName = '',
  commentClassName = '',
}: {
  active?: unknown;
  activeClassName?: unknown;
  baseClassName?: unknown;
  bullhornClassName?: unknown;
  commentClassName?: unknown;
} = {}): string =>
  [
    String(baseClassName || ''),
    String(commentClassName || ''),
    String(bullhornClassName || ''),
    active ? String(activeClassName || '') : '',
  ]
    .filter(Boolean)
    .join(' ');

export const resolveBullhornToggleIconClassName = ({
  active = false,
  iconGlowClassName = '',
}: {
  active?: unknown;
  iconGlowClassName?: unknown;
} = {}): string | undefined => (active ? String(iconGlowClassName || '') || undefined : undefined);

const BullhornToggleButton = ({
  onClick,
  disabled = false,
  title = 'Conviction / importance',
  ariaLabel = 'Conviction / importance',
  active = false,
}: BullhornToggleButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={buildBullhornToggleButtonClassName({
          active,
          activeClassName: styles.iconButtonActive,
          baseClassName: styles.iconButton,
          bullhornClassName: styles.bullhornButton,
          commentClassName: styles.commentButton,
        })}
        title={title}
        aria-label={ariaLabel}
      >
        <FontAwesomeIcon
          icon={faBullhorn}
          className={resolveBullhornToggleIconClassName({
            active,
            iconGlowClassName: styles.iconGlow,
          })}
        />
      </button>
      <CETooltip target={buttonRef} placement="top" trigger="hover focus">
        Set how strongly you hold this answer and how important it is to you.
      </CETooltip>
    </>
  );
};

export default BullhornToggleButton;
