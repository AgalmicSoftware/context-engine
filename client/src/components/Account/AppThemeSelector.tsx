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

const readDeploymentTheme = () =>
  normalizeThemeId(typeof document === 'undefined' ? null : document.documentElement.dataset.ceDeploymentTheme);

const useThemePreference = () => {
  const [preference, setPreference] = React.useState(() => readStoredThemePreference() || '');
  React.useEffect(() => subscribeThemeChanges(() => setPreference(readStoredThemePreference() || '')), []);
  return [preference, setPreference] as const;
};

/** Short name of the theme in use, for buttons that summarise the choice. */
export const useThemeChoiceLabel = (): string => {
  const [preference] = useThemePreference();
  const theme = preference || readDeploymentTheme();
  return theme ? getThemeMetadata(theme).label : 'Default';
};

const AppThemeSelector = (): React.ReactElement => {
  const [preference, setPreference] = useThemePreference();
  const deploymentTheme = readDeploymentTheme();
  const defaultOptionLabel = deploymentTheme ? `${getThemeMetadata(deploymentTheme).label} (default)` : 'Default';

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
        <option value="">{defaultOptionLabel}</option>
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
