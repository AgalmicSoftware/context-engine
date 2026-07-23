import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import {
  joinWorkerGroup,
  loadWorkerGroupOverview,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import styles from './OnePageSession.module.scss';

export type WorkerGroupMembershipPanelProps = {
  envelope?: AgentClientLoginEnvelope;
  workerUrl?: string;
  workerToken?: string;
  canReadGroups?: boolean;
  refreshNonce?: number;
  fetchImpl?: typeof fetch;
  participantAddress?: string;
};

const emptyOverview: WorkerGroupOverview = { groups: [], memberships: [] };

const WorkerGroupMembershipPanel = ({
  envelope,
  workerUrl: workerUrlProp,
  workerToken: workerTokenProp,
  canReadGroups: canReadGroupsProp,
  refreshNonce = 0,
  fetchImpl = fetch,
  participantAddress = '',
}: WorkerGroupMembershipPanelProps) => {
  const [overview, setOverview] = useState<WorkerGroupOverview>(emptyOverview);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [joiningGroupId, setJoiningGroupId] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const canReadGroups = canReadGroupsProp ?? envelope?.capabilities?.readGroups === true;
  const workerUrl = workerUrlProp || envelope?.workerUrl || '';
  const workerToken = workerTokenProp || envelope?.workerCredential?.token || '';

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
  }, [refreshNonce, reload]);

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
  const copyGroupLink = async (groupId: string) => {
    try {
      if (typeof window === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      const currentUrl = new URL(window.location.href);
      const link = new URL(currentUrl.pathname, currentUrl.origin);
      const canonicalWorkerUrl = new URL(workerUrl);
      if (!['https:', 'http:'].includes(canonicalWorkerUrl.protocol)) throw new Error('Invalid Worker URL');
      link.searchParams.set('worker', canonicalWorkerUrl.origin);
      link.hash = `group-${encodeURIComponent(groupId)}`;
      await navigator.clipboard.writeText(link.toString());
      setShareStatus('Group link copied. It contains no invitation token or credential.');
    } catch {
      setShareStatus('Could not copy the group link. Copy the current session URL manually.');
    }
  };

  if (!canReadGroups) {
    return (
      <section className={styles.telegramListPanel} data-testid="ce-session-worker-groups">
        <div className={styles.telegramListHeader}>Groups</div>
        <div className={styles.telegramListEmpty}>Groups are not included in this credential.</div>
      </section>
    );
  }

  return (
    <section className={styles.telegramListPanel} data-testid="ce-session-worker-groups">
      <div className={styles.telegramListHeader}>
        <span>Groups</span>
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
      {shareStatus ? <div className={styles.telegramReportApprox}>{shareStatus}</div> : null}
      {overview.memberships.map((membership) => (
        <article
          key={membership.group.groupId}
          id={`group-${encodeURIComponent(membership.group.groupId)}`}
          className={styles.telegramPileFrame}
        >
          {membership.group.imageUrl ? (
            <img
              src={membership.group.imageUrl}
              alt=""
              className={styles.workerGroupImage}
              data-testid="ce-session-worker-group-image"
            />
          ) : null}
          <strong>{membership.group.label}</strong>
          {membership.group.description ? <span>{membership.group.description}</span> : null}
          <span>Member</span>
          {typeof membership.memberCount === 'number' ? <span>{membership.memberCount} members</span> : null}
          <button
            type="button"
            className={styles.telegramSecondaryButton}
            onClick={() => void copyGroupLink(membership.group.groupId)}
            aria-label={`Copy ${membership.group.label} group link`}
          >
            Copy group link
          </button>
          <span>
            Leaving is not supported by the current Worker authority contract; ask an admin to remove membership.
          </span>
        </article>
      ))}
      {availableGroups.map((group) => (
        <article
          key={group.groupId}
          id={`group-${encodeURIComponent(group.groupId)}`}
          className={styles.telegramPileFrame}
        >
          {group.imageUrl ? (
            <img
              src={group.imageUrl}
              alt=""
              className={styles.workerGroupImage}
              data-testid="ce-session-worker-group-image"
            />
          ) : null}
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
            <>
              <span>Admin add required</span>
              <span>
                Share this group link, then ask a session admin to add{' '}
                {participantAddress ? participantAddress : 'your passkey or wallet address'}. No invitation token is
                created.
              </span>
            </>
          )}
          <button
            type="button"
            className={styles.telegramSecondaryButton}
            onClick={() => void copyGroupLink(group.groupId)}
            aria-label={`Copy ${group.label} group link`}
          >
            Copy group link
          </button>
        </article>
      ))}
      {status === 'ready' && !overview.memberships.length && !availableGroups.length ? (
        <div className={styles.telegramListEmpty}>No visible Groups are configured.</div>
      ) : null}
    </section>
  );
};

export default WorkerGroupMembershipPanel;
