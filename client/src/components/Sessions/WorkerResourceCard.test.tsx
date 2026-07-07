import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerResourceCard from './WorkerResourceCard';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('../Gates/GateMultiSelectLock', () => ({
  __esModule: true,
  default: ({
    onChangeSelectedGateIds,
    onToggleOpen,
  }: {
    onChangeSelectedGateIds: (nextIds: string[]) => void;
    onToggleOpen: (nextOpen: boolean) => void;
  }) => (
    <div data-testid="mock-resource-gate-lock">
      <button type="button" data-testid="mock-resource-gate-change" onClick={() => onChangeSelectedGateIds(['gate-b'])}>
        change
      </button>
      <button type="button" data-testid="mock-resource-gate-open" onClick={() => onToggleOpen(true)}>
        open
      </button>
    </div>
  ),
}));

describe('WorkerResourceCard', () => {
  it('renders the resource card shell with stable test hooks', () => {
    const onChangeSelectedGateIds = jest.fn();
    const onToggleOpen = jest.fn();

    render(
      <WorkerResourceCard
        resourceKey="ai"
        label="AI"
        tooltipText="AI info"
        renderInfoTooltip={({ testId }) => <button type="button" data-testid={testId} />}
        gateOptions={[{ id: 'gate-a' }, { id: 'gate-b' }]}
        selectedGateIds={['gate-a']}
        onChangeSelectedGateIds={onChangeSelectedGateIds}
        open={false}
        onToggleOpen={onToggleOpen}
        disabled={false}
      >
        <div>resource inputs</div>
      </WorkerResourceCard>,
    );

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_RESOURCE_CARD)).toHaveAttribute('data-ce-resource-key', 'ai');
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-resource-tooltip-ai')).toBeInTheDocument();
    expect(screen.getByText('resource inputs')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mock-resource-gate-change'));
    expect(onChangeSelectedGateIds).toHaveBeenCalledWith(['gate-b']);

    fireEvent.click(screen.getByTestId('mock-resource-gate-open'));
    expect(onToggleOpen).toHaveBeenCalledWith(true);
  });
});
