import canonicalRpcDefaults from '@ce-shared/rpcDefaults.cjs';

type ChainIdInput = unknown;
type RpcUrlMap = Record<string, unknown>;

type RpcDefaults = Readonly<{
  publicRpcUrlsByChainId: Readonly<Record<string, readonly string[]>>;
  pathRpcUrlsByChainId: Readonly<Record<string, string>>;
  faucetFallbackRpcUrlsByChainId: Readonly<Record<string, readonly string[]>>;
  getPublicRpcUrls: (chainId: ChainIdInput, overrides?: RpcUrlMap | null) => string[];
  getPathRpcUrl: (chainId: ChainIdInput, overrides?: RpcUrlMap | null) => string;
  getFaucetFallbackRpcUrls: (chainId: ChainIdInput, overrides?: RpcUrlMap | null) => string[];
}>;

const rpcDefaults = canonicalRpcDefaults as RpcDefaults;

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

export default rpcDefaults;
