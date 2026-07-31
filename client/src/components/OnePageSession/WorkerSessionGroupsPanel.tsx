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
import { sessionModeAllowsAnonymousWorkerGroupDiscovery } from '../../utilities/session/sessionModeProfile';
import type { PostSignedWorkerGroupRequest } from '../../domains/worker/workerGroupPorts';
import { WorkerGroupCreateMessage } from '../Shared/WorkerGroupCreateForm';
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
  sessionName?: string;
  showCreate: boolean;
  createOnly?: boolean;
  refreshNonce?: number;
  selectedGroupId?: string;
  showGroupDescriptions?: boolean;
  showMembershipListHeader?: boolean;
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
  sessionName,
  showCreate,
  createOnly = false,
  refreshNonce = 0,
  selectedGroupId = '',
  showGroupDescriptions = true,
  showMembershipListHeader = true,
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
  const activeSessionName = toText(sessionName) || toText(config.sessionName) || canonicalSessionSlug;
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
  const [preserveSignedOutParticipantDraft, setPreserveSignedOutParticipantDraft] = useState(false);
  const authRequestIdRef = useRef(0);
  const activeAuthState = authState.targetKey === targetKey ? authState : emptyAuthState(targetKey);
  const workerToken = activeAuthState.token;
  const authStatus = activeAuthState.status;
  const authError = activeAuthState.error;
  const adminCapabilities = resolveAdminCapabilities({ account, sessionConfig: config });
  const canAttemptWorkerAdmin =
    adminCapabilities.canAdminWorker || (!adminCapabilities.workerAdminAddress && !!normalizedAccount);
  const participantGroupCreationEnabled = resolveGroupCreationPolicy(config) === GROUP_CREATION_POLICIES.PARTICIPANTS;
  const allowAnonymousGroupDiscovery = sessionModeAllowsAnonymousWorkerGroupDiscovery(config.sessionModeProfile);
  const chainId = projection.hasOnChainComponent && projection.chainId ? projection.chainId : 1;
  // Public discovery is anonymous only for signed-out visitors. Once an
  // account is available, authenticate so every route projects that account's
  // durable Worker memberships instead of reverting joined cards to "Join".
  const shouldAuthenticateOnRender = !allowAnonymousGroupDiscovery || !!normalizedAccount;
  const canRenderMemberships =
    !!workerToken ||
    (!normalizedAccount && !membershipsOnly && allowAnonymousGroupDiscovery) ||
    (!!normalizedAccount && authStatus === 'error' && !membershipsOnly && allowAnonymousGroupDiscovery);

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
    authRequestIdRef.current += 1;
    if (shouldAuthenticateOnRender) {
      void authenticate();
    } else {
      setAuthState(emptyAuthState(targetKey));
    }
    return () => {
      authRequestIdRef.current += 1;
    };
  }, [authenticate, shouldAuthenticateOnRender, targetKey]);

  useEffect(() => {
    if (!showCreate || !participantGroupCreationEnabled) {
      setPreserveSignedOutParticipantDraft(false);
    } else if (!normalizedAccount) {
      setPreserveSignedOutParticipantDraft(true);
    }
  }, [normalizedAccount, participantGroupCreationEnabled, showCreate]);

  const requestActionAuthentication = useCallback(() => {
    if (!normalizedAccount) {
      toggleLoginModal?.(true);
      return;
    }
    if (authStatus !== 'loading') void authenticate();
  }, [authStatus, authenticate, normalizedAccount, toggleLoginModal]);

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
    if (createOnly) {
      return (
        <WorkerGroupCreateMessage sessionName={activeSessionName} sessionSlug={canonicalSessionSlug}>
          Group creation is unavailable because this session does not have a valid Groups configuration.
        </WorkerGroupCreateMessage>
      );
    }
    return (
      <div className={styles.workerGroupNotice}>
        This session does not have an exact, validated Worker Groups profile.
      </div>
    );
  }

  if (!workerUrl) {
    if (createOnly) {
      return (
        <WorkerGroupCreateMessage sessionName={activeSessionName} sessionSlug={canonicalSessionSlug}>
          Group creation is unavailable because this session does not have a configured worker.
        </WorkerGroupCreateMessage>
      );
    }
    return <div className={styles.workerGroupNotice}>This session does not have a configured Cloudflare worker.</div>;
  }

  const shouldUseParticipantCreate =
    participantGroupCreationEnabled &&
    (preserveSignedOutParticipantDraft || !normalizedAccount || !adminCapabilities.canAdminWorker);
  const renderCreatePanel = () => {
    if (shouldUseParticipantCreate) {
      return (
        <WorkerParticipantGroupCreatePanel
          key={`worker-participant-create:${canonicalSessionId}:${canonicalSessionSlug}:${workerUrl}`}
          sessionId={canonicalSessionId}
          sessionConfig={sessionConfig}
          sessionName={activeSessionName}
          participantAddress={normalizedAccount}
          sessionSlug={canonicalSessionSlug}
          workerToken={workerToken}
          workerUrl={workerUrl}
          authenticationRequired={!normalizedAccount || !workerToken}
          authenticationBusy={!!normalizedAccount && authStatus === 'loading'}
          onRequestAuthentication={requestActionAuthentication}
          onGroupsChanged={() => setGroupsRevision((revision) => revision + 1)}
        />
      );
    }
    if (adminCapabilities.canAdminWorker) {
      return (
        <AdminWorkerGroupsPanel
          key={`worker-admin-groups:${targetKey}`}
          canAdminWorker={true}
          sessionId={canonicalSessionId}
          sessionConfig={sessionConfig}
          sessionName={activeSessionName}
          sessionSlug={canonicalSessionSlug}
          workerUrl={workerUrl}
          workerAuthContext={{ account, providerLike: provider, chainId }}
          workerToken={workerToken}
          postSignedRequest={postSignedRequest}
          autoLoad={!createOnly}
          createOnly={createOnly}
          onGroupsChanged={() => setGroupsRevision((revision) => revision + 1)}
        />
      );
    }
    if (!normalizedAccount) {
      return (
        <WorkerGroupCreateMessage
          actionLabel="Sign in"
          onAction={requestActionAuthentication}
          sessionName={activeSessionName}
          sessionSlug={canonicalSessionSlug}
          testId="ce-session-worker-groups-login"
        >
          Sign in to verify permission to create a group in this session.
        </WorkerGroupCreateMessage>
      );
    }
    if (canAttemptWorkerAdmin) {
      return (
        <AdminWorkerGroupsPanel
          key={`worker-admin-groups:${targetKey}`}
          canAdminWorker={true}
          sessionId={canonicalSessionId}
          sessionConfig={sessionConfig}
          sessionName={activeSessionName}
          sessionSlug={canonicalSessionSlug}
          workerUrl={workerUrl}
          workerAuthContext={{ account, providerLike: provider, chainId }}
          workerToken={workerToken}
          postSignedRequest={postSignedRequest}
          autoLoad={!createOnly}
          createOnly={createOnly}
          onGroupsChanged={() => setGroupsRevision((revision) => revision + 1)}
        />
      );
    }
    return (
      <WorkerGroupCreateMessage sessionName={activeSessionName} sessionSlug={canonicalSessionSlug}>
        Only the configured session admin can create groups.
      </WorkerGroupCreateMessage>
    );
  };

  if (!normalizedAccount && !allowAnonymousGroupDiscovery) {
    if (createOnly) return <div data-testid="ce-session-worker-groups-native">{renderCreatePanel()}</div>;
    return (
      <div className={styles.workerGroupNotice} data-testid="ce-session-worker-groups-login">
        <span>Sign in to view or join this session’s groups.</span>
        <button type="button" className={styles.telegramPrimaryButton} onClick={requestActionAuthentication}>
          Sign in
        </button>
      </div>
    );
  }

  if (createOnly) {
    return (
      <div className={styles.workerGroupsPanel} data-testid="ce-session-worker-groups-native">
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
        {renderCreatePanel()}
      </div>
    );
  }

  return (
    <div className={styles.workerGroupsPanel} data-testid="ce-session-worker-groups-native">
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
      {canRenderMemberships ? (
        <WorkerGroupMembershipPanel
          key={`worker-memberships:${targetKey}`}
          canReadGroups={true}
          allowAnonymousGroupDiscovery={allowAnonymousGroupDiscovery}
          workerUrl={workerUrl}
          workerToken={workerToken}
          sessionConfig={sessionConfig}
          sessionId={canonicalSessionId}
          sessionSlug={canonicalSessionSlug}
          refreshNonce={groupsRevision + refreshNonce}
          selectedGroupId={selectedGroupId}
          showDescriptions={showGroupDescriptions}
          showListHeader={showMembershipListHeader}
          participantAddress={normalizedAccount}
          onSignIn={requestActionAuthentication}
        />
      ) : null}
      {showCreate ? renderCreatePanel() : null}
    </div>
  );
};

export default WorkerSessionGroupsPanel;
