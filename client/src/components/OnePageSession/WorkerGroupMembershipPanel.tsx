import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import {
  joinWorkerGroup,
  loadWorkerGroupOverview,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import styles from './OnePageSession.module.scss';

export type WorkerGroupMembershipPanelProps = {
  envelope: AgentClientLoginEnvelope;
  fetchImpl?: typeof fetch;
};

const emptyOverview: WorkerGroupOverview = { groups: [], memberships: [] };

const WorkerGroupMembershipPanel = ({ envelope, fetchImpl = fetch }: WorkerGroupMembershipPanelProps) => {
  const [overview, setOverview] = useState<WorkerGroupOverview>(emptyOverview);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [joiningGroupId, setJoiningGroupId] = useState('');
  const canReadGroups = envelope.capabilities?.readGroups === true;
  const workerUrl = envelope.workerUrl || '';
  const workerToken = envelope.workerCredential?.token || '';

  const reload = useCallback(async () => {
    if (!canReadGroups || !workerUrl || !workerToken) return;
    setStatus('loading');
    setError('');
    try {
      const next = await loadWorkerGroupOverview({
        workerUrl,
        credentialToken: workerToken,
        fetchImpl,
      });
      setOverview(next);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'worker_group_load_failed');
      setStatus('error');
    }
  }, [canReadGroups, fetchImpl, workerToken, workerUrl]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const membershipIds = useMemo(
    () => new Set(overview.memberships.map((membership) => membership.group.groupId)),
    [overview.memberships],
  );
  const availableGroups = overview.groups.filter((group) => !membershipIds.has(group.groupId));

  const handleJoin = async (groupId: string) => {
    setJoiningGroupId(groupId);
    setError('');
    try {
      await joinWorkerGroup({ workerUrl, credentialToken: workerToken, groupId, fetchImpl });
      await reload();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'worker_group_join_failed');
      setStatus('error');
    } finally {
      setJoiningGroupId('');
    }
  };

  if (!canReadGroups) {
    return (
      <section className={styles.telegramListPanel} data-testid="ce-session-worker-groups">
        <div className={styles.telegramListHeader}>Access groups</div>
        <div className={styles.telegramListEmpty}>Access groups are not included in this credential.</div>
      </section>
    );
  }

  return (
    <section className={styles.telegramListPanel} data-testid="ce-session-worker-groups">
      <div className={styles.telegramListHeader}>
        <span>Access groups</span>
        <button type="button" className={styles.telegramSecondaryButton} onClick={() => void reload()}>
          Refresh
        </button>
      </div>
      <p className={styles.telegramReportApprox}>
        These worker-managed access groups control session authorization. They are separate from research profile
        categories.
      </p>
      {status === 'loading' ? <div className={styles.telegramListEmpty}>Loading access groups…</div> : null}
      {error ? <div className={styles.telegramListEmpty}>{error}</div> : null}
      {overview.memberships.map((membership) => (
        <article key={membership.group.groupId} className={styles.telegramPileFrame}>
          <strong>{membership.group.label}</strong>
          {membership.group.description ? <span>{membership.group.description}</span> : null}
          <span>Member</span>
          {typeof membership.memberCount === 'number' ? <span>{membership.memberCount} members</span> : null}
        </article>
      ))}
      {availableGroups.map((group) => (
        <article key={group.groupId} className={styles.telegramPileFrame}>
          <strong>{group.label}</strong>
          {group.description ? <span>{group.description}</span> : null}
          {group.joinMode === 'open' ? (
            <button
              type="button"
              className={styles.telegramPrimaryButton}
              disabled={joiningGroupId === group.groupId}
              aria-label={`Join ${group.label}`}
              onClick={() => void handleJoin(group.groupId)}
            >
              {joiningGroupId === group.groupId ? 'Joining…' : 'Join'}
            </button>
          ) : (
            <span>Admin invitation required</span>
          )}
        </article>
      ))}
      {status === 'ready' && !overview.memberships.length && !availableGroups.length ? (
        <div className={styles.telegramListEmpty}>No visible access groups are configured.</div>
      ) : null}
    </section>
  );
};

export default WorkerGroupMembershipPanel;
