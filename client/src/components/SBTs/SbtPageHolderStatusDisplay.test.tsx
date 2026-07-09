import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageHolderStatusDisplay from './SbtPageHolderStatusDisplay';

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageHolderStatusDisplay>> = {}) => ({
  countStatus: {
    isInitialLoading: false,
    isRefreshing: false,
    maxTokensDisplay: '100',
    mintedCountTitle: '7 holders',
    mintedLabel: 'Minted',
    netMinted: 7,
    refreshIndicatorStyle: { marginLeft: '8px' },
  },
  onOpenMintedModal: jest.fn(),
  scanProgressDisplay: {
    scanProgressFillStyle: { width: '40%' },
    scanProgressPct: 40,
    scanProgressSessionText: null,
    scanProgressText: '',
    showScanProgress: false,
  },
  ...overrides,
});

describe('SbtPageHolderStatusDisplay', () => {
  it('renders holder count status from parent-derived display state', () => {
    render(<SbtPageHolderStatusDisplay {...createProps()} />);

    expect(screen.getByText('Minted:')).toBeInTheDocument();
    expect(screen.getByTitle('7 holders')).toHaveTextContent('7 / 100');
    expect(screen.queryByTitle('Refreshing...')).toBeNull();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('preserves the explicit holder-modal execution prop', () => {
    const onOpenMintedModal = jest.fn();
    render(<SbtPageHolderStatusDisplay {...createProps({ onOpenMintedModal })} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onOpenMintedModal).toHaveBeenCalledTimes(1);
  });

  it('renders loading, refresh, and scan progress without owning scan execution', () => {
    render(
      <SbtPageHolderStatusDisplay
        {...createProps({
          countStatus: {
            ...createProps().countStatus,
            isInitialLoading: true,
            isRefreshing: true,
          },
          scanProgressDisplay: {
            ...createProps().scanProgressDisplay,
            scanProgressPct: 64,
            scanProgressSessionText: 'Session: Alpha',
            scanProgressText: 'Loading holders: 12 blocks remaining',
            showScanProgress: true,
          },
        })}
      />,
    );

    expect(screen.queryByTitle('7 holders')).toBeNull();
    expect(screen.getByTitle('Refreshing...')).toBeInTheDocument();
    expect(screen.getByText('Loading holders: 12 blocks remaining')).toBeInTheDocument();
    expect(screen.getByText('Session: Alpha')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
  });
});
