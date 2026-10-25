import { resolveAuthenticatedRouteContext } from './authenticatedRouteContextResolution.js';
import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent,
} from './abuseObservability.js';
import {
  readResultsAnalysisAdminStatus,
} from './resultsAnalysisGeneration.js';

const toTrimmedString = (value, deps) => {
  if (typeof deps?.toStr === 'function') return deps.toStr(value).trim();
  return value == null ? '' : String(value).trim();
};

const recordAuthFailure = async ({ env, deps } = {}) => {
  try {
    await (deps?.recordAbuseEvent || recordAbuseEvent)({
      env,
      type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
      now: deps?.now,
    });
  } catch {
    // Results-analysis auth telemetry must not alter the original failure response.
  }
};

const withPrivateNoStoreHeaders = (headers = {}) => {
  const next = new Headers(headers || {});
  next.set('Cache-Control', 'private, no-store');
  return next;
};

const readStatusSessionSlug = (request) => {
  try {
    const params = new URL(request?.url || 'https://worker.invalid/').searchParams;
    return toTrimmedString(params.get('sessionSlug') || params.get('slug'));
  } catch {
    return '';
  }
};

const requestWithQuerySlugHeader = (request) => {
  const slug = readStatusSessionSlug(request);
  if (!slug || request?.headers?.get?.('x-session-slug')) return request;
  const headers = new Headers(request.headers || {});
  headers.set('x-session-slug', slug);
  return new Request(request, { headers });
};

const readIncludeDraft = (request) => {
  try {
    const value = new URL(request?.url || 'https://worker.invalid/').searchParams.get('includeDraft');
    return value == null || value === '' ? true : value !== 'false' && value !== '0';
  } catch {
    return true;
  }
};

export const dispatchAdminResultsAnalysisStatusRequest = async ({
  request,
  env,
  baseHeaders,
  slug,
  deps,
} = {}) => {
  request = requestWithQuerySlugHeader(request);
  const auth = await deps?.requireAuth?.({
    request,
    env,
    baseHeaders,
    slugHint: slug,
  });
  if (!auth?.ok) return auth?.response;

  const targetSlug = auth.slug || slug;
  const context = await resolveAuthenticatedRouteContext({
    request, env, auth, baseHeaders,
    deps: { ...deps, SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.' },
  });
  if (!context.ok) return context.response;
  const config = context.config;
  const headers = withPrivateNoStoreHeaders(context.headers);

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

  const body = await (deps?.readResultsAnalysisAdminStatus || readResultsAnalysisAdminStatus)({
    env,
    slug: targetSlug,
    config,
    includeDraft: readIncludeDraft(request),
    deps,
  });
  return deps?.json?.(body, 200, headers);
};
