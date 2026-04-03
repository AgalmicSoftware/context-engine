import {
  resolveTrustedAdminOrigins as resolveTrustedAdminOriginsBoundary,
} from './siweMessageValidation.js';

const normalizeOrigin = (value) => {
  const raw = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
};

const getRequestPath = (request) => {
  try {
    return new URL(request?.url || 'https://worker.invalid').pathname;
  } catch {
    return '';
  }
};

const buildTrustedAdminCorsHeaders = ({
  request,
  env,
  deps,
  allowTrustedAdminAuthOrigin = false,
} = {}) => {
  const path = getRequestPath(request);
  const allowTrustedRoute = (
    path.startsWith('/admin/') ||
    (allowTrustedAdminAuthOrigin && path === '/auth/nonce')
  );
  if (!allowTrustedRoute) return null;
  const origin = normalizeOrigin(
    request?.headers?.get?.('Origin') || request?.headers?.get?.('origin') || ''
  );
  if (!origin) return null;
  const trustedOrigins = (
    typeof deps?.resolveTrustedAdminOrigins === 'function'
      ? deps.resolveTrustedAdminOrigins(env)
      : resolveTrustedAdminOriginsBoundary(env)
  )
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
  if (!trustedOrigins.includes(origin)) return null;
  return typeof deps?.corsHeaders === 'function'
    ? deps.corsHeaders(origin, [origin])
    : null;
};

export const resolveExistingSessionCors = async ({
  request,
  env,
  slug,
  baseHeaders,
  deps,
  allowTrustedAdminAuthOrigin = false,
} = {}) => {
  const normalizedSlug = deps?.normalizeWorkerSessionSlug?.(slug);
  const config = await deps?.getSessionConfig?.(env, normalizedSlug);
  if (!config) {
    return { ok: true, headers: baseHeaders, config: null };
  }

  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) {
    const trustedAdminHeaders = buildTrustedAdminCorsHeaders({
      request,
      env,
      deps,
      allowTrustedAdminAuthOrigin,
    });
    if (trustedAdminHeaders) {
      return {
        ok: true,
        headers: trustedAdminHeaders,
        config,
      };
    }
    return { ok: false, response: corsContext?.response, config };
  }

  return {
    ok: true,
    headers: corsContext.headers,
    config,
  };
};
