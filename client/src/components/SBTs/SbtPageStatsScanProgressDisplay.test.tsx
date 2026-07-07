import React from 'react';
import { render, screen } from '@testing-library/react';

import SbtPageStatsScanProgressDisplay from './SbtPageStatsScanProgressDisplay';

describe('SbtPageStatsScanProgressDisplay', () => {
  it('renders holder scan progress from parent-provided display state', () => {
    render(
      <SbtPageStatsScanProgressDisplay
        scanProgressFillStyle={{ width: '64%' }}
        scanProgressPct={64}
        scanProgressSessionText="Session: Alpha"
        scanProgressText="Loading holders: 12 blocks remaining"
        showScanProgress={true}
      />,
    );

    expect(screen.getByText('Loading holders: 12 blocks remaining')).toBeInTheDocument();
    expect(screen.getByText('Session: Alpha')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
  });

  it('returns no progressbar when the parent display state is hidden', () => {
    render(<SbtPageStatsScanProgressDisplay scanProgressPct={0} showScanProgress={false} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
