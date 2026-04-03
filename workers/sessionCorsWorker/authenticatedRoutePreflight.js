export const evaluateAuthenticatedRoutePreflight = async ({
  scopes,
  scope,
  route,
  allowWithoutScope = false,
  env,
  slug,
  address,
  limit,
  headers,
  deps,
} = {}) => {
  const tokenHasScope = !!scopes?.[scope];
  if (!tokenHasScope && !allowWithoutScope) {
    return {
      ok: false,
      tokenHasScope,
      response: deps?.json?.({ error: `Token missing ${scope} scope.` }, 403, headers),
    };
  }

  const rateAllowed = await deps?.checkRateLimit?.({
    env,
    slug,
    address,
    limit,
    route,
  });
  if (!rateAllowed) {
    return {
      ok: false,
      tokenHasScope,
      response: deps?.json?.({ error: 'Rate limit exceeded.' }, 429, headers),
    };
  }

  return {
    ok: true,
    tokenHasScope,
  };
};
