import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { buildSignedAdminActionAuth, getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import { postSignedAdminWorkerRequest } from '../Admin/adminPageSignedWorkerRequest';
import WorkerSessionGroupsPanel from './WorkerSessionGroupsPanel';

const mockMembershipPanel = jest.fn();
const mockParticipantCreatePanel = jest.fn();

jest.mock('../../utilities/worker/workerAuth', () => ({
  buildSignedAdminActionAuth: jest.fn(),
  getWorkerSessionToken: jest.fn(),
}));
jest.mock('../Admin/adminPageSignedWorkerRequest', () => ({
  postSignedAdminWorkerRequest: jest.fn(),
}));
jest.mock('./WorkerGroupMembershipPanel', () => (props: unknown) => {
  mockMembershipPanel(props);
  return <div data-testid="membership-panel">Memberships</div>;
});
jest.mock('./WorkerParticipantGroupCreatePanel', () => (props: unknown) => {
  mockParticipantCreatePanel(props);
  return <div data-testid="participant-create-panel">Participant create</div>;
});

const mockGetWorkerSessionToken = getWorkerSessionToken as jest.MockedFunction<typeof getWorkerSessionToken>;
const mockBuildSignedAdminActionAuth = buildSignedAdminActionAuth as jest.MockedFunction<
  typeof buildSignedAdminActionAuth
>;
const mockPostSignedAdminWorkerRequest = postSignedAdminWorkerRequest as jest.MockedFunction<
  typeof postSignedAdminWorkerRequest
>;

const ADMIN = '0x00000000000000000000000000000000000000aa';
const SESSION_ID = '0x11111111111111111111111111111111';
const OTHER_SESSION_ID = '0x22222222222222222222222222222222';
const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
const sessionConfig = {
  slug: 'demo-sh',
  sessionIdHex: SESSION_ID,
  corsWorkerUrl: 'https://demo-sh-worker.example',
  adminAddress: ADMIN,
  networkChainId: 11155420,
  sessionModeProfile,
};

describe('WorkerSessionGroupsPanel', () => {
  beforeEach(() => {
    mockBuildSignedAdminActionAuth.mockResolvedValue({
      address: ADMIN,
      signature: '0xsigned',
      action: 'groups/list',
      slug: 'demo-sh',
      bodyHash: '0xbody',
      nonce: 'nonce',
      audience: 'https://demo-sh-worker.example',
      expiration: 2_000_000_000,
    });
    mockPostSignedAdminWorkerRequest.mockImplementation(async (args) => {
      await args.signAdminAction?.({
        action: String(args.action || ''),
        body: args.body || {},
        chainId: 11155420,
        workerUrl: String(args.workerUrl || ''),
      });
      const baseUrl = String(args.workerUrl || '');
      if (args.action === 'groups/create') {
        const group = (args.body?.group || {}) as Record<string, unknown>;
        const data = {
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'demo-sh',
          group: {
            groupId: 'created-group',
            sessionSlug: 'demo-sh',
            label: String(group.label || ''),
            description: String(group.description || ''),
            imageUrl: String(group.imageUrl || ''),
            joinMode: group.joinMode === 'open' ? 'open' : 'admin_add',
            memberVisibility: ['members', 'session'].includes(String(group.memberVisibility || ''))
              ? String(group.memberVisibility)
              : 'admin_only',
          },
        };
        return {
          baseUrl,
          response: new Response(JSON.stringify(data), { status: 200 }),
          data,
        };
      }
      const data = { ok: true, sessionId: SESSION_ID, sessionSlug: 'demo-sh', groups: [] };
      return {
        baseUrl,
        response: new Response(JSON.stringify(data), { status: 200 }),
        data,
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads the worker credential and creates through the real native admin component for the exact session', async () => {
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
    expect(screen.getByTestId('ce-admin-worker-groups')).toBeInTheDocument();
    expect(mockMembershipPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        workerUrl: 'https://demo-sh-worker.example',
        workerToken: 'worker-session-token',
        canReadGroups: true,
        sessionId: SESSION_ID,
        sessionSlug: 'demo-sh',
      }),
    );
    expect(mockGetWorkerSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'demo-sh',
        workerUrl: 'https://demo-sh-worker.example',
        context: expect.objectContaining({ chainId: 1 }),
      }),
    );
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), {
      target: { value: 'Native reviewers' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    await waitFor(() =>
      expect(mockPostSignedAdminWorkerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'groups/create',
          path: '/admin/groups/create',
          workerUrl: 'https://demo-sh-worker.example',
          body: expect.objectContaining({
            sessionId: SESSION_ID,
            group: expect.objectContaining({ label: 'Native reviewers' }),
          }),
        }),
      ),
    );
    expect(await screen.findByText('Group created.')).toBeInTheDocument();
    expect(mockBuildSignedAdminActionAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups/create',
        body: expect.objectContaining({ sessionId: SESSION_ID }),
        slug: 'demo-sh',
        workerUrl: 'https://demo-sh-worker.example',
        context: expect.objectContaining({ chainId: 1 }),
      }),
    );
    expect(screen.queryByLabelText(/network|contract address|rpc|gas|mint/i)).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('ce-admin-worker-groups')).not.toBeInTheDocument();
  });

  it('uses only the validated hybrid profile chain for Worker auth signing context', async () => {
    const hybridProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    hybridProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    hybridProfile.evm.registryChainId = 84532;
    hybridProfile.encryption = { mode: 'lit' };
    hybridProfile.storage.payloadAccessControl = {
      ...hybridProfile.storage.payloadAccessControl,
      encryption: 'lit',
    };
    mockGetWorkerSessionToken.mockResolvedValue('hybrid-worker-token');

    render(
      <WorkerSessionGroupsPanel
        account={ADMIN}
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={{
          ...sessionConfig,
          networkChainId: 11155420,
          sessionModeProfile: hybridProfile,
        }}
        sessionSlug="demo-sh"
        showCreate={false}
      />,
    );

    await waitFor(() =>
      expect(mockGetWorkerSessionToken).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ chainId: 84532 }),
        }),
      ),
    );
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
    expect(screen.queryByTestId('ce-admin-worker-groups')).not.toBeInTheDocument();
    expect(screen.queryByTestId('participant-create-panel')).not.toBeInTheDocument();
  });

  it('lets a non-admin participant create when the exact session policy enables it', async () => {
    mockGetWorkerSessionToken.mockResolvedValue('participant-worker-token');
    render(
      <WorkerSessionGroupsPanel
        account="0x00000000000000000000000000000000000000bb"
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={{
          ...sessionConfig,
          sessionId: SESSION_ID,
          sessionIdHex: undefined,
          groupCreationPolicy: 'participants',
        }}
        sessionSlug="demo-sh"
        showCreate={true}
      />,
    );

    expect(await screen.findByTestId('participant-create-panel')).toBeInTheDocument();
    expect(mockParticipantCreatePanel).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        sessionSlug: 'demo-sh',
        workerToken: 'participant-worker-token',
        workerUrl: 'https://demo-sh-worker.example',
      }),
    );
    expect(screen.queryByTestId('ce-admin-worker-groups')).not.toBeInTheDocument();
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

  it('does not reuse a late token when only the canonical session identity changes', async () => {
    let resolveFirstIdentity: (token: string) => void = () => {};
    mockGetWorkerSessionToken
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirstIdentity = resolve;
          }),
      )
      .mockResolvedValueOnce('second-identity-token');

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
    await waitFor(() => expect(mockGetWorkerSessionToken).toHaveBeenCalledTimes(1));

    rerender(
      <WorkerSessionGroupsPanel
        account={ADMIN}
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={{ ...sessionConfig, sessionIdHex: OTHER_SESSION_ID }}
        sessionSlug="demo-sh"
        showCreate={false}
      />,
    );

    await waitFor(() =>
      expect(mockMembershipPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sessionId: OTHER_SESSION_ID,
          sessionSlug: 'demo-sh',
          workerToken: 'second-identity-token',
          workerUrl: 'https://demo-sh-worker.example',
        }),
      ),
    );

    await act(async () => {
      resolveFirstIdentity('stale-first-identity-token');
      await Promise.resolve();
    });
    expect(mockMembershipPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: OTHER_SESSION_ID,
        workerToken: 'second-identity-token',
      }),
    );
  });

  it('fails closed before authentication when the config slug is not the requested session slug', () => {
    render(
      <WorkerSessionGroupsPanel
        account={ADMIN}
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={sessionConfig}
        sessionSlug="another-session"
        showCreate={true}
      />,
    );

    expect(screen.getByText(/exact, validated Worker Groups profile/i)).toBeInTheDocument();
    expect(mockGetWorkerSessionToken).not.toHaveBeenCalled();
    expect(mockMembershipPanel).not.toHaveBeenCalled();
    expect(mockPostSignedAdminWorkerRequest).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', { ...sessionConfig, sessionIdHex: undefined }],
    [
      'mismatched',
      {
        ...sessionConfig,
        sessionId: OTHER_SESSION_ID,
        sessionIdHex: SESSION_ID,
      },
    ],
  ])('fails closed before authentication when the canonical session identity is %s', (_label, invalidConfig) => {
    render(
      <WorkerSessionGroupsPanel
        account={ADMIN}
        provider="wagmi"
        networkChainId={11155420}
        sessionConfig={invalidConfig}
        sessionSlug="demo-sh"
        showCreate={true}
      />,
    );

    expect(screen.getByText(/exact, validated Worker Groups profile/i)).toBeInTheDocument();
    expect(mockGetWorkerSessionToken).not.toHaveBeenCalled();
    expect(mockMembershipPanel).not.toHaveBeenCalled();
    expect(mockPostSignedAdminWorkerRequest).not.toHaveBeenCalled();
  });
});
