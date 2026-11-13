import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createWorkerAuthRemoteError } from '../../utilities/worker/workerAuthRemoteError';
import type { PostSignedWorkerGroupRequest, SignedWorkerGroupRequestArgs } from '../../domains/worker/workerGroupPorts';
import { saveWorkerGroupPassword } from '../../domains/worker/workerGroupSecrets';
import AdminWorkerGroupsPanel from './AdminWorkerGroupsPanel';

// Stretching a password takes far too long in jsdom; workerGroupSecrets.test.ts covers the real derivation.
jest.mock('../../domains/worker/workerGroupSecrets', () => {
  type MockSecrets = typeof import('../../domains/worker/workerGroupSecrets');
  const actual = jest.requireActual<MockSecrets>('../../domains/worker/workerGroupSecrets');
  const ports = jest.requireActual<typeof import('../../domains/worker/workerGroupPorts')>(
    '../../domains/worker/workerGroupPorts',
  );
  return {
    ...actual,
    saveWorkerGroupPassword: jest.fn(
      ({ password: _password, ...request }: Parameters<MockSecrets['saveWorkerGroupPassword']>[0]) =>
        ports.setWorkerGroupPassword({ ...request, signer: `0x${'2'.repeat(40)}` }),
    ),
  };
});

const ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_ID = '0x11111111111111111111111111111111';
const OTHER_SESSION_ID = '0x22222222222222222222222222222222';

describe('AdminWorkerGroupsPanel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prefills Worker-native tag defaults for admin-created groups', () => {
    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionId={SESSION_ID}
        sessionConfig={{ defaultGroupTags: ['facilitators', 'reviewers'] }}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove facilitators' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove reviewers' })).toBeInTheDocument();
  });

  it('says when signing is rate limited instead of showing an internal code', async () => {
    const postSignedRequest = jest.fn(async () => {
      throw createWorkerAuthRemoteError({ kind: 'admin_nonce', payload: {}, status: 429 });
    });
    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), { target: { value: 'Salon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    expect(await screen.findByText('Too many sign-in attempts. Wait a minute and try again.')).toBeInTheDocument();
    expect(screen.queryByText('worker_group_admin_request_failed')).not.toBeInTheDocument();
  });

  it('starts a new group open to anyone who can see the session', async () => {
    const postSignedRequest = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        group: {
          groupId: 'salon',
          sessionSlug: 'alpha',
          label: 'Salon',
          joinMode: 'open',
          memberVisibility: 'session',
        },
      },
    });
    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        createOnly
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );
    const mode = screen.getByTestId('ce-admin-worker-group-create-mode');
    const visibility = screen.getByTestId('ce-admin-worker-group-create-visibility');
    expect(mode).toHaveValue('open');
    expect(visibility).toHaveValue('session');
    // A roster that admins fill by hand doesn't stay visible to the session, and an open group doesn't stay hidden.
    fireEvent.change(mode, { target: { value: 'admin_add' } });
    expect(visibility).toHaveValue('admin_only');
    fireEvent.change(mode, { target: { value: 'open' } });
    expect(visibility).toHaveValue('session');
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), { target: { value: 'Salon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'groups/create',
          body: expect.objectContaining({
            group: expect.objectContaining({ label: 'Salon', joinMode: 'open', memberVisibility: 'session' }),
          }),
        }),
      ),
    );
  });

  it('manages the supported group and membership operations through signed worker requests', async () => {
    const buildGroup = (group: Record<string, unknown> = {}) => {
      const built: Record<string, unknown> = {
        groupId: 'reviewers',
        sessionSlug: 'alpha',
        label: 'Reviewers',
        joinMode: 'admin_add',
        memberVisibility: 'members',
        ...group,
      };
      if (built.memberLimit === 0) delete built.memberLimit;
      if (!built.joinEndsAt) delete built.joinEndsAt;
      if (!built.adminAddress) delete built.adminAddress;
      return built;
    };
    const postSignedRequest = jest.fn(async ({ action, body }) => {
      if (action === 'groups/list') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            groups: [
              {
                groupId: 'reviewers',
                sessionSlug: 'alpha',
                label: 'Reviewers',
                description: 'Can review session material.',
                imageUrl: 'https://ar-io.dev/reviewers-image',
                joinMode: 'admin_add',
                memberVisibility: 'members',
              },
            ],
          },
        };
      }
      if (action === 'groups/list-members') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            group: buildGroup(),
            members: [
              {
                sessionSlug: 'alpha',
                principal: { kind: 'evm_address', address: ADDRESS },
                principalKey: `evm:${ADDRESS}`,
              },
            ],
          },
        };
      }
      if (action === 'groups/create') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            group: buildGroup({ groupId: 'open-participants', ...body?.group }),
          },
        };
      }
      if (action === 'groups/update') {
        return {
          data: { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', group: buildGroup(body?.group) },
        };
      }
      if (action === 'groups/add-member') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            group: buildGroup(),
            member: { sessionSlug: 'alpha', principal: body?.principal },
          },
        };
      }
      return { data: { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', body } };
    });
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );

    // The theme's plain outline-secondary label is its button fill: 1.1:1 in Minimal, and 1:1 in Classic 95.
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveClass('subtleActionButton');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Reviewers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Reviewers' })).toHaveClass('subtleActionButton');
    expect(screen.getByRole('button', { name: 'Manage Reviewers members' })).toHaveClass('subtleActionButton');
    expect(screen.getByRole('button', { name: 'Delete Reviewers' })).toHaveClass('dangerActionButton');
    expect(postSignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups/list',
        workerUrl: 'https://session-worker.example',
      }),
    );
    expect(screen.getByTestId('ce-admin-worker-group-image')).toHaveAttribute(
      'src',
      'https://ar-io.dev/reviewers-image',
    );

    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), {
      target: { value: 'Open participants' },
    });
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-description'), {
      target: { value: 'Public acceleration discussion group.' },
    });
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-image'), {
      target: { value: 'https://upload.wikimedia.org/wikipedia/commons/rocket.jpg' },
    });
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-mode'), {
      target: { value: 'open' },
    });
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'reviewers' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    fireEvent.change(screen.getByLabelText('Reference URL'), {
      target: { value: 'https://docs.example.test/brief' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add reference URL' }));
    fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Join deadline'), { target: { value: '2030-01-01T12:00' } });
    fireEvent.change(screen.getByLabelText('Group admin address'), { target: { value: ADDRESS } });
    expect(screen.getByTestId('ce-admin-worker-group-create-visibility')).toHaveValue('session');
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'groups/create',
          workerUrl: 'https://session-worker.example',
          body: expect.objectContaining({
            sessionId: SESSION_ID,
            group: expect.objectContaining({
              label: 'Open participants',
              description: 'Public acceleration discussion group.',
              imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/rocket.jpg',
              tags: ['reviewers'],
              documentURLs: ['https://docs.example.test/brief'],
              memberLimit: 25,
              joinEndsAt: new Date('2030-01-01T12:00').toISOString(),
              adminAddress: ADDRESS,
              joinMode: 'open',
              memberVisibility: 'session',
            }),
          }),
        }),
      ),
    );
    expect(await screen.findByText('Group created.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/network/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contract address/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Reviewers' }));
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-edit-label'), {
      target: { value: 'Session reviewers' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'groups/update',
          body: expect.objectContaining({ groupId: 'reviewers' }),
        }),
      ),
    );
    await screen.findByRole('button', { name: 'Delete Session reviewers' });

    fireEvent.click(screen.getByRole('button', { name: 'Manage Session reviewers members' }));
    expect(await screen.findByText(ADDRESS)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-member-address'), { target: { value: ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(expect.objectContaining({ action: 'groups/add-member' })),
    );
    expect(await screen.findByText('Member added.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Remove ${ADDRESS}` }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(expect.objectContaining({ action: 'groups/remove-member' })),
    );
    expect(await screen.findByText('Member removed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Session reviewers' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(expect.objectContaining({ action: 'groups/delete' })),
    );
  });

  describe('who can remove members', () => {
    const listed = [
      { groupId: 'kept', sessionSlug: 'alpha', label: 'Kept', joinMode: 'open', memberVisibility: 'session' },
      { groupId: 'legacy', sessionSlug: 'alpha', label: 'Legacy', joinMode: 'open', memberVisibility: 'session' },
    ];
    // A current Worker saves the setting it is sent; one deployed before the setting drops it.
    const workerReplies = ({ keepsSetting }: { keepsSetting: boolean }) =>
      jest.fn(async ({ action, body }) => {
        const saved = (group: Record<string, unknown>) => {
          const copy: Record<string, unknown> = { sessionSlug: 'alpha', ...group };
          ['memberLimit', 'joinEndsAt', 'adminAddress'].forEach((field) => {
            if (!copy[field]) delete copy[field];
          });
          if (!keepsSetting) delete copy.removalAuth;
          return copy;
        };
        const reply = (data: Record<string, unknown>) => ({
          data: { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', ...data },
        });
        const groups = [{ ...listed[0], removalAuth: 'member_only' }, listed[1]];
        if (action === 'groups/list') return reply({ groups });
        if (action === 'groups/create') return reply({ group: saved({ groupId: 'salon', ...body?.group }) });
        if (action === 'groups/update') return reply({ group: saved({ groupId: body?.groupId, ...body?.group }) });
        if (action === 'groups/list-members') {
          return reply({
            group: groups.find((group) => group.groupId === body?.groupId),
            members: [
              { sessionSlug: 'alpha', principal: { kind: 'evm_address', address: ADDRESS }, principalKey: ADDRESS },
            ],
          });
        }
        return reply({});
      });
    const renderPanel = (postSignedRequest: ReturnType<typeof workerReplies>) =>
      render(
        <AdminWorkerGroupsPanel
          canAdminWorker={true}
          sessionId={SESSION_ID}
          sessionSlug="alpha"
          workerUrl="https://session-worker.example"
          postSignedRequest={postSignedRequest}
        />,
      );
    const sentGroup = (postSignedRequest: ReturnType<typeof workerReplies>, action: string) =>
      postSignedRequest.mock.calls.filter(([request]) => request.action === action).at(-1)?.[0].body.group;

    it('is set on create and edit, listed, and decides whether admins see Remove', async () => {
      const postSignedRequest = workerReplies({ keepsSetting: true });
      renderPanel(postSignedRequest);
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      expect(await screen.findByText('Who can remove members: The member only')).toBeInTheDocument();
      expect(screen.getByText('Who can remove members: Admins and the member')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Manage Kept members' }));
      expect(await screen.findByText(ADDRESS)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Remove ${ADDRESS}` })).not.toBeInTheDocument();
      expect(screen.getByTestId('ce-admin-worker-group-members-removal-auth')).toHaveTextContent(
        'Who can remove members: The member only',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Manage Legacy members' }));
      expect(await screen.findByRole('button', { name: `Remove ${ADDRESS}` })).toBeInTheDocument();
      expect(screen.queryByTestId('ce-admin-worker-group-members-removal-auth')).not.toBeInTheDocument();

      const createSetting = screen.getByTestId('ce-admin-worker-group-create-removal-auth');
      expect(createSetting).toHaveValue('both');
      fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), { target: { value: 'Salon' } });
      fireEvent.change(createSetting, { target: { value: 'neither' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      expect(await screen.findByText('Group created.')).toBeInTheDocument();
      expect(sentGroup(postSignedRequest, 'groups/create')).toEqual(
        expect.objectContaining({ removalAuth: 'neither' }),
      );
      expect(screen.getByTestId('ce-admin-worker-group-create-removal-auth')).toHaveValue('both');

      fireEvent.click(screen.getByRole('button', { name: 'Edit Kept' }));
      const editSetting = screen.getByTestId('ce-admin-worker-group-edit-removal-auth');
      expect(editSetting).toHaveValue('member_only');
      fireEvent.change(editSetting, { target: { value: 'admin_only' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
      expect(await screen.findByText('Group updated.')).toBeInTheDocument();
      expect(sentGroup(postSignedRequest, 'groups/update')).toEqual(
        expect.objectContaining({ removalAuth: 'admin_only' }),
      );
      expect(screen.getByText('Who can remove members: Admins only')).toBeInTheDocument();
    });

    it('says when an older Worker ignores the setting', async () => {
      const postSignedRequest = workerReplies({ keepsSetting: false });
      renderPanel(postSignedRequest);
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      await screen.findByText('Who can remove members: The member only');

      fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), { target: { value: 'Salon' } });
      fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-removal-auth'), {
        target: { value: 'admin_only' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      expect(await screen.findByText(/^Group created\. This session’s Worker doesn’t support/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Edit Legacy' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
      expect(await screen.findByText('Group updated.')).toBeInTheDocument();
    });
  });

  it('loads additional signed member pages without presenting the first page as complete', async () => {
    const secondAddress = '0x00000000000000000000000000000000000000bb';
    const group = {
      groupId: 'reviewers',
      sessionSlug: 'alpha',
      label: 'Reviewers',
      joinMode: 'admin_add',
      memberVisibility: 'members',
    };
    const postSignedRequest = jest.fn(async ({ action, body }) => {
      if (action === 'groups/list') {
        return { data: { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', groups: [group] } };
      }
      if (action === 'groups/list-members' && body?.cursor === 'page-2') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            group,
            members: [
              {
                sessionSlug: 'alpha',
                principal: { kind: 'evm_address', address: secondAddress },
                principalKey: `evm:${secondAddress}`,
              },
            ],
            nextCursor: '',
          },
        };
      }
      return {
        data: {
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'alpha',
          group,
          members: [
            {
              sessionSlug: 'alpha',
              principal: { kind: 'evm_address', address: ADDRESS },
              principalKey: `evm:${ADDRESS}`,
            },
            {
              sessionSlug: 'alpha',
              principal: { kind: 'telegram', principalId: 'telegram:12345' },
              principalKey: 'telegram:12345',
            },
          ],
          nextCursor: 'page-2',
        },
      };
    });

    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Manage Reviewers members' }));
    expect(await screen.findByText(ADDRESS)).toBeInTheDocument();
    expect(screen.getByText('telegram:12345')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove telegram:12345' })).not.toBeInTheDocument();
    const loadMore = screen.getByRole('button', { name: 'Load more members' });
    fireEvent.click(loadMore);

    expect(await screen.findByText(secondAddress)).toBeInTheDocument();
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more members' })).not.toBeInTheDocument();
    expect(postSignedRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups/list-members',
        body: {
          groupId: 'reviewers',
          cursor: 'page-2',
          sessionId: SESSION_ID,
        },
      }),
    );
  });

  it('stays read-only when the connected wallet is not the worker admin', () => {
    const postSignedRequest = jest.fn();
    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={false}
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );

    expect(screen.getByText('Connect the configured worker admin wallet to manage access groups.')).toBeInTheDocument();
    expect(postSignedRequest).not.toHaveBeenCalled();
  });

  it('preserves an unsaved group draft without rendering arbitrary signed-request errors', async () => {
    const canarySignature = '0xsigned-admin-canary-never-render';
    const postSignedRequest = jest.fn(async ({ action }) => {
      if (action === 'groups/list') {
        return { data: { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', groups: [] } };
      }
      throw new Error(`Worker echoed signature ${canarySignature}`);
    });
    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );
    const label = await screen.findByTestId('ce-admin-worker-group-create-label');
    fireEvent.change(label, { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    expect(await screen.findByText('worker_group_admin_request_failed')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(canarySignature, 'i'))).not.toBeInTheDocument();
    expect(label).toHaveValue('Keep this draft');
  });

  it('clears drafts and ignores a late admin list when only the exact session identity changes', async () => {
    let resolveFirstIdentity: (value: { data: unknown }) => void = () => {};
    const firstIdentityRequest = jest.fn(
      () =>
        new Promise<{ data: unknown }>((resolve) => {
          resolveFirstIdentity = resolve;
        }),
    );
    const secondIdentityRequest = jest.fn(async () => ({
      data: {
        ok: true,
        sessionId: OTHER_SESSION_ID,
        sessionSlug: 'alpha',
        groups: [
          {
            groupId: 'second-reviewers',
            sessionSlug: 'alpha',
            label: 'Second-identity reviewers',
            joinMode: 'open',
            memberVisibility: 'session',
          },
        ],
      },
    }));

    const { rerender } = render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={firstIdentityRequest}
        autoLoad={true}
      />,
    );
    await waitFor(() => expect(firstIdentityRequest).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), {
      target: { value: 'Alpha draft' },
    });

    rerender(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionId={OTHER_SESSION_ID}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={secondIdentityRequest}
        autoLoad={true}
      />,
    );

    expect(screen.getByTestId('ce-admin-worker-group-create-label')).toHaveValue('');
    expect(await screen.findByText('Second-identity reviewers')).toBeInTheDocument();

    await act(async () => {
      resolveFirstIdentity({
        data: {
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'alpha',
          groups: [
            {
              groupId: 'first-reviewers',
              sessionSlug: 'alpha',
              label: 'First-identity reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
          ],
        },
      });
      await Promise.resolve();
    });

    expect(screen.getByText('Second-identity reviewers')).toBeInTheDocument();
    expect(screen.queryByText('First-identity reviewers')).not.toBeInTheDocument();
  });

  describe('join choices', () => {
    const CHOICES = { groupJoinChoices: true, groupMemberCeiling: 2000 };
    const respond = (data: Record<string, unknown>) => ({
      data: { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', ...data },
    });
    const group = (fields: Record<string, unknown>) => ({
      groupId: 'salon',
      sessionSlug: 'alpha',
      label: 'Salon',
      memberVisibility: 'members',
      ...fields,
    });
    type Request = SignedWorkerGroupRequestArgs;
    const renderPanel = (
      postSignedRequest: PostSignedWorkerGroupRequest,
      sessionConfig: unknown = CHOICES,
      autoLoad = false,
    ) =>
      render(
        <AdminWorkerGroupsPanel
          canAdminWorker={true}
          sessionId={SESSION_ID}
          sessionConfig={sessionConfig}
          sessionSlug="alpha"
          workerUrl="https://session-worker.example"
          postSignedRequest={postSignedRequest}
          autoLoad={autoLoad}
        />,
      );
    const optionLabels = () =>
      Array.from((screen.getByTestId('ce-admin-worker-group-create-mode') as HTMLSelectElement).options).map(
        (option) => option.textContent,
      );

    it('offers the on-chain labels only when the Worker has join choices', () => {
      const { unmount } = renderPanel(jest.fn(), {});
      expect(optionLabels()).toEqual(['Public URL', 'Admin adds members']);
      expect(screen.queryByLabelText('Group password')).not.toBeInTheDocument();
      unmount();
      renderPanel(jest.fn());
      expect(optionLabels()).toEqual(['One-use URLs', 'Group Password', 'Public URL', 'Admin adds members']);
    });

    it('creates a Group Password group, sets its signer and shows the password once', async () => {
      const postSignedRequest = jest.fn(async ({ action, body }: Request) => {
        if (action === 'groups/create') {
          const { joinMode, listed } = body?.group as Record<string, unknown>;
          return respond({ group: group({ joinMode, listed, passwordSet: false }) });
        }
        if (action === 'groups/password/set')
          return respond({ groupId: 'salon', passwordSet: true, signerSetAt: '2026-11-12T00:00:00.000Z' });
        throw new Error(`unexpected ${action}`);
      });
      renderPanel(postSignedRequest);
      fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-mode'), {
        target: { value: 'group_password' },
      });
      fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), { target: { value: 'Salon' } });
      fireEvent.change(screen.getByLabelText('Group password'), { target: { value: 'short' } });
      expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
      // A joiner's typed text is trimmed, so a password with an edge space could never be entered.
      fireEvent.change(screen.getByLabelText('Group password'), { target: { value: 'river-stone-lamp ' } });
      expect(screen.getByText('No spaces at the start or end.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Group password'), { target: { value: 'river-stone-lamp-oak-moss' } });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Show in the group list' }));
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

      const reveal = await screen.findByTestId('ce-admin-worker-group-password-reveal');
      expect(reveal).toHaveTextContent('river-stone-lamp-oak-moss');
      const [create, setPassword] = postSignedRequest.mock.calls.map(([request]) => request);
      expect(create.body?.group).toMatchObject({ joinMode: 'group_password', listed: false });
      expect(JSON.stringify(create.body)).not.toContain('river-stone');
      expect(setPassword).toMatchObject({ action: 'groups/password/set', body: { groupId: 'salon' } });
      expect(saveWorkerGroupPassword).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'river-stone-lamp-oak-moss', groupId: 'salon', sessionId: SESSION_ID }),
      );
      expect(JSON.stringify(setPassword.body)).not.toContain('river-stone');
    });

    it('makes one-use links shown once and revokes them by hash', async () => {
      const counts = { unused: 1, used: 1, revoked: 0 };
      const listed = [
        { hash: 'a'.repeat(64), state: 'unused' },
        { hash: 'b'.repeat(64), state: 'used', usedAt: '2026-11-20T10:00:00.000Z' },
      ];
      const postSignedRequest = jest.fn(async ({ action, body }: Request) => {
        if (action === 'groups/list')
          return respond({ groups: [group({ joinMode: 'one_use', listed: false, invites: counts })] });
        if (action === 'groups/invites/list') return respond({ groupId: 'salon', invites: listed, counts });
        if (action === 'groups/invites/add')
          return respond({ groupId: 'salon', added: 2, counts: { ...counts, unused: 3 } });
        if (action === 'groups/invites/revoke')
          return respond({ groupId: 'salon', revoked: 1, counts: { unused: 0, used: 1, revoked: 1 } });
        throw new Error(`unexpected ${action} ${JSON.stringify(body)}`);
      });
      renderPanel(postSignedRequest, CHOICES, true);
      expect(await screen.findByText('Not in the group list')).toBeInTheDocument();
      expect(screen.getByText('One-use URLs', { selector: 'span' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Invites for Salon' }));
      expect(await screen.findByText('aaaaaaaa')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Revoke link bbbbbbbb' })).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('How many'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate Additional Password Invites' }));
      const fresh = await screen.findByTestId('ce-admin-worker-group-fresh-invites');
      const add = postSignedRequest.mock.calls
        .map(([request]) => request)
        .find((r) => r.action === 'groups/invites/add');
      const hashes = add?.body?.hashes as string[];
      expect(hashes).toHaveLength(2);
      hashes.forEach((hash) => expect(hash).toMatch(/^[0-9a-f]{64}$/));
      expect(fresh).toHaveTextContent('they won’t be shown again');

      jest.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByRole('button', { name: 'Revoke link aaaaaaaa' }));
      expect(await screen.findByText('1 link revoked.')).toBeInTheDocument();
      const revoke = postSignedRequest.mock.calls
        .map(([request]) => request)
        .find((r) => r.action === 'groups/invites/revoke');
      expect(revoke?.body).toMatchObject({ groupId: 'salon', hashes: ['a'.repeat(64)] });
    });
  });
});
