import React from 'react';
import {
  RainbowKitProvider,
  useAccountModal as useRainbowKitAccountModal,
  useChainModal as useRainbowKitChainModal,
  useConnectModal as useRainbowKitConnectModal,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import MetaMaskLogo from 'assets/img/metamask_icon_white.png';

type WalletUiProviderProps = React.ComponentProps<typeof RainbowKitProvider>;

type MetaMaskLoginButtonProps = {
  className: string;
  iconClassName: string;
  onClick: () => void;
};

export const WalletUiProvider = ({ children, chains }: WalletUiProviderProps) => (
  <RainbowKitProvider chains={chains}>{children}</RainbowKitProvider>
);

export const MetaMaskLoginButton = ({ className, iconClassName, onClick }: MetaMaskLoginButtonProps) => (
  <button type="button" aria-label="Open Crypto Login (RainbowKit)" onClick={onClick} className={className}>
    <img src={MetaMaskLogo} alt="MetaMask" className={iconClassName} />
  </button>
);

export const useConnectModal = useRainbowKitConnectModal;
export const useAccountModal = useRainbowKitAccountModal;
export const useChainModal = useRainbowKitChainModal;
