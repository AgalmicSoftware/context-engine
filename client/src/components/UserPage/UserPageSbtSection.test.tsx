import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageSbtSection from './UserPageSbtSection';

jest.mock('../SBTs/SBTPage', () => ({
  __esModule: true,
  default: ({
    account,
    metadataOnly,
    refreshSbtData,
    SBTAddress,
    sessionSlug,
  }: {
    account: unknown;
    metadataOnly: boolean;
    refreshSbtData: (address: unknown) => void;
    SBTAddress: unknown;
    sessionSlug: unknown;
  }) => (
    <div
      data-testid="sbt-card"
      data-account={String(account)}
      data-metadata-only={String(metadataOnly)}
      data-sbt-address={String(SBTAddress)}
      data-session-slug={String(sessionSlug)}
    >
      SBT {String(SBTAddress)}
      <button type="button" onClick={() => refreshSbtData('0xrefresh')}>
        refresh child
      </button>
    </div>
  ),
}));

const createProps = (overrides: Partial<React.ComponentProps<typeof UserPageSbtSection>> = {}) => ({
  account: '0xviewer',
  heading: 'Minted SBTs:',
  isLoading: true,
  isSBTCacheReady: true,
  loadingIndicator: <span data-testid="sbt-loading">loading</span>,
  loginComplete: true,
  network: { id: 84532 },
  onRefreshSbtData: jest.fn(),
  provider: {},
  sbtDisplayState: {
    hasSbts: true,
    shouldRenderMainEmptyText: false,
  },
  sbtEmptyText: 'No SBTs found.',
  sbtEntries: [
    {
      sbtInfo: { sbtAddress: '0x00000000000000000000000000000000000000aa' },
      slug: 'alpha',
    },
  ],
  ...overrides,
});

describe('UserPageSbtSection', () => {
  it('renders the SBT heading, loading indicator, cards, and refresh boundary', () => {
    const onRefreshSbtData = jest.fn();
    render(
      <UserPageSbtSection
        {...createProps({
          onRefreshSbtData,
        })}
      />,
    );

    expect(screen.getByText('Minted SBTs:')).toBeInTheDocument();
    expect(screen.getByTestId('sbt-loading')).toBeInTheDocument();
    expect(screen.getByTestId('sbt-card')).toHaveAttribute(
      'data-sbt-address',
      '0x00000000000000000000000000000000000000aa',
    );
    expect(screen.getByTestId('sbt-card')).toHaveAttribute('data-session-slug', 'alpha');
    expect(screen.getByTestId('sbt-card')).toHaveAttribute('data-account', '0xviewer');
    expect(screen.getByTestId('sbt-card')).toHaveAttribute('data-metadata-only', 'true');

    fireEvent.click(screen.getByText('refresh child'));
    expect(onRefreshSbtData).toHaveBeenCalledWith('0xrefresh', 'alpha');
  });

  it('renders the parent-derived empty state without a loading indicator', () => {
    render(
      <UserPageSbtSection
        {...createProps({
          isLoading: false,
          sbtDisplayState: {
            hasSbts: false,
            shouldRenderMainEmptyText: true,
          },
          sbtEntries: [],
        })}
      />,
    );

    expect(screen.getByText('Minted SBTs:')).toBeInTheDocument();
    expect(screen.queryByTestId('sbt-loading')).toBeNull();
    expect(screen.getByText('No SBTs found.')).toBeInTheDocument();
    expect(screen.queryByTestId('sbt-card')).toBeNull();
  });
});
