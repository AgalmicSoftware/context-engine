import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './Account.module.scss';

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
  onToggleConfig = null,
  rowClassName = '',
  sessionHref = '/session',
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
  onToggleConfig?: (() => void) | null;
  rowClassName?: string;
  sessionHref?: string;
  tooltipsControl?: React.ReactNode;
}): React.ReactElement => (
  <div className={[styles.settingsContainer, containerClassName].filter(Boolean).join(' ')}>
    <div className={[styles.settingsRow, rowClassName].filter(Boolean).join(' ')}>
      {beforeConfig}
      <LoginSettingsConfigToggleControl expanded={configOpen} onToggle={onToggleConfig} testId={configTestId} />
      <LoginSettingsSessionSummary activeSession={activeSession} sessionHref={sessionHref} />
      {betweenSessionAndTooltips}
      {tooltipsControl}
      {demoControl}
      {afterDemo}
    </div>
  </div>
);
