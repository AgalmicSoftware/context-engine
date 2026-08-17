import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionWizardHeader from './SessionWizardHeader';

const baseProps = {
  onCloseDisplaySettings: jest.fn(),
  onEnterAdvancedMode: jest.fn(),
  onEnterNormalMode: jest.fn(),
  onRegistryChainIdChange: jest.fn(),
  onToggleDisplaySettings: jest.fn(),
  renderInfoTooltip: ({ testId, ariaLabel }: Record<string, unknown>) => (
    <button type="button" data-testid={String(testId)} aria-label={String(ariaLabel)} />
  ),
};

describe('SessionWizardHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the profile control without a duplicate Normal or Advanced switch', () => {
    render(
      <SessionWizardHeader
        {...baseProps}
        sessionModeProfileControl={<div data-testid="hosting-profile-control">hosting selector</div>}
        sessionModeProfileLabel="Cloudflare"
        wizardMode="normal"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Session Setup (Cloudflare)' })).toBeInTheDocument();
    const hostingControl = screen.getByTestId('hosting-profile-control');
    expect(hostingControl).toBeInTheDocument();
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL)).not.toBeInTheDocument();
  });

  it('gives the initial profile cards the full header surface before setup continues', () => {
    render(
      <SessionWizardHeader
        {...baseProps}
        sessionModeProfileControl={<div data-testid="hosting-profile-control">hosting cards</div>}
        sessionModeProfileSelectionStep
      />,
    );

    expect(screen.getByRole('heading', { name: 'Session Setup' })).toBeInTheDocument();
    expect(screen.getByTestId('hosting-profile-control')).toHaveTextContent('hosting cards');
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED)).not.toBeInTheDocument();
  });

  it('does not reintroduce a display-mode menu for sponsored setup links', () => {
    render(<SessionWizardHeader {...baseProps} hasSponsoredBundleLink wizardDisplaySettingsOpen />);

    expect(screen.queryByRole('button', { name: 'Session wizard display settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Session wizard display settings' })).not.toBeInTheDocument();
    expect(screen.queryByText('Display mode')).not.toBeInTheDocument();
  });

  it('renders the custom network selector without an Advanced-mode label', () => {
    render(
      <SessionWizardHeader
        {...baseProps}
        isNormalMode={false}
        registryAddress="0xRegistry"
        registryChainId={84532}
        registryChainOptions={[
          { id: 84532, name: 'Base Sepolia' },
          { id: 11155420, name: 'OP Sepolia' },
        ]}
        wizardMode="advanced"
      />,
    );

    expect(screen.queryByText(/Advanced mode/i)).not.toBeInTheDocument();
    const chainSelector = screen.getByText('Network:').parentElement;
    expect(chainSelector).toBeTruthy();
    expect(within(chainSelector as HTMLElement).getByRole('combobox')).toHaveValue('84532');
    expect(screen.getByDisplayValue('Base Sepolia (84532)')).toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-tooltip-gw-registry-chain')).toBeInTheDocument();

    fireEvent.change(within(chainSelector as HTMLElement).getByRole('combobox'), {
      target: { value: '11155420' },
    });

    expect(baseProps.onRegistryChainIdChange).toHaveBeenCalledWith('11155420');
  });

  it('preserves the network fallback label when no registry options are available', () => {
    render(
      <SessionWizardHeader
        {...baseProps}
        isNormalMode={false}
        registryChainId={31337}
        registryChainName="Anvil"
        registryChainOptions={[]}
        wizardMode="advanced"
      />,
    );

    expect(screen.getByDisplayValue('Anvil')).toBeInTheDocument();
  });
});
