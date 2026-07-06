import {
  dispatchAnonymousRouteEntryWithWorkerDeps as dispatchAnonymousRouteEntryWithWorkerDepsBoundary,
} from './anonymousRouteEntryBinding.js';
import {
  dispatchAuthenticatedRouteEntryWithWorkerDeps as dispatchAuthenticatedRouteEntryWithWorkerDepsBoundary,
} from './authenticatedRouteEntryBinding.js';
import {
  dispatchAdminRequestWithWorkerDeps as dispatchAdminRequestWithWorkerDepsBoundary,
} from './adminRequestBinding.js';
import {
  dispatchAuthLoginRequestWithWorkerDeps as dispatchAuthLoginRequestWithWorkerDepsBoundary,
  dispatchAuthNonceRequestWithWorkerDeps as dispatchAuthNonceRequestWithWorkerDepsBoundary,
} from './authRequestBinding.js';
import {
  dispatchBootstrapArweaveUploadWithWorkerDeps as dispatchBootstrapArweaveUploadWithWorkerDepsBoundary,
} from './bootstrapArweaveUploadBinding.js';
import {
  dispatchSponsoredBootstrapRedeem as dispatchSponsoredBootstrapRedeemBoundary,
} from './sponsoredBootstrapRedeemDispatch.js';
import {
  getRouteBaseHeaders as getRouteBaseHeadersBoundary,
} from './routeBaseHeaders.js';
import {
  getDefaultWorkerSessionSlug as getDefaultWorkerSessionSlugBoundary,
} from './sessionSlugResolution.js';
import {
  resolveTopLevelRouteSelection as resolveTopLevelRouteSelectionBoundary,
} from './topLevelRouteSelection.js';

export const createWorkerRouteShellWithWorkerDeps = ({
  deps,
  constants,
} = {}) => {
  const resolveTopLevelRouteSelection = (
    deps?.resolveTopLevelRouteSelection || resolveTopLevelRouteSelectionBoundary
  );
  const getRouteBaseHeaders = deps?.getRouteBaseHeaders || getRouteBaseHeadersBoundary;
  const getDefaultWorkerSessionSlug = (
    deps?.getDefaultWorkerSessionSlug || getDefaultWorkerSessionSlugBoundary
  );
  const dispatchAuthNonceRequestWithWorkerDeps = (
    deps?.dispatchAuthNonceRequestWithWorkerDeps || dispatchAuthNonceRequestWithWorkerDepsBoundary
  );
  const dispatchAuthLoginRequestWithWorkerDeps = (
    deps?.dispatchAuthLoginRequestWithWorkerDeps || dispatchAuthLoginRequestWithWorkerDepsBoundary
  );
  const dispatchBootstrapArweaveUploadWithWorkerDeps = (
    deps?.dispatchBootstrapArweaveUploadWithWorkerDeps || dispatchBootstrapArweaveUploadWithWorkerDepsBoundary
  );
  const dispatchSponsoredBootstrapRedeem = (
    deps?.dispatchSponsoredBootstrapRedeem || dispatchSponsoredBootstrapRedeemBoundary
  );
  const dispatchAdminRequestWithWorkerDeps = (
    deps?.dispatchAdminRequestWithWorkerDeps || dispatchAdminRequestWithWorkerDepsBoundary
  );
  const dispatchAnonymousRouteEntryWithWorkerDeps = (
    deps?.dispatchAnonymousRouteEntryWithWorkerDeps || dispatchAnonymousRouteEntryWithWorkerDepsBoundary
  );
  const dispatchAuthenticatedRouteEntryWithWorkerDeps = (
    deps?.dispatchAuthenticatedRouteEntryWithWorkerDeps || dispatchAuthenticatedRouteEntryWithWorkerDepsBoundary
  );
  const log = deps?.log || (() => {});
  const ResponseCtor = deps?.Response || Response;

  const handleRequest = async (request, env) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const routeSelection = resolveTopLevelRouteSelection({
      path,
      method,
      request,
      deps: { toStr: deps?.toStr },
    });
    const routeBaseHeaders = getRouteBaseHeaders({
      request,
      deps: { corsHeaders: deps?.corsHeaders },
    });
    try {
      if (routeSelection.kind === 'options') {
        if (path === '/arweave/upload') {
          log('[arweave] preflight', {
            origin: request.headers.get('Origin') || '',
            requestMethod: request.headers.get('Access-Control-Request-Method') || '',
            requestHeaders: request.headers.get('Access-Control-Request-Headers') || '',
            url: request.url,
          });
        }
        return new ResponseCtor(null, { status: 204, headers: routeBaseHeaders });
      }

      const envSlug = getDefaultWorkerSessionSlug(env);

      if (routeSelection.kind === 'auth-nonce') {
        return await dispatchAuthNonceRequestWithWorkerDeps({
        request,
        env,
        baseHeaders: routeBaseHeaders,
        slug: envSlug,
        deps: {
          json: deps?.json,
          toStr: deps?.toStr,
          isAddress: deps?.isAddress,
          resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
          resolveExistingSessionCors: deps?.resolveExistingSessionCors,
          validateTrustedLoginRequestOrigin: deps?.validateTrustedLoginRequestOrigin,
          resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
          checkNonceRateLimit: deps?.checkNonceRateLimit,
          now: deps?.now,
          buildNonce: deps?.buildNonce,
          base64UrlEncode: deps?.base64UrlEncode,
        },
        constants: {
          missingSlugError: constants?.missingSlugError,
          nonceTtlSeconds: constants?.nonceTtlSeconds,
          nonceRateLimitMax: constants?.nonceRateLimitMax,
          nonceRateLimitWindowMs: constants?.nonceRateLimitWindowMs,
          nonceRateLimitTtlSeconds: constants?.nonceRateLimitTtlSeconds,
        },
      });
    }

      if (routeSelection.kind === 'auth-login') {
        return await dispatchAuthLoginRequestWithWorkerDeps({
        request,
        env,
        baseHeaders: routeBaseHeaders,
        slug: envSlug,
        deps: {
          json: deps?.json,
          normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
          resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
          isAddress: deps?.isAddress,
          resolveExistingSessionCors: deps?.resolveExistingSessionCors,
          verifyMessage: deps?.verifyMessage,
          validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
          parseSiweMessage: deps?.parseSiweMessage,
          validateSiwe: deps?.validateSiwe,
          validateBrowserLoginOrigin: deps?.validateBrowserLoginOrigin,
          resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
          validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
          consumeNonce: deps?.consumeNonce,
          computeScopesForLogin: deps?.computeScopesForLogin,
          signToken: deps?.signToken,
          getAddress: deps?.getAddress,
          buildAuthTokenJti: deps?.buildAuthTokenJti,
          persistAuthTokenRecord: deps?.persistAuthTokenRecord,
          now: deps?.now,
        },
        constants: {
          usedNonceTtlSeconds: constants?.usedNonceTtlSeconds,
          tokenTtlSeconds: constants?.tokenTtlSeconds,
          loginSiweMaxAgeMs: constants?.loginSiweMaxAgeMs,
          loginSiweFutureSkewMs: constants?.loginSiweFutureSkewMs,
          missingSlugError: constants?.missingSlugError,
          sessionConfigNotFoundError: constants?.sessionConfigNotFoundError,
        },
      });
    }

      if (routeSelection.kind === 'arweave-upload') {
        const bootstrapUpload = await dispatchBootstrapArweaveUploadWithWorkerDeps({
        request,
        env,
        hasAuthorization: routeSelection.hasAuthorizationHeader,
        deps: {
          log,
          corsHeaders: deps?.corsHeaders,
          readArweaveBootstrapUploadPayload: deps?.readArweaveBootstrapUploadPayload,
          resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
          json: deps?.json,
          getSessionConfig: deps?.getSessionConfig,
          getCorsContext: deps?.getCorsContext,
          verifyAdminSignature: deps?.verifyAdminSignature,
          getSessionSecrets: deps?.getSessionSecrets,
          arweaveUpload: deps?.arweaveUpload,
          storageRoute: deps?.storageRoute,
        },
        constants: {
          missingSlugError: constants?.missingSlugError,
          bootstrapSessionConfigRequiredError: constants?.bootstrapSessionConfigRequiredError,
        },
      });
        if (bootstrapUpload.handled) return bootstrapUpload.response;
      }

      if (routeSelection.kind === 'sponsored-bootstrap-redeem') {
        return await dispatchSponsoredBootstrapRedeem({
        request,
        env,
        baseHeaders: routeBaseHeaders,
        action: routeSelection.action,
        deps: {
          json: deps?.json,
          fetch: deps?.fetch,
          getCorsContext: deps?.getCorsContext,
          faucet: deps?.faucet,
        },
      });
    }

      if (routeSelection.kind === 'admin') {
        return await dispatchAdminRequestWithWorkerDeps({
        request,
        env,
        baseHeaders: routeBaseHeaders,
        slug: envSlug,
        action: routeSelection.action,
        deps: {
          json: deps?.json,
          normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
          resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
          isAddress: deps?.isAddress,
          getAddress: deps?.getAddress,
          resolveExistingSessionCors: deps?.resolveExistingSessionCors,
          verifyMessage: deps?.verifyMessage,
          validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
          parseSiweMessage: deps?.parseSiweMessage,
          validateSiwe: deps?.validateSiwe,
          validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
          consumeNonce: deps?.consumeNonce,
          validateBootstrapAdmin: deps?.validateBootstrapAdmin,
          validateAdmin: deps?.validateAdmin,
          mergeWorkerConfigRecords: deps?.mergeWorkerConfigRecords,
          mergeWorkerLimitRecords: deps?.mergeWorkerLimitRecords,
          putSessionConfig: deps?.putSessionConfig,
          getSessionSecrets: deps?.getSessionSecrets,
          normalizeSecretValue: deps?.normalizeSecretValue,
          putSessionSecrets: deps?.putSessionSecrets,
        },
        constants: {
          usedNonceTtlSeconds: constants?.usedNonceTtlSeconds,
          missingSlugError: constants?.missingSlugError,
        },
      });
    }

      if (routeSelection.kind === 'anonymous') {
        return await dispatchAnonymousRouteEntryWithWorkerDeps({
        path,
        anonymousRoute: routeSelection.anonymousRoute,
        request,
        env,
        slugHint: envSlug,
        baseHeaders: routeBaseHeaders,
        deps: {
          resolveRequestSlugWithoutToken: deps?.resolveRequestSlugWithoutToken,
          json: deps?.json,
          getSessionConfig: deps?.getSessionConfig,
          getCorsContext: deps?.getCorsContext,
          resolveAnonymousRateIdentity: deps?.resolveAnonymousRateIdentity,
          checkRateLimit: deps?.checkRateLimit,
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
        },
        constants: {
          missingSlugError: constants?.missingSlugError,
          sessionConfigNotFoundError: constants?.sessionConfigNotFoundError,
          anonymousRouteDeniedError: constants?.anonymousRouteDeniedError,
        },
      });
    }

      return await dispatchAuthenticatedRouteEntryWithWorkerDeps({
        path,
        method,
        request,
        env,
        baseHeaders: routeBaseHeaders,
        deps: {
          json: deps?.json,
          requireAuth: deps?.requireAuth,
          getSessionConfig: deps?.getSessionConfig,
          getCorsContext: deps?.getCorsContext,
          toStr: deps?.toStr,
          dispatchAuthenticatedRoute: deps?.dispatchAuthenticatedRoute,
          dispatchAuthenticatedSecretPathRoute: deps?.dispatchAuthenticatedSecretPathRoute,
          readAuthenticatedActionPayload: deps?.readAuthenticatedActionPayload,
          dispatchAuthenticatedNonSecretActionRoute: deps?.dispatchAuthenticatedNonSecretActionRoute,
          dispatchAuthenticatedSecretActionRoute: deps?.dispatchAuthenticatedSecretActionRoute,
          evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
          resolveAuthenticatedRouteSecrets: deps?.resolveAuthenticatedRouteSecrets,
          checkRateLimit: deps?.checkRateLimit,
          getSessionSecrets: deps?.getSessionSecrets,
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
        },
        constants: {
          sessionConfigNotFoundError: constants?.sessionConfigNotFoundError,
        },
      });
    } catch (error) {
      log?.error?.('[worker] unhandled route error', {
        path,
        method,
        error: error?.message || String(error || 'Unknown error'),
      });
      const message = (
        typeof deps?.toStr === 'function'
          ? deps.toStr(error?.message || error)
          : String(error?.message || error || '')
      ).trim() || 'Worker request failed.';
      if (typeof deps?.json === 'function') {
        return deps.json({ error: message }, 500, routeBaseHeaders);
      }
      return new ResponseCtor(JSON.stringify({ error: message }), {
        status: 500,
        headers: routeBaseHeaders,
      });
    }
  };

  return {
    fetch: handleRequest,
  };
};
