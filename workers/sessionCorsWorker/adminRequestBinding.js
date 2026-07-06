import {
  dispatchAdminRequest as dispatchAdminRequestBoundary,
} from './adminRequestDispatch.js';

export const dispatchAdminRequestWithWorkerDeps = async ({
  request,
  env,
  baseHeaders,
  slug,
  action,
  deps,
  constants,
} = {}) => (
  (deps?.dispatchAdminRequest || dispatchAdminRequestBoundary)({
    request,
    env,
    baseHeaders,
    slug,
    action,
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
        { usedNonceTtlSeconds: constants?.usedNonceTtlSeconds },
      ),
      validateBootstrapAdmin: deps?.validateBootstrapAdmin,
      validateAdmin: deps?.validateAdmin,
      mergeWorkerConfigRecords: deps?.mergeWorkerConfigRecords,
      mergeWorkerLimitRecords: deps?.mergeWorkerLimitRecords,
      putSessionConfig: deps?.putSessionConfig,
      getSessionSecrets: deps?.getSessionSecrets,
      normalizeSecretValue: deps?.normalizeSecretValue,
      putSessionSecrets: deps?.putSessionSecrets,
      MISSING_SLUG_ERROR: constants?.missingSlugError,
    },
  })
);
