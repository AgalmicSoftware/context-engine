import {
  verifyAdminSignature as verifyAdminSignatureBoundary,
} from './adminSignatureVerification.js';

export const createVerifyAdminSignatureWithWorkerDeps = ({
  deps,
  constants,
} = {}) => (
  async ({
    env,
    baseHeaders,
    slugHint,
    body,
    config,
    allowBootstrapWithoutConfig = false,
  } = {}) => (
    (deps?.verifyAdminSignature || verifyAdminSignatureBoundary)({
      env,
      baseHeaders,
      slugHint,
      body,
      config,
      allowBootstrapWithoutConfig,
      deps: {
        normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
        resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
        toStr: deps?.toStr,
        isAddress: deps?.isAddress,
        json: deps?.json,
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
        validateAdmin: deps?.validateAdmin,
        log: (...args) => (deps?.log || console.log)(...args),
        MISSING_SLUG_ERROR: constants?.missingSlugError,
        SLUG_ALIAS_MISMATCH_ERROR: constants?.slugAliasMismatchError,
        SLUG_MISMATCH_ERROR: constants?.slugMismatchError,
      },
    })
  )
);
