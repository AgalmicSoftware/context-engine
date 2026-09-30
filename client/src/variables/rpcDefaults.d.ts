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

declare const rpcDefaults: RpcDefaults;
export declare const publicRpcUrlsByChainId: RpcDefaults['publicRpcUrlsByChainId'];
export declare const pathRpcUrlsByChainId: RpcDefaults['pathRpcUrlsByChainId'];
export declare const faucetFallbackRpcUrlsByChainId: RpcDefaults['faucetFallbackRpcUrlsByChainId'];
export declare const getPublicRpcUrls: RpcDefaults['getPublicRpcUrls'];
export declare const getPathRpcUrl: RpcDefaults['getPathRpcUrl'];
export declare const getFaucetFallbackRpcUrls: RpcDefaults['getFaucetFallbackRpcUrls'];
export default rpcDefaults;
