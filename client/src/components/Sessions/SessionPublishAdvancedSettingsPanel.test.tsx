import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionPublishAdvancedSettingsPanel from './SessionPublishAdvancedSettingsPanel';

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof SessionPublishAdvancedSettingsPanel>> = {},
): React.ComponentProps<typeof SessionPublishAdvancedSettingsPanel> => ({
  manualGasLimit: '',
  manualGasPriceGwei: '',
  manualMaxFeePerGasGwei: '',
  manualMaxPriorityFeePerGasGwei: '',
  manualMetadataUrl: '',
  onManualGasLimitChange: jest.fn(),
  onManualGasPriceGweiChange: jest.fn(),
  onManualMaxFeePerGasGweiChange: jest.fn(),
  onManualMaxPriorityFeePerGasGweiChange: jest.fn(),
  onManualMetadataUrlChange: jest.fn(),
  renderInfoTooltip: (options) => <span data-testid={String(options.testId)}>{String(options.ariaLabel)}</span>,
  resolvedWorkerBaseUrl: '',
  workerUrlSource: 'manual',
  ...overrides,
});

describe('SessionPublishAdvancedSettingsPanel', () => {
  it('renders the selected upload worker and tooltip-backed manual controls', () => {
    render(
      <SessionPublishAdvancedSettingsPanel
        {...buildProps({
          manualGasLimit: '900000',
          manualMetadataUrl: 'ar://manual-metadata-tx',
          resolvedWorkerBaseUrl: 'https://worker.example.test',
          workerUrlSource: 'custom worker URL',
        })}
      />,
    );

    expect(
      screen.getByText('Arweave upload worker: https://worker.example.test (custom worker URL)'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ar://<txId> or https://arweave.net/<txId>')).toHaveValue(
      'ar://manual-metadata-tx',
    );
    expect(screen.getByPlaceholderText('1000000')).toHaveValue(900000);
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-tip-gas-limit')).toHaveTextContent(
      'Gas limit override info',
    );
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-tip-gas-price')).toHaveTextContent(
      'Gas price override info',
    );
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-tip-max-fee')).toHaveTextContent('Max fee per gas info');
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-tip-max-priority')).toHaveTextContent(
      'Max priority fee per gas info',
    );
  });

  it('routes every manual override through explicit callbacks only', () => {
    const onManualGasLimitChange = jest.fn();
    const onManualGasPriceGweiChange = jest.fn();
    const onManualMaxFeePerGasGweiChange = jest.fn();
    const onManualMaxPriorityFeePerGasGweiChange = jest.fn();
    const onManualMetadataUrlChange = jest.fn();

    render(
      <SessionPublishAdvancedSettingsPanel
        {...buildProps({
          onManualGasLimitChange,
          onManualGasPriceGweiChange,
          onManualMaxFeePerGasGweiChange,
          onManualMaxPriorityFeePerGasGweiChange,
          onManualMetadataUrlChange,
        })}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('ar://<txId> or https://arweave.net/<txId>'), {
      target: { value: 'ar://metadata-tx' },
    });
    fireEvent.change(screen.getByPlaceholderText('1000000'), {
      target: { value: '1200000' },
    });
    const blankGasInputs = screen.getAllByPlaceholderText('(leave blank)');
    fireEvent.change(blankGasInputs[0], { target: { value: '1.5' } });
    fireEvent.change(blankGasInputs[1], { target: { value: '2.5' } });
    fireEvent.change(blankGasInputs[2], { target: { value: '0.5' } });

    expect(onManualMetadataUrlChange).toHaveBeenCalledWith('ar://metadata-tx');
    expect(onManualGasLimitChange).toHaveBeenCalledWith('1200000');
    expect(onManualGasPriceGweiChange).toHaveBeenCalledWith('1.5');
    expect(onManualMaxFeePerGasGweiChange).toHaveBeenCalledWith('2.5');
    expect(onManualMaxPriorityFeePerGasGweiChange).toHaveBeenCalledWith('0.5');
  });

  it('labels an empty worker URL without affecting manual control rendering', () => {
    render(<SessionPublishAdvancedSettingsPanel {...buildProps()} />);

    expect(screen.getByText('Arweave upload worker: Not set (manual)')).toBeInTheDocument();
    expect(screen.getByText('Manual metadata URI (optional)')).toBeInTheDocument();
  });

  it('hides Arweave and gas settings when the profile resolver disables both capabilities', () => {
    render(
      <SessionPublishAdvancedSettingsPanel
        {...buildProps({
          publishSettingsCapabilities: {
            showArweaveMetadataControls: false,
            showGasOverrideControls: false,
          },
        })}
      />,
    );

    expect(screen.queryByText(/Arweave upload worker:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Manual metadata URI (optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Gas limit override')).not.toBeInTheDocument();
    expect(screen.queryByText('Gas price override (gwei, legacy)')).not.toBeInTheDocument();
    expect(screen.queryByText('Max fee per gas (gwei)')).not.toBeInTheDocument();
    expect(screen.queryByText('Max priority fee per gas (gwei)')).not.toBeInTheDocument();
  });
});
