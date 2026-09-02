import {
  dispatchAnonymousRouteEntry as dispatchAnonymousRouteEntryBoundary,
} from './anonymousRouteEntry.js';
import {
  dispatchAnonymousRoute as dispatchAnonymousRouteBoundary,
} from './anonymousRouteDispatch.js';

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
      dispatchAnonymousRoute: (value) => {
        const dispatchAnonymousRoute = deps?.dispatchAnonymousRoute || dispatchAnonymousRouteBoundary;
        return dispatchAnonymousRoute({
          ...value,
          deps: {
            storageRoute: deps?.storageRoute,
            dispatchPublicWorkerGroupListRequest: deps?.dispatchPublicWorkerGroupListRequest,
            readTranscribeRequestPayload: deps?.readTranscribeRequestPayload,
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
        });
      },
    },
  })
);
