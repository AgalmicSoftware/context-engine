import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfinity, faLink, faSpinner, faSyncAlt, faTimes, faUser } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { generateBlockieDataUrl } from '../../utilities/ui/blockieAvatars.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { buildWorkerGroupsPath } from '../../utilities/worker/workerGroupRoutes.js';
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
import { useWorkerGroupMembershipMutations } from './useWorkerGroupMembershipMutations';
import {
  buildWorkerGroupMembershipIdentity,
  projectWorkerGroupMembership,
  projectWorkerGroupMemberships,
} from '../../domains/membership/membershipProjection';
import styles from './OnePageSession.module.scss';

export type WorkerGroupMembershipPanelProps = {
  envelope?: AgentClientLoginEnvelope;
  workerUrl?: string;
  workerToken?: string;
  canReadGroups?: boolean;
  refreshNonce?: number;
  fetchImpl?: typeof fetch;
  participantAddress?: string;
  sessionConfig?: unknown;
  sessionId?: string;
  sessionSlug?: string;
  allowAnonymousGroupDiscovery?: boolean;
  onSignIn?: () => void;
  selectedGroupId?: string;
  showDescriptions?: boolean;
  showListHeader?: boolean;
  membershipsOnly?: boolean;
};

const emptyOverview: WorkerGroupOverview = { groups: [], memberships: [] };
type WorkerGroupViewState = {
  targetKey: string;
  overview: WorkerGroupOverview;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
};

type WorkerGroupMemberListState = {
  targetKey: string;
  groupId: string;
  isOpen: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  members: WorkerGroupMember[];
  memberCount?: number;
  nextCursor: string;
};

const emptyViewState = (targetKey: string): WorkerGroupViewState => ({
  targetKey,
  overview: emptyOverview,
  status: 'idle',
  error: '',
});

const emptyMemberListState = (targetKey: string, groupId = ''): WorkerGroupMemberListState => ({
  targetKey,
  groupId,
  isOpen: false,
  status: 'idle',
  error: '',
  members: [],
  nextCursor: '',
});

const groupJoinHasEnded = (group: WorkerGroup): boolean =>
  Boolean(group.joinEndsAt && Date.parse(group.joinEndsAt) <= Date.now());

const toSafeExternalUrl = (value: unknown): string => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const workerGroupPrincipalIdentity = (member: WorkerGroupMember): string => {
  const principal = member.principal;
  if (!principal) return '';
  if (principal.kind === 'evm_address' || principal.kind === 'passkey_account') return principal.address;
  if (principal.kind === 'telegram') return principal.principalId;
  return principal.kind === 'agent' ? principal.grantId : '';
};

const workerGroupPrincipalKindLabel = (member: WorkerGroupMember): string => {
  const kind = member.principal?.kind;
  if (kind === 'passkey_account') return 'Passkey';
  if (kind === 'telegram') return 'Telegram';
  if (kind === 'agent') return 'Agent';
  return '';
};

type WorkerGroupMembersModalProps = {
  error: string;
  group: WorkerGroup;
  isOpen: boolean;
  memberCount?: number;
  members: WorkerGroupMember[];
  nextCursor: string;
  onClose: () => void;
  onLoadMore: () => void;
  status: WorkerGroupMemberListState['status'];
};

const WorkerGroupMembersModal = ({
  error,
  group,
  isOpen,
  memberCount,
  members,
  nextCursor,
  onClose,
  onLoadMore,
  status,
}: WorkerGroupMembersModalProps) => {
  const closeButton = (
    <button type="button" className={sbtPageStyles.modalCloseButton} onClick={onClose} aria-label="Close members">
      <FontAwesomeIcon icon={faTimes} />
    </button>
  );
  const showCount = Number.isSafeInteger(memberCount) && Number(memberCount) >= 0;

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      className={sbtPageStyles.modal}
      contentClassName={sbtPageStyles.modalContent}
      size="lg"
      centered
    >
      <ModalHeader toggle={onClose} close={closeButton} className={sbtPageStyles.modalHeader}>
        <div className={sbtPageStyles.modalTitleStack}>
          <div className={sbtPageStyles.modalTitleRow}>
            <span className={sbtPageStyles.modalTitle}>
              {group.label} members
              {showCount ? <span className={sbtPageStyles.modalTitleCount}>({memberCount})</span> : null}
            </span>
          </div>
        </div>
      </ModalHeader>
      <ModalBody className={sbtPageStyles.modalBody}>
        <div className={sbtPageStyles.userList}>
          {status === 'loading' && members.length === 0 ? (
            <div className={sbtPageStyles.emptyState}>
              <FontAwesomeIcon icon={faSpinner} spin size="2x" aria-label="Loading members" />
            </div>
          ) : null}
          {status === 'error' ? (
            <div className={sbtPageStyles.emptyState}>Members could not be loaded ({error}).</div>
          ) : null}
          {status === 'ready' && members.length === 0 ? (
            <div className={sbtPageStyles.emptyState}>No members found.</div>
          ) : null}
          {members.map((member) => {
            const identity = workerGroupPrincipalIdentity(member);
            const kindLabel = workerGroupPrincipalKindLabel(member);
            const isAddress = member.principal?.kind === 'evm_address' || member.principal?.kind === 'passkey_account';
            const blockieUrl = generateBlockieDataUrl(
              `${member.principal?.kind || 'member'}:${identity}`.toLowerCase(),
              8,
              4,
            );
            return (
              <div key={`${member.principal?.kind || 'member'}:${identity}`} className={sbtPageStyles.userItem}>
                <div className={sbtPageStyles.userItemLeft}>
                  {blockieUrl ? <img src={blockieUrl} alt="" className={sbtPageStyles.userBlockie} /> : null}
                  {isAddress ? (
                    <a
                      href={buildPublicRoute(`/u/${identity}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={sbtPageStyles.userAddressLink}
                      title={identity}
                    >
                      {kindLabel ? `${kindLabel} · ` : ''}
                      {getShortenedAddress(identity, false)}
                    </a>
                  ) : (
                    <span className={sbtPageStyles.userAddressLink} title={identity}>
                      {kindLabel ? `${kindLabel} · ` : ''}
                      {identity}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {nextCursor ? (
            <button type="button" onClick={onLoadMore} disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </div>
      </ModalBody>
    </Modal>
  );
};

type WorkerGroupDetailViewProps = {
  canViewMembers: boolean;
  children: React.ReactNode;
  copyGroupLink: (groupId: string) => Promise<void>;
  fetchImpl: typeof fetch;
  group: WorkerGroup;
  isActive: boolean;
  memberListState: WorkerGroupMemberListState;
  memberCount?: number;
  onCloseMembers: () => void;
  onLoadMoreMembers: () => void;
  onOpenMembers: () => void;
  sessionConfig: unknown;
  sessionSlug: string;
  workerToken: string;
  workerUrl: string;
};

const WorkerGroupDetailView = ({
  canViewMembers,
  children,
  copyGroupLink,
  fetchImpl,
  group,
  isActive,
  memberListState,
  memberCount,
  onCloseMembers,
  onLoadMoreMembers,
  onOpenMembers,
  sessionConfig,
  sessionSlug,
  workerToken,
  workerUrl,
}: WorkerGroupDetailViewProps) => {
  const safeGroupId = group.groupId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const titleId = `worker-group-detail-${safeGroupId}-title`;
  const descriptionId = group.description ? `worker-group-detail-${safeGroupId}-description` : undefined;
  const documentURLs = (group.documentURLs || []).map(toSafeExternalUrl).filter(Boolean);
  const [joinWindowNowMs, setJoinWindowNowMs] = useState(() => Date.now());
  const joinWindow = resolveWorkerGroupJoinWindowDisplay({
    joinEndsAt: group.joinEndsAt,
    nowMs: joinWindowNowMs,
  });
  const hasVisibleMemberCount = Number.isSafeInteger(memberCount) && Number(memberCount) >= 0;
  const hasRelevantInfo = documentURLs.length > 0 || Boolean(group.tags?.length);
  const memberLimitDisplay = group.memberLimit ? (
    group.memberLimit
  ) : (
    <span aria-label="Unlimited" title="Unlimited">
      <FontAwesomeIcon icon={faInfinity} />
    </span>
  );

  useEffect(() => {
    setJoinWindowNowMs(Date.now());
    const endMs = Date.parse(String(group.joinEndsAt || ''));
    if (!Number.isFinite(endMs) || endMs <= Date.now()) return undefined;
    const timer = window.setInterval(() => {
      const nextNowMs = Date.now();
      setJoinWindowNowMs(nextNowMs);
      if (nextNowMs >= endMs) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [group.joinEndsAt]);

  return (
    <div className={sbtPageStyles.sbtPage} data-testid="ce-worker-group-detail">
      <a className={sbtPageStyles.backButton} href={buildWorkerGroupsPath({ sessionSlug })}>
        ← Back to Groups
      </a>
      <article
        className={`${sbtPageStyles.sbtInfo} ${styles.workerGroupDetailCard}`}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className={sbtPageStyles.leftColumn}>
          <div className={sbtPageStyles.bookmarkIcon}>
            <span className={styles.workerGroupDetailStatus}>
              <span
                className={`${styles.workerGroupDetailStatusDot} ${
                  isActive ? styles.workerGroupDetailStatusDotOpen : styles.workerGroupDetailStatusDotClosed
                }`}
                aria-hidden="true"
              />
              {isActive ? 'Joining open' : 'Joining closed'}
            </span>
            <button
              type="button"
              className={sbtPageStyles.copyButton}
              onClick={() => void copyGroupLink(group.groupId)}
              aria-label={`Copy ${group.label} group link`}
              title="Copy group link"
            >
              <FontAwesomeIcon icon={faLink} />
            </button>
          </div>
          <div className={sbtPageStyles.image}>
            <div className={sbtPageStyles.imageWrapper}>
              {group.imageUrl ? (
                <WorkerGroupImage
                  src={group.imageUrl}
                  alt={group.label}
                  fetchImpl={fetchImpl}
                  sessionConfig={sessionConfig}
                  sessionSlug={sessionSlug}
                  testId="ce-worker-group-detail-image"
                  workerToken={workerToken}
                  workerUrl={workerUrl}
                />
              ) : (
                <div className={styles.workerGroupDetailImagePlaceholder} aria-hidden="true" />
              )}
            </div>
          </div>
          <div className={sbtPageStyles.description}>
            <h1 id={titleId}>{group.label}</h1>
            {group.description ? <p id={descriptionId}>{group.description}</p> : null}
          </div>
        </div>
        <div className={sbtPageStyles.rightColumn}>
          <section className={sbtPageStyles.statsSection}>
            <h2 className={`${sbtPageStyles.sectionHeader} ${styles.workerGroupDetailStaticHeader}`}>STATS</h2>
            <div className={sbtPageStyles.stats}>
              {hasVisibleMemberCount ? (
                <p>
                  <span className={sbtPageStyles.label}>Members:</span>
                  <span>
                    {memberCount} / {memberLimitDisplay}
                  </span>
                  {canViewMembers ? (
                    <button
                      type="button"
                      onClick={onOpenMembers}
                      className={sbtPageStyles.expandButton}
                      aria-label={`View ${group.label} members`}
                    >
                      <FontAwesomeIcon icon={faUser} />
                    </button>
                  ) : null}
                </p>
              ) : (
                <p>
                  <span className={sbtPageStyles.label}>Member limit:</span>
                  <span>{memberLimitDisplay}</span>
                  {canViewMembers ? (
                    <button
                      type="button"
                      onClick={onOpenMembers}
                      className={sbtPageStyles.expandButton}
                      aria-label={`View ${group.label} members`}
                    >
                      <FontAwesomeIcon icon={faUser} />
                    </button>
                  ) : null}
                </p>
              )}
              <p>
                <span className={sbtPageStyles.label}>
                  {joinWindow.status === 'expired' ? 'Joining expired:' : 'Joining ends:'}
                </span>
                {joinWindow.status === 'never' ? (
                  <span>
                    <FontAwesomeIcon icon={faInfinity} /> Never
                  </span>
                ) : joinWindow.status === 'active' ? (
                  <time dateTime={group.joinEndsAt} title={joinWindow.fullDateText}>
                    {joinWindow.countdownText}
                  </time>
                ) : (
                  <time dateTime={group.joinEndsAt}>{joinWindow.fullDateText}</time>
                )}
              </p>
              <p>
                <span className={sbtPageStyles.label}>Join policy:</span>
                <span>{group.joinMode === 'open' ? 'Open to participants' : 'Admin adds members'}</span>
              </p>
              <p>
                <span className={sbtPageStyles.label}>Member visibility:</span>
                <span>{group.memberVisibility.replace(/_/g, ' ')}</span>
              </p>
              {group.adminAddress ? (
                <p>
                  <span className={sbtPageStyles.label}>Admin:</span>
                  <span className={styles.workerGroupDetailAddress}>{group.adminAddress}</span>
                </p>
              ) : null}
            </div>
          </section>
          <section className={sbtPageStyles.actionsSection}>
            <h2 className={`${sbtPageStyles.sectionHeader} ${styles.workerGroupDetailStaticHeader}`}>ACTIONS</h2>
            <div className={`${sbtPageStyles.actions} ${styles.workerGroupDetailActions}`}>{children}</div>
          </section>
          {hasRelevantInfo ? (
            <section className={sbtPageStyles.moreDetailsSection}>
              <h2 className={`${sbtPageStyles.sectionHeader} ${styles.workerGroupDetailStaticHeader}`}>MORE</h2>
              <SbtPageRelevantInfo
                documentIDHashes={[]}
                documentURLs={documentURLs}
                documentUrlsArePublic={true}
                introText="Relevant documents and tags for this group."
                onOpenEncryptedDoc={() => undefined}
                shouldRenderDocumentIdHashes={false}
                shouldRenderDocumentUrls={documentURLs.length > 0}
                shouldRenderTags={Boolean(group.tags?.length)}
                tags={group.tags || []}
              />
            </section>
          ) : null}
        </div>
      </article>
      <WorkerGroupMembersModal
        error={memberListState.error}
        group={group}
        isOpen={memberListState.isOpen}
        memberCount={memberListState.memberCount ?? memberCount}
        members={memberListState.members}
        nextCursor={memberListState.nextCursor}
        onClose={onCloseMembers}
        onLoadMore={onLoadMoreMembers}
        status={memberListState.status}
      />
    </div>
  );
};

const WorkerGroupMembershipPanel = ({
  envelope,
  workerUrl: workerUrlProp,
  workerToken: workerTokenProp,
  canReadGroups: canReadGroupsProp,
  refreshNonce = 0,
  fetchImpl = fetch,
  sessionConfig = null,
  sessionId: sessionIdProp = '',
  sessionSlug: sessionSlugProp = '',
  allowAnonymousGroupDiscovery = false,
  onSignIn,
  selectedGroupId: selectedGroupIdProp = '',
  showDescriptions = true,
  showListHeader = true,
  membershipsOnly = false,
}: WorkerGroupMembershipPanelProps) => {
  const canReadGroups = canReadGroupsProp ?? envelope?.capabilities?.readGroups === true;
  const workerUrl = normalizeWorkerUrl(workerUrlProp || envelope?.workerUrl || '');
  const workerToken = workerTokenProp || envelope?.workerCredential?.token || '';
  const sessionId = normalizeWorkerCanonicalSessionIdHex(sessionIdProp || envelope?.sessionId || '');
  const sessionSlug = canonicalizeSessionSlug(sessionSlugProp || envelope?.sessionSlug || '');
  const selectedGroupId = String(selectedGroupIdProp || '').trim();
  const anonymousDiscoveryActive = allowAnonymousGroupDiscovery && !workerToken;
  const targetKey = `${sessionId}\n${sessionSlug}\n${workerUrl}\n${workerToken}\n${anonymousDiscoveryActive ? 'public' : 'private'}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const requestIdRef = useRef(0);
  const memberListRequestIdRef = useRef(0);
  const [viewState, setViewState] = useState<WorkerGroupViewState>(() => emptyViewState(targetKey));
  const [memberListState, setMemberListState] = useState<WorkerGroupMemberListState>(() =>
    emptyMemberListState(targetKey),
  );
  const { membershipActions, beginMembershipMutation, finishMembershipMutation, isMembershipMutationCurrent } =
    useWorkerGroupMembershipMutations(targetKey);
  const [membershipStatusState, setMembershipStatusState] = useState({ targetKey, status: '' });
  const [shareState, setShareState] = useState({ targetKey, status: '' });
  const activeViewState = viewState.targetKey === targetKey ? viewState : emptyViewState(targetKey);
  const overview = activeViewState.overview;
  const status = activeViewState.status;
  const error = activeViewState.error;
  const membershipStatus = membershipStatusState.targetKey === targetKey ? membershipStatusState.status : '';
  const shareStatus = shareState.targetKey === targetKey ? shareState.status : '';
  const activeMemberListState =
    memberListState.targetKey === targetKey ? memberListState : emptyMemberListState(targetKey, selectedGroupId);

  const reload = useCallback(async () => {
    const requestTargetKey = targetKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!canReadGroups || !workerUrl || (!workerToken && !anonymousDiscoveryActive) || !sessionId || !sessionSlug) {
      setViewState(emptyViewState(requestTargetKey));
      return;
    }
    setViewState((current) => {
      const base = current.targetKey === requestTargetKey ? current : emptyViewState(requestTargetKey);
      return {
        ...base,
        status: 'loading',
        error: '',
      };
    });
    try {
      const next = anonymousDiscoveryActive
        ? {
            groups: await loadPublicWorkerGroups({
              workerUrl,
              sessionId,
              sessionSlug,
              fetchImpl,
            }),
            memberships: [],
          }
        : await loadWorkerGroupOverview({
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
      setViewState((current) => {
        const base = current.targetKey === requestTargetKey ? current : emptyViewState(requestTargetKey);
        return {
          ...base,
          status: 'error',
          error: loadError instanceof Error ? loadError.message : 'worker_group_load_failed',
        };
      });
    }
  }, [anonymousDiscoveryActive, canReadGroups, fetchImpl, sessionId, sessionSlug, targetKey, workerToken, workerUrl]);

  useEffect(() => {
    setMembershipStatusState({ targetKey, status: '' });
    setShareState({ targetKey, status: '' });
    setMemberListState(emptyMemberListState(targetKey, selectedGroupId));
    void reload();
    return () => {
      requestIdRef.current += 1;
      memberListRequestIdRef.current += 1;
    };
  }, [refreshNonce, reload, selectedGroupId, targetKey]);

  const membershipIdentityKeys = useMemo(
    () => new Set(projectWorkerGroupMemberships(overview.memberships, sessionSlug).map(({ identity }) => identity.key)),
    [overview.memberships, sessionSlug],
  );
  const availableGroups = overview.groups.filter(
    (group) =>
      !membershipIdentityKeys.has(
        buildWorkerGroupMembershipIdentity({ groupId: group.groupId, sessionSlug: group.sessionSlug || sessionSlug })
          .key,
      ),
  );
  const displayedAvailableGroups = membershipsOnly ? [] : availableGroups;
  const selectedMembershipIdentity = buildWorkerGroupMembershipIdentity({ groupId: selectedGroupId, sessionSlug });
  const selectedMembership = selectedGroupId
    ? overview.memberships.find(
        (membership) =>
          projectWorkerGroupMembership({ membership, sessionSlug })?.identity.key === selectedMembershipIdentity.key,
      )
    : undefined;
  const selectedGroup = selectedMembership?.group || availableGroups.find((group) => group.groupId === selectedGroupId);
  const canViewSelectedGroupMembers = Boolean(
    workerToken &&
    selectedGroup &&
    (selectedGroup.memberVisibility === 'session' ||
      (selectedGroup.memberVisibility === 'members' && selectedMembership)),
  );

  const loadSelectedGroupMembers = useCallback(
    async ({ cursor = '', append = false }: { cursor?: string; append?: boolean } = {}) => {
      if (!selectedGroup || !canViewSelectedGroupMembers) return;
      const requestTargetKey = targetKey;
      const requestGroupId = selectedGroup.groupId;
      const requestId = memberListRequestIdRef.current + 1;
      memberListRequestIdRef.current = requestId;
      setMemberListState((current) => {
        const base =
          current.targetKey === requestTargetKey && current.groupId === requestGroupId
            ? current
            : emptyMemberListState(requestTargetKey, requestGroupId);
        return {
          ...base,
          isOpen: true,
          status: 'loading',
          error: '',
          ...(append ? {} : { members: [], memberCount: undefined, nextCursor: '' }),
        };
      });
      try {
        const page = await loadWorkerGroupMembers({
          workerUrl,
          credentialToken: workerToken,
          sessionId,
          sessionSlug,
          groupId: requestGroupId,
          cursor,
          limit: 100,
          fetchImpl,
        });
        if (targetKeyRef.current !== requestTargetKey || memberListRequestIdRef.current !== requestId) {
          return;
        }
        setMemberListState((current) => {
          if (current.targetKey !== requestTargetKey || current.groupId !== requestGroupId) return current;
          const combined = append ? [...current.members, ...page.members] : page.members;
          const uniqueMembers = new Map<string, WorkerGroupMember>();
          combined.forEach((member) => {
            const identity = workerGroupPrincipalIdentity(member);
            if (identity) uniqueMembers.set(`${member.principal?.kind || 'member'}:${identity}`, member);
          });
          return {
            ...current,
            isOpen: true,
            status: 'ready',
            error: '',
            members: [...uniqueMembers.values()],
            memberCount: page.memberCount,
            nextCursor: page.nextCursor,
          };
        });
      } catch (memberListError) {
        if (targetKeyRef.current !== requestTargetKey || memberListRequestIdRef.current !== requestId) {
          return;
        }
        setMemberListState((current) => ({
          ...(current.targetKey === requestTargetKey && current.groupId === requestGroupId
            ? current
            : emptyMemberListState(requestTargetKey, requestGroupId)),
          isOpen: true,
          status: 'error',
          error: memberListError instanceof Error ? memberListError.message : 'worker_group_member_list_failed',
        }));
      }
    },
    [canViewSelectedGroupMembers, fetchImpl, selectedGroup, sessionId, sessionSlug, targetKey, workerToken, workerUrl],
  );

  const handleOpenMembers = () => {
    if (!selectedGroup || !canViewSelectedGroupMembers) return;
    const current =
      activeMemberListState.groupId === selectedGroup.groupId
        ? activeMemberListState
        : emptyMemberListState(targetKey, selectedGroup.groupId);
    setMemberListState({ ...current, isOpen: true });
    if (current.status === 'idle' || current.status === 'error') {
      void loadSelectedGroupMembers();
    }
  };

  const handleCloseMembers = () => {
    setMemberListState((current) => (current.targetKey === targetKey ? { ...current, isOpen: false } : current));
  };

  const handleLoadMoreMembers = () => {
    if (!activeMemberListState.nextCursor || activeMemberListState.status === 'loading') return;
    void loadSelectedGroupMembers({ cursor: activeMemberListState.nextCursor, append: true });
  };
  const applyConfirmedMembership = ({
    mutationTargetKey,
    group,
    memberCount,
    isMember,
    retainGroup,
  }: {
    mutationTargetKey: string;
    group: WorkerGroup;
    memberCount?: number;
    isMember: boolean;
    retainGroup: boolean;
  }) => {
    setViewState((current) => {
      if (current.targetKey !== mutationTargetKey) return current;
      return {
        ...current,
        overview: reconcileConfirmedWorkerGroupMembership({
          overview: current.overview,
          group,
          memberCount,
          isMember,
          retainGroup,
          sessionSlug,
        }),
        status: 'ready',
        error: '',
      };
    });
  };
  const handleJoin = async (group: WorkerGroup) => {
    const mutationTargetKey = targetKey;
    const mutation = beginMembershipMutation(group.groupId, 'join');
    setMembershipStatusState({ targetKey: mutationTargetKey, status: '' });
    setViewState((current) => ({
      ...(current.targetKey === mutationTargetKey ? current : emptyViewState(mutationTargetKey)),
      error: '',
    }));
    try {
      const result = await joinWorkerGroup({
        workerUrl,
        credentialToken: workerToken,
        sessionId,
        sessionSlug,
        groupId: group.groupId,
        fetchImpl,
      });
      if (!isMembershipMutationCurrent(mutation)) return;
      requestIdRef.current += 1;
      setMembershipStatusState({ targetKey: mutationTargetKey, status: `Joined ${group.label}.` });
      memberListRequestIdRef.current += 1;
      setMemberListState(emptyMemberListState(mutationTargetKey, group.groupId));
      applyConfirmedMembership({
        mutationTargetKey,
        group: result.group as WorkerGroup,
        memberCount: Number(result.memberCount),
        isMember: true,
        retainGroup: true,
      });
    } catch (joinError) {
      if (!isMembershipMutationCurrent(mutation)) return;
      setViewState((current) => ({
        ...(current.targetKey === mutationTargetKey ? current : emptyViewState(mutationTargetKey)),
        status: 'error',
        error: joinError instanceof Error ? joinError.message : 'worker_group_join_failed',
      }));
    } finally {
      finishMembershipMutation(mutation);
    }
  };
  const handleLeave = async (group: WorkerGroup) => {
    const mutationTargetKey = targetKey;
    const mutation = beginMembershipMutation(group.groupId, 'leave');
    setMembershipStatusState({ targetKey: mutationTargetKey, status: '' });
    setViewState((current) => ({
      ...(current.targetKey === mutationTargetKey ? current : emptyViewState(mutationTargetKey)),
      error: '',
    }));
    try {
      const result = await leaveWorkerGroup({
        workerUrl,
        credentialToken: workerToken,
        sessionId,
        sessionSlug,
        groupId: group.groupId,
        fetchImpl,
      });
      if (!isMembershipMutationCurrent(mutation)) return;
      requestIdRef.current += 1;
      setMembershipStatusState({ targetKey: mutationTargetKey, status: `Left ${group.label}.` });
      memberListRequestIdRef.current += 1;
      setMemberListState(emptyMemberListState(mutationTargetKey, group.groupId));
      const retainedGroup = result.group as WorkerGroup | undefined;
      applyConfirmedMembership({
        mutationTargetKey,
        group: retainedGroup || group,
        ...(retainedGroup ? { memberCount: Number(result.memberCount) } : {}),
        isMember: false,
        retainGroup: Boolean(retainedGroup),
      });
    } catch (leaveError) {
      if (!isMembershipMutationCurrent(mutation)) return;
      setViewState((current) => ({
        ...(current.targetKey === mutationTargetKey ? current : emptyViewState(mutationTargetKey)),
        status: 'error',
        error: leaveError instanceof Error ? leaveError.message : 'worker_group_leave_failed',
      }));
    } finally {
      finishMembershipMutation(mutation);
    }
  };
  const copyGroupLink = async (groupId: string) => {
    const shareTargetKey = targetKey;
    try {
      if (typeof window === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      if (!sessionSlug) throw new Error('Session slug unavailable');
      const currentUrl = new URL(window.location.href);
      const link = new URL(buildWorkerGroupsPath({ sessionSlug, groupId }), currentUrl.origin);
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
    const membershipAction = membershipActions.get(group.groupId) || '';
    if (isMember) {
      const isLeaving = membershipAction === 'leave';
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
      const isJoining = membershipAction === 'join';
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
            memberCount={
              activeMemberListState.memberCount ?? selectedMembership?.memberCount ?? selectedGroup.memberCount
            }
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
        <div className={`${styles.telegramListHeader} ${styles.workerGroupsListActions}`}>
          <button
            type="button"
            className={styles.telegramIconButton}
            aria-label="Refresh groups"
            title="Refresh groups"
            onClick={() => void reload()}
          >
            <FontAwesomeIcon icon={faSyncAlt} />
          </button>
        </div>
      ) : null}
      {status === 'loading' ? <div className={styles.telegramListEmpty}>Loading groups…</div> : null}
      {error ? <div className={styles.telegramListEmpty}>{error}</div> : null}
      {membershipStatus ? (
        <div className={styles.telegramReportApprox} role="status">
          {membershipStatus}
        </div>
      ) : null}
      {shareStatus ? <div className={styles.telegramReportApprox}>{shareStatus}</div> : null}
      {overview.memberships.length || displayedAvailableGroups.length ? (
        <div className={`${sbtsPageStyles.sbtGrid} ${styles.workerGroupCardGrid}`}>
          {overview.memberships.map((membership) => (
            <WorkerGroupCard
              key={membership.group.groupId}
              copyGroupLink={copyGroupLink}
              fetchImpl={fetchImpl}
              group={membership.group}
              isActive={membership.group.joinMode === 'open' && !groupJoinHasEnded(membership.group)}
              onOpenDetails={openGroupDetails}
              showDescription={showDescriptions}
              sessionConfig={sessionConfig}
              sessionSlug={sessionSlug}
              workerToken={workerToken}
              workerUrl={workerUrl}
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
