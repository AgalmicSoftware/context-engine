import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';

type UnknownRecord = Record<string, unknown>;

export type WorkerGroupJoinMode = 'open' | 'admin_add';
export type WorkerGroupMemberVisibility = 'admin_only' | 'members' | 'session';

export type WorkerGroup = {
  groupId: string;
  sessionSlug?: string;
  label: string;
  description?: string;
  joinMode: WorkerGroupJoinMode;
  memberVisibility: WorkerGroupMemberVisibility;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkerGroupPrincipal = {
  kind: 'evm_address';
  address: string;
};

export type WorkerGroupMember = {
  groupId?: string;
  principal?: WorkerGroupPrincipal;
  principalKey?: string;
  addedAt?: string;
};

export type WorkerGroupMembership = {
  group: WorkerGroup;
  member: WorkerGroupMember;
  memberCount?: number;
};

export type WorkerGroupOverview = {
  groups: WorkerGroup[];
  memberships: WorkerGroupMembership[];
};

export type SignedWorkerGroupRequestArgs = {
  action?: string;
  path?: string;
  body?: UnknownRecord;
};

export type PostSignedWorkerGroupRequest = (args: SignedWorkerGroupRequestArgs) => Promise<{ data?: unknown }>;

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toStringValue = (value: unknown): string => String(value ?? '').trim();

const normalizeGroup = (value: unknown): WorkerGroup | null => {
  const source = toRecord(value);
  const groupId = toStringValue(source.groupId);
  const label = toStringValue(source.label);
  const joinMode = toStringValue(source.joinMode);
  const memberVisibility = toStringValue(source.memberVisibility);
  if (
    !groupId ||
    !label ||
    !['open', 'admin_add'].includes(joinMode) ||
    !['admin_only', 'members', 'session'].includes(memberVisibility)
  ) {
    return null;
  }
  return {
    groupId,
    sessionSlug: toStringValue(source.sessionSlug) || undefined,
    label,
    description: toStringValue(source.description) || undefined,
    joinMode: joinMode as WorkerGroupJoinMode,
    memberVisibility: memberVisibility as WorkerGroupMemberVisibility,
    createdAt: toStringValue(source.createdAt) || undefined,
    updatedAt: toStringValue(source.updatedAt) || undefined,
  };
};

const normalizeMembership = (value: unknown): WorkerGroupMembership | null => {
  const source = toRecord(value);
  const group = normalizeGroup(source.group);
  if (!group) return null;
  const member = toRecord(source.member) as WorkerGroupMember;
  const memberCount = Number(source.memberCount);
  return {
    group,
    member,
    ...(Number.isFinite(memberCount) && memberCount >= 0 ? { memberCount } : {}),
  };
};

const normalizeGroups = (value: unknown): WorkerGroup[] =>
  (Array.isArray(value) ? value : []).map(normalizeGroup).filter((group): group is WorkerGroup => group !== null);

const normalizeMemberships = (value: unknown): WorkerGroupMembership[] =>
  (Array.isArray(value) ? value : [])
    .map(normalizeMembership)
    .filter((membership): membership is WorkerGroupMembership => membership !== null);

export class WorkerGroupRequestError extends Error {
  status: number;

  constructor(reason: string, status = 0) {
    super(reason);
    this.name = 'WorkerGroupRequestError';
    this.status = status;
  }
}

const requestMemberRoute = async ({
  workerUrl,
  credentialToken,
  path,
  method = 'GET',
  body,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  path: string;
  method?: 'GET' | 'POST';
  body?: UnknownRecord;
  fetchImpl?: typeof fetch;
}): Promise<UnknownRecord> => {
  const base = normalizeWorkerUrl(workerUrl);
  const token = toStringValue(credentialToken);
  if (!base) throw new WorkerGroupRequestError('worker_group_worker_url_missing');
  if (!token) throw new WorkerGroupRequestError('worker_group_credential_missing', 401);
  const response = await fetchImpl(`${base}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = toRecord(await response.json().catch(() => ({})));
  if (!response.ok || payload.ok === false) {
    throw new WorkerGroupRequestError(
      toStringValue(payload.reason || payload.error) || `worker_group_request_failed_${response.status}`,
      response.status,
    );
  }
  return payload;
};

export const loadWorkerGroupOverview = async ({
  workerUrl,
  credentialToken,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  fetchImpl?: typeof fetch;
}): Promise<WorkerGroupOverview> => {
  const [groupsPayload, membershipsPayload] = await Promise.all([
    requestMemberRoute({ workerUrl, credentialToken, path: '/groups/list', fetchImpl }),
    requestMemberRoute({ workerUrl, credentialToken, path: '/groups/my-memberships', fetchImpl }),
  ]);
  return {
    groups: normalizeGroups(groupsPayload.groups),
    memberships: normalizeMemberships(membershipsPayload.memberships),
  };
};

export const joinWorkerGroup = async ({
  workerUrl,
  credentialToken,
  groupId,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  groupId: unknown;
  fetchImpl?: typeof fetch;
}): Promise<UnknownRecord> =>
  requestMemberRoute({
    workerUrl,
    credentialToken,
    path: '/groups/join',
    method: 'POST',
    body: { groupId: toStringValue(groupId) },
    fetchImpl,
  });

const runAdminAction = async ({
  action,
  body,
  postSignedRequest,
}: {
  action: string;
  body: UnknownRecord;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> => {
  const response = await postSignedRequest({
    action,
    path: `/admin/${action}`,
    body,
  });
  return toRecord(response?.data);
};

export const listWorkerGroupsAdmin = ({
  postSignedRequest,
}: {
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> => runAdminAction({ action: 'groups/list', body: {}, postSignedRequest });

export const listWorkerGroupMembers = ({
  groupId,
  postSignedRequest,
}: {
  groupId: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/list-members',
    body: { groupId: toStringValue(groupId) },
    postSignedRequest,
  });

export const createWorkerGroup = ({
  group,
  postSignedRequest,
}: {
  group: Omit<WorkerGroup, 'groupId'> & { groupId?: string };
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> => runAdminAction({ action: 'groups/create', body: { group }, postSignedRequest });

export const updateWorkerGroup = ({
  groupId,
  group,
  postSignedRequest,
}: {
  groupId: unknown;
  group: Partial<WorkerGroup>;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/update',
    body: { groupId: toStringValue(groupId), group },
    postSignedRequest,
  });

export const deleteWorkerGroup = ({
  groupId,
  postSignedRequest,
}: {
  groupId: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/delete',
    body: { groupId: toStringValue(groupId) },
    postSignedRequest,
  });

export const addWorkerGroupMember = ({
  groupId,
  principal,
  postSignedRequest,
}: {
  groupId: unknown;
  principal: WorkerGroupPrincipal;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/add-member',
    body: { groupId: toStringValue(groupId), principal },
    postSignedRequest,
  });

export const removeWorkerGroupMember = ({
  groupId,
  principal,
  postSignedRequest,
}: {
  groupId: unknown;
  principal: WorkerGroupPrincipal;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/remove-member',
    body: { groupId: toStringValue(groupId), principal },
    postSignedRequest,
  });

export const normalizeWorkerGroupsAdminPayload = (payload: unknown): WorkerGroup[] =>
  normalizeGroups(toRecord(payload).groups);

export const normalizeWorkerGroupMembersAdminPayload = (payload: unknown): WorkerGroupMember[] =>
  (Array.isArray(toRecord(payload).members) ? (toRecord(payload).members as unknown[]) : []).map(
    (member) => toRecord(member) as WorkerGroupMember,
  );
