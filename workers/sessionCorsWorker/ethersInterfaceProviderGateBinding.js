import { attestRpcEndpointChain } from './rpcChainAttestation.js';
import { resolveRegistryChainId } from './chainIdNormalization.js';
import {
  buildSafeRpcFailure,
  createRpcDiagnosticMasker,
} from './rpcDiagnosticSafety.js';

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
    const provider = getJsonRpcProvider(rpcUrl, resolveRegistryChainId(config));
    return new deps.ethers.Contract(registryAddress, constants?.sessionRegistryAbi, provider);
  };

  const checkSbtGate = async ({
    sbtAddresses,
    address,
    rpcUrl,
    mode,
    chainId,
    rpcUrlIsPrivate = false,
    chainAttestationCache,
  }) => {
    if (!Array.isArray(sbtAddresses) || sbtAddresses.length === 0) return true;
    if (!rpcUrl) return false;
    const log = deps?.log || console.log;
    const maskRpcUrl = createRpcDiagnosticMasker({ maskRpcUrl: deps?.maskRpcUrl });
    const rpcUrlDiagnostic = maskRpcUrl(rpcUrl, { isPrivate: rpcUrlIsPrivate });
    const attestation = await attestRpcEndpointChain({
      rpcUrl,
      expectedChainId: chainId,
      rpcRequest: deps?.rpcRequest,
      toChainId: deps?.toChainId,
      cache: chainAttestationCache,
    });
    if (!attestation.ok) {
      log('[gating] sbt rpc chain attestation failed', {
        address,
        rpcUrl: rpcUrlDiagnostic,
        expectedChainId: attestation.expectedChainId,
        actualChainId: attestation.actualChainId,
        reason: attestation.reason,
        status: attestation.status,
        code: attestation.code,
      });
      return false;
    }
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
          const safeFailure = buildSafeRpcFailure({
            rpcUrl,
            error: err,
            errorLabel: 'SBT balance check failed.',
            maskRpcUrl: deps?.maskRpcUrl,
            isPrivate: rpcUrlIsPrivate,
          });
          errors.push({
            sbt,
            status: safeFailure.status,
            ...(safeFailure.code != null ? { code: safeFailure.code } : {}),
            error: safeFailure.error,
          });
          return false;
        }
      })
    );
    if (!checks.some(Boolean) && errors.length) {
      log('[gating] sbt balanceOf failed', {
        address,
        rpcUrl: rpcUrlDiagnostic,
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
