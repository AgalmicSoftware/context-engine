import React from 'react';
import { Button } from 'reactstrap';
import styles from './Account.module.scss';

type LoginDemoSurfaceToggleControlProps = {
  demoSurfaceEnabled: boolean;
  onToggle: () => void;
};

const LoginDemoSurfaceToggleControl = ({ demoSurfaceEnabled, onToggle }: LoginDemoSurfaceToggleControlProps) => (
  <div className={styles.tooltipsToggleControl}>
    <Button
      type="button"
      onClick={onToggle}
      className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.tooltipsToggleButton} ${styles.preferenceToggleButton}`}
      aria-pressed={demoSurfaceEnabled}
      aria-label={`Demo Mode ${demoSurfaceEnabled ? 'On' : 'Off'}`}
    >
      <span className={styles.preferenceToggleLabel}>Demo Mode</span>
      <span className={styles.preferenceToggleTrack} aria-hidden="true">
        <span className={styles.preferenceToggleThumb} />
      </span>
      <span className={styles.preferenceToggleState} aria-hidden="true">
        {demoSurfaceEnabled ? 'On' : 'Off'}
      </span>
    </Button>
  </div>
);

export default LoginDemoSurfaceToggleControl;
