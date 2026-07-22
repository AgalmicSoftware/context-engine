import * as ethersModule from 'ethers';

import {
  buildAdminActionBodyHash as buildAdminActionBodyHashBoundary,
  buildAdminActionTypedData as buildAdminActionTypedDataBoundary,
} from './adminTypedData.mjs';
import {
  ADMIN_ACTION_TYPES,
  validateAdminActionAudience as validateAdminActionAudienceBoundary,
} from './siweMessageValidation.js';

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const resolveEthersCompat = (loadedModule) => (
  loadedModule?.ethers ||
  loadedModule?.default?.ethers ||
  loadedModule?.default ||
  loadedModule ||
  null
);

const ethers = resolveEthersCompat(ethersModule);

const getEthersFn = (...candidates) => candidates.find((fn) => typeof fn === 'function') || null;

const getEthersUtils = () => (
  ethers?.utils ||
  ethersModule?.utils ||
  ethersModule?.ethers?.utils ||
  ethersModule?.default?.utils ||
  ethersModule?.default?.ethers?.utils ||
  null
);

const getTypedDataEncoder = () => (
  ethers?.TypedDataEncoder ||
  ethersModule?.TypedDataEncoder ||
  ethersModule?.ethers?.TypedDataEncoder ||
  ethersModule?.default?.TypedDataEncoder ||
  ethersModule?.default?.ethers?.TypedDataEncoder ||
  getEthersUtils()?._TypedDataEncoder ||
  null
);

const hashTypedData = (domain, types, message) => {
  const encoder = getTypedDataEncoder();
  if (typeof encoder?.hash !== 'function') {
    throw new Error('TypedDataEncoder.hash unavailable.');
  }
  return encoder.hash(domain, types, message);
};

const recoverAddressCompat = (...args) => {
  const recoverFn = getEthersFn(
    getEthersUtils()?.recoverAddress,
    ethers?.recoverAddress,
    ethersModule?.recoverAddress,
    ethersModule?.ethers?.recoverAddress,
    ethersModule?.default?.recoverAddress,
    ethersModule?.default?.ethers?.recoverAddress,
  );
  if (!recoverFn) {
    throw new Error('recoverAddress unavailable.');
  }
  return recoverFn(...args);
};

const verifyTypedDataCompat = (...args) => {
  const verifyFn = getEthersFn(
    getEthersUtils()?.verifyTypedData,
    ethers?.verifyTypedData,
    ethersModule?.verifyTypedData,
    ethersModule?.ethers?.verifyTypedData,
    ethersModule?.default?.verifyTypedData,
    ethersModule?.default?.ethers?.verifyTypedData,
  );
  if (!verifyFn) {
    throw new Error('verifyTypedData unavailable.');
  }
  return verifyFn(...args);
};

const normalizeAddressLower = (value) => toTrimmedString(value).toLowerCase();

const normalizeUnixSeconds = (value, deps) => {
  const raw = Number(
    value != null
      ? value
      : typeof deps?.now === 'function'
        ? deps.now()
        : Date.now()
  );
  if (!Number.isFinite(raw)) return 0;
  return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
};

export const buildAdminActionTypedData = (params = {}) => (
  buildAdminActionTypedDataBoundary(params)
);

export const verifyAdminActionSignature = ({
  signature,
  action,
  slug,
  bodyHash,
  nonce,
  audience,
  expiration,
  expectedAddress,
  deps,
} = {}) => {
  const typedData = buildAdminActionTypedData({
    action,
    slug,
    bodyHash,
    nonce,
    audience,
    expiration,
  });

  let recovered = '';
  try {
    if (typeof deps?.verifyTypedData === 'function') {
      recovered = deps.verifyTypedData(
        typedData.domain,
        ADMIN_ACTION_TYPES,
        typedData.message,
        signature,
      );
    } else {
      const digest = hashTypedData(
        typedData.domain,
        ADMIN_ACTION_TYPES,
        typedData.message,
      );
      recovered = recoverAddressCompat(digest, signature);
    }
  } catch {
    try {
      recovered = verifyTypedDataCompat(
        typedData.domain,
        ADMIN_ACTION_TYPES,
        typedData.message,
        signature,
      );
    } catch {
      return { valid: false, error: 'Invalid signature.' };
    }
  }

  if (!normalizeAddressLower(expectedAddress) || normalizeAddressLower(recovered) !== normalizeAddressLower(expectedAddress)) {
    return { valid: false, error: 'Signature does not match address.' };
  }

  const expirationSeconds = normalizeUnixSeconds(expiration);
  if (!expirationSeconds) {
    return { valid: false, error: 'Invalid admin action expiration.' };
  }

  if (expirationSeconds <= normalizeUnixSeconds(null, deps)) {
    return { valid: false, error: 'Admin action expired.' };
  }

  return { valid: true, address: recovered };
};

export const resolveAdminRequestAuthority = async ({
  env,
  request,
  body,
  slugHint,
  action,
  baseHeaders,
  deps,
} = {}) => {
  const {
    address,
    signature,
  } = deps?.normalizeSignedWorkerRequest?.(body) || {};
  const signedAction = toTrimmedString(body?.action);
  const signedSlugProvided = (
    body &&
    typeof body === 'object' &&
    Object.prototype.hasOwnProperty.call(body, 'slug') &&
    body?.slug != null
  );
  const signedSlug = signedSlugProvided ? toTrimmedString(body?.slug) : null;
  const signedBodyHash = toTrimmedString(body?.bodyHash).toLowerCase();
  const nonce = toTrimmedString(body?.nonce);
  const audience = toTrimmedString(body?.audience);
  const expiration = body?.expiration;
  const slugContext = deps?.resolveWorkerBodySlugContext?.({ body, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugContext?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: slugContext?.error }, 400, baseHeaders),
    };
  }
  const { envSlug, slugPayload, targetSlug } = slugContext;
  const explicitSlugProvided = (
    slugContext?.explicitSlugProvided === true ||
    !!envSlug ||
    !!slugPayload?.hasAnySlug
  );

  if (!address || !deps?.isAddress?.(address)) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Invalid address.' }, 400, baseHeaders),
    };
  }
  if (!signature || !signedAction || signedSlug == null || !signedBodyHash || !nonce || !audience || expiration == null) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Missing admin action signature fields.' }, 400, baseHeaders),
    };
  }
  if (!explicitSlugProvided) {
    return {
      ok: false,
      response: deps?.json?.({ error: deps?.MISSING_SLUG_ERROR }, 400, baseHeaders),
    };
  }

  const corsState = await deps?.resolveExistingSessionCors?.({
    request,
    env,
    slug: targetSlug,
    baseHeaders,
  });
  if (!corsState?.ok) {
    return {
      ok: false,
      response: corsState?.response,
    };
  }
  const headers = corsState.headers;

  if (signedAction !== action) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Admin action mismatch.' }, 400, headers),
    };
  }
  if (signedSlug !== targetSlug) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Admin slug mismatch.' }, 400, headers),
    };
  }

  const buildAdminActionBodyHash = typeof deps?.buildAdminActionBodyHash === 'function'
    ? deps.buildAdminActionBodyHash
    : buildAdminActionBodyHashBoundary;
  const actualBodyHash = toTrimmedString(buildAdminActionBodyHash(body)).toLowerCase();
  if (!actualBodyHash || actualBodyHash !== signedBodyHash) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Admin request body mismatch.' }, 400, headers),
    };
  }
  const initializingConfig = (
    !corsState?.config &&
    action === 'set-config' &&
    body?.config &&
    typeof body.config === 'object'
  )
    ? body.config
    : null;

  const audienceCheck = (
    deps?.validateAdminActionAudience || validateAdminActionAudienceBoundary
  )({
    audience,
    request,
    env,
    config: corsState?.config || null,
    initializingConfig,
  }, {
    resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
  }) || {};
  if (!audienceCheck?.ok) {
    return {
      ok: false,
      response: deps?.json?.({ error: audienceCheck?.error }, 400, headers),
    };
  }

  const signatureCheck = (
    deps?.verifyAdminActionSignature || verifyAdminActionSignature
  )({
    signature,
    action,
    slug: targetSlug,
    bodyHash: actualBodyHash,
    nonce,
    audience: audienceCheck?.audience || audience,
    expiration,
    expectedAddress: address,
    deps: {
      verifyTypedData: deps?.verifyTypedData,
      now: deps?.now,
    },
  }) || {};
  if (!signatureCheck?.valid) {
    return {
      ok: false,
      response: deps?.json?.({ error: signatureCheck?.error }, 400, headers),
    };
  }

  const nonceResult = await deps?.consumeNonce?.(env, targetSlug, address.toLowerCase(), nonce);
  if (!nonceResult?.ok) {
    return {
      ok: false,
      response: deps?.json?.(
        { error: nonceResult?.error },
        Number(nonceResult?.status || 0) >= 500 ? Number(nonceResult.status) : 400,
        headers,
      ),
    };
  }

  const existingConfig = corsState.config;
  let adminOk = false;
  if (!existingConfig && action === 'set-config') {
    adminOk = await deps?.validateBootstrapAdmin?.({ env, slug: targetSlug, address, body });
  }
  if (!adminOk) {
    adminOk = await deps?.validateAdmin?.({
      env,
      slug: targetSlug,
      address,
      config: existingConfig,
      body,
    });
  }
  if (!adminOk) {
    return {
      ok: false,
      response: deps?.json?.({ error: 'Admin authorization failed.' }, 403, headers),
    };
  }

  return {
    ok: true,
    address,
    existingConfig,
    headers,
    targetSlug,
  };
};
