/** @file chains.js */
/** @typedef {import('wagmi').Chain} Chain */
import type { Chain } from 'wagmi';
import { chainConfig as opStackChainConfig } from 'viem/op-stack';
import { defineChain } from 'viem/utils';
import rpcDefaults from './rpcDefaults.js';
import { CE_RPC_PROVIDER_MODE, CE_USE_INFURA_RPC, DEFAULT_CHAIN_ID, PREFER_PATH_RPC } from './appConfig.js';
import { readPublicEnv } from './publicEnv.js';
import contractsConfig from './contracts.json';
import localContracts from './local-contracts.json';

const { getPathRpcUrl, getPublicRpcUrls } = rpcDefaults;

type UnknownRecord = Record<string, unknown>;
type RpcTransport = 'http' | 'wss';
type RpcUrlMap = Readonly<Record<number, string>>;
type PaidRpcRuntimeGlobals = Readonly<Record<number, Readonly<Record<RpcTransport, string>>>>;
type CeChain = Chain & {
  blockTime?: number;
  chainId?: number | string;
  defaultGasPriceGwei?: string | number;
  network: string;
  sourceId?: number;
  testnet?: boolean;
};
type ChainRegistry = Record<number, CeChain>;
type RuntimeGlobal = typeof globalThis & {
  CE_USE_INFURA_RPC?: unknown;
  CE_RPC_PROVIDER_MODE?: unknown;
  CE_PREFER_PATH_RPC?: unknown;
  CE_INCLUDE_LOCAL_SESSION_REGISTRY?: unknown;
  [key: string]: unknown;
};
type DefaultHttpRpcOptions = {
  allowPath?: boolean;
};

const readRecord = (value: unknown, key: string): unknown =>
  value && typeof value === 'object' ? (value as UnknownRecord)[key] : undefined;
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};
const readStringList = (value: unknown): string[] => (Array.isArray(value) ? normalizeRpcList(value) : []);

const runtimeGlobal = (): RuntimeGlobal | null => {
  try {
    return typeof globalThis !== 'undefined' ? (globalThis as RuntimeGlobal) : null;
  } catch (e) {
    void e; /* fallback: runtime global lookup. */
    return null;
  }
};

const defineCompatChain = (config: UnknownRecord): CeChain =>
  defineChain(config as Parameters<typeof defineChain>[0]) as CeChain;

const SEPOLIA_SOURCE_ID = 11_155_111;
const OP_MAINNET_SOURCE_ID = 1;
const BASE_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(84532));
const BASE_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(8453));
const OPTIMISM_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(10));
const OPTIMISM_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(11155420));
const ARBITRUM_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(42161));
const ARBITRUM_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(421614));
const ETHEREUM_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(1));
const POLYGON_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(137));
const BSC_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(56));
const CELO_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(42220));
const KATANA_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(747474));
const CONFIGURED_PAID_RPC_URL_HTTP_BY_CHAIN = Object.freeze({
  84532: readPublicEnv('REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP', ''),
  11155420: readPublicEnv('REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP', ''),
});
const CONFIGURED_PAID_RPC_URL_WSS_BY_CHAIN: RpcUrlMap = Object.freeze({
  84532: readPublicEnv('REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_WSS', ''),
  11155420: readPublicEnv('REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_WSS', ''),
});
const PAID_RPC_RUNTIME_GLOBALS_BY_CHAIN: PaidRpcRuntimeGlobals = Object.freeze({
  84532: Object.freeze({
    http: 'CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP',
    wss: 'CE_BASE_SEPOLIA_PAID_RPC_URL_WSS',
  }),
  11155420: Object.freeze({
    http: 'CE_OP_SEPOLIA_PAID_RPC_URL_HTTP',
    wss: 'CE_OP_SEPOLIA_PAID_RPC_URL_WSS',
  }),
});

// Toggle: include a configured paid testnet RPC in the chain RPC list.
// Flip this during debugging to quickly confirm whether 429/CORS issues are caused by free RPCs.
// Note: chain objects are constructed at module init time, so changes require a reload.
export const USE_INFURA = CE_USE_INFURA_RPC;
export const RPC_PROVIDER_MODE = CE_RPC_PROVIDER_MODE;

const readConfiguredPaidRpcUrl = (chainId: unknown, transport: RpcTransport = 'http') => {
  const id = Number(chainId || 0);
  const key = transport === 'wss' ? 'wss' : 'http';
  const runtimeField = PAID_RPC_RUNTIME_GLOBALS_BY_CHAIN?.[id]?.[key];
  try {
    const g = runtimeGlobal();
    if (runtimeField && g && typeof g[runtimeField] !== 'undefined') {
      return String(g[runtimeField] || '').trim();
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  const envMap = key === 'wss' ? CONFIGURED_PAID_RPC_URL_WSS_BY_CHAIN : CONFIGURED_PAID_RPC_URL_HTTP_BY_CHAIN;
  return String(envMap?.[id] || '').trim();
};

export const getConfiguredPaidRpcHttpUrl = (chainId: unknown) => readConfiguredPaidRpcUrl(chainId, 'http');
export const getConfiguredPaidRpcWssUrl = (chainId: unknown) => readConfiguredPaidRpcUrl(chainId, 'wss');
export const getConfiguredBaseSepoliaPaidRpcHttpUrl = () => getConfiguredPaidRpcHttpUrl(84532);

const readUseInfuraRpcFlag = () => {
  try {
    const g = runtimeGlobal();
    if (g) {
      if (typeof g.CE_USE_INFURA_RPC !== 'undefined') {
        return !!g.CE_USE_INFURA_RPC;
      }
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return !!USE_INFURA;
};

const readRpcProviderMode = () => {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.CE_RPC_PROVIDER_MODE !== 'undefined') {
      const mode = String(globalThis.CE_RPC_PROVIDER_MODE || '')
        .trim()
        .toLowerCase();
      if (mode === 'infura_only' || mode === 'fallback') return mode;
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  const mode = String(RPC_PROVIDER_MODE || '')
    .trim()
    .toLowerCase();
  if (mode === 'infura_only') return 'infura_only';
  return 'fallback';
};

const isInfuraOnlyForChain = (chainId) =>
  readRpcProviderMode() === 'infura_only' && !!getConfiguredPaidRpcHttpUrl(chainId);

const readPreferPathRpcFlag = (chainId: unknown = null) => {
  if (chainId != null && isInfuraOnlyForChain(chainId)) return false;
  try {
    const g = runtimeGlobal();
    if (g) {
      if (typeof g.CE_PREFER_PATH_RPC !== 'undefined') {
        return !!g.CE_PREFER_PATH_RPC;
      }
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return !!PREFER_PATH_RPC;
};

const resolvePathRpcUrl = (chainId: unknown) => {
  if (!readPreferPathRpcFlag(chainId)) return '';
  const url = getPathRpcUrl(chainId);
  return typeof url === 'string' ? url.trim() : '';
};

export const getPreferredPathRpcUrl = (chainId: unknown) => resolvePathRpcUrl(chainId);

const normalizeRpcList = (urls: readonly unknown[] = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  urls.forEach((raw) => {
    if (typeof raw !== 'string') return;
    const url = raw.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  });
  return out;
};

const withConfiguredPaidRpc = (chainId: unknown, urls: readonly unknown[] = []): string[] => {
  const list = normalizeRpcList(urls);
  const providerMode = readRpcProviderMode();
  const includePaidRpc = readUseInfuraRpcFlag() || providerMode === 'infura_only';
  if (!includePaidRpc) return list;
  const id = Number(chainId || 0);
  const paidRpcUrl = getConfiguredPaidRpcHttpUrl(id);
  if (!paidRpcUrl) return list;
  if (providerMode === 'infura_only') return [paidRpcUrl];
  const filtered = list.filter((u) => u !== paidRpcUrl);
  return [paidRpcUrl, ...filtered];
};

const withPathRpc = (chainId: unknown, urls: readonly unknown[] = []): string[] => {
  const pathUrl = resolvePathRpcUrl(chainId);
  const list = normalizeRpcList(urls);
  if (pathUrl) {
    const filtered = list.filter((url) => url !== pathUrl);
    return [pathUrl, ...filtered];
  }
  return list;
};

/** @type {Chain} */
export const baseSepolia = defineCompatChain({
  ...opStackChainConfig,
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  blockTime: 5000,
  defaultGasPriceGwei: '0.08',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    // PATH (Pocket) RPCs first (when enabled), then public fallbacks.
    // Keep a non-base.org fallback early since https://sepolia.base.org has been unstable (503s).
    public: {
      http: withPathRpc(84532, withConfiguredPaidRpc(84532, BASE_SEPOLIA_PUBLIC_RPC_URLS)),
    },
    default: {
      http: withPathRpc(84532, withConfiguredPaidRpc(84532, BASE_SEPOLIA_PUBLIC_RPC_URLS)),
    },
    wss: normalizeRpcList([getConfiguredPaidRpcWssUrl(84532)]),
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://sepolia.basescan.org',
      apiUrl: 'https://api-sepolia.basescan.org/api',
    },
  },
  contracts: {
    ...opStackChainConfig.contracts,
    disputeGameFactory: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0xd6E6dBf4F7EA0ac412fD8b65ED297e64BB7a06E1',
      },
    },
    l2OutputOracle: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0x84457ca9D0163FbC4bbfe4Dfbb20ba46e48DF254',
      },
    },
    portal: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0x49f53e41452c74589e85ca1677426ba426459e85',
        blockCreated: 4446677,
      },
    },
    l1StandardBridge: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0xfd0Bf71F60660E2f608ed56e1659C450eB113120',
        blockCreated: 4446677,
      },
    },
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 1059647,
    },
  },
  testnet: true,
  sourceId: SEPOLIA_SOURCE_ID,
});

/** @type {Chain} */
export const base = defineCompatChain({
  ...opStackChainConfig,
  id: 8453,
  name: 'Base',
  network: 'base',
  blockTime: 2000,
  defaultGasPriceGwei: '0.02',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    // PATH (Pocket) RPCs first, then public fallbacks.
    public: {
      http: withPathRpc(8453, BASE_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(8453, BASE_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://basescan.org',
      apiUrl: 'https://api.basescan.org/api',
    },
  },
  contracts: {
    ...opStackChainConfig.contracts,
    disputeGameFactory: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0x43edB88C4B80fDD2AdFF2412A7BebF9dF42cB40e',
      },
    },
    l2OutputOracle: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0x56315b90c40730925ec5485cf004d835058518A0',
      },
    },
    portal: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0x49048044D57e1C92A77f79988d21Fa8fAF74E97e',
        blockCreated: 17482143,
      },
    },
    l1StandardBridge: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0x3154Cf16ccdb4C6d922629664174b904d80F2C35',
        blockCreated: 17482143,
      },
    },
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 5022,
    },
  },
  testnet: false,
  sourceId: OP_MAINNET_SOURCE_ID,
});

/** @type {Chain} */
export const optimism = defineCompatChain({
  ...opStackChainConfig,
  id: 10,
  name: 'OP Mainnet',
  network: 'optimism',
  blockTime: 2000,
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: {
      http: withPathRpc(10, OPTIMISM_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(10, OPTIMISM_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Optimism Explorer',
      url: 'https://optimistic.etherscan.io',
      apiUrl: 'https://api-optimistic.etherscan.io/api',
    },
  },
  contracts: {
    ...opStackChainConfig.contracts,
    disputeGameFactory: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0xe5965Ab5962eDc7477C8520243A95517CD252fA9',
      },
    },
    l2OutputOracle: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0xdfe97868233d1aa22e815a266982f2cf17685a27',
      },
    },
    portal: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed',
      },
    },
    l1StandardBridge: {
      [OP_MAINNET_SOURCE_ID]: {
        address: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1',
      },
    },
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 4286263,
    },
  },
  testnet: false,
  sourceId: OP_MAINNET_SOURCE_ID,
});

/** @type {Chain} */
export const optimismSepolia = defineCompatChain({
  ...opStackChainConfig,
  id: 11155420,
  name: 'OP Sepolia',
  network: 'optimism-sepolia',
  blockTime: 2000,
  defaultGasPriceGwei: '3',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    public: {
      http: withPathRpc(11155420, withConfiguredPaidRpc(11155420, OPTIMISM_SEPOLIA_PUBLIC_RPC_URLS)),
    },
    default: {
      http: withPathRpc(11155420, withConfiguredPaidRpc(11155420, OPTIMISM_SEPOLIA_PUBLIC_RPC_URLS)),
    },
    wss: normalizeRpcList([getConfiguredPaidRpcWssUrl(11155420)]),
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://optimism-sepolia.blockscout.com',
      apiUrl: 'https://optimism-sepolia.blockscout.com/api',
    },
  },
  contracts: {
    ...opStackChainConfig.contracts,
    disputeGameFactory: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0x05F9613aDB30026FFd634f38e5C4dFd30a197Fa1',
      },
    },
    l2OutputOracle: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0x90E9c4f8a994a250F6aEfd61CAFb4F2e895D458F',
      },
    },
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 1620204,
    },
    portal: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0x16Fc5058F25648194471939df75CF27A2fdC48BC',
      },
    },
    l1StandardBridge: {
      [SEPOLIA_SOURCE_ID]: {
        address: '0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1',
      },
    },
  },
  testnet: true,
  sourceId: SEPOLIA_SOURCE_ID,
});

/** @type {Chain} */
export const arbitrum = defineCompatChain({
  id: 42161,
  name: 'Arbitrum One',
  network: 'arbitrum',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  blockTime: 250,
  rpcUrls: {
    public: {
      http: withPathRpc(42161, ARBITRUM_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(42161, ARBITRUM_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://arbiscan.io',
      apiUrl: 'https://api.arbiscan.io/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 7654707,
    },
  },
  testnet: false,
});

/** @type {Chain} */
export const arbitrumSepolia = defineCompatChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  network: 'arbitrum-sepolia',
  blockTime: 250,
  nativeCurrency: {
    name: 'Arbitrum Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    public: {
      http: withPathRpc(421614, ARBITRUM_SEPOLIA_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(421614, ARBITRUM_SEPOLIA_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io',
      apiUrl: 'https://api-sepolia.arbiscan.io/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 81930,
    },
  },
  testnet: true,
});

/** @type {Chain} */
export const mainnet = defineCompatChain({
  id: 1,
  name: 'Ethereum',
  network: 'mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  blockTime: 12_000,
  rpcUrls: {
    public: {
      http: withPathRpc(1, ETHEREUM_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(1, ETHEREUM_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://etherscan.io',
      apiUrl: 'https://api.etherscan.io/api',
    },
  },
  contracts: {
    ensUniversalResolver: {
      address: '0xeeeeeeee14d718c2b47d9923deab1335e144eeee',
      blockCreated: 23085558,
    },
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 14353601,
    },
  },
  testnet: false,
});

/** @type {Chain} */
export const polygon = defineCompatChain({
  id: 137,
  name: 'Polygon',
  network: 'polygon',
  blockTime: 2000,
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: {
    public: {
      http: withPathRpc(137, POLYGON_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(137, POLYGON_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://polygonscan.com',
      apiUrl: 'https://api.polygonscan.com/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 25770160,
    },
  },
  testnet: false,
});

/** @type {Chain} */
export const bsc = defineCompatChain({
  id: 56,
  name: 'BNB Smart Chain',
  network: 'bsc',
  blockTime: 750,
  nativeCurrency: {
    decimals: 18,
    name: 'BNB',
    symbol: 'BNB',
  },
  rpcUrls: {
    public: {
      http: withPathRpc(56, BSC_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(56, BSC_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'BscScan',
      url: 'https://bscscan.com',
      apiUrl: 'https://api.bscscan.com/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 15921452,
    },
  },
  testnet: false,
});

/** @type {Chain} */
export const celo = defineCompatChain({
  id: 42220,
  name: 'Celo',
  network: 'celo',
  blockTime: 5000,
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    public: {
      http: withPathRpc(42220, CELO_PUBLIC_RPC_URLS),
    },
    default: {
      http: withPathRpc(42220, CELO_PUBLIC_RPC_URLS),
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Celo Explorer',
      url: 'https://celoscan.io',
      apiUrl: 'https://api.celoscan.io/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 13112599,
    },
  },
  testnet: false,
});

/** @type {Chain} */
export const katana = defineCompatChain({
  id: 747474,
  name: 'Katana',
  network: 'katana',
  blockTime: 2000,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    public: {
      http: KATANA_PUBLIC_RPC_URLS,
    },
    default: {
      http: KATANA_PUBLIC_RPC_URLS,
    },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Katana Explorer',
      url: 'https://katanascan.com',
    },
  },
  testnet: false,
});

/** @type {Chain} */
export const anvil = defineCompatChain({
  id: 31337,
  name: 'Anvil',
  network: 'anvil',
  blockTime: 1000,
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['http://127.0.0.1:8545'] },
    default: { http: ['http://127.0.0.1:8545'] },
    wss: [],
  },
  blockExplorers: {
    default: {
      name: 'Anvil',
      url: 'http://127.0.0.1:8545',
    },
  },
  testnet: true,
});

export const chainRegistry = {
  1: mainnet,
  10: optimism,
  11155420: optimismSepolia,
  42161: arbitrum,
  421614: arbitrumSepolia,
  56: bsc,
  137: polygon,
  42220: celo,
  8453: base,
  84532: baseSepolia,
  31337: anvil,
  747474: katana,
};

const normalizeOptionalAddress = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || '';
};
const normalizeChainIdValue = (value: unknown): number | null => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const normalizeExplorerBaseUrl = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw.replace(/\/+$/, '') : '';
};
const buildExplorerEntityUrl = (chainId: unknown, segment: string, value: unknown): string | null => {
  const normalizedChainId = normalizeChainIdValue(chainId);
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedChainId || !normalizedValue) return null;
  const explorerBaseUrl = normalizeExplorerBaseUrl(getChainById(normalizedChainId)?.blockExplorers?.default?.url);
  if (!explorerBaseUrl) return null;
  return `${explorerBaseUrl}/${segment}/${normalizedValue}`;
};
const CHAINS_WITH_FAUCET_RPC_FALLBACK = new Set<number>([84532, 11155420]);

const LOCAL_CONTRACT_CHAIN_ID = Number(localContracts?.chainId || 0) || 0;
const normalizeLoopbackHost = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1');
const LOCAL_SESSION_REGISTRY_LIST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
export const isLocalDevLoopbackHost = (value) => LOCAL_SESSION_REGISTRY_LIST_HOSTS.has(normalizeLoopbackHost(value));
const LOCAL_SESSION_REGISTRY_ADDRESSES =
  LOCAL_CONTRACT_CHAIN_ID && normalizeOptionalAddress(localContracts?.SessionRegistry)
    ? { [LOCAL_CONTRACT_CHAIN_ID]: normalizeOptionalAddress(localContracts.SessionRegistry) }
    : {};
const LOCAL_SESSION_CONTRACTS_BY_CHAIN = LOCAL_CONTRACT_CHAIN_ID
  ? {
      [LOCAL_CONTRACT_CHAIN_ID]: {
        ...(normalizeOptionalAddress(localContracts?.Surveys)
          ? { surveys: normalizeOptionalAddress(localContracts.Surveys) }
          : {}),
        ...(normalizeOptionalAddress(localContracts?.SBTFactory)
          ? { sbtFactory: normalizeOptionalAddress(localContracts.SBTFactory) }
          : {}),
      },
    }
  : {};
const readIncludeLocalSessionRegistryFlag = () => {
  try {
    const g = runtimeGlobal();
    if (g && typeof g.CE_INCLUDE_LOCAL_SESSION_REGISTRY !== 'undefined') {
      return !!g.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  try {
    const hostname =
      typeof globalThis !== 'undefined' ? normalizeLoopbackHost(globalThis.location?.hostname || '') : '';
    return isLocalDevLoopbackHost(hostname);
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return false;
};
const shouldIncludeSessionRegistryChainInLists = (chainId: unknown): boolean => {
  const id = Number(chainId || 0) || 0;
  if (!LOCAL_CONTRACT_CHAIN_ID || id !== LOCAL_CONTRACT_CHAIN_ID) return true;
  return readIncludeLocalSessionRegistryFlag();
};

// Session registry + contract defaults are bundled client-side for now.
// TODO: Resolve from registry.contextengine.eth and <chainId>.contracts.contextengine.eth in the future.
export const SESSION_REGISTRY_ADDRESSES: Record<number, string> = Object.fromEntries(
  Object.entries({
    ...(contractsConfig.sessionRegistryAddresses || {}),
    ...LOCAL_SESSION_REGISTRY_ADDRESSES,
  }).map(([k, v]) => [Number(k), v]),
);

export const SESSION_CONTRACTS_BY_CHAIN: Record<number, UnknownRecord> = Object.fromEntries(
  Object.entries({
    ...(contractsConfig.sessionContractsByChain || {}),
    ...LOCAL_SESSION_CONTRACTS_BY_CHAIN,
  }).map(([k, v]) => [Number(k), v]),
);

export function getChainById(id) {
  return chainRegistry[id] || null;
}
export function getDefaultChainId() {
  return normalizeChainIdValue(DEFAULT_CHAIN_ID);
}
export function buildExplorerAddressUrl(chainId: unknown, address: unknown): string | null {
  return buildExplorerEntityUrl(chainId, 'address', address);
}
export function buildExplorerTxUrl(chainId: unknown, txHash: unknown): string | null {
  return buildExplorerEntityUrl(chainId, 'tx', txHash);
}
export function isChainWithFaucetRpcFallback(chainId: unknown): boolean {
  const id = normalizeChainIdValue(chainId);
  return !!id && CHAINS_WITH_FAUCET_RPC_FALLBACK.has(id);
}
export function getSessionRegistryAddress(chainId: unknown): string {
  const id = Number(chainId || 0) || 0;
  if (!shouldIncludeSessionRegistryChainInLists(id)) return '';
  return SESSION_REGISTRY_ADDRESSES?.[id] || '';
}
export function getSessionRegistryChains(): Array<CeChain & { registryAddress: string }> {
  return Object.entries(SESSION_REGISTRY_ADDRESSES || {})
    .map(([id, address]) => {
      if (!address) return null;
      if (!shouldIncludeSessionRegistryChainInLists(id)) return null;
      const chain = getChainById(Number(id));
      if (!chain) return null;
      return { ...chain, registryAddress: address };
    })
    .filter((chain): chain is CeChain & { registryAddress: string } => !!chain);
}
export function getSessionRegistryChainIds(): number[] {
  return Object.keys(SESSION_REGISTRY_ADDRESSES || {})
    .map((id) => Number(id))
    .filter((id) => id && SESSION_REGISTRY_ADDRESSES?.[id] && shouldIncludeSessionRegistryChainInLists(id));
}
export function getSessionContractsForChain(chainId: unknown): UnknownRecord {
  const id = Number(chainId || 0) || 0;
  if (!shouldIncludeSessionRegistryChainInLists(id)) return {};
  const contracts = SESSION_CONTRACTS_BY_CHAIN?.[id];
  return contracts && typeof contracts === 'object' ? { ...contracts } : {};
}
export function getChainBlockTimeMs(chainId: unknown): number {
  const chain = getChainById(Number(chainId || 0));
  const blockTime = Number(chain?.blockTime || 0);
  return Number.isFinite(blockTime) && blockTime > 0 ? blockTime : 12000;
}
export function getDefaultGasPriceGwei(id: unknown): string {
  const chain = getChainById(Number(id || 0));
  const configured = chain?.defaultGasPriceGwei;
  if (typeof configured === 'string' && configured.trim()) return configured.trim();
  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return String(configured);
  }
  return '0.08';
}
export function getDefaultHttpRpc(id, opts = {}) {
  const ch = chainRegistry[id];
  if (!ch) return null;
  const allowPath = opts?.allowPath !== false;

  // Note: chain objects are built with PATH RPCs already injected via withPathRpc(),
  // so when allowPath=false we must actively filter the PATH URL back out.
  const pathUrl = resolvePathRpcUrl(normalizedId);

  const candidates = normalizeRpcList([
    ...(Array.isArray(ch.rpcUrls?.public?.http) ? ch.rpcUrls.public.http : []),
    ...(Array.isArray(ch.rpcUrls?.default?.http) ? ch.rpcUrls.default.http : []),
  ]);

  if (allowPath && pathUrl) return pathUrl;

  const filtered = allowPath || !pathUrl ? candidates : candidates.filter((url) => url !== pathUrl);

  return filtered[0] || null;
}

// --- wagmi Chain adapters (DEFAULT_NETWORK / ch are wagmi Chain objects) ---
export const chainHexId = (ch) => '0x' + Number(ch?.id ?? 0).toString(16);

export const chainHttpRpc = (ch: unknown): string => {
  const id = Number(readRecord(ch, 'id') ?? 0);
  const pathUrl = resolvePathRpcUrl(id);
  if (pathUrl) return pathUrl;
  return ch?.rpcUrls?.public?.http?.[0] || ch?.rpcUrls?.default?.http?.[0] || '';
};

export const chainHttpRpcNoPath = (ch: unknown): string => {
  const id = Number(readRecord(ch, 'id') ?? 0);
  const pathUrl = resolvePathRpcUrl(id);
  const rpcUrls = asRecord(readRecord(ch, 'rpcUrls'));
  const publicRpcUrls = asRecord(readRecord(rpcUrls, 'public'));
  const defaultRpcUrls = asRecord(readRecord(rpcUrls, 'default'));
  const candidates = normalizeRpcList([
    ...readStringList(readRecord(publicRpcUrls, 'http')),
    ...readStringList(readRecord(defaultRpcUrls, 'http')),
  ]);
  const filtered = pathUrl ? candidates.filter((url) => url !== pathUrl) : candidates;
  return filtered[0] || '';
};
export const chainCurrency = (ch) => ch?.nativeCurrency ?? { name: 'ETH', symbol: 'ETH', decimals: 18 };
export const isTestnetChain = (ch) => {
  if (typeof ch?.testnet === 'boolean') return ch.testnet;
  const bag = [
    ch?.name,
    ch?.network,
    ch?.blockExplorers?.default?.url,
    ...(ch?.rpcUrls?.default?.http || []),
    ...(ch?.rpcUrls?.public?.http || []),
  ]
    .join(' ')
    .toLowerCase();
  return /sepolia|goerli|test|dev|holesky|mumbai|amoy|fuji|chiado/.test(bag);
};
