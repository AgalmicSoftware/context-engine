import React from 'react';
import { render, screen } from '@testing-library/react';

import SessionWizardInfoTooltip from './SessionWizardInfoTooltip';

jest.mock('../Shared/CETooltip', () => {
  const React = require('react');
  return ({ children, target, placement }: { children: React.ReactNode; target: string; placement: string }) => (
    <div data-testid="mock-ce-tooltip" data-target={target} data-placement={placement}>
      {children}
    </div>
  );
});

describe('SessionWizardInfoTooltip', () => {
  it('renders the trigger and tooltip content when enabled', () => {
    render(
      <SessionWizardInfoTooltip
        enabled={true}
        id="gw-tip-test"
        content="Explain this field."
        placement="bottom"
        testId="ce-wizard-tooltip-gw-tip-test"
        ariaLabel="Test info"
      />,
    );

    expect(screen.getByRole('button', { name: 'Test info' })).toHaveAttribute('id', 'gw-tip-test');
    expect(screen.getByTestId('ce-wizard-tooltip-gw-tip-test')).toBeInTheDocument();
    expect(screen.getByTestId('mock-ce-tooltip')).toHaveAttribute('data-target', 'gw-tip-test');
    expect(screen.getByTestId('mock-ce-tooltip')).toHaveAttribute('data-placement', 'bottom');
    expect(screen.getByText('Explain this field.')).toBeInTheDocument();
  });

  it('uses default trigger metadata when optional display props are omitted', () => {
    render(<SessionWizardInfoTooltip enabled={true} id="gw-tip-default" content="Default metadata." />);

    const trigger = screen.getByRole('button', { name: 'Show more info' });

    expect(trigger).toHaveAttribute('id', 'gw-tip-default');
    expect(trigger).not.toHaveAttribute('data-testid');
    expect(screen.getByTestId('mock-ce-tooltip')).toHaveAttribute('data-placement', 'right');
  });

  it.each([
    { enabled: false, id: 'gw-tip-off', content: 'Hidden.' },
    { enabled: true, id: '', content: 'Hidden.' },
    { enabled: true, id: 'gw-tip-empty', content: '   ' },
  ])('omits empty or disabled tooltip state %#', (props) => {
    render(<SessionWizardInfoTooltip {...props} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-ce-tooltip')).not.toBeInTheDocument();
  });
});
