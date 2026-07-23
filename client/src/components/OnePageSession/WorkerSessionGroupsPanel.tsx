import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminWorkerGroupsPanel from '../Admin/AdminWorkerGroupsPanel';
import { resolveAdminCapabilities } from '../Admin/adminPageHelpers';
import { postSignedAdminWorkerRequest } from '../Admin/adminPageSignedWorkerRequest';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { buildSignedAdminActionAuth, getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import type { PostSignedWorkerGroupRequest } from '../../domains/worker/workerGroupPorts';
import WorkerGroupMembershipPanel from './WorkerGroupMembershipPanel';
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

const WorkerSessionGroupsPanel = ({
  account,
  provider,
  networkChainId,
  sessionConfig,
  sessionSlug,
  showCreate,
  toggleLoginModal,
}: WorkerSessionGroupsPanelProps) => {
  const [workerToken, setWorkerToken] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [authError, setAuthError] = useState('');
  const [groupsRevision, setGroupsRevision] = useState(0);
  const authRequestIdRef = useRef(0);
  const config = asRecord(sessionConfig);
  const normalizedAccount = toText(account);
  const workerUrl = useMemo(
    () => getUsableSessionWorkerUrl({ slug: sessionSlug, sessionConfig }),
    [sessionConfig, sessionSlug],
  );
  const adminCapabilities = resolveAdminCapabilities({ account, sessionConfig: config });
  const canAttemptWorkerAdmin =
    adminCapabilities.canAdminWorker || (!adminCapabilities.workerAdminAddress && !!normalizedAccount);
  const chainId = Number(networkChainId || config.networkChainId || 1) || 1;

  const authenticate = useCallback(async () => {
    if (!normalizedAccount || !workerUrl) return;
    const requestId = authRequestIdRef.current + 1;
    authRequestIdRef.current = requestId;
    setWorkerToken('');
    setAuthStatus('loading');
    setAuthError('');
    try {
      const token = await getWorkerSessionToken({
        sessionSlug,
        sessionConfig,
        workerUrl,
        context: { account, providerLike: provider, chainId },
      });
      if (authRequestIdRef.current !== requestId) return;
      setWorkerToken(token);
      setAuthStatus('ready');
    } catch (error) {
      if (authRequestIdRef.current !== requestId) return;
      setWorkerToken('');
      setAuthError(error instanceof Error ? error.message : 'Could not authenticate with the session worker.');
      setAuthStatus('error');
    }
  }, [account, chainId, normalizedAccount, provider, sessionConfig, sessionSlug, workerUrl]);

  useEffect(() => {
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
            slug: sessionSlug,
            body: signedBody,
            workerUrl: signedWorkerUrl,
            context: { account, providerLike: provider, chainId },
          }),
      });
    },
    [account, chainId, provider, sessionSlug, workerUrl],
  );

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
          canReadGroups={true}
          workerUrl={workerUrl}
          workerToken={workerToken}
          refreshNonce={groupsRevision}
          participantAddress={normalizedAccount}
        />
      ) : null}
      {showCreate ? (
        canAttemptWorkerAdmin ? (
          <AdminWorkerGroupsPanel
            canAdminWorker={true}
            sessionSlug={sessionSlug}
            workerUrl={workerUrl}
            postSignedRequest={postSignedRequest}
            autoLoad={true}
            onGroupsChanged={() => setGroupsRevision((revision) => revision + 1)}
          />
        ) : (
          <div className={styles.workerGroupNotice}>Only the configured worker admin can create groups.</div>
        )
      ) : null}
    </div>
  );
};

export default WorkerSessionGroupsPanel;
