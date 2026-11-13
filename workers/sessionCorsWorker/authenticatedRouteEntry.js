import { SESSION_AGENT_PATHS } from './sessionAgentRoute.js';

// Every path a signed-in request other than a POST can reach. A POST may carry
// its action in the body to any path, so only POSTs reach sign-in unrouted.
export const NON_POST_PATHS = new Set([
  '/health', '/ai', '/lit/chipotle-action',
  '/storage/read', '/storage/list', '/storage/export-envelopes',
  '/groups/my-memberships', '/groups/members', '/groups/list',
  ...SESSION_AGENT_PATHS,
]);

export const dispatchAuthenticatedRouteEntry = async ({
  path,
  method,
  request,
  env,
  baseHeaders,
  deps,
} = {}) => {
  // No route at all is the same answer signed in or not, so it needs no sign-in.
  if (method !== 'POST' && !NON_POST_PATHS.has(path)) {
    return deps?.json?.({ error: 'Not found.' }, 404, baseHeaders);
  }
  const auth = await deps?.requireAuth?.({ request, env, baseHeaders });
  if (!auth?.ok) return auth?.response;

  if (path === '/health') {
    return deps?.json?.({ ok: true, ts: deps?.now?.() ?? Date.now() }, 200, baseHeaders);
  }

  const authenticatedContext = await deps?.resolveAuthenticatedRouteContext?.({
    request,
    env,
    auth,
    baseHeaders,
  });
  if (!authenticatedContext?.ok) return authenticatedContext?.response;

  return deps?.dispatchAuthenticatedRoute?.({
    path,
    method,
    request,
    authenticatedContext,
  });
};
