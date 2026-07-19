import { toTrimmedString } from './stringCoercion.js';
import { resolveRegistryChainId } from './chainIdNormalization.js';
import {
  resolveFaucetEligibilityAuthority,
} from './faucetEligibilityAuthority.js';
import { isSessionSecretRpcUrlForGateRuntime } from './gateRpcResolution.js';
import {
  createRpcDiagnosticMasker,
  sanitizeRpcFailureDetails,
} from './rpcDiagnosticSafety.js';

const resolveCurrentSelfFundingFaucetAccess = async ({
  config,
  slug,
  requesterAddress = '',
  deps,
  constants,
} = {}) => {
  const normalizeAddressLower = typeof deps?.normalizeAddressLower === 'function'
    ? deps.normalizeAddressLower
    : (value) => toTrimmedString(value, deps).toLowerCase();
  const isAddress = typeof deps?.isAddress === 'function' ? deps.isAddress : () => false;
  const resolveRegistryRpcUrls = typeof deps?.resolveRegistryRpcUrls === 'function'
    ? deps.resolveRegistryRpcUrls
    : () => [];
  const toRegistrySessionSlug = typeof deps?.toRegistrySessionSlug === 'function'
    ? deps.toRegistrySessionSlug
    : (value) => toTrimmedString(value, deps) || 'general';
  const readSessionExistsOnChain = typeof deps?.readSessionExistsOnChain === 'function'
    ? deps.readSessionExistsOnChain
    : async () => ({ exists: null, errors: [], error: null });
  const readResourceGateOnChain = typeof deps?.readResourceGateOnChain === 'function'
    ? deps.readResourceGateOnChain
    : async () => ({ ok: false, error: 'Registry gate lookup failed.', errors: [] });
  const resolveRpcUrlListForGate = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate
    : () => [];
  const checkSbtGate = typeof deps?.checkSbtGate === 'function'
    ? deps.checkSbtGate
    : async () => false;
  const maskRpcUrl = createRpcDiagnosticMasker({ maskRpcUrl: deps?.maskRpcUrl });
  const anonymousGateUnavailableError = toTrimmedString(constants?.anonymousGateUnavailableError, deps)
    || 'Access denied: on-chain gate data unavailable.';

  const normalizedRequester = normalizeAddressLower(requesterAddress);
  const registryAddress = toTrimmedString(config?.registryAddress, deps);
  const registryChainId = resolveRegistryChainId(config);
  const registryRpcUrls = resolveRegistryRpcUrls(config);
  if (!normalizedRequester || !isAddress(registryAddress) || !registryRpcUrls.length) {
    return {
      ok: false,
      status: 403,
      error: anonymousGateUnavailableError,
      reason: 'registry-unavailable',
    };
  }

  const registrySlug = toRegistrySessionSlug(slug);
  const chainAttestationCache = new Map();
  const sessionCheck = await readSessionExistsOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    expectedChainId: registryChainId,
    chainAttestationCache,
  });
  if (sessionCheck?.exists !== true) {
    return {
      ok: false,
      status: 403,
      error: anonymousGateUnavailableError,
      reason: sessionCheck?.exists === false ? 'session-not-registered' : 'session-check-unavailable',
      details: {
        registryAddress,
        rpcUrl: sessionCheck?.rpcUrl ? maskRpcUrl(sessionCheck.rpcUrl) : '',
        errors: sanitizeRpcFailureDetails(sessionCheck?.errors, {
          maskRpcUrl: deps?.maskRpcUrl,
          errorLabel: 'Session existence RPC request failed.',
        }),
      },
    };
  }

  const gateResult = await readResourceGateOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    resourceKey: 'txGas',
    expectedChainId: registryChainId,
    chainAttestationCache,
  });
  if (!gateResult?.ok) {
    return {
      ok: false,
      status: 403,
      error: anonymousGateUnavailableError,
      reason: 'txgas-gate-unavailable',
      details: sanitizeRpcFailureDetails(gateResult?.errors, {
        maskRpcUrl: deps?.maskRpcUrl,
        errorLabel: 'Registry gate lookup RPC request failed.',
      }),
    };
  }

  const gate = gateResult.gate || {};
  const sbtAddresses = Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses.filter(Boolean) : [];
  if (!sbtAddresses.length) {
    return {
      ok: true,
      flow: 'authenticated-self-funding',
      resourceKey: 'txGas',
    };
  }

  const rpcUrls = resolveRpcUrlListForGate(config, gate.chainId);
  if (!rpcUrls.length) {
    return {
      ok: false,
      status: 403,
      error: anonymousGateUnavailableError,
      reason: 'txgas-gate-rpc-unavailable',
    };
  }

  for (const rpcUrl of rpcUrls) {
    const hasAccess = await checkSbtGate({
      sbtAddresses,
      address: normalizedRequester,
      rpcUrl,
      mode: gate.mode,
      chainId: gate.chainId,
      rpcUrlIsPrivate: isSessionSecretRpcUrlForGateRuntime({
        config,
        gateChainId: gate.chainId,
        rpcUrl,
      }),
      chainAttestationCache,
    });
    if (hasAccess) {
      return {
        ok: true,
        flow: 'authenticated-self-funding',
        resourceKey: 'txGas',
      };
    }
  }

  return {
    ok: false,
    status: 403,
    error: 'Access denied: txGas gate failed for this wallet.',
    reason: 'txgas-gate-denied',
  };
};

export const validateFaucetEligibilityRequest = async ({
  payload,
  config,
  slug,
  requesterAddress = '',
  tokenHasFaucetScope = false,
  deps,
  constants,
} = {}) => {
  const normalizeAddressLower = typeof deps?.normalizeAddressLower === 'function'
    ? deps.normalizeAddressLower
    : (value) => toTrimmedString(value, deps).toLowerCase();
  const isAddress = typeof deps?.isAddress === 'function' ? deps.isAddress : () => false;

  const sbtAddress = toTrimmedString(payload?.sbtAddress, deps);
  const normalizedRequester = normalizeAddressLower(requesterAddress);
  const normalizedRecipient = normalizeAddressLower(payload?.to || payload?.recipient || payload?.address);

  if (!tokenHasFaucetScope) {
    if (!normalizedRequester) {
      return { ok: false, status: 403, error: 'Authenticated wallet required for proof-backed faucet requests.' };
    }
    if (!normalizedRecipient) {
      return { ok: false, status: 400, error: 'Missing address.' };
    }
    if (normalizedRecipient !== normalizedRequester) {
      return { ok: false, status: 403, error: 'Proof-backed faucet requests must fund the authenticated wallet.' };
    }
  }

  if (!sbtAddress) {
    if (normalizedRequester && tokenHasFaucetScope) {
      return { ok: true, flow: 'authenticated-token', resourceKey: 'txGas' };
    }
    const canEvaluateCurrentFaucetGate = (
      typeof deps?.readSessionExistsOnChain === 'function' &&
      typeof deps?.readResourceGateOnChain === 'function'
    );
    if (
      canEvaluateCurrentFaucetGate &&
      normalizedRequester &&
      normalizedRecipient &&
      normalizedRecipient === normalizedRequester
    ) {
      return resolveCurrentSelfFundingFaucetAccess({
        config,
        slug,
        requesterAddress: normalizedRequester,
        deps: {
          toStr: deps?.toStr,
          isAddress: deps?.isAddress,
          normalizeAddressLower: deps?.normalizeAddressLower,
          resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
          toRegistrySessionSlug: deps?.toRegistrySessionSlug,
          readSessionExistsOnChain: deps?.readSessionExistsOnChain,
          readResourceGateOnChain: deps?.readResourceGateOnChain,
          resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
          checkSbtGate: deps?.checkSbtGate,
          maskRpcUrl: deps?.maskRpcUrl,
        },
        constants: {
          anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
        },
      });
    }
    return { ok: false, status: 400, error: 'Missing sbtAddress.' };
  }

  if (!isAddress(sbtAddress)) {
    return { ok: false, status: 400, error: 'Invalid sbtAddress.' };
  }

  return resolveFaucetEligibilityAuthority({
    payload,
    config,
    slug,
    recipientAddress: normalizedRecipient,
    sbtAddress,
    deps: {
      toStr: deps?.toStr,
      isBytes32Hex: deps?.isBytes32Hex,
      findSessionGateForSbt: deps?.findSessionGateForSbt,
      readSbtFaucetValidationState: deps?.readSbtFaucetValidationState,
      validateSbtPasswordForFaucet: deps?.validateSbtPasswordForFaucet,
      verifyGroupSignatureForFaucet: deps?.verifyGroupSignatureForFaucet,
      maskRpcUrl: deps?.maskRpcUrl,
    },
    constants: {
      anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
      zeroBytes32: constants?.zeroBytes32,
    },
  });
};
