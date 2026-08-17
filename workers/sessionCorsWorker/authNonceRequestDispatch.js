import {
  resolveAnonymousRateIdentity,
} from './anonymousRateIdentityNormalization.js';
import {
  validateTrustedLoginRequestOrigin,
} from './siweMessageValidation.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

export const dispatchAuthNonceRequest = async ({
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

  const address = (deps?.toStr?.(body?.address) ?? '').trim();
  if (!address || !deps?.isAddress?.(address)) {
    return deps?.json?.({ error: 'Invalid address.' }, 400, baseHeaders);
  }

  const slugContext = deps?.resolveWorkerBodySlugContext?.({ body, env, slugHint: slug }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugContext?.ok) {
    return deps?.json?.({ error: slugContext?.error }, 400, baseHeaders);
  }

  const explicitSlugProvided = slugContext?.explicitSlugProvided === true || !!slugContext?.targetSlug;
  const targetSlug = slugContext?.targetSlug ?? '';
  if (!explicitSlugProvided) {
    return deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, baseHeaders);
  }

  // Regression guard: admin repair flows still need a nonce even when the
  // session allowlist has drifted away from the trusted admin UI origin.
  const allowTrustedAdminAuthOrigin = body?.adminAction === true;
  const corsState = await deps?.resolveExistingSessionCors?.({
    request,
    env,
    slug: targetSlug,
    baseHeaders,
    allowTrustedAdminAuthOrigin,
  });
  if (!corsState?.ok) return corsState?.response;
  const headers = corsState.headers;

  const originCheck = (
    typeof deps?.validateTrustedLoginRequestOrigin === 'function'
      ? deps.validateTrustedLoginRequestOrigin
      : validateTrustedLoginRequestOrigin
  )({
    request,
    env,
    config: corsState.config,
    allowTrustedAdminOrigins: allowTrustedAdminAuthOrigin,
  }, {
    resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
  });
  if (!originCheck?.ok) {
    return deps?.json?.({ error: originCheck?.error }, 403, headers);
  }

  const workerCanonical = String(
    corsState.config?.sessionModeProfile?.authority?.mode || '',
  ).trim().toLowerCase() === 'worker_canonical';
  const sessionId = resolveCanonicalWorkerSessionIdHex(corsState.config);
  const requestedSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: body?.sessionId });
  const bootstrapWorkerCanonicalIdentity = body?.bootstrapWorkerCanonicalIdentity === true;
  const bootstrappingWorkerCanonicalIdentity = bootstrapWorkerCanonicalIdentity && !corsState.config;
  if (bootstrapWorkerCanonicalIdentity && !allowTrustedAdminAuthOrigin) {
    return deps?.json?.({ error: 'Worker identity bootstrap requires an admin action.' }, 400, headers);
  }
  if (bootstrapWorkerCanonicalIdentity && corsState.config && !workerCanonical) {
    return deps?.json?.({ error: 'Worker identity bootstrap is unavailable after initialization.' }, 409, headers);
  }
  if (bootstrappingWorkerCanonicalIdentity && !requestedSessionId) {
    return deps?.json?.({ error: 'Worker bootstrap session identity is invalid.' }, 400, headers);
  }
  if (workerCanonical && !sessionId) {
    return deps?.json?.({ error: 'Worker session identity is invalid.' }, 500, headers);
  }
  if (workerCanonical && requestedSessionId !== sessionId) {
    return deps?.json?.({ error: 'Session identity does not match worker session.' }, 409, headers);
  }

  const rateLimitIdentity = (
    typeof deps?.resolveAnonymousRateIdentity === 'function'
      ? deps.resolveAnonymousRateIdentity(request)
      : resolveAnonymousRateIdentity({
        request,
        deps: {
          toStr: deps?.toStr,
        },
      })
  );
  const rateLimitResult = await deps?.checkNonceRateLimit?.({
    env,
    slug: targetSlug,
    identity: rateLimitIdentity,
    address,
    limit: deps?.NONCE_RATE_LIMIT_MAX,
    now: deps?.now,
    windowMs: deps?.NONCE_RATE_LIMIT_WINDOW_MS,
    ttlSeconds: deps?.NONCE_RATE_LIMIT_TTL_SECONDS,
    ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
  });
  if (rateLimitResult && !rateLimitResult?.ok) {
    return deps?.json?.({ error: rateLimitResult?.error }, 429, headers);
  }

  const nonce = deps?.buildNonce?.();
  const issueResult = await deps?.issueNonce?.(
    env,
    targetSlug,
    address.toLowerCase(),
    nonce,
    deps?.NONCE_TTL_SECONDS,
  );
  if (!issueResult?.ok) {
    return deps?.json?.(
      { error: issueResult?.error || 'Authorization state coordination is unavailable.' },
      Number(issueResult?.status || 0) || 503,
      headers,
    );
  }

  const responseSessionId = workerCanonical ? sessionId : bootstrappingWorkerCanonicalIdentity ? requestedSessionId : '';
  return deps?.json?.({
    nonce,
    ...(responseSessionId ? { sessionSlug: targetSlug, sessionId: responseSessionId } : {}),
    ...(bootstrappingWorkerCanonicalIdentity ? { bootstrapWorkerCanonicalIdentity: true } : {}),
  }, 200, headers);
};
