import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionWizardRequirementsBanner, { SESSION_WIZARD_REQUIREMENT_LINKS } from './SessionWizardRequirementsBanner';

describe('SessionWizardRequirementsBanner', () => {
  it('renders the setup requirement links and dismiss action', () => {
    const onDismiss = jest.fn();

    render(
      <SessionWizardRequirementsBanner
        fundingRequirementHref={SESSION_WIZARD_REQUIREMENT_LINKS.optimismSepoliaFaucet}
        fundingRequirementLabel="OP Sepolia ETH for on-chain registration"
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenAI API key' })).toHaveAttribute(
      'href',
      SESSION_WIZARD_REQUIREMENT_LINKS.openaiApiKey,
    );
    expect(screen.getByRole('link', { name: 'Lit API key' })).toHaveAttribute(
      'href',
      SESSION_WIZARD_REQUIREMENT_LINKS.litApiKeys,
    );
    expect(screen.getByRole('link', { name: 'Arweave wallet (JWK)' })).toHaveAttribute(
      'href',
      SESSION_WIZARD_REQUIREMENT_LINKS.arweaveWallet,
    );
    expect(screen.getByRole('link', { name: 'OP Sepolia ETH for on-chain registration' })).toHaveAttribute(
      'href',
      SESSION_WIZARD_REQUIREMENT_LINKS.optimismSepoliaFaucet,
    );
    expect(screen.getByText('(Optional) A faucet private key for sponsoring user gas')).toBeInTheDocument();
    expect(screen.getByText('A turnkey tool for bundling these resources is in development.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contextengine@protonmail.com' })).toHaveAttribute(
      'href',
      'mailto:contextengine@protonmail.com',
    );

    fireEvent.click(screen.getByRole('button', { name: /dismiss session setup requirements/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders the no-Lit-key and plain funding fallbacks', () => {
    render(
      <SessionWizardRequirementsBanner
        fundingRequirementLabel="Anvil ETH for on-chain registration"
        newSessionRequiresLitCredential={false}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Lit API key' })).not.toBeInTheDocument();
    expect(
      screen.getByText('No Lit key is required for Cloudflare worker-enforced SBT access control'),
    ).toBeInTheDocument();
    expect(screen.getByText('Anvil ETH for on-chain registration')).toBeInTheDocument();
  });

  it('renders exactly the two profile-derived Cloudflare requirements without not-required notices', () => {
    render(
      <SessionWizardRequirementsBanner
        fundingRequirementLabel="OP Sepolia ETH"
        onDismiss={jest.fn()}
        requiredRequirementIds={['cloudflareApiToken', 'aiProviderKey']}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Cloudflare API token' })).toHaveAttribute(
      'href',
      SESSION_WIZARD_REQUIREMENT_LINKS.cloudflareApiTokens,
    );
    expect(screen.getByRole('link', { name: 'AI provider key' })).toBeInTheDocument();
    expect(screen.queryByText(/Arweave|Lit|RPC|wallet|faucet|funding|gas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not required/i)).not.toBeInTheDocument();
  });

  it('preserves explicit decentralized and Lit requirements without the legacy faucet notice', () => {
    const { rerender } = render(
      <SessionWizardRequirementsBanner
        fundingRequirementHref={SESSION_WIZARD_REQUIREMENT_LINKS.optimismSepoliaFaucet}
        fundingRequirementLabel="OP Sepolia ETH"
        onDismiss={jest.fn()}
        requiredRequirementIds={['aiProviderKey', 'arweaveJwk', 'rpc', 'wallet', 'funding']}
      />,
    );

    expect(screen.getByRole('link', { name: 'Arweave wallet (JWK)' })).toBeInTheDocument();
    expect(screen.getByText(/RPC URL or provider key/i)).toBeInTheDocument();
    expect(screen.getByText(/connected wallet/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lit API key' })).not.toBeInTheDocument();
    expect(screen.queryByText(/faucet private key/i)).not.toBeInTheDocument();

    rerender(
      <SessionWizardRequirementsBanner
        fundingRequirementHref={SESSION_WIZARD_REQUIREMENT_LINKS.optimismSepoliaFaucet}
        fundingRequirementLabel="OP Sepolia ETH"
        onDismiss={jest.fn()}
        requiredRequirementIds={['aiProviderKey', 'arweaveJwk', 'rpc', 'wallet', 'funding', 'lit']}
      />,
    );
    expect(screen.getByRole('link', { name: 'Lit API key' })).toBeInTheDocument();
  });
});
