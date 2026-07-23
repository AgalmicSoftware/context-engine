import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import {
  joinWorkerGroup,
  leaveWorkerGroup,
  loadPublicWorkerGroups,
  loadWorkerGroupMembers,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupMember,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import WorkerGroupImage from '../Shared/WorkerGroupImage';
import sbtPageStyles from '../SBTs/SBTPage.module.scss';
import SbtPageRelevantInfo from '../SBTs/SbtPageRelevantInfo';
import sbtsPageStyles from '../SBTs/SBTsPage.module.scss';
import WorkerGroupCard from './WorkerGroupCard';
import { resolveWorkerGroupJoinWindowDisplay } from './workerGroupDisplayHelpers';
import { reconcileConfirmedWorkerGroupMembership } from './workerGroupMembershipProjection';
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
  const displayedAvailableGroups = membershipsOnly ? [] : availableGroups;
  const selectedMembership = overview.memberships.find((membership) => membership.group.groupId === selectedGroupId);
  const selectedGroup = selectedMembership?.group || availableGroups.find((group) => group.groupId === selectedGroupId);
  const canViewSelectedGroupMembers = Boolean(
    workerToken &&
    selectedGroup &&
    (selectedGroup.memberVisibility === 'session' ||
      (selectedGroup.memberVisibility === 'members' && selectedMembership)),
  );

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
      if (targetKeyRef.current !== mutationTargetKey || mutationIdRef.current !== mutationId) return;
      setViewState((current) => {
        if (current.targetKey !== mutationTargetKey) return current;
        return {
          ...current,
          overview: reconcileConfirmedWorkerGroupMembership({
            overview: current.overview,
            group,
            isMember: true,
            sessionSlug,
          }),
          status: 'ready',
          error: '',
        };
      });
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
  const openGroupDetails = (groupId: string) => {
    if (typeof window === 'undefined' || !sessionSlug) return;
    const link = new URL(buildWorkerGroupsPath({ sessionSlug, groupId }), window.location.origin);
    window.open(link.toString(), '_blank', 'noopener,noreferrer');
  };
  const renderMembershipAction = (group: WorkerGroup, isMember: boolean) => {
    if (isMember) {
      const isLeaving = membershipAction.groupId === group.groupId && membershipAction.action === 'leave';
      return (
        <button
          type="button"
          className={styles.workerGroupCardLeaveButton}
          disabled={isLeaving}
          aria-label={`Leave ${group.label}`}
          onClick={() => void handleLeave(group)}
        >
          {isLeaving ? 'Leaving…' : 'Leave'}
        </button>
      );
    }
    const joinEnded = group.joinMode === 'open' && groupJoinHasEnded(group);
    if (joinEnded) {
      return <span className={styles.workerGroupCardInactiveStatus}>Join period ended</span>;
    }
    if (group.joinMode === 'open' && workerToken) {
      const isJoining = membershipAction.groupId === group.groupId && membershipAction.action === 'join';
      return (
        <button
          type="button"
          className={styles.workerGroupCardPrimaryButton}
          disabled={isJoining}
          aria-label={`Join ${group.label}`}
          onClick={() => void handleJoin(group)}
        >
          {isJoining ? 'Joining…' : 'Join'}
        </button>
      );
    }
    if (group.joinMode === 'open') {
      return (
        <button
          type="button"
          className={styles.workerGroupCardPrimaryButton}
          aria-label={`Sign in to join ${group.label}`}
          onClick={onSignIn}
        >
          Join
        </button>
      );
    }
    return <span className={styles.workerGroupCardInactiveStatus}>Admin add required</span>;
  };

  if (!canReadGroups) {
    return (
      <section className={styles.telegramListPanel} data-testid="ce-session-worker-groups">
        <div className={styles.telegramListHeader}>Groups</div>
        <div className={styles.telegramListEmpty}>Groups are not included in this credential.</div>
      </section>
    );
  }

  if (selectedGroupId) {
    return (
      <section className={styles.workerGroupsListPanel} data-testid="ce-session-worker-groups">
        {status === 'loading' ? <div className={styles.telegramListEmpty}>Loading group…</div> : null}
        {error ? <div className={styles.telegramListEmpty}>{error}</div> : null}
        {membershipStatus ? (
          <div className={styles.telegramReportApprox} role="status">
            {membershipStatus}
          </div>
        ) : null}
        {shareStatus ? <div className={styles.telegramReportApprox}>{shareStatus}</div> : null}
        {selectedGroup ? (
          <WorkerGroupDetailView
            canViewMembers={canViewSelectedGroupMembers}
            copyGroupLink={copyGroupLink}
            fetchImpl={fetchImpl}
            group={selectedGroup}
            isActive={selectedGroup.joinMode === 'open' && !groupJoinHasEnded(selectedGroup)}
            memberListState={activeMemberListState}
            sessionConfig={sessionConfig}
            sessionSlug={sessionSlug}
            workerToken={workerToken}
            workerUrl={workerUrl}
            memberCount={activeMemberListState.memberCount ?? selectedMembership?.memberCount}
            onCloseMembers={handleCloseMembers}
            onLoadMoreMembers={handleLoadMoreMembers}
            onOpenMembers={handleOpenMembers}
          >
            {renderMembershipAction(selectedGroup, Boolean(selectedMembership))}
          </WorkerGroupDetailView>
        ) : null}
        {status === 'ready' && !selectedGroup ? (
          <div className={styles.workerGroupDetailNotFound}>
            <a className={sbtPageStyles.backButton} href={buildWorkerGroupsPath({ sessionSlug })}>
              ← Back to Groups
            </a>
            <p>This group is not visible or no longer exists.</p>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={styles.workerGroupsListPanel} data-testid="ce-session-worker-groups">
      {showListHeader ? (
        <div className={styles.telegramListHeader}>
          <span>Groups</span>
          <button type="button" className={styles.telegramSecondaryButton} onClick={() => void reload()}>
            Refresh
          </button>
        </div>
      ) : null}
      {!anonymousDiscoveryActive ? (
        <p className={styles.telegramReportApprox}>
          These worker-managed access groups control session authorization. They are separate from research profile
          categories.
        </p>
      ) : null}
      {status === 'loading' ? <div className={styles.telegramListEmpty}>Loading access groups…</div> : null}
      {error ? <div className={styles.telegramListEmpty}>{error}</div> : null}
      {overview.memberships.map((membership) => (
        <article key={membership.group.groupId} className={styles.telegramPileFrame}>
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
        </article>
      ))}
      {availableGroups.map((group) => (
        <article key={group.groupId} className={styles.telegramPileFrame}>
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
              {renderMembershipAction(membership.group, true)}
            </WorkerGroupCard>
          ))}
          {displayedAvailableGroups.map((group) => (
            <WorkerGroupCard
              key={group.groupId}
              copyGroupLink={copyGroupLink}
              fetchImpl={fetchImpl}
              group={group}
              isActive={group.joinMode === 'open' && !groupJoinHasEnded(group)}
              onOpenDetails={openGroupDetails}
              showDescription={showDescriptions}
              sessionConfig={sessionConfig}
              sessionSlug={sessionSlug}
              workerToken={workerToken}
              workerUrl={workerUrl}
            >
              {renderMembershipAction(group, false)}
            </WorkerGroupCard>
          ))}
        </div>
      ) : null}
      {status === 'ready' && !overview.memberships.length && !displayedAvailableGroups.length ? (
        <div className={styles.telegramListEmpty}>
          {membershipsOnly ? 'No Groups joined yet.' : 'No visible Groups are configured.'}
        </div>
      ) : null}
    </section>
  );
};

export default WorkerGroupMembershipPanel;
