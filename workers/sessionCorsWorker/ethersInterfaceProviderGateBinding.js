const toStr = (value, deps) => (
  typeof deps?.toStr === 'function'
    ? deps.toStr(value)
    : typeof value === 'string'
      ? value
      : value == null
        ? ''
        : String(value)
);

const getInterfaceCtor = (deps) => (
  typeof deps?.getEthersInterfaceCtor === 'function'
    ? deps.getEthersInterfaceCtor()
    : (deps?.ethers?.utils?.Interface || deps?.ethers?.Interface || null)
);

const isPositiveBalance = (bal) => {
  if (bal == null) return false;
  if (typeof bal === 'bigint') return bal > 0n;
  if (typeof bal === 'number') return bal > 0;
  if (typeof bal === 'string') {
    try {
      return BigInt(bal) > 0n;
    } catch {
      return false;
    }
  }
  if (typeof bal === 'object') {
    if (typeof bal.gt === 'function') return bal.gt(0);
    if (typeof bal.toString === 'function') {
      try {
        return BigInt(bal.toString()) > 0n;
      } catch {
        return false;
      }
    }
  }
  return false;
};

export const createEthersInterfaceProviderGateHelpersWithWorkerDeps = ({
  deps,
  constants,
} = {}) => {
  let registryInterface = null;
  let erc721Interface = null;
  let sbtAdminInterface = null;
  let hatsInterface = null;
  let faucetSbtGateInterface = null;

  const buildInterface = (cachedValue, abi) => {
    if (cachedValue) return cachedValue;
    const InterfaceCtor = getInterfaceCtor(deps);
    if (!InterfaceCtor) throw new Error('Interface unavailable');
    return new InterfaceCtor(abi);
  };

  const getRegistryInterface = () => {
    registryInterface = buildInterface(registryInterface, constants?.sessionRegistryAbi);
    return registryInterface;
  };

  const getErc721Interface = () => {
    erc721Interface = buildInterface(erc721Interface, constants?.erc721Abi);
    return erc721Interface;
  };

  const getSbtAdminInterface = () => {
    sbtAdminInterface = buildInterface(sbtAdminInterface, constants?.sbtAdminAbi);
    return sbtAdminInterface;
  };

  const getHatsInterface = () => {
    hatsInterface = buildInterface(hatsInterface, constants?.hatsAbi);
    return hatsInterface;
  };

  const getFaucetSbtGateInterface = () => {
    faucetSbtGateInterface = buildInterface(faucetSbtGateInterface, constants?.faucetSbtGateAbi);
    return faucetSbtGateInterface;
  };

  const getJsonRpcProvider = (rpcUrl, chainId) => {
    const resolvedChainId = deps?.toChainId?.(chainId);
    const providers = deps?.ethers?.providers || deps?.ethers;
    const ProviderCtor =
      resolvedChainId && providers?.StaticJsonRpcProvider
        ? providers.StaticJsonRpcProvider
        : providers?.JsonRpcProvider;
    if (!ProviderCtor) throw new Error('JsonRpcProvider unavailable');
    if (!resolvedChainId) return new ProviderCtor(rpcUrl);
    const network = { chainId: resolvedChainId, name: `chain-${resolvedChainId}` };
    return new ProviderCtor(rpcUrl, network);
  };

  const getRegistryContract = (config) => {
    const registryAddress = toStr(config?.registryAddress, deps).trim();
    if (!deps?.isAddress?.(registryAddress)) return null;
    const rpcUrl = deps?.resolveRegistryRpcUrl?.(config) || '';
    if (!rpcUrl) return null;
    const provider = getJsonRpcProvider(rpcUrl, config?.registryChainId);
    return new deps.ethers.Contract(registryAddress, constants?.sessionRegistryAbi, provider);
  };

  const checkSbtGate = async ({ sbtAddresses, address, rpcUrl, mode, chainId: _chainId }) => {
    void _chainId;
    if (!Array.isArray(sbtAddresses) || sbtAddresses.length === 0) return true;
    if (!rpcUrl) return false;
    const iface = getErc721Interface();
    const errors = [];
    const checks = await Promise.all(
      sbtAddresses.map(async (sbt) => {
        if (!deps?.isAddress?.(sbt)) return false;
        try {
          const decoded = await deps?.callContractFunction?.({
            rpcUrl,
            contractAddress: sbt,
            iface,
            method: 'balanceOf',
            args: [address],
          });
          const bal = Array.isArray(decoded) ? decoded[0] : decoded;
          return isPositiveBalance(bal);
        } catch (err) {
          errors.push({
            sbt,
            status: err?.rpcStatus ?? null,
            error: toStr(err?.message || err, deps).trim(),
            rpcError: err?.rpcError || null,
          });
          return false;
        }
      })
    );
    if (!checks.some(Boolean) && errors.length) {
      (deps?.log || console.log)('[gating] sbt balanceOf failed', {
        address,
        rpcUrl: deps?.maskRpcUrl?.(rpcUrl),
        errors,
      });
    }
    if (mode === 1 || mode === 'all') return checks.every(Boolean);
    return checks.some(Boolean);
  };

  return {
    getRegistryInterface,
    getErc721Interface,
    getSbtAdminInterface,
    getHatsInterface,
    getFaucetSbtGateInterface,
    getJsonRpcProvider,
    getRegistryContract,
    isPositiveBalance,
    checkSbtGate,
  };
};
