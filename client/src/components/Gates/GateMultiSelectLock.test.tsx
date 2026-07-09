import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GateMultiSelectLock from './GateMultiSelectLock';
import styles from './GateMultiSelectLock.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

jest.mock('../../utilities/sbt/sbtDisplayNames.js', () => ({
  resolveSbtDisplayLabel: jest.fn(({ address }: { address?: string }) =>
    String(address || '').toLowerCase() === '0x1111111111111111111111111111111111111111' ? 'VIP Pass' : '',
  ),
}));

const gateOptions = [
  { id: 'alpha', label: 'Alpha', color: '#5affc2' },
  { id: 'beta', label: 'Beta', color: '#5b8cff' },
];

describe('GateMultiSelectLock', () => {
  it('uses full opacity only while the gate picker is open', () => {
    const props = {
      gateOptions,
      selectedGateIds: ['alpha'],
      onChangeSelectedGateIds: jest.fn(),
      onToggleOpen: jest.fn(),
      disabled: false,
      showDots: false,
    };

    const { rerender } = render(<GateMultiSelectLock {...props} open={false} />);

    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).not.toHaveClass(styles.open);
    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /gate details/i })).not.toBeInTheDocument();

    rerender(<GateMultiSelectLock {...props} open={true} />);

    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toHaveClass(styles.open);
    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER)).toBeInTheDocument();
  });

  it('requests the popover to open when the closed button is clicked', () => {
    const onToggleOpen = jest.fn();

    render(
      <GateMultiSelectLock
        gateOptions={gateOptions}
        selectedGateIds={[]}
        onChangeSelectedGateIds={jest.fn()}
        open={false}
        onToggleOpen={onToggleOpen}
        disabled={false}
        showDots={false}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON));

    expect(onToggleOpen).toHaveBeenCalledWith(true);
  });

  it('uses the current aria-label contract for unlocked and locked states', () => {
    const { rerender } = render(
      <GateMultiSelectLock
        gateOptions={gateOptions}
        selectedGateIds={[]}
        onChangeSelectedGateIds={jest.fn()}
        open={false}
        onToggleOpen={jest.fn()}
        disabled={false}
        showDots={false}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toHaveAttribute('aria-label', 'Choose access rule');

    rerender(
      <GateMultiSelectLock
        gateOptions={gateOptions}
        selectedGateIds={['alpha']}
        onChangeSelectedGateIds={jest.fn()}
        open={false}
        onToggleOpen={jest.fn()}
        disabled={false}
        showDots={false}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toHaveAttribute('aria-label', 'Edit locked access rule');
  });

  it('marks selected gate rows with a visible selected-state affordance', () => {
    render(
      <GateMultiSelectLock
        gateOptions={gateOptions}
        selectedGateIds={['alpha']}
        onChangeSelectedGateIds={jest.fn()}
        open={true}
        onToggleOpen={jest.fn()}
        disabled={false}
        showDots={false}
      />,
    );

    const rows = screen.getAllByTestId(E2E_TESTIDS.GATE_LOCK_ROW);
    const alphaRow = rows.find((row) => row.getAttribute('data-ce-gate-id') === 'alpha');
    const betaRow = rows.find((row) => row.getAttribute('data-ce-gate-id') === 'beta');

    expect(alphaRow).toHaveClass(styles.rowActive);
    expect(alphaRow).toHaveAttribute('aria-current', 'true');
    expect(alphaRow?.querySelector(`.${styles.selectionMarkActive}`)).not.toBeNull();
    expect(betaRow).not.toHaveClass(styles.rowActive);
    expect(betaRow).not.toHaveAttribute('aria-current');
    expect(betaRow?.querySelector(`.${styles.selectionMarkActive}`)).toBeNull();
  });

  it('opens the single-gate popover from the lock button and toggles selection inside the menu', () => {
    const onToggleOpen = jest.fn();
    const onChangeSelectedGateIds = jest.fn();
    const gateOptionsSingle = [
      {
        id: 'vip_access',
        label: 'FOR TEST 12',
        displayLabel: 'FOR TEST 12',
        badgeLabel: 'FOR TEST 12',
        secondaryLabel: 'question lock gate',
        color: '#5affc2',
        mode: 'all',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
        sourceSessionSlug: 'edge',
      },
    ];

    const { rerender } = render(
      <GateMultiSelectLock
        gateOptions={gateOptionsSingle}
        selectedGateIds={[]}
        onChangeSelectedGateIds={onChangeSelectedGateIds}
        open={false}
        onToggleOpen={onToggleOpen}
        disabled={false}
        showDots={false}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON));
    expect(onToggleOpen).toHaveBeenCalledWith(true);

    rerender(
      <GateMultiSelectLock
        gateOptions={gateOptionsSingle}
        selectedGateIds={[]}
        onChangeSelectedGateIds={onChangeSelectedGateIds}
        open={true}
        onToggleOpen={onToggleOpen}
        disabled={false}
        showDots={false}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER)).toBeInTheDocument();
    expect(screen.getByText('FOR TEST 12')).toBeInTheDocument();
    expect(screen.getByText(/question lock gate/)).toBeInTheDocument();
    expect(screen.getByText(/All selected Groups required/)).toBeInTheDocument();
    expect(screen.getByText(/0x1111\.\.\.1111/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Group/ })).toHaveAttribute(
      'href',
      buildSbtDetailPath('0x1111111111111111111111111111111111111111', 'edge'),
    );

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChangeSelectedGateIds).toHaveBeenCalledWith(['vip_access']);

    rerender(
      <GateMultiSelectLock
        gateOptions={gateOptionsSingle}
        selectedGateIds={['vip_access']}
        onChangeSelectedGateIds={onChangeSelectedGateIds}
        open={true}
        onToggleOpen={onToggleOpen}
        disabled={false}
        showDots={false}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { checked: true }));
    expect(onChangeSelectedGateIds).toHaveBeenCalledWith([]);
  });
});
