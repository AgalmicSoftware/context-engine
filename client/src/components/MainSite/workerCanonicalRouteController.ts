import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  parseSessionWorkerDiscoveryQuery,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery.js';
import type { AppShell } from './AppShell';

type WorkerCanonicalRouteControllerHost = Pick<
  AppShell,
  'getCurrentPathname' | 'getSessionTokenFromPath' | 'setState'
> &
  Partial<Pick<AppShell, 'getSessionSlugFromState'>>;
const controllersByHost = new WeakMap<object, WorkerCanonicalRouteController>();

export type WorkerCanonicalRouteController = {
  getActiveVerifiedConfig: (slug: unknown) => Record<string, unknown> | null;
  getVerifiedConfig: (slug: unknown, workerOrigin: unknown) => Record<string, unknown> | null;
  hasVerifiedRoute: (slug: unknown, workerOrigin: unknown) => boolean;
  handleBootstrapResolved: (bootstrap: WorkerCanonicalSessionBootstrap) => void;
  isSessionSlug: (slug: unknown) => boolean;
};

const buildVerifiedRouteKey = (slug: unknown, workerOrigin: unknown): string =>
  `${String(workerOrigin || '').trim()}\n${normalizeSessionSlug(slug)}`;

const createVerificationState = () => ({
  originsBySlug: new Map<string, string>(),
  bootstrapsByRoute: new Map<string, WorkerCanonicalSessionBootstrap>(),
});

const discardVerifiedSlug = (verification: ReturnType<typeof createVerificationState>, slug: string) => {
  const origin = verification.originsBySlug.get(slug);
  if (origin) verification.bootstrapsByRoute.delete(buildVerifiedRouteKey(slug, origin));
  verification.originsBySlug.delete(slug);
};

export const createWorkerCanonicalRouteController = (
  host: WorkerCanonicalRouteControllerHost,
): WorkerCanonicalRouteController => {
  // Home resolves its configured session independently of Workers opened through
  // session links. A shared same-slug map would silently replace Home's endpoint.
  const homeVerification = createVerificationState();
  const routeVerification = createVerificationState();
  const getVerificationState = () => (host.getCurrentPathname() === '/' ? homeVerification : routeVerification);
  const getVerifiedConfig = (slug: unknown, workerOrigin: unknown): Record<string, unknown> | null =>
    getVerificationState().bootstrapsByRoute.get(buildVerifiedRouteKey(slug, workerOrigin))?.config || null;
  const isSessionSlug = (slug: unknown): boolean => {
    const normalizedSlug = normalizeSessionSlug(slug);
    const search = typeof window !== 'undefined' ? window.location.search || '' : '';
    const path = host.getCurrentPathname();
    // Profile and comparison deep links carry their session in the query. Only
    // that exact route may use its live-verified config for cache hydration.
    const querySlugs = new URLSearchParams(search).getAll('session');
    const routeSlug = normalizeSessionSlug(
      path === '/'
        ? host.getSessionSlugFromState?.() || ''
        : /^\/(?:compare(?:\/|$)|u\/)/.test(path)
          ? querySlugs.length === 1
            ? querySlugs[0]
            : ''
          : host.getSessionTokenFromPath(path) || '',
    );
    const matchesExplicitRoute = !!routeSlug && routeSlug === normalizedSlug;
    try {
      const workerOrigin = parseSessionWorkerDiscoveryQuery(search);
      return matchesExplicitRoute && (!!workerOrigin || getVerificationState().originsBySlug.has(normalizedSlug));
    } catch {
      // Invalid explicit worker targets still suppress chain scans while the
      // route fails closed; query data itself never grants worker authority.
      return new URLSearchParams(search).has('worker') && matchesExplicitRoute;
    }
  };

  const buildBootstrapResolved =
    (verification: ReturnType<typeof createVerificationState>) => (bootstrap: WorkerCanonicalSessionBootstrap) => {
      // A boundary may finish after navigation. Its captured scope must not grant
      // authority to the new surface or reset that surface's cache readiness.
      if (verification !== getVerificationState()) return;
      const normalizedSlug = normalizeSessionSlug(bootstrap.sessionSlug);
      const routeKey = buildVerifiedRouteKey(normalizedSlug, bootstrap.workerOrigin);
      const otherVerification = verification === homeVerification ? routeVerification : homeVerification;
      const otherOrigin = otherVerification.originsBySlug.get(normalizedSlug);
      const otherBootstrap = otherVerification.bootstrapsByRoute.get(
        buildVerifiedRouteKey(normalizedSlug, otherOrigin),
      );
      // An accepted identity or config revision change invalidates the other surface's proof;
      // it must reverify before its config can hydrate caches again.
      if (
        otherBootstrap &&
        (otherBootstrap.workerOrigin !== bootstrap.workerOrigin ||
          otherBootstrap.sessionId !== bootstrap.sessionId ||
          otherBootstrap.configRevision !== bootstrap.configRevision)
      ) {
        discardVerifiedSlug(otherVerification, normalizedSlug);
      }
      discardVerifiedSlug(verification, normalizedSlug);
      verification.originsBySlug.set(normalizedSlug, bootstrap.workerOrigin);
      verification.bootstrapsByRoute.set(routeKey, bootstrap);
      host.setState<'sessionPathResolutionNonce'>((previousState) => ({
        sessionPathResolutionNonce: Number(previousState.sessionPathResolutionNonce || 0) + 1,
        ...(verification === homeVerification &&
        normalizeSessionSlug(host.getSessionSlugFromState?.()) === normalizedSlug
          ? {
              isQuestionCacheReady: false,
              isSurveyCacheReady: false,
              isResponsesCacheReady: false,
              isAllCachesReady: false,
              cacheHasLoaded: false,
              questionCacheInitializationError: false,
              surveyCacheInitializationError: false,
            }
          : {}),
      }));
    };
  const handleHomeBootstrapResolved = buildBootstrapResolved(homeVerification);
  const handleRouteBootstrapResolved = buildBootstrapResolved(routeVerification);

  return {
    getActiveVerifiedConfig: (slug) => {
      if (!isSessionSlug(slug)) return null;
      try {
        const search = typeof window !== 'undefined' ? window.location.search || '' : '';
        // A clean route still uses its live-verified Worker for cache hydration.
        // Explicit targets must never fall back to a previously verified origin.
        const workerOrigin = new URLSearchParams(search).has('worker')
          ? parseSessionWorkerDiscoveryQuery(search)
          : getVerificationState().originsBySlug.get(normalizeSessionSlug(slug));
        return workerOrigin ? getVerifiedConfig(slug, workerOrigin) : null;
      } catch {
        return null;
      }
    },

    getVerifiedConfig,

    hasVerifiedRoute: (slug, workerOrigin) =>
      getVerificationState().bootstrapsByRoute.has(buildVerifiedRouteKey(slug, workerOrigin)),

    // Stable within each surface, different across Home/route navigation so the
    // bootstrap effect cancels even when the slug and origin happen to match.
    get handleBootstrapResolved() {
      return getVerificationState() === homeVerification ? handleHomeBootstrapResolved : handleRouteBootstrapResolved;
    },

    isSessionSlug,
  };
};

export const getWorkerCanonicalRouteController = (
  host: WorkerCanonicalRouteControllerHost,
): WorkerCanonicalRouteController => {
  const cached = controllersByHost.get(host);
  if (cached) return cached;
  const controller = createWorkerCanonicalRouteController(host);
  controllersByHost.set(host, controller);
  return controller;
};
