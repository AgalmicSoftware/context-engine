import React from 'react';
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
}: BullhornToggleButtonProps) => (
  <button
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
);

export default BullhornToggleButton;
