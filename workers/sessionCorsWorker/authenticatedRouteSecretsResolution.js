export const resolveAuthenticatedRouteSecrets = async ({
  env,
  slug,
  headers,
  deps,
} = {}) => {
  const secrets = await deps?.getSessionSecrets?.(env, slug);
  if (!secrets) {
    return {
      ok: false,
      reason: 'missing_secrets',
      response: deps?.json?.({ error: 'Session secrets not configured.' }, 401, headers),
    };
  }

  return {
    ok: true,
    reason: 'resolved',
    secrets,
  };
};
