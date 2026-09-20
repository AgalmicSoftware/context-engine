import React from 'react';
import { CE_THEME_SELECTOR_ENABLED } from '../../variables/appConfig.js';
import AppThemeSelector from './AppThemeSelector';
import ColorBlindModeControl from './ColorBlindModeControl';
import styles from './Account.module.scss';

const LoginThemeQuickControl = (): React.ReactElement => (
  <div className={styles.settingsThemeQuickControl}>
    <label
      className={styles.settingsThemeQuickLabel}
      htmlFor={CE_THEME_SELECTOR_ENABLED ? 'ce-settings-theme-select' : undefined}
    >
      Theme
    </label>
    <div className={styles.settingsThemeQuickSelect}>
      {CE_THEME_SELECTOR_ENABLED && <AppThemeSelector />}
      <ColorBlindModeControl />
    </div>
  </div>
);

export default LoginThemeQuickControl;
