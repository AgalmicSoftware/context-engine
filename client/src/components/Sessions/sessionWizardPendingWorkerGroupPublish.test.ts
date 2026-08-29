import { publishPendingWorkerGroupDrafts } from './sessionWizardPendingWorkerGroupPublish';
import type { PendingWorkerGroupDraft } from './sessionWizardPendingWorkerGroups';

const SESSION_ID = `0x${'12'.repeat(16)}`;
const draft: PendingWorkerGroupDraft = {
  groupId: 'group-draft-1',
  label: 'Research team',
  description: 'Reviews research questions.',
  joinMode: 'admin_add',
  memberVisibility: 'members',
};

const payloadGroup = {
  ...draft,
  sessionSlug: 'test-session',
  sessionId: SESSION_ID,
  tags: ['research'],
};

describe('publishPendingWorkerGroupDrafts', () => {
  it('creates queued groups with stable IDs and the session default tags', async () => {
    const signTypedAdminAction = jest.fn(async () => ({ auth: 'signed' }));
    const postSignedRequestImpl = jest.fn(async (request) => {
      await request.signAdminAction({
        action: request.action,
        body: request.body,
        chainId: null,
        workerUrl: 'https://worker.example',
      });
      return {
        data: {
          sessionSlug: 'test-session',
          sessionId: SESSION_ID,
          group: payloadGroup,
        },
      };
    });

    await expect(
      publishPendingWorkerGroupDrafts({
        drafts: [draft],
        sessionConfig: { defaultGroupTags: ['research'] },
        sessionId: SESSION_ID,
        sessionSlug: 'test-session',
        signerAccount: `0x${'34'.repeat(20)}`,
        workerUrl: 'https://worker.example',
        signTypedAdminAction,
        postSignedRequestImpl,
      }),
    ).resolves.toEqual({ created: 1, reused: 0 });

    expect(postSignedRequestImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'groups/create',
        path: '/admin/groups/create',
        body: expect.objectContaining({
          sessionId: SESSION_ID,
          group: expect.objectContaining({ groupId: draft.groupId, tags: ['research'] }),
        }),
      }),
    );
    expect(signTypedAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ targetSlug: 'test-session', accountOverride: `0x${'34'.repeat(20)}` }),
    );
  });

  it('reuses an identical stable-ID group after a partial publish retry', async () => {
    const postSignedRequestImpl = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('already exists'), { reason: 'worker_group_exists', status: 409 }))
      .mockResolvedValueOnce({
        data: {
          sessionSlug: 'test-session',
          sessionId: SESSION_ID,
          groups: [payloadGroup],
        },
      });

    await expect(
      publishPendingWorkerGroupDrafts({
        drafts: [draft],
        sessionConfig: { defaultGroupTags: ['research'] },
        sessionId: SESSION_ID,
        sessionSlug: 'test-session',
        signerAccount: `0x${'34'.repeat(20)}`,
        workerUrl: 'https://worker.example',
        signTypedAdminAction: jest.fn(),
        postSignedRequestImpl,
      }),
    ).resolves.toEqual({ created: 0, reused: 1 });

    expect(postSignedRequestImpl.mock.calls.map(([request]) => request.action)).toEqual([
      'groups/create',
      'groups/list',
    ]);
  });
});
