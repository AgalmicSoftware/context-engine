export const resolveAdminSignatureAuthority = async ({
  env,
  body,
  config,
  allowBootstrapWithoutConfig = false,
  address = '',
  message = '',
  signature = '',
  targetSlug = '',
  explicitSlugProvided = false,
  flags = {},
  deps,
} = {}) => {
  const isAddress = typeof deps?.isAddress === 'function' ? deps.isAddress : () => false;
  const verifyMessage = typeof deps?.verifyMessage === 'function'
    ? deps.verifyMessage
    : () => {
      throw new Error('verifyMessage unavailable.');
    };
  const validateRecoveredAddressMatchesRequest = typeof deps?.validateRecoveredAddressMatchesRequest === 'function'
    ? deps.validateRecoveredAddressMatchesRequest
    : () => ({ ok: false, error: 'Recovered address mismatch.' });
  const parseSiweMessage = typeof deps?.parseSiweMessage === 'function'
    ? deps.parseSiweMessage
    : () => null;
  const validateSiwe = typeof deps?.validateSiwe === 'function'
    ? deps.validateSiwe
    : () => ({ ok: false, error: 'Invalid SIWE message.' });
  const validateSiweAddressMatchesRequest = typeof deps?.validateSiweAddressMatchesRequest === 'function'
    ? deps.validateSiweAddressMatchesRequest
    : () => ({ ok: false, error: 'SIWE address does not match request.' });
  const consumeNonce = typeof deps?.consumeNonce === 'function'
    ? deps.consumeNonce
    : async () => ({ ok: false, error: 'Invalid or expired nonce.' });
  const validateAdmin = typeof deps?.validateAdmin === 'function'
    ? deps.validateAdmin
    : async () => false;

  if (!address || !isAddress(address)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid address.',
      reason: 'invalid_address',
    };
  }
  if (!message || !signature) {
    return {
      ok: false,
      status: 400,
      error: 'Missing message or signature.',
      reason: 'missing_message_or_signature',
    };
  }
  if (!explicitSlugProvided && !targetSlug) {
    return {
      ok: false,
      status: 400,
      error: deps?.MISSING_SLUG_ERROR,
      reason: 'missing_session_slug',
    };
  }

  let recovered;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid signature.',
      reason: 'invalid_signature',
    };
  }

  const recoveredCheck = validateRecoveredAddressMatchesRequest({ recovered, address }) || {};
  if (!recoveredCheck?.ok) {
    return {
      ok: false,
      status: 400,
      error: recoveredCheck?.error,
      reason: 'signature_mismatch',
      logExtra: { recovered },
    };
  }

  const siwe = parseSiweMessage(message);
  const siweCheck = validateSiwe(siwe) || {};
  if (!siweCheck?.ok) {
    return {
      ok: false,
      status: 400,
      error: siweCheck?.error,
      reason: 'siwe_invalid',
      logExtra: { error: siweCheck?.error },
    };
  }

  const siweAddressCheck = validateSiweAddressMatchesRequest({ siwe, address }) || {};
  if (!siweAddressCheck?.ok) {
    return {
      ok: false,
      status: 400,
      error: siweAddressCheck?.error,
      reason: 'siwe_address_mismatch',
    };
  }

  const nonceResult = await consumeNonce(env, targetSlug, address.toLowerCase(), siwe?.nonce);
  if (!nonceResult?.ok) {
    return {
      ok: false,
      status: Number(nonceResult?.status || 0) >= 500 ? Number(nonceResult.status) : 400,
      error: nonceResult?.error,
      reason: 'nonce_invalid',
      logExtra: { error: nonceResult?.error },
    };
  }

  if (!config && allowBootstrapWithoutConfig) {
    return {
      ok: true,
      slug: targetSlug,
      address,
      reason: 'bootstrap-no-config',
    };
  }

  const adminOk = await validateAdmin({ env, slug: targetSlug, address, config, body });
  if (!adminOk) {
    return {
      ok: false,
      status: 403,
      error: 'Admin authorization failed.',
      reason: 'admin_authorization_failed',
      logExtra: flags,
    };
  }

  return {
    ok: true,
    slug: targetSlug,
    address,
    reason: 'authorized',
  };
};
