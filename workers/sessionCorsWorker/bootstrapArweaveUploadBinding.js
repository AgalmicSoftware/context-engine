import {
  dispatchBootstrapArweaveUpload as dispatchBootstrapArweaveUploadBoundary,
} from './bootstrapArweaveUploadDispatch.js';

export const dispatchBootstrapArweaveUploadWithWorkerDeps = async ({
  request,
  env,
  hasAuthorization,
  deps,
  constants,
} = {}) => {
  const log = typeof deps?.log === 'function' ? deps.log : () => {};
  const warn = (
    (typeof deps?.log?.warn === 'function' ? deps.log.warn : null) ||
    (typeof deps?.warn === 'function' ? deps.warn : null) ||
    (typeof deps?.log === 'function' ? deps.log : null) ||
    console.warn
  );
  const origin = request?.headers?.get?.('Origin') || '';
  const contentType = request?.headers?.get?.('content-type') || '';

  log('[arweave] request', {
    url: request?.url,
    hasAuthHeader: !!hasAuthorization,
    origin,
    contentType,
    cfRay: request?.headers?.get?.('CF-Ray') || '',
    ua: request?.headers?.get?.('User-Agent') || '',
  });

  return (deps?.dispatchBootstrapArweaveUpload || dispatchBootstrapArweaveUploadBoundary)({
    request,
    hasAuthorization,
    deps: {
      corsHeaders: deps?.corsHeaders,
      readArweaveBootstrapUploadPayload: deps?.readArweaveBootstrapUploadPayload,
      resolveWorkerBodySlugContext: ({ body }) => deps?.resolveWorkerBodySlugContext?.({ body, env }),
      json: deps?.json,
      MISSING_SLUG_ERROR: constants?.missingSlugError,
      getSessionConfig: (slug) => deps?.getSessionConfig?.(env, slug),
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR: constants?.bootstrapSessionConfigRequiredError,
      getCorsContext: deps?.getCorsContext,
      verifyAdminSignature: (value) => deps?.verifyAdminSignature?.({ ...value, env }),
      getSessionSecrets: (slug) => deps?.getSessionSecrets?.(env, slug),
      arweaveUpload: (value) => deps?.arweaveUpload?.({ ...value, env }),
      logBootstrapPayload: ({ requestId, body }) => log('[arweave] bootstrap payload', {
        requestId: requestId || null,
        hasAddress: !!body?.address,
        hasMessage: !!body?.message,
        hasSignature: !!body?.signature,
        sessionSlug: body?.sessionSlug || '',
        groupSlug: body?.groupSlug || '',
      }),
      logBootstrapConfigMissing: ({ targetSlug, requestId }) => warn('[arweave] bootstrap config missing', {
        targetSlug,
        requestId: requestId || null,
      }),
      logBootstrapCorsReject: ({ requestId, targetSlug, allowOrigins }) => warn('[arweave] cors reject', {
        requestId: requestId || null,
        origin,
        targetSlug,
        allowOrigins,
      }),
    },
  });
};
