import {
  createWorkerGroup,
  listWorkerGroupsAdmin,
  normalizeWorkerGroupDefaultTags,
  type PostSignedWorkerGroupRequest,
  type WorkerGroup,
} from '../../domains/worker/workerGroupPorts';
import { uploadWorkerGroupImage } from '../../domains/worker/workerGroupImageUpload';
import { resolveSessionStorageBackend } from '../../utilities/storage/sessionStorageConfig';
import { STORAGE_BACKENDS } from '../../utilities/storage/storageRefs';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import { postSignedAdminWorkerRequest } from '../Admin/adminPageSignedWorkerRequest';
import type { AnyRecord } from '../shellTypes';
import {
  buildPendingWorkerGroupInput,
  normalizePendingWorkerGroupDrafts,
  validatePendingWorkerGroupDrafts,
  type PendingWorkerGroupDraft,
} from './sessionWizardPendingWorkerGroups';

type SignPendingWorkerGroupAdminAction = (input: {
  action?: string;
  body?: AnyRecord;
  targetSlug?: string;
  workerUrl?: string;
  accountOverride?: string;
}) => Promise<AnyRecord>;

type PublishPendingWorkerGroupsInput = {
  drafts: PendingWorkerGroupDraft[];
  sessionConfig?: unknown;
  sessionId: string;
  sessionSlug: string;
  signerAccount: string;
  workerUrl: string;
  signTypedAdminAction: SignPendingWorkerGroupAdminAction;
  workerAuthContext?: unknown;
  onDraftImageUploaded?: (groupId: string, imageUrl: string) => void;
  getWorkerTokenImpl?: typeof getWorkerSessionToken;
  postSignedRequestImpl?: typeof postSignedAdminWorkerRequest;
  uploadImageImpl?: typeof uploadWorkerGroupImage;
};
const comparableGroup = (group: Partial<WorkerGroup>) => ({
  groupId: String(group.groupId || '').trim(),
  label: String(group.label || '').trim(),
  description: String(group.description || '').trim(),
  imageUrl: String(group.imageUrl || '').trim(),
  tags: Array.isArray(group.tags) ? group.tags : [],
  documentURLs: Array.isArray(group.documentURLs) ? group.documentURLs : [],
  memberLimit: Number(group.memberLimit || 0),
  joinEndsAt: String(group.joinEndsAt || '').trim(),
  adminAddress: String(group.adminAddress || '')
    .trim()
    .toLowerCase(),
  joinMode: group.joinMode || 'open',
  memberVisibility: group.memberVisibility || 'session',
});

const matchesQueuedGroup = (existing: WorkerGroup, expected: Partial<WorkerGroup>): boolean =>
  JSON.stringify(comparableGroup(existing)) === JSON.stringify(comparableGroup(expected));

const getErrorReason = (error: unknown): string =>
  error && typeof error === 'object' && 'reason' in error ? String((error as { reason?: unknown }).reason || '') : '';

export const publishPendingWorkerGroupDrafts = async ({
  drafts,
  sessionConfig,
  sessionId,
  sessionSlug,
  signerAccount,
  workerUrl,
  signTypedAdminAction,
  workerAuthContext,
  onDraftImageUploaded,
  getWorkerTokenImpl = getWorkerSessionToken,
  postSignedRequestImpl = postSignedAdminWorkerRequest,
  uploadImageImpl = uploadWorkerGroupImage,
}: PublishPendingWorkerGroupsInput): Promise<{ created: number; reused: number }> => {
  const issues = validatePendingWorkerGroupDrafts(drafts);
  if (issues.length) throw new Error(issues[0]);
  const normalizedDrafts = normalizePendingWorkerGroupDrafts(drafts);
  const defaultTags = normalizeWorkerGroupDefaultTags(sessionConfig);
  const postSignedRequest: PostSignedWorkerGroupRequest = (args = {}) => {
    const action = String(args.action || 'groups/list').trim();
    const body = args.body && typeof args.body === 'object' && !Array.isArray(args.body) ? args.body : {};
    return postSignedRequestImpl({
      ...args,
      action,
      body,
      workerUrl,
      signAdminAction: ({ action: signedAction, body: signedBody, workerUrl: signedWorkerUrl }) =>
        signTypedAdminAction({
          action: signedAction,
          body: signedBody,
          targetSlug: sessionSlug,
          workerUrl: signedWorkerUrl,
          accountOverride: signerAccount,
        }),
    });
  };

  let created = 0;
  let reused = 0;
  for (const draft of normalizedDrafts) {
    let preparedImageUrl = draft.imageUrl;
    if (draft.imageFile && !preparedImageUrl) {
      const uploadSessionConfig = {
        ...(sessionConfig && typeof sessionConfig === 'object' && !Array.isArray(sessionConfig)
          ? (sessionConfig as AnyRecord)
          : {}),
        slug: sessionSlug,
        sessionId,
        corsWorkerUrl: workerUrl,
      };
      const credentialToken =
        resolveSessionStorageBackend(uploadSessionConfig, { resource: 'images', encrypted: false }) ===
        STORAGE_BACKENDS.CLOUDFLARE
          ? await getWorkerTokenImpl({
              sessionSlug,
              sessionConfig: uploadSessionConfig,
              context: workerAuthContext || { account: signerAccount },
              workerUrl,
            })
          : '';
      preparedImageUrl = await uploadImageImpl({
        file: draft.imageFile,
        sessionSlug,
        sessionConfig: uploadSessionConfig,
        workerUrl,
        credentialToken,
        context: workerAuthContext || { account: signerAccount },
      });
      onDraftImageUploaded?.(draft.groupId, preparedImageUrl);
    }
    const group = buildPendingWorkerGroupInput({
      defaultAdminAddress: signerAccount,
      defaultTags,
      draft,
      preparedImageUrl,
    });
    try {
      await createWorkerGroup({ group, sessionId, sessionSlug, postSignedRequest });
      created += 1;
    } catch (error) {
      if (getErrorReason(error) !== 'worker_group_exists') throw error;
      const payload = await listWorkerGroupsAdmin({ sessionId, sessionSlug, postSignedRequest });
      const groups = Array.isArray(payload.groups) ? (payload.groups as WorkerGroup[]) : [];
      const existing = groups.find((entry) => entry.groupId === draft.groupId);
      if (!existing || !matchesQueuedGroup(existing, group)) {
        throw new Error(`Queued Group "${draft.label}" conflicts with an existing Worker Group.`);
      }
      reused += 1;
    }
  }
  return { created, reused };
};
