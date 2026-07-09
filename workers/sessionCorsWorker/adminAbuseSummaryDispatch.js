import {
  ABUSE_COUNTER_TYPES,
  readAbuseCounterSummary,
  recordAbuseEvent,
} from './abuseObservability.js';

const toTrimmedString = (value, deps) => {
  if (typeof deps?.toStr === 'function') return deps.toStr(value).trim();
  return value == null ? '' : String(value).trim();
};

const recordAuthFailure = async ({ env, deps } = {}) => {
  try {
    await (
      deps?.recordAbuseEvent || recordAbuseEvent
    )({
      env,
      type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
      now: deps?.now,
    });
  } catch {
    // Abuse telemetry must not alter the request authorization result.
  }
};

const normalizeSummaryWindows = (request) => {
  try {
    const value = new URL(request?.url || 'https://worker.invalid/').searchParams.get('windows');
    if (value == null || value === '') return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : undefined;
  } catch {
    return undefined;
  }
};

export const dispatchAdminAbuseSummaryRequest = async ({
  request,
  env,
  baseHeaders,
  slug,
  deps,
} = {}) => {
  const auth = await deps?.requireAuth?.({
    request,
    env,
    baseHeaders,
    slugHint: slug,
  });
  if (!auth?.ok) return auth?.response;

  const targetSlug = auth.slug || slug;
  const config = await deps?.getSessionConfig?.(env, targetSlug);
  if (!config) {
    return deps?.json?.({ error: 'Session config not found.' }, 404, baseHeaders);
  }

  const corsContext = await deps?.getCorsContext?.({
    request,
    config,
    baseHeaders,
  });
  if (corsContext && !corsContext.ok) return corsContext.response;
  const headers = corsContext?.headers || baseHeaders;

  const address = toTrimmedString(auth.payload?.sub, deps).toLowerCase();
  const isAdmin = await deps?.validateAdmin?.({
    env,
    slug: targetSlug,
    address,
    config,
    body: {},
  });
  if (!isAdmin) {
    await recordAuthFailure({ env, deps });
    return deps?.json?.({ error: 'Admin authorization failed.' }, 403, headers);
  }

  const readSummary = deps?.readAbuseCounterSummary || readAbuseCounterSummary;
  const summary = await readSummary({
    env,
    now: deps?.now,
    windows: normalizeSummaryWindows(request),
  });
  if (!summary?.ok) {
    return deps?.json?.({ error: summary?.error || 'Abuse counter summary unavailable.' }, 500, headers);
  }
  return deps?.json?.(summary, 200, headers);
};
