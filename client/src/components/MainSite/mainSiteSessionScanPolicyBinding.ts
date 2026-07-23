import { createSessionScanPolicy } from '../../utilities/session/mainSiteSessionScanPolicy.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { parseSessionWorkerDiscoveryQuery } from '../../utilities/session/sessionWorkerDiscovery.js';
import type { AppShell } from './AppShell';

type MainSiteSessionScanPolicyHost = Pick<
  AppShell,
  | '_routeRenderers'
  | 'getActiveSessionSlug'
  | 'getCurrentPathname'
  | 'getSessionSlugHintFromSearch'
  | 'getSessionTokenFromPath'
  | 'getDisplaySessionCfg'
  | 'isSbtListRoutePath'
>;

export const createMainSiteSessionScanPolicy = (host: MainSiteSessionScanPolicyHost) =>
  createSessionScanPolicy({
    getActiveSessionSlug: () => host.getActiveSessionSlug(),
    getCurrentPath: () => host.getCurrentPathname(),
    getSessionSlugHintFromSearch: (search: string) => host.getSessionSlugHintFromSearch(search),
    getSessionTokenFromPath: (path: string) => host.getSessionTokenFromPath(path),
    isSbtListRoutePath: (path: string) => host.isSbtListRoutePath(path),
    shouldSuppressSbtScansForSessionSlug: (slug: string) => {
      const workerRoutes = host._routeRenderers.workerCanonicalRoutes;
      const explicitWorkerRoute = workerRoutes.isSessionSlug(slug);
      let workerOrigin = '';
      if (explicitWorkerRoute) {
        try {
          workerOrigin = parseSessionWorkerDiscoveryQuery(
            typeof window !== 'undefined' ? window.location.search || '' : '',
          );
        } catch {
          workerOrigin = '';
        }
      }
      const config = explicitWorkerRoute
        ? workerRoutes.getVerifiedConfig(slug, workerOrigin)
        : host.getDisplaySessionCfg(slug);
      const projection = resolveSessionCapabilityProjection(config);
      if (projection.source === 'legacy_registry') return false;
      if (projection.source === 'profile') {
        return !projection.isRegistryCanonical && !projection.usesOnChainSbt;
      }
      // Missing, invalid, and unresolved explicit Worker routes never inherit
      // SBT discovery from a wallet, provider, cache, or legacy chain field.
      return true;
    },
  });
