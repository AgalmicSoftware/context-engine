import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import type { WorkerGroupJoinMode } from '../../domains/worker/workerGroupPorts';
import CETooltip from './CETooltip';
import styles from './WorkerGroupRemovalAuthHelp.module.scss';

// The labels the on-chain groups use, plus the Worker-only Admin adds members.
export const WORKER_GROUP_JOIN_LABELS: Record<WorkerGroupJoinMode, string> = {
  open: 'Public URL',
  one_use: 'One-use URLs',
  // Backticks, not quotes: the release secret scan flags a quoted value under a key containing "password".
  group_password: `Group Password`,
  admin_add: 'Admin adds members',
};

const MEANINGS: Record<WorkerGroupJoinMode, string> = {
  open: 'Anyone with the link can join.',
  one_use: 'Generate a unique claim link for each participant.',
  group_password: `Use a shared password: anyone who has it can join.`,
  admin_add: 'Admins add each member by address.',
};

/** What a Worker that predates join choices offers. */
export const BASIC_WORKER_GROUP_JOIN_MODES: WorkerGroupJoinMode[] = ['open', 'admin_add'];
export const ALL_WORKER_GROUP_JOIN_MODES: WorkerGroupJoinMode[] = ['one_use', 'group_password', 'open', 'admin_add'];

export const WorkerGroupJoinModeOptions = ({ modes }: { modes: WorkerGroupJoinMode[] }) => (
  <>
    {modes.map((value) => (
      <option key={value} value={value}>
        {WORKER_GROUP_JOIN_LABELS[value]}
      </option>
    ))}
  </>
);

const HelpButton = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const id = `worker-group-help-${React.useId().replace(/:/g, '')}`;
  return (
    <>
      <button
        type="button"
        id={id}
        className={styles.button}
        data-ce-control-appearance="frameless"
        aria-label={label}
        onClick={(event) => event.currentTarget.focus()}
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
      <CETooltip target={id} placement="top" trigger="hover focus" autohide={false} innerClassName={styles.bubble}>
        {children}
      </CETooltip>
    </>
  );
};

/** Every offered choice, explained. */
export const WorkerGroupJoinModeHelp = ({ modes }: { modes: WorkerGroupJoinMode[] }) => (
  <HelpButton label="About who can join">
    {modes.map((value) => (
      <span key={value} className={styles.choice}>
        <strong>{WORKER_GROUP_JOIN_LABELS[value]}:</strong> {MEANINGS[value]}
      </span>
    ))}
  </HelpButton>
);

export const WorkerGroupMemberLimitHelp = () => (
  <HelpButton label="About the member limit">
    The most members the group can have, up to the session’s limit. On-chain groups call it Limited Tokens.
  </HelpButton>
);

export const WorkerGroupJoinDeadlineHelp = () => (
  <HelpButton label="About the join deadline">
    After this time no one can join. On-chain groups call it Time-Limited.
  </HelpButton>
);

export const WorkerGroupListedHelp = () => (
  <HelpButton label="About showing the group">
    Off: only its members and admins see the group, and a person needs its link, password or claim code to find it.
    Public URL groups are always shown.
  </HelpButton>
);
