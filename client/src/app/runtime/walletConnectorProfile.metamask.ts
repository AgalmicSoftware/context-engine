import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import type { Wallet } from '@rainbow-me/rainbowkit';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { CE_ENABLE_WALLETCONNECT_FALLBACK } from '../../variables/appConfig.js';

type SupportedChains = Parameters<typeof metaMaskWallet>[0]['chains'];

const buildMetaMaskWallet = (chains: SupportedChains): Wallet => {
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

export const buildWalletConnectors = (chains: SupportedChains) =>
  connectorsForWallets([
    {
      groupName: 'Recommended',
      wallets: [buildMetaMaskWallet(chains)],
    },
  ]);
