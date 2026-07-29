import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
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
        cloudflareTokenSlug="onboarding-demo"
        fundingRequirementLabel="OP Sepolia ETH"
        onDismiss={jest.fn()}
        requiredRequirementIds={['cloudflareApiToken', 'aiProviderKey']}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const cloudflareTokenLink = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_TOKEN_ONBOARDING_LINK);
    expect(cloudflareTokenLink).toHaveAccessibleName('Cloudflare API token');
    expect(cloudflareTokenLink).toHaveAttribute('target', '_blank');
    expect(cloudflareTokenLink).toHaveAttribute('rel', 'noopener noreferrer');
    const cloudflareTokenUrl = new URL(String(cloudflareTokenLink.getAttribute('href')));
    expect(cloudflareTokenUrl.origin).toBe('https://dash.cloudflare.com');
    expect(cloudflareTokenUrl.pathname).toBe('/profile/api-tokens');
    expect(cloudflareTokenUrl.searchParams.get('accountId')).toBe('*');
    expect(cloudflareTokenUrl.searchParams.get('zoneId')).toBe('all');
    expect(cloudflareTokenUrl.searchParams.get('name')).toContain('onboarding-demo');
    expect(JSON.parse(cloudflareTokenUrl.searchParams.get('permissionGroupKeys') || '[]')).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
    ]);
    expect(
      screen.getByText(/if you're already logged into Cloudflare, this link opens a token form/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/permissions prefilled/i)).toBeInTheDocument();
    expect(screen.getByText(/copy it into the Worker step/i)).toBeInTheDocument();
    expect(screen.queryByText(/Under Account Resources, choose only the account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/earliest expiration Cloudflare permits/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/revoke it after deployment succeeds or you abandon the attempt/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Token setup and security guide' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/session-cors-worker.md#api-token-setup-and-handling',
    );
    expect(screen.getByRole('link', { name: 'AI provider key' })).toBeInTheDocument();
    expect(screen.queryByText(/Arweave|Lit|RPC|wallet|faucet|funding|gas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/turnkey tool/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'contextengine@protonmail.com' })).not.toBeInTheDocument();
  });

  it('renders the native Cloudflare account requirement as a concise dashboard link', () => {
    render(
      <SessionWizardRequirementsBanner
        fundingRequirementLabel="OP Sepolia ETH"
        onDismiss={jest.fn()}
        requiredRequirementIds={['cloudflareAccount', 'aiProviderKey']}
      />,
    );

    const cloudflareAccount = screen.getByRole('link', { name: 'Cloudflare account' });
    expect(cloudflareAccount).toHaveAttribute('href', SESSION_WIZARD_REQUIREMENT_LINKS.cloudflareAccount);
    expect(cloudflareAccount).toHaveAttribute('target', '_blank');
    expect(cloudflareAccount).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText(/Worker step deploys the full Session Worker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Context Engine deploy helper/i)).not.toBeInTheDocument();
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
    expect(screen.getByText(/turnkey tool/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contextengine@protonmail.com' })).toBeInTheDocument();

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

  it('describes the wallet as an SBT publishing requirement when that is the transaction purpose', () => {
    render(
      <SessionWizardRequirementsBanner
        fundingRequirementLabel="OP Sepolia ETH for on-chain SBT publishing"
        onDismiss={jest.fn()}
        requiredRequirementIds={['aiProviderKey', 'rpc', 'wallet', 'funding']}
      />,
    );

    expect(screen.getByText('A connected wallet for on-chain SBT publishing')).toBeInTheDocument();
    expect(screen.queryByText('A connected wallet for on-chain registration')).not.toBeInTheDocument();
  });

  it('describes Worker Lit or existing SBT RPC as read-only when no transaction inputs are required', () => {
    render(
      <SessionWizardRequirementsBanner
        fundingRequirementLabel="OP Sepolia ETH for on-chain SBT publishing"
        onDismiss={jest.fn()}
        requiredRequirementIds={['aiProviderKey', 'rpc', 'lit']}
      />,
    );

    expect(screen.getByText(/RPC URL or provider key for read-only access checks or encryption/i)).toBeInTheDocument();
    expect(screen.getByText(/no on-chain publishing transaction is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/on-chain reads and publishing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connected wallet/i)).not.toBeInTheDocument();
  });
});
