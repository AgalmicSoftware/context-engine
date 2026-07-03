import {
  dispatchAuthNonceRequest as dispatchAuthNonceRequestBoundary,
} from './authNonceRequestDispatch.js';
import {
  dispatchAuthLoginRequest as dispatchAuthLoginRequestBoundary,
} from './authLoginRequestDispatch.js';

export const dispatchAuthNonceRequestWithWorkerDeps = async ({
  request,
  env,
  baseHeaders,
  slug,
  deps,
  constants,
} = {}) => (
  (deps?.dispatchAuthNonceRequest || dispatchAuthNonceRequestBoundary)({
    request,
    env,
    baseHeaders,
    slug,
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
      buildNonce: () => deps?.buildNonce?.({
        base64UrlEncode: deps?.base64UrlEncode,
      }),
      putNonce: async (currentEnv, key, value, ttl) => currentEnv?.GROUP_KV?.put?.(
        key,
        value,
        { expirationTtl: ttl },
      ),
      MISSING_SLUG_ERROR: constants?.missingSlugError,
      NONCE_TTL_SECONDS: constants?.nonceTtlSeconds,
      NONCE_RATE_LIMIT_MAX: constants?.nonceRateLimitMax,
      NONCE_RATE_LIMIT_WINDOW_MS: constants?.nonceRateLimitWindowMs,
      NONCE_RATE_LIMIT_TTL_SECONDS: constants?.nonceRateLimitTtlSeconds,
    },
  })
);

export const dispatchAuthLoginRequestWithWorkerDeps = async ({
  request,
  env,
  baseHeaders,
  slug,
  deps,
  constants,
} = {}) => (
  (deps?.dispatchAuthLoginRequest || dispatchAuthLoginRequestBoundary)({
    request,
    env,
    baseHeaders,
    slug,
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
        { usedNonceTtlSeconds: constants?.usedNonceTtlSeconds },
      ),
      computeScopesForLogin: deps?.computeScopesForLogin,
      signToken: deps?.signToken,
      getAddress: deps?.getAddress,
      buildAuthTokenJti: deps?.buildAuthTokenJti,
      persistAuthTokenRecord: deps?.persistAuthTokenRecord,
      now: deps?.now,
      LOGIN_SIWE_MAX_AGE_MS: constants?.loginSiweMaxAgeMs,
      LOGIN_SIWE_FUTURE_SKEW_MS: constants?.loginSiweFutureSkewMs,
      TOKEN_TTL_SECONDS: constants?.tokenTtlSeconds,
      MISSING_SLUG_ERROR: constants?.missingSlugError,
      SESSION_CONFIG_NOT_FOUND_ERROR: constants?.sessionConfigNotFoundError,
    },
  })
);
