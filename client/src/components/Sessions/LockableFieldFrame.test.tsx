import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import LockableFieldFrame from './LockableFieldFrame';

jest.mock('../Shared/CETooltip', () => {
  const React = require('react');
  return ({ children, target }: { children: React.ReactNode; target: string }) => (
    <div data-testid="mock-ce-tooltip" data-target={target}>
      {children}
    </div>
  );
});

jest.mock('../Gates/GateMultiSelectLock', () => {
  const React = require('react');
  const { E2E_TESTIDS } = require('../../utilities/e2eTestIds.js');
  return (props: { open?: boolean; onToggleOpen?: (open: boolean) => void }) => (
    <button type="button" data-testid={E2E_TESTIDS.GATE_LOCK} onClick={() => props.onToggleOpen?.(!props.open)}>
      Gate lock
    </button>
  );
});

describe('LockableFieldFrame', () => {
  it('renders label and child content', () => {
    render(
      <LockableFieldFrame label="Session name">
        <input aria-label="Session input" />
      </LockableFieldFrame>,
    );

    expect(screen.getByText('Session name')).toBeInTheDocument();
    expect(screen.getByLabelText('Session input')).toBeInTheDocument();
  });

  it('renders tooltip when tooltipText is provided and omits it when null', () => {
    const { rerender } = render(
      <LockableFieldFrame
        label="Session info"
        tooltipId="gw-tip-session-info"
        tooltipText="Tell participants what this session is for."
      />,
    );

    expect(screen.getByRole('button', { name: 'Session info info' })).toHaveAttribute('id', 'gw-tip-session-info');
    expect(screen.getByTestId('mock-ce-tooltip')).toHaveAttribute('data-target', 'gw-tip-session-info');
    expect(screen.getByText('Tell participants what this session is for.')).toBeInTheDocument();

    rerender(<LockableFieldFrame label="Session info" tooltipId="gw-tip-session-info" tooltipText={null} />);

    expect(screen.queryByRole('button', { name: 'Session info info' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-ce-tooltip')).not.toBeInTheDocument();
  });

  it('renders the lock toggle when canLock is true and hides it when false', () => {
    const { rerender } = render(
      <LockableFieldFrame
        label="Prompt"
        canLock={true}
        isLocked={false}
        lockTitle="Choose gate"
        onLockToggle={() => {}}
      />,
    );

    expect(screen.getByTitle('Choose gate')).toBeInTheDocument();

    rerender(
      <LockableFieldFrame
        label="Prompt"
        canLock={false}
        isLocked={false}
        lockTitle="Choose gate"
        onLockToggle={() => {}}
      />,
    );

    expect(screen.queryByTitle('Choose gate')).not.toBeInTheDocument();
  });

  it('calls onLockToggle when the lock toggle is clicked', () => {
    const onLockToggle = jest.fn();
    render(
      <LockableFieldFrame
        label="Prompt"
        canLock={true}
        isLocked={true}
        lockTitle="Edit gate"
        onLockToggle={onLockToggle}
      />,
    );

    fireEvent.click(screen.getByTitle('Edit gate'));

    expect(onLockToggle).toHaveBeenCalledTimes(1);
  });

  it('renders fieldError when provided', () => {
    render(
      <LockableFieldFrame label="JSON field" fieldError="Invalid JSON">
        <textarea aria-label="JSON input" />
      </LockableFieldFrame>,
    );

    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
  });

  it('preserves the gate lock data-testid carried by the original chrome', () => {
    render(
      <LockableFieldFrame
        label="Session info"
        canLock={true}
        isLocked={true}
        gateLockProps={{
          gateOptions: [],
          selectedGateIds: [],
          onChangeSelectedGateIds: () => {},
          open: false,
          onToggleOpen: () => {},
          disabled: false,
          showDots: true,
        }}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK)).toBeInTheDocument();
  });
});
