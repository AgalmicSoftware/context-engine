import { resolveRegistryChainId } from './chainIdNormalization.js';
import { resolveSessionConfigSessionIdHex } from './sessionConfigMutation.js';

const resolveBootstrapAdminAddress = (body = {}, deps) => {
  const incoming = body?.config && typeof body.config === 'object' ? body.config : null;
  const requestedAdmin = deps?.toStr?.(incoming?.adminAddress || body?.adminAddress).trim();
  if (!requestedAdmin || !deps?.isAddress?.(requestedAdmin)) return '';
  return requestedAdmin;
};

export const validateBootstrapAdmin = async ({
  env,
  slug,
  address,
  body,
  deps,
} = {}) => {
  const requestedAdmin = resolveBootstrapAdminAddress(body, deps);
  const requestedAdminMatches = (
    !!requestedAdmin &&
    requestedAdmin.toLowerCase() === address.toLowerCase()
  );

  const boundBootstrapAdmin = deps?.toStr?.(env?.BOOTSTRAP_ADMIN_ADDRESS || '').trim();
  if (boundBootstrapAdmin) {
    if (!deps?.isAddress?.(boundBootstrapAdmin)) return false;
    return (
      requestedAdminMatches &&
      boundBootstrapAdmin.toLowerCase() === address.toLowerCase()
    );
  }

  const registryAddress = deps?.toStr?.(env?.REGISTRY_ADDRESS || '').trim();
  const registryRpcUrls = deps?.normalizeRpcUrlList?.(env?.RPC_URL) || [];
  const registrySlug = deps?.toRegistrySessionSlug?.(slug);

  // Registry-less deployments must bind BOOTSTRAP_ADMIN_ADDRESS during the
  // trusted deployment step. Never let an arbitrary first signer claim a
  // reachable worker whose bootstrap binding or registry wiring is absent.
  if (!deps?.isAddress?.(registryAddress) || !registryRpcUrls.length) {
    return false;
  }

  const incomingConfig = body?.config && typeof body.config === 'object' ? body.config : {};
  const environmentChainId = resolveRegistryChainId({
    registryChainId: env?.REGISTRY_CHAIN_ID,
    networkChainId: env?.CHAIN_ID,
  });
  const expectedChainId = resolveRegistryChainId(incomingConfig, environmentChainId);
  if (!expectedChainId) return false;
  const chainAttestationCache = new Map();

  const sessionCheck = await deps?.readSessionExistsOnChain?.({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    expectedChainId,
    chainAttestationCache,
  });
  if (sessionCheck?.exists === false) {
    return false;
  }
  if (sessionCheck?.exists !== true) {
    return false;
  }

  const tupleRead = await deps?.readSessionBySlugOnChain?.({
    registryAddress,
    registryRpcUrls: [sessionCheck?.rpcUrl || registryRpcUrls[0]].filter(Boolean),
    registrySlug,
    expectedChainId,
    chainAttestationCache,
  });
  if (!tupleRead?.ok) {
    return false;
  }

  try {
    const incomingConfig = body?.config && typeof body.config === 'object' ? body.config : {};
    const hasIncomingSessionId = ['sessionId', 'sessionIdHex'].some(
      (key) => Object.prototype.hasOwnProperty.call(incomingConfig, key) && deps?.toStr?.(incomingConfig[key]).trim(),
    );
    if (hasIncomingSessionId) {
      const requestedSessionId = resolveSessionConfigSessionIdHex(incomingConfig);
      const onChainSessionId = resolveSessionConfigSessionIdHex({ sessionId: tupleRead?.tuple?.[7] });
      if (!requestedSessionId || requestedSessionId !== onChainSessionId) return false;
    }
    const onChainAdmin = deps?.toStr?.(tupleRead?.tuple?.[4] || '').trim();
    if (!onChainAdmin || !deps?.isAddress?.(onChainAdmin)) return false;
    return (
      requestedAdminMatches &&
      onChainAdmin.toLowerCase() === address.toLowerCase()
    );
  } catch {
    return false;
  }
};
