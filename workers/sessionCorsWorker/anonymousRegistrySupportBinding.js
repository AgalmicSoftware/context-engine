import {
  resolveAnonymousRequestSlug as resolveAnonymousRequestSlugBoundary,
} from './anonymousRequestSlugResolution.js';
import {
  evaluateAnonymousRouteAccess as evaluateAnonymousRouteAccessBoundary,
} from './anonymousRouteAccessValidation.js';
import {
  resolveAnonymousRateIdentity as resolveAnonymousRateIdentityBoundary,
} from './anonymousRateIdentityNormalization.js';

export const createAnonymousRegistrySupportAdaptersWithWorkerDeps = ({
  deps,
  constants,
} = {}) => {
  const resolveRequestSlugWithoutToken = (value = {}) => (
    (deps?.resolveRequestSlugWithoutToken || resolveAnonymousRequestSlugBoundary)({
      ...value,
      deps: {
        resolveWorkerRequestSlugContext: deps?.resolveWorkerRequestSlugContext,
      },
    })
  );

  const evaluateAnonymousRouteAccess = async (value = {}) => (
    (deps?.evaluateAnonymousRouteAccess || evaluateAnonymousRouteAccessBoundary)({
      ...value,
      deps: {
        toStr: deps?.toStr,
        isAddress: deps?.isAddress,
        resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
        toRegistrySessionSlug: deps?.toRegistrySessionSlug,
        maskRpcUrl: deps?.maskRpcUrl,
        readSessionExistsOnChain: deps?.readSessionExistsOnChain,
        readResourceGateOnChain: deps?.readResourceGateOnChain,
        warn: deps?.warn || console.warn,
      },
      constants: {
        anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
        anonymousRouteDeniedError: constants?.anonymousRouteDeniedError,
        anonymousScopeDisabledError: constants?.anonymousScopeDisabledError,
      },
    })
  );

  const resolveAnonymousRateIdentity = (request) => (
    (deps?.resolveAnonymousRateIdentity || resolveAnonymousRateIdentityBoundary)({
      request,
      deps: {
        toStr: deps?.toStr,
      },
      constants: {
        anonymousRateIdHeader: constants?.anonymousRateIdHeader,
        anonymousUnknownIdentity: constants?.anonymousUnknownIdentity,
      },
    })
  );

  return {
    resolveRequestSlugWithoutToken,
    evaluateAnonymousRouteAccess,
    resolveAnonymousRateIdentity,
  };
};
