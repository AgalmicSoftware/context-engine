import { toChainId as defaultToChainId } from './chainIdNormalization.js';
import { buildSafeRpcFailure } from './rpcDiagnosticSafety.js';
import { attestRpcEndpointChain } from './rpcChainAttestation.js';

const normalizeDecodedChainId = (value, toChainId) => {
  let candidate = value;
  // ethers v5 decodes uint256 values as BigNumber objects. Convert only here,
  // at the trusted ABI boundary; the public chain parser must reject lookalikes.
  if (
    candidate &&
    typeof candidate === 'object' &&
    candidate._isBigNumber === true &&
    typeof candidate.toString === 'function'
  ) {
    try {
      candidate = candidate.toString();
    } catch {
      return 0;
    }
  }
  return toChainId(candidate);
};

export const readResourceGateOnChain = async ({
  registryAddress,
  registryRpcUrls,
  registrySlug,
  resourceKey,
  expectedChainId,
  chainAttestationCache,
  deps,
} = {}) => {
  const errors = [];
  const callRegistryFunction = deps?.callRegistryFunction;
  const toChainId = typeof deps?.toChainId === 'function'
    ? deps.toChainId
    : defaultToChainId;

  for (const rpcUrl of Array.isArray(registryRpcUrls) ? registryRpcUrls : []) {
    const attestation = await attestRpcEndpointChain({
      rpcUrl,
      expectedChainId,
      rpcRequest: deps?.rpcRequest,
      toChainId,
      cache: chainAttestationCache,
    });
    if (!attestation.ok) {
      errors.push(buildSafeRpcFailure({
        rpcUrl,
        error: { rpcStatus: attestation.status, rpcCode: attestation.code },
        errorLabel: 'Registry gate lookup RPC chain attestation failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
      continue;
    }
    try {
      const res = await callRegistryFunction({
        rpcUrl,
        registryAddress,
        method: 'getResourceGate',
        args: [registrySlug, resourceKey],
      });
      const sbtAddresses = Array.isArray(res?.[0]) ? res[0].filter(Boolean) : [];
      const chainId = normalizeDecodedChainId(res?.[1], toChainId);
      const mode = Number(res?.[2] || 0);
      return { ok: true, gate: { sbtAddresses, chainId, mode }, rpcUrl, errors };
    } catch (err) {
      errors.push(buildSafeRpcFailure({
        rpcUrl,
        error: err,
        errorLabel: 'Registry gate lookup RPC request failed.',
        maskRpcUrl: deps?.maskRpcUrl,
      }));
    }
  }

  return {
    ok: false,
    error: 'Registry gate lookup failed.',
    errors,
  };
};
