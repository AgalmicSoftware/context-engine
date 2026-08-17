import React from 'react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { CE_THEME_IDS, getThemeMetadata, normalizeThemeId } from '../../utilities/ui/themeRegistry';
import {
  clearStoredThemePreference,
  readStoredThemePreference,
  setStoredThemePreference,
  subscribeThemeChanges,
} from '../../utilities/ui/themeRuntime';
import styles from './AppThemeSelector.module.scss';

const AppThemeSelector = (): React.ReactElement => {
  const [preference, setPreference] = React.useState(() => readStoredThemePreference() || '');
  const deploymentTheme = normalizeThemeId(
    typeof document === 'undefined' ? null : document.documentElement.dataset.ceDeploymentTheme,
  );
  const deploymentThemeLabel = deploymentTheme ? getThemeMetadata(deploymentTheme).label : 'default';

  React.useEffect(() => subscribeThemeChanges(() => setPreference(readStoredThemePreference() || '')), []);

  return (
    <div className={styles.field}>
      <select
        id="ce-settings-theme-select"
        className={styles.select}
        value={preference}
        aria-label="App theme"
        data-testid={E2E_TESTIDS.SETTINGS_THEME}
        onChange={(event) => {
          const next = event.target.value;
          if (next) setStoredThemePreference(next);
          else clearStoredThemePreference();
          setPreference(readStoredThemePreference() || '');
        }}
      >
        <option value="">Deployment theme: {deploymentThemeLabel}</option>
        {CE_THEME_IDS.map((id) => (
          <option key={id} value={id}>
            {getThemeMetadata(id).label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AppThemeSelector;
