import React from 'react';

import { BootRecoveryReady } from '../ErrorBoundary/InitialRouteBoundary';
import WorkerCanonicalSessionBootstrapBoundary from '../Sessions/WorkerCanonicalSessionBootstrapBoundary';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import { getVerifiedWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerConfigCache.js';
import { parseSessionWorkerDiscoveryQuery } from '../../utilities/session/sessionWorkerDiscovery.js';
import { DEFAULT_SESSION_SLUG } from '../../variables/appConfig.js';
import { resolveMainSiteSessionRouteContext } from './routeSessionResolution.js';
import { SessionLoadingSkeleton } from './routeStatusViews.js';
import type { AppShell } from './AppShell';
import type { WorkerCanonicalRouteController } from './workerCanonicalRouteController.js';

type SessionConfig = Record<string, any>;
type SessionRouteContext = ReturnType<typeof resolveMainSiteSessionRouteContext>;
type WorkerRouteKind = 'standard' | 'error' | 'bootstrap' | 'verified';

type WorkerCanonicalRouteState = {
  kind: WorkerRouteKind;
  error: string;
  workerOrigin: string;
  workerOnlySearch: string;
  workerSessionSlug: string;
  sessionConfig: SessionConfig | null;
};

export type MainSiteSessionRouteResolution = WorkerCanonicalRouteState & {
  sessionRoute: SessionRouteContext | null;
};

type ResolveWorkerRouteStateOptions = {
  searchStr: string;
  workerSessionSlug: string;
  controller: WorkerCanonicalRouteController;
  requireSessionSlug?: boolean;
  getVerifiedConfig?: typeof getVerifiedWorkerCanonicalSessionBootstrap;
};

type ResolveSessionRouteOptions = {
  sessionTokenRaw: string;
  searchStr: string;
  controller: WorkerCanonicalRouteController;
  resolveSessionSlugFromPathToken: (sessionToken: string) => string;
  resolveStandardSessionRoute?: typeof resolveMainSiteSessionRouteContext;
  getVerifiedConfig?: typeof getVerifiedWorkerCanonicalSessionBootstrap;
};

const emptyWorkerRouteState = (): WorkerCanonicalRouteState => ({
  kind: 'standard',
  error: '',
  workerOrigin: '',
  workerOnlySearch: '',
  workerSessionSlug: '',
  sessionConfig: null,
});

const resolveWorkerRouteState = ({
  searchStr,
  workerSessionSlug,
  controller,
  requireSessionSlug = false,
  getVerifiedConfig = getVerifiedWorkerCanonicalSessionBootstrap,
}: ResolveWorkerRouteStateOptions): WorkerCanonicalRouteState => {
  let workerOrigin = '';
  try {
    workerOrigin = parseSessionWorkerDiscoveryQuery(searchStr);
  } catch (error) {
    return {
      ...emptyWorkerRouteState(),
      kind: 'error',
      error: error instanceof Error ? error.message : 'Invalid worker discovery URL.',
    };
  }
  if (!workerOrigin) return emptyWorkerRouteState();

  const normalizedSlug = normalizeSessionSlug(workerSessionSlug);
  const workerOnlySearch = `?worker=${encodeURIComponent(workerOrigin)}`;
  if (requireSessionSlug && !normalizedSlug) {
    return {
      kind: 'error',
      error: 'Worker-canonical admin links require a sessionSlug.',
      workerOrigin,
      workerOnlySearch,
      workerSessionSlug: '',
      sessionConfig: null,
    };
  }

  const sessionConfig =
    normalizedSlug && controller.hasVerifiedRoute(normalizedSlug, workerOrigin)
      ? getVerifiedConfig({ slug: normalizedSlug, workerOrigin })
      : null;
  return {
    kind: sessionConfig ? 'verified' : 'bootstrap',
    error: '',
    workerOrigin,
    workerOnlySearch,
    workerSessionSlug: normalizedSlug,
    sessionConfig,
  };
};

export const resolveMainSiteAdminWorkerRoute = ({
  searchStr,
  controller,
  getVerifiedConfig,
}: {
  searchStr: string;
  controller: WorkerCanonicalRouteController;
  getVerifiedConfig?: typeof getVerifiedWorkerCanonicalSessionBootstrap;
}): WorkerCanonicalRouteState => {
  const searchParams = new URLSearchParams(searchStr);
  return resolveWorkerRouteState({
    searchStr,
    workerSessionSlug: searchParams.get('sessionSlug') || '',
    controller,
    requireSessionSlug: true,
    getVerifiedConfig,
  });
};

export const resolveMainSiteSessionRouteForRender = ({
  sessionTokenRaw,
  searchStr,
  controller,
  resolveSessionSlugFromPathToken,
  resolveStandardSessionRoute = resolveMainSiteSessionRouteContext,
  getVerifiedConfig,
}: ResolveSessionRouteOptions): MainSiteSessionRouteResolution => {
  const workerRoute = resolveWorkerRouteState({
    searchStr,
    workerSessionSlug: sessionTokenRaw,
    controller,
    getVerifiedConfig,
  });
  if (workerRoute.kind !== 'standard') {
    return {
      ...workerRoute,
      sessionRoute:
        workerRoute.kind === 'error'
          ? null
          : {
              sessionIdFromPath: null,
              configBySessionId: null,
              sessionSlug: workerRoute.workerSessionSlug,
              sessionConfig: workerRoute.sessionConfig,
              hasUnresolvedSessionId: false,
            },
    };
  }

  return {
    ...workerRoute,
    sessionRoute: resolveStandardSessionRoute({
      sessionTokenRaw,
      formatSessionId: sessionRegistryReadsPort.formatSessionId,
      resolveSessionConfigById: (sessionId: string | number) =>
        sessionRegistryReadsPort.getSessionConfigById(sessionId),
      resolveSessionConfigBySlug: (slug: string) =>
        sessionRegistryReadsPort.getSessionConfig(slug) || getSessionConfigBySlug(slug),
      resolveDisplaySessionConfigBySlug: (slug: string) =>
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) ||
        (normalizeSessionSlug(slug) === 'demo' ? getDemoSessionConfigBySlug('', { allowDemoFallback: true }) : null),
      resolveSessionSlugFromPathToken: (sessionToken: string) =>
        sessionToken ? resolveSessionSlugFromPathToken(sessionToken) : DEFAULT_SESSION_SLUG,
    }),
  };
};

export const renderWorkerCanonicalRouteError = (route: WorkerCanonicalRouteState): React.ReactElement | null =>
  route.kind === 'error' ? (
    <>
      <div role="alert" data-testid="ce-worker-canonical-discovery-error">
        <h3>Worker discovery record missing or invalid</h3>
        <p>{route.error}</p>
        <a href={buildPublicRoute('/new')}>Return to session selection</a>
      </div>
      <BootRecoveryReady />
    </>
  ) : null;

export const renderWorkerCanonicalRouteBootstrap = (
  route: WorkerCanonicalRouteState,
  controller: WorkerCanonicalRouteController,
): React.ReactElement | null =>
  route.kind === 'bootstrap' ? (
    <WorkerCanonicalSessionBootstrapBoundary
      sessionSlug={route.workerSessionSlug}
      workerQueryValue={route.workerOrigin}
      onResolved={controller.handleBootstrapResolved}
    />
  ) : null;

export const renderUnresolvedMainSiteSessionId = (
  sessionRoute: SessionRouteContext,
  host: Pick<AppShell, '_sessionPathResolver' | 'resolveSessionPathId'>,
): React.ReactElement | null => {
  if (!sessionRoute.hasUnresolvedSessionId) return null;
  const unresolvedSessionId = sessionRoute.sessionIdFromPath!;
  const idStatus = host._sessionPathResolver.getIdStatus(unresolvedSessionId);
  const recentError = !!(idStatus.lastErrorTs && Date.now() - idStatus.lastErrorTs < 2 * 60 * 1000);
  const keepResolving = recentError && idStatus.retryCount > 0;
  host.resolveSessionPathId(unresolvedSessionId);
  if (!idStatus.hasAttempted || idStatus.isPending || keepResolving) {
    return <SessionLoadingSkeleton statusTitle={`Resolving ${unresolvedSessionId} Session...`} />;
  }
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
          color: 'rgba(244,247,255,0.65)',
        }}
      >
        <h3>Session Not Found</h3>
        <p>No session metadata was found for {unresolvedSessionId}.</p>
      </div>
      <BootRecoveryReady />
    </>
  );
};

export const renderMissingMainSiteSessionConfig = ({
  sessionConfig,
  slug,
  workerRoute,
  workerController,
  host,
}: {
  sessionConfig: SessionRouteContext['sessionConfig'];
  slug: string;
  workerRoute: WorkerCanonicalRouteState;
  workerController: WorkerCanonicalRouteController;
  host: Pick<AppShell, '_sessionPathResolver' | 'resolveSessionPathSlug'>;
}): React.ReactElement | null => {
  if (sessionConfig) return null;
  const workerBootstrap = renderWorkerCanonicalRouteBootstrap(workerRoute, workerController);
  if (workerBootstrap) return workerBootstrap;
  if (!slug) {
    return (
      <>
        <div>Session not found.</div>
        <BootRecoveryReady />
      </>
    );
  }

  const slugStatus = host._sessionPathResolver.getSlugStatus(slug);
  const recentError = !!(slugStatus.lastErrorTs && Date.now() - slugStatus.lastErrorTs < 2 * 60 * 1000);
  const keepResolving = recentError && slugStatus.retryCount > 0;
  host.resolveSessionPathSlug(slug);
  if (!slugStatus.hasAttempted || slugStatus.isPending || keepResolving) {
    return <SessionLoadingSkeleton statusTitle={`Resolving ${slug} Session...`} />;
  }
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
          color: 'rgba(244,247,255,0.65)',
        }}
      >
        <h3>Session Not Found</h3>
        <p>No session metadata was found for {slug}.</p>
      </div>
      <BootRecoveryReady />
    </>
  );
};
