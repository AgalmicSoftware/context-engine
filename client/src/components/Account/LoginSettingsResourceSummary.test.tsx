import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { LoginSettingsSessionPills, LoginSettingsSupportedResourceCard } from './LoginSettingsResourceSummary';

describe('LoginSettingsResourceSummary', () => {
  it('renders empty and populated session pills', () => {
    const { rerender } = render(<LoginSettingsSessionPills />);

    expect(screen.getByText('No sponsor sessions configured.')).toBeInTheDocument();

    rerender(
      <LoginSettingsSessionPills
        sessions={[
          { isActive: true, label: 'General', slug: '', slugLabel: 'general' },
          { isActive: false, label: 'Edge', slug: 'edge', slugLabel: 'edge' },
        ]}
      />,
    );

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Edge')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('edge')).toBeInTheDocument();
  });

  it('renders sponsored resource state and toggles extra sessions', () => {
    const onToggleSessions = jest.fn();

    render(
      <LoginSettingsSupportedResourceCard
        activeSession={{ isActive: true, label: 'General', slug: '', slugLabel: 'general' }}
        activeSponsorSession={null}
        card={{
          key: 'rpc',
          title: 'RPC',
          status: {
            detail: 'No active-session RPC sponsor.',
            label: 'Not sponsored',
            tone: 'Warning',
          },
        }}
        extraSessions={[{ isActive: false, label: 'Edge', slug: 'edge', slugLabel: 'edge' }]}
        extrasExpanded={false}
        onToggleSessions={onToggleSessions}
      />,
    );

    const card = screen.getByText('RPC').closest('div');
    expect(screen.getByText('Not sponsored')).toBeInTheDocument();
    expect(screen.getByText('No active-session RPC sponsor.')).toBeInTheDocument();
    expect(screen.getByText('not configured here')).toBeInTheDocument();
    expect(screen.queryByText('Edge')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show other RPC sponsor sessions' }));

    expect(onToggleSessions).toHaveBeenCalledWith('rpc');
    expect(within(card?.parentElement?.parentElement || document.body).getByText('General')).toBeInTheDocument();
  });
});
