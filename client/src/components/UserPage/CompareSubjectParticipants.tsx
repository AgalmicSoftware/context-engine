import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import styles from './UserPage.module.scss';

type UnknownRecord = Record<string, unknown>;

type CompareSubjectParticipant = {
  address?: unknown;
  avatar?: unknown;
  profileHref?: unknown;
  provenance?: unknown;
  subjectKind?: unknown;
  subjectToken?: unknown;
};

type CompareSubjectParticipantsProps = {
  activeSessionSlug?: string;
  labels?: string[];
  users?: CompareSubjectParticipant[];
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const CompareSubjectParticipants = ({
  activeSessionSlug = '',
  labels = [],
  users = [],
}: CompareSubjectParticipantsProps) => (
  <div
    style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}
    role="list"
    aria-label="Comparison subjects"
  >
    {users.map((user, index) => {
      const subjectToken = String(user?.subjectToken || user?.address || '');
      const label = labels[index] || `User ${index + 1}`;
      const provenance = asRecord(user?.provenance);
      const source = String(provenance.source || '');
      const provenanceSession = String(provenance.sessionSlug || activeSessionSlug || '').trim();
      const provenanceLabel =
        source === 'shipped_simulation'
          ? 'shipped simulation'
          : provenanceSession
            ? `${user.subjectKind || 'subject'} · ${provenanceSession}`
            : `${user.subjectKind || 'subject'} · active session cache`;
      const profileHref = String(user?.profileHref || '').trim();
      const avatar = String(user?.avatar || '').trim();
      return (
        <div
          key={subjectToken || index}
          className={styles.resultBadge}
          role="listitem"
          aria-label={`${label}, ${provenanceLabel}`}
          style={{ alignItems: 'center', display: 'inline-flex', gap: 6 }}
        >
          {avatar ? <img src={avatar} alt="" aria-hidden="true" width={20} height={20} /> : null}
          <span>
            {label} <span className={styles.pillAddress}>({provenanceLabel})</span>
          </span>
          {profileHref && (
            <a
              href={profileHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open profile for ${label}`}
              title="Open user profile"
              style={{ alignItems: 'center', display: 'inline-flex', marginLeft: 6 }}
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          )}
        </div>
      );
    })}
  </div>
);

export default CompareSubjectParticipants;
