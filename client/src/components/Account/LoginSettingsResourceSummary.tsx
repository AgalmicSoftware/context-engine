import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import styles from './Account.module.scss';

type SessionPillEntry = {
  detail?: string;
  isActive?: boolean;
  label?: string;
  slug?: string;
  slugLabel?: string;
};

type SponsoredResourceCard = {
  key: string;
  status: {
    detail: string;
    label: string;
    tone: string;
  };
  title: string;
};

export const LoginSettingsSessionPills = ({
  emptyText = 'No sponsor sessions configured.',
  sessions = [],
}: {
  emptyText?: string;
  sessions?: SessionPillEntry[];
}): React.ReactElement => {
  if (!sessions.length) {
    return <div className={styles.aiSettingsHintStrong}>{emptyText}</div>;
  }
  return (
    <div className={styles.sessionPills}>
      {sessions.map((sessionEntry) => (
        <span
          key={`${sessionEntry.slug}:${sessionEntry.label}`}
          className={`${styles.sessionPill} ${sessionEntry.isActive ? styles.sessionPillActive : ''} ${
            sessionEntry.detail ? styles.sessionPillWithDetail : ''
          }`}
        >
          {sessionEntry.label}
          {' '}
          <span
            className={`${styles.sessionPillMeta} ${sessionEntry.detail ? styles.supportedResourceDetail : ''}`}
          >
            {sessionEntry.detail || (sessionEntry.isActive ? 'active' : sessionEntry.slugLabel)}
          </span>
        </span>
      ))}
    </div>
  );
};

export const LoginSettingsSupportedResourceCard = ({
  activeSession,
  card,
  extraSessions = [],
  extrasExpanded = false,
  onToggleSessions,
}: {
  activeSession: SessionPillEntry;
  card: SponsoredResourceCard;
  extraSessions?: SessionPillEntry[];
  extrasExpanded?: boolean;
  onToggleSessions?: (resourceKey: string) => void;
}): React.ReactElement => {
  const extraCount = extraSessions.length;

  return (
    <div className={styles.supportedResourceCard}>
      <div className={styles.supportedResourceHeader}>
        <div className={styles.supportedResourceName}>{card.title}</div>
        <span className={`${styles.aiSponsoredStatus} ${styles[`aiSponsoredStatus${card.status.tone}`]}`}>
          {card.status.label}
        </span>
      </div>
      <div className={styles.supportedResourceSessions}>
        <div className={styles.supportedResourceSessionsLabel}>Active session</div>
        <div className={styles.supportedResourcePrimarySession}>
          <LoginSettingsSessionPills sessions={[{ ...activeSession, detail: card.status.detail, isActive: true }]} />
        </div>
        {extraCount > 0 ? (
          <div className={styles.supportedResourceOtherSessions}>
            <div className={styles.supportedResourceSessionsLabel}>Other sessions with {card.title}</div>
            <button
              type="button"
              className={styles.supportedResourceMoreButton}
              onClick={() => onToggleSessions?.(card.key)}
              aria-expanded={extrasExpanded}
              aria-label={`${extrasExpanded ? 'Hide' : 'Show'} other ${card.title} sponsor sessions`}
            >
              {extrasExpanded
                ? 'Hide other sessions'
                : `${extraCount} other ${extraCount === 1 ? 'session' : 'sessions'}`}
              <FontAwesomeIcon
                icon={extrasExpanded ? faCaretUp : faCaretDown}
                className={styles.supportedResourceMoreChevron}
              />
            </button>
          </div>
        ) : null}
        {extraCount > 0 && extrasExpanded ? (
          <div className={styles.supportedResourceExtraSessions}>
            <LoginSettingsSessionPills sessions={extraSessions} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
