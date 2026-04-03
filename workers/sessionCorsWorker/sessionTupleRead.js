import { toTrimmedString } from './stringCoercion.js';

const maskRpcUrl = (value, deps) => {
  const mask = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (candidate) => toTrimmedString(candidate, deps);
  return mask(value);
};

export const readSessionBySlugOnChain = async ({
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
        method: 'getSessionBySlug',
        args: [registrySlug],
      });
      const tuple = Array.isArray(decoded) ? decoded : null;
      return { ok: true, tuple, rpcUrl, errors };
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

  return { ok: false, error: lastError, errors };
};
