export const evaluateAuthenticatedRoutePreflight = async ({
  scopes,
  scope,
  route,
  allowWithoutScope = false,
  config,
  env,
  slug,
  address,
  limit,
  headers,
  deps,
} = {}) => {
  let tokenHasScope = scopes?.[scope] === true;
  if (!tokenHasScope && !allowWithoutScope) {
    return {
      ok: false,
      tokenHasScope,
      response: deps?.json?.({ error: `Token missing ${scope} scope.` }, 403, headers),
    };
  }

  let currentScopes;
  try {
    currentScopes = await deps?.computeScopesForLogin?.({
      env,
      slug,
      address,
      config,
      requestedScopes: [scope],
    });
  } catch {
    currentScopes = null;
  }
  if (!currentScopes || typeof currentScopes !== 'object' || Array.isArray(currentScopes)) {
    return {
      ok: false,
      tokenHasScope: false,
      response: deps?.json?.({ error: 'Current authorization check failed.' }, 403, headers),
    };
  }
  tokenHasScope = tokenHasScope && currentScopes?.[scope] === true;
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
