import { resolveAuthenticatedRouteContext } from './authenticatedRouteContextResolution.js';
import { readSessionDiagnosticsAuthority, readUploadReceiptDiagnostics } from './sessionDiagnostics.js';
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
  diagnostics = false,
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
  let snapshot;
  if (diagnostics) {
    try {
      snapshot = await readSessionDiagnosticsAuthority({ env, slug: targetSlug });
    } catch {
      return deps?.json?.({ error: 'Session diagnostics are unavailable; retry.' }, 503, withPrivateNoStoreHeaders(baseHeaders));
    }
  }
  const context = await resolveAuthenticatedRouteContext({
    request, env, auth, baseHeaders,
    deps: { ...deps, SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
      ...(diagnostics ? { readCurrentSessionConfig: async () => ({ config: snapshot.config, revision: snapshot.revision }) } : {}),
    },
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

  if (diagnostics) {
    try {
      const cursor = new URL(request.url).searchParams.get('cursor') || '';
      const uploadReceipts = await readUploadReceiptDiagnostics({ env, slug: targetSlug, cursor });
      return deps?.json?.({
        ok: true, type: 'ce_session_diagnostics', version: 1,
        observedAtMs: typeof deps?.now === 'function' ? deps.now() : Date.now(),
        uploadReceipts, analysis: snapshot.analysis, configProjection: snapshot.configProjection,
      }, 200, headers);
    } catch (error) {
      return deps?.json?.({ error: error?.status === 400 ? 'Invalid diagnostics cursor.' : 'Session diagnostics are unavailable; retry.' }, error?.status === 400 ? 400 : 503, headers);
    }
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
