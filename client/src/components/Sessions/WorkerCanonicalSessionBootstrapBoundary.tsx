import { useEffect, useState, type ReactNode } from 'react';

import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import LazyFallback from '../Shared/LazyFallback';
import { BootRecoveryReady } from '../ErrorBoundary/InitialRouteBoundary';
import {
  fetchWorkerCanonicalSessionBootstrap,
  describeWorkerSessionBootstrapError,
  isRetryableWorkerSessionBootstrapError,
  parseSessionWorkerDiscoveryOrigin,
  type DiscoveryEnvironment,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery';
import {
  markWorkerCanonicalSessionBootstrapVerified,
  readSessionWorkerConfigCache,
  upsertWorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerConfigCache.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';

type WorkerCanonicalSessionBootstrapBoundaryProps = {
  sessionSlug: string;
  workerQueryValue: unknown;
  onResolved: (bootstrap: WorkerCanonicalSessionBootstrap) => void;
  environment?: DiscoveryEnvironment;
  fetchImpl?: typeof fetch;
  confirmRepin?: ((message: string) => boolean | Promise<boolean>) | null;
  retryDelaysMs?: readonly number[];
  missingConfigFallback?: ReactNode;
};

type BootstrapViewState = {
  kind: 'loading' | 'ready' | 'error';
  title?: string;
  errorKind?: string;
  message: string;
  canRetry?: boolean;
  recoveryWorkerOrigin?: string;
  recoverySessionSlug?: string;
};

const DEFAULT_RETRY_DELAYS_MS = [250, 750] as const;
// Keep activation recovery bounded even when a test or future caller supplies a longer schedule.
const MAX_AUTOMATIC_RETRY_ATTEMPTS = 2;

const waitForRetryDelay = (delayMs: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (delayMs <= 0 || signal.aborted) {
      resolve();
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    timeoutId = setTimeout(finish, delayMs);
    signal.addEventListener('abort', finish, { once: true });
  });

const cacheBootstrap = (bootstrap: WorkerCanonicalSessionBootstrap, allowRepin: boolean) =>
  upsertWorkerCanonicalSessionBootstrap({
    slug: bootstrap.sessionSlug,
    sessionIdHex: bootstrap.sessionId,
    workerOrigin: bootstrap.workerOrigin,
    configRevision: bootstrap.configRevision,
    config: bootstrap.config,
    allowRepin,
  });

const confirmWorkerOriginChange = async (
  message: string,
  confirmRepin: WorkerCanonicalSessionBootstrapBoundaryProps['confirmRepin'],
): Promise<boolean> => {
  if (typeof confirmRepin === 'function') return Boolean(await confirmRepin(message));
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') return window.confirm(message);
  return false;
};

const WorkerCanonicalSessionBootstrapBoundary = ({
  sessionSlug,
  workerQueryValue,
  onResolved,
  environment,
  fetchImpl,
  confirmRepin,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  missingConfigFallback,
}: WorkerCanonicalSessionBootstrapBoundaryProps) => {
  const hasMissingConfigFallback = Boolean(missingConfigFallback);
  const [retryNonce, setRetryNonce] = useState(0);
  const [viewState, setViewState] = useState<BootstrapViewState>({
    kind: 'loading',
    message: 'Loading Session',
  });

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    setViewState({ kind: 'loading', message: 'Loading Session' });

    const resolveBootstrap = async () => {
      try {
        let bootstrap: WorkerCanonicalSessionBootstrap | null = null;
        for (let attempt = 0; bootstrap === null; attempt += 1) {
          try {
            bootstrap = await fetchWorkerCanonicalSessionBootstrap({
              sessionSlug,
              workerQueryValue,
              environment,
              fetchImpl,
              signal: abortController.signal,
            });
          } catch (error) {
            const retryCount = Math.min(retryDelaysMs.length, MAX_AUTOMATIC_RETRY_ATTEMPTS);
            if (!isRetryableWorkerSessionBootstrapError(error) || attempt >= retryCount) throw error;
            if (active) setViewState({ kind: 'loading', message: 'Worker is still activating… Retrying…' });
            await waitForRetryDelay(Number(retryDelaysMs[attempt]) || 0, abortController.signal);
            if (!active || abortController.signal.aborted) return;
          }
        }
        if (!active) return;

        let cacheResult = cacheBootstrap(bootstrap, false);
        if (cacheResult.status === 'conflict') {
          const existingSlug = typeof cacheResult.config?.slug === 'string' ? cacheResult.config.slug.trim() : '';
          const slugChanged = !!existingSlug && existingSlug !== bootstrap.sessionSlug;
          const originChanged = cacheResult.existingWorkerOrigin !== bootstrap.workerOrigin;
          const identityChanged = cacheResult.existingSessionIdHex !== bootstrap.sessionId;
          const changeSummary = [
            slugChanged
              ? `session slug "${existingSlug}" -> "${bootstrap.sessionSlug}"`
              : `session slug "${bootstrap.sessionSlug}"`,
            originChanged
              ? `worker origin ${cacheResult.existingWorkerOrigin} -> ${bootstrap.workerOrigin}`
              : `worker origin ${bootstrap.workerOrigin}`,
            identityChanged
              ? `session ID ${cacheResult.existingSessionIdHex} -> ${bootstrap.sessionId}`
              : `session ID ${bootstrap.sessionId}`,
          ].join('; ');
          const approved = await confirmWorkerOriginChange(
            `Session "${bootstrap.sessionSlug}" has a different canonical worker identity (${changeSummary}). ` +
              'Trust and replace the previously pinned identity?',
            confirmRepin,
          );
          if (!active) return;
          if (!approved) throw new Error('Worker identity change was not approved.');
          cacheResult = cacheBootstrap(bootstrap, true);
        }
        if (cacheResult.status !== 'cached') {
          throw new Error('Worker session bootstrap could not be cached.');
        }
        const markedVerified = markWorkerCanonicalSessionBootstrapVerified({
          slug: bootstrap.sessionSlug,
          sessionIdHex: bootstrap.sessionId,
          workerOrigin: bootstrap.workerOrigin,
        });
        if (!markedVerified) {
          throw new Error('Worker session bootstrap could not be verified.');
        }

        if (!active) return;
        onResolved(bootstrap);
        if (active) setViewState({ kind: 'ready', message: 'Worker session ready.' });
      } catch (error) {
        if (!active || abortController.signal.aborted) return;
        let descriptor = describeWorkerSessionBootstrapError(error);
        let recoveryWorkerOrigin = '';
        if (descriptor.kind === 'missing_config' && hasMissingConfigFallback) {
          try {
            const target = parseSessionWorkerDiscoveryOrigin(workerQueryValue, { environment });
            const pinnedOrigins = [
              ...new Set(
                Object.values(readSessionWorkerConfigCache().bySession)
                  .filter(
                    (record) =>
                      record.authorityMode === 'worker_canonical' && record.slug === normalizeSessionSlug(sessionSlug),
                  )
                  .map((record) => String(record.workerOrigin || ''))
                  .filter((origin) => origin && origin !== target),
              ),
            ];
            if (
              pinnedOrigins.length &&
              !(await confirmWorkerOriginChange(
                `Session "${sessionSlug}" is pinned to Worker ${pinnedOrigins.join(', ')}. ` +
                  `The restore target is ${target}. Trust this different Worker for restoring the backup?`,
                confirmRepin,
              ))
            )
              throw new Error('Worker identity change was not approved.');
            // No config exists to pin yet. Approval is scoped to this rendered
            // recovery target; a later successful bootstrap still verifies it.
            recoveryWorkerOrigin = target;
          } catch (failure) {
            descriptor = describeWorkerSessionBootstrapError(failure);
          }
          if (!active || abortController.signal.aborted) return;
        }
        setViewState({
          kind: 'error',
          title: descriptor.title,
          errorKind: descriptor.kind,
          message: descriptor.message,
          canRetry: descriptor.canRetry,
          recoveryWorkerOrigin,
          recoverySessionSlug: sessionSlug,
        });
      }
    };

    void resolveBootstrap();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [
    confirmRepin,
    environment,
    fetchImpl,
    onResolved,
    retryDelaysMs,
    retryNonce,
    sessionSlug,
    workerQueryValue,
    hasMissingConfigFallback,
  ]);

  if (viewState.kind === 'error') {
    let safeWorkerOrigin = '';
    try {
      safeWorkerOrigin = parseSessionWorkerDiscoveryOrigin(workerQueryValue, { environment });
    } catch {
      safeWorkerOrigin = '';
    }
    const adminHref = buildPublicRoute(
      `/admin?sessionSlug=${encodeURIComponent(sessionSlug)}${
        safeWorkerOrigin ? `&worker=${encodeURIComponent(safeWorkerOrigin)}` : ''
      }`,
    );
    return (
      <>
        <div role="alert" aria-live="assertive" data-testid="ce-worker-canonical-bootstrap-error">
          <h3>{viewState.title}</h3>
          <div>{viewState.message}</div>
          <div>
            {viewState.canRetry && (
              <button
                type="button"
                aria-label="Retry worker session"
                onClick={() => setRetryNonce((value) => value + 1)}
              >
                Retry
              </button>
            )}
            <a href={adminHref}>Open Admin</a>
            <a href={buildPublicRoute('/new')}>Return to session selection</a>
          </div>
        </div>
        {viewState.errorKind === 'missing_config' &&
          viewState.recoveryWorkerOrigin === safeWorkerOrigin &&
          viewState.recoverySessionSlug === sessionSlug &&
          missingConfigFallback}
        <BootRecoveryReady />
      </>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ce-worker-canonical-bootstrap-status"
      style={{ color: 'var(--ce-loading-text)' }}
    >
      {viewState.kind === 'loading' ? (
        <LazyFallback
          label={
            <span style={{ fontSize: '1.5rem' }}>
              <ElapsedLoadingLabel key={`${sessionSlug}:${retryNonce}`} label={viewState.message} />
            </span>
          }
        />
      ) : (
        viewState.message
      )}
    </div>
  );
};

export default WorkerCanonicalSessionBootstrapBoundary;
