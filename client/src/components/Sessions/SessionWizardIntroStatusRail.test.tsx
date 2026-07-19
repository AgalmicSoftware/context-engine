import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionWizardIntroStatusRail from './SessionWizardIntroStatusRail';

const normalModeCards = [
  {
    key: 'metadata' as const,
    title: 'Session Details',
    summary: 'Demo session',
    tone: 'ready' as const,
    stepNumber: 1,
  },
  {
    key: 'worker' as const,
    title: 'Worker',
    summary: 'Custom worker ready.',
    tone: 'pending' as const,
    stepNumber: 2,
  },
];

describe('SessionWizardIntroStatusRail', () => {
  it('renders requirement, sponsored status, and normal mode rail sections with callbacks', () => {
    const onDismissRequirements = jest.fn();
    const onFocusNormalModeSection = jest.fn();
    const onRetrySponsoredBundle = jest.fn();

    render(
      <SessionWizardIntroStatusRail
        activeNormalModeIndex={1}
        collapsedSections={{ metadata: false, worker: true }}
        fundingRequirementHref="https://faucet.example.test"
        fundingRequirementLabel="OP Sepolia ETH"
        isNormalMode
        newSessionRequiresLitCredential
        normalModeCards={normalModeCards}
        onDismissRequirements={onDismissRequirements}
        onFocusNormalModeSection={onFocusNormalModeSection}
        onRetrySponsoredBundle={onRetrySponsoredBundle}
        requiredRequirementIds={['cloudflareApiToken', 'aiProviderKey']}
        showNewSessionRequirementsBanner
        sponsoredBundleStatus={{
          message: 'Sponsored bundle loaded.',
          retryable: true,
          tone: 'success',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cloudflare API token' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI provider key' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'OP Sepolia ETH' })).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent('Sponsored bundle loaded.');
    expect(screen.getByRole('button', { name: 'Step 1: Session Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 2: Worker' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss session setup requirements/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Step 2: Worker' }));

    expect(onDismissRequirements).toHaveBeenCalledTimes(1);
    expect(onRetrySponsoredBundle).toHaveBeenCalledTimes(1);
    expect(onFocusNormalModeSection).toHaveBeenCalledWith('worker');
  });

  it('omits optional intro sections outside normal mode', () => {
    render(
      <SessionWizardIntroStatusRail
        activeNormalModeIndex={0}
        collapsedSections={{}}
        fundingRequirementLabel="Anvil ETH"
        isNormalMode={false}
        normalModeCards={normalModeCards}
        onDismissRequirements={jest.fn()}
        onFocusNormalModeSection={jest.fn()}
        onRetrySponsoredBundle={jest.fn()}
        showNewSessionRequirementsBanner={false}
        sponsoredBundleStatus={null}
      />,
    );

    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Normal mode sections' })).not.toBeInTheDocument();
  });
});
