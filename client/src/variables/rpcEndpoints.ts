import rpcDefaults from './rpcDefaults.js';

const {
  faucetFallbackRpcUrlsByChainId,
  getFaucetFallbackRpcUrls,
  getPathRpcUrl,
  getPublicRpcUrls,
  pathRpcUrlsByChainId,
  publicRpcUrlsByChainId,
} = rpcDefaults;

export {
  faucetFallbackRpcUrlsByChainId,
  getFaucetFallbackRpcUrls,
  getPathRpcUrl,
  getPublicRpcUrls,
  pathRpcUrlsByChainId,
  publicRpcUrlsByChainId,
};

export const BASE_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(84532));
