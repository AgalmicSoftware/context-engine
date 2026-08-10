import React from 'react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { CE_THEME_IDS, getThemeMetadata } from '../../utilities/ui/themeRegistry';
import {
  clearStoredThemePreference,
  readStoredThemePreference,
  setStoredThemePreference,
  subscribeThemeChanges,
} from '../../utilities/ui/themeRuntime';
import styles from './AppThemeSelector.module.scss';

const AppThemeSelector = (): React.ReactElement => {
  const [preference, setPreference] = React.useState(() => readStoredThemePreference() || '');

  React.useEffect(() => subscribeThemeChanges(() => setPreference(readStoredThemePreference() || '')), []);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="ce-settings-theme-select">
        App theme
      </label>
      <select
        id="ce-settings-theme-select"
        className={styles.select}
        value={preference}
        data-testid={E2E_TESTIDS.SETTINGS_THEME}
        onChange={(event) => {
          const next = event.target.value;
          if (next) setStoredThemePreference(next);
          else clearStoredThemePreference();
          setPreference(readStoredThemePreference() || '');
        }}
      >
        <option value="">Use deployment default</option>
        {CE_THEME_IDS.map((id) => (
          <option key={id} value={id}>
            {getThemeMetadata(id).label}
          </option>
        ))}
      </select>
      <div className={styles.hint}>
        Changes the complete app appearance in this browser. An explicit choice takes precedence over session colors.
      </div>
    </div>
  );
};

export default AppThemeSelector;
