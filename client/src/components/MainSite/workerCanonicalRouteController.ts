import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  parseSessionWorkerDiscoveryQuery,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery.js';
import type { AppShell } from './AppShell';

type WorkerCanonicalRouteControllerHost = Pick<AppShell, 'getCurrentPathname' | 'getSessionTokenFromPath' | 'setState'>;
const controllersByHost = new WeakMap<object, WorkerCanonicalRouteController>();

export type WorkerCanonicalRouteController = {
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

  return {
    hasVerifiedRoute: (slug, workerOrigin) => verifiedRouteKeys.has(buildVerifiedRouteKey(slug, workerOrigin)),

    handleBootstrapResolved: (bootstrap) => {
      verifiedRouteKeys.add(buildVerifiedRouteKey(bootstrap.sessionSlug, bootstrap.workerOrigin));
      verifiedRouteKeys.add(normalizeSessionSlug(bootstrap.sessionSlug));
      host.setState((previousState) => ({
        sessionPathResolutionNonce: Number(previousState.sessionPathResolutionNonce || 0) + 1,
      }));
    },

    isSessionSlug: (slug) => {
      const normalizedSlug = normalizeSessionSlug(slug);
      if (normalizedSlug && verifiedRouteKeys.has(normalizedSlug)) return true;
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
    },
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
