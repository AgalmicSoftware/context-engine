import { publishPendingWorkerGroupDrafts } from './sessionWizardPendingWorkerGroupPublish';
import type { PendingWorkerGroupDraft } from './sessionWizardPendingWorkerGroups';
import { postSignedAdminWorkerRequest } from '../Admin/adminPageSignedWorkerRequest';

const SESSION_ID = `0x${'12'.repeat(16)}`;
const ADMIN_ADDRESS = `0x${'34'.repeat(20)}`;
const draft: PendingWorkerGroupDraft = {
  groupId: 'group-draft-1',
  label: 'Research team',
  description: 'Reviews research questions.',
  imageUrl: 'https://images.example.test/research.png',
  tags: ['policy'],
  documentURLs: ['https://docs.example.test/brief'],
  memberLimit: '25',
  joinEndsAt: '2099-01-02T03:04',
  adminAddress: ADMIN_ADDRESS,
  joinMode: 'admin_add',
  memberVisibility: 'members',
};

const payloadGroup = {
  groupId: draft.groupId,
  label: draft.label,
  description: draft.description,
  imageUrl: draft.imageUrl,
  tags: ['research', 'policy'],
  documentURLs: draft.documentURLs,
  memberLimit: 25,
  joinEndsAt: new Date('2099-01-02T03:04').toISOString(),
  adminAddress: ADMIN_ADDRESS,
  joinMode: draft.joinMode,
  memberVisibility: draft.memberVisibility,
  sessionSlug: 'test-session',
  sessionId: SESSION_ID,
};

const workerRequestResult = (data: unknown) => ({
  baseUrl: 'https://worker.example',
  response: new Response(null, { status: 200 }),
  data,
});

describe('publishPendingWorkerGroupDrafts', () => {
  it('creates queued groups with stable IDs and the session default tags', async () => {
    const signTypedAdminAction = jest.fn(async (_input: unknown) => ({ auth: 'signed' }));
    const postSignedRequestImpl: jest.MockedFunction<typeof postSignedAdminWorkerRequest> = jest.fn(async (request) => {
      await request.signAdminAction({
        action: request.action || 'groups/create',
        body: request.body || {},
        chainId: null,
        workerUrl: 'https://worker.example',
      });
      return workerRequestResult({
        sessionSlug: 'test-session',
        sessionId: SESSION_ID,
        group: payloadGroup,
      });
    });

    await expect(
      publishPendingWorkerGroupDrafts({
        drafts: [draft],
        sessionConfig: { defaultGroupTags: ['research'] },
        sessionId: SESSION_ID,
        sessionSlug: 'test-session',
        signerAccount: ADMIN_ADDRESS,
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
          group: expect.objectContaining({
            groupId: draft.groupId,
            tags: ['research', 'policy'],
            documentURLs: ['https://docs.example.test/brief'],
            memberLimit: 25,
          }),
        }),
      }),
    );
    expect(signTypedAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ targetSlug: 'test-session', accountOverride: ADMIN_ADDRESS }),
    );
  });

  it('reuses an identical stable-ID group after a partial publish retry', async () => {
    const postSignedRequestImpl: jest.MockedFunction<typeof postSignedAdminWorkerRequest> = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('already exists'), { reason: 'worker_group_exists', status: 409 }))
      .mockResolvedValueOnce(
        workerRequestResult({
          sessionSlug: 'test-session',
          sessionId: SESSION_ID,
          groups: [payloadGroup],
        }),
      );

    await expect(
      publishPendingWorkerGroupDrafts({
        drafts: [draft],
        sessionConfig: { defaultGroupTags: ['research'] },
        sessionId: SESSION_ID,
        sessionSlug: 'test-session',
        signerAccount: ADMIN_ADDRESS,
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

  it('uploads a selected draft image after Worker verification and persists its retry URL', async () => {
    const imageFile = new File(['image'], 'research.png', { type: 'image/png' });
    const uploadImageImpl = jest.fn(async (_input: unknown) => 'https://worker.example/storage/read?id=image-1');
    const getWorkerTokenImpl = jest.fn(async (_input: unknown) => 'worker-token');
    const onDraftImageUploaded = jest.fn((_groupId: string, _imageUrl: string) => undefined);
    const postSignedRequestImpl: jest.MockedFunction<typeof postSignedAdminWorkerRequest> = jest.fn(async () =>
      workerRequestResult({
        sessionSlug: 'test-session',
        sessionId: SESSION_ID,
        group: payloadGroup,
      }),
    );
    const imageDraft: PendingWorkerGroupDraft = {
      ...draft,
      imageUrl: '',
      imageFile,
      adminAddress: '',
    };

    await expect(
      publishPendingWorkerGroupDrafts({
        drafts: [imageDraft],
        sessionConfig: { defaultGroupTags: ['research'], storageProfile: { backend: 'cloudflare' } },
        sessionId: SESSION_ID,
        sessionSlug: 'test-session',
        signerAccount: ADMIN_ADDRESS,
        workerUrl: 'https://worker.example',
        signTypedAdminAction: jest.fn(),
        postSignedRequestImpl,
        uploadImageImpl,
        getWorkerTokenImpl,
        onDraftImageUploaded,
      }),
    ).resolves.toEqual({ created: 1, reused: 0 });

    expect(getWorkerTokenImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'test-session',
        workerUrl: 'https://worker.example',
      }),
    );
    expect(uploadImageImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        file: imageFile,
        sessionSlug: 'test-session',
        workerUrl: 'https://worker.example',
        credentialToken: 'worker-token',
        context: { account: ADMIN_ADDRESS },
      }),
    );
    expect(onDraftImageUploaded).toHaveBeenCalledWith(
      imageDraft.groupId,
      'https://worker.example/storage/read?id=image-1',
    );
    expect(postSignedRequestImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          group: expect.objectContaining({
            imageUrl: 'https://worker.example/storage/read?id=image-1',
            adminAddress: ADMIN_ADDRESS,
          }),
        }),
      }),
    );
  });
});
