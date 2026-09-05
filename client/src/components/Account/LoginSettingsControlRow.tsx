import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './Account.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type SessionDescriptor = {
  label?: string;
  slug?: string;
};

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

export const LoginSettingsSessionSummary = ({
  activeSession = {},
  sessionHref = '/session',
}: {
  activeSession?: SessionDescriptor;
  sessionHref?: string;
}): React.ReactElement => {
  const label = activeSession.label || 'General';

  return (
    <div className={styles.settingsSessionSummary}>
      <div className={styles.settingsSessionRoute} aria-label={`Active session: ${label}`}>
        <span className={styles.settingsSessionLabel}>SESSION</span>
        <span className={styles.settingsSessionName}>{label}</span>
        <a
          href={sessionHref}
          className={styles.settingsSessionLink}
          aria-label={`Open session ${label}`}
          title={`Open session ${label}`}
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
      </div>
    </div>
  );
};

export const LoginSettingsControlRow = ({
  activeSession = {},
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
  sessionHref = '/session',
  showSession = true,
  themeControl = null,
  tooltipsControl = null,
}: {
  activeSession?: SessionDescriptor;
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
  sessionHref?: string;
  showSession?: boolean;
  themeControl?: React.ReactNode;
  tooltipsControl?: React.ReactNode;
}): React.ReactElement => {
  const configControl = (
    <LoginSettingsConfigToggleControl expanded={configOpen} onToggle={onToggleConfig} testId={configTestId} />
  );
  const sessionControl = showSession ? (
    <LoginSettingsSessionSummary activeSession={activeSession} sessionHref={sessionHref} />
  ) : null;
  const quickControls = [
    { key: 'config', control: configControl },
    { key: 'session', control: sessionControl },
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
        {sessionControl}
        {betweenSessionAndTooltips}
        {tooltipsControl}
        {demoControl}
        {afterDemo}
      </div>
    </div>
  );
};
