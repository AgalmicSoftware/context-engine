import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtListSessionUniverseSummary from './SbtListSessionUniverseSummary';

describe('SbtListSessionUniverseSummary', () => {
  it('renders selected session chips with progress and forwards open clicks', () => {
    const onOpenSessionChip = jest.fn();
    render(
      <SbtListSessionUniverseSummary
        testId="summary"
        summarySlugs={['alpha', 'beta', 'gamma', 'delta', 'epsilon']}
        chipProgressVisibilityBySlug={{ alpha: true }}
        chipLoadingStatusBySlug={{
          alpha: {
            progressText: 'Alpha loading',
            chipBlockProgressText: '1 / 2',
          },
        }}
        labelForSessionSlug={(slug) => slug || 'General'}
        buildSessionRouteHref={(slug) => (slug ? `/session/${slug}` : '/session')}
        onOpenSessionChip={onOpenSessionChip}
      />,
    );

    expect(screen.getByTestId('summary')).toHaveTextContent('Selected (5)');
    expect(screen.getByTestId('session-collapsed-chip-progress-alpha')).toHaveTextContent('1 / 2');
    expect(screen.getByText('+1 more')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('session-collapsed-chip-open-beta'));

    expect(onOpenSessionChip).toHaveBeenCalledWith('beta', expect.any(Object));
  });
});
