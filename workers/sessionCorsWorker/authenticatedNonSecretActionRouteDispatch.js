import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';

export const dispatchAuthenticatedNonSecretActionRoute = async ({
  action,
  body,
  config,
  slug,
  address,
  env,
  limit,
  headers,
  scopes,
  deps,
} = {}) => {
  const isFetchImageAction = action === 'fetch_image';
  const isFetchUrlAction = action === 'fetch_url';
  if (!isFetchImageAction && !isFetchUrlAction) {
    return { handled: false };
  }
  const endedResponse = buildSessionEndedResponse({
    config,
    headers,
    json: deps?.json,
    now: deps?.now,
  });
  if (endedResponse) {
    return {
      handled: true,
      response: endedResponse,
    };
  }

  const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
    scopes,
    scope: 'fetch',
    route: 'fetch',
    config,
    env,
    slug,
    address,
    limit,
    headers,
    deps: {
      checkRateLimit: deps?.checkRateLimit,
      computeScopesForLogin: deps?.computeScopesForLogin,
      json: deps?.json,
    },
  });
  if (!preflight?.ok) {
    return {
      handled: true,
      response: preflight?.response,
    };
  }

  if (isFetchImageAction) {
    return {
      handled: true,
      response: await deps?.fetchImage?.(body?.url, headers),
    };
  }

  return {
    handled: true,
    response: await deps?.fetchUrl?.(body?.url, headers),
  };
};
