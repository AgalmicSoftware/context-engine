import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageFullProfileModal from './UserPageFullProfileModal';

jest.mock('reactstrap', () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="profile-modal">{children}</div> : null,
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalHeader: ({ children, toggle }: { children: React.ReactNode; toggle: () => void }) => (
    <div>
      <button type="button" onClick={toggle}>
        close
      </button>
      {children}
    </div>
  ),
}));

jest.mock('../SBTs/SBTPage', () => ({
  __esModule: true,
  default: ({
    refreshSbtData,
    SBTAddress,
    sessionSlug,
  }: {
    refreshSbtData: (address: unknown) => void;
    SBTAddress: unknown;
    sessionSlug: unknown;
  }) => (
    <div data-testid="sbt-card" data-sbt-address={String(SBTAddress)} data-session-slug={String(sessionSlug)}>
      SBT {String(SBTAddress)}
      <button type="button" onClick={() => refreshSbtData('0xrefresh')}>
        refresh child
      </button>
    </div>
  ),
}));

jest.mock('./UserStats', () => ({
  __esModule: true,
  default: ({
    collapseOpen,
    toggleCollapse,
  }: {
    collapseOpen: unknown;
    toggleCollapse: (...args: unknown[]) => void;
  }) => (
    <button type="button" onClick={() => toggleCollapse('mostUniqueIdea')}>
      stats {String(collapseOpen)}
    </button>
  ),
}));

const createProps = (overrides: Partial<React.ComponentProps<typeof UserPageFullProfileModal>> = {}) => ({
  aiAnalysis: 'A useful profile summary.',
  bookmarksHref: '/bookmarks',
  collapseOpen: 'mostUniqueIdea',
  explorerUrl: 'https://explorer.example.test/address/0xabc',
  fullProfileModalDisplayState: {
    shouldRenderBookmarksLink: true,
    shouldRenderModalActions: true,
    shouldRenderSurveyEmptyText: false,
    shouldRenderSurveyList: true,
    shouldRenderSurveySpinner: false,
  },
  isOpen: true,
  isSBTCacheReady: true,
  loginComplete: true,
  mintedSbtsHeading: 'Minted SBTs',
  network: { id: 84532 },
  onRefreshSbtData: jest.fn(),
  onStatsCollapseToggle: jest.fn(),
  onToggle: jest.fn(),
  provider: {},
  sbtDisplayState: {
    shouldRenderModalEmptyText: false,
    shouldRenderModalSpinner: false,
  },
  sbtEmptyText: 'No SBTs yet.',
  sbtEntries: [
    {
      sbtInfo: { sbtAddress: '0x00000000000000000000000000000000000000aa' },
      slug: 'alpha',
    },
  ],
  surveyResponseEntries: [
    {
      questionsCount: 3,
      title: 'Safety Survey',
    },
  ],
  userStats: {
    surveysResponded: 1,
  },
  ...overrides,
});

describe('UserPageFullProfileModal', () => {
  it('renders summary, stats, surveys, SBT cards, links, and parent callbacks', () => {
    const onRefreshSbtData = jest.fn();
    const onStatsCollapseToggle = jest.fn();
    const onToggle = jest.fn();
    render(
      <UserPageFullProfileModal
        {...createProps({
          onRefreshSbtData,
          onStatsCollapseToggle,
          onToggle,
        })}
      />,
    );

    expect(screen.getByTestId('profile-modal')).toBeInTheDocument();
    expect(screen.getByText('A useful profile summary.')).toBeInTheDocument();
    expect(screen.getByText('Safety Survey')).toBeInTheDocument();
    expect(screen.getByText('Questions: 3')).toBeInTheDocument();
    expect(screen.getByText('Minted SBTs')).toBeInTheDocument();
    expect(screen.getByTestId('sbt-card')).toHaveAttribute(
      'data-sbt-address',
      '0x00000000000000000000000000000000000000aa',
    );
    expect(screen.getByTestId('sbt-card')).toHaveAttribute('data-session-slug', 'alpha');
    expect(screen.getByRole('link', { name: /My Bookmarks/ })).toHaveAttribute('href', '/bookmarks');
    expect(screen.getByRole('link', { name: /View on Explorer/ })).toHaveAttribute(
      'href',
      'https://explorer.example.test/address/0xabc',
    );

    fireEvent.click(screen.getByText('close'));
    fireEvent.click(screen.getByText('stats mostUniqueIdea'));
    fireEvent.click(screen.getByText('refresh child'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onStatsCollapseToggle).toHaveBeenCalledWith('mostUniqueIdea');
    expect(onRefreshSbtData).toHaveBeenCalledWith('0xrefresh', 'alpha');
  });

  it('renders loading and empty states from parent-derived display state', () => {
    render(
      <UserPageFullProfileModal
        {...createProps({
          aiAnalysis: '',
          fullProfileModalDisplayState: {
            shouldRenderBookmarksLink: false,
            shouldRenderModalActions: false,
            shouldRenderSurveyEmptyText: true,
            shouldRenderSurveyList: false,
            shouldRenderSurveySpinner: false,
          },
          sbtDisplayState: {
            shouldRenderModalEmptyText: true,
            shouldRenderModalSpinner: false,
          },
          sbtEntries: [],
          surveyResponseEntries: [],
        })}
      />,
    );

    expect(screen.getByText('Summary not available.')).toBeInTheDocument();
    expect(screen.getByText('No survey responses.')).toBeInTheDocument();
    expect(screen.getByText('No SBTs yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Bookmarks/ })).toBeNull();
  });
});
