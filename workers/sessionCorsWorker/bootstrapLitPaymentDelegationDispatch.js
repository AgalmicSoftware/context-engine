import { getRouteBaseHeaders } from './routeBaseHeaders.js';
import { issueLitPaymentDelegation } from './litPaymentDelegation.js';

export const dispatchBootstrapLitPaymentDelegation = async ({
  request,
  deps,
} = {}) => {
  const headers = getRouteBaseHeaders({
    request,
    deps: {
      corsHeaders: deps?.corsHeaders,
    },
  });

  let body;
  try {
    body = await request?.json?.();
  } catch {
    return {
      handled: true,
      response: deps?.json?.({ error: 'Invalid JSON.' }, 400, headers),
    };
  }

  const slugContext = deps?.resolveWorkerBodySlugContext?.({ body }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugContext?.ok) {
    return {
      handled: true,
      response: deps?.json?.({ error: slugContext?.error }, 400, headers),
    };
  }

  const explicitSlugProvided = slugContext?.explicitSlugProvided === true || !!slugContext?.targetSlug;
  const targetSlug = slugContext?.targetSlug ?? '';
  if (!explicitSlugProvided) {
    return {
      handled: true,
      response: deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, headers),
    };
  }

  const config = await deps?.getSessionConfig?.(targetSlug);
  const providedLitPayerPrivateKey = typeof body?.litPayerPrivateKey === 'string'
    ? body.litPayerPrivateKey.trim()
    : (body?.litPayerPrivateKey == null ? '' : String(body.litPayerPrivateKey).trim());
  const missingSessionConfig = !config;
  if (missingSessionConfig && !providedLitPayerPrivateKey) {
    return {
      handled: true,
      response: deps?.json?.(
        { error: deps?.BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR },
        404,
        headers,
      ),
    };
  }

  const corsContext = await deps?.getCorsContext?.({ request, config: config || {} });
  if (!corsContext?.ok) {
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
    allowBootstrapWithoutConfig: missingSessionConfig && !!providedLitPayerPrivateKey,
  });
  if (!adminCheck?.ok) {
    return {
      handled: true,
      response: adminCheck?.response,
    };
  }

  const storedSecrets = missingSessionConfig
    ? {}
    : ((await deps?.getSessionSecrets?.(targetSlug)) || {});
  const litPayerPrivateKey = providedLitPayerPrivateKey || (
    typeof storedSecrets?.litPayerPrivateKey === 'string'
      ? storedSecrets.litPayerPrivateKey.trim()
      : ''
  );
  if (!litPayerPrivateKey) {
    return {
      handled: true,
      response: deps?.json?.({ error: 'Lit payer key not configured.' }, 503, corsContext.headers),
    };
  }

  try {
    const result = await (deps?.issueLitPaymentDelegation || issueLitPaymentDelegation)({
      requesterAddress: adminCheck?.address || '',
      sessionPublicKey: body?.sessionPublicKey,
      litNetwork: body?.litNetwork || config?.lit?.network || config?.litNetwork || 'naga-dev',
      litPayerPrivateKey,
      audience: request?.headers?.get?.('Origin') || '',
      expiresAt: body?.expiresAt,
    });
    return {
      handled: true,
      response: deps?.json?.({ ok: true, ...result }, 200, corsContext.headers),
    };
  } catch (error) {
    return {
      handled: true,
      response: deps?.json?.(
        { error: error?.message || 'Failed to issue Lit payment delegation.' },
        502,
        corsContext.headers,
      ),
    };
  }
};
