import { toTrimmedString } from './stringCoercion.js';

export const resolveAnonymousRateIdentity = ({ request, deps, constants } = {}) => {
  const anonymousRateIdHeader = toTrimmedString(constants?.anonymousRateIdHeader, deps) || 'X-Anonymous-Client-Id';
  const anonymousUnknownIdentity = toTrimmedString(constants?.anonymousUnknownIdentity, deps) || 'anon:unknown';

  // Only trust platform-provided client IP in native Cloudflare worker runtime.
  const isCloudflareRuntime = !!(request?.cf && typeof request.cf === 'object');
  if (isCloudflareRuntime) {
    const cfIp = toTrimmedString(request?.headers?.get('CF-Connecting-IP'), deps).toLowerCase();
    if (cfIp) return `anon:${cfIp}`;
  }

  // Outside native Cloudflare, use a caller-provided stable anonymous ID as a
  // best-effort shard key to avoid collapsing all users into one bucket.
  // This is not a trust boundary and can be rotated by clients; treat it as
  // load-sharding/fairness only (not a hard anti-abuse identity).
  const anonClientId = toTrimmedString(request?.headers?.get(anonymousRateIdHeader), deps).toLowerCase();
  if (/^[a-z0-9_-]{8,128}$/.test(anonClientId)) {
    return `anon:cid:${anonClientId}`;
  }

  return anonymousUnknownIdentity;
};
