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

  // Preserve legacy first-write bootstrap when the worker is not wired to the registry
  // or when the slug does not exist on-chain yet. Once the registry proves ownership,
  // the on-chain admin must authorize the bootstrap.
  if (!deps?.isAddress?.(registryAddress) || !registryRpcUrls.length) {
    return requestedAdminMatches;
  }

  const sessionCheck = await deps?.readSessionExistsOnChain?.({
    registryAddress,
    registryRpcUrls,
    registrySlug,
  });
  if (sessionCheck?.exists === false) {
    return requestedAdminMatches;
  }
  if (sessionCheck?.exists !== true) {
    return false;
  }

  const tupleRead = await deps?.readSessionBySlugOnChain?.({
    registryAddress,
    registryRpcUrls: [sessionCheck?.rpcUrl || registryRpcUrls[0]].filter(Boolean),
    registrySlug,
  });
  if (!tupleRead?.ok) {
    return false;
  }

  try {
    const onChainAdmin = deps?.toStr?.(tupleRead?.tuple?.[4] || '').trim();
    if (!onChainAdmin || !deps?.isAddress?.(onChainAdmin)) return false;
    return onChainAdmin.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
};
