import {
  validateAdmin as validateAdminBoundary,
} from './adminAuthorizationValidation.js';
import {
  resolveAuthenticatedRequest as resolveAuthenticatedRequestBoundary,
} from './authRequestResolution.js';
import {
  getCorsContext as getCorsContextBoundary,
} from './corsContextResolution.js';
import {
  resolveExistingSessionCors as resolveExistingSessionCorsBoundary,
} from './existingSessionCorsResolution.js';

export const createAuthCorsAdminAdaptersWithWorkerDeps = ({
  deps,
  constants,
} = {}) => {
  const getCorsContext = async (value = {}) => (
    (deps?.getCorsContext || getCorsContextBoundary)({
      ...value,
      deps: {
        parseAllowOrigins: deps?.parseAllowOrigins,
        originAllowed: deps?.originAllowed,
        corsHeaders: deps?.corsHeaders,
        json: deps?.json,
      },
    })
  );

  const resolveExistingSessionCors = async (value = {}) => (
    (deps?.resolveExistingSessionCors || resolveExistingSessionCorsBoundary)({
      ...value,
      deps: {
        normalizeWorkerSessionSlug: deps?.normalizeWorkerSessionSlug,
        getSessionConfig: deps?.getSessionConfig,
        getCorsContext,
        corsHeaders: deps?.corsHeaders,
        resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
      },
    })
  );

  const requireAuth = async (value = {}) => (
    (deps?.requireAuth || resolveAuthenticatedRequestBoundary)({
      ...value,
      deps: {
        verifyToken: deps?.verifyToken,
        validateAuthTokenRecord: deps?.validateAuthTokenRecord,
        resolveWorkerRequestSlugContext: deps?.resolveWorkerRequestSlugContext,
        ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
        ...(deps?.recordAbuseEvent && deps?.now ? { now: deps.now } : {}),
        json: deps?.json,
        MISSING_SLUG_ERROR: constants?.missingSlugError,
      },
    })
  );

  const validateAdmin = async (value = {}) => (
    (deps?.validateAdmin || validateAdminBoundary)({
      ...value,
      deps: {
        toStr: deps?.toStr,
        isAddress: deps?.isAddress,
        resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
        getHatsInterface: deps?.getHatsInterface,
        callContractFunction: deps?.callContractFunction,
      },
    })
  );

  return {
    getCorsContext,
    resolveExistingSessionCors,
    requireAuth,
    validateAdmin,
  };
};
