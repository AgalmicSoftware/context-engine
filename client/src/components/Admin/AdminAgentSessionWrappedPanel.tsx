import { useEffect, useMemo, useState } from 'react';
import { Button } from 'reactstrap';
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
};

const AdminAgentSessionWrappedPanel = ({
  canAdminWorker,
  sessionConfig,
  sessionSlug,
  sessionWorkerUrl,
  postSignedRequest,
  ensureSessionWorkerAttached,
  onConfigUpdated,
}: AdminAgentSessionWrappedPanelProps) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [localCapability, setLocalCapability] = useState<AgentSessionWrappedCapability | null>(null);
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
    setBusy(false);
    setStatus('');
    setLocalCapability(null);
  }, [sessionSlug, sessionWorkerUrl]);

  const runChange = async ({ accessEnabled }: { accessEnabled: boolean }) => {
    if (!availability.manageable || busy) return;
    setBusy(true);
    setStatus(accessEnabled ? 'Saving and verifying Wrapped access…' : 'Disabling Wrapped access…');
    try {
      const result = await applyAdminAgentSessionWrappedChange({
        accessEnabled,
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
      setStatus(
        result.capability.enabled
          ? 'Wrapped access enabled and published.'
          : 'Wrapped access disabled; deployed resources were retained.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Wrapped configuration failed.');
    } finally {
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
      setLocalCapability(result.capability);
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
            The Session Worker handles agent access and membership checks. Wrapped answers are separate from ordinary
            responses.
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
          <a
            href={`${capability.origin}/capabilities?slug=${encodeURIComponent(sessionSlug)}`}
            target="_blank"
            rel="noreferrer"
          >
            {capability.origin}
          </a>
        </div>
      )}
      {availability.manageable && (
        <>
          <div className={styles.formRow}>
            {!capability?.enabled && (
              <Button
                color="primary"
                className={styles.actionButton}
                onClick={() => void runChange({ accessEnabled: true })}
                disabled={busy}
              >
                Enable Wrapped
              </Button>
            )}
            {capability?.enabled && (
              <Button
                color="secondary"
                outline
                className={styles.actionButton}
                onClick={() => void runChange({ accessEnabled: false })}
                disabled={busy}
              >
                Disable access
              </Button>
            )}
            {capability && (
              <Button color="secondary" outline className={styles.actionButton} onClick={checkHealth} disabled={busy}>
                Check health
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
