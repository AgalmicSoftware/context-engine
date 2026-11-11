import React from 'react';

import { BootRecoveryReady } from '../ErrorBoundary/InitialRouteBoundary';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import WorkerCanonicalSessionBootstrapBoundary from '../Sessions/WorkerCanonicalSessionBootstrapBoundary';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import {
  getVerifiedWorkerCanonicalSessionBootstrap,
  readSessionWorkerConfigCache,
} from '../../utilities/session/sessionWorkerConfigCache.js';
import { claimsWorkerCanonicalAuthority } from '../../utilities/session/sessionCapabilityProjection.js';
import { KNOWN_SESSION_CONFIGS } from '../../utilities/session/knownSessionsFile';
import {
  normalizeWorkerCanonicalSessionIdHex,
  parseSessionWorkerDiscoveryOrigin,
  parseSessionWorkerDiscoveryQuery,
  resolveWorkerCanonicalSessionIdHex,
  validateWorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery.js';
import { DEFAULT_SESSION_SLUG } from '../../variables/appConfig.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { resolveMainSiteSessionRouteContext } from './routeSessionResolution.js';
import { SessionLoadingSkeleton } from './routeStatusViews.js';
import type { AppShell } from './AppShell';
import type { WorkerCanonicalRouteController } from './workerCanonicalRouteController.js';

type SessionConfig = Record<string, unknown>;
type SessionRouteContext = ReturnType<typeof resolveMainSiteSessionRouteContext>;
type WorkerRouteKind = 'standard' | 'error' | 'bootstrap' | 'verified';

type WorkerCanonicalRouteState = {
  kind: WorkerRouteKind;
  error: string;
  workerOrigin: string;
  workerOnlySearch: string;
  workerSessionSlug: string;
  sessionConfig: SessionConfig | null;
  // A bundled entry's session ID: its Worker must report the same one.
  expectedSessionId?: string;
};

export type MainSiteSessionRouteResolution = WorkerCanonicalRouteState & {
  sessionRoute: SessionRouteContext | null;
};

export type VerifiedWorkerCanonicalLitRouteConfig = {
  explicitWorkerRoute: boolean;
  sessionConfig: SessionConfig | null;
  sessionSlug: string;
  workerOrigin: string;
};

export type WorkerCanonicalLitRouteContext = Omit<VerifiedWorkerCanonicalLitRouteConfig, 'sessionConfig'>;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const resolveTrustedBundledWorker = (
  sessionConfig: SessionConfig | null | undefined,
): { origin: string; sessionId: string } | null => {
  if (!isRecord(sessionConfig) || sessionConfig.workerCanonicalCleanRoute !== true) return null;
  const profile = isRecord(sessionConfig.sessionModeProfile) ? sessionConfig.sessionModeProfile : {};
  const authority = isRecord(profile.authority) ? profile.authority : {};
  const sessionId = normalizeWorkerCanonicalSessionIdHex(sessionConfig.sessionId);
  if (authority.mode !== 'worker_canonical' || !sessionId) return null;
  try {
    return { origin: parseSessionWorkerDiscoveryOrigin(sessionConfig.corsWorkerUrl), sessionId };
  } catch {
    return null;
  }
};

// A bundled entry opens only the session it names. A cached config for
// another session goes back through bootstrap, which refuses a Worker
// reporting a different ID.
const requireBundledSessionId = (route: WorkerCanonicalRouteState, sessionId: string): WorkerCanonicalRouteState =>
  !route.sessionConfig || resolveWorkerCanonicalSessionIdHex(route.sessionConfig) === sessionId
    ? { ...route, expectedSessionId: sessionId }
    : { ...route, kind: 'bootstrap', sessionConfig: null, expectedSessionId: sessionId };

// Any link that reaches a listed session's own Worker, such as the event
// redirect's worker= link or a group page, opens only the listed session ID.
const requireKnownSessionId = (route: WorkerCanonicalRouteState): WorkerCanonicalRouteState => {
  const knownWorker = resolveTrustedBundledWorker(KNOWN_SESSION_CONFIGS[route.workerSessionSlug]);
  return knownWorker?.origin === route.workerOrigin ? requireBundledSessionId(route, knownWorker.sessionId) : route;
};

const emptyWorkerRouteState = (): WorkerCanonicalRouteState => ({
  kind: 'standard',
  error: '',
  workerOrigin: '',
  workerOnlySearch: '',
  workerSessionSlug: '',
  sessionConfig: null,
});

export const resolveWorkerCanonicalLitRouteContext = ({
  sessionTokenRaw,
  searchStr,
}: {
  sessionTokenRaw: string;
  searchStr: string;
}): WorkerCanonicalLitRouteContext => {
  const sessionSlug = normalizeSessionSlug(sessionTokenRaw);
  const explicitWorkerRoute = !!sessionSlug && new URLSearchParams(searchStr).has('worker');
  if (!explicitWorkerRoute) {
    return { explicitWorkerRoute: false, sessionSlug, workerOrigin: '' };
  }

  let workerOrigin = '';
  try {
    workerOrigin = parseSessionWorkerDiscoveryQuery(searchStr);
  } catch {
    return { explicitWorkerRoute: true, sessionSlug, workerOrigin: '' };
  }
  return { explicitWorkerRoute: true, sessionSlug, workerOrigin };
};

export const resolveVerifiedWorkerCanonicalLitRouteConfig = ({
  sessionTokenRaw,
  searchStr,
  controller,
  getVerifiedConfig = getVerifiedWorkerCanonicalSessionBootstrap,
}: {
  sessionTokenRaw: string;
  searchStr: string;
  controller: WorkerCanonicalRouteController;
  getVerifiedConfig?: typeof getVerifiedWorkerCanonicalSessionBootstrap;
}): VerifiedWorkerCanonicalLitRouteConfig => {
  const { explicitWorkerRoute, sessionSlug, workerOrigin } = resolveWorkerCanonicalLitRouteContext({
    sessionTokenRaw,
    searchStr,
  });
  if (!explicitWorkerRoute) {
    return { explicitWorkerRoute: false, sessionConfig: null, sessionSlug, workerOrigin: '' };
  }
  if (!workerOrigin || !controller.hasVerifiedRoute(sessionSlug, workerOrigin)) {
    return { explicitWorkerRoute: true, sessionConfig: null, sessionSlug, workerOrigin };
  }

  const cachedConfig = getVerifiedConfig({ slug: sessionSlug, workerOrigin });
  if (!cachedConfig) {
    return { explicitWorkerRoute: true, sessionConfig: null, sessionSlug, workerOrigin };
  }
  try {
    const bootstrap = validateWorkerCanonicalSessionBootstrap(
      {
        ok: true,
        sessionSlug,
        config: cachedConfig,
      },
      { expectedSlug: sessionSlug, workerOrigin },
    );
    return {
      explicitWorkerRoute: true,
      sessionConfig: bootstrap.config,
      sessionSlug: bootstrap.sessionSlug,
      workerOrigin: bootstrap.workerOrigin,
    };
  } catch {
    // Query routing is never authority: only the validated, verified cache may
    // supply runtime Lit configuration, even after a prior route resolution.
    return { explicitWorkerRoute: true, sessionConfig: null, sessionSlug, workerOrigin };
  }
};

const resolveWorkerRouteState = ({
  searchStr,
  workerSessionSlug,
  controller,
  requireSessionSlug = false,
  getVerifiedConfig = getVerifiedWorkerCanonicalSessionBootstrap,
}: ResolveWorkerRouteStateOptions): WorkerCanonicalRouteState => {
  const workerDiscoveryValues = new URLSearchParams(searchStr).getAll('worker');
  if (workerDiscoveryValues.length === 1 && !workerDiscoveryValues[0].trim()) {
    return {
      ...emptyWorkerRouteState(),
      kind: 'error',
      error: 'No Session Worker origin is available in this discovery link.',
    };
  }
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
  if (!workerOrigin) {
    if (new URLSearchParams(searchStr).has('worker')) {
      return {
        ...emptyWorkerRouteState(),
        kind: 'error',
        error: 'No Session Worker origin is available in this discovery link.',
      };
    }
    return emptyWorkerRouteState();
  }

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
  return requireKnownSessionId({
    kind: sessionConfig ? 'verified' : 'bootstrap',
    error: '',
    workerOrigin,
    workerOnlySearch,
    workerSessionSlug: normalizedSlug,
    sessionConfig,
  });
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

export const resolveMainSiteGroupWorkerRoute = ({
  searchStr,
  workerSessionSlug,
  sessionConfig,
  controller,
}: ResolveWorkerRouteStateOptions & { sessionConfig: unknown }): WorkerCanonicalRouteState => {
  const options = { searchStr, workerSessionSlug, controller };
  if (new URLSearchParams(searchStr).has('worker') || !workerSessionSlug) return resolveWorkerRouteState(options);
  const slug = normalizeSessionSlug(workerSessionSlug);
  const exactConfig =
    isRecord(sessionConfig) && normalizeSessionSlug(sessionConfig.slug) === slug ? sessionConfig : null;
  // An exact configured registry session takes precedence over old local hints.
  if (exactConfig && !claimsWorkerCanonicalAuthority(exactConfig)) return emptyWorkerRouteState();
  const records = Object.values(readSessionWorkerConfigCache().bySession).filter(
    (record) => record.authorityMode === 'worker_canonical' && normalizeSessionSlug(record.slug) === slug,
  );
  if (!exactConfig && records.length > 1) {
    return {
      ...emptyWorkerRouteState(),
      kind: 'error',
      error: 'Several Workers match this session. Open the original session link to choose the correct one.',
    };
  }
  const origin = exactConfig?.corsWorkerUrl || (records.length === 1 ? records[0].workerOrigin : '');
  if (!origin && !exactConfig) return emptyWorkerRouteState();
  // Persisted config is only a discovery hint. Every fresh page must fetch and
  // verify the Worker identity before rendering groups or authorizing actions.
  return resolveWorkerRouteState({ ...options, searchStr: `?worker=${encodeURIComponent(String(origin || ''))}` });
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
  const buildWorkerSessionRoute = (route: WorkerCanonicalRouteState): MainSiteSessionRouteResolution => ({
    ...route,
    sessionRoute:
      route.kind === 'error'
        ? null
        : {
            sessionIdFromPath: null,
            configBySessionId: null,
            sessionSlug: route.workerSessionSlug,
            sessionConfig: route.sessionConfig,
            hasUnresolvedSessionId: false,
          },
  });

  if (workerRoute.kind !== 'standard') {
    return buildWorkerSessionRoute(workerRoute);
  }

  const routeSlug = normalizeSessionSlug(
    sessionTokenRaw ? resolveSessionSlugFromPathToken(sessionTokenRaw) || sessionTokenRaw : DEFAULT_SESSION_SLUG,
  );
  const registrySessionConfig = routeSlug ? sessionRegistryReadsPort.getSessionConfig(routeSlug) : null;
  const bundledDisplayConfig = registrySessionConfig
    ? null
    : getDemoSessionConfigBySlug(routeSlug, { allowDemoFallback: true });
  const bundledWorker = resolveTrustedBundledWorker(bundledDisplayConfig);
  if (bundledWorker) {
    const trustedWorkerRoute = resolveWorkerRouteState({
      searchStr: `?worker=${encodeURIComponent(bundledWorker.origin)}`,
      workerSessionSlug: routeSlug,
      controller,
      getVerifiedConfig,
    });
    if (trustedWorkerRoute.kind !== 'standard') {
      return buildWorkerSessionRoute(requireBundledSessionId(trustedWorkerRoute, bundledWorker.sessionId));
    }
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
      <div
        className={`${setupStyles.banner} ${setupStyles.pageBanner}`}
        role="alert"
        data-testid="ce-worker-canonical-discovery-error"
      >
        <h3 className={setupStyles.bannerTitle}>Worker discovery record missing or invalid</h3>
        <div>{route.error}</div>
        <div className={setupStyles.buttonRow}>
          <a className={setupStyles.button} data-ce-control-appearance="raised" href={buildPublicRoute('/new')}>
            Return to session selection
          </a>
        </div>
      </div>
      <BootRecoveryReady />
    </>
  ) : null;

export const renderWorkerCanonicalRouteBootstrap = (
  route: WorkerCanonicalRouteState,
  controller: WorkerCanonicalRouteController,
  missingConfigFallback?: React.ReactNode,
): React.ReactElement | null =>
  route.kind === 'bootstrap' ? (
    <WorkerCanonicalSessionBootstrapBoundary
      sessionSlug={route.workerSessionSlug}
      workerQueryValue={route.workerOrigin}
      expectedSessionId={route.expectedSessionId}
      onResolved={controller.handleBootstrapResolved}
      missingConfigFallback={missingConfigFallback}
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
          color: 'var(--ce-panel-text-muted)',
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
          color: 'var(--ce-panel-text-muted)',
        }}
      >
        <h3>Session Not Found</h3>
        <p>No session metadata was found for {slug}.</p>
      </div>
      <BootRecoveryReady />
    </>
  );
};
