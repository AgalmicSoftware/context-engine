import {
  createEthersInterfaceProviderGateHelpersWithWorkerDeps as createEthersInterfaceProviderGateHelpersWithWorkerDepsBoundary,
} from './ethersInterfaceProviderGateBinding.js';
import {
  createEthersPrimitiveValueHelpersWithWorkerDeps as createEthersPrimitiveValueHelpersWithWorkerDepsBoundary,
} from './ethersPrimitiveValueBinding.js';
import {
  createGroupProofAddressHashHelpersWithWorkerDeps as createGroupProofAddressHashHelpersWithWorkerDepsBoundary,
} from './groupProofAddressHashBinding.js';
import {
  createOutboundUrlSafetyHelpersWithWorkerDeps as createOutboundUrlSafetyHelpersWithWorkerDepsBoundary,
} from './outboundUrlSafetyBinding.js';
import {
  createRegistryFaucetRpcHelpersWithWorkerDeps as createRegistryFaucetRpcHelpersWithWorkerDepsBoundary,
} from './registryFaucetRpcBinding.js';
import {
  createRpcContractProbeHelpersWithWorkerDeps as createRpcContractProbeHelpersWithWorkerDepsBoundary,
} from './rpcContractProbeBinding.js';

export const createWorkerLowLevelHelpersWithWorkerDeps = ({
  deps,
  constants,
  defaults,
} = {}) => {
  const outboundHelpers = (
    deps?.createOutboundUrlSafetyHelpersWithWorkerDeps ||
    createOutboundUrlSafetyHelpersWithWorkerDepsBoundary
  )({
    deps: {
      toStr: deps?.toStr,
      URL: deps?.URL,
      Headers: deps?.Headers,
      fetch: deps?.fetch,
    },
  });

  const ethersPrimitiveHelpers = (
    deps?.createEthersPrimitiveValueHelpersWithWorkerDeps ||
    createEthersPrimitiveValueHelpersWithWorkerDepsBoundary
  )({
    deps: {
      ethers: deps?.ethers,
      toStr: deps?.toStr,
    },
  });

  const registryFaucetRpcHelpers = (
    deps?.createRegistryFaucetRpcHelpersWithWorkerDeps ||
    createRegistryFaucetRpcHelpersWithWorkerDepsBoundary
  )({
    deps: {
      normalizeWorkerSessionSlug: deps?.normalizeWorkerSessionSlug,
      normalizeRpcUrlList: deps?.normalizeRpcUrlList,
      mergeRpcUrlLists: deps?.mergeRpcUrlLists,
      toChainId: deps?.toChainId,
      toStr: deps?.toStr,
    },
    defaults: {
      defaultFaucetRpcUrl: defaults?.defaultFaucetRpcUrl,
    },
  });

  let rpcContractProbeHelpers = null;

  const ethersInterfaceProviderGateHelpers = (
    deps?.createEthersInterfaceProviderGateHelpersWithWorkerDeps ||
    createEthersInterfaceProviderGateHelpersWithWorkerDepsBoundary
  )({
    deps: {
      ethers: deps?.ethers,
      toChainId: deps?.toChainId,
      toStr: deps?.toStr,
      isAddress: ethersPrimitiveHelpers.isAddress,
      resolveRegistryRpcUrl: registryFaucetRpcHelpers.resolveRegistryRpcUrl,
      callContractFunction: (...args) => rpcContractProbeHelpers?.callContractFunction?.(...args),
      rpcRequest: (...args) => rpcContractProbeHelpers?.rpcRequest?.(...args),
      maskRpcUrl: (...args) => rpcContractProbeHelpers?.maskRpcUrl?.(...args),
      log: deps?.log,
    },
    constants: {
      sessionRegistryAbi: constants?.sessionRegistryAbi,
      erc721Abi: constants?.erc721Abi,
      sbtAdminAbi: constants?.sbtAdminAbi,
      hatsAbi: constants?.hatsAbi,
      faucetSbtGateAbi: constants?.faucetSbtGateAbi,
    },
  });

  const groupProofAddressHashHelpers = (
    deps?.createGroupProofAddressHashHelpersWithWorkerDeps ||
    createGroupProofAddressHashHelpersWithWorkerDepsBoundary
  )({
    deps: {
      toStr: deps?.toStr,
      isAddress: ethersPrimitiveHelpers.isAddress,
      getAddress: ethersPrimitiveHelpers.getAddress,
      verifyMessage: ethersPrimitiveHelpers.verifyMessage,
      getBytes: ethersPrimitiveHelpers.getBytes,
      solidityKeccak256: ethersPrimitiveHelpers.solidityKeccak256,
    },
    constants: {
      zeroBytes32: constants?.zeroBytes32,
    },
  });

  rpcContractProbeHelpers = (
    deps?.createRpcContractProbeHelpersWithWorkerDeps ||
    createRpcContractProbeHelpersWithWorkerDepsBoundary
  )({
    deps: {
      toStr: deps?.toStr,
      fetch: deps?.rpcFetch,
      URL: deps?.URL,
      isBlockedOutboundUrl: outboundHelpers.isBlockedOutboundUrl,
      getRegistryInterface: ethersInterfaceProviderGateHelpers.getRegistryInterface,
      now: deps?.now,
      log: deps?.log,
    },
  });

  return {
    isBlockedOutboundUrl: outboundHelpers.isBlockedOutboundUrl,
    safeFetch: outboundHelpers.safeFetch,
    normalizeSessionIdHex: ethersPrimitiveHelpers.normalizeSessionIdHex,
    toBigInt: ethersPrimitiveHelpers.toBigInt,
    isAddress: ethersPrimitiveHelpers.isAddress,
    getAddress: ethersPrimitiveHelpers.getAddress,
    verifyMessage: ethersPrimitiveHelpers.verifyMessage,
    getBytes: ethersPrimitiveHelpers.getBytes,
    solidityKeccak256: ethersPrimitiveHelpers.solidityKeccak256,
    parseEther: ethersPrimitiveHelpers.parseEther,
    formatEther: ethersPrimitiveHelpers.formatEther,
    toRegistrySessionSlug: registryFaucetRpcHelpers.toRegistrySessionSlug,
    resolveRegistryRpcUrls: registryFaucetRpcHelpers.resolveRegistryRpcUrls,
    resolveRegistryRpcUrl: registryFaucetRpcHelpers.resolveRegistryRpcUrl,
    resolveRpcUrlListForGate: registryFaucetRpcHelpers.resolveRpcUrlListForGate,
    resolveFaucetRpcUrls: registryFaucetRpcHelpers.resolveFaucetRpcUrls,
    isBytes32Hex: registryFaucetRpcHelpers.isBytes32Hex,
    getRegistryInterface: ethersInterfaceProviderGateHelpers.getRegistryInterface,
    getErc721Interface: ethersInterfaceProviderGateHelpers.getErc721Interface,
    getSbtAdminInterface: ethersInterfaceProviderGateHelpers.getSbtAdminInterface,
    getHatsInterface: ethersInterfaceProviderGateHelpers.getHatsInterface,
    getFaucetSbtGateInterface: ethersInterfaceProviderGateHelpers.getFaucetSbtGateInterface,
    isPositiveBalance: ethersInterfaceProviderGateHelpers.isPositiveBalance,
    checkSbtGate: ethersInterfaceProviderGateHelpers.checkSbtGate,
    normalizeAddressLower: groupProofAddressHashHelpers.normalizeAddressLower,
    computeGroupMintMessageHash: groupProofAddressHashHelpers.computeGroupMintMessageHash,
    verifyGroupSignatureForFaucet: groupProofAddressHashHelpers.verifyGroupSignatureForFaucet,
    maskRpcUrl: rpcContractProbeHelpers.maskRpcUrl,
    rpcRequest: rpcContractProbeHelpers.rpcRequest,
    callContractFunction: rpcContractProbeHelpers.callContractFunction,
    callRegistryFunction: rpcContractProbeHelpers.callRegistryFunction,
    probeRpcUrls: rpcContractProbeHelpers.probeRpcUrls,
  };
};
