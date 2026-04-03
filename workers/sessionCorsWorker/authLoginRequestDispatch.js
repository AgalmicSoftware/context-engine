import {
  resolveAuthLoginRequestAuthority,
} from './authLoginRequestAuthority.js';

export const dispatchAuthLoginRequest = async ({
  request,
  env,
  baseHeaders,
  slug,
  deps,
} = {}) => {
  let body;
  try {
    body = await request?.json?.();
  } catch {
    return deps?.json?.({ error: 'Invalid JSON.' }, 400, baseHeaders);
  }

  const authorityResult = await (
    deps?.resolveAuthLoginRequestAuthority || resolveAuthLoginRequestAuthority
  )({
    env,
    request,
    body,
    slugHint: slug,
    baseHeaders,
    deps: {
      json: deps?.json,
      normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
      resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
      isAddress: deps?.isAddress,
      resolveExistingSessionCors: deps?.resolveExistingSessionCors,
      verifyMessage: deps?.verifyMessage,
      validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: deps?.parseSiweMessage,
      validateSiwe: deps?.validateSiwe,
      validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
      consumeNonce: deps?.consumeNonce,
      computeScopesForLogin: deps?.computeScopesForLogin,
      MISSING_SLUG_ERROR: deps?.MISSING_SLUG_ERROR,
      SESSION_CONFIG_NOT_FOUND_ERROR: deps?.SESSION_CONFIG_NOT_FOUND_ERROR,
    },
  });
  if (!authorityResult?.ok) return authorityResult?.response;

  const {
    address,
    headers,
    scopes,
    targetSlug,
  } = authorityResult;

  const exp = Math.floor((deps?.now?.() ?? Date.now()) / 1000) + deps?.TOKEN_TTL_SECONDS;
  const payload = {
    sub: deps?.getAddress?.(address),
    slug: targetSlug,
    scopes,
    exp,
  };

  let token;
  try {
    token = await deps?.signToken?.(payload, env?.TOKEN_HMAC_SECRET);
  } catch (err) {
    return deps?.json?.({ error: err?.message || 'Token signing failed.' }, 500, headers);
  }

  return deps?.json?.({ token, exp }, 200, headers);
};
