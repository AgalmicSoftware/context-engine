/* eslint-env commonjs */

type ChainIdInput = unknown;
type RpcUrlMap = Record<string, unknown>;

const toStr = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));

const normalizeUrl = (value: unknown): string => toStr(value).trim();

const freezeUrlList = (value: unknown): readonly string[] =>
  Object.freeze((Array.isArray(value) ? value : [value]).map((entry) => normalizeUrl(entry)).filter(Boolean));

const freezeUrlListMap = (map: RpcUrlMap): Readonly<Record<string, readonly string[]>> =>
  Object.freeze(
    Object.fromEntries(Object.entries(map || {}).map(([key, value]) => [Number(key), freezeUrlList(value)])),
  ) as Readonly<Record<string, readonly string[]>>;

const freezeUrlMap = (map: RpcUrlMap): Readonly<Record<string, string>> =>
  Object.freeze(
    Object.fromEntries(Object.entries(map || {}).map(([key, value]) => [Number(key), normalizeUrl(value)])),
  ) as Readonly<Record<string, string>>;

const readChainValue = (map: Record<string, unknown>, chainId: ChainIdInput): unknown => {
  const id = Number(chainId || 0);
  if (!id) return undefined;
  return map[id] || map[String(id)];
};

const cloneUrlList = (list: unknown): string[] => (Array.isArray(list) ? [...list] : []);

const publicRpcUrlsByChainId = freezeUrlListMap({
  1: ['https://ethereum.publicnode.com', 'https://eth.merkle.io', 'https://rpc.flashbots.net'],
  10: ['https://mainnet.optimism.io', 'https://optimism.publicnode.com'],
  56: ['https://bsc-dataseed.binance.org', 'https://bsc.publicnode.com', 'https://bsc-rpc.publicnode.com'],
  137: ['https://polygon-rpc.com', 'https://polygon.publicnode.com'],
  42220: ['https://forno.celo.org', 'https://celo.publicnode.com', 'https://rpc.ankr.com/celo'],
  8453: [
    'https://base.publicnode.com',
    'https://base-rpc.publicnode.com',
    'https://base.llamarpc.com',
    'https://mainnet.base.org',
  ],
  84532: [
    'https://base-sepolia-rpc.publicnode.com',
    'https://base-sepolia.publicnode.com',
    'https://base-sepolia.blockscout.com/api/eth-rpc',
    'https://base-sepolia.gateway.tenderly.co',
    'https://base-sepolia.drpc.org',
    'https://sepolia.base.org',
  ],
  11155420: [
    'https://optimism-sepolia.gateway.tenderly.co',
    'https://optimism-sepolia.drpc.org',
    'https://sepolia.optimism.io',
    'https://optimism-sepolia.publicnode.com',
    'https://optimism-sepolia-rpc.publicnode.com',
  ],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.publicnode.com'],
  421614: ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia.publicnode.com'],
  747474: ['https://rpc.katana.network'],
});

const pathRpcUrlsByChainId = freezeUrlMap({
  1: 'https://eth.api.pocket.network',
  10: 'https://op.api.pocket.network',
  56: 'https://bsc.api.pocket.network',
  137: 'https://poly.api.pocket.network',
  42220: 'https://celo.api.pocket.network',
  8453: 'https://base.api.pocket.network',
  42161: 'https://arb-one.api.pocket.network',
  43114: 'https://avax.api.pocket.network',
  11155111: 'https://eth-sepolia-testnet.api.pocket.network',
  11155420: 'https://op-sepolia-testnet.api.pocket.network',
  421614: 'https://arb-sepolia-testnet.api.pocket.network',
  84532: 'https://base-sepolia-testnet.api.pocket.network',
  80002: 'https://poly-amoy-testnet.api.pocket.network',
});

const faucetFallbackRpcUrlsByChainId = freezeUrlListMap({
  8453: ['https://mainnet.base.org', 'https://base.publicnode.com', 'https://base-rpc.publicnode.com'],
  84532: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com', 'https://base-sepolia.drpc.org'],
  11155420: [
    'https://sepolia.optimism.io',
    'https://optimism-sepolia.publicnode.com',
    'https://optimism-sepolia-rpc.publicnode.com',
    'https://optimism-sepolia.drpc.org',
    'https://optimism-sepolia.gateway.tenderly.co',
  ],
});

const getPublicRpcUrls = (chainId: ChainIdInput, overrides: RpcUrlMap | null = null): string[] => {
  const base = readChainValue(publicRpcUrlsByChainId, chainId);
  const override = overrides && typeof overrides === 'object' ? readChainValue(overrides, chainId) : undefined;
  return cloneUrlList(Array.isArray(override) ? freezeUrlList(override) : base);
};

const getPathRpcUrl = (chainId: ChainIdInput, overrides: RpcUrlMap | null = null): string => {
  const override = overrides && typeof overrides === 'object' ? readChainValue(overrides, chainId) : undefined;
  return normalizeUrl(override || readChainValue(pathRpcUrlsByChainId, chainId) || '');
};

const getFaucetFallbackRpcUrls = (chainId: ChainIdInput, overrides: RpcUrlMap | null = null): string[] => {
  const base = readChainValue(faucetFallbackRpcUrlsByChainId, chainId);
  const override = overrides && typeof overrides === 'object' ? readChainValue(overrides, chainId) : undefined;
  return cloneUrlList(Array.isArray(override) ? freezeUrlList(override) : base);
};

const rpcDefaults = Object.freeze({
  publicRpcUrlsByChainId,
  pathRpcUrlsByChainId,
  faucetFallbackRpcUrlsByChainId,
  getPublicRpcUrls,
  getPathRpcUrl,
  getFaucetFallbackRpcUrls,
});

export {
  faucetFallbackRpcUrlsByChainId,
  getFaucetFallbackRpcUrls,
  getPathRpcUrl,
  getPublicRpcUrls,
  pathRpcUrlsByChainId,
  publicRpcUrlsByChainId,
};

export default rpcDefaults;
