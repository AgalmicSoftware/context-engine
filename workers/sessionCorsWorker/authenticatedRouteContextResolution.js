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
  return {
    ok: true,
    slug,
    config,
    headers: corsContext.headers,
    scopes: payload.scopes || {},
    address: deps?.toStr?.(payload.sub || '').toLowerCase(),
    limit: config?.limits?.perWalletPerDay || 0,
  };
};
