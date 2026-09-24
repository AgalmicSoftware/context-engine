import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  parseSessionWorkerDiscoveryQuery,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery.js';
import type { AppShell } from './AppShell';

type WorkerCanonicalRouteControllerHost = Pick<AppShell, 'getCurrentPathname' | 'getSessionTokenFromPath' | 'setState'>;
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

export const createWorkerCanonicalRouteController = (
  host: WorkerCanonicalRouteControllerHost,
): WorkerCanonicalRouteController => {
  const verifiedRouteKeys = new Set<string>();
  const verifiedOriginsBySlug = new Map<string, string>();
  const verifiedConfigsByRoute = new Map<string, Record<string, unknown>>();
  const getVerifiedConfig = (slug: unknown, workerOrigin: unknown): Record<string, unknown> | null =>
    verifiedConfigsByRoute.get(buildVerifiedRouteKey(slug, workerOrigin)) || null;
  const isSessionSlug = (slug: unknown): boolean => {
    const normalizedSlug = normalizeSessionSlug(slug);
    const search = typeof window !== 'undefined' ? window.location.search || '' : '';
    const path = host.getCurrentPathname();
    // Profile and comparison deep links carry their session in the query. Only
    // that exact route may use its live-verified config for cache hydration.
    const querySlugs = new URLSearchParams(search).getAll('session');
    const routeSlug = normalizeSessionSlug(
      /^\/(?:compare(?:\/|$)|u\/)/.test(path)
        ? querySlugs.length === 1
          ? querySlugs[0]
          : ''
        : host.getSessionTokenFromPath(path) || '',
    );
    const matchesExplicitRoute = !!routeSlug && routeSlug === normalizedSlug;
    try {
      const workerOrigin = parseSessionWorkerDiscoveryQuery(search);
      return matchesExplicitRoute && (!!workerOrigin || verifiedOriginsBySlug.has(normalizedSlug));
    } catch {
      // Invalid explicit worker targets still suppress chain scans while the
      // route fails closed; query data itself never grants worker authority.
      return new URLSearchParams(search).has('worker') && matchesExplicitRoute;
    }
  };

  return {
    getActiveVerifiedConfig: (slug) => {
      if (!isSessionSlug(slug)) return null;
      try {
        const search = typeof window !== 'undefined' ? window.location.search || '' : '';
        // A clean route still uses its live-verified Worker for cache hydration.
        // Explicit targets must never fall back to a previously verified origin.
        const workerOrigin = new URLSearchParams(search).has('worker')
          ? parseSessionWorkerDiscoveryQuery(search)
          : verifiedOriginsBySlug.get(normalizeSessionSlug(slug));
        return workerOrigin ? getVerifiedConfig(slug, workerOrigin) : null;
      } catch {
        return null;
      }
    },

    getVerifiedConfig,

    hasVerifiedRoute: (slug, workerOrigin) => verifiedRouteKeys.has(buildVerifiedRouteKey(slug, workerOrigin)),

    handleBootstrapResolved: (bootstrap) => {
      const normalizedSlug = normalizeSessionSlug(bootstrap.sessionSlug);
      const routeKey = buildVerifiedRouteKey(normalizedSlug, bootstrap.workerOrigin);
      for (const existingKey of verifiedRouteKeys) {
        if (existingKey.endsWith(`\n${normalizedSlug}`)) {
          verifiedRouteKeys.delete(existingKey);
          verifiedConfigsByRoute.delete(existingKey);
        }
      }
      verifiedOriginsBySlug.set(normalizedSlug, bootstrap.workerOrigin);
      verifiedRouteKeys.add(routeKey);
      verifiedConfigsByRoute.set(routeKey, bootstrap.config);
      host.setState((previousState) => ({
        sessionPathResolutionNonce: Number(previousState.sessionPathResolutionNonce || 0) + 1,
      }));
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
