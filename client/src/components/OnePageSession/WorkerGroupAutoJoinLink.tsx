import React, { useState } from 'react';
import { buildWorkerGroupAutoJoinPath, canAutoJoinWorkerGroup } from '../../domains/worker/workerGroupAutoJoin';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';
import styles from './OnePageSession.module.scss';

export default function WorkerGroupAutoJoinLink({
  group,
  sessionSlug,
  workerUrl,
}: {
  group: WorkerGroup;
  sessionSlug: string;
  workerUrl: string;
}) {
  const [status, setStatus] = useState('');
  if (!canAutoJoinWorkerGroup(group)) return null;
  const copy = async () => {
    try {
      const link = new URL(buildWorkerGroupAutoJoinPath(sessionSlug, group.groupId, workerUrl), window.location.origin);
      await navigator.clipboard.writeText(link.toString());
      setStatus('Auto-join link copied.');
    } catch {
      setStatus('Could not copy the auto-join link.');
    }
  };
  return (
    <span>
      <button
        type="button"
        className={styles.telegramSecondaryButton}
        onClick={() => void copy()}
        aria-label={`Copy auto-join link for ${group.label}`}
      >
        Copy auto-join link
      </button>
      {status ? <span role="status">{status}</span> : null}
    </span>
  );
}
