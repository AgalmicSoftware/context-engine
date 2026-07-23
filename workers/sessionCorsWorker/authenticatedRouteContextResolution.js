import {
  normalizeAuthorizationEpoch,
  readAuthorizationEpoch,
} from './authorizationScopeFreshness.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

const isWorkerGroupsRequest = (request) => {
  try {
    return new URL(request?.url || '').pathname.startsWith('/groups/');
  } catch {
    return false;
  }
};

export const resolveAuthenticatedRouteContext = async ({
  request,
  env,
  auth,
  baseHeaders,
  deps,
} = {}) => {
  const slug = auth?.slug;
  const config = await deps?.getSessionConfig?.(env, slug);
  if (!config) {
    return {
      ok: false,
      response: deps?.json?.({ error: deps?.SESSION_CONFIG_NOT_FOUND_ERROR }, 404, baseHeaders),
    };
  }

  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) {
    return {
      ok: false,
      response: corsContext?.response,
      config,
    };
  }

  const payload = auth?.payload || {};
  const currentSessionId = resolveCanonicalWorkerSessionIdHex(config);
  const tokenSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload.sessionId });
  const workerCanonical = String(config?.sessionModeProfile?.authority?.mode || '').trim().toLowerCase() ===
    'worker_canonical';
  if (
    (workerCanonical || isWorkerGroupsRequest(request)) &&
    (!currentSessionId || tokenSessionId !== currentSessionId)
  ) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Token session identity is stale.' }, 401, corsContext.headers),
    };
  }
  const tokenEpoch = normalizeAuthorizationEpoch(payload.authzEpoch);
  const currentEpoch = readAuthorizationEpoch(config);
  if (tokenEpoch === null || currentEpoch === null || tokenEpoch !== currentEpoch) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Token authorization is stale.' }, 401, corsContext.headers),
    };
  }

  const address = deps?.toStr?.(payload.sub || '').toLowerCase();

  return {
    ok: true,
    slug,
    config,
    headers: corsContext.headers,
    scopes: payload.scopes || {},
    address,
    limit: config?.limits?.perWalletPerDay || 0,
  };
};
