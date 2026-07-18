import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminWorkerGroupsPanel from './AdminWorkerGroupsPanel';

const ADDRESS = '0x00000000000000000000000000000000000000aa';

describe('AdminWorkerGroupsPanel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('manages the supported group and membership operations through signed worker requests', async () => {
    const postSignedRequest = jest.fn(async ({ action, body }) => {
      if (action === 'groups/list') {
        return {
          data: {
            ok: true,
            groups: [
              {
                groupId: 'reviewers',
                label: 'Reviewers',
                description: 'Can review session material.',
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
            members: [{ principal: { kind: 'evm_address', address: ADDRESS }, principalKey: `evm:${ADDRESS}` }],
          },
        };
      }
      return { data: { ok: true, body } };
    });
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Reviewers')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-label'), {
      target: { value: 'Open participants' },
    });
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-mode'), {
      target: { value: 'open' },
    });
    fireEvent.change(screen.getByTestId('ce-admin-worker-group-create-visibility'), {
      target: { value: 'session' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'groups/create',
          body: expect.objectContaining({
            group: expect.objectContaining({
              label: 'Open participants',
              joinMode: 'open',
              memberVisibility: 'session',
            }),
          }),
        }),
      ),
    );
    expect(await screen.findByText('Group created.')).toBeInTheDocument();

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
      expect(postSignedRequest).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'groups/add-member' }),
      ),
    );
    expect(await screen.findByText('Member added.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Remove ${ADDRESS}` }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'groups/remove-member' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Reviewers' }));
    await waitFor(() =>
      expect(postSignedRequest).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'groups/delete' }),
      ),
    );
  });

  it('stays read-only when the connected wallet is not the worker admin', () => {
    const postSignedRequest = jest.fn();
    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={false}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );

    expect(screen.getByText('Connect the configured worker admin wallet to manage access groups.')).toBeInTheDocument();
    expect(postSignedRequest).not.toHaveBeenCalled();
  });

  it('preserves an unsaved group draft when the signed create request fails', async () => {
    const postSignedRequest = jest.fn(async ({ action }) => {
      if (action === 'groups/list') return { data: { ok: true, groups: [] } };
      throw new Error('Group create denied.');
    });
    render(
      <AdminWorkerGroupsPanel
        canAdminWorker={true}
        sessionSlug="alpha"
        workerUrl="https://session-worker.example"
        postSignedRequest={postSignedRequest}
      />,
    );
    const label = await screen.findByTestId('ce-admin-worker-group-create-label');
    fireEvent.change(label, { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(await screen.findByText('Group create denied.')).toBeInTheDocument();
    expect(label).toHaveValue('Keep this draft');
  });
});
