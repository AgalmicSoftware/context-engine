import { BodyByteLimitError, readBodyBytes } from '../shared/bodyByteLimit.mjs';
import { resolveMaxUploadBytes } from './uploadSizeLimits.js';
import {
  dispatchAnonymousRouteEntry as dispatchAnonymousRouteEntryBoundary,
} from './anonymousRouteEntry.js';
import {
  dispatchAnonymousRoute as dispatchAnonymousRouteBoundary,
} from './anonymousRouteDispatch.js';
import {
  dispatchAuthenticatedRouteEntry as dispatchAuthenticatedRouteEntryBoundary,
} from './authenticatedRouteEntry.js';
import {
  dispatchAuthenticatedRoute as dispatchAuthenticatedRouteBoundary,
} from './authenticatedRouteDispatch.js';
import {
  resolveAuthenticatedRouteContext as resolveAuthenticatedRouteContextBoundary,
} from './authenticatedRouteContextResolution.js';
import {
  dispatchAdminRequest as dispatchAdminRequestBoundary,
} from './adminRequestDispatch.js';
import {
  dispatchAdminAbuseSummaryRequest as dispatchAdminAbuseSummaryRequestBoundary,
} from './adminAbuseSummaryDispatch.js';
import {
  dispatchAuthNonceRequest as dispatchAuthNonceRequestBoundary,
} from './authNonceRequestDispatch.js';
import {
  dispatchAuthLoginRequest as dispatchAuthLoginRequestBoundary,
} from './authLoginRequestDispatch.js';
import {
  issueNonce as issueNonceBoundary,
} from './nonceLifecycle.js';
import {
  dispatchBootstrapArweaveUpload as dispatchBootstrapArweaveUploadBoundary,
} from './bootstrapArweaveUploadDispatch.js';
import {
  dispatchSponsoredBootstrapRedeem as dispatchSponsoredBootstrapRedeemBoundary,
} from './sponsoredBootstrapRedeemDispatch.js';
import {
  dispatchResourcePresenceRequest as dispatchResourcePresenceRequestBoundary,
} from './resourcePresenceDispatch.js';
import {
  dispatchSessionConfigBootstrapRequest as dispatchSessionConfigBootstrapRequestBoundary,
} from './sessionConfigBootstrapDispatch.js';
import {
  dispatchInterviewBriefRequest as dispatchInterviewBriefRequestBoundary,
} from './interviewBriefDispatch.js';
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
  const dispatchAuthNonceRequest = deps?.dispatchAuthNonceRequest || dispatchAuthNonceRequestBoundary;
  const dispatchAuthLoginRequest = deps?.dispatchAuthLoginRequest || dispatchAuthLoginRequestBoundary;
  const dispatchBootstrapArweaveUpload = (
    deps?.dispatchBootstrapArweaveUpload || dispatchBootstrapArweaveUploadBoundary
  );
  const dispatchSponsoredBootstrapRedeem = (
    deps?.dispatchSponsoredBootstrapRedeem || dispatchSponsoredBootstrapRedeemBoundary
  );
  const dispatchResourcePresenceRequest = (
    deps?.dispatchResourcePresenceRequest || dispatchResourcePresenceRequestBoundary
  );
  const dispatchSessionConfigBootstrapRequest = (
    deps?.dispatchSessionConfigBootstrapRequest || dispatchSessionConfigBootstrapRequestBoundary
  );
  const dispatchInterviewBriefRequest = (
    deps?.dispatchInterviewBriefRequest || dispatchInterviewBriefRequestBoundary
  );
  const dispatchAdminRequest = deps?.dispatchAdminRequest || dispatchAdminRequestBoundary;
  const dispatchAdminAbuseSummaryRequest = (
    deps?.dispatchAdminAbuseSummaryRequest || dispatchAdminAbuseSummaryRequestBoundary
  );
  const dispatchAnonymousRouteEntry = (
    deps?.dispatchAnonymousRouteEntry || dispatchAnonymousRouteEntryBoundary
  );
  const dispatchAnonymousRoute = deps?.dispatchAnonymousRoute || dispatchAnonymousRouteBoundary;
  const dispatchAuthenticatedRouteEntry = (
    deps?.dispatchAuthenticatedRouteEntry || dispatchAuthenticatedRouteEntryBoundary
  );
  const dispatchAuthenticatedRoute = (
    deps?.dispatchAuthenticatedRoute || dispatchAuthenticatedRouteBoundary
  );
  const resolveAuthenticatedRouteContext = (
    deps?.resolveAuthenticatedRouteContext || resolveAuthenticatedRouteContextBoundary
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

      if (request.body) {
        const bytes = await readBodyBytes(request, resolveMaxUploadBytes({ env }));
        request = new Request(request, { body: bytes });
      }
      const envSlug = getDefaultWorkerSessionSlug(env);

      if (routeSelection.kind === 'session-config') {
        return await dispatchSessionConfigBootstrapRequest({
          request,
          env,
          slugHint: envSlug,
          baseHeaders: routeBaseHeaders,
          deps: {
            resolveRequestSlugWithoutToken: deps?.resolveRequestSlugWithoutToken,
            getSessionConfig: deps?.getSessionConfig,
            getCorsContext: deps?.getCorsContext,
            json: deps?.json,
          },
          constants: {
            missingSlugError: constants?.missingSlugError,
            sessionConfigNotFoundError: constants?.sessionConfigNotFoundError,
          },
        });
      }

      if (routeSelection.kind === 'interview-brief') {
        return await dispatchInterviewBriefRequest({
          request,
          env,
          slugHint: envSlug,
          baseHeaders: routeBaseHeaders,
          deps: {
            resolveRequestSlugWithoutToken: deps?.resolveRequestSlugWithoutToken,
            getSessionConfig: deps?.getSessionConfig,
            getCorsContext: deps?.getCorsContext,
            resolveAnonymousRateIdentity: deps?.resolveAnonymousRateIdentity,
            checkRateLimit: deps?.checkRateLimit,
            storageRoute: deps?.storageRoute,
            fetch: deps?.fetch,
            json: deps?.json,
          },
          constants: {
            missingSlugError: constants?.missingSlugError,
            sessionConfigNotFoundError: constants?.sessionConfigNotFoundError,
          },
        });
      }

      if (routeSelection.kind === 'resource-presence') {
        return await dispatchResourcePresenceRequest({
          request,
          env,
          slugHint: envSlug,
          baseHeaders: routeBaseHeaders,
          deps: {
            resolveRequestSlugWithoutToken: deps?.resolveRequestSlugWithoutToken,
            getSessionConfig: deps?.getSessionConfig,
            getCorsContext: deps?.getCorsContext,
            getSessionSecrets: deps?.getSessionSecrets,
            json: deps?.json,
          },
          constants: {
            missingSlugError: constants?.missingSlugError,
            sessionConfigNotFoundError: constants?.sessionConfigNotFoundError,
          },
        });
      }

      if (routeSelection.kind === 'auth-nonce') {
        return await dispatchAuthNonceRequest({
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
            ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
            now: deps?.now,
            buildNonce: () => deps?.buildNonce?.({
              base64UrlEncode: deps?.base64UrlEncode,
            }),
            issueNonce: (currentEnv, slugArg, addressArg, nonceArg, ttl) => (
              deps?.issueNonce || issueNonceBoundary
            )(
              currentEnv,
              slugArg,
              addressArg,
              nonceArg,
              ttl,
              {
                now: deps?.now,
              },
            ),
            MISSING_SLUG_ERROR: constants?.missingSlugError,
            NONCE_TTL_SECONDS: constants?.nonceTtlSeconds,
            NONCE_RATE_LIMIT_MAX: constants?.nonceRateLimitMax,
            NONCE_RATE_LIMIT_WINDOW_MS: constants?.nonceRateLimitWindowMs,
            NONCE_RATE_LIMIT_TTL_SECONDS: constants?.nonceRateLimitTtlSeconds,
          },
        });
      }

      if (routeSelection.kind === 'auth-login') {
        return await dispatchAuthLoginRequest({
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
            consumeNonce: (envArg, slugArg, addressArg, nonceArg) => deps?.consumeNonce?.(
              envArg,
              slugArg,
              addressArg,
              nonceArg,
              {
                usedNonceTtlSeconds: constants?.usedNonceTtlSeconds,
                ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
              },
            ),
            computeScopesForLogin: deps?.computeScopesForLogin,
            signToken: deps?.signToken,
            getAddress: deps?.getAddress,
            buildAuthTokenJti: deps?.buildAuthTokenJti,
            persistAuthTokenRecord: deps?.persistAuthTokenRecord,
            ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
            now: deps?.now,
            LOGIN_SIWE_MAX_AGE_MS: constants?.loginSiweMaxAgeMs,
            LOGIN_SIWE_FUTURE_SKEW_MS: constants?.loginSiweFutureSkewMs,
            TOKEN_TTL_SECONDS: constants?.tokenTtlSeconds,
            MISSING_SLUG_ERROR: constants?.missingSlugError,
            SESSION_CONFIG_NOT_FOUND_ERROR: constants?.sessionConfigNotFoundError,
          },
        });
      }

      if (routeSelection.kind === 'arweave-upload') {
        const logBootstrapInfo = typeof log === 'function' ? log : () => {};
        const warn = (
          (typeof log?.warn === 'function' ? log.warn : null) ||
          (typeof deps?.warn === 'function' ? deps.warn : null) ||
          (typeof log === 'function' ? log : null) ||
          console.warn
        );
        const origin = request?.headers?.get?.('Origin') || '';
        const contentType = request?.headers?.get?.('content-type') || '';

        logBootstrapInfo('[arweave] request', {
          url: request?.url,
          hasAuthHeader: !!routeSelection.hasAuthorizationHeader,
          origin,
          contentType,
          cfRay: request?.headers?.get?.('CF-Ray') || '',
          ua: request?.headers?.get?.('User-Agent') || '',
        });

        const bootstrapUpload = await dispatchBootstrapArweaveUpload({
          request,
          hasAuthorization: routeSelection.hasAuthorizationHeader,
          deps: {
            corsHeaders: deps?.corsHeaders,
            readArweaveBootstrapUploadPayload: deps?.readArweaveBootstrapUploadPayload,
            resolveWorkerBodySlugContext: ({ body }) => (
              deps?.resolveWorkerBodySlugContext?.({ body, env })
            ),
            json: deps?.json,
            MISSING_SLUG_ERROR: constants?.missingSlugError,
            getSessionConfig: (slug) => deps?.getSessionConfig?.(env, slug),
            BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR: constants?.bootstrapSessionConfigRequiredError,
            getCorsContext: deps?.getCorsContext,
            verifyAdminSignature: (value) => deps?.verifyAdminSignature?.({ ...value, env }),
            getSessionSecrets: (slug) => deps?.getSessionSecrets?.(env, slug),
            arweaveUpload: (value) => deps?.arweaveUpload?.({ ...value, env }),
            logBootstrapPayload: ({ requestId, body }) => logBootstrapInfo('[arweave] bootstrap payload', {
              requestId: requestId || null,
              hasAddress: !!body?.address,
              hasMessage: !!body?.message,
              hasSignature: !!body?.signature,
              sessionSlug: body?.sessionSlug || '',
              groupSlug: body?.groupSlug || '',
            }),
            logBootstrapConfigMissing: ({ targetSlug, requestId }) => (
              warn('[arweave] bootstrap config missing', {
                targetSlug,
                requestId: requestId || null,
              })
            ),
            logBootstrapCorsReject: ({ requestId, targetSlug, allowOrigins }) => (
              warn('[arweave] cors reject', {
                requestId: requestId || null,
                origin,
                targetSlug,
                allowOrigins,
              })
            ),
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

      if (routeSelection.kind === 'admin-abuse-summary') {
        return await dispatchAdminAbuseSummaryRequest({
        request,
        env,
        baseHeaders: routeBaseHeaders,
        slug: envSlug,
        deps: {
          json: deps?.json,
          requireAuth: deps?.requireAuth,
          getSessionConfig: deps?.getSessionConfig,
          getCorsContext: deps?.getCorsContext,
          validateAdmin: deps?.validateAdmin,
          ...(deps?.readAbuseCounterSummary ? { readAbuseCounterSummary: deps.readAbuseCounterSummary } : {}),
          ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
          toStr: deps?.toStr,
          now: deps?.now,
        },
      });
      }

      if (routeSelection.kind === 'admin') {
        return await dispatchAdminRequest({
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
            consumeNonce: (envArg, slugArg, addressArg, nonceArg) => deps?.consumeNonce?.(
              envArg,
              slugArg,
              addressArg,
              nonceArg,
              {
                usedNonceTtlSeconds: constants?.usedNonceTtlSeconds,
                ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
              },
            ),
            validateBootstrapAdmin: deps?.validateBootstrapAdmin,
            validateAdmin: deps?.validateAdmin,
            mergeWorkerConfigRecords: deps?.mergeWorkerConfigRecords,
            mergeWorkerLimitRecords: deps?.mergeWorkerLimitRecords,
            putSessionConfig: deps?.putSessionConfig,
            getSessionSecrets: deps?.getSessionSecrets,
            normalizeSecretValue: deps?.normalizeSecretValue,
            putSessionSecrets: deps?.putSessionSecrets,
            ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
            MISSING_SLUG_ERROR: constants?.missingSlugError,
          },
        });
      }

      if (routeSelection.kind === 'anonymous') {
        return await dispatchAnonymousRouteEntry({
          path,
          anonymousRoute: routeSelection.anonymousRoute,
          request,
          env,
          slugHint: envSlug,
          baseHeaders: routeBaseHeaders,
          deps: {
            resolveRequestSlugWithoutToken: deps?.resolveRequestSlugWithoutToken,
            json: deps?.json,
            MISSING_SLUG_ERROR: constants?.missingSlugError,
            getSessionConfig: deps?.getSessionConfig,
            SESSION_CONFIG_NOT_FOUND_ERROR: constants?.sessionConfigNotFoundError,
            getCorsContext: deps?.getCorsContext,
            resolveAnonymousRateIdentity: deps?.resolveAnonymousRateIdentity,
            checkRateLimit: deps?.checkRateLimit,
            dispatchAnonymousRoute: (value) => dispatchAnonymousRoute({
              ...value,
              deps: {
                storageRoute: deps?.storageRoute,
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
            }),
          },
        });
      }

      return await dispatchAuthenticatedRouteEntry({
        path,
        method,
        request,
        env,
        baseHeaders: routeBaseHeaders,
        deps: {
          json: deps?.json,
          requireAuth: deps?.requireAuth,
          resolveAuthenticatedRouteContext: (value) => resolveAuthenticatedRouteContext({
            ...value,
            deps: {
              getSessionConfig: deps?.getSessionConfig,
              getCorsContext: deps?.getCorsContext,
              json: deps?.json,
              toStr: deps?.toStr,
              SESSION_CONFIG_NOT_FOUND_ERROR: constants?.sessionConfigNotFoundError,
            },
          }),
          dispatchAuthenticatedRoute: (value) => dispatchAuthenticatedRoute({
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
          }),
        },
      });
    } catch (error) {
      if (error instanceof BodyByteLimitError) {
        return new ResponseCtor(JSON.stringify({ error: error.message }), {
          status: 413, headers: { ...routeBaseHeaders, 'Content-Type': 'application/json' },
        });
      }
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
