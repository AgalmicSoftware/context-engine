import {
  connectorsForWallets,
} from '@rainbow-me/rainbowkit';
import type { Wallet } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createClient, createStorage } from 'wagmi';
import { noopStorage } from '@wagmi/core';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { goerli, localhost } from 'wagmi/chains';
import {
  mainnet,
  base,
  optimism,
  arbitrum,
  baseSepolia,
  optimismSepolia,
  arbitrumSepolia,
} from '../../variables/chains.js'
import {
  getFallbackRpcUrlForChain,
  getPrimaryRpcUrlForChain,
} from '../../utilities/web3/rpcSelection.js';
import { wrapEthersJsonRpcSend } from '../../utilities/web3/rpcReadCache.js';
import { wasUserExplicitlyDisconnected } from '../../utilities/web3/wagmiDisconnectState.js';
import { CE_ENABLE_WALLETCONNECT_FALLBACK } from '../../variables/appConfig.js';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';

const buildBackoffJsonRpcProvider = (
  providerKey: string,
  resolveUrl: (chain: any) => string,
): any => {
  const baseProvider: any = jsonRpcProvider({
    rpc: (chain: any) => {
      const url = resolveUrl(chain);
      return url ? { http: url } : null;
    },
  });

  return (chain: any): any => {
    const config = typeof baseProvider === 'function' ? baseProvider(chain) : null;
    if (!config || typeof config.provider !== 'function') return config;
    const selectedUrl = (
      config?.chain?.rpcUrls?.default?.http?.[0]
      || config?.chain?.rpcUrls?.public?.http?.[0]
      || resolveUrl(chain)
      || ''
    );
    return {
      ...config,
      provider: (): any => wrapEthersJsonRpcSend(config.provider() as any, {
        chainId: Number(chain?.id || config?.chain?.id || 0) || 0,
        providerKey,
        providerLabel: providerKey,
        url: selectedUrl,
      }) as any,
    };
  };
};

const configuredChains = configureChains(
  [
    mainnet,
    base,
    optimism,
    arbitrum,
    baseSepolia,
    optimismSepolia,
    arbitrumSepolia,
    goerli,
    localhost,
  ],
  [
    // NOTE: `publicProvider()` is intentionally not used here.
    // We keep deterministic ordering by resolving primary/fallback RPC URLs ourselves
    // (from chains.js + chain rpcUrls public/default lists) via jsonRpcProvider.
    buildBackoffJsonRpcProvider('wagmi-primary', getPrimaryRpcUrlForChain),
    buildBackoffJsonRpcProvider('wagmi-fallback', getFallbackRpcUrlForChain),
  ]
);

export const { chains, provider, webSocketProvider } = configuredChains;

const buildMetaMaskWallet = (): Wallet => {
  const wallet = metaMaskWallet({ chains, shimDisconnect: true });
  if (CE_ENABLE_WALLETCONNECT_FALLBACK) return wallet;

  return {
    ...wallet,
    createConnector: () => ({
      connector: new MetaMaskConnector({
        chains,
        options: { shimDisconnect: true },
      }),
    }),
  };
};

const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
              buildMetaMaskWallet(),
    ],
  },]);

const userExplicitlyDisconnected = wasUserExplicitlyDisconnected();
const safeStorage = (() => {
  try {
    return window.localStorage;
  } catch (_) {
    return noopStorage;
  }
})();

export const wagmiClient = createClient({
  autoConnect: !userExplicitlyDisconnected,
  storage: createStorage({ storage: safeStorage }),
  connectors,
  provider,
  webSocketProvider
})
