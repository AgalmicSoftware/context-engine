import {
  validateAuthTokenRecord,
} from './authTokenClaims.js';
import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent as recordAbuseEventBoundary,
} from './abuseObservability.js';

const recordAuthFailure = async ({ env, deps } = {}) => {
  try {
    await (deps?.recordAbuseEvent || recordAbuseEventBoundary)({
      env,
      type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
      now: deps?.now,
    });
  } catch {
    // Auth telemetry must never mask or alter the original auth failure.
  }
};

export const resolveAuthenticatedRequest = async ({
  request,
  env,
  baseHeaders,
  slugHint,
  deps,
} = {}) => {
  const authHeader = request?.headers?.get('authorization') || '';
  const match = authHeader.match(/bearer\s+(.+)/i);
  if (!match) {
    await recordAuthFailure({ env, deps });
    return {
      ok: false,
      response: deps?.json?.({ error: 'Missing Authorization header.' }, 401, baseHeaders),
    };
  }

  const token = match[1];
  const verification = await deps?.verifyToken?.(token, env?.TOKEN_HMAC_SECRET);
  if (!verification?.ok) {
    await recordAuthFailure({ env, deps });
    return {
      ok: false,
      response: deps?.json?.({ error: verification?.error || 'Invalid token.' }, 401, baseHeaders),
    };
  }

  const payload = verification.payload || {};
  const tokenHasSlug = Object.prototype.hasOwnProperty.call(payload, 'slug');
  const headerRaw = request?.headers?.get('x-session-slug') ?? request?.headers?.get('x-group-slug');
  const slugContext = deps?.resolveWorkerRequestSlugContext?.({
    tokenSlug: payload.slug,
    tokenHasSlug,
    headerSlug: headerRaw,
    env,
    slugHint,
    countEmptyHeaderAsExplicit: true,
  }) || { ok: false, error: 'Invalid session slug.' };

  if (!slugContext.ok) {
    await recordAuthFailure({ env, deps });
    return {
      ok: false,
      response: deps?.json?.({ error: slugContext.error }, 400, baseHeaders),
    };
  }

  const { explicitSlugProvided, slug, tokenSlug } = slugContext;
  if (!explicitSlugProvided) {
    await recordAuthFailure({ env, deps });
    return {
      ok: false,
      response: deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, baseHeaders),
    };
  }

  if (tokenHasSlug && slug !== tokenSlug) {
    await recordAuthFailure({ env, deps });
    return {
      ok: false,
      response: deps?.json?.({ error: 'Token does not match requested session slug.' }, 403, baseHeaders),
    };
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'jti')) {
    const validateRecord = typeof deps?.validateAuthTokenRecord === 'function'
      ? deps.validateAuthTokenRecord
      : validateAuthTokenRecord;
    const tokenRecord = await validateRecord({ env, payload, slug });
    if (!tokenRecord?.ok) {
      await recordAuthFailure({ env, deps });
      return {
        ok: false,
        response: deps?.json?.({ error: tokenRecord?.error || 'Invalid token.' }, 401, baseHeaders),
      };
    }
  }

  return { ok: true, payload, slug };
};
