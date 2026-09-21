import React from 'react';
import {
  isColorBlindModeEnabled,
  setColorBlindPreference,
  subscribeColorVisionChanges,
} from '../../utilities/ui/colorVisionRuntime';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './AppThemeSelector.module.scss';

export default function ColorBlindModeControl(): React.ReactElement {
  const [enabled, setEnabled] = React.useState(isColorBlindModeEnabled);
  React.useEffect(() => subscribeColorVisionChanges(() => setEnabled(isColorBlindModeEnabled())), []);
  return (
    <label className={styles.colorBlindControl}>
      <input
        type="checkbox"
        checked={enabled}
        data-testid={E2E_TESTIDS.SETTINGS_COLOR_BLIND}
        onChange={(event) => setColorBlindPreference(event.target.checked)}
      />
      <span>Color-blind mode</span>
    </label>
  );
}
