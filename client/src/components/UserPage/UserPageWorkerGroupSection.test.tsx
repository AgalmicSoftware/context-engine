import React from 'react';
import { render, screen } from '@testing-library/react';

import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import UserPageWorkerGroupSection from './UserPageWorkerGroupSection';
import { renderUserPageMembershipSections } from './UserPageMembershipSections';

const mockWorkerSessionGroupsPanel = jest.fn();

jest.mock('../OnePageSession/WorkerSessionGroupsPanel', () => (props: unknown) => {
  mockWorkerSessionGroupsPanel(props);
  return <div data-testid="worker-memberships">Worker memberships</div>;
});

describe('UserPageWorkerGroupSection', () => {
  it('keeps a groups section when membership data is unavailable without loading private memberships', () => {
    render(
      <>
        {renderUserPageMembershipSections({
          account: '',
          activeSessionSlug: '',
          isOwner: false,
          isSimulated: false,
          onChainProfileEnabled: false,
          provider: null,
          sessionConfig: {},
          sbtSectionProps: {
            heading: 'SBTs',
            onRefreshSbtData: jest.fn(),
            sbtDisplayState: {},
            sbtEmptyText: '',
            sbtEntries: [],
          },
        })}
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Groups Joined:' })).toBeInTheDocument();
    expect(screen.getByText('Choose a session to view group memberships.')).toBeInTheDocument();
    expect(mockWorkerSessionGroupsPanel).not.toHaveBeenCalled();
  });

  it.each(['', '0x00000000000000000000000000000000000000bb'])(
    'explains private memberships without fetching when the viewer is %s',
    (account) => {
      render(
        <>
          {renderUserPageMembershipSections({
            account,
            activeSessionSlug: 'profile-session',
            isOwner: false,
            isSimulated: false,
            onChainProfileEnabled: false,
            provider: null,
            sessionConfig: {
              slug: 'profile-session',
              sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
            },
            sbtSectionProps: {
              heading: 'SBTs',
              onRefreshSbtData: jest.fn(),
              sbtDisplayState: {},
              sbtEmptyText: '',
              sbtEntries: [],
            },
          })}
        </>,
      );
      expect(
        screen.getByText(
          account
            ? 'Group memberships are only shown on your own profile.'
            : 'Sign in with this profile’s account to view its groups.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText('No groups to display.')).not.toBeInTheDocument();
      expect(mockWorkerSessionGroupsPanel).not.toHaveBeenCalled();
    },
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders only the current principal’s joined Worker Groups', () => {
    const sessionConfig = { slug: 'demo-sh' };
    render(
      <UserPageWorkerGroupSection
        account="0x00000000000000000000000000000000000000aa"
        provider="wagmi"
        sessionConfig={sessionConfig}
        sessionSlug="demo-sh"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Groups Joined:' })).toBeInTheDocument();
    expect(screen.getByTestId('worker-memberships')).toBeInTheDocument();
    expect(mockWorkerSessionGroupsPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        account: '0x00000000000000000000000000000000000000aa',
        membershipsOnly: true,
        provider: 'wagmi',
        sessionConfig,
        sessionSlug: 'demo-sh',
        showCreate: false,
        showGroupDescriptions: false,
        showMembershipListHeader: false,
      }),
    );
  });

  it('re-scopes memberships when the active Cloudflare session changes', () => {
    const account = '0x00000000000000000000000000000000000000aa';
    const firstSessionConfig = { slug: 'first-session' };
    const nextSessionConfig = { slug: 'next-session' };
    const { rerender } = render(
      <UserPageWorkerGroupSection
        account={account}
        provider="passkey_eoa"
        sessionConfig={firstSessionConfig}
        sessionSlug="first-session"
      />,
    );

    rerender(
      <UserPageWorkerGroupSection
        account={account}
        provider="passkey_eoa"
        sessionConfig={nextSessionConfig}
        sessionSlug="next-session"
      />,
    );

    expect(mockWorkerSessionGroupsPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        account,
        membershipsOnly: true,
        sessionConfig: nextSessionConfig,
        sessionSlug: 'next-session',
      }),
    );
  });
});
