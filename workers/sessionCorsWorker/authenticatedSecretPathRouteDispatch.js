import { readArweaveUploadRequestPayload } from './arweaveUploadRequestNormalization.js';

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
  const isStorageRoute = (
    (path === '/storage/upload' && method === 'POST') ||
    (path === '/storage/read' && (method === 'GET' || method === 'POST')) ||
    (path === '/storage/list' && (method === 'GET' || method === 'POST'))
  );
  if (!isTranscribeRoute && !isArweaveUploadRoute && !isStorageRoute) {
    return { handled: false };
  }

  const route = isTranscribeRoute
    ? 'transcribe'
    : (isStorageRoute ? 'storage' : 'arweave');
  const scope = isTranscribeRoute
    ? 'transcribe'
    : (isStorageRoute && scopes?.storage === true ? 'storage' : 'arweave');
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

  if (isStorageRoute) {
    return {
      handled: true,
      response: await deps?.storageRoute?.({
        path,
        method,
        request,
        env,
        config,
        slug,
        uploaderAddress: address,
        authScopes: scopes,
        baseHeaders: headers,
      }),
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
