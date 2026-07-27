import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminWorkerGroupsPanel from '../Admin/AdminWorkerGroupsPanel';
import { resolveAdminCapabilities } from '../Admin/adminPageHelpers';
import { postSignedAdminWorkerRequest } from '../Admin/adminPageSignedWorkerRequest';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection.js';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { buildSignedAdminActionAuth, getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import { GROUP_CREATION_POLICIES, resolveGroupCreationPolicy } from '../../utilities/session/groupCreationPolicy';
import type { PostSignedWorkerGroupRequest } from '../../domains/worker/workerGroupPorts';
import WorkerGroupMembershipPanel from './WorkerGroupMembershipPanel';
import WorkerParticipantGroupCreatePanel from './WorkerParticipantGroupCreatePanel';
import styles from './OnePageSession.module.scss';

type UnknownRecord = Record<string, unknown>;

export type WorkerSessionGroupsPanelProps = {
  account: unknown;
  provider: unknown;
  networkChainId: unknown;
  sessionConfig: unknown;
  sessionSlug: string;
  showCreate: boolean;
  toggleLoginModal?: (open: boolean) => void;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toText = (value: unknown): string => String(value ?? '').trim();
type WorkerGroupsAuthState = {
  targetKey: string;
  token: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
};

const emptyAuthState = (targetKey: string): WorkerGroupsAuthState => ({
  targetKey,
  token: '',
  status: 'idle',
  error: '',
});

const WorkerSessionGroupsPanel = ({
  account,
  provider,
  sessionConfig,
  sessionSlug,
  showCreate,
  toggleLoginModal,
}: WorkerSessionGroupsPanelProps) => {
  const config = asRecord(sessionConfig);
  const canonicalSessionSlug = canonicalizeSessionSlug(sessionSlug);
  const configuredSessionSlug = canonicalizeSessionSlug(config.slug);
  const canonicalSessionId = resolveWorkerCanonicalSessionIdHex(config);
  const projection = resolveSessionCapabilityProjection(config);
  const hasExactWorkerProfile =
    projection.source === 'profile' &&
    projection.profileValid &&
    projection.isWorkerCanonical &&
    canonicalSessionId.length > 0 &&
    canonicalSessionSlug.length > 0 &&
    configuredSessionSlug === canonicalSessionSlug;
  const normalizedAccount = toText(account);
  const workerUrl = useMemo(
    () =>
      getUsableSessionWorkerUrl({
        slug: canonicalSessionSlug,
        sessionConfig,
        requireExactWorkerSession: true,
      }),
    [canonicalSessionSlug, sessionConfig],
  );
  const targetKey = `${canonicalSessionId}\n${canonicalSessionSlug}\n${workerUrl}\n${normalizedAccount.toLowerCase()}`;
  const [authState, setAuthState] = useState<WorkerGroupsAuthState>(() => emptyAuthState(targetKey));
  const [groupsRevision, setGroupsRevision] = useState(0);
  const authRequestIdRef = useRef(0);
  const activeAuthState = authState.targetKey === targetKey ? authState : emptyAuthState(targetKey);
  const workerToken = activeAuthState.token;
  const authStatus = activeAuthState.status;
  const authError = activeAuthState.error;
  const adminCapabilities = resolveAdminCapabilities({ account, sessionConfig: config });
  const canAttemptWorkerAdmin =
    adminCapabilities.canAdminWorker || (!adminCapabilities.workerAdminAddress && !!normalizedAccount);
  const participantGroupCreationEnabled = resolveGroupCreationPolicy(config) === GROUP_CREATION_POLICIES.PARTICIPANTS;
  const chainId = projection.hasOnChainComponent && projection.chainId ? projection.chainId : 1;

  const authenticate = useCallback(async () => {
    const requestTargetKey = targetKey;
    if (!hasExactWorkerProfile || !normalizedAccount || !workerUrl) {
      setAuthState(emptyAuthState(requestTargetKey));
      return;
    }
    const requestId = authRequestIdRef.current + 1;
    authRequestIdRef.current = requestId;
    setAuthState({
      targetKey: requestTargetKey,
      token: '',
      status: 'loading',
      error: '',
    });
    try {
      const token = await getWorkerSessionToken({
        sessionSlug: canonicalSessionSlug,
        sessionConfig,
        workerUrl,
        context: { account, providerLike: provider, chainId },
      });
      if (authRequestIdRef.current !== requestId) return;
      setAuthState({
        targetKey: requestTargetKey,
        token,
        status: 'ready',
        error: '',
      });
    } catch (error) {
      if (authRequestIdRef.current !== requestId) return;
      setAuthState({
        targetKey: requestTargetKey,
        token: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not authenticate with the session worker.',
      });
    }
  }, [
    account,
    canonicalSessionSlug,
    chainId,
    hasExactWorkerProfile,
    normalizedAccount,
    provider,
    sessionConfig,
    targetKey,
    workerUrl,
  ]);

  useEffect(() => {
    setGroupsRevision(0);
    void authenticate();
    return () => {
      authRequestIdRef.current += 1;
    };
  }, [authenticate]);

  const postSignedRequest = useCallback<PostSignedWorkerGroupRequest>(
    (args = {}) => {
      const action = toText(args.action) || 'groups/list';
      const body = asRecord(args.body);
      return postSignedAdminWorkerRequest({
        ...args,
        action,
        body,
        workerUrl,
        signAdminAction: ({ action: signedAction, body: signedBody, workerUrl: signedWorkerUrl }) =>
          buildSignedAdminActionAuth({
            action: signedAction,
            slug: canonicalSessionSlug,
            sessionId: canonicalSessionId,
            body: signedBody,
            workerUrl: signedWorkerUrl,
            context: { account, providerLike: provider, chainId },
          }),
      });
    },
    [account, canonicalSessionId, canonicalSessionSlug, chainId, provider, workerUrl],
  );

  if (!hasExactWorkerProfile) {
    return (
      <div className={styles.workerGroupNotice}>
        This session does not have an exact, validated Worker Groups profile.
      </div>
    );
  }

  if (!workerUrl) {
    return <div className={styles.workerGroupNotice}>This session does not have a configured Cloudflare worker.</div>;
  }

  if (!normalizedAccount) {
    return (
      <div className={styles.workerGroupNotice} data-testid="ce-session-worker-groups-login">
        <span>Sign in to view or join this session’s Cloudflare groups.</span>
        <button type="button" className={styles.telegramPrimaryButton} onClick={() => toggleLoginModal?.(true)}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className={styles.workerGroupsPanel} data-testid="ce-session-worker-groups-native">
      <div className={styles.workerGroupNotice}>
        These groups live in the session’s Cloudflare worker. They do not require a contract address, chain transaction,
        gas, or RPC configuration.
      </div>
      {authStatus === 'loading' ? (
        <div className={styles.workerGroupNotice}>Authenticating with the session…</div>
      ) : null}
      {authError ? (
        <div className={styles.workerGroupNotice}>
          <span>{authError}</span>
          <button type="button" className={styles.telegramSecondaryButton} onClick={() => void authenticate()}>
            Retry
          </button>
        </div>
      ) : null}
      {workerToken ? (
        <WorkerGroupMembershipPanel
          key={`worker-memberships:${targetKey}`}
          canReadGroups={true}
          workerUrl={workerUrl}
          workerToken={workerToken}
          sessionId={canonicalSessionId}
          sessionSlug={canonicalSessionSlug}
          refreshNonce={groupsRevision}
        />
      ) : null}
      {showCreate ? (
        canAttemptWorkerAdmin ? (
          <AdminWorkerGroupsPanel
            key={`worker-admin-groups:${targetKey}`}
            canAdminWorker={true}
            sessionId={canonicalSessionId}
            sessionSlug={canonicalSessionSlug}
            workerUrl={workerUrl}
            postSignedRequest={postSignedRequest}
            autoLoad={true}
            onGroupsChanged={() => setGroupsRevision((revision) => revision + 1)}
          />
        ) : participantGroupCreationEnabled ? (
          workerToken ? (
            <WorkerParticipantGroupCreatePanel
              sessionId={canonicalSessionId}
              sessionSlug={canonicalSessionSlug}
              workerToken={workerToken}
              workerUrl={workerUrl}
              onGroupsChanged={() => setGroupsRevision((revision) => revision + 1)}
            />
          ) : null
        ) : (
          <div className={styles.workerGroupNotice}>Only the configured worker admin can create groups.</div>
        )
      ) : null}
    </div>
  );
};

export default WorkerSessionGroupsPanel;
