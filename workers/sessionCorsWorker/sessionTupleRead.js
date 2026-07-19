import {
  buildSafeRpcFailure,
  createSafeRpcError,
} from './rpcDiagnosticSafety.js';
import { attestRpcEndpointChain } from './rpcChainAttestation.js';

export const readSessionBySlugOnChain = async ({
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
        errorLabel: 'Session tuple RPC chain attestation failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
      continue;
    }
    try {
      const decoded = await callRegistryFunction({
        rpcUrl,
        registryAddress,
        method: 'getSessionBySlug',
        args: [registrySlug],
      });
      const tuple = Array.isArray(decoded) ? decoded : null;
      return { ok: true, tuple, rpcUrl, errors };
    } catch (err) {
      lastError = err;
      errors.push(buildSafeRpcFailure({
        rpcUrl,
        error: err,
        errorLabel: 'Session tuple RPC request failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
    }
  }

  return {
    ok: false,
    error: lastError ? createSafeRpcError(lastError, 'Session tuple RPC request failed.') : null,
    errors,
  };
};
