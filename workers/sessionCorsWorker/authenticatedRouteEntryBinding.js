import {
  dispatchAuthenticatedRouteEntry as dispatchAuthenticatedRouteEntryBoundary,
} from './authenticatedRouteEntry.js';
import {
  dispatchAuthenticatedRoute as dispatchAuthenticatedRouteBoundary,
} from './authenticatedRouteDispatch.js';
import {
  resolveAuthenticatedRouteContext as resolveAuthenticatedRouteContextBoundary,
} from './authenticatedRouteContextResolution.js';

export const dispatchAuthenticatedRouteEntryWithWorkerDeps = async ({
  path,
  method,
  request,
  env,
  baseHeaders,
  deps,
  constants,
} = {}) => (
  (deps?.dispatchAuthenticatedRouteEntry || dispatchAuthenticatedRouteEntryBoundary)({
    path,
    method,
    request,
    env,
    baseHeaders,
    deps: {
      json: deps?.json,
      requireAuth: deps?.requireAuth,
      resolveAuthenticatedRouteContext: (value) => (
        (deps?.resolveAuthenticatedRouteContext || resolveAuthenticatedRouteContextBoundary)({
          ...value,
          deps: {
            getSessionConfig: deps?.getSessionConfig,
            getCorsContext: deps?.getCorsContext,
            json: deps?.json,
            toStr: deps?.toStr,
            SESSION_CONFIG_NOT_FOUND_ERROR: constants?.sessionConfigNotFoundError,
          },
        })
      ),
      dispatchAuthenticatedRoute: (value) => {
        const dispatchAuthenticatedRoute = (
          deps?.dispatchAuthenticatedRoute || dispatchAuthenticatedRouteBoundary
        );
        return dispatchAuthenticatedRoute({
          ...value,
          deps: {
            dispatchAuthenticatedSecretPathRoute: (routeValue) => (
              deps?.dispatchAuthenticatedSecretPathRoute?.({
                ...routeValue,
                env,
                deps: {
                  evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
                  computeScopesForLogin: deps?.computeScopesForLogin,
                  resolveAuthenticatedRouteSecrets: deps?.resolveAuthenticatedRouteSecrets,
                  checkRateLimit: deps?.checkRateLimit,
                  getSessionSecrets: deps?.getSessionSecrets,
                  json: deps?.json,
                  isAddress: deps?.isAddress,
                  getAddress: deps?.getAddress,
                  transcribe: deps?.transcribe,
                  arweaveUpload: deps?.arweaveUpload,
                  storageRoute: deps?.storageRoute,
                  now: deps?.now,
                },
              })
            ),
            readAuthenticatedActionPayload: deps?.readAuthenticatedActionPayload,
            dispatchAuthenticatedNonSecretActionRoute: (routeValue) => (
              deps?.dispatchAuthenticatedNonSecretActionRoute?.({
                ...routeValue,
                env,
                deps: {
                  evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
                  computeScopesForLogin: deps?.computeScopesForLogin,
                  fetchImage: deps?.fetchImage,
                  fetchUrl: deps?.fetchUrl,
                  checkRateLimit: deps?.checkRateLimit,
                  json: deps?.json,
                  now: deps?.now,
                },
              })
            ),
            dispatchAuthenticatedSecretActionRoute: (routeValue) => (
              deps?.dispatchAuthenticatedSecretActionRoute?.({
                ...routeValue,
                env,
                deps: {
                  evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
                  computeScopesForLogin: deps?.computeScopesForLogin,
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
                  now: deps?.now,
                },
              })
            ),
            json: deps?.json,
          },
        });
      },
    },
  })
);
