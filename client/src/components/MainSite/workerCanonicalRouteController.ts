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
  const verifiedConfigsByRoute = new Map<string, Record<string, unknown>>();
  const getVerifiedConfig = (slug: unknown, workerOrigin: unknown): Record<string, unknown> | null =>
    verifiedConfigsByRoute.get(buildVerifiedRouteKey(slug, workerOrigin)) || null;
  const isSessionSlug = (slug: unknown): boolean => {
    const normalizedSlug = normalizeSessionSlug(slug);
    const search = typeof window !== 'undefined' ? window.location.search || '' : '';
    const routeSlug = normalizeSessionSlug(host.getSessionTokenFromPath(host.getCurrentPathname()) || '');
    const matchesExplicitRoute = !!routeSlug && routeSlug === normalizedSlug;
    try {
      const workerOrigin = parseSessionWorkerDiscoveryQuery(search);
      return !!workerOrigin && matchesExplicitRoute;
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
        const workerOrigin = parseSessionWorkerDiscoveryQuery(search);
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
