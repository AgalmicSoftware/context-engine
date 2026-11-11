import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { WORKER_GROUP_REMOVAL_AUTHS, type WorkerGroupRemovalAuth } from '../../domains/worker/workerGroupPorts';
import CETooltip from './CETooltip';
import styles from './WorkerGroupRemovalAuthHelp.module.scss';

export const WORKER_GROUP_REMOVAL_AUTH_LABELS: Record<WorkerGroupRemovalAuth, string> = {
  both: 'Admins and the member',
  admin_only: 'Admins only',
  member_only: 'The member only',
  neither: 'No one',
};

const MEANINGS: Record<WorkerGroupRemovalAuth, string> = {
  both: 'Members can leave, and admins can remove them.',
  admin_only: 'Admins can remove members. Members can’t leave.',
  member_only: 'Members can leave. Admins can’t remove them.',
  neither: 'Memberships last until the group is deleted.',
};

// A Worker deployed before the setting ignores it, and the group it saves keeps the old rule.
export const withRemovalAuthNotice = (
  status: string,
  requested: WorkerGroupRemovalAuth,
  saved: WorkerGroupRemovalAuth = 'both',
): string =>
  saved === requested
    ? status
    : `${status} This session’s Worker doesn’t support “Who can remove members” yet, so members can leave and admins can remove them until it is redeployed.`;

export const WorkerGroupRemovalAuthOptions = () => (
  <>
    {WORKER_GROUP_REMOVAL_AUTHS.map((value) => (
      <option key={value} value={value}>
        {WORKER_GROUP_REMOVAL_AUTH_LABELS[value]}
      </option>
    ))}
  </>
);

type WorkerGroupRemovalAuthHelpProps = {
  // A group's own setting, explained alone; without it, every choice is explained.
  removalAuth?: WorkerGroupRemovalAuth;
};

const WorkerGroupRemovalAuthHelp = ({ removalAuth }: WorkerGroupRemovalAuthHelpProps) => {
  const id = `worker-group-removal-auth-${React.useId().replace(/:/g, '')}`;
  return (
    <>
      <button
        type="button"
        id={id}
        className={styles.button}
        data-ce-control-appearance="frameless"
        aria-label="About who can remove members"
        onClick={(event) => event.currentTarget.focus()}
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
      <CETooltip target={id} placement="top" trigger="hover focus" autohide={false} innerClassName={styles.bubble}>
        {removalAuth
          ? MEANINGS[removalAuth]
          : WORKER_GROUP_REMOVAL_AUTHS.map((value) => (
              <span key={value} className={styles.choice}>
                <strong>{WORKER_GROUP_REMOVAL_AUTH_LABELS[value]}:</strong> {MEANINGS[value]}
              </span>
            ))}
      </CETooltip>
    </>
  );
};

export default WorkerGroupRemovalAuthHelp;
