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
      className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.tooltipsToggleButton}`}
      aria-pressed={demoSurfaceEnabled}
    >
      Demo Mode {demoSurfaceEnabled ? 'On' : 'Off'}
    </Button>
  </div>
);

export default LoginDemoSurfaceToggleControl;
