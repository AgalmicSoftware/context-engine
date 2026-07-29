import {
  dispatchAnonymousRouteEntry as dispatchAnonymousRouteEntryBoundary,
} from './anonymousRouteEntry.js';
import {
  dispatchAnonymousRouteWithWorkerDeps as dispatchAnonymousRouteWithWorkerDepsBoundary,
} from './anonymousRouteDispatchBinding.js';

export const dispatchAnonymousRouteEntryWithWorkerDeps = async ({
  path,
  anonymousRoute,
  request,
  env,
  slugHint,
  baseHeaders,
  deps,
  constants,
} = {}) => (
  (deps?.dispatchAnonymousRouteEntry || dispatchAnonymousRouteEntryBoundary)({
    path,
    anonymousRoute,
    request,
    env,
    slugHint,
    baseHeaders,
    deps: {
      resolveRequestSlugWithoutToken: deps?.resolveRequestSlugWithoutToken,
      json: deps?.json,
      MISSING_SLUG_ERROR: constants?.missingSlugError,
      getSessionConfig: deps?.getSessionConfig,
      SESSION_CONFIG_NOT_FOUND_ERROR: constants?.sessionConfigNotFoundError,
      getCorsContext: deps?.getCorsContext,
      resolveAnonymousRateIdentity: deps?.resolveAnonymousRateIdentity,
      checkRateLimit: deps?.checkRateLimit,
      dispatchAnonymousRoute: (value) => (
        (deps?.dispatchAnonymousRouteWithWorkerDeps || dispatchAnonymousRouteWithWorkerDepsBoundary)({
          ...value,
          env,
          deps: {
            dispatchAnonymousRoute: deps?.dispatchAnonymousRoute,
            storageRoute: deps?.storageRoute,
            readTranscribeRequestPayload: deps?.readTranscribeRequestPayload,
            evaluateAnonymousRouteAccess: deps?.evaluateAnonymousRouteAccess,
            getSessionSecrets: deps?.getSessionSecrets,
            transcribe: deps?.transcribe,
            readAiRequestPayload: deps?.readAiRequestPayload,
            validateAnonymousAiRequest: deps?.validateAnonymousAiRequest,
            proxyAnthropic: deps?.proxyAnthropic,
            proxyOpenAI: deps?.proxyOpenAI,
            proxyOpenRouter: deps?.proxyOpenRouter,
            proxyCustomRPC: deps?.proxyCustomRPC,
            json: deps?.json,
            now: deps?.now,
          },
          constants: {
            anonymousRouteDeniedError: constants?.anonymousRouteDeniedError,
          },
        })
      ),
    },
  })
);
