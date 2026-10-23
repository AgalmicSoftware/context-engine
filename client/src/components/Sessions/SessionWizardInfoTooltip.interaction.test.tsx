import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import SessionWizardInfoTooltip from './SessionWizardInfoTooltip';

describe('SessionWizardInfoTooltip interaction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps help open across focus and click, dismisses with Escape, and opens again on click', async () => {
    const props = {
      enabled: true,
      id: 'channel-help-test',
      ariaLabel: 'About agent access',
      content: 'Authorized agents can participate through scoped HTTP access.',
    };
    const { rerender } = render(<SessionWizardInfoTooltip {...props} />);
    const help = screen.getByRole('button', { name: 'About agent access' });

    fireEvent.focusIn(help);
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/through scoped HTTP access/);

    fireEvent.click(help);
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await act(async () => jest.advanceTimersByTimeAsync(500));

    expect(screen.getByRole('tooltip')).toHaveTextContent(/through scoped HTTP access/);
    expect(help).toHaveAccessibleDescription('Authorized agents can participate through scoped HTTP access.');
    fireEvent.keyDown(help, { key: 'Escape' });
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await act(async () => jest.advanceTimersByTimeAsync(500));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(help);
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/through scoped HTTP access/);

    rerender(<SessionWizardInfoTooltip {...props} enabled={false} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<SessionWizardInfoTooltip {...props} />);
    expect(screen.getByRole('button', { name: 'About agent access' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
