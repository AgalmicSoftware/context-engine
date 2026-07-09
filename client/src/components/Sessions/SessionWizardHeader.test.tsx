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

  it('renders the default mode controls and forwards mode clicks', () => {
    render(<SessionWizardHeader {...baseProps} wizardMode="normal" />);

    expect(screen.getByRole('heading', { name: 'Session Setup' })).toBeInTheDocument();
    expect(screen.queryByText('Advanced mode shows the full session configuration.')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED)).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL));

    expect(baseProps.onEnterAdvancedMode).toHaveBeenCalledTimes(1);
    expect(baseProps.onEnterNormalMode).toHaveBeenCalledTimes(1);
  });

  it('renders sponsored display settings without changing the mode test ids', () => {
    render(<SessionWizardHeader {...baseProps} hasSponsoredBundleLink wizardDisplaySettingsOpen />);

    const settingsButton = screen.getByRole('button', { name: 'Session wizard display settings' });
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Session wizard display settings' })).toBeInTheDocument();
    expect(screen.getByText('Display mode')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL)).toBeInTheDocument();

    fireEvent.click(settingsButton);
    fireEvent.click(screen.getByRole('button', { name: 'Close session wizard display settings' }));

    expect(baseProps.onToggleDisplaySettings).toHaveBeenCalledTimes(1);
    expect(baseProps.onCloseDisplaySettings).toHaveBeenCalledTimes(1);
  });

  it('renders the advanced hint and network selector boundary', () => {
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

    expect(screen.getByText('Advanced mode shows the full session configuration.')).toBeInTheDocument();
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
