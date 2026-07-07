import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import styles from './Account.module.scss';

type LoginSettingsSectionCardProps = {
  children?: React.ReactNode;
  isOpen?: boolean;
  onToggle?: (() => void) | null;
  summary?: React.ReactNode;
  title: React.ReactNode;
};

const LoginSettingsSectionTitle = ({
  summary = null,
  title,
}: {
  summary?: React.ReactNode;
  title: React.ReactNode;
}): React.ReactElement => (
  <span className={styles.settingsSectionTitleGroup}>
    <span className={styles.settingsSectionTitle}>{title}</span>
    {summary ? <span className={styles.settingsSectionSummary}>{summary}</span> : null}
  </span>
);

const LoginSettingsSectionCard = ({
  children = null,
  isOpen = true,
  onToggle = null,
  summary = null,
  title,
}: LoginSettingsSectionCardProps): React.ReactElement => {
  const isCollapsible = typeof onToggle === 'function';

  return (
    <div className={styles.settingsSectionCard}>
      {isCollapsible ? (
        <button
          type="button"
          className={styles.settingsSectionToggle}
          onClick={onToggle || undefined}
          aria-expanded={!!isOpen}
        >
          <LoginSettingsSectionTitle title={title} summary={summary} />
          <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} className={styles.settingsSectionChevron} />
        </button>
      ) : (
        <div className={styles.settingsSectionToggle}>
          <LoginSettingsSectionTitle title={title} summary={summary} />
        </div>
      )}
      {isOpen && <div className={styles.settingsSectionBody}>{children}</div>}
    </div>
  );
};

export default LoginSettingsSectionCard;
