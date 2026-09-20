import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionInterviewGroupRecommendation } from './SessionInterviewRecommendedGroups';
import {
  getWorkerSessionToken,
  joinWorkerGroup,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  writeTokenCache,
} from '../../utilities/worker/workerAuthTokenCache';

jest.mock('../../domains/worker/workerGroupPorts', () => ({
  getWorkerSessionToken: jest.fn(),
  joinWorkerGroup: jest.fn(),
  loadPublicWorkerGroups: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));

jest.mock('../../utilities/worker/workerGroupChangeEvents', () => ({
  dispatchWorkerGroupsChanged: jest.fn(),
}));

const actualRecommendationsModule = jest.requireActual<typeof import('./SessionInterviewRecommendedGroups')>(
  './SessionInterviewRecommendedGroups',
);
const { SessionInterviewRecommendedGroups } = actualRecommendationsModule;

const sessionId = `0x${'1'.repeat(32)}`;
const workerUrl = 'https://worker.example';
const account = '0x0000000000000000000000000000000000000001';

const group = (overrides: Partial<WorkerGroup> = {}): WorkerGroup => ({
  groupId: 'ai-optimists',
  sessionSlug: 'demo',
  label: 'AI Optimists',
  description: 'People who explicitly support optimistic AI governance views.',
  joinMode: 'open',
  memberVisibility: 'session',
  ...overrides,
});

const recommendation = (
  overrides: Partial<SessionInterviewGroupRecommendation> = {},
): SessionInterviewGroupRecommendation => ({
  groupId: 'ai-optimists',
  reason: 'Your reviewed answer explicitly supported optimistic AI governance.',
  evidence: 'Question: AI governance? Answer: I support open AI development.',
  ...overrides,
});

const renderRecommendations = (props: Partial<React.ComponentProps<typeof SessionInterviewRecommendedGroups>> = {}) =>
  render(
    <SessionInterviewRecommendedGroups
      recommendations={[recommendation()]}
      account=""
      loginComplete={false}
      sessionConfig={{ slug: 'demo', sessionId }}
      sessionSlug="demo"
      workerUrl={workerUrl}
      toggleLoginModal={jest.fn()}
      {...props}
    />,
  );

const overview = (
  groups: WorkerGroup[],
  memberships: WorkerGroupOverview['memberships'] = [],
): WorkerGroupOverview => ({
  groups,
  memberships,
});

describe('SessionInterviewRecommendedGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllTokenCaches();
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([group()]);
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue(overview([group()]));
    jest.mocked(getWorkerSessionToken).mockResolvedValue('token');
    jest.mocked(joinWorkerGroup).mockResolvedValue({ group: group(), memberCount: 1 });
  });

  it('renders only eligible recommended public groups without signing in', async () => {
    jest
      .mocked(loadPublicWorkerGroups)
      .mockResolvedValue([
        group(),
        group({ groupId: 'restricted', label: 'Restricted', joinMode: 'admin_add' }),
        group({ groupId: 'expired', label: 'Expired', joinEndsAt: '2020-01-01T00:00:00.000Z' }),
        group({ groupId: 'unrecommended', label: 'Unrecommended' }),
      ]);
    renderRecommendations({
      recommendations: [
        recommendation(),
        recommendation({ groupId: 'restricted' }),
        recommendation({ groupId: 'expired' }),
      ],
    });

    expect(await screen.findByRole('heading', { name: 'Suggested groups (1)' })).toBeInTheDocument();
    expect(screen.getByText('AI Optimists')).toBeInTheDocument();
    expect(screen.queryByText('Restricted')).not.toBeInTheDocument();
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
    expect(screen.queryByText('Unrecommended')).not.toBeInTheDocument();
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(joinWorkerGroup).not.toHaveBeenCalled();
  });

  it('opens login for the selected group and cancels the pending join when login is dismissed', async () => {
    const toggleLoginModal = jest.fn();
    const view = renderRecommendations({ toggleLoginModal });

    fireEvent.click(await screen.findByTestId('ce-session-interview-join-group-ai-optimists'));
    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(joinWorkerGroup).not.toHaveBeenCalled();

    view.rerender(
      <SessionInterviewRecommendedGroups
        recommendations={[recommendation()]}
        account=""
        loginComplete={false}
        loginModalToggled
        sessionConfig={{ slug: 'demo', sessionId }}
        sessionSlug="demo"
        workerUrl={workerUrl}
        toggleLoginModal={toggleLoginModal}
      />,
    );
    view.rerender(
      <SessionInterviewRecommendedGroups
        recommendations={[recommendation()]}
        account=""
        loginComplete={false}
        loginModalToggled={false}
        sessionConfig={{ slug: 'demo', sessionId }}
        sessionSlug="demo"
        workerUrl={workerUrl}
        toggleLoginModal={toggleLoginModal}
      />,
    );
    view.rerender(
      <SessionInterviewRecommendedGroups
        recommendations={[recommendation()]}
        account={account}
        loginComplete
        sessionConfig={{ slug: 'demo', sessionId }}
        sessionSlug="demo"
        workerUrl={workerUrl}
        toggleLoginModal={toggleLoginModal}
      />,
    );

    await waitFor(() => expect(joinWorkerGroup).not.toHaveBeenCalled());
  });

  it('resumes exactly the selected join after login and broadcasts the membership change', async () => {
    const toggleLoginModal = jest.fn();
    const view = renderRecommendations({
      recommendations: [recommendation(), recommendation({ groupId: 'country-at' })],
      toggleLoginModal,
    });
    fireEvent.click(await screen.findByTestId('ce-session-interview-join-group-ai-optimists'));

    view.rerender(
      <SessionInterviewRecommendedGroups
        recommendations={[recommendation(), recommendation({ groupId: 'country-at' })]}
        account={account}
        loginComplete
        sessionConfig={{ slug: 'demo', sessionId }}
        sessionSlug="demo"
        workerUrl={workerUrl}
        toggleLoginModal={toggleLoginModal}
      />,
    );

    await waitFor(() =>
      expect(joinWorkerGroup).toHaveBeenCalledWith(
        expect.objectContaining({ credentialToken: 'token', groupId: 'ai-optimists', sessionId, sessionSlug: 'demo' }),
      ),
    );
    expect(joinWorkerGroup).toHaveBeenCalledTimes(1);
    expect(toggleLoginModal).toHaveBeenCalledWith(false);
    expect(dispatchWorkerGroupsChanged).toHaveBeenCalledWith({ sessionSlug: 'demo', sessionId });
    expect(await screen.findByTestId('ce-session-interview-join-group-ai-optimists')).toHaveTextContent('Joined');
  });

  it('closes the scoped login dialog when a resumed join fails so the retry error stays visible', async () => {
    jest.mocked(joinWorkerGroup).mockRejectedValueOnce(new Error('worker_group_request_failed_503'));
    const toggleLoginModal = jest.fn();
    const view = renderRecommendations({ toggleLoginModal });

    fireEvent.click(await screen.findByTestId('ce-session-interview-join-group-ai-optimists'));
    expect(toggleLoginModal).toHaveBeenCalledWith(true);

    view.rerender(
      <SessionInterviewRecommendedGroups
        recommendations={[recommendation()]}
        account={account}
        loginComplete
        sessionConfig={{ slug: 'demo', sessionId }}
        sessionSlug="demo"
        workerUrl={workerUrl}
        toggleLoginModal={toggleLoginModal}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not join this group. Please try again.');
    expect(toggleLoginModal).toHaveBeenCalledWith(false);
    expect(joinWorkerGroup).toHaveBeenCalledTimes(1);
    expect(dispatchWorkerGroupsChanged).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-session-interview-join-group-ai-optimists')).toHaveTextContent('Join');
  });

  it('hides already-joined groups from a cached signed-in catalog', async () => {
    writeTokenCache(
      buildTokenCacheKey({ workerUrl, slug: 'demo', sessionId, address: account }),
      buildTokenCacheEnvelope({
        token: 'token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        workerUrl,
        sessionSlug: 'demo',
        sessionId,
        address: account,
      }),
    );
    jest
      .mocked(loadWorkerGroupOverview)
      .mockResolvedValue(
        overview([group()], [{ group: group(), member: { groupId: 'ai-optimists', sessionSlug: 'demo' } }]),
      );
    renderRecommendations({ account, loginComplete: true });

    await waitFor(() => expect(loadWorkerGroupOverview).toHaveBeenCalledTimes(1));
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(joinWorkerGroup).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ce-session-interview-join-group-ai-optimists')).not.toBeInTheDocument();
  });

  it('drops a pending join when the same group recommendation evidence changes before login completes', async () => {
    const view = renderRecommendations();
    fireEvent.click(await screen.findByTestId('ce-session-interview-join-group-ai-optimists'));

    view.rerender(
      <SessionInterviewRecommendedGroups
        recommendations={[
          recommendation({ evidence: 'Question: AI governance? Answer: I changed this support claim.' }),
        ]}
        account={account}
        loginComplete
        sessionConfig={{ slug: 'demo', sessionId }}
        sessionSlug="demo"
        workerUrl={workerUrl}
      />,
    );

    await waitFor(() => expect(joinWorkerGroup).not.toHaveBeenCalled());
  });

  it('drops a pending join when recommendation evidence changes to a different group before login completes', async () => {
    const view = renderRecommendations();
    fireEvent.click(await screen.findByTestId('ce-session-interview-join-group-ai-optimists'));

    view.rerender(
      <SessionInterviewRecommendedGroups
        recommendations={[recommendation({ groupId: 'country-at' })]}
        account={account}
        loginComplete
        sessionConfig={{ slug: 'demo', sessionId }}
        sessionSlug="demo"
        workerUrl={workerUrl}
      />,
    );

    await waitFor(() => expect(joinWorkerGroup).not.toHaveBeenCalled());
  });

  it('uses public discovery without prompting for a worker token when no signed-in cache exists', async () => {
    renderRecommendations({ account, loginComplete: true });

    expect(await screen.findByTestId('ce-session-interview-join-group-ai-optimists')).toBeInTheDocument();
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(loadWorkerGroupOverview).not.toHaveBeenCalled();
  });
});
