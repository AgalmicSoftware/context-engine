import React from 'react';
import { CE_THEME_SELECTOR_ENABLED } from '../../variables/appConfig.js';
import AppThemeSelector from './AppThemeSelector';
import styles from './Account.module.scss';

const LoginThemeQuickControl = (): React.ReactElement | null =>
  CE_THEME_SELECTOR_ENABLED ? (
    <div className={styles.settingsThemeQuickControl}>
      <label className={styles.settingsThemeQuickLabel} htmlFor="ce-settings-theme-select">
        Theme
      </label>
      <div className={styles.settingsThemeQuickSelect}>
        <AppThemeSelector />
      </div>
    </div>
  ) : null;

export default LoginThemeQuickControl;
