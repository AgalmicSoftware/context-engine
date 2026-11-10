import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import {
  normalizeWorkerCanonicalSessionIdHex,
  resolveWorkerCanonicalSessionIdHex,
} from '../../utilities/session/sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import {
  dispatchWorkerGroupsChanged,
  subscribeWorkerGroupsChanged,
} from '../../utilities/worker/workerGroupChangeEvents';
import { AUTO_JOIN_CLAIM_ATTRIBUTE } from '../../utilities/ui/voiceDialogNoticeSlot';
import { clearWorkerGroupAutoJoinCancellation } from '../../domains/worker/workerGroupAutoJoinPreference';
import type { WorkerGroupAutoJoinIntent } from '../../domains/worker/workerGroupAutoJoinIntent';
import WorkerGroupImage from '../Shared/WorkerGroupImage';
import {
  getWorkerSessionToken,
  isSafeHttpsUrl,
  joinWorkerGroup,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import {
  normalizeInterviewGroupCandidates,
  readCachedInterviewWorkerToken,
} from './sessionInterviewGroupRecommendations';
import type { SessionInterviewGroupRecommendationState } from './useSessionInterviewGroupRecommendations';
import {
  cancelInterviewInvite,
  finishInterviewInvite,
  readInterviewInviteGroupId,
  readPendingInterviewInvite,
  resumeInterviewInvite,
} from './sessionInterviewGroupInvite';
import SessionInterviewReviewSection from './SessionInterviewReviewSection';
import styles from './SurveyTool.module.scss';

type UnknownRecord = Record<string, unknown>;

export type SessionInterviewGroupRecommendation = {
  groupId: string;
  reason?: string;
  confidence?: number;
};

export type SessionInterviewRecommendedGroupsProps = {
  recommendations?: SessionInterviewGroupRecommendation[];
  /** Where the suggestions stand; 'idle' after an edit clears them, which keeps what was listed. */
  availability?: SessionInterviewGroupRecommendationState['availability'];
  /** Out of sight during another interview round, keeping its ticks. */
  hidden?: boolean;
  /** Changes after each submit, which joins the ticked groups. */
  joinRequest?: number;
  onTickedChange?: (ticked: boolean) => void;
  onRefresh?: () => void;
  account?: unknown;
  provider?: unknown;
  network?: unknown;
  loginComplete?: boolean;
  sessionConfig?: unknown;
  sessionSlug?: string;
  workerUrl?: string;
  fetchImpl?: typeof fetch;
  onGroupsChanged?: () => void;
};

type CatalogState = {
  targetKey: string;
  overview: WorkerGroupOverview;
  status: 'idle' | 'loading' | 'ready' | 'error';
};

type GroupChoice = {
  groupId: string;
  label: string;
  description?: string;
  imageUrl?: string;
  reason: string;
  /** How surely the AI thinks the group fits, in a word; a link's group has none. */
  fit?: string;
  /** Only a link's group starts ticked; every match waits for the person to tick it. */
  fromLink: boolean;
};

type JoinOutcome = { status: 'idle' | 'joining' | 'done'; joined: string[]; failed: string[] };

const emptyOverview: WorkerGroupOverview = { groups: [], memberships: [] };
const idleOutcome: JoinOutcome = { status: 'idle', joined: [], failed: [] };

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
  if (message.includes('worker_group_member_cap_exceeded')) return 'it is full.';
  if (message.includes('worker_group_join_ended')) return 'it is closed.';
  if (message.includes('worker_group_join_denied')) return 'it is not open for joining.';
  if (message.includes('worker_group_authorization_invalid') || message.includes('worker_group_credential_missing'))
    return 'log in again to join it.';
  return 'please try again.';
};

// The drafts' bands: 70% and up is direct or repeated evidence, under 40% is weak.
const describeFit = (confidence: unknown): string => {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return '';
  const percent = Math.round(confidence * 100);
  return percent >= 70 ? 'Strong fit' : percent >= 40 ? 'Moderate fit' : 'Weak fit';
};

// "A", "A and B", "A, B and C".
const listNames = (names: string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const normalizeRecommendations = (
  recommendations: SessionInterviewGroupRecommendation[] = [],
): SessionInterviewGroupRecommendation[] => {
  const seen = new Set<string>();
  return recommendations
    .map((recommendation) => ({
      groupId: toText(recommendation?.groupId, 80),
      reason: toText(recommendation?.reason, 240),
      confidence: recommendation?.confidence,
    }))
    .filter((recommendation) => {
      if (!recommendation.groupId || seen.has(recommendation.groupId)) return false;
      seen.add(recommendation.groupId);
      return true;
    });
};

const membershipGroupIds = (overview: WorkerGroupOverview, sessionSlug: string): Set<string> =>
  new Set(
    overview.memberships
      .filter(({ group }) => canonicalizeSessionSlug(group.sessionSlug || sessionSlug) === sessionSlug)
      .map(({ group }) => group.groupId),
  );

const joinableGroupIds = (overview: WorkerGroupOverview): Set<string> =>
  new Set(
    normalizeInterviewGroupCandidates({
      groups: overview.groups,
      memberships: overview.memberships,
      source: overview.memberships.length ? 'authenticated' : 'public',
    }).map((group) => group.groupId),
  );

/**
 * The Groups part of interview review: a join link's group, then the groups that fit the
 * person's answers, each with a tick. Submitting joins the ticked ones.
 */
export function SessionInterviewRecommendedGroups({
  recommendations = [],
  availability = 'available',
  hidden = false,
  joinRequest = 0,
  onTickedChange,
  onRefresh,
  account,
  provider,
  network,
  loginComplete = false,
  sessionConfig,
  sessionSlug: sessionSlugProp = '',
  workerUrl: workerUrlProp = '',
  fetchImpl = fetch,
  onGroupsChanged,
}: SessionInterviewRecommendedGroupsProps) {
  const helpId = `${useId().replace(/:/g, '')}-groups-help`;
  const summaryRef = useRef<HTMLElement | null>(null);
  // An edit clears the suggestions until they're refreshed; what was listed stays, ticks and all.
  const settled = availability !== 'idle' && availability !== 'loading';
  const keptRef = useRef(recommendations);
  if (settled || recommendations.length) keptRef.current = recommendations;
  const listed = keptRef.current;
  const normalizedRecommendations = useMemo(() => normalizeRecommendations(listed), [listed]);
  const recommendedKey = normalizedRecommendations.map(({ groupId }) => groupId).join('|');
  const normalizedAccount = normalizeAddress(account);
  const config = toRecord(sessionConfig);
  const sessionSlug = canonicalizeSessionSlug(sessionSlugProp || config.slug);
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  const workerUrl = normalizeWorkerUrl(workerUrlProp);
  const authenticated = Boolean(loginComplete && normalizedAccount);
  // Kept once seen: unticking cancels the link's join but leaves its group here to tick again.
  const [invite, setInvite] = useState<WorkerGroupAutoJoinIntent | null>(null);
  useEffect(() => {
    if (!invite && workerUrl) setInvite(readPendingInterviewInvite(sessionSlug, workerUrl));
  }, [invite, sessionSlug, workerUrl]);
  const targetKey = `${sessionId}\n${sessionSlug}\n${workerUrl}\n${normalizedAccount}\n${recommendedKey}\n${invite?.groupId || ''}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const [catalog, setCatalog] = useState<CatalogState>({ targetKey: '', overview: emptyOverview, status: 'idle' });
  const overview = catalog.targetKey === targetKey ? catalog.overview : emptyOverview;
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<JoinOutcome>(idleOutcome);
  // Another account hasn't joined what this one did, or ticked its groups, as on a shared phone.
  // A link's tick stays: cancelling its join is the browser's, not the account's.
  const accountRef = useRef(normalizedAccount);
  useEffect(() => {
    if (accountRef.current && accountRef.current !== normalizedAccount) {
      setJoinedIds([]);
      setOutcome(idleOutcome);
      setTicks((current) => (invite && invite.groupId in current ? { [invite.groupId]: current[invite.groupId] } : {}));
    }
    accountRef.current = normalizedAccount;
  }, [invite, normalizedAccount]);
  const canLoadCatalog = Boolean(workerUrl && sessionId && sessionSlug && (normalizedRecommendations.length || invite));

  const loadCatalog = useCallback(async () => {
    const requestKey = targetKey;
    if (!canLoadCatalog) return;
    setCatalog((current) => ({ ...current, targetKey: requestKey, status: 'loading' }));
    try {
      const credentialToken = authenticated
        ? readCachedInterviewWorkerToken({ sessionConfig, sessionSlug, workerUrl, account: normalizedAccount })
        : '';
      const next = credentialToken
        ? await loadWorkerGroupOverview({ workerUrl, credentialToken, sessionId, sessionSlug, fetchImpl })
        : {
            groups: await loadPublicWorkerGroups({
              workerUrl,
              sessionId,
              sessionSlug,
              joinGroup: readInterviewInviteGroupId(sessionSlug, workerUrl),
              fetchImpl,
            }),
            memberships: [],
          };
      if (targetKeyRef.current === requestKey) setCatalog({ targetKey: requestKey, overview: next, status: 'ready' });
    } catch {
      if (targetKeyRef.current === requestKey)
        setCatalog({ targetKey: requestKey, overview: emptyOverview, status: 'error' });
    }
  }, [
    authenticated,
    canLoadCatalog,
    fetchImpl,
    normalizedAccount,
    sessionConfig,
    sessionId,
    sessionSlug,
    targetKey,
    workerUrl,
  ]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);
  // A join elsewhere, such as the link's at sign-in, takes its group off this list.
  useEffect(
    () =>
      subscribeWorkerGroupsChanged((detail) => {
        if (detail.sessionSlug === sessionSlug && detail.sessionId === normalizeWorkerCanonicalSessionIdHex(sessionId))
          void loadCatalog();
      }),
    [loadCatalog, sessionId, sessionSlug],
  );

  const choices = useMemo<GroupChoice[]>(() => {
    const members = membershipGroupIds(overview, sessionSlug);
    const joinable = joinableGroupIds(overview);
    const hidden = (groupId: string) => members.has(groupId) || joinedIds.includes(groupId);
    const linked = invite && !hidden(invite.groupId) ? overview.groups.find((g) => g.groupId === invite.groupId) : null;
    return [
      ...(invite && !hidden(invite.groupId)
        ? [
            {
              groupId: invite.groupId,
              label: linked?.label || invite.groupId,
              ...(linked?.description ? { description: linked.description } : {}),
              ...(linked?.imageUrl ? { imageUrl: linked.imageUrl } : {}),
              reason: 'From your link.',
              fromLink: true,
            },
          ]
        : []),
      // Suggestion order, so groups named like a chosen answer stay first and a late AI match
      // joins the end instead of moving a row someone may be about to tick.
      ...normalizedRecommendations.flatMap((recommendation) => {
        const group = overview.groups.find((candidate) => candidate.groupId === recommendation.groupId);
        if (!group || !joinable.has(group.groupId) || hidden(group.groupId) || group.groupId === invite?.groupId)
          return [];
        const fit = describeFit(recommendation.confidence);
        return [
          {
            groupId: group.groupId,
            label: group.label,
            ...(group.description ? { description: group.description } : {}),
            ...(group.imageUrl ? { imageUrl: group.imageUrl } : {}),
            reason: recommendation.reason || 'Suggested from your answers.',
            ...(fit ? { fit } : {}),
            fromLink: false,
          },
        ];
      }),
    ];
  }, [invite, joinedIds, normalizedRecommendations, overview, sessionSlug]);

  const tickedIds = choices.filter((choice) => ticks[choice.groupId] ?? choice.fromLink).map((c) => c.groupId);
  const latestRef = useRef({ tickedIds, choices });
  latestRef.current = { tickedIds, choices };
  const anyTicked = tickedIds.length > 0;
  useEffect(() => {
    onTickedChange?.(anyTicked);
  }, [anyTicked, onTickedChange]);
  useEffect(() => () => onTickedChange?.(false), [onTickedChange]);

  const toggle = (choice: GroupChoice, ticked: boolean) => {
    if (choice.fromLink && invite) {
      if (ticked) resumeInterviewInvite(invite);
      else cancelInterviewInvite(invite);
    }
    setTicks((current) => ({ ...current, [choice.groupId]: ticked }));
  };

  const joinTicked = useCallback(async () => {
    const { tickedIds: groupIds, choices: shown } = latestRef.current;
    if (!groupIds.length) return;
    const labelOf = (groupId: string, known: WorkerGroupOverview = emptyOverview) =>
      known.groups.find((group) => group.groupId === groupId)?.label ||
      known.memberships.find(({ group }) => group.groupId === groupId)?.group.label ||
      shown.find((choice) => choice.groupId === groupId)?.label ||
      groupId;
    if (!authenticated) {
      setOutcome({ status: 'done', joined: [], failed: ['Log in to join groups.'] });
      return;
    }
    setOutcome({ status: 'joining', joined: [], failed: [] });
    const joined: string[] = [];
    const failed: string[] = [];
    let current = emptyOverview;
    try {
      const credentialToken = await getWorkerSessionToken({
        sessionSlug,
        sessionConfig,
        workerUrl,
        context: { account, providerLike: provider, chainId: resolveChainId(network, sessionConfig) },
      });
      current = await loadWorkerGroupOverview({ workerUrl, credentialToken, sessionId, sessionSlug, fetchImpl });
      const members = membershipGroupIds(current, sessionSlug);
      const joinable = joinableGroupIds(current);
      for (const groupId of groupIds) {
        if (members.has(groupId)) {
          joined.push(groupId);
        } else if (!joinable.has(groupId)) {
          failed.push(`Couldn’t join ${labelOf(groupId, current)}: it is no longer open to join.`);
        } else {
          try {
            await joinWorkerGroup({ workerUrl, credentialToken, sessionId, sessionSlug, groupId, fetchImpl });
            joined.push(groupId);
          } catch (error) {
            failed.push(`Couldn’t join ${labelOf(groupId, current)}: ${formatJoinError(error)}`);
          }
        }
      }
    } catch (error) {
      groupIds
        .filter((groupId) => !joined.includes(groupId))
        .forEach((groupId) => failed.push(`Couldn’t join ${labelOf(groupId, current)}: ${formatJoinError(error)}`));
    }
    joined.forEach((groupId) => clearWorkerGroupAutoJoinCancellation({ workerUrl, sessionSlug, sessionId, groupId }));
    if (invite && joined.includes(invite.groupId)) finishInterviewInvite(invite);
    setJoinedIds((previous) => [...new Set([...previous, ...joined])]);
    setOutcome({ status: 'done', joined: joined.map((groupId) => labelOf(groupId, current)), failed });
    if (joined.length) {
      dispatchWorkerGroupsChanged({ sessionSlug, sessionId });
      onGroupsChanged?.();
    }
  }, [
    account,
    authenticated,
    fetchImpl,
    invite,
    network,
    onGroupsChanged,
    provider,
    sessionConfig,
    sessionId,
    sessionSlug,
    workerUrl,
  ]);

  const handledJoinRequestRef = useRef(joinRequest);
  useEffect(() => {
    if (!joinRequest || joinRequest === handledJoinRequestRef.current) return;
    handledJoinRequestRef.current = joinRequest;
    void joinTicked();
  }, [joinRequest, joinTicked]);

  const loadFailed = catalog.targetKey === targetKey && catalog.status === 'error';
  const loading = availability === 'loading';
  // A private session's images need a Worker sign-in; use a saved one, and never ask for one here.
  const imageToken = authenticated
    ? readCachedInterviewWorkerToken({ sessionConfig, sessionSlug, workerUrl, account: normalizedAccount })
    : '';
  if (!choices.length && !loading && outcome.status === 'idle' && !onRefresh && !loadFailed) return null;
  return (
    <SessionInterviewReviewSection
      hidden={hidden}
      title={`Groups (${choices.length})`}
      help="Groups that may fit your answers, and any your link joins. Each suggestion is marked a strong, moderate or weak fit. Tick the ones you want; ticked groups are joined when you submit."
      helpId={helpId}
      summaryRef={summaryRef}
    >
      <div className={styles.sessionInterviewGroupChoices} data-testid="ce-session-interview-group-recommendations">
        {/* The link's own notice stands aside while its group is listed here, in sight. */}
        {invite && !hidden ? <span hidden {...{ [AUTO_JOIN_CLAIM_ATTRIBUTE]: invite.groupId }} /> : null}
        {choices.map((choice) => (
          <label key={choice.groupId} className={styles.sessionInterviewGroupChoice}>
            <input
              type="checkbox"
              checked={ticks[choice.groupId] ?? choice.fromLink}
              disabled={outcome.status === 'joining'}
              onChange={(event) => toggle(choice, event.target.checked)}
              data-testid={`ce-session-interview-group-choice-${choice.groupId}`}
            />
            {/* Its name is beside it, so the image needs no text of its own. */}
            {choice.imageUrl && isSafeHttpsUrl(choice.imageUrl) ? (
              <WorkerGroupImage
                src={choice.imageUrl}
                alt=""
                className={styles.sessionInterviewGroupChoiceImage}
                fetchImpl={fetchImpl}
                sessionConfig={sessionConfig}
                sessionSlug={sessionSlug}
                testId={`ce-session-interview-group-image-${choice.groupId}`}
                workerToken={imageToken}
                workerUrl={workerUrl}
              />
            ) : null}
            <span>
              <strong>{choice.label}</strong>
              {choice.description ? <small>{choice.description}</small> : null}
              <small>
                {choice.fit ? `${choice.fit} · ` : ''}
                {choice.reason}
              </small>
            </span>
          </label>
        ))}
        {loading ? <p role="status">Finding groups that fit your answers…</p> : null}
        {loadFailed && !choices.length ? <p role="status">Groups are unavailable right now.</p> : null}
        {outcome.status === 'joining' ? <p role="status">Joining groups…</p> : null}
        {outcome.joined.length ? <p role="status">Joined {listNames(outcome.joined)}.</p> : null}
        {outcome.failed.map((message, index) => (
          <p key={`${index}:${message}`} role="alert">
            {message}
          </p>
        ))}
        {joinRequest && anyTicked && outcome.status !== 'joining' ? (
          <Button color="primary" onClick={() => void joinTicked()}>
            Join ticked groups
          </Button>
        ) : null}
        {onRefresh ? (
          <Button
            outline
            onClick={() => {
              onRefresh();
              // The button goes once clicked; keep keyboard focus on this section.
              summaryRef.current?.focus({ preventScroll: true });
            }}
          >
            Refresh group suggestions
          </Button>
        ) : null}
      </div>
    </SessionInterviewReviewSection>
  );
}

export default SessionInterviewRecommendedGroups;
