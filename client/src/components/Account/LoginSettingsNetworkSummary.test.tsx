import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { LoginSettingsInlineNetworkSummary, LoginSettingsPanelNetworkSummary } from './LoginSettingsNetworkSummary';

describe('LoginSettingsNetworkSummary', () => {
  it('renders inline target and wallet network labels', () => {
    render(
      <LoginSettingsInlineNetworkSummary
        targetNetworkName="OP Sepolia"
        walletNetworkName="Base Sepolia"
        showWalletNetwork
        tooltipId="inline-network-tooltip"
      />,
    );

    expect(screen.getByText('network:')).toBeInTheDocument();
    expect(screen.getByText('OP Sepolia')).toBeInTheDocument();
    expect(screen.getByText('wallet:')).toBeInTheDocument();
    expect(screen.getByText('Base Sepolia')).toBeInTheDocument();
  });

  it('renders panel switch action when the wallet is on the wrong network', () => {
    const onSwitchNetwork = jest.fn();
    render(
      <LoginSettingsPanelNetworkSummary
        targetNetwork={{ name: 'OP Sepolia' }}
        targetNetworkName="OP Sepolia"
        walletNetworkName="Base Sepolia"
        showWalletNetwork
        needsNetworkSwitch
        tooltipId="panel-network-tooltip"
        onSwitchNetwork={onSwitchNetwork}
      />,
    );

    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to OP Sepolia' }));

    expect(onSwitchNetwork).toHaveBeenCalledTimes(1);
  });
});
