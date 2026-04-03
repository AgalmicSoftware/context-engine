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
      now: deps?.now,
      TOKEN_TTL_SECONDS: constants?.tokenTtlSeconds,
      MISSING_SLUG_ERROR: constants?.missingSlugError,
      SESSION_CONFIG_NOT_FOUND_ERROR: constants?.sessionConfigNotFoundError,
    },
  })
);
