import {
  dispatchAuthenticatedRouteEntry as dispatchAuthenticatedRouteEntryBoundary,
} from './authenticatedRouteEntry.js';
import {
  dispatchAuthenticatedRouteWithWorkerDeps as dispatchAuthenticatedRouteWithWorkerDepsBoundary,
} from './authenticatedRouteDispatchBinding.js';
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
      dispatchAuthenticatedRoute: (value) => (
        (deps?.dispatchAuthenticatedRouteWithWorkerDeps || dispatchAuthenticatedRouteWithWorkerDepsBoundary)({
          ...value,
          env,
          deps: {
            dispatchAuthenticatedRoute: deps?.dispatchAuthenticatedRoute,
            dispatchAuthenticatedSecretPathRoute: deps?.dispatchAuthenticatedSecretPathRoute,
            readAuthenticatedActionPayload: deps?.readAuthenticatedActionPayload,
            dispatchAuthenticatedNonSecretActionRoute: deps?.dispatchAuthenticatedNonSecretActionRoute,
            dispatchAuthenticatedSecretActionRoute: deps?.dispatchAuthenticatedSecretActionRoute,
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
            fetchImage: deps?.fetchImage,
            fetchUrl: deps?.fetchUrl,
            normalizeAiRequestPayload: deps?.normalizeAiRequestPayload,
            proxyAnthropic: deps?.proxyAnthropic,
            proxyOpenAI: deps?.proxyOpenAI,
            proxyOpenRouter: deps?.proxyOpenRouter,
            proxyCustomRPC: deps?.proxyCustomRPC,
            faucet: deps?.faucet,
            toStr: deps?.toStr,
          },
        })
      ),
    },
  })
);
