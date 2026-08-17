import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ContractsSection from './ContractsSection';
import type { ContractsSectionProps } from './ContractsSection';
import { getSessionWizardContractRowTestId } from '../DocsPage/contractMetadata.js';

const contracts = {
  surveys: { address: '0x111' },
  sessionRegistry: { address: '0x222' },
};
const defaults = {
  surveys: '0xaaa',
  sessionRegistry: '0xbbb',
};

const renderContractsSection = (props: Partial<ContractsSectionProps> = {}) => {
  const renderContractEntry =
    props.renderContractEntry ||
    ((contractKey: string) => (
      <div key={contractKey} data-testid={getSessionWizardContractRowTestId(contractKey)}>
        {contractKey}
      </div>
    ));

  return render(
    <ContractsSection
      title="Smart contracts"
      contracts={contracts}
      defaults={defaults}
      visibleKeys={['surveys', 'sessionRegistry']}
      isCollapsed={false}
      onToggleCollapsed={() => {}}
      toggleAriaLabel="Smart contracts collapse"
      renderContractEntry={renderContractEntry}
      {...props}
    />,
  );
};

describe('ContractsSection', () => {
  it('renders the contracts grid with row entries from the renderer', () => {
    renderContractsSection();

    expect(screen.getByText('Smart contracts')).toBeInTheDocument();
    expect(screen.getByTestId(getSessionWizardContractRowTestId('surveys'))).toBeInTheDocument();
    expect(screen.getByTestId(getSessionWizardContractRowTestId('sessionRegistry'))).toBeInTheDocument();
  });

  it('calls onToggleCollapsed from the header toggle', () => {
    const onToggleCollapsed = jest.fn();
    renderContractsSection({ onToggleCollapsed });

    fireEvent.click(screen.getByRole('button', { name: 'Smart contracts collapse' }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('passes contract data through to renderContractEntry', () => {
    const renderContractEntry = jest.fn((contractKey) => (
      <div key={contractKey} data-testid={getSessionWizardContractRowTestId(contractKey)} />
    ));
    renderContractsSection({ renderContractEntry });

    expect(renderContractEntry).toHaveBeenCalledWith('surveys', contracts, defaults);
    expect(renderContractEntry).toHaveBeenCalledWith('sessionRegistry', contracts, defaults);
  });

  it('renders the empty state when there are no visible contracts', () => {
    renderContractsSection({
      contracts: null,
      visibleKeys: [],
    });

    expect(screen.getByText('No contract defaults available for this chain.')).toBeInTheDocument();
    expect(screen.queryByTestId(getSessionWizardContractRowTestId('surveys'))).not.toBeInTheDocument();
  });

  it('hides contract entries while collapsed', () => {
    renderContractsSection({ isCollapsed: true, toggleAriaLabel: 'Smart contracts expand' });

    expect(screen.getByRole('button', { name: 'Smart contracts expand' })).toBeInTheDocument();
    expect(screen.queryByTestId(getSessionWizardContractRowTestId('surveys'))).not.toBeInTheDocument();
  });
});
