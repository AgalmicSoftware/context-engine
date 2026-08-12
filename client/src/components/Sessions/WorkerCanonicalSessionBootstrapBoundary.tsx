import React, { useEffect, useState } from 'react';

import { BootRecoveryReady } from '../ErrorBoundary/InitialRouteBoundary';
import {
  fetchWorkerCanonicalSessionBootstrap,
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
};

type BootstrapViewState = {
  kind: 'loading' | 'ready' | 'error';
  message: string;
};

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
}: WorkerCanonicalSessionBootstrapBoundaryProps) => {
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
        const bootstrap = await fetchWorkerCanonicalSessionBootstrap({
          sessionSlug,
          workerQueryValue,
          environment,
          fetchImpl,
          signal: abortController.signal,
        });
        if (!active) return;

        let cacheResult = cacheBootstrap(bootstrap, false);
        if (cacheResult.status === 'conflict') {
          const approved = await confirmWorkerOriginChange(
            `Session "${bootstrap.sessionSlug}" was previously linked to ${cacheResult.existingWorkerOrigin}. ` +
              `Trust and replace it with ${bootstrap.workerOrigin}?`,
            confirmRepin,
          );
          if (!active) return;
          if (!approved) throw new Error('Worker origin change was not approved.');
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
        });
      }
    };

    void resolveBootstrap();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [confirmRepin, environment, fetchImpl, onResolved, sessionSlug, workerQueryValue]);

  if (viewState.kind === 'error') {
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
        <BootRecoveryReady />
      </>
    );
  }

  return (
    <div role="status" aria-live="polite" data-testid="ce-worker-canonical-bootstrap-status">
      {viewState.message}
    </div>
  );
};

export default WorkerCanonicalSessionBootstrapBoundary;
