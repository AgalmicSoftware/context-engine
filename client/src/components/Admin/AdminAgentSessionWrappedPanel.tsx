import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, FormGroup, FormText, Input, Label } from 'reactstrap';
import { DEPLOY_HELPER_URL } from '../../variables/publicDeploymentConfig.js';
import type { AgentSessionWrappedCapability } from '../../utilities/session/agentSessionWrapped.js';
import {
  applyAdminAgentSessionWrappedChange,
  resolveAdminAgentSessionWrappedAvailability,
  verifyAdminAgentSessionWrappedHealth,
} from './adminAgentSessionWrapped';
import styles from './AdminPage.module.scss';

type AdminRecord = Record<string, unknown>;

export type AdminAgentSessionWrappedPanelProps = {
  canAdminWorker: boolean;
  sessionConfig: unknown;
  sessionSlug: string;
  sessionWorkerUrl: string;
  postSignedRequest: (args: { action: string; body: AdminRecord; path: string; workerUrl: string }) => Promise<unknown>;
  ensureSessionWorkerAttached?: (input: { sessionWorkerUrl: string }) => Promise<unknown>;
  onConfigUpdated?: (args: {
    capability: AgentSessionWrappedCapability;
    configPatch: AdminRecord;
    workerUrl: string;
  }) => void;
  deployHelperUrl?: string;
  requestIdFactory?: () => string;
};

const defaultRequestIdFactory = (): string => {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '';
  const suffix = uuid || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `wrapped-admin-${suffix}`;
};

const AdminAgentSessionWrappedPanel = ({
  canAdminWorker,
  sessionConfig,
  sessionSlug,
  sessionWorkerUrl,
  postSignedRequest,
  ensureSessionWorkerAttached,
  onConfigUpdated,
  deployHelperUrl = DEPLOY_HELPER_URL,
  requestIdFactory = defaultRequestIdFactory,
}: AdminAgentSessionWrappedPanelProps) => {
  const [apiToken, setApiToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [localCapability, setLocalCapability] = useState<AgentSessionWrappedCapability | null>(null);
  const pendingRequestRef = useRef<{ key: string; requestId: string } | null>(null);
  const effectiveConfig = useMemo(
    () =>
      localCapability && sessionConfig && typeof sessionConfig === 'object'
        ? { ...(sessionConfig as AdminRecord), agentSessionWrapped: localCapability }
        : sessionConfig,
    [localCapability, sessionConfig],
  );
  const availability = useMemo(
    () =>
      resolveAdminAgentSessionWrappedAvailability({
        canAdminWorker,
        sessionConfig: effectiveConfig,
        sessionWorkerUrl,
      }),
    [canAdminWorker, effectiveConfig, sessionWorkerUrl],
  );
  const capability = localCapability || availability.capability;

  useEffect(() => {
    setApiToken('');
    setBusy(false);
    setStatus('');
    setLocalCapability(null);
    pendingRequestRef.current = null;
  }, [sessionSlug, sessionWorkerUrl]);

  const runChange = async ({ accessEnabled, operation }: { accessEnabled: boolean; operation: string }) => {
    if (!availability.manageable || busy) return;
    const operationKey = `${sessionSlug}:${sessionWorkerUrl}:${operation}:${accessEnabled}`;
    if (!pendingRequestRef.current || pendingRequestRef.current.key !== operationKey) {
      pendingRequestRef.current = { key: operationKey, requestId: requestIdFactory() };
    }
    setBusy(true);
    setStatus(accessEnabled ? 'Deploying and verifying Wrapped…' : 'Disabling Wrapped access…');
    try {
      const result = await applyAdminAgentSessionWrappedChange({
        accessEnabled,
        apiToken,
        deployHelperUrl,
        deploymentRequestId: pendingRequestRef.current.requestId,
        sessionConfig: effectiveConfig,
        sessionSlug,
        sessionWorkerUrl,
        ensureSessionWorkerAttached,
        postSignedRequest,
      });
      setLocalCapability(result.capability);
      onConfigUpdated?.({
        capability: result.capability,
        configPatch: result.configPatch,
        workerUrl: sessionWorkerUrl,
      });
      pendingRequestRef.current = null;
      setStatus(
        result.capability.enabled
          ? 'Wrapped access enabled and published.'
          : 'Wrapped access disabled; deployed resources were retained.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Wrapped deployment failed.');
    } finally {
      // The token is request-only and never survives an operation in component state.
      setApiToken('');
      setBusy(false);
    }
  };

  const checkHealth = async () => {
    if (!capability || busy) return;
    setBusy(true);
    setStatus('Checking Wrapped health…');
    try {
      const result = await verifyAdminAgentSessionWrappedHealth({
        capability,
        sessionSlug,
        sessionWorkerUrl,
      });
      setStatus(
        result.accessEnabled ? 'Wrapped is healthy and access is enabled.' : 'Wrapped is healthy; access is disabled.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Wrapped health check failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel} data-testid="ce-admin-agent-session-wrapped">
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <div className={styles.panelTitle}>Agent Session Wrapped</div>
          <div className={styles.panelHint}>
            One dedicated Bridge delegates membership checks to this session’s paired Worker. Agent answers use HTTPS/KV
            and require no agent-originated EVM transaction.
          </div>
        </div>
      </div>
      <div
        className={
          availability.code === 'locked_workerless' ||
          availability.code === 'encrypted_worker_pointer' ||
          availability.code === 'incompatible'
            ? styles.warningNote
            : styles.statusNote
        }
      >
        {availability.message}
      </div>
      {capability && (
        <div className={styles.statusNote}>
          {capability.enabled ? 'Enabled' : 'Access disabled'} · {capability.protocolVersion} ·{' '}
          <a href={`${capability.origin}/health`} target="_blank" rel="noreferrer">
            {capability.origin}
          </a>
        </div>
      )}
      {availability.manageable && (
        <>
          <FormGroup>
            <Label for="admin-agent-session-wrapped-token">Cloudflare API token</Label>
            <Input
              id="admin-agent-session-wrapped-token"
              type="password"
              autoComplete="off"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              disabled={busy}
            />
            <FormText>
              Request-only: this token is sent only to the deploy helper for this operation and is never stored.
              Attaching a new registry Worker prompts an admin transaction; agent answers do not. Telegram is optional
              and remains disabled.
            </FormText>
          </FormGroup>
          <div className={styles.formRow}>
            {!capability?.enabled && (
              <Button
                color="primary"
                className={styles.actionButton}
                onClick={() => void runChange({ accessEnabled: true, operation: 'enable' })}
                disabled={busy || !apiToken.trim()}
              >
                Enable Wrapped
              </Button>
            )}
            {capability?.enabled && (
              <Button
                color="secondary"
                outline
                className={styles.actionButton}
                onClick={() => void runChange({ accessEnabled: false, operation: 'disable' })}
                disabled={busy || !apiToken.trim()}
              >
                Disable access
              </Button>
            )}
            {capability && (
              <Button color="secondary" outline className={styles.actionButton} onClick={checkHealth} disabled={busy}>
                Check health
              </Button>
            )}
            {capability && (
              <Button
                color="secondary"
                outline
                className={styles.actionButton}
                onClick={() => void runChange({ accessEnabled: capability.enabled, operation: 'redeploy' })}
                disabled={busy || !apiToken.trim()}
              >
                Redeploy
              </Button>
            )}
          </div>
        </>
      )}
      {capability && !availability.manageable && (
        <Button color="secondary" outline className={styles.actionButton} onClick={checkHealth} disabled={busy}>
          Check health
        </Button>
      )}
      {status && <div className={styles.statusNote}>{status}</div>}
    </section>
  );
};

export default AdminAgentSessionWrappedPanel;
