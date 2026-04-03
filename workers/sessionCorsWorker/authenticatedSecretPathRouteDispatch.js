import { readArweaveUploadRequestPayload } from './arweaveUploadRequestNormalization.js';
import { issueLitPaymentDelegation } from './litPaymentDelegation.js';

export const dispatchAuthenticatedSecretPathRoute = async ({
  path,
  method,
  request,
  config,
  slug,
  address,
  env,
  limit,
  headers,
  scopes,
  deps,
} = {}) => {
  const isTranscribeRoute = path === '/transcribe' && method === 'POST';
  const isArweaveUploadRoute = path === '/arweave/upload' && method === 'POST';
  const isLitDelegationRoute = path === '/lit/payment-delegation' && method === 'POST';
  if (!isTranscribeRoute && !isArweaveUploadRoute && !isLitDelegationRoute) {
    return { handled: false };
  }

  const route = isTranscribeRoute
    ? 'transcribe'
    : (isArweaveUploadRoute ? 'arweave' : 'lit-payment-delegation');
  const scope = isTranscribeRoute
    ? 'transcribe'
    : (isArweaveUploadRoute ? 'arweave' : 'lit');
  const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
    scopes,
    scope,
    route,
    env,
    slug,
    address,
    limit,
    headers,
    deps: {
      checkRateLimit: deps?.checkRateLimit,
      json: deps?.json,
    },
  });
  if (!preflight?.ok) {
    return {
      handled: true,
      response: preflight?.response,
    };
  }

  const secretContext = await deps?.resolveAuthenticatedRouteSecrets?.({
    env,
    slug,
    headers,
    deps: {
      getSessionSecrets: deps?.getSessionSecrets,
      json: deps?.json,
    },
  });
  let secrets = secretContext?.secrets;
  if (!secretContext?.ok) {
    let canUseProvidedJwk = false;
    if (isArweaveUploadRoute && secretContext?.reason === 'missing_secrets') {
      const uploadPayload = await (
        deps?.readArweaveUploadRequestPayload || readArweaveUploadRequestPayload
      )(request);
      canUseProvidedJwk = !!uploadPayload?.ok && !!uploadPayload?.payload?.providedJwk;
    }
    if (canUseProvidedJwk) {
      // Authenticated uploads with a caller-provided Arweave key can proceed
      // without worker-managed secrets; arweaveUpload will prefer providedJwk.
      secrets = {};
    } else {
      return {
        handled: true,
        response: secretContext?.response,
      };
    }
  }

  if (!secrets) {
    return {
      handled: true,
      response: secretContext?.response,
    };
  }

  if (isLitDelegationRoute) {
    let body = {};
    try {
      body = await request.clone().json();
    } catch {
      return {
        handled: true,
        response: deps?.json?.({ error: 'Invalid JSON.' }, 400, headers),
      };
    }

    const litPayerPrivateKey = typeof secrets?.litPayerPrivateKey === 'string'
      ? secrets.litPayerPrivateKey.trim()
      : (secrets?.litPayerPrivateKey == null ? '' : String(secrets.litPayerPrivateKey).trim());
    if (!litPayerPrivateKey) {
      return {
        handled: true,
        response: deps?.json?.({ error: 'Lit payer key not configured.' }, 503, headers),
      };
    }

    try {
      const result = await (deps?.issueLitPaymentDelegation || issueLitPaymentDelegation)({
        requesterAddress: address,
        sessionPublicKey: body?.sessionPublicKey,
        litNetwork: body?.litNetwork || config?.lit?.network || config?.litNetwork || 'naga-dev',
        litPayerPrivateKey,
        audience: request?.headers?.get?.('Origin') || '',
        expiresAt: body?.expiresAt,
      });
      return {
        handled: true,
        response: deps?.json?.({ ok: true, ...result }, 200, headers),
      };
    } catch (error) {
      return {
        handled: true,
        response: deps?.json?.(
          { error: error?.message || 'Failed to issue Lit payment delegation.' },
          502,
          headers,
        ),
      };
    }
  }
  if (isTranscribeRoute) {
    return {
      handled: true,
      response: await deps?.transcribe?.({
        request,
        secrets,
        baseHeaders: headers,
      }),
    };
  }

  return {
    handled: true,
    response: await deps?.arweaveUpload?.({
      request,
      secrets,
      baseHeaders: headers,
      config,
      slug,
      uploaderAddress: address,
    }),
  };
};
