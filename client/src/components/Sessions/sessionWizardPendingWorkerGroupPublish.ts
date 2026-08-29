import {
  createWorkerGroup,
  listWorkerGroupsAdmin,
  normalizeWorkerGroupDefaultTags,
  type PostSignedWorkerGroupRequest,
  type WorkerGroup,
} from '../../domains/worker/workerGroupPorts';
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
  postSignedRequestImpl?: typeof postSignedAdminWorkerRequest;
};
const comparableGroup = (group: Partial<WorkerGroup>) => ({
  groupId: String(group.groupId || '').trim(),
  label: String(group.label || '').trim(),
  description: String(group.description || '').trim(),
  tags: Array.isArray(group.tags) ? group.tags : [],
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
  postSignedRequestImpl = postSignedAdminWorkerRequest,
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
    const group = buildPendingWorkerGroupInput({ defaultTags, draft });
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
