import {
  buildSafeRpcFailure,
  createSafeRpcError,
} from './rpcDiagnosticSafety.js';
import { attestRpcEndpointChain } from './rpcChainAttestation.js';

export const readSessionExistsOnChain = async ({
  registryAddress,
  registryRpcUrls,
  registrySlug,
  expectedChainId,
  chainAttestationCache,
  deps,
} = {}) => {
  let lastError = null;
  const errors = [];
  const callRegistryFunction = deps?.callRegistryFunction;

  for (const rpcUrl of Array.isArray(registryRpcUrls) ? registryRpcUrls : []) {
    const attestation = await attestRpcEndpointChain({
      rpcUrl,
      expectedChainId,
      rpcRequest: deps?.rpcRequest,
      toChainId: deps?.toChainId,
      cache: chainAttestationCache,
    });
    if (!attestation.ok) {
      errors.push(buildSafeRpcFailure({
        rpcUrl,
        error: { rpcStatus: attestation.status, rpcCode: attestation.code },
        errorLabel: 'Session existence RPC chain attestation failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
      continue;
    }
    try {
      const decoded = await callRegistryFunction({
        rpcUrl,
        registryAddress,
        method: 'sessionExists',
        args: [registrySlug],
      });
      const exists = Array.isArray(decoded) ? decoded[0] : decoded;
      return { exists: !!exists, rpcUrl, errors };
    } catch (err) {
      lastError = err;
      errors.push(buildSafeRpcFailure({
        rpcUrl,
        error: err,
        errorLabel: 'Session existence RPC request failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
    }
  }

  return {
    exists: null,
    error: lastError ? createSafeRpcError(lastError, 'Session existence RPC request failed.') : null,
    errors,
  };
};
