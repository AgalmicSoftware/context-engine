export const dispatchAuthenticatedRouteEntry = async ({
  path,
  method,
  request,
  env,
  baseHeaders,
  deps,
} = {}) => {
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
