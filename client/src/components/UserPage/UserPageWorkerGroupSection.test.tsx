import React from 'react';
import { render, screen } from '@testing-library/react';

import UserPageWorkerGroupSection from './UserPageWorkerGroupSection';

const mockWorkerSessionGroupsPanel = jest.fn();

jest.mock('../OnePageSession/WorkerSessionGroupsPanel', () => (props: unknown) => {
  mockWorkerSessionGroupsPanel(props);
  return <div data-testid="worker-memberships">Worker memberships</div>;
});

describe('UserPageWorkerGroupSection', () => {
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

    expect(screen.getByRole('heading', { name: 'Joined Groups:' })).toBeInTheDocument();
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
});
