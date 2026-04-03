import { getRouteBaseHeaders } from './routeBaseHeaders.js';

export const dispatchBootstrapArweaveUpload = async ({
  request,
  hasAuthorization,
  deps,
} = {}) => {
  if (hasAuthorization) {
    return { handled: false };
  }

  const bootstrapHeaders = getRouteBaseHeaders({
    request,
    deps: {
      corsHeaders: deps?.corsHeaders,
    },
  });
  const bootstrapPayload = await deps?.readArweaveBootstrapUploadPayload?.(request);
  if (!bootstrapPayload?.ok) {
    return {
      handled: true,
      response: deps?.json?.({ error: bootstrapPayload?.error }, 400, bootstrapHeaders),
    };
  }

  const { body, hasProvidedArweaveJwk } = bootstrapPayload;
  const requestId = body?.requestId || '';
  deps?.logBootstrapPayload?.({ requestId, body });

  const slugContext = deps?.resolveWorkerBodySlugContext?.({ body }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugContext?.ok) {
    return {
      handled: true,
      response: deps?.json?.({ error: slugContext?.error }, 400, bootstrapHeaders),
    };
  }

  const explicitSlugProvided = slugContext?.explicitSlugProvided === true || !!slugContext?.targetSlug;
  const targetSlug = slugContext?.targetSlug ?? '';
  if (!explicitSlugProvided) {
    return {
      handled: true,
      response: deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, bootstrapHeaders),
    };
  }

  const config = await deps?.getSessionConfig?.(targetSlug);
  const missingSessionConfig = !config;
  if (missingSessionConfig) {
    deps?.logBootstrapConfigMissing?.({ targetSlug, requestId });
    if (!hasProvidedArweaveJwk) {
      return {
        handled: true,
        response: deps?.json?.(
          { error: deps?.BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR },
          404,
          bootstrapHeaders,
        ),
      };
    }
  }

  const corsContext = await deps?.getCorsContext?.({ request, config: config || {} });
  if (!corsContext?.ok) {
    deps?.logBootstrapCorsReject?.({
      requestId,
      origin: request?.headers?.get('Origin') || '',
      targetSlug,
      allowOrigins: config?.allowOrigins || null,
    });
    return {
      handled: true,
      response: corsContext?.response,
    };
  }

  const adminCheck = await deps?.verifyAdminSignature?.({
    baseHeaders: corsContext.headers,
    slugHint: targetSlug,
    body,
    config,
    allowBootstrapWithoutConfig: missingSessionConfig && hasProvidedArweaveJwk,
  });
  if (!adminCheck?.ok) {
    return {
      handled: true,
      response: adminCheck?.response,
    };
  }

  const secrets = missingSessionConfig
    ? {}
    : ((await deps?.getSessionSecrets?.(targetSlug)) || {});
  return {
    handled: true,
    response: await deps?.arweaveUpload?.({
      request,
      secrets,
      baseHeaders: corsContext.headers,
      config: config || null,
      slug: targetSlug,
      uploaderAddress: adminCheck?.address || '',
    }),
  };
};
