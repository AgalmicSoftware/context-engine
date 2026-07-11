import React from 'react';

type WalletUiProviderProps = {
  children: React.ReactNode;
  chains: unknown;
};

type MetaMaskLoginButtonProps = {
  className: string;
  iconClassName: string;
  onClick: () => void;
};

export type WalletModalOpener = (() => void) | undefined;

export const WalletUiProvider = ({ children }: WalletUiProviderProps) => <>{children}</>;

export const MetaMaskLoginButton = (_props: MetaMaskLoginButtonProps) => null;

export const useConnectModal = (): { openConnectModal: WalletModalOpener } => ({ openConnectModal: undefined });
export const useAccountModal = (): { openAccountModal: WalletModalOpener } => ({ openAccountModal: undefined });
export const useChainModal = (): { openChainModal: WalletModalOpener } => ({ openChainModal: undefined });
