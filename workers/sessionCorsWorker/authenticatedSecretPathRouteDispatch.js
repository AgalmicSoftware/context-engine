import { readArweaveUploadRequestPayload } from './arweaveUploadRequestNormalization.js';
import { resolveMaxUploadBytes } from './uploadSizeLimits.js';
import { workerGroupsRoute as workerGroupsRouteBoundary } from './workerGroups.js';

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
    (path === '/storage/list' && (method === 'GET' || method === 'POST')) ||
    (path === '/storage/export-envelopes' && (method === 'GET' || method === 'POST'))
  );
  const isWorkerGroupsRoute = (
    (path === '/groups/my-memberships' && (method === 'GET' || method === 'POST')) ||
    (path === '/groups/list' && (method === 'GET' || method === 'POST')) ||
    (path === '/groups/join' && method === 'POST')
  );
  if (!isTranscribeRoute && !isArweaveUploadRoute && !isStorageRoute && !isWorkerGroupsRoute) {
    return { handled: false };
  }

  const route = isTranscribeRoute
    ? 'transcribe'
    : (isStorageRoute ? 'storage' : (isWorkerGroupsRoute ? 'groups' : 'arweave'));
  const scope = route === 'storage' && scopes?.storage !== true ? 'arweave' : route;
  const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
    scopes,
    scope,
    route,
    config,
    env,
    slug,
    address,
    limit,
    headers,
    deps: {
      checkRateLimit: deps?.checkRateLimit,
      computeScopesForLogin: deps?.computeScopesForLogin,
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

  if (isWorkerGroupsRoute) {
    const workerGroupsRoute = deps?.workerGroupsRoute || workerGroupsRouteBoundary;
    return {
      handled: true,
      response: await workerGroupsRoute({
        path,
        method,
        request,
        env,
        config,
        slug,
        requesterAddress: address,
        authScopes: scopes,
        baseHeaders: headers,
        deps: {
          json: deps?.json,
          isAddress: deps?.isAddress,
          getAddress: deps?.getAddress,
          now: deps?.now,
          randomUUID: deps?.randomUUID,
          getRandomValues: deps?.getRandomValues,
        },
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
      const maxUploadBytes = resolveMaxUploadBytes({ env, deps });
      const uploadPayload = await (
        deps?.readArweaveUploadRequestPayload || readArweaveUploadRequestPayload
      )(request, { maxUploadBytes });
      if (uploadPayload?.status === 413) {
        return {
          handled: true,
          response: deps?.json?.({ error: uploadPayload.error }, 413, headers),
        };
      }
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
      env,
      secrets,
      baseHeaders: headers,
      config,
      slug,
      uploaderAddress: address,
    }),
  };
};
