import { toTrimmedString } from './stringCoercion.js';

const maskRpcUrl = (value, deps) => {
  const mask = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (candidate) => toTrimmedString(candidate, deps);
  return mask(value);
};

export const readSessionExistsOnChain = async ({
  registryAddress,
  registryRpcUrls,
  registrySlug,
  deps,
} = {}) => {
  let lastError = null;
  const errors = [];
  const callRegistryFunction = deps?.callRegistryFunction;

  for (const rpcUrl of Array.isArray(registryRpcUrls) ? registryRpcUrls : []) {
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
      errors.push({
        rpcUrl: maskRpcUrl(rpcUrl, deps),
        status: err?.rpcStatus ?? null,
        error: toTrimmedString(err?.message || err, deps),
        rpcError: err?.rpcError || null,
      });
    }
  }

  return { exists: null, error: lastError, errors };
};
