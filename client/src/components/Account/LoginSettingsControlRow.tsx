import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import styles from './Account.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { CE_THEME_SELECTOR_ENABLED } from '../../variables/appConfig.js';
import AppThemeSelector, { useThemeChoiceLabel } from './AppThemeSelector';
import ColorBlindModeControl from './ColorBlindModeControl';

type DisclosureButtonProps = {
  expanded?: boolean;
  onToggle?: (() => void) | null;
  testId?: string;
  children?: React.ReactNode;
  labelledBy?: string;
  controls?: string;
};

// Config and Appearance share one disclosure button so they look alike in every theme.
export const LoginSettingsConfigToggleControl = ({
  expanded = false,
  onToggle = null,
  testId = '',
  children = 'Config',
  labelledBy,
  controls,
}: DisclosureButtonProps = {}): React.ReactElement => (
  <Button
    type="button"
    onClick={onToggle || undefined}
    className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.settingsConfigToggleButton}`}
    aria-expanded={expanded}
    aria-labelledby={labelledBy}
    aria-controls={expanded ? controls : undefined}
    data-testid={testId || undefined}
  >
    {children}
    <FontAwesomeIcon icon={expanded ? faCaretUp : faCaretDown} className={styles.aiSettingsToggleIcon} />
  </Button>
);

const LoginSettingsAppearancePanel = ({ id }: { id: string }): React.ReactElement => (
  <div id={id} className={styles.settingsAppearancePanel} data-testid={E2E_TESTIDS.SETTINGS_APPEARANCE_PANEL}>
    {CE_THEME_SELECTOR_ENABLED && (
      <div className={styles.settingsAppearanceTheme}>
        <label className={styles.settingsStripLabel} htmlFor="ce-settings-theme-select">
          Theme
        </label>
        <AppThemeSelector />
      </div>
    )}
    <ColorBlindModeControl />
  </div>
);

type StripProps = {
  configOpen: boolean;
  onToggleConfig: (() => void) | null;
  configTestId: string;
  sessionControl: React.ReactNode;
  tooltipsControl: React.ReactNode;
  showAppearance: boolean;
};

// One strip of labelled cells; Appearance opens its controls below the strip.
const LoginSettingsStrip = ({
  configOpen,
  onToggleConfig,
  configTestId,
  sessionControl,
  tooltipsControl,
  showAppearance,
}: StripProps): React.ReactElement => {
  const [appearanceOpen, setAppearanceOpen] = React.useState(false);
  const id = React.useId();
  const themeLabel = useThemeChoiceLabel();
  // Config and Appearance read as "<cell label> <value>" to assistive tech.
  const disclosure = (key: string, value: string, expanded: boolean, onToggle: (() => void) | null, more = {}) => (
    <LoginSettingsConfigToggleControl
      expanded={expanded}
      onToggle={onToggle}
      labelledBy={`${id}-${key}-label ${id}-${key}-value`}
      {...more}
    >
      <span id={`${id}-${key}-value`} className={styles.settingsStripValue}>
        {value}
      </span>
    </LoginSettingsConfigToggleControl>
  );
  const cells = [
    {
      key: 'config',
      label: 'Config',
      control: disclosure('config', 'Advanced', configOpen, onToggleConfig, { testId: configTestId }),
    },
    { key: 'session', label: 'Session', control: sessionControl },
    { key: 'explainers', label: 'Explainers', control: tooltipsControl },
    {
      key: 'appearance',
      label: 'Appearance',
      control: showAppearance
        ? disclosure(
            'appearance',
            CE_THEME_SELECTOR_ENABLED ? themeLabel : 'Colors',
            appearanceOpen,
            () => setAppearanceOpen((open) => !open),
            {
              testId: E2E_TESTIDS.SETTINGS_APPEARANCE_TOGGLE,
              controls: `${id}-appearance-panel`,
            },
          )
        : null,
    },
  ];
  return (
    <>
      <div className={styles.settingsStrip} data-testid={E2E_TESTIDS.SETTINGS_QUICK_CONTROLS}>
        {cells.map(({ key, label, control }) =>
          control ? (
            <div className={styles.settingsStripCell} data-cell={key} key={key}>
              {/* Controls carry their own names; Config and Appearance borrow this label. */}
              <span id={`${id}-${key}-label`} className={styles.settingsStripLabel} aria-hidden>
                {label}
              </span>
              {control}
            </div>
          ) : null,
        )}
      </div>
      {showAppearance && appearanceOpen ? <LoginSettingsAppearancePanel id={`${id}-appearance-panel`} /> : null}
    </>
  );
};

export const LoginSettingsControlRow = ({
  afterToggles = null,
  beforeConfig = null,
  betweenSessionAndTooltips = null,
  configOpen = false,
  configTestId = '',
  containerClassName = '',
  layout = 'row',
  onToggleConfig = null,
  rowClassName = '',
  sessionControl = null,
  showAppearance = false,
  showSession = true,
  tooltipsControl = null,
}: {
  afterToggles?: React.ReactNode;
  beforeConfig?: React.ReactNode;
  betweenSessionAndTooltips?: React.ReactNode;
  configOpen?: boolean;
  configTestId?: string;
  containerClassName?: string;
  layout?: 'row' | 'strip';
  onToggleConfig?: (() => void) | null;
  rowClassName?: string;
  sessionControl?: React.ReactNode;
  showAppearance?: boolean;
  showSession?: boolean;
  tooltipsControl?: React.ReactNode;
}): React.ReactElement => {
  if (layout === 'strip') {
    return (
      <div className={[styles.settingsContainer, containerClassName].filter(Boolean).join(' ')}>
        {beforeConfig}
        <LoginSettingsStrip
          configOpen={configOpen}
          onToggleConfig={onToggleConfig}
          configTestId={configTestId}
          sessionControl={showSession ? sessionControl : null}
          tooltipsControl={tooltipsControl}
          showAppearance={showAppearance}
        />
        {betweenSessionAndTooltips}
        {afterToggles}
      </div>
    );
  }

  return (
    <div className={[styles.settingsContainer, containerClassName].filter(Boolean).join(' ')}>
      <div className={[styles.settingsRow, rowClassName].filter(Boolean).join(' ')}>
        {beforeConfig}
        <LoginSettingsConfigToggleControl expanded={configOpen} onToggle={onToggleConfig} testId={configTestId} />
        {showSession ? sessionControl : null}
        {betweenSessionAndTooltips}
        {tooltipsControl}
        {afterToggles}
      </div>
    </div>
  );
};
