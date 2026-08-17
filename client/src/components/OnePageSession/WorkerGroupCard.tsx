import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';
import WorkerGroupImage from '../Shared/WorkerGroupImage';
import sbtPageStyles from '../SBTs/SBTPage.module.scss';
import styles from './OnePageSession.module.scss';

type WorkerGroupCardProps = {
  children: React.ReactNode;
  copyGroupLink: (groupId: string) => Promise<void>;
  fetchImpl: typeof fetch;
  group: WorkerGroup;
  isActive: boolean;
  onOpenDetails: (groupId: string) => void;
  showDescription: boolean;
  sessionConfig: unknown;
  sessionSlug: string;
  workerToken: string;
  workerUrl: string;
};

const WorkerGroupCard = ({
  children,
  copyGroupLink,
  fetchImpl,
  group,
  isActive,
  onOpenDetails,
  showDescription,
  sessionConfig,
  sessionSlug,
  workerToken,
  workerUrl,
}: WorkerGroupCardProps) => {
  const safeGroupId = group.groupId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const titleId = `worker-group-${safeGroupId}-title`;
  const descriptionId = showDescription && group.description ? `worker-group-${safeGroupId}-description` : undefined;

  return (
    <article
      id={`group-${encodeURIComponent(group.groupId)}`}
      className={`${sbtPageStyles.sbtItem} ${styles.workerGroupCard}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className={sbtPageStyles.iconOverlay}>
        <div
          className={isActive ? sbtPageStyles.liveIndicator : sbtPageStyles.endedIndicator}
          aria-label={isActive ? 'Group joining open' : 'Group joining closed'}
        ></div>
        <button
          type="button"
          className={styles.workerGroupCardLinkButton}
          data-ce-control-appearance="frameless"
          onClick={() => void copyGroupLink(group.groupId)}
          aria-label={`Copy ${group.label} group link`}
          title="Copy group link"
        >
          <FontAwesomeIcon icon={faLink} />
        </button>
      </div>
      <button
        type="button"
        className={styles.workerGroupCardBodyButton}
        onClick={() => onOpenDetails(group.groupId)}
        aria-label={`Open group details for ${group.label}`}
      >
        <div className={`${sbtPageStyles.miniImageContainer} ${styles.workerGroupCardImageContainer}`}>
          {group.imageUrl ? (
            <WorkerGroupImage
              src={group.imageUrl}
              alt={group.label}
              className={sbtPageStyles.sbtImage}
              fetchImpl={fetchImpl}
              sessionConfig={sessionConfig}
              sessionSlug={sessionSlug}
              testId="ce-session-worker-group-image"
              workerToken={workerToken}
              workerUrl={workerUrl}
            />
          ) : null}
        </div>
        <p id={titleId} className={sbtPageStyles.miniSbtName}>
          {group.label}
        </p>
        {showDescription && group.description ? (
          <p id={descriptionId} className={styles.workerGroupCardDescription} title={group.description}>
            {group.description}
          </p>
        ) : null}
      </button>
      <div className={styles.workerGroupCardActions}>{children}</div>
    </article>
  );
};

export default WorkerGroupCard;
