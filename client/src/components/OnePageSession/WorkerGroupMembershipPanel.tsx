import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
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
  sessionId?: string;
  sessionSlug?: string;
};

const emptyOverview: WorkerGroupOverview = { groups: [], memberships: [] };
type WorkerGroupViewState = {
  targetKey: string;
  overview: WorkerGroupOverview;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
};

const emptyViewState = (targetKey: string): WorkerGroupViewState => ({
  targetKey,
  overview: emptyOverview,
  status: 'idle',
  error: '',
});

const WorkerGroupMembershipPanel = ({
  envelope,
  workerUrl: workerUrlProp,
  workerToken: workerTokenProp,
  canReadGroups: canReadGroupsProp,
  refreshNonce = 0,
  fetchImpl = fetch,
  participantAddress = '',
  sessionId: sessionIdProp = '',
  sessionSlug: sessionSlugProp = '',
}: WorkerGroupMembershipPanelProps) => {
  const canReadGroups = canReadGroupsProp ?? envelope?.capabilities?.readGroups === true;
  const workerUrl = normalizeWorkerUrl(workerUrlProp || envelope?.workerUrl || '');
  const workerToken = workerTokenProp || envelope?.workerCredential?.token || '';
  const sessionId = normalizeWorkerCanonicalSessionIdHex(sessionIdProp || envelope?.sessionId || '');
  const sessionSlug = canonicalizeSessionSlug(sessionSlugProp || envelope?.sessionSlug || '');
  const targetKey = `${sessionId}\n${sessionSlug}\n${workerUrl}\n${workerToken}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const requestIdRef = useRef(0);
  const mutationIdRef = useRef(0);
  const [viewState, setViewState] = useState<WorkerGroupViewState>(() => emptyViewState(targetKey));
  const [joiningState, setJoiningState] = useState({ targetKey, groupId: '' });
  const [shareState, setShareState] = useState({ targetKey, status: '' });
  const activeViewState = viewState.targetKey === targetKey ? viewState : emptyViewState(targetKey);
  const overview = activeViewState.overview;
  const status = activeViewState.status;
  const error = activeViewState.error;
  const joiningGroupId = joiningState.targetKey === targetKey ? joiningState.groupId : '';
  const shareStatus = shareState.targetKey === targetKey ? shareState.status : '';

  const reload = useCallback(async () => {
    const requestTargetKey = targetKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!canReadGroups || !workerUrl || !workerToken || !sessionId || !sessionSlug) {
      setViewState(emptyViewState(requestTargetKey));
      return;
    }
    setViewState({
      targetKey: requestTargetKey,
      overview: emptyOverview,
      status: 'loading',
      error: '',
    });
    try {
      const next = await loadWorkerGroupOverview({
        workerUrl,
        credentialToken: workerToken,
        sessionId,
        sessionSlug,
        fetchImpl,
      });
      if (targetKeyRef.current !== requestTargetKey || requestIdRef.current !== requestId) return;
      setViewState({
        targetKey: requestTargetKey,
        overview: next,
        status: 'ready',
        error: '',
      });
    } catch (loadError) {
      if (targetKeyRef.current !== requestTargetKey || requestIdRef.current !== requestId) return;
      setViewState({
        targetKey: requestTargetKey,
        overview: emptyOverview,
        status: 'error',
        error: loadError instanceof Error ? loadError.message : 'worker_group_load_failed',
      });
    }
  }, [canReadGroups, fetchImpl, sessionId, sessionSlug, targetKey, workerToken, workerUrl]);

  useEffect(() => {
    setJoiningState({ targetKey, groupId: '' });
    setShareState({ targetKey, status: '' });
    void reload();
    return () => {
      requestIdRef.current += 1;
      mutationIdRef.current += 1;
    };
  }, [refreshNonce, reload, targetKey]);

  const membershipIds = useMemo(
    () => new Set(overview.memberships.map((membership) => membership.group.groupId)),
    [overview.memberships],
  );
  const availableGroups = overview.groups.filter((group) => !membershipIds.has(group.groupId));

  const handleJoin = async (groupId: string) => {
    const mutationTargetKey = targetKey;
    const mutationId = mutationIdRef.current + 1;
    mutationIdRef.current = mutationId;
    setJoiningState({ targetKey: mutationTargetKey, groupId });
    setViewState((current) => ({
      ...(current.targetKey === mutationTargetKey ? current : emptyViewState(mutationTargetKey)),
      error: '',
    }));
    try {
      await joinWorkerGroup({
        workerUrl,
        credentialToken: workerToken,
        sessionId,
        sessionSlug,
        groupId,
        fetchImpl,
      });
      if (targetKeyRef.current !== mutationTargetKey || mutationIdRef.current !== mutationId) return;
      await reload();
    } catch (joinError) {
      if (targetKeyRef.current !== mutationTargetKey || mutationIdRef.current !== mutationId) return;
      setViewState((current) => ({
        ...(current.targetKey === mutationTargetKey ? current : emptyViewState(mutationTargetKey)),
        status: 'error',
        error: joinError instanceof Error ? joinError.message : 'worker_group_join_failed',
      }));
    } finally {
      if (targetKeyRef.current === mutationTargetKey && mutationIdRef.current === mutationId) {
        setJoiningState({ targetKey: mutationTargetKey, groupId: '' });
      }
    }
  };
  const copyGroupLink = async (groupId: string) => {
    const shareTargetKey = targetKey;
    try {
      if (typeof window === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      if (!sessionSlug) throw new Error('Session slug unavailable');
      const currentUrl = new URL(window.location.href);
      const link = new URL(buildPublicRoute(`/session/${encodeURIComponent(sessionSlug)}`), currentUrl.origin);
      const canonicalWorkerUrl = new URL(workerUrl);
      if (!['https:', 'http:'].includes(canonicalWorkerUrl.protocol)) throw new Error('Invalid Worker URL');
      link.searchParams.set('worker', canonicalWorkerUrl.origin);
      link.hash = `group-${encodeURIComponent(groupId)}`;
      await navigator.clipboard.writeText(link.toString());
      if (targetKeyRef.current !== shareTargetKey) return;
      setShareState({
        targetKey: shareTargetKey,
        status: 'Group link copied. It contains no invitation token or credential.',
      });
    } catch {
      if (targetKeyRef.current !== shareTargetKey) return;
      setShareState({
        targetKey: shareTargetKey,
        status: 'Could not copy the group link. Copy the current session URL manually.',
      });
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
          <span>Leaving is not supported by the current Worker group policy; ask an admin to remove membership.</span>
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
