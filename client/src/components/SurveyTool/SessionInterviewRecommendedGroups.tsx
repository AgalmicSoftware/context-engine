import { clearWorkerGroupAutoJoinCancellation } from '../../domains/worker/workerGroupAutoJoinPreference';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import { buildTokenCacheKey, readScopedTokenCache } from '../../utilities/worker/workerAuthTokenCache';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import {
  getWorkerSessionToken,
  joinWorkerGroup,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { normalizeInterviewGroupCandidates } from './sessionInterviewGroupRecommendations';
import SessionInterviewReviewSection from './SessionInterviewReviewSection';
import styles from './SurveyTool.module.scss';

type UnknownRecord = Record<string, unknown>;

type GroupRecommendationStatus = 'idle' | 'loading' | 'ready' | 'error';
type JoinStatus = 'idle' | 'waiting-login' | 'joining' | 'joined' | 'error';

export type SessionInterviewGroupRecommendation = {
  groupId: string;
  reason?: string;
  evidence?: string;
  confidence?: number;
};

export type SessionInterviewRecommendedGroupsProps = {
  recommendations?: SessionInterviewGroupRecommendation[];
  account?: unknown;
  provider?: unknown;
  network?: unknown;
  loginComplete?: boolean;
  loginModalToggled?: boolean;
  toggleLoginModal?: (open?: boolean) => void;
  sessionConfig?: unknown;
  sessionSlug?: string;
  workerUrl?: string;
  fetchImpl?: typeof fetch;
  onGroupsChanged?: () => void;
};

type RecommendationGroupView = Pick<
  WorkerGroup,
  | 'groupId'
  | 'sessionSlug'
  | 'label'
  | 'description'
  | 'joinMode'
  | 'memberVisibility'
  | 'joinEndsAt'
  | 'memberLimit'
  | 'memberCount'
>;

type RecommendationView = {
  group: RecommendationGroupView;
  reason: string;
  evidence: string;
};

type GroupRecommendationViewState = {
  targetKey: string;
  overview: WorkerGroupOverview;
  status: GroupRecommendationStatus;
  error: string;
};

type JoinState = {
  targetKey: string;
  groupId: string;
  status: JoinStatus;
  error: string;
};

type JoinedGroupState = {
  targetKey: string;
  account: string;
  groupIds: string[];
};

const emptyOverview: WorkerGroupOverview = { groups: [], memberships: [] };

const emptyViewState = (targetKey: string): GroupRecommendationViewState => ({
  targetKey,
  overview: emptyOverview,
  status: 'idle',
  error: '',
});

const emptyJoinState = (targetKey: string): JoinState => ({
  targetKey,
  groupId: '',
  status: 'idle',
  error: '',
});

const emptyJoinedGroupState = (targetKey: string, account: string): JoinedGroupState => ({
  targetKey,
  account,
  groupIds: [],
});

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toText = (value: unknown, maxLength = 280): string =>
  String(value ?? '')
    .trim()
    .slice(0, maxLength);

const normalizeAddress = (value: unknown): string => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(text) ? text : '';
};

const resolveChainId = (network: unknown, sessionConfig: unknown): unknown => {
  const networkRecord = toRecord(network);
  const config = toRecord(sessionConfig);
  return networkRecord.id || networkRecord.chainId || config.networkChainId || 1;
};

const formatJoinError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';
  if (message === 'This group is no longer available to join.') return message;
  if (message.includes('worker_group_member_cap_exceeded')) return 'This group is full.';
  if (message.includes('worker_group_join_ended')) return 'This group is closed.';
  if (
    message.includes('worker_group_join_denied') ||
    message.includes('worker_group_authorization_invalid') ||
    message.includes('worker_group_credential_missing')
  ) {
    return 'Log in again to join this group.';
  }
  return 'Could not join this group. Please try again.';
};

const normalizeRecommendations = (
  recommendations: SessionInterviewGroupRecommendation[] = [],
): SessionInterviewGroupRecommendation[] => {
  const seen = new Set<string>();
  return recommendations
    .map((recommendation) => ({
      groupId: toText(recommendation?.groupId, 80),
      reason: toText(recommendation?.reason, 240),
      evidence: toText(recommendation?.evidence, 240),
      confidence: recommendation?.confidence,
    }))
    .filter((recommendation) => {
      if (!recommendation.groupId || seen.has(recommendation.groupId)) return false;
      seen.add(recommendation.groupId);
      return true;
    })
    .slice(0, 6);
};

const membershipGroupIds = (overview: WorkerGroupOverview, sessionSlug: string): Set<string> => {
  const joined = new Set<string>();
  overview.memberships.forEach((membership) => {
    const group = membership.group;
    if (canonicalizeSessionSlug(group.sessionSlug || sessionSlug) === sessionSlug) {
      joined.add(group.groupId);
    }
  });
  return joined;
};

const buildRecommendationViews = (
  overview: WorkerGroupOverview,
  recommendations: SessionInterviewGroupRecommendation[],
  sessionSlug: string,
): RecommendationView[] => {
  const byGroupId = new Map(recommendations.map((recommendation) => [recommendation.groupId, recommendation]));
  const eligible = normalizeInterviewGroupCandidates({
    groups: overview.groups,
    memberships: overview.memberships,
    source: overview.memberships.length ? 'authenticated' : 'public',
  });
  return eligible
    .filter((group) => byGroupId.has(group.groupId))
    .slice(0, 6)
    .map((group) => {
      const recommendation = byGroupId.get(group.groupId);
      return {
        group,
        reason: recommendation?.reason || 'Suggested from the interview review.',
        evidence: recommendation?.evidence || '',
      };
    });
};

const usePreviousBoolean = (value: boolean): boolean => {
  const previousRef = useRef(value);
  useEffect(() => {
    previousRef.current = value;
  }, [value]);
  return previousRef.current;
};

export function SessionInterviewRecommendedGroups({
  recommendations = [],
  account,
  provider,
  network,
  loginComplete = false,
  loginModalToggled = false,
  toggleLoginModal,
  sessionConfig,
  sessionSlug: sessionSlugProp = '',
  workerUrl: workerUrlProp = '',
  fetchImpl = fetch,
  onGroupsChanged,
}: SessionInterviewRecommendedGroupsProps) {
  const normalizedRecommendations = useMemo(() => normalizeRecommendations(recommendations), [recommendations]);
  const recommendedIdsKey = normalizedRecommendations
    .map((recommendation) =>
      [recommendation.groupId, recommendation.reason || '', recommendation.evidence || ''].join('\u0000'),
    )
    .join('|');
  const normalizedAccount = normalizeAddress(account);
  const config = toRecord(sessionConfig);
  const sessionSlug = canonicalizeSessionSlug(sessionSlugProp || config.slug);
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  const workerUrl = normalizeWorkerUrl(workerUrlProp);
  const authenticated = Boolean(loginComplete && normalizedAccount);
  const targetKey = `${sessionId}\n${sessionSlug}\n${workerUrl}\n${recommendedIdsKey}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const authIdentityRef = useRef(normalizedAccount);
  authIdentityRef.current = normalizedAccount;
  const requestIdRef = useRef(0);
  const joinRequestIdRef = useRef(0);
  const loginOpenedForJoinRef = useRef(false);
  const previousLoginModalToggled = usePreviousBoolean(Boolean(loginModalToggled));
  const [viewState, setViewState] = useState<GroupRecommendationViewState>(() => emptyViewState(targetKey));
  const [joinState, setJoinState] = useState<JoinState>(() => emptyJoinState(targetKey));
  const [joinedGroupState, setJoinedGroupState] = useState<JoinedGroupState>(() =>
    emptyJoinedGroupState(targetKey, normalizedAccount),
  );
  const activeViewState = viewState.targetKey === targetKey ? viewState : emptyViewState(targetKey);
  const activeJoinState = joinState.targetKey === targetKey ? joinState : emptyJoinState(targetKey);
  const activeJoinedGroupState =
    joinedGroupState.targetKey === targetKey && joinedGroupState.account === normalizedAccount
      ? joinedGroupState
      : emptyJoinedGroupState(targetKey, normalizedAccount);
  const activeJoinedGroupIds = new Set(activeJoinedGroupState.groupIds);
  const canLoadCatalog = Boolean(workerUrl && sessionId && sessionSlug && normalizedRecommendations.length);

  const loadCatalog = useCallback(async () => {
    const requestTargetKey = targetKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!canLoadCatalog) {
      setViewState(emptyViewState(requestTargetKey));
      return;
    }
    setViewState((current) => ({
      ...(current.targetKey === requestTargetKey ? current : emptyViewState(requestTargetKey)),
      status: 'loading',
      error: '',
    }));
    try {
      const cacheKey = authenticated
        ? buildTokenCacheKey({ workerUrl, slug: sessionSlug, sessionId, address: normalizedAccount })
        : '';
      const cached = cacheKey
        ? readScopedTokenCache(cacheKey, { workerUrl, sessionSlug, sessionId, address: normalizedAccount })
        : null;
      const overview =
        cached?.ok && cached.token
          ? await loadWorkerGroupOverview({
              workerUrl,
              credentialToken: cached.token,
              sessionId,
              sessionSlug,
              fetchImpl,
            })
          : {
              groups: await loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug, fetchImpl }),
              memberships: [],
            };
      if (targetKeyRef.current !== requestTargetKey || requestIdRef.current !== requestId) return;
      setViewState({ targetKey: requestTargetKey, overview, status: 'ready', error: '' });
    } catch (error) {
      if (targetKeyRef.current !== requestTargetKey || requestIdRef.current !== requestId) return;
      setViewState({
        ...emptyViewState(requestTargetKey),
        status: 'error',
        error: error instanceof Error ? error.message : 'worker_group_recommendations_unavailable',
      });
    }
  }, [authenticated, canLoadCatalog, fetchImpl, normalizedAccount, sessionId, sessionSlug, targetKey, workerUrl]);

  useEffect(() => {
    setJoinState(emptyJoinState(targetKey));
    setJoinedGroupState(emptyJoinedGroupState(targetKey, normalizedAccount));
    void loadCatalog();
    return () => {
      requestIdRef.current += 1;
      joinRequestIdRef.current += 1;
    };
  }, [loadCatalog, normalizedAccount, targetKey]);

  const recommendationViews = useMemo(
    () => buildRecommendationViews(activeViewState.overview, normalizedRecommendations, sessionSlug),
    [activeViewState.overview, normalizedRecommendations, sessionSlug],
  );

  const joinRecommendedGroup = useCallback(
    async (groupId: string) => {
      const requestTargetKey = targetKey;
      const requestId = joinRequestIdRef.current + 1;
      joinRequestIdRef.current = requestId;
      if (!authenticated) {
        loginOpenedForJoinRef.current = true;
        setJoinState({ targetKey: requestTargetKey, groupId, status: 'waiting-login', error: '' });
        toggleLoginModal?.(true);
        return;
      }
      setJoinState({ targetKey: requestTargetKey, groupId, status: 'joining', error: '' });
      if (loginOpenedForJoinRef.current) {
        loginOpenedForJoinRef.current = false;
        toggleLoginModal?.(false);
      }
      try {
        const requestAccount = normalizedAccount;
        const token = await getWorkerSessionToken({
          sessionSlug,
          sessionConfig,
          workerUrl,
          context: { account, providerLike: provider, chainId: resolveChainId(network, sessionConfig) },
        });
        if (authIdentityRef.current !== requestAccount) return;
        const overview = await loadWorkerGroupOverview({
          workerUrl,
          credentialToken: token,
          sessionId,
          sessionSlug,
          fetchImpl,
        });
        if (
          targetKeyRef.current !== requestTargetKey ||
          joinRequestIdRef.current !== requestId ||
          authIdentityRef.current !== requestAccount
        ) {
          return;
        }
        clearWorkerGroupAutoJoinCancellation({ workerUrl, sessionSlug, sessionId, groupId, account: requestAccount });
        const joined = membershipGroupIds(overview, sessionSlug).has(groupId);
        if (joined) {
          setJoinedGroupState((current) => ({
            targetKey: requestTargetKey,
            account: requestAccount,
            groupIds: Array.from(
              new Set([...(current.targetKey === requestTargetKey ? current.groupIds : []), groupId]),
            ),
          }));
          setJoinState(emptyJoinState(requestTargetKey));
          if (loginOpenedForJoinRef.current) {
            loginOpenedForJoinRef.current = false;
            toggleLoginModal?.(false);
          }
          return;
        }
        const allowed = buildRecommendationViews(overview, normalizedRecommendations, sessionSlug).some(
          (view) => view.group.groupId === groupId,
        );
        if (!allowed) throw new Error('This group is no longer available to join.');
        await joinWorkerGroup({
          workerUrl,
          credentialToken: token,
          sessionId,
          sessionSlug,
          groupId,
          fetchImpl,
        });
        if (
          targetKeyRef.current !== requestTargetKey ||
          joinRequestIdRef.current !== requestId ||
          authIdentityRef.current !== requestAccount
        ) {
          return;
        }
        setViewState({ targetKey: requestTargetKey, overview, status: 'ready', error: '' });
        setJoinedGroupState((current) => ({
          targetKey: requestTargetKey,
          account: requestAccount,
          groupIds: Array.from(new Set([...(current.targetKey === requestTargetKey ? current.groupIds : []), groupId])),
        }));
        setJoinState(emptyJoinState(requestTargetKey));
        if (loginOpenedForJoinRef.current) {
          loginOpenedForJoinRef.current = false;
          toggleLoginModal?.(false);
        }
        dispatchWorkerGroupsChanged({ sessionSlug, sessionId });
        onGroupsChanged?.();
      } catch (error) {
        if (targetKeyRef.current !== requestTargetKey || joinRequestIdRef.current !== requestId) return;
        if (loginOpenedForJoinRef.current) {
          loginOpenedForJoinRef.current = false;
          toggleLoginModal?.(false);
        }
        setJoinState({
          targetKey: requestTargetKey,
          groupId,
          status: 'error',
          error: formatJoinError(error),
        });
      }
    },
    [
      account,
      authenticated,
      fetchImpl,
      network,
      normalizedAccount,
      normalizedRecommendations,
      onGroupsChanged,
      provider,
      sessionConfig,
      sessionId,
      sessionSlug,
      targetKey,
      toggleLoginModal,
      workerUrl,
    ],
  );

  useEffect(() => {
    if (activeJoinState.status === 'waiting-login' && authenticated) {
      void joinRecommendedGroup(activeJoinState.groupId);
    }
  }, [activeJoinState.groupId, activeJoinState.status, authenticated, joinRecommendedGroup]);

  useEffect(() => {
    if (
      activeJoinState.status === 'waiting-login' &&
      previousLoginModalToggled &&
      !loginModalToggled &&
      !authenticated
    ) {
      loginOpenedForJoinRef.current = false;
      setJoinState(emptyJoinState(targetKey));
    }
  }, [activeJoinState.status, authenticated, loginModalToggled, previousLoginModalToggled, targetKey]);

  const visibleJoinStatus = activeJoinedGroupIds.size > 0 || activeJoinState.status === 'error';
  const visibleLoadError = activeViewState.status === 'error' && normalizedRecommendations.length > 0;
  if (!recommendationViews.length && !visibleJoinStatus && !visibleLoadError) return null;

  return (
    <SessionInterviewReviewSection title={`Suggested groups (${recommendationViews.length})`}>
      <div className={styles.sessionInterviewSuggestions} data-testid="ce-session-interview-group-recommendations">
        <p>Based on your interview. Join any groups that fit you.</p>
        {recommendationViews.map(({ group, reason, evidence }) => {
          const current = activeJoinState.groupId === group.groupId ? activeJoinState.status : 'idle';
          const joining = current === 'joining';
          const waitingLogin = current === 'waiting-login';
          const joined = activeJoinedGroupIds.has(group.groupId);
          const joinInProgress = activeJoinState.status === 'joining' || activeJoinState.status === 'waiting-login';
          return (
            <article key={group.groupId} className={styles.sessionInterviewDraft}>
              <div>
                <strong>{group.label}</strong>
                {group.description ? <p>{group.description}</p> : null}
                <p>{reason}</p>
                {evidence ? <p>Evidence: {evidence}</p> : null}
              </div>
              <div className={styles.sessionInterviewDraftActions}>
                <Button
                  color={joined ? 'success' : 'primary'}
                  onClick={() => void joinRecommendedGroup(group.groupId)}
                  disabled={joinInProgress || joined}
                  data-testid={`ce-session-interview-join-group-${group.groupId}`}
                >
                  {joining ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : joined ? (
                    <FontAwesomeIcon icon={faCheck} />
                  ) : null}
                  {joining ? ' Joining…' : joined ? ' Joined' : waitingLogin ? ' Login required' : 'Join'}
                </Button>
              </div>
              {activeJoinState.groupId === group.groupId && activeJoinState.status === 'waiting-login' ? (
                <p role="status">Log in to join this group.</p>
              ) : null}
              {activeJoinState.groupId === group.groupId && activeJoinState.status === 'error' ? (
                <p role="alert">{activeJoinState.error || 'Could not join this group.'}</p>
              ) : null}
            </article>
          );
        })}
        {activeViewState.status === 'error' && !recommendationViews.length ? (
          <p role="status">Group recommendations are temporarily unavailable.</p>
        ) : null}
      </div>
    </SessionInterviewReviewSection>
  );
}

export default SessionInterviewRecommendedGroups;
