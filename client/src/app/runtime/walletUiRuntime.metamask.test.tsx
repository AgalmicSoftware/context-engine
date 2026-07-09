import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MetaMaskLoginButton, WalletUiProvider } from './walletUiRuntime.metamask';

jest.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAccountModal: () => ({ openAccountModal: jest.fn() }),
  useChainModal: () => ({ openChainModal: jest.fn() }),
  useConnectModal: () => ({ openConnectModal: jest.fn() }),
}));

describe('MetaMask wallet UI profile', () => {
  it('renders the MetaMask login control only in the opt-in UI module', () => {
    const onClick = jest.fn();

    render(
      <WalletUiProvider chains={[]}>
        <MetaMaskLoginButton className="login-link" iconClassName="login-icon" onClick={onClick} />
      </WalletUiProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Crypto Login (RainbowKit)' }));

    expect(screen.getByAltText('MetaMask')).toHaveClass('login-icon');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
