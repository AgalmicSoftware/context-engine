import {
  buildSafeRpcFailure,
  createSafeRpcError,
} from './rpcDiagnosticSafety.js';
import { attestRpcEndpointChain } from './rpcChainAttestation.js';

export const readRegistryCodeOnChain = async ({
  registryAddress,
  registryRpcUrls,
  expectedChainId,
  chainAttestationCache,
  deps,
} = {}) => {
  let lastError = null;
  const errors = [];
  const rpcRequest = deps?.rpcRequest;

  for (const rpcUrl of Array.isArray(registryRpcUrls) ? registryRpcUrls : []) {
    const attestation = await attestRpcEndpointChain({
      rpcUrl,
      expectedChainId,
      rpcRequest,
      toChainId: deps?.toChainId,
      cache: chainAttestationCache,
    });
    if (!attestation.ok) {
      errors.push(buildSafeRpcFailure({
        rpcUrl,
        error: { rpcStatus: attestation.status, rpcCode: attestation.code },
        errorLabel: 'Registry code RPC chain attestation failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
      continue;
    }
    try {
      const code = await rpcRequest({
        rpcUrl,
        method: 'eth_getCode',
        params: [registryAddress, 'latest'],
      });
      const size = code && code !== '0x' ? Math.max((code.length - 2) / 2, 0) : 0;
      return { size, rpcUrl, errors };
    } catch (err) {
      lastError = err;
      errors.push(buildSafeRpcFailure({
        rpcUrl,
        error: err,
        errorLabel: 'Registry code RPC request failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
    }
  }

  return {
    size: null,
    error: lastError ? createSafeRpcError(lastError, 'Registry code RPC request failed.') : null,
    errors,
  };
};
