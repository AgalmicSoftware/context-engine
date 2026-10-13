import {
  validateTrustedLoginRequestOrigin,
} from './siweMessageValidation.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

// An IPv6 host usually controls a whole /64, so one caller is its /64 rather
// than each of its addresses. An IPv4-mapped address is its IPv4 address.
const ipv6Prefix64 = (ip) => {
  const halves = ip.split('::');
  if (halves.length > 2) return '';
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return '';
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return '';
  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`;
};

const normalizeCallerIp = (ip) => {
  const mappedIpv4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4) return mappedIpv4[1];
  return ip.includes(':') ? ipv6Prefix64(ip) || ip : ip;
};

const resolveAuthNonceSharedNetworkIdentity = ({ request, deps } = {}) => {
  const isCloudflareRuntime = !!(request?.cf && typeof request.cf === 'object');
  if (isCloudflareRuntime) {
    const cfIp = String(deps?.toStr?.(request?.headers?.get('CF-Connecting-IP')) ?? '').trim().toLowerCase();
    if (cfIp) return `anon:${normalizeCallerIp(cfIp)}`;
  }
  return 'anon:unknown';
};

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

  const rateLimitIdentity = resolveAuthNonceSharedNetworkIdentity({ request, deps });
  const rateLimitResult = await deps?.checkNonceRateLimit?.({
    env,
    slug: targetSlug,
    identity: rateLimitIdentity,
    address,
    limit: deps?.NONCE_RATE_LIMIT_MAX,
    sharedNetworkLimit: deps?.NONCE_SHARED_NETWORK_RATE_LIMIT_MAX,
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
  // Issuance needs the coordinator's signed nonce. Compatibility consumption
  // of old stored nonces does not make an unsigned issue result usable.
  const issuedNonce = typeof issueResult?.nonce === 'string' ? issueResult.nonce.trim() : '';
  if (!issueResult?.ok || !issuedNonce) {
    return deps?.json?.(
      { error: issueResult?.error || 'Authorization state coordination is unavailable.' },
      Number(issueResult?.status || 0) >= 400 ? Number(issueResult.status) : 503,
      headers,
    );
  }

  const responseSessionId = workerCanonical ? sessionId : bootstrappingWorkerCanonicalIdentity ? requestedSessionId : '';
  return deps?.json?.({
    nonce: issuedNonce,
    ...(responseSessionId ? { sessionSlug: targetSlug, sessionId: responseSessionId } : {}),
    ...(bootstrappingWorkerCanonicalIdentity ? { bootstrapWorkerCanonicalIdentity: true } : {}),
  }, 200, headers);
};
