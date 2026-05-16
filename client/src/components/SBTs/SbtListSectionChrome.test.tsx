import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  SbtListInitialLoader,
  SbtListSectionLoadingHint,
  SbtListSectionTitle,
} from './SbtListSectionChrome';

describe('SbtListSectionChrome', () => {
  it('renders the initial loader with per-session progress rows', () => {
    render(
      <SbtListInitialLoader
        loadingLabel="Loading groups"
        loadingSessionStatuses={[
          {
            displayName: 'General',
            hasLatest: true,
            progressPct: 75,
            progressText: '3 / 4 blocks',
            scanInProgress: true,
            slug: 'general',
            statusLabel: 'Scanning',
          },
          {
            displayName: 'Research',
            hasLatest: false,
            progressPct: 0,
            progressText: 'Waiting for latest block',
            scanInProgress: false,
            slug: 'research',
            statusLabel: 'Pending',
          },
        ]}
      />
    );

    expect(screen.getByText('Loading groups')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('3 / 4 blocks')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Waiting for latest block')).toBeInTheDocument();

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '75');
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders section titles with optional corner spinners', () => {
    const { rerender } = render(
      <SbtListSectionTitle label="Live" showSpinner={false} spinnerId="spinner-live" />
    );

    expect(screen.getByRole('heading', { name: 'Live' })).toBeInTheDocument();
    expect(screen.queryByTestId('spinner-live')).not.toBeInTheDocument();

    rerender(<SbtListSectionTitle label="Live" showSpinner spinnerId="spinner-live" />);

    expect(screen.getByTestId('spinner-live')).toBeInTheDocument();
  });

  it('renders block progress only outside all-sessions mode', () => {
    const { rerender } = render(
      <SbtListSectionLoadingHint allSessionsMode={false} blocksLeft={42} />
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByText('Blocks left: 42')).toBeInTheDocument();

    rerender(<SbtListSectionLoadingHint allSessionsMode blocksLeft={42} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Blocks left: 42')).not.toBeInTheDocument();
  });
});
