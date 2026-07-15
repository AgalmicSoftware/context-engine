import React, { useEffect, useState } from 'react';

import {
  fetchWorkerCanonicalSessionBootstrap,
  isRetryableWorkerSessionBootstrapError,
  type DiscoveryEnvironment,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery';
import {
  markWorkerCanonicalSessionBootstrapVerified,
  upsertWorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerConfigCache.js';

type WorkerCanonicalSessionBootstrapBoundaryProps = {
  sessionSlug: string;
  workerQueryValue: unknown;
  onResolved: (bootstrap: WorkerCanonicalSessionBootstrap) => void;
  environment?: DiscoveryEnvironment;
  fetchImpl?: typeof fetch;
  confirmRepin?: ((message: string) => boolean | Promise<boolean>) | null;
  retryDelaysMs?: readonly number[];
};

type BootstrapViewState = {
  kind: 'loading' | 'ready' | 'error';
  message: string;
  canRetry?: boolean;
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
}: WorkerCanonicalSessionBootstrapBoundaryProps) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [viewState, setViewState] = useState<BootstrapViewState>({
    kind: 'loading',
    message: 'Loading worker session…',
  });

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    setViewState({ kind: 'loading', message: 'Loading worker session…' });

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
        setViewState({
          kind: 'error',
          message: error instanceof Error && error.message ? error.message : 'Worker session bootstrap failed.',
          canRetry: isRetryableWorkerSessionBootstrapError(error),
        });
      }
    };

    void resolveBootstrap();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [confirmRepin, environment, fetchImpl, onResolved, retryDelaysMs, retryNonce, sessionSlug, workerQueryValue]);

  if (viewState.kind === 'error') {
    return (
      <div role="alert" aria-live="assertive" data-testid="ce-worker-canonical-bootstrap-error">
        <div>{viewState.message}</div>
        {viewState.canRetry && (
          <button type="button" aria-label="Retry worker session" onClick={() => setRetryNonce((value) => value + 1)}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" data-testid="ce-worker-canonical-bootstrap-status">
      {viewState.message}
    </div>
  );
};

export default WorkerCanonicalSessionBootstrapBoundary;
