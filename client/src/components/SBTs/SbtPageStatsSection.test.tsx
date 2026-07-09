import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageStatsSection from './SbtPageStatsSection';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageStatsSection>> = {}) => ({
  adminAddressDisplay: <a href="https://explorer.example.test/admin">0xadmin</a>,
  burnLabel: 'Admin Only',
  creatorAddressDisplay: <a href="https://explorer.example.test/creator">0xcreator</a>,
  isOpen: true,
  holderCountStatus: {
    isInitialLoading: false,
    isRefreshing: false,
    maxTokensDisplay: '100',
    mintedCountTitle: '7 holders',
    mintedLabel: 'Minted',
    netMinted: 7,
    refreshIndicatorStyle: { marginLeft: '8px' },
  },
  holderScanProgressDisplay: {
    scanProgressFillStyle: { width: '40%' },
    scanProgressPct: 40,
    scanProgressSessionText: null,
    scanProgressText: '',
    showScanProgress: false,
  },
  mintEndDisplay: <p>Minting ends: tomorrow</p>,
  networkLabel: 'Base Sepolia',
  onOpenMintedModal: jest.fn(),
  onToggle: jest.fn(),
  questionIconStyle: { color: 'rgb(17, 17, 17)' },
  sectionHeaderClassName: 'section-header',
  shouldRenderClosedIcon: false,
  shouldRenderOpenIcon: true,
  ...overrides,
});

describe('SbtPageStatsSection', () => {
  it('renders stats labels, address displays, network, and mint end content from explicit props', () => {
    render(<SbtPageStatsSection {...createProps()} />);

    expect(screen.getByText('STATS')).toBeInTheDocument();
    expect(screen.getByTitle('7 holders')).toHaveTextContent('7 / 100');
    expect(screen.getByText('Burnable by:')).toBeInTheDocument();
    expect(screen.getByText('Admin Only')).toBeInTheDocument();
    expect(screen.getByText('Network:')).toBeInTheDocument();
    expect(screen.getByText('Base Sepolia')).toBeInTheDocument();
    expect(screen.getByText('Admin:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xadmin' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/admin',
    );
    expect(screen.getByText('Creator:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xcreator' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/creator',
    );
    expect(screen.getByText('Minting ends: tomorrow')).toBeInTheDocument();
  });

  it('preserves passive header and holder modal handlers', () => {
    const onOpenMintedModal = jest.fn();
    const onToggle = jest.fn();
    render(
      <SbtPageStatsSection
        {...createProps({
          onOpenMintedModal,
          onToggle,
        })}
      />,
    );

    fireEvent.click(screen.getByText('STATS'));
    fireEvent.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpenMintedModal).toHaveBeenCalledTimes(1);
  });

  it('renders loading, refresh, and holder scan progress states without owning the scan logic', () => {
    render(
      <SbtPageStatsSection
        {...createProps({
          holderCountStatus: {
            ...createProps().holderCountStatus,
            isInitialLoading: true,
            isRefreshing: true,
          },
          holderScanProgressDisplay: {
            ...createProps().holderScanProgressDisplay,
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

  it('hides the stats body when the parent-derived section state is closed', () => {
    render(
      <SbtPageStatsSection
        {...createProps({
          isOpen: false,
          shouldRenderClosedIcon: true,
          shouldRenderOpenIcon: false,
        })}
      />,
    );

    expect(screen.getByText('STATS')).toBeInTheDocument();
    expect(screen.queryByText('Minted:')).toBeNull();
    expect(screen.queryByText('Admin:')).toBeNull();
  });
});
