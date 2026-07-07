import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import CETooltip from '../Shared/CETooltip';
import styles from './Account.module.scss';

type LoginTooltipsToggleControlProps = {
  infoId: string;
  onToggle: () => void;
  tooltipPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  tooltipsEnabled: boolean;
};

const LoginTooltipsToggleControl = ({
  infoId,
  onToggle,
  tooltipPlacement = 'top',
  tooltipsEnabled,
}: LoginTooltipsToggleControlProps) => (
  <div className={styles.tooltipsToggleControl}>
    <Button
      type="button"
      onClick={onToggle}
      className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.tooltipsToggleButton}`}
      aria-pressed={tooltipsEnabled}
    >
      Explainers {tooltipsEnabled ? 'On' : 'Off'}
    </Button>
    {tooltipsEnabled ? (
      <>
        <FontAwesomeIcon
          icon={faQuestionCircle}
          className={`${styles.infoIcon} ${styles.tooltipsToggleInfoIcon}`}
          id={infoId}
        />
        <CETooltip
          placement={tooltipPlacement}
          target={infoId}
          delay={0}
          trigger="hover click focus"
          autohide={false}
          className={styles.networkTooltip}
        >
          <div style={{ padding: '10px' }}>Toggle explainers throughout the app.</div>
        </CETooltip>
      </>
    ) : null}
  </div>
);

export default LoginTooltipsToggleControl;
