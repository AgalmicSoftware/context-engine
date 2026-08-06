import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';

type UnknownRecord = Record<string, unknown>;

export type WorkerGroupJoinMode = 'open' | 'admin_add';
export type WorkerGroupMemberVisibility = 'admin_only' | 'members' | 'session';

export type WorkerGroup = {
  groupId: string;
  sessionSlug?: string;
  label: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  documentURLs?: string[];
  memberLimit?: number;
  joinEndsAt?: string;
  adminAddress?: string;
  joinMode: WorkerGroupJoinMode;
  memberVisibility: WorkerGroupMemberVisibility;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkerGroupPrincipal =
  | {
      kind: 'evm_address' | 'passkey_account';
      address: string;
    }
  | {
      kind: 'telegram';
      principalId: string;
    }
  | {
      kind: 'agent';
      grantId: string;
    };

export type WorkerGroupMember = {
  groupId?: string;
  sessionSlug?: string;
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

export type WorkerGroupMemberPage = UnknownRecord & {
  group: WorkerGroup;
  members: WorkerGroupMember[];
  memberCount?: number;
  nextCursor: string;
};

export type SignedWorkerGroupRequestArgs = {
  action?: string;
  path?: string;
  body?: UnknownRecord;
  workerUrl?: string;
};

export type PostSignedWorkerGroupRequest = (args: SignedWorkerGroupRequestArgs) => Promise<{ data?: unknown }>;

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toStringValue = (value: unknown): string => String(value ?? '').trim();

export const normalizeWorkerGroupDefaultTags = (sessionConfig: unknown): string[] => {
  const source = toRecord(sessionConfig);
  const raw = source.defaultGroupTags ?? source.defaultSbtTags;
  const entries = Array.isArray(raw)
    ? raw.map(toStringValue)
    : toStringValue(raw)
        .split(/[\n,]+/)
        .map((entry) => entry.trim());
  const seen = new Set<string>();
  return entries
    .filter((tag) => {
      if (!tag || tag.length > 64) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
};

const isSafeHttpsUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && value.length <= 2048;
  } catch {
    return false;
  }
};

const SAFE_REMOTE_WORKER_GROUP_REASONS = new Set([
  'invalid_agent_principal',
  'invalid_group_description',
  'invalid_group_document_urls',
  'invalid_group_admin_address',
  'invalid_group_image_url',
  'invalid_group_join_end',
  'invalid_group_label',
  'invalid_group_member_limit',
  'invalid_group_tags',
  'invalid_join_mode',
  'invalid_member_visibility',
  'invalid_principal',
  'invalid_principal_address',
  'invalid_telegram_principal',
  'invalid_worker_group_id',
  'join_mode_not_implemented',
  'missing_principal',
  'unsupported_principal_kind',
  'worker_group_authorization_invalid',
  'worker_group_capacity_identity_conflict',
  'worker_group_capacity_reconciliation_required',
  'worker_group_capacity_repair_not_applicable',
  'worker_group_capacity_seed_unavailable',
  'worker_group_capacity_state_unavailable',
  'worker_group_catalog_invalid',
  'worker_group_coordination_unavailable',
  'worker_group_creation_admin_only',
  'worker_group_discovery_not_public',
  'worker_group_join_denied',
  'worker_group_join_ended',
  'worker_group_member_cap_exceeded',
  'worker_group_member_limit_below_current',
  'worker_group_member_list_forbidden',
  'worker_group_member_not_found',
  'worker_group_member_page_invalid',
  'worker_group_membership_denied',
  'worker_group_membership_state_pending',
  'worker_group_mutation_ambiguous',
  'worker_group_mutation_invalid',
  'worker_group_not_found',
  'worker_group_projection_unavailable',
  'worker_group_session_cap_exceeded',
  'worker_group_session_identity_invalid',
  'worker_group_session_identity_mismatch',
  'worker_group_session_identity_unavailable',
  'worker_group_store_not_configured',
  'worker_group_store_unavailable',
]);

const SAFE_LOCAL_WORKER_GROUP_REASONS = new Set([
  'worker_group_admin_request_failed',
  'worker_group_credential_missing',
  'worker_group_expected_session_identity_missing',
  'worker_group_expected_session_slug_missing',
  'worker_group_request_failed',
  'worker_group_response_cursor_invalid',
  'worker_group_response_group_invalid',
  'worker_group_response_group_visibility_invalid',
  'worker_group_response_member_count_invalid',
  'worker_group_response_member_invalid',
  'worker_group_response_session_identity_mismatch',
  'worker_group_response_session_identity_missing',
  'worker_group_response_session_slug_mismatch',
  'worker_group_response_session_slug_missing',
  'worker_group_worker_url_missing',
]);

export class WorkerGroupRequestError extends Error {
  status: number;

  constructor(reason: string, status = 0) {
    super(reason);
    this.name = 'WorkerGroupRequestError';
    this.status = status;
  }
}

const normalizeWorkerGroupMemberCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new WorkerGroupRequestError('worker_group_response_member_count_invalid');
  }
  return value;
};

const normalizeWorkerGroupResponseStatus = (value: unknown): number => {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
};

const safeRemoteWorkerGroupReason = (payload: UnknownRecord, status: unknown): string => {
  const reason = toStringValue(payload.reason);
  if (SAFE_REMOTE_WORKER_GROUP_REASONS.has(reason)) return reason;
  const normalizedStatus = normalizeWorkerGroupResponseStatus(status);
  return normalizedStatus ? `worker_group_request_failed_${normalizedStatus}` : 'worker_group_request_failed';
};

const isSafeWorkerGroupReason = (reason: string): boolean =>
  SAFE_REMOTE_WORKER_GROUP_REASONS.has(reason) ||
  SAFE_LOCAL_WORKER_GROUP_REASONS.has(reason) ||
  /^worker_group_request_failed_[1-5]\d{2}$/.test(reason);

export const sanitizeWorkerGroupRequestError = (
  error: unknown,
  fallbackReason = 'worker_group_request_failed',
): WorkerGroupRequestError => {
  if (error instanceof WorkerGroupRequestError && isSafeWorkerGroupReason(error.message)) return error;
  const remoteReason =
    error && typeof error === 'object' && 'reason' in error
      ? toStringValue((error as { reason?: unknown }).reason)
      : '';
  if (SAFE_REMOTE_WORKER_GROUP_REASONS.has(remoteReason)) {
    const remoteStatus =
      error && typeof error === 'object' && 'status' in error
        ? normalizeWorkerGroupResponseStatus((error as { status?: unknown }).status)
        : 0;
    return new WorkerGroupRequestError(remoteReason, remoteStatus);
  }
  const safeFallback = isSafeWorkerGroupReason(fallbackReason) ? fallbackReason : 'worker_group_request_failed';
  const status =
    error && typeof error === 'object' && 'status' in error
      ? normalizeWorkerGroupResponseStatus((error as { status?: unknown }).status)
      : 0;
  return new WorkerGroupRequestError(safeFallback, status);
};

const normalizeExpectedSessionSlug = (value: unknown): string => {
  const slug = canonicalizeSessionSlug(value);
  if (!slug) throw new WorkerGroupRequestError('worker_group_expected_session_slug_missing');
  return slug;
};

const assertExactSessionSlug = (value: unknown, expectedSessionSlug: unknown): string => {
  const expected = normalizeExpectedSessionSlug(expectedSessionSlug);
  const actual = canonicalizeSessionSlug(value);
  if (!actual) throw new WorkerGroupRequestError('worker_group_response_session_slug_missing');
  if (actual !== expected) throw new WorkerGroupRequestError('worker_group_response_session_slug_mismatch');
  return actual;
};

const normalizeExpectedSessionId = (value: unknown): string => {
  const sessionId = normalizeWorkerCanonicalSessionIdHex(value);
  if (!sessionId) throw new WorkerGroupRequestError('worker_group_expected_session_identity_missing');
  return sessionId;
};

const assertExactSessionIdentity = (
  payload: unknown,
  expectedSessionSlug: unknown,
  expectedSessionId: unknown,
): { sessionId: string; sessionSlug: string } => {
  const source = toRecord(payload);
  const sessionSlug = assertExactSessionSlug(source.sessionSlug, expectedSessionSlug);
  const expectedId = normalizeExpectedSessionId(expectedSessionId);
  const sessionId = normalizeWorkerCanonicalSessionIdHex(source.sessionId);
  if (!sessionId) throw new WorkerGroupRequestError('worker_group_response_session_identity_missing');
  if (sessionId !== expectedId) {
    throw new WorkerGroupRequestError('worker_group_response_session_identity_mismatch');
  }
  return { sessionId, sessionSlug };
};

const normalizeGroup = (
  value: unknown,
  expectedSessionSlug?: unknown,
  includeMemberCount = false,
): WorkerGroup | null => {
  const source = toRecord(value);
  const groupId = toStringValue(source.groupId);
  const label = toStringValue(source.label);
  const joinMode = toStringValue(source.joinMode);
  const memberVisibility = toStringValue(source.memberVisibility);
  const tags = Array.isArray(source.tags)
    ? source.tags.map(toStringValue).filter(Boolean)
    : [];
  const documentURLs = Array.isArray(source.documentURLs)
    ? source.documentURLs.map(toStringValue).filter(Boolean)
    : [];
  const memberLimit = Number(source.memberLimit);
  const joinEndsAt = toStringValue(source.joinEndsAt);
  const adminAddress = toStringValue(source.adminAddress);
  const hasMemberCount = Object.prototype.hasOwnProperty.call(source, 'memberCount');
  const memberCount =
    includeMemberCount && hasMemberCount ? normalizeWorkerGroupMemberCount(source.memberCount) : undefined;
  if (
    !groupId ||
    !label ||
    !['open', 'admin_add'].includes(joinMode) ||
    !['admin_only', 'members', 'session'].includes(memberVisibility) ||
    (source.tags != null &&
      (!Array.isArray(source.tags) ||
        tags.length !== source.tags.length ||
        tags.length > 20 ||
        tags.some((tag) => tag.length > 64))) ||
    (source.documentURLs != null &&
      (!Array.isArray(source.documentURLs) ||
        documentURLs.length !== source.documentURLs.length ||
        documentURLs.length > 10 ||
        documentURLs.some((url) => !isSafeHttpsUrl(url)))) ||
    (source.memberLimit != null && (!Number.isSafeInteger(memberLimit) || memberLimit < 1 || memberLimit > 1000)) ||
    (source.joinEndsAt != null && (!joinEndsAt || !Number.isFinite(Date.parse(joinEndsAt)))) ||
    (source.adminAddress != null && !/^0x[0-9a-fA-F]{40}$/.test(adminAddress))
  ) {
    return null;
  }
  const sessionSlug =
    expectedSessionSlug === undefined
      ? canonicalizeSessionSlug(source.sessionSlug) || undefined
      : assertExactSessionSlug(source.sessionSlug, expectedSessionSlug);
  return {
    groupId,
    sessionSlug,
    label,
    description: toStringValue(source.description) || undefined,
    imageUrl: toStringValue(source.imageUrl) || undefined,
    tags: tags.length ? tags : undefined,
    documentURLs: documentURLs.length ? documentURLs : undefined,
    memberLimit: Number.isSafeInteger(memberLimit) && memberLimit > 0 ? memberLimit : undefined,
    joinEndsAt: joinEndsAt || undefined,
    adminAddress: adminAddress || undefined,
    joinMode: joinMode as WorkerGroupJoinMode,
    memberVisibility: memberVisibility as WorkerGroupMemberVisibility,
    ...(memberCount === undefined ? {} : { memberCount }),
    createdAt: toStringValue(source.createdAt) || undefined,
    updatedAt: toStringValue(source.updatedAt) || undefined,
  };
};

const normalizeMembership = (value: unknown, expectedSessionSlug?: unknown): WorkerGroupMembership | null => {
  const source = toRecord(value);
  const group = normalizeGroup(source.group, expectedSessionSlug);
  if (!group) return null;
  const member = toRecord(source.member) as WorkerGroupMember;
  if (expectedSessionSlug !== undefined) {
    assertExactSessionSlug(member.sessionSlug, expectedSessionSlug);
  }
  const hasMemberCount = Object.prototype.hasOwnProperty.call(source, 'memberCount');
  const memberCount = hasMemberCount ? normalizeWorkerGroupMemberCount(source.memberCount) : undefined;
  return {
    group,
    member,
    ...(memberCount === undefined ? {} : { memberCount }),
  };
};

const normalizeGroups = (value: unknown, expectedSessionSlug?: unknown, includeMemberCount = false): WorkerGroup[] =>
  (Array.isArray(value) ? value : [])
    .map((group) => normalizeGroup(group, expectedSessionSlug, includeMemberCount))
    .filter((group): group is WorkerGroup => group !== null);

const normalizeMemberships = (value: unknown, expectedSessionSlug?: unknown): WorkerGroupMembership[] =>
  (Array.isArray(value) ? value : [])
    .map((membership) => normalizeMembership(membership, expectedSessionSlug))
    .filter((membership): membership is WorkerGroupMembership => membership !== null);

const normalizeVisibleWorkerGroupPrincipal = (value: unknown): WorkerGroupPrincipal | null => {
  const source = toRecord(value);
  const kind = toStringValue(source.kind).toLowerCase();
  if (kind === 'evm_address' || kind === 'passkey_account') {
    const address = toStringValue(source.address);
    return /^0x[0-9a-fA-F]{40}$/.test(address)
      ? { kind, address: address.toLowerCase() }
      : null;
  }
  if (kind === 'telegram') {
    const principalId = toStringValue(source.principalId);
    return principalId &&
      principalId.length <= 180 &&
      /^[A-Za-z0-9:_@./=-]+$/.test(principalId)
      ? { kind, principalId }
      : null;
  }
  if (kind === 'agent') {
    const grantId = toStringValue(source.grantId);
    return grantId && grantId.length <= 180 && /^[A-Za-z0-9:_@./=-]+$/.test(grantId)
      ? { kind, grantId }
      : null;
  }
  return null;
};

const normalizeVisibleWorkerGroupMember = (
  value: unknown,
  expectedSessionSlug: unknown,
  expectedGroupId: string,
): WorkerGroupMember | null => {
  const source = toRecord(value);
  const groupId = toStringValue(source.groupId);
  const principal = normalizeVisibleWorkerGroupPrincipal(source.principal);
  const addedAt = toStringValue(source.addedAt);
  if (
    groupId !== expectedGroupId ||
    !principal ||
    (source.addedAt != null && (!addedAt || !Number.isFinite(Date.parse(addedAt))))
  ) {
    return null;
  }
  return {
    groupId,
    sessionSlug: assertExactSessionSlug(source.sessionSlug, expectedSessionSlug),
    principal,
    ...(addedAt ? { addedAt } : {}),
  };
};

const requestMemberRoute = async ({
  workerUrl,
  credentialToken,
  sessionId,
  sessionSlug,
  path,
  method = 'GET',
  body,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  path: string;
  method?: 'GET' | 'POST';
  body?: UnknownRecord;
  fetchImpl?: typeof fetch;
}): Promise<UnknownRecord> => {
  const base = normalizeWorkerUrl(workerUrl);
  const token = toStringValue(credentialToken);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  if (!base) throw new WorkerGroupRequestError('worker_group_worker_url_missing');
  if (!token) throw new WorkerGroupRequestError('worker_group_credential_missing', 401);
  const requestUrl =
    method === 'GET' ? `${base}${path}?sessionId=${encodeURIComponent(expectedSessionId)}` : `${base}${path}`;
  const response = await fetchImpl(requestUrl, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify({ ...body, sessionId: expectedSessionId }) } : {}),
  });
  const payload = toRecord(await response.json().catch(() => ({})));
  if (!response.ok || payload.ok === false) {
    throw new WorkerGroupRequestError(safeRemoteWorkerGroupReason(payload, response.status), response.status);
  }
  assertExactSessionIdentity(payload, sessionSlug, expectedSessionId);
  return payload;
};

export const loadPublicWorkerGroups = async ({
  workerUrl,
  sessionId,
  sessionSlug,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  fetchImpl?: typeof fetch;
}): Promise<WorkerGroup[]> => {
  const base = normalizeWorkerUrl(workerUrl);
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  if (!base) throw new WorkerGroupRequestError('worker_group_worker_url_missing');
  const response = await fetchImpl(`${base}/groups/list?sessionId=${encodeURIComponent(expectedSessionId)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'X-Session-Slug': expectedSessionSlug,
    },
  });
  const payload = toRecord(await response.json().catch(() => ({})));
  if (!response.ok || payload.ok === false) {
    throw new WorkerGroupRequestError(safeRemoteWorkerGroupReason(payload, response.status), response.status);
  }
  assertExactSessionIdentity(payload, expectedSessionSlug, expectedSessionId);
  return normalizeGroups(payload.groups, expectedSessionSlug);
};

export const loadWorkerGroupOverview = async ({
  workerUrl,
  credentialToken,
  sessionId,
  sessionSlug,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  fetchImpl?: typeof fetch;
}): Promise<WorkerGroupOverview> => {
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  const [groupsPayload, membershipsPayload] = await Promise.all([
    requestMemberRoute({
      workerUrl,
      credentialToken,
      sessionId: expectedSessionId,
      sessionSlug: expectedSessionSlug,
      path: '/groups/list',
      fetchImpl,
    }),
    requestMemberRoute({
      workerUrl,
      credentialToken,
      sessionId: expectedSessionId,
      sessionSlug: expectedSessionSlug,
      path: '/groups/my-memberships',
      fetchImpl,
    }),
  ]);
  return {
    groups: normalizeGroups(groupsPayload.groups, expectedSessionSlug, true),
    memberships: normalizeMemberships(membershipsPayload.memberships, expectedSessionSlug),
  };
};

export const loadWorkerGroupMembers = async ({
  workerUrl,
  credentialToken,
  sessionId,
  sessionSlug,
  groupId,
  cursor = '',
  limit = 100,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  groupId: unknown;
  cursor?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<WorkerGroupMemberPage> => {
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  const expectedGroupId = toStringValue(groupId);
  if (
    !expectedGroupId ||
    expectedGroupId.length > 80 ||
    typeof cursor !== 'string' ||
    cursor.length > 1024 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 250
  ) {
    throw new WorkerGroupRequestError('worker_group_member_page_invalid', 400);
  }
  const payload = await requestMemberRoute({
    workerUrl,
    credentialToken,
    sessionId: expectedSessionId,
    sessionSlug: expectedSessionSlug,
    path: '/groups/members',
    method: 'POST',
    body: {
      groupId: expectedGroupId,
      ...(cursor ? { cursor } : {}),
      limit,
    },
    fetchImpl,
  });
  const group = normalizeGroup(payload.group, expectedSessionSlug);
  if (!group || group.groupId !== expectedGroupId) {
    throw new WorkerGroupRequestError('worker_group_response_group_invalid');
  }
  if (!Array.isArray(payload.members)) {
    throw new WorkerGroupRequestError('worker_group_response_member_invalid');
  }
  const members = payload.members.map((member) =>
    normalizeVisibleWorkerGroupMember(member, expectedSessionSlug, expectedGroupId),
  );
  if (members.some((member) => member === null)) {
    throw new WorkerGroupRequestError('worker_group_response_member_invalid');
  }
  const memberCount = normalizeWorkerGroupMemberCount(payload.memberCount);
  const nextCursorValue = payload.nextCursor;
  if (nextCursorValue != null && (typeof nextCursorValue !== 'string' || nextCursorValue.length > 1024)) {
    throw new WorkerGroupRequestError('worker_group_response_cursor_invalid');
  }
  return {
    ...payload,
    group,
    members: members as WorkerGroupMember[],
    memberCount,
    nextCursor: typeof nextCursorValue === 'string' ? nextCursorValue : '',
  };
};

export const joinWorkerGroup = async ({
  workerUrl,
  credentialToken,
  sessionId,
  sessionSlug,
  groupId,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  groupId: unknown;
  fetchImpl?: typeof fetch;
}): Promise<UnknownRecord> => {
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  return requestMemberRoute({
    workerUrl,
    credentialToken,
    sessionId: expectedSessionId,
    sessionSlug: expectedSessionSlug,
    path: '/groups/join',
    method: 'POST',
    body: { groupId: toStringValue(groupId) },
    fetchImpl,
  }).then((payload) => {
    const group = normalizeGroup(payload.group, expectedSessionSlug);
    if (!group || group.groupId !== toStringValue(groupId)) {
      throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    }
    const memberCount = normalizeWorkerGroupMemberCount(payload.memberCount);
    return { ...payload, group: { ...group, memberCount }, memberCount };
  });
};

export const leaveWorkerGroup = async ({
  workerUrl,
  credentialToken,
  sessionId,
  sessionSlug,
  groupId,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  groupId: unknown;
  fetchImpl?: typeof fetch;
}): Promise<UnknownRecord> => {
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  const expectedGroupId = toStringValue(groupId);
  return requestMemberRoute({
    workerUrl,
    credentialToken,
    sessionId: expectedSessionId,
    sessionSlug: expectedSessionSlug,
    path: '/groups/leave',
    method: 'POST',
    body: { groupId: expectedGroupId },
    fetchImpl,
  }).then((payload) => {
    if (toStringValue(payload.groupId) !== expectedGroupId) {
      throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    }
    const hasGroup = payload.group != null;
    const hasMemberCount = Object.prototype.hasOwnProperty.call(payload, 'memberCount');
    if (!hasGroup) {
      if (hasMemberCount) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
      return payload;
    }
    const group = normalizeGroup(payload.group, expectedSessionSlug);
    if (!group || group.groupId !== expectedGroupId) {
      throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    }
    if (group.memberVisibility !== 'session') {
      throw new WorkerGroupRequestError('worker_group_response_group_visibility_invalid');
    }
    const memberCount = normalizeWorkerGroupMemberCount(payload.memberCount);
    return { ...payload, group: { ...group, memberCount }, memberCount };
  });
};

export const createWorkerGroupAsParticipant = async ({
  workerUrl,
  credentialToken,
  sessionId,
  sessionSlug,
  group,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  group: Pick<WorkerGroup, 'label'> &
    Partial<
      Pick<
        WorkerGroup,
        'description' | 'imageUrl' | 'tags' | 'documentURLs' | 'memberLimit' | 'joinEndsAt' | 'adminAddress'
      >
    >;
  fetchImpl?: typeof fetch;
}): Promise<UnknownRecord> => {
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  return requestMemberRoute({
    workerUrl,
    credentialToken,
    sessionId: expectedSessionId,
    sessionSlug: expectedSessionSlug,
    path: '/groups/create',
    method: 'POST',
    body: { group },
    fetchImpl,
  }).then((payload) => {
    const created = normalizeGroup(payload.group, expectedSessionSlug);
    if (!created) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    return { ...payload, group: created };
  });
};

const runAdminAction = async ({
  action,
  body,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  action: string;
  body: UnknownRecord;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> => {
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  const response = await postSignedRequest({
    action,
    path: `/admin/${action}`,
    body: { ...body, sessionId: expectedSessionId },
  });
  const payload = toRecord(response?.data);
  assertExactSessionIdentity(payload, expectedSessionSlug, expectedSessionId);
  return payload;
};

export const listWorkerGroupsAdmin = ({
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({ action: 'groups/list', body: {}, sessionId, sessionSlug, postSignedRequest }).then((payload) => ({
    ...payload,
    groups: normalizeGroups(payload.groups, sessionSlug),
  }));

export const reconcileEmptyWorkerGroupsAdmin = ({
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/reconcile-empty',
    body: {},
    sessionId,
    sessionSlug,
    postSignedRequest,
  });

export const listWorkerGroupMembers = ({
  groupId,
  cursor,
  limit,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  groupId: unknown;
  cursor?: string;
  limit?: number;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<WorkerGroupMemberPage> =>
  runAdminAction({
    action: 'groups/list-members',
    body: {
      groupId: toStringValue(groupId),
      ...(cursor ? { cursor } : {}),
      ...(limit == null ? {} : { limit }),
    },
    sessionId,
    sessionSlug,
    postSignedRequest,
  }).then((payload) => {
    const group = normalizeGroup(payload.group, sessionSlug);
    if (!group) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    const members = normalizeWorkerGroupMembersAdminPayload(payload, sessionSlug);
    const nextCursorValue = payload.nextCursor;
    if (nextCursorValue != null && (typeof nextCursorValue !== 'string' || nextCursorValue.length > 1024)) {
      throw new WorkerGroupRequestError('worker_group_response_cursor_invalid');
    }
    return {
      ...payload,
      group,
      members,
      nextCursor: typeof nextCursorValue === 'string' ? nextCursorValue : '',
    };
  });

export const listWorkerGroupMembers = ({
  groupId,
  cursor,
  limit,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  groupId: unknown;
  cursor?: string;
  limit?: number;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<WorkerGroupMemberPage> =>
  runAdminAction({
    action: 'groups/list-members',
    body: {
      groupId: toStringValue(groupId),
      ...(cursor ? { cursor } : {}),
      ...(limit == null ? {} : { limit }),
    },
    sessionId,
    sessionSlug,
    postSignedRequest,
  }).then((payload) => {
    const group = normalizeGroup(payload.group, sessionSlug);
    if (!group) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    const members = normalizeWorkerGroupMembersAdminPayload(payload, sessionSlug);
    const nextCursorValue = payload.nextCursor;
    if (nextCursorValue != null && (typeof nextCursorValue !== 'string' || nextCursorValue.length > 1024)) {
      throw new WorkerGroupRequestError('worker_group_response_cursor_invalid');
    }
    return {
      ...payload,
      group,
      members,
      nextCursor: typeof nextCursorValue === 'string' ? nextCursorValue : '',
    };
  });

export const createWorkerGroup = ({
  group,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  group: Omit<WorkerGroup, 'groupId' | 'sessionSlug'> & { groupId?: string };
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({ action: 'groups/create', body: { group }, sessionId, sessionSlug, postSignedRequest }).then(
    (payload) => {
      const created = normalizeGroup(payload.group, sessionSlug);
      if (!created) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
      return { ...payload, group: created };
    },
  );

export const updateWorkerGroup = ({
  groupId,
  group,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  groupId: unknown;
  group: Partial<Omit<WorkerGroup, 'sessionSlug'>>;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/update',
    body: { groupId: toStringValue(groupId), group },
    sessionId,
    sessionSlug,
    postSignedRequest,
  }).then((payload) => {
    const updated = normalizeGroup(payload.group, sessionSlug);
    if (!updated) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    return { ...payload, group: updated };
  });

export const deleteWorkerGroup = ({
  groupId,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  groupId: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/delete',
    body: { groupId: toStringValue(groupId) },
    sessionId,
    sessionSlug,
    postSignedRequest,
  });

export const addWorkerGroupMember = ({
  groupId,
  principal,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  groupId: unknown;
  principal: WorkerGroupPrincipal;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/add-member',
    body: { groupId: toStringValue(groupId), principal },
    sessionId,
    sessionSlug,
    postSignedRequest,
  }).then((payload) => {
    const group = normalizeGroup(payload.group, sessionSlug);
    if (!group) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    assertExactSessionSlug(toRecord(payload.member).sessionSlug, sessionSlug);
    return { ...payload, group };
  });

export const removeWorkerGroupMember = ({
  groupId,
  principal,
  sessionId,
  sessionSlug,
  postSignedRequest,
}: {
  groupId: unknown;
  principal: WorkerGroupPrincipal;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
}): Promise<UnknownRecord> =>
  runAdminAction({
    action: 'groups/remove-member',
    body: { groupId: toStringValue(groupId), principal },
    sessionId,
    sessionSlug,
    postSignedRequest,
  });

export const normalizeWorkerGroupsAdminPayload = (payload: unknown, sessionSlug?: unknown): WorkerGroup[] =>
  normalizeGroups(toRecord(payload).groups, sessionSlug);

export const normalizeWorkerGroupMembersAdminPayload = (payload: unknown, sessionSlug?: unknown): WorkerGroupMember[] =>
  (Array.isArray(toRecord(payload).members) ? (toRecord(payload).members as unknown[]) : []).map((member) => {
    const normalized = toRecord(member) as WorkerGroupMember;
    if (sessionSlug !== undefined) assertExactSessionSlug(normalized.sessionSlug, sessionSlug);
    return normalized;
  });
