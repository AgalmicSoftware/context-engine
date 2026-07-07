import React from 'react';
import { render, screen } from '@testing-library/react';
import GateTooltip from './GateTooltip';

jest.mock('reactstrap', () => ({
  UncontrolledTooltip: ({
    children,
    target,
    placement,
  }: {
    children: React.ReactNode;
    target: string;
    placement: string;
  }) => (
    <div data-testid="mock-gate-tooltip" data-target={target} data-placement={placement}>
      {children}
    </div>
  ),
}));

jest.mock('../../utilities/sbt/sbtDisplayNames.js', () => ({
  resolveSbtDisplayLabel: jest.fn(({ address }: { address?: string }) => {
    if (String(address || '').toLowerCase() === '0x1111111111111111111111111111111111111111') {
      return 'VIP SBT';
    }
    return '';
  }),
}));

describe('GateTooltip', () => {
  it('renders gate details and required SBT labels when gate data is available', () => {
    render(
      <GateTooltip
        gateId="vip_access"
        gateConfig={{ label: 'VIP Gate', mode: 'all' }}
        sbtAddresses={['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222']}
        userHeldSBTs={['0x1111111111111111111111111111111111111111']}
      >
        [encrypted]
      </GateTooltip>,
    );

    expect(screen.getByText('[encrypted]')).toBeTruthy();
    expect(screen.getByTestId('mock-gate-tooltip').textContent).toContain('VIP Gate (All required)');
    // Held SBT shows [held] prefix; address shown as display name or short address
    const tooltipText = screen.getByTestId('mock-gate-tooltip').textContent;
    expect(tooltipText).toMatch(/\[held\]/);
    expect(tooltipText).toContain('VIP SBT');
    expect(tooltipText).toContain('0x2222');
  });

  it('renders children without tooltip markup when gate data is unavailable', () => {
    render(<GateTooltip>encrypted</GateTooltip>);

    expect(screen.getByText('encrypted')).toBeTruthy();
    expect(screen.queryByTestId('mock-gate-tooltip')).toBeNull();
  });
});
