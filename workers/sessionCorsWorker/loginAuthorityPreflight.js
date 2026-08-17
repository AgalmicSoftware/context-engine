import { toTrimmedString } from './stringCoercion.js';
import { isWorkerCanonicalSessionConfig } from './workerCanonicalAuthority.js';
import { resolveRegistryChainId } from './chainIdNormalization.js';

export const resolveLoginAuthorityContext = async ({
  slug,
  address,
  config,
  deps,
} = {}) => {
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
  const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (value) => toTrimmedString(value, deps);
  const warn = typeof deps?.warn === 'function' ? deps.warn : () => {};

  const registrySlug = toRegistrySessionSlug(slug);
  if (isWorkerCanonicalSessionConfig(config)) {
    return {
      authorityMode: 'worker_canonical',
      registryAddress: '',
      registryRpcUrls: [],
      registrySlug,
      sessionCheck: {
        exists: true,
        source: 'worker-config',
        rpcUrl: '',
        errors: [],
        error: null,
      },
    };
  }

  const registryAddress = toTrimmedString(config?.registryAddress, deps);
  const registryRpcUrls = resolveRegistryRpcUrls(config);
  if (!isAddress(registryAddress) || !registryRpcUrls.length) {
    throw new Error('Session registry not configured (registryAddress + rpcUrl required).');
  }

  const sessionCheck = await readSessionExistsOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    expectedChainId: resolveRegistryChainId(config),
    chainAttestationCache: deps?.chainAttestationCache,
  });
  if (sessionCheck?.exists !== true) {
    const reason = sessionCheck?.exists === false ? 'session-not-registered' : 'session-check-unavailable';
    warn('[gating] on-chain gate authority unavailable; denying login', {
      slug: registrySlug,
      address,
      reason,
      registryAddress,
      rpcUrl: sessionCheck?.rpcUrl ? maskRpcUrl(sessionCheck.rpcUrl) : '',
      rpcErrors: sessionCheck?.errors || [],
      rpcError: sessionCheck?.error ? toTrimmedString(sessionCheck.error?.message || sessionCheck.error, deps) : '',
    });
    throw new Error('Access denied: on-chain gate data unavailable.');
  }

  return {
    registryAddress,
    registryRpcUrls,
    registrySlug,
    sessionCheck,
  };
};
