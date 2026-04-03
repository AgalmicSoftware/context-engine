export const validateAdmin = async ({
  env,
  slug,
  address,
  config,
  body,
  deps,
} = {}) => {
  void env;
  void slug;
  void body;

  if (!config) return false;
  const adminAddress = deps?.toStr?.(config?.adminAddress).trim();
  const hatsAddress = deps?.toStr?.(config?.hatsAddress).trim();
  const adminHatIdRaw = deps?.toStr?.(config?.adminHatId).trim();
  let adminHatId = 0n;
  if (adminHatIdRaw) {
    try {
      adminHatId = BigInt(adminHatIdRaw);
    } catch {
      adminHatId = 0n;
    }
  }

  if (adminAddress && deps?.isAddress?.(adminAddress)) {
    if (adminAddress.toLowerCase() === address.toLowerCase()) return true;
  }

  if (adminHatId > 0n && deps?.isAddress?.(hatsAddress)) {
    const rpcUrls = deps?.resolveRegistryRpcUrls?.(config) || [];
    if (!rpcUrls.length) return false;
    for (const rpcUrl of rpcUrls) {
      try {
        const iface = deps?.getHatsInterface?.();
        const decoded = await deps?.callContractFunction?.({
          rpcUrl,
          contractAddress: hatsAddress,
          iface,
          method: 'isWearerOfHat',
          args: [address, adminHatId],
        });
        const ok = Array.isArray(decoded) ? decoded[0] : decoded;
        if (ok) return true;
      } catch (_) {
        continue;
      }
    }
    return false;
  }

  return false;
};
