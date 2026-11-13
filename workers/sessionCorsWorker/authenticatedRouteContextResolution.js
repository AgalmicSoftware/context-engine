import { readCurrentSessionConfig } from './sessionConfigAuthority.js';
import {
  normalizeAuthorizationEpoch,
  readAuthorizationEpoch,
} from './authorizationScopeFreshness.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

const CACHEABLE_READS = new Set(['/storage/list', '/storage/read', '/storage/read-batch']);
const requestPath = (request) => {
  try {
    return new URL(request?.url || '').pathname;
  } catch {
    return '';
  }
};
// Reads, and answer uploads. Other uploads (questions, surveys, context)
// publish against the config's revision, so they read it fresh.
const mayUseCachedConfig = async (request) => {
  const path = requestPath(request);
  if (path !== '/storage/upload') return CACHEABLE_READS.has(path);
  if (!/application\/json/i.test(request.headers?.get?.('content-type') || '')) return false;
  try {
    return (await request.clone().json())?.resource === 'responses';
  } catch {
    return false;
  }
};
const namedInConfig = (config, address) => {
  const normalized = String(address || '').trim().toLowerCase();
  return !normalized || JSON.stringify(config ?? null).toLowerCase().includes(normalized);
};

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
  const read = deps?.readCurrentSessionConfig || readCurrentSessionConfig;
  let config;
  let revision;
  try {
    // Answers and reads may use a config up to a second old. Anyone the config
    // names (an admin of any kind, a listed member) and every other route
    // reads it fresh, so admin actions always see the current authority.
    const cache = await mayUseCachedConfig(request);
    ({ config, revision } = await read({ env, slug, cache }));
    if (cache && namedInConfig(config, auth?.payload?.sub)) ({ config, revision } = await read({ env, slug }));
  } catch (error) {
    return { ok: false, response: deps?.json?.({ error: error.message }, 503, baseHeaders) };
  }
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
    expectedAuthority: { actor: address, revision, authzEpoch: currentEpoch },
    limit: config?.limits?.perWalletPerDay || 0,
  };
};
