export const dispatchAnonymousRouteEntry = async ({
  path,
  anonymousRoute,
  request,
  env,
  slugHint,
  baseHeaders,
  deps,
} = {}) => {
  const slugResolution = deps?.resolveRequestSlugWithoutToken?.({ request, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugResolution?.ok) {
    return deps?.json?.({ error: slugResolution?.error }, 400, baseHeaders);
  }
  if (!slugResolution?.explicitSlugProvided) {
    return deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, baseHeaders);
  }

  const slug = slugResolution?.slug;
  const config = await deps?.getSessionConfig?.(env, slug);
  if (!config) {
    return deps?.json?.({ error: deps?.SESSION_CONFIG_NOT_FOUND_ERROR }, 404, baseHeaders);
  }

  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) return corsContext?.response;
  const headers = corsContext?.headers;

  const limit = config?.limits?.perWalletPerDay || 0;
  const anonymousIdentity = deps?.resolveAnonymousRateIdentity?.(request);
  const anonymousRateAllowed = await deps?.checkRateLimit?.({
    env,
    slug,
    address: anonymousIdentity,
    limit,
    route: anonymousRoute,
  });
  if (!anonymousRateAllowed) {
    return deps?.json?.({ error: 'Rate limit exceeded.' }, 429, headers);
  }

  return deps?.dispatchAnonymousRoute?.({
    path,
    request,
    anonymousContext: {
      slug,
      config,
      headers,
      env,
    },
  });
};
