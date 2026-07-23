import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import WorkerSessionGroupsPanel from './WorkerSessionGroupsPanel';

const mockMembershipPanel = jest.fn();
const mockAdminPanel = jest.fn();

jest.mock('../../utilities/worker/workerAuth', () => ({
  buildSignedAdminActionAuth: jest.fn(),
  getWorkerSessionToken: jest.fn(),
}));
jest.mock('./WorkerGroupMembershipPanel', () => (props: unknown) => {
  mockMembershipPanel(props);
  return <div data-testid="membership-panel">Memberships</div>;
});
jest.mock('../Admin/AdminWorkerGroupsPanel', () => (props: unknown) => {
  mockAdminPanel(props);
  return <div data-testid="admin-groups-panel">Create Cloudflare group</div>;
});

const mockGetWorkerSessionToken = getWorkerSessionToken as jest.MockedFunction<typeof getWorkerSessionToken>;

const ADMIN = '0x00000000000000000000000000000000000000aa';
const sessionConfig = {
  slug: 'demo-sh',
  corsWorkerUrl: 'https://demo-sh-worker.example',
  adminAddress: ADMIN,
  networkChainId: 11155420,
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
};

describe('WorkerSessionGroupsPanel', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads the worker credential and exposes native group management to the configured admin', async () => {
    mockGetWorkerSessionToken.mockResolvedValue('worker-session-token');

    render(
      <WorkerSessionGroupsPanel
        account={ADMIN}
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={sessionConfig}
        sessionSlug="demo-sh"
        showCreate={true}
      />,
    );

    expect(await screen.findByTestId('membership-panel')).toBeInTheDocument();
    expect(screen.getByTestId('admin-groups-panel')).toBeInTheDocument();
    expect(mockMembershipPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        workerUrl: 'https://demo-sh-worker.example',
        workerToken: 'worker-session-token',
        canReadGroups: true,
      }),
    );
    expect(mockAdminPanel).toHaveBeenCalledWith(
      expect.objectContaining({ autoLoad: true, canAdminWorker: true, sessionSlug: 'demo-sh' }),
    );
  });

  it('asks a signed-out visitor to sign in without rendering contract management', () => {
    const toggleLoginModal = jest.fn();
    render(
      <WorkerSessionGroupsPanel
        account=""
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={sessionConfig}
        sessionSlug="demo-sh"
        showCreate={false}
        toggleLoginModal={toggleLoginModal}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(mockAdminPanel).not.toHaveBeenCalled();
  });

  it('keeps a non-admin account out of the worker create panel', async () => {
    mockGetWorkerSessionToken.mockResolvedValue('worker-session-token');
    render(
      <WorkerSessionGroupsPanel
        account="0x00000000000000000000000000000000000000bb"
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={sessionConfig}
        sessionSlug="demo-sh"
        showCreate={true}
      />,
    );

    await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalled());
    expect(screen.getByText('Only the configured worker admin can create groups.')).toBeInTheDocument();
    expect(mockAdminPanel).not.toHaveBeenCalled();
  });

  it('does not reuse a stale worker token after the active account changes', async () => {
    let resolveFirst: (token: string) => void = () => {};
    mockGetWorkerSessionToken
      .mockImplementationOnce(() => new Promise<string>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce('second-account-token');
    const { rerender } = render(
      <WorkerSessionGroupsPanel
        account={ADMIN}
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={sessionConfig}
        sessionSlug="demo-sh"
        showCreate={false}
      />,
    );

    rerender(
      <WorkerSessionGroupsPanel
        account="0x00000000000000000000000000000000000000bb"
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={sessionConfig}
        sessionSlug="demo-sh"
        showCreate={false}
      />,
    );
    await waitFor(() =>
      expect(mockMembershipPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({ workerToken: 'second-account-token' }),
      ),
    );

    resolveFirst('stale-first-account-token');
    await Promise.resolve();
    expect(mockMembershipPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ workerToken: 'second-account-token' }),
    );
  });
});
