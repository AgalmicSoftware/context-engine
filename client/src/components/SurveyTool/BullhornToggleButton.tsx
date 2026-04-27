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
    className={`${styles.iconButton} ${styles.commentButton} ${styles.bullhornButton} ${active ? styles.iconButtonActive : ''}`}
    title={title}
    aria-label={ariaLabel}
  >
    <FontAwesomeIcon icon={faBullhorn} className={active ? styles.iconGlow : undefined} />
  </button>
);

export default BullhornToggleButton;
