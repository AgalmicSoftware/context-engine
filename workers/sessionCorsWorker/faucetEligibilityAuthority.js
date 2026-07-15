import { toTrimmedString } from './stringCoercion.js';
import { resolveSessionSecretRpcUrlListForGateRuntime } from './gateRpcResolution.js';
import { sanitizeRpcFailureDetails } from './rpcDiagnosticSafety.js';

const ZERO_BYTES32_FALLBACK = `0x${'0'.repeat(64)}`;

export const resolveFaucetEligibilityAuthority = async ({
  payload,
  config,
  slug,
  recipientAddress = '',
  sbtAddress = '',
  deps,
  constants,
} = {}) => {
  const isBytes32Hex = typeof deps?.isBytes32Hex === 'function'
    ? deps.isBytes32Hex
    : () => false;
  const findSessionGateForSbt = typeof deps?.findSessionGateForSbt === 'function'
    ? deps.findSessionGateForSbt
    : async () => ({ ok: false, status: 500, error: 'findSessionGateForSbt unavailable.' });
  const readSbtFaucetValidationState = typeof deps?.readSbtFaucetValidationState === 'function'
    ? deps.readSbtFaucetValidationState
    : async () => ({ ok: false, error: 'readSbtFaucetValidationState unavailable.', errors: [] });
  const validateSbtPasswordForFaucet = typeof deps?.validateSbtPasswordForFaucet === 'function'
    ? deps.validateSbtPasswordForFaucet
    : async () => ({ ok: false, error: 'validateSbtPasswordForFaucet unavailable.', errors: [] });
  const verifyGroupSignatureForFaucet = typeof deps?.verifyGroupSignatureForFaucet === 'function'
    ? deps.verifyGroupSignatureForFaucet
    : () => ({ ok: false, status: 500, error: 'verifyGroupSignatureForFaucet unavailable.' });

  const anonymousGateUnavailableError = toTrimmedString(constants?.anonymousGateUnavailableError, deps)
    || 'Requested resource gate is unavailable.';
  const zeroBytes32 = (
    toTrimmedString(constants?.zeroBytes32, deps).toLowerCase() || ZERO_BYTES32_FALLBACK
  );

  const gateMatch = await findSessionGateForSbt({ slug, config, sbtAddress });
  if (!gateMatch.ok) return gateMatch;

  const validationState = await readSbtFaucetValidationState({
    config,
    gateChainId: gateMatch.gate?.chainId,
    sbtAddress,
  });
  if (!validationState.ok) {
    const privateRpcUrls = resolveSessionSecretRpcUrlListForGateRuntime({
      config,
      gateChainId: gateMatch.gate?.chainId,
    });
    return {
      ok: false,
      status: 403,
      error: anonymousGateUnavailableError,
      reason: 'sbt-validation-unavailable',
      details: sanitizeRpcFailureDetails(validationState.errors, {
        maskRpcUrl: deps?.maskRpcUrl,
        privateRpcUrls,
        errorLabel: 'SBT validation RPC request failed.',
      }),
    };
  }

  if (validationState.hasPasswordMint) {
    const hashedPassword = toTrimmedString(payload?.hashedPassword, deps);
    if (!isBytes32Hex(hashedPassword)) {
      return { ok: false, status: 400, error: 'Missing hashedPassword.' };
    }

    const passwordCheck = await validateSbtPasswordForFaucet({
      config,
      gateChainId: gateMatch.gate?.chainId,
      sbtAddress,
      hashedPassword,
    });
    if (!passwordCheck.ok) {
      const privateRpcUrls = resolveSessionSecretRpcUrlListForGateRuntime({
        config,
        gateChainId: gateMatch.gate?.chainId,
      });
      return {
        ok: false,
        status: 403,
        error: anonymousGateUnavailableError,
        reason: 'password-validation-unavailable',
        details: sanitizeRpcFailureDetails(passwordCheck.errors, {
          maskRpcUrl: deps?.maskRpcUrl,
          privateRpcUrls,
          errorLabel: 'SBT password validation RPC request failed.',
        }),
      };
    }
    if (!passwordCheck.isValid) {
      return { ok: false, status: 403, error: 'Invalid password.' };
    }

    return { ok: true, flow: 'password', resourceKey: gateMatch.resourceKey };
  }

  if (toTrimmedString(validationState.groupPasswordHash, deps).toLowerCase() !== zeroBytes32) {
    const groupSignatureCheck = verifyGroupSignatureForFaucet({
      sbtAddress,
      recipientAddress,
      signature: payload?.signature,
      expectedGroupPasswordHash: validationState.groupPasswordHash,
    });
    if (!groupSignatureCheck.ok) {
      return groupSignatureCheck;
    }

    return { ok: true, flow: 'group-signature', resourceKey: gateMatch.resourceKey };
  }

  return { ok: true, flow: 'open', resourceKey: gateMatch.resourceKey };
};
