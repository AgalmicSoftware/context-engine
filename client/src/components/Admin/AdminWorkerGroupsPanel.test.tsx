import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminWorkerGroupsPanel from './AdminWorkerGroupsPanel';

const ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_ID = '0x11111111111111111111111111111111';
const OTHER_SESSION_ID = '0x22222222222222222222222222222222';

describe('AdminWorkerGroupsPanel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('manages the supported group and membership operations through signed worker requests', async () => {
    const buildGroup = (group = {}) => ({
      groupId: 'reviewers',
      sessionSlug: 'alpha',
      label: 'Reviewers',
      joinMode: 'admin_add',
      memberVisibility: 'members',
      ...group,
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Reviewers')).toBeInTheDocument();
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
    expect(screen.getByTestId('ce-admin-worker-group-create-visibility')).toHaveValue('session');
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Manage Reviewers members' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Delete Session reviewers' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(expect.objectContaining({ action: 'groups/delete' })),
    );
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
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));

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
});
