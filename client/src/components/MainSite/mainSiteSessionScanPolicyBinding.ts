import { createSessionScanPolicy } from '../../utilities/session/mainSiteSessionScanPolicy.js';
import type { AppShell } from './AppShell';

type MainSiteSessionScanPolicyHost = Pick<
  AppShell,
  | '_routeRenderers'
  | 'getActiveSessionSlug'
  | 'getCurrentPathname'
  | 'getSessionSlugHintFromSearch'
  | 'getSessionTokenFromPath'
  | 'isSbtListRoutePath'
>;

export const createMainSiteSessionScanPolicy = (host: MainSiteSessionScanPolicyHost) =>
  createSessionScanPolicy({
    getActiveSessionSlug: () => host.getActiveSessionSlug(),
    getCurrentPath: () => host.getCurrentPathname(),
    getSessionSlugHintFromSearch: (search: string) => host.getSessionSlugHintFromSearch(search),
    getSessionTokenFromPath: (path: string) => host.getSessionTokenFromPath(path),
    isSbtListRoutePath: (path: string) => host.isSbtListRoutePath(path),
    isWorkerCanonicalSessionSlug: (slug: string) => host._routeRenderers.workerCanonicalRoutes.isSessionSlug(slug),
  });
