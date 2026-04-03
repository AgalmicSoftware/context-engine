import { toChainId as defaultToChainId } from './chainIdNormalization.js';
import { toTrimmedString } from './stringCoercion.js';

const maskRpcUrl = (value, deps) => {
  const mask = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (candidate) => toTrimmedString(candidate, deps);
  return mask(value);
};

export const readResourceGateOnChain = async ({
  registryAddress,
  registryRpcUrls,
  registrySlug,
  resourceKey,
  deps,
} = {}) => {
  let lastError = null;
  const errors = [];
  const callRegistryFunction = deps?.callRegistryFunction;
  const toChainId = typeof deps?.toChainId === 'function'
    ? deps.toChainId
    : defaultToChainId;

  for (const rpcUrl of Array.isArray(registryRpcUrls) ? registryRpcUrls : []) {
    try {
      const res = await callRegistryFunction({
        rpcUrl,
        registryAddress,
        method: 'getResourceGate',
        args: [registrySlug, resourceKey],
      });
      const sbtAddresses = Array.isArray(res?.[0]) ? res[0].filter(Boolean) : [];
      const chainId = toChainId(res?.[1] || 0);
      const mode = Number(res?.[2] || 0);
      return { ok: true, gate: { sbtAddresses, chainId, mode }, rpcUrl, errors };
    } catch (err) {
      lastError = err;
      errors.push({
        rpcUrl: maskRpcUrl(rpcUrl, deps),
        status: err?.rpcStatus ?? null,
        error: toTrimmedString(err?.message || err, deps),
        rpcError: err?.rpcError || null,
      });
    }
  }

  return {
    ok: false,
    error: toTrimmedString(lastError?.message || lastError || 'Registry gate lookup failed.', deps),
    errors,
  };
};
