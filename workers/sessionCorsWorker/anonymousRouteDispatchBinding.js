export const dispatchAnonymousRouteWithWorkerDeps = async ({
  path,
  request,
  anonymousContext,
  env,
  deps,
  constants,
} = {}) => (
  deps?.dispatchAnonymousRoute?.({
    path,
    request,
    anonymousContext,
    deps: {
      readTranscribeRequestPayload: deps?.readTranscribeRequestPayload,
      storageRoute: deps?.storageRoute,
      dispatchPublicWorkerGroupListRequest: deps?.dispatchPublicWorkerGroupListRequest,
      evaluateAnonymousRouteAccess: deps?.evaluateAnonymousRouteAccess,
      getSessionSecrets: (sessionSlug) => deps?.getSessionSecrets?.(env, sessionSlug),
      transcribe: deps?.transcribe,
      readAiRequestPayload: deps?.readAiRequestPayload,
      validateAnonymousAiRequest: deps?.validateAnonymousAiRequest,
      proxyAnthropic: deps?.proxyAnthropic,
      proxyOpenAI: deps?.proxyOpenAI,
      proxyOpenRouter: deps?.proxyOpenRouter,
      proxyCustomRPC: deps?.proxyCustomRPC,
      json: deps?.json,
      now: deps?.now,
      ANONYMOUS_ROUTE_DENIED_ERROR: constants?.anonymousRouteDeniedError,
    },
  })
);
