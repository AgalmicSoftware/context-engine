import { toTrimmedString } from './stringCoercion.js';

const maskRpcUrl = (value, deps) => {
  const mask = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (candidate) => toTrimmedString(candidate, deps);
  return mask(value);
};

export const readRegistryCodeOnChain = async ({
  registryAddress,
  registryRpcUrls,
  deps,
} = {}) => {
  let lastError = null;
  const errors = [];
  const rpcRequest = deps?.rpcRequest;

  for (const rpcUrl of Array.isArray(registryRpcUrls) ? registryRpcUrls : []) {
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
      errors.push({
        rpcUrl: maskRpcUrl(rpcUrl, deps),
        status: err?.rpcStatus ?? null,
        error: toTrimmedString(err?.message || err, deps),
        rpcError: err?.rpcError || null,
      });
    }
  }

  return { size: null, error: lastError, errors };
};
