import { toTrimmedString } from './stringCoercion.js';
import { resolveRegistryChainId } from './chainIdNormalization.js';
import {
  evaluateWorkerCanonicalAnonymousAccess,
  isWorkerCanonicalSessionConfig,
} from './workerCanonicalAuthority.js';

const maskRpcUrlList = (rpcUrls, deps) => {
  const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (value) => toTrimmedString(value, deps);
  return (Array.isArray(rpcUrls) ? rpcUrls : []).map(maskRpcUrl);
};

export const evaluateAnonymousRouteAccess = async ({
  slug,
  config,
  route,
  apiKey,
  deps,
  constants,
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
  const readResourceGateOnChain = typeof deps?.readResourceGateOnChain === 'function'
    ? deps.readResourceGateOnChain
    : async () => ({ ok: false, error: 'readResourceGateOnChain unavailable.', errors: [] });
  const warn = typeof deps?.warn === 'function' ? deps.warn : () => {};
  const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (value) => toTrimmedString(value, deps);

  const anonymousGateUnavailableError = toTrimmedString(constants?.anonymousGateUnavailableError, deps)
    || 'Access denied: on-chain gate data unavailable.';
  const anonymousRouteDeniedError = toTrimmedString(constants?.anonymousRouteDeniedError, deps)
    || 'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.';
  const anonymousScopeDisabledError = toTrimmedString(constants?.anonymousScopeDisabledError, deps)
    || 'Anonymous access denied: route scope disabled in session config.';

  const routeKey = toTrimmedString(route, deps).toLowerCase();
  const requestApiKey = toTrimmedString(apiKey, deps);
  if (routeKey !== 'ai' && routeKey !== 'transcribe') {
    return { ok: false, status: 403, error: 'Anonymous access denied for route.' };
  }

  const scopeKey = routeKey === 'transcribe' ? 'transcribe' : 'ai';
  const scopeOverrides = config?.scopes && typeof config.scopes === 'object' ? config.scopes : null;
  if (scopeOverrides && typeof scopeOverrides[scopeKey] === 'boolean' && !scopeOverrides[scopeKey]) {
    return {
      ok: false,
      status: 403,
      error: anonymousScopeDisabledError,
      reason: 'scope-disabled',
      scope: scopeKey,
    };
  }

  if (isWorkerCanonicalSessionConfig(config)) {
    const result = evaluateWorkerCanonicalAnonymousAccess({ config, route: routeKey });
    return result.ok
      ? result
      : {
          ...result,
          status: 403,
          error: `Anonymous access denied: ${scopeKey} is not enabled in workerAuthority.anonymousScopes.`,
        };
  }

  if (requestApiKey) {
    return { ok: true, reason: 'request-api-key' };
  }

  const registryAddress = toTrimmedString(config?.registryAddress, deps);
  const registryChainId = resolveRegistryChainId(config);
  const registryRpcUrls = resolveRegistryRpcUrls(config);
  const registrySlug = toRegistrySessionSlug(slug);
  if (!isAddress(registryAddress) || !registryRpcUrls.length) {
    warn('[gating] anonymous access denied: registry authority unavailable', {
      slug: registrySlug,
      route: routeKey,
      registryAddress,
      registryRpcUrls: maskRpcUrlList(registryRpcUrls, deps),
    });
    return { ok: false, status: 403, error: anonymousGateUnavailableError };
  }

  // Keep endpoint attestation request-local so chain identity cannot go stale
  // across separate anonymous requests.
  const chainAttestationCache = new Map();
  const sessionCheck = await readSessionExistsOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    expectedChainId: registryChainId,
    chainAttestationCache,
  });
  if (sessionCheck.exists !== true) {
    const reason = sessionCheck.exists === false ? 'session-not-registered' : 'session-check-unavailable';
    warn('[gating] anonymous access denied: on-chain authority unavailable', {
      slug: registrySlug,
      route: routeKey,
      reason,
      registryAddress,
      rpcUrl: sessionCheck.rpcUrl ? maskRpcUrl(sessionCheck.rpcUrl) : '',
      rpcErrors: sessionCheck.errors || [],
      rpcError: sessionCheck.error ? toTrimmedString(sessionCheck.error?.message || sessionCheck.error, deps) : '',
    });
    return { ok: false, status: 403, error: anonymousGateUnavailableError };
  }

  const defaultGate = await readResourceGateOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    resourceKey: 'default',
    expectedChainId: registryChainId,
    chainAttestationCache,
  });
  if (!defaultGate.ok) {
    warn('[gating] anonymous access denied: default gate lookup failed', {
      slug: registrySlug,
      route: routeKey,
      registryAddress,
      rpcErrors: defaultGate.errors || [],
      error: defaultGate.error || '',
    });
    return { ok: false, status: 403, error: anonymousGateUnavailableError };
  }

  const aiGate = await readResourceGateOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    resourceKey: 'ai',
    expectedChainId: registryChainId,
    chainAttestationCache,
  });
  if (!aiGate.ok) {
    warn('[gating] anonymous access denied: ai gate lookup failed', {
      slug: registrySlug,
      route: routeKey,
      registryAddress,
      rpcErrors: aiGate.errors || [],
      error: aiGate.error || '',
    });
    return { ok: false, status: 403, error: anonymousGateUnavailableError };
  }

  const defaultOpen = (defaultGate.gate?.sbtAddresses || []).length === 0;
  const aiOpen = (aiGate.gate?.sbtAddresses || []).length === 0;
  if (!defaultOpen || !aiOpen) {
    return {
      ok: false,
      status: 403,
      error: anonymousRouteDeniedError,
      reason: 'gates-restricted',
      defaultOpen,
      aiOpen,
    };
  }

  return { ok: true, reason: 'open-default-ai-gates', defaultOpen, aiOpen };
};
