export const dispatchAuthenticatedRouteWithWorkerDeps = async ({
  path,
  method,
  request,
  authenticatedContext,
  env,
  deps,
} = {}) => (
  deps?.dispatchAuthenticatedRoute?.({
    path,
    method,
    request,
    authenticatedContext,
    deps: {
      dispatchAuthenticatedSecretPathRoute: (value) => deps?.dispatchAuthenticatedSecretPathRoute?.({
        ...value,
        env,
        deps: {
          evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
          resolveAuthenticatedRouteSecrets: deps?.resolveAuthenticatedRouteSecrets,
          checkRateLimit: deps?.checkRateLimit,
          getSessionSecrets: deps?.getSessionSecrets,
          json: deps?.json,
          isAddress: deps?.isAddress,
          getAddress: deps?.getAddress,
          transcribe: deps?.transcribe,
          arweaveUpload: deps?.arweaveUpload,
          storageRoute: deps?.storageRoute,
        },
      }),
      readAuthenticatedActionPayload: deps?.readAuthenticatedActionPayload,
      dispatchAuthenticatedNonSecretActionRoute: (value) => deps?.dispatchAuthenticatedNonSecretActionRoute?.({
        ...value,
        env,
        deps: {
          evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
          fetchImage: deps?.fetchImage,
          fetchUrl: deps?.fetchUrl,
          checkRateLimit: deps?.checkRateLimit,
          json: deps?.json,
        },
      }),
      dispatchAuthenticatedSecretActionRoute: (value) => deps?.dispatchAuthenticatedSecretActionRoute?.({
        ...value,
        env,
        deps: {
          evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
          resolveAuthenticatedRouteSecrets: deps?.resolveAuthenticatedRouteSecrets,
          normalizeAiRequestPayload: deps?.normalizeAiRequestPayload,
          proxyAnthropic: deps?.proxyAnthropic,
          proxyOpenAI: deps?.proxyOpenAI,
          proxyOpenRouter: deps?.proxyOpenRouter,
          proxyCustomRPC: deps?.proxyCustomRPC,
          faucet: deps?.faucet,
          checkRateLimit: deps?.checkRateLimit,
          getSessionSecrets: deps?.getSessionSecrets,
          json: deps?.json,
          toStr: deps?.toStr,
        },
      }),
      json: deps?.json,
    },
  })
);
