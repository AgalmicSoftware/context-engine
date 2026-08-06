import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  getSessionWizardContractModalTriggerTestId,
  getSessionWizardContractRowTestId,
  getSessionWizardContractTooltipTestId,
} from '../DocsPage/contractMetadata.js';
import SessionWizardContractsField from './SessionWizardContractsField';

describe('SessionWizardContractsField', () => {
  const renderField = (props = {}) => {
    const onAddressChange = jest.fn();
    const onOpenContractViewer = jest.fn();
    const onToggleCollapsed = jest.fn();
    const renderInfoTooltip = jest.fn(({ testId, ariaLabel }) => <span data-testid={testId} aria-label={ariaLabel} />);

    render(
      <SessionWizardContractsField
        title="Smart contracts"
        contracts={{ surveys: { address: '0x111' }, sbtFactory: {} }}
        defaults={{ surveys: '0xaaa', sbtFactory: '0xbbb' }}
        visibleKeys={['surveys', 'sbtFactory']}
        isCollapsed={false}
        onAddressChange={onAddressChange}
        onOpenContractViewer={onOpenContractViewer}
        onToggleCollapsed={onToggleCollapsed}
        renderInfoTooltip={renderInfoTooltip}
        {...props}
      />,
    );

    return {
      onAddressChange,
      onOpenContractViewer,
      onToggleCollapsed,
      renderInfoTooltip,
    };
  };

  it('renders contract rows with explicit and default addresses', () => {
    renderField();

    const surveysRow = screen.getByTestId(getSessionWizardContractRowTestId('surveys'));
    const factoryRow = screen.getByTestId(getSessionWizardContractRowTestId('sbtFactory'));

    expect(within(surveysRow).getByDisplayValue('0x111')).toBeInTheDocument();
    expect(within(factoryRow).getByDisplayValue('0xbbb')).toBeInTheDocument();
    expect(screen.getByTestId(getSessionWizardContractTooltipTestId('surveys'))).toBeInTheDocument();
  });

  it('routes address edits and contract modal opens through parent callbacks', () => {
    const { onAddressChange, onOpenContractViewer } = renderField();

    fireEvent.change(
      within(screen.getByTestId(getSessionWizardContractRowTestId('surveys'))).getByDisplayValue('0x111'),
      { target: { value: '0x222' } },
    );
    fireEvent.click(screen.getByTestId(getSessionWizardContractModalTriggerTestId('sbtFactory')));

    expect(onAddressChange).toHaveBeenCalledWith('surveys', '0x222');
    expect(onOpenContractViewer).toHaveBeenCalledWith('sbtFactory');
  });

  it('keeps collapse ownership in the parent callback', () => {
    const { onToggleCollapsed } = renderField({ isCollapsed: true });

    fireEvent.click(screen.getByRole('button', { name: 'Smart contracts expand' }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(getSessionWizardContractRowTestId('surveys'))).not.toBeInTheDocument();
  });
});
