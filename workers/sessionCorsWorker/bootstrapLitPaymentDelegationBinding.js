import {
  dispatchBootstrapLitPaymentDelegation as dispatchBootstrapLitPaymentDelegationBoundary,
} from './bootstrapLitPaymentDelegationDispatch.js';

export const dispatchBootstrapLitPaymentDelegationWithWorkerDeps = async ({
  request,
  env,
  deps,
  constants,
} = {}) => (
  (deps?.dispatchBootstrapLitPaymentDelegation || dispatchBootstrapLitPaymentDelegationBoundary)({
    request,
    deps: {
      corsHeaders: deps?.corsHeaders,
      json: deps?.json,
      resolveWorkerBodySlugContext: ({ body }) => deps?.resolveWorkerBodySlugContext?.({ body, env }),
      MISSING_SLUG_ERROR: constants?.missingSlugError,
      getSessionConfig: (slug) => deps?.getSessionConfig?.(env, slug),
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR:
        'Session config not found. Provide litPayerPrivateKey for bootstrap delegation or register session config first.',
      getCorsContext: deps?.getCorsContext,
      verifyAdminSignature: (value) => deps?.verifyAdminSignature?.({ ...value, env }),
      getSessionSecrets: (slug) => deps?.getSessionSecrets?.(env, slug),
    },
  })
);
