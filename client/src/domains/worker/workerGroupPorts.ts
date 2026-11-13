import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { noteWorkerAccessChanged } from '../../utilities/worker/workerAuth.js';
import { withCoordinatorRetry } from '../../utilities/worker/coordinatorRetry';
import {
  WORKER_GROUP_JOIN_MODES,
  WORKER_GROUP_MEMBER_CEILING_MAX,
  type WorkerGroupJoinMode,
} from '../../../../shared/workerGroupJoin.mjs';
export {
  getWorkerSessionToken,
  isWorkerSignInNeededError,
  subscribeWorkerSessionToken,
} from '../../utilities/worker/workerAuth.js';

type UnknownRecord = Record<string, unknown>;

export type { WorkerGroupJoinMode };
export type WorkerGroupMemberVisibility = 'admin_only' | 'members' | 'session';
// Who can end a membership: admins, the member, both or neither, like an SBT's burn auth.
export const WORKER_GROUP_REMOVAL_AUTHS = ['both', 'admin_only', 'member_only', 'neither'] as const;
export type WorkerGroupRemovalAuth = (typeof WORKER_GROUP_REMOVAL_AUTHS)[number];

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
  /** Shown in the group list; a Worker before join choices sends none (see isWorkerGroupListed). */
  listed?: boolean;
  memberVisibility: WorkerGroupMemberVisibility;
  removalAuth?: WorkerGroupRemovalAuth;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
  // Only admins see these.
  passwordSet?: boolean;
  invites?: WorkerGroupInviteCounts;
};
export type WorkerGroupInviteCounts = { unused: number; used: number; revoked: number };

/**
 * A group shown in the group list. Public URL groups always are; with no setting, as the Worker resolves it, so
 * are groups whose members the whole session sees.
 */
export const isWorkerGroupListed = ({
  listed,
  joinMode,
  memberVisibility,
}: Pick<WorkerGroup, 'listed' | 'joinMode' | 'memberVisibility'>): boolean =>
  joinMode === 'open' || (listed ?? memberVisibility === 'session');
/** Joining needs a group password or a one-use claim code. */
export const workerGroupNeedsSecret = ({ joinMode }: Pick<WorkerGroup, 'joinMode'>): boolean =>
  joinMode === 'one_use' || joinMode === 'group_password';

// A Worker deployed before the setting reports none, and every group there works as both.
export const workerGroupMembersMayLeave = ({ removalAuth = 'both' }: Pick<WorkerGroup, 'removalAuth'>): boolean =>
  removalAuth === 'both' || removalAuth === 'member_only';
export const workerGroupAdminsMayRemove = ({ removalAuth = 'both' }: Pick<WorkerGroup, 'removalAuth'>): boolean =>
  removalAuth === 'both' || removalAuth === 'admin_only';

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

// Mirrors the Worker's Group URL rule: public https only, no credentials, at most 2048 characters.
export const isSafeHttpsUrl = (value: string): boolean => {
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
  'invalid_removal_auth',
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
  'worker_group_exists',
  'worker_group_id_retired',
  'worker_group_join_denied',
  'worker_group_invite_exists',
  'worker_group_invite_page_invalid',
  'worker_group_join_ended',
  'worker_group_join_mode_mismatch',
  'worker_group_join_refused',
  'worker_group_leave_denied',
  'worker_group_member_cap_exceeded',
  'worker_group_member_limit_above_ceiling',
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
  'worker_group_removal_denied',
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
  'worker_group_member_directory_unavailable',
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
  // A Worker from before the setting omits it, and its groups work as both.
  const removalAuth = source.removalAuth == null ? undefined : toStringValue(source.removalAuth);
  const tags = Array.isArray(source.tags) ? source.tags.map(toStringValue).filter(Boolean) : [];
  const documentURLs = Array.isArray(source.documentURLs) ? source.documentURLs.map(toStringValue).filter(Boolean) : [];
  const memberLimit = Number(source.memberLimit);
  const joinEndsAt = toStringValue(source.joinEndsAt);
  const adminAddress = toStringValue(source.adminAddress);
  const hasMemberCount = Object.prototype.hasOwnProperty.call(source, 'memberCount');
  const memberCount =
    includeMemberCount && hasMemberCount ? normalizeWorkerGroupMemberCount(source.memberCount) : undefined;
  if (
    !groupId ||
    !label ||
    !(WORKER_GROUP_JOIN_MODES as readonly string[]).includes(joinMode) ||
    (source.listed != null && typeof source.listed !== 'boolean') ||
    !['admin_only', 'members', 'session'].includes(memberVisibility) ||
    (removalAuth !== undefined && !(WORKER_GROUP_REMOVAL_AUTHS as readonly string[]).includes(removalAuth)) ||
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
    (source.memberLimit != null &&
      (!Number.isSafeInteger(memberLimit) || memberLimit < 1 || memberLimit > WORKER_GROUP_MEMBER_CEILING_MAX)) ||
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
    ...(typeof source.listed === 'boolean' ? { listed: source.listed } : {}),
    memberVisibility: memberVisibility as WorkerGroupMemberVisibility,
    ...(removalAuth === undefined ? {} : { removalAuth: removalAuth as WorkerGroupRemovalAuth }),
    ...(memberCount === undefined ? {} : { memberCount }),
    createdAt: toStringValue(source.createdAt) || undefined,
    updatedAt: toStringValue(source.updatedAt) || undefined,
    ...(typeof source.passwordSet === 'boolean' ? { passwordSet: source.passwordSet } : {}),
    ...(normalizeInviteCounts(source.invites) ? { invites: normalizeInviteCounts(source.invites)! } : {}),
  };
};

const normalizeInviteCounts = (value: unknown): WorkerGroupInviteCounts | null => {
  const source = toRecord(value);
  const counts = { unused: source.unused, used: source.used, revoked: source.revoked };
  return Object.values(counts).every((count) => Number.isSafeInteger(count) && (count as number) >= 0)
    ? (counts as WorkerGroupInviteCounts)
    : null;
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
    return /^0x[0-9a-fA-F]{40}$/.test(address) ? { kind, address: address.toLowerCase() } : null;
  }
  // Read historical group members without changing their stored principal bytes.
  if (kind === 'telegram') {
    const principalId = toStringValue(source.principalId);
    return principalId && principalId.length <= 180 && /^[A-Za-z0-9:_@./=-]+$/.test(principalId)
      ? { kind, principalId }
      : null;
  }
  if (kind === 'agent') {
    const grantId = toStringValue(source.grantId);
    return grantId && grantId.length <= 180 && /^[A-Za-z0-9:_@./=-]+$/.test(grantId) ? { kind, grantId } : null;
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
  joinGroup = '',
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  /** A join link's group: on a private session it shows what that group's members see. */
  joinGroup?: string;
  fetchImpl?: typeof fetch;
}): Promise<WorkerGroup[]> => {
  const base = normalizeWorkerUrl(workerUrl);
  const expectedSessionSlug = normalizeExpectedSessionSlug(sessionSlug);
  const expectedSessionId = normalizeExpectedSessionId(sessionId);
  if (!base) throw new WorkerGroupRequestError('worker_group_worker_url_missing');
  const invite = joinGroup ? `&joinGroup=${encodeURIComponent(joinGroup)}` : '';
  const response = await fetchImpl(`${base}/groups/list?sessionId=${encodeURIComponent(expectedSessionId)}${invite}`, {
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
  const memberships = normalizeMemberships(membershipsPayload.memberships, expectedSessionSlug);
  const membershipGroupIds = new Set(memberships.map(({ group }) => group.groupId));
  return {
    groups: normalizeGroups(groupsPayload.groups, expectedSessionSlug, true).filter(
      (group) => isWorkerGroupListed(group) || membershipGroupIds.has(group.groupId),
    ),
    memberships,
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
  let payload: UnknownRecord;
  try {
    payload = await requestMemberRoute({
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
  } catch (error) {
    // Regression guard: legacy Workers return a generic 404 because this route
    // did not exist; preserve explicit current-Worker group errors unchanged.
    if (
      error instanceof WorkerGroupRequestError &&
      error.status === 404 &&
      error.message === 'worker_group_request_failed_404'
    ) {
      throw new WorkerGroupRequestError('worker_group_member_directory_unavailable', 404);
    }
    throw error;
  }
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
  secret,
  proof,
  fetchImpl = fetch,
}: {
  workerUrl: unknown;
  credentialToken: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  groupId: unknown;
  /** A one-use claim code. */
  secret?: string;
  /** A group password's signature over the join statement. */
  proof?: string;
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
    body: { groupId: toStringValue(groupId), ...(secret ? { secret } : {}), ...(proof ? { proof } : {}) },
    // A room joining one group at once can find the session busy.
    fetchImpl: withCoordinatorRetry(fetchImpl),
  }).then((payload) => {
    const group = normalizeGroup(payload.group, expectedSessionSlug);
    if (!group || group.groupId !== toStringValue(groupId)) {
      throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    }
    // Regression guard: Workers deployed before post-mutation counts omit this
    // field on success. Validate it strictly whenever a Worker does provide it.
    const hasMemberCount = Object.prototype.hasOwnProperty.call(payload, 'memberCount');
    const memberCount = hasMemberCount ? normalizeWorkerGroupMemberCount(payload.memberCount) : undefined;
    // Membership can satisfy a group gate that an earlier Worker token was issued without.
    noteWorkerAccessChanged();
    return {
      ...payload,
      group: memberCount === undefined ? group : { ...group, memberCount },
      ...(memberCount === undefined ? {} : { memberCount }),
    };
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
        | 'description'
        | 'imageUrl'
        | 'tags'
        | 'documentURLs'
        | 'memberLimit'
        | 'joinEndsAt'
        | 'adminAddress'
        | 'removalAuth'
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

type AdminGroupRequest = {
  groupId: unknown;
  sessionId: unknown;
  sessionSlug: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
};
export type WorkerGroupInvite = {
  hash: string;
  state: 'unused' | 'used' | 'revoked';
  createdAt?: string;
  expiresAt?: string;
  usedAt?: string;
};

const readInviteCounts = (payload: UnknownRecord, key: string): WorkerGroupInviteCounts => {
  const counts = normalizeInviteCounts(payload[key]);
  if (!counts) throw new WorkerGroupRequestError('worker_group_response_group_invalid');
  return counts;
};

/** Stores the hashes of new one-use claim codes; the codes themselves never leave the browser. */
export const addWorkerGroupInvites = ({
  hashes,
  expiresAt,
  ...request
}: AdminGroupRequest & { hashes: string[]; expiresAt?: string }) =>
  runAdminAction({
    action: 'groups/invites/add',
    body: { groupId: toStringValue(request.groupId), hashes, ...(expiresAt ? { expiresAt } : {}) },
    ...request,
  }).then((payload) => ({ added: Number(payload.added) || 0, counts: readInviteCounts(payload, 'counts') }));

const INVITE_STATES = ['unused', 'used', 'revoked'];
const normalizeInvite = (value: unknown): WorkerGroupInvite | null => {
  const source = toRecord(value);
  const hash = toStringValue(source.hash);
  const state = toStringValue(source.state);
  if (!/^[0-9a-f]{64}$/.test(hash) || !INVITE_STATES.includes(state)) return null;
  const time = (key: string) => {
    const value = toStringValue(source[key]);
    return value && Number.isFinite(Date.parse(value)) ? { [key]: value } : {};
  };
  return {
    hash,
    state: state as WorkerGroupInvite['state'],
    ...time('createdAt'),
    ...time('expiresAt'),
    ...time('usedAt'),
  };
};

/** One page of a group's one-use links in hash order, by hash and status; a hash never reveals its code. */
export const listWorkerGroupInvites = ({ cursor, ...request }: AdminGroupRequest & { cursor?: string }) =>
  runAdminAction({
    action: 'groups/invites/list',
    body: { groupId: toStringValue(request.groupId), ...(cursor ? { cursor } : {}) },
    ...request,
  }).then((payload) => ({
    invites: (Array.isArray(payload.invites) ? payload.invites : [])
      .map(normalizeInvite)
      .filter((invite): invite is WorkerGroupInvite => !!invite),
    counts: readInviteCounts(payload, 'counts'),
    cursor: typeof payload.cursor === 'string' ? payload.cursor : '',
  }));

/** Spends the named one-use links, or every unused one, so they no longer admit anyone. */
export const revokeWorkerGroupInvites = ({
  hashes,
  ...request
}: AdminGroupRequest & { hashes: string[] | 'allUnused' }) =>
  runAdminAction({
    action: 'groups/invites/revoke',
    body: { groupId: toStringValue(request.groupId), ...(hashes === 'allUnused' ? { allUnused: true } : { hashes }) },
    ...request,
  }).then((payload) => ({ revoked: Number(payload.revoked) || 0, counts: readInviteCounts(payload, 'counts') }));

/** Sets or replaces the group password by its signer address; replacing voids the old one. Members stay. */
export const setWorkerGroupPassword = ({ signer, ...request }: AdminGroupRequest & { signer: string }) =>
  runAdminAction({
    action: 'groups/password/set',
    body: { groupId: toStringValue(request.groupId), signer },
    ...request,
  }).then((payload) => {
    if (payload.groupId !== toStringValue(request.groupId).toLowerCase() || payload.passwordSet !== true)
      throw new WorkerGroupRequestError('worker_group_response_group_invalid');
    return { groupId: payload.groupId, passwordSet: true as const, signerSetAt: toStringValue(payload.signerSetAt) };
  });

export const normalizeWorkerGroupsAdminPayload = (payload: unknown, sessionSlug?: unknown): WorkerGroup[] =>
  normalizeGroups(toRecord(payload).groups, sessionSlug);

export const normalizeWorkerGroupMembersAdminPayload = (payload: unknown, sessionSlug?: unknown): WorkerGroupMember[] =>
  (Array.isArray(toRecord(payload).members) ? (toRecord(payload).members as unknown[]) : []).map((member) => {
    const normalized = toRecord(member) as WorkerGroupMember;
    if (sessionSlug !== undefined) assertExactSessionSlug(normalized.sessionSlug, sessionSlug);
    return normalized;
  });
