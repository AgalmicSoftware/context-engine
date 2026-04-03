import {
  resolveAdminSignatureAuthority,
} from './adminSignatureAuthority.js';

export const verifyAdminSignature = async ({
  env,
  baseHeaders,
  slugHint,
  body,
  config,
  allowBootstrapWithoutConfig = false,
  deps,
} = {}) => {
  const {
    address,
    message,
    signature,
    requestId,
  } = deps?.normalizeSignedWorkerRequest?.(body) || {};
  const slugContext = deps?.resolveWorkerBodySlugContext?.({ body, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  const envSlug = slugContext?.envSlug;
  const slugPayload = slugContext?.slugPayload || {};
  const targetSlug = slugContext?.targetSlug;
  const explicitSlugProvided = slugContext?.explicitSlugProvided === true || !!targetSlug;
  const adminAddressSet = !!(deps?.toStr?.(config?.adminAddress) ?? '').trim();
  const hatsAddressSet = !!(deps?.toStr?.(config?.hatsAddress) ?? '').trim();
  const adminHatIdSet = !!(deps?.toStr?.(config?.adminHatId) ?? '').trim();
  const logReject = (reason, extra = {}) => {
    deps?.log?.('[arweave] admin verify reject', {
      requestId: requestId || null,
      reason,
      address: address || null,
      targetSlug: targetSlug || null,
      ...extra,
    });
  };

  if (!slugContext?.ok && slugContext?.error === deps?.SLUG_ALIAS_MISMATCH_ERROR) {
    logReject('slug_alias_mismatch', {
      sessionSlug: slugPayload.sessionSlug,
      groupSlug: slugPayload.groupSlug,
    });
    return {
      ok: false,
      response: deps?.json?.({ error: deps?.SLUG_ALIAS_MISMATCH_ERROR }, 400, baseHeaders),
    };
  }
  if (!slugContext?.ok && slugContext?.error === deps?.SLUG_MISMATCH_ERROR) {
    logReject('session_slug_mismatch', {
      envSlug,
      requestedSlug: slugPayload.requestedSlug,
    });
    return {
      ok: false,
      response: deps?.json?.({ error: deps?.SLUG_MISMATCH_ERROR }, 400, baseHeaders),
    };
  }
  if (!slugContext?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: slugContext?.error }, 400, baseHeaders),
    };
  }

  deps?.log?.('[arweave] admin verify start', {
    requestId: requestId || null,
    address: address || null,
    targetSlug: targetSlug || null,
    hasMessage: !!message,
    hasSignature: !!signature,
    hasSessionSlug: slugPayload.hasSessionSlug,
    hasGroupSlug: slugPayload.hasGroupSlug,
    envSlug: envSlug || null,
    requestedSlug: slugPayload.requestedSlug || null,
  });

  const authorityResult = await (
    deps?.resolveAdminSignatureAuthority || resolveAdminSignatureAuthority
  )({
    env,
    body,
    config,
    allowBootstrapWithoutConfig,
    address,
    message,
    signature,
    targetSlug,
    explicitSlugProvided,
    flags: {
      adminAddressSet,
      hatsAddressSet,
      adminHatIdSet,
    },
    deps: {
      isAddress: deps?.isAddress,
      verifyMessage: deps?.verifyMessage,
      validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: deps?.parseSiweMessage,
      validateSiwe: deps?.validateSiwe,
      validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
      consumeNonce: deps?.consumeNonce,
      validateAdmin: deps?.validateAdmin,
      MISSING_SLUG_ERROR: deps?.MISSING_SLUG_ERROR,
    },
  });

  if (!authorityResult?.ok) {
    logReject(authorityResult?.reason, authorityResult?.logExtra || {});
    return {
      ok: false,
      response: deps?.json?.(
        { error: authorityResult?.error },
        authorityResult?.status || 400,
        baseHeaders,
      ),
    };
  }

  if (authorityResult?.reason === 'bootstrap-no-config') {
    deps?.log?.('[arweave] admin verify ok (bootstrap no config)', {
      requestId: requestId || null,
      address,
      targetSlug: targetSlug || null,
    });
    return {
      ok: true,
      slug: authorityResult?.slug,
      address: authorityResult?.address,
    };
  }

  deps?.log?.('[arweave] admin verify ok', {
    requestId: requestId || null,
    address,
    targetSlug: targetSlug || null,
  });
  return {
    ok: true,
    slug: authorityResult?.slug,
    address: authorityResult?.address,
  };
};
