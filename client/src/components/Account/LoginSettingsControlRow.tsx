import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import styles from './Account.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

export const LoginSettingsConfigToggleControl = ({
  expanded = false,
  onToggle = null,
  testId = '',
}: {
  expanded?: boolean;
  onToggle?: (() => void) | null;
  testId?: string;
} = {}): React.ReactElement => (
  <Button
    type="button"
    onClick={onToggle || undefined}
    className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.settingsConfigToggleButton}`}
    aria-expanded={expanded}
    data-testid={testId || undefined}
  >
    Config
    <FontAwesomeIcon icon={expanded ? faCaretUp : faCaretDown} className={styles.aiSettingsToggleIcon} />
  </Button>
);

export const LoginSettingsControlRow = ({
  afterDemo = null,
  beforeConfig = null,
  betweenSessionAndTooltips = null,
  configOpen = false,
  configTestId = '',
  containerClassName = '',
  demoControl = null,
  layout = 'row',
  onToggleConfig = null,
  rowClassName = '',
  sessionControl = null,
  showSession = true,
  themeControl = null,
  tooltipsControl = null,
}: {
  afterDemo?: React.ReactNode;
  beforeConfig?: React.ReactNode;
  betweenSessionAndTooltips?: React.ReactNode;
  configOpen?: boolean;
  configTestId?: string;
  containerClassName?: string;
  demoControl?: React.ReactNode;
  layout?: 'row' | 'quick-grid';
  onToggleConfig?: (() => void) | null;
  rowClassName?: string;
  sessionControl?: React.ReactNode;
  showSession?: boolean;
  themeControl?: React.ReactNode;
  tooltipsControl?: React.ReactNode;
}): React.ReactElement => {
  const configControl = (
    <LoginSettingsConfigToggleControl expanded={configOpen} onToggle={onToggleConfig} testId={configTestId} />
  );
  const quickControls = [
    { key: 'config', control: configControl },
    { key: 'session', control: showSession ? sessionControl : null },
    { key: 'explainers', control: tooltipsControl },
    { key: 'demo', control: demoControl },
  ];

  if (layout === 'quick-grid') {
    return (
      <div className={[styles.settingsContainer, containerClassName].filter(Boolean).join(' ')}>
        {beforeConfig}
        <div className={styles.settingsQuickControlsGrid} data-testid={E2E_TESTIDS.SETTINGS_QUICK_CONTROLS}>
          {quickControls.map(({ key, control }) => (
            <div className={styles.settingsQuickControlCell} key={key}>
              {control}
            </div>
          ))}
        </div>
        {themeControl ? <div className={styles.settingsThemeQuickSlot}>{themeControl}</div> : null}
        {betweenSessionAndTooltips}
        {afterDemo}
      </div>
    );
  }

  return (
    <div className={[styles.settingsContainer, containerClassName].filter(Boolean).join(' ')}>
      <div className={[styles.settingsRow, rowClassName].filter(Boolean).join(' ')}>
        {beforeConfig}
        {configControl}
        {showSession ? sessionControl : null}
        {betweenSessionAndTooltips}
        {tooltipsControl}
        {demoControl}
        {afterDemo}
      </div>
    </div>
  );
};
