import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { isSbtListSyntheticNoSessionSlug } from './sbtListSessionUniverseHelpers';

export const buildSbtListDetailHref = (sbtAddress: unknown, sessionSlug: unknown = ''): string =>
  buildSbtDetailPath(sbtAddress, isSbtListSyntheticNoSessionSlug(sessionSlug) ? '' : String(sessionSlug || ''));

type ResolveSbtListRouteScopeArgs = {
  allSessionsMode?: unknown;
  pathname?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
};

export const resolveSbtListRouteScope = ({
  allSessionsMode,
  pathname,
  sessionConfig,
  sessionSlug,
}: ResolveSbtListRouteScopeArgs = {}) => {
  const routeSlug = normalizeSessionSlug(sessionSlug || '');
  const config =
    sessionConfig && typeof sessionConfig === 'object' && !Array.isArray(sessionConfig)
      ? (sessionConfig as Record<string, unknown>)
      : null;
  const configSlug = normalizeSessionSlug(config?.slug || config?.sessionSlug || '');
  const parts = stripPublicUrlBasePath(String(pathname || ''))
    .split('/')
    .filter(Boolean);
  return {
    allSessionsMode: Boolean(allSessionsMode) || ((parts[0] === 'sbts' || parts[0] === 'groups') && parts.length === 1),
    explicitRouteSessionConfig: routeSlug && configSlug === routeSlug ? config : null,
    routeSlug,
  };
};
