import {
  validateBrowserLoginOrigin,
} from './siweMessageValidation.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

export const resolveAuthLoginRequestAuthority = async ({
  env,
  request,
  body,
  slugHint,
  baseHeaders,
  deps,
} = {}) => {
  const {
    address,
    message,
    signature,
  } = deps?.normalizeSignedWorkerRequest?.(body) || {};
  const slugContext = deps?.resolveWorkerBodySlugContext?.({ body, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugContext?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: slugContext?.error }, 400, baseHeaders),
    };
  }
  const { envSlug, slugPayload, targetSlug } = slugContext;
  const explicitSlugProvided = (
    slugContext?.explicitSlugProvided === true ||
    !!envSlug ||
    !!slugPayload?.hasAnySlug
  );

  if (!address || !deps?.isAddress?.(address)) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Invalid address.' }, 400, baseHeaders),
    };
  }
  if (!message || !signature) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Missing message or signature.' }, 400, baseHeaders),
    };
  }
  if (!explicitSlugProvided) {
    return {
      ok: false,
      response: deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, baseHeaders),
    };
  }

  const corsState = await deps?.resolveExistingSessionCors?.({
    request,
    env,
    slug: targetSlug,
    baseHeaders,
  });
  if (!corsState?.ok) {
    return {
      ok: false,
      response: corsState?.response,
    };
  }
  const headers = corsState.headers;

  let recovered;
  try {
    recovered = deps?.verifyMessage?.(message, signature);
  } catch {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Invalid signature.' }, 400, headers),
    };
  }

  const recoveredCheck = deps?.validateRecoveredAddressMatchesRequest?.({ recovered, address }) || {};
  if (!recoveredCheck?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: recoveredCheck?.error }, 400, headers),
    };
  }

  const siwe = deps?.parseSiweMessage?.(message);
  const siweCheck = deps?.validateSiwe?.(siwe, {
    requireIssuedAt: true,
    maxIssuedAtAgeMs: deps?.LOGIN_SIWE_MAX_AGE_MS,
    issuedAtFutureSkewMs: deps?.LOGIN_SIWE_FUTURE_SKEW_MS,
    now: deps?.now,
  }) || {};
  if (!siweCheck?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: siweCheck?.error }, 400, headers),
    };
  }

  const config = corsState.config;
  if (!config) {
    return {
      ok: false,
      response: deps?.json?.({ error: deps?.SESSION_CONFIG_NOT_FOUND_ERROR }, 404, headers),
    };
  }

  const workerCanonical = String(
    config?.sessionModeProfile?.authority?.mode || '',
  ).trim().toLowerCase() === 'worker_canonical';
  const sessionId = resolveCanonicalWorkerSessionIdHex(config);
  const requestedSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: body?.sessionId });
  if (workerCanonical && !sessionId) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Worker session identity is invalid.' }, 500, headers),
    };
  }
  if (workerCanonical && requestedSessionId !== sessionId) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Session identity does not match worker session.' }, 409, headers),
    };
  }

  const loginOriginCheck = (
    typeof deps?.validateBrowserLoginOrigin === 'function'
      ? deps.validateBrowserLoginOrigin
      : validateBrowserLoginOrigin
  )({
    request,
    siwe,
    env,
    config,
  }, {
    resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
  });
  if (!loginOriginCheck?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: loginOriginCheck?.error }, 403, headers),
    };
  }

  const siweAddressCheck = deps?.validateSiweAddressMatchesRequest?.({ siwe, address }) || {};
  if (!siweAddressCheck?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: siweAddressCheck?.error }, 400, headers),
    };
  }

  const nonceResult = await deps?.consumeNonce?.(env, targetSlug, address.toLowerCase(), siwe?.nonce);
  if (!nonceResult?.ok) {
    return {
      ok: false,
      response: deps?.json?.(
        { error: nonceResult?.error },
        Number(nonceResult?.status || 0) >= 500 ? Number(nonceResult.status) : 400,
        headers,
      ),
    };
  }

  let scopes;
  try {
    scopes = await deps?.computeScopesForLogin?.({
      env,
      slug: targetSlug,
      address,
      config,
    });
  } catch (err) {
    return {
      ok: false,
      response: deps?.json?.({ error: err?.message || 'Gate check failed.' }, 403, headers),
    };
  }

  return {
    ok: true,
    address,
    config,
    headers,
    scopes,
    targetSlug,
  };
};
