export const resolveWorkerLowLevelHelperInput = ({
  deps,
  constants,
  defaults,
} = {}) => ({
  deps: {
    ethers: deps?.ethers,
    toStr: deps?.toStr,
    URL: deps?.URL,
    Headers: deps?.Headers,
    normalizeWorkerSessionSlug: deps?.normalizeWorkerSessionSlug,
    normalizeRpcUrlList: deps?.normalizeRpcUrlList,
    mergeRpcUrlLists: deps?.mergeRpcUrlLists,
    toChainId: deps?.toChainId,
    log: deps?.log,
    fetch: deps?.fetch,
    rpcFetch: deps?.rpcFetch,
    now: deps?.now,
  },
  constants: {
    zeroBytes32: constants?.ZERO_BYTES32,
    sessionRegistryAbi: constants?.SESSION_REGISTRY_ABI,
    erc721Abi: constants?.ERC721_ABI,
    sbtAdminAbi: constants?.SBT_ADMIN_ABI,
    hatsAbi: constants?.HATS_ABI,
    faucetSbtGateAbi: constants?.FAUCET_SBT_GATE_ABI,
  },
  defaults: {
    defaultFaucetRpcUrl: defaults?.DEFAULT_FAUCET_RPC_URL,
  },
});
