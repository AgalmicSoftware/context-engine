const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const trim = (value) => toStr(value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const WORKER_GROUP_JOIN_MODES = Object.freeze({
  OPEN: 'open',
  PASSWORD: 'password',
  INVITE: 'invite',
  ADMIN_ADD: 'admin_add',
});

export const WORKER_GROUP_MEMBER_VISIBILITY = Object.freeze({
  ADMIN_ONLY: 'admin_only',
  MEMBERS: 'members',
  SESSION: 'session',
});

export const DEFAULT_WORKER_GROUP_MAX_GROUPS_PER_SESSION = 100;
export const DEFAULT_WORKER_GROUP_MAX_MEMBERS_PER_GROUP = 1000;
export const MAX_WORKER_GROUP_IMAGE_URL_LENGTH = 2048;

const IMPLEMENTED_JOIN_MODES = new Set([
  WORKER_GROUP_JOIN_MODES.OPEN,
  WORKER_GROUP_JOIN_MODES.ADMIN_ADD,
]);

const safeSlugPart = (value) => (
  trim(value || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general'
);

const safeKeyPart = (value) => (
  trim(value || 'id')
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'id'
);

const nowIso = (deps = {}) => new Date(deps.now?.() || Date.now()).toISOString();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(trim(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const resolveWorkerGroupCaps = (env = {}) => ({
  maxGroupsPerSession: parsePositiveInt(
    env.CE_WORKER_GROUP_MAX_GROUPS_PER_SESSION,
    DEFAULT_WORKER_GROUP_MAX_GROUPS_PER_SESSION,
  ),
  maxMembersPerGroup: parsePositiveInt(
    env.CE_WORKER_GROUP_MAX_MEMBERS_PER_GROUP,
    DEFAULT_WORKER_GROUP_MAX_MEMBERS_PER_GROUP,
  ),
});

export const resolveWorkerGroupsKv = (env = {}) => (
  env.CE_WORKER_GROUPS_KV ||
  env.CE_STORAGE_INDEX_KV ||
  env.STORAGE_INDEX_KV ||
  env.STORAGE_KV ||
  null
);

const resolveWorkerGroupStore = (env = {}) => {
  const kv = resolveWorkerGroupsKv(env);
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') return { kind: 'kv', store: kv };
  return null;
};

const groupKey = ({ slug, groupId }) => `ce-worker-group:${safeSlugPart(slug)}:${safeKeyPart(groupId)}`;
const groupIndexKey = ({ slug, groupId }) => `ce-worker-group-index:${safeSlugPart(slug)}:${safeKeyPart(groupId)}`;
const groupIndexPrefix = ({ slug }) => `ce-worker-group-index:${safeSlugPart(slug)}:`;
const memberKey = ({ slug, groupId, principalKey }) => (
  `ce-worker-group-member:${safeSlugPart(slug)}:${safeKeyPart(groupId)}:${safeKeyPart(principalKey)}`
);
const memberIndexKey = ({ slug, principalKey, groupId }) => (
  `ce-worker-group-principal:${safeSlugPart(slug)}:${safeKeyPart(principalKey)}:${safeKeyPart(groupId)}`
);
const memberPrefix = ({ slug, groupId }) => `ce-worker-group-member:${safeSlugPart(slug)}:${safeKeyPart(groupId)}:`;
const principalPrefix = ({ slug, principalKey }) => `ce-worker-group-principal:${safeSlugPart(slug)}:${safeKeyPart(principalKey)}:`;

const jsonResponse = (deps, body, status, headers) => (
  deps?.json?.(body, status, headers) ||
  new Response(JSON.stringify(body), { status, headers })
);

const normalizeJoinMode = (value) => {
  const mode = trim(value || WORKER_GROUP_JOIN_MODES.ADMIN_ADD).toLowerCase();
  if (Object.values(WORKER_GROUP_JOIN_MODES).includes(mode)) return mode;
  return '';
};

const normalizeMemberVisibility = (value) => {
  const visibility = trim(value || WORKER_GROUP_MEMBER_VISIBILITY.ADMIN_ONLY).toLowerCase();
  if (Object.values(WORKER_GROUP_MEMBER_VISIBILITY).includes(visibility)) return visibility;
  return '';
};

const normalizeImageUrl = (value) => {
  const raw = trim(value);
  if (!raw) return { ok: true, value: '' };
  if (raw.length > MAX_WORKER_GROUP_IMAGE_URL_LENGTH) return { ok: false };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return { ok: false };
    return { ok: true, value: parsed.href };
  } catch {
    return { ok: false };
  }
};

const normalizeEvmAddress = (value, deps = {}) => {
  const address = trim(value);
  if (typeof deps.isAddress === 'function' && !deps.isAddress(address)) return '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return '';
  if (typeof deps.getAddress === 'function') {
    try {
      const normalized = trim(deps.getAddress(address));
      if (/^0x[0-9a-fA-F]{40}$/.test(normalized)) return normalized;
    } catch {
      return '';
    }
  }
  return address.toLowerCase();
};

const normalizePrincipalId = (value) => {
  const id = trim(value);
  if (!id || id.length > 180) return '';
  if (!/^[A-Za-z0-9:_@./=-]+$/.test(id)) return '';
  return id;
};

const principalKeyFor = (kind, value) => `${kind}:${trim(value).toLowerCase()}`;

export const normalizeWorkerGroupPrincipal = (input, deps = {}) => {
  if (typeof input === 'string') {
    const address = normalizeEvmAddress(input, deps);
    if (!address) return { ok: false, reason: 'invalid_principal' };
    return {
      ok: true,
      principal: { kind: 'evm_address', address },
      key: principalKeyFor('evm_address', address),
    };
  }
  if (!isObj(input)) return { ok: false, reason: 'invalid_principal' };
  const kind = trim(input.kind || input.type).toLowerCase();
  if (kind === 'passkey_account' || kind === 'evm_address') {
    const address = normalizeEvmAddress(input.address || input.account || input.id, deps);
    if (!address) return { ok: false, reason: 'invalid_principal_address' };
    return {
      ok: true,
      principal: { kind, address },
      key: principalKeyFor(kind, address),
    };
  }
  if (kind === 'telegram') {
    const principalId = normalizePrincipalId(input.principalId || input.id);
    if (!principalId) return { ok: false, reason: 'invalid_telegram_principal' };
    return {
      ok: true,
      principal: { kind, principalId },
      key: principalKeyFor(kind, principalId),
    };
  }
  if (kind === 'agent') {
    const grantId = normalizePrincipalId(input.grantId || input.id);
    if (!grantId) return { ok: false, reason: 'invalid_agent_principal' };
    return {
      ok: true,
      principal: { kind, grantId },
      key: principalKeyFor(kind, grantId),
    };
  }
  return { ok: false, reason: 'unsupported_principal_kind' };
};

export const resolveWorkerGroupPrincipal = ({ requesterAddress, authScopes, principal, deps = {} } = {}) => {
  if (principal) return normalizeWorkerGroupPrincipal(principal, deps);
  const scopes = isObj(authScopes) ? authScopes : {};
  const explicit = (
    scopes.principal ||
    scopes.workerPrincipal ||
    scopes.subjectPrincipal ||
    scopes.delegationPrincipal
  );
  if (explicit) return normalizeWorkerGroupPrincipal(explicit, deps);
  const grantId = trim(
    scopes.grantId ||
    scopes.agentGrant?.grantId ||
    scopes.agent_grant?.grantId ||
    scopes.delegation?.grantId
  );
  if (grantId) return normalizeWorkerGroupPrincipal({ kind: 'agent', grantId }, deps);
  const telegramPrincipal = (
    scopes.telegramPrincipal ||
    scopes.integrationPrincipal?.telegram ||
    scopes.integrationPrincipal?.telegramPrincipal ||
    scopes.integrationPrincipal?.principalId
  );
  if (telegramPrincipal) return normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: telegramPrincipal }, deps);
  const telegramId = trim(
    scopes.telegramUserId ||
    scopes.integrationPrincipal?.telegramUserId ||
    scopes.integrationPrincipal?.telegram_user_id
  );
  if (telegramId) return normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: `telegram:${telegramId}` }, deps);
  if (requesterAddress) return normalizeWorkerGroupPrincipal({ kind: 'evm_address', address: requesterAddress }, deps);
  return { ok: false, reason: 'missing_principal' };
};

const createGroupId = (deps = {}) => {
  const supplied = trim(deps.randomUUID?.());
  if (supplied) return safeKeyPart(supplied);
  const cryptoImpl = deps.crypto || globalThis.crypto;
  if (typeof cryptoImpl?.randomUUID === 'function') return safeKeyPart(cryptoImpl.randomUUID());
  const bytes = new Uint8Array(16);
  const getRandomValues = deps.getRandomValues || cryptoImpl?.getRandomValues?.bind(cryptoImpl);
  if (typeof getRandomValues !== 'function') throw new Error('Secure randomness is required for worker group ids.');
  getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const normalizeGroupPatch = ({ input = {}, actorPrincipal, existing = null, deps = {} } = {}) => {
  const joinMode = normalizeJoinMode(input.joinMode || existing?.joinMode);
  if (!joinMode) return { ok: false, status: 400, reason: 'invalid_join_mode' };
  if (!IMPLEMENTED_JOIN_MODES.has(joinMode)) {
    return { ok: false, status: 400, reason: 'join_mode_not_implemented' };
  }
  const memberVisibility = normalizeMemberVisibility(input.memberVisibility || existing?.memberVisibility);
  if (!memberVisibility) return { ok: false, status: 400, reason: 'invalid_member_visibility' };
  const label = trim(input.label || existing?.label);
  if (!label || label.length > 120) return { ok: false, status: 400, reason: 'invalid_group_label' };
  const description = trim(input.description ?? existing?.description);
  if (description.length > 500) return { ok: false, status: 400, reason: 'invalid_group_description' };
  const imageUrlResult = normalizeImageUrl(input.imageUrl ?? existing?.imageUrl);
  if (!imageUrlResult.ok) return { ok: false, status: 400, reason: 'invalid_group_image_url' };
  const updatedAt = nowIso(deps);
  return {
    ok: true,
    patch: {
      label,
      description: description || undefined,
      imageUrl: imageUrlResult.value || undefined,
      joinMode,
      memberVisibility,
      updatedAt,
      ...(existing ? {} : {
        createdBy: actorPrincipal,
        createdAt: updatedAt,
      }),
    },
  };
};

const kvGetJson = async (kv, key) => {
  try {
    const raw = await kv.get(key);
    return typeof raw === 'string' ? JSON.parse(raw || 'null') : raw;
  } catch {
    return null;
  }
};

const kvListKeys = async (kv, prefix) => {
  if (typeof kv.list !== 'function') return [];
  const listed = await kv.list({ prefix });
  return Array.isArray(listed?.keys)
    ? listed.keys.map((entry) => trim(entry?.name || entry)).filter(Boolean)
    : [];
};

const readGroupRecord = async ({ store, slug, groupId }) => {
  return kvGetJson(store.store, groupKey({ slug, groupId }));
};

const writeGroupRecord = async ({ store, slug, group }) => {
  await store.store.put(groupKey({ slug, groupId: group.groupId }), JSON.stringify(group));
  await store.store.put(groupIndexKey({ slug, groupId: group.groupId }), group.groupId);
};

const listGroupRecords = async ({ store, slug, includeDeleted = false }) => {
  const keys = await kvListKeys(store.store, groupIndexPrefix({ slug }));
  const groups = [];
  for (const key of keys) {
    // eslint-disable-next-line no-await-in-loop
    const groupId = await store.store.get(key);
    // eslint-disable-next-line no-await-in-loop
    const group = await readGroupRecord({ store, slug, groupId });
    if (group && (includeDeleted || !group.deletedAt)) groups.push(group);
  }
  return groups;
};

const writeMembershipRecord = async ({ store, slug, groupId, member }) => {
  await store.store.put(memberKey({ slug, groupId, principalKey: member.principalKey }), JSON.stringify(member));
  await store.store.put(memberIndexKey({ slug, principalKey: member.principalKey, groupId }), safeKeyPart(groupId));
};

const readMembershipRecord = async ({ store, slug, groupId, principalKey }) => {
  return kvGetJson(store.store, memberKey({ slug, groupId, principalKey }));
};

const listMembershipRecords = async ({ store, slug, groupId = '', principalKey = '' }) => {
  const prefix = groupId
    ? memberPrefix({ slug, groupId })
    : principalPrefix({ slug, principalKey });
  const keys = await kvListKeys(store.store, prefix);
  const members = [];
  for (const key of keys) {
    // eslint-disable-next-line no-await-in-loop
    const row = groupId
      ? await kvGetJson(store.store, key)
      : await readMembershipRecord({ store, slug, groupId: await store.store.get(key), principalKey });
    if (row && !row.removedAt) members.push(row);
  }
  return members;
};

const redactGroupForMember = (group) => ({
  groupId: group.groupId,
  sessionSlug: group.sessionSlug,
  label: group.label,
  ...(group.description ? { description: group.description } : {}),
  ...(group.imageUrl ? { imageUrl: group.imageUrl } : {}),
  joinMode: group.joinMode,
  memberVisibility: group.memberVisibility,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

export const createWorkerGroup = async ({ env, slug, input, actorPrincipal, deps = {} } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const caps = resolveWorkerGroupCaps(env);
  const existingGroups = await listGroupRecords({ store, slug });
  if (existingGroups.length >= caps.maxGroupsPerSession) {
    return { ok: false, status: 409, reason: 'worker_group_session_cap_exceeded' };
  }
  const normalized = normalizeGroupPatch({ input, actorPrincipal, deps });
  if (!normalized.ok) return normalized;
  const groupId = safeKeyPart(input?.groupId) !== 'id' ? safeKeyPart(input.groupId) : createGroupId(deps);
  const existing = await readGroupRecord({ store, slug, groupId });
  if (existing && !existing.deletedAt) return { ok: false, status: 409, reason: 'worker_group_exists' };
  const group = {
    groupId,
    sessionSlug: safeSlugPart(slug),
    ...normalized.patch,
  };
  await writeGroupRecord({ store, slug, group });
  return { ok: true, store: store.kind, group };
};

export const updateWorkerGroup = async ({ env, slug, groupId, input, actorPrincipal, deps = {} } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const existing = await readGroupRecord({ store, slug, groupId });
  if (!existing || existing.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
  const normalized = normalizeGroupPatch({ input, actorPrincipal, existing, deps });
  if (!normalized.ok) return normalized;
  const group = { ...existing, ...normalized.patch };
  await writeGroupRecord({ store, slug, group });
  return { ok: true, store: store.kind, group };
};

export const deleteWorkerGroup = async ({ env, slug, groupId, actorPrincipal, deps = {} } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const existing = await readGroupRecord({ store, slug, groupId });
  if (!existing || existing.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
  const deletedAt = nowIso(deps);
  const group = { ...existing, deletedAt, deletedBy: actorPrincipal, updatedAt: deletedAt };
  await writeGroupRecord({ store, slug, group });
  const members = await listMembershipRecords({ store, slug, groupId });
  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop
    await writeMembershipRecord({
      store,
      slug,
      groupId,
      member: { ...member, removedAt: deletedAt, removedBy: actorPrincipal },
    });
  }
  return { ok: true, store: store.kind, groupId: safeKeyPart(groupId), removedMembers: members.length };
};

export const addWorkerGroupMember = async ({ env, slug, groupId, principal, actorPrincipal, deps = {} } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const group = await readGroupRecord({ store, slug, groupId });
  if (!group || group.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
  const normalized = normalizeWorkerGroupPrincipal(principal, deps);
  if (!normalized.ok) return { ok: false, status: 400, reason: normalized.reason };
  const caps = resolveWorkerGroupCaps(env);
  const members = await listMembershipRecords({ store, slug, groupId });
  const existing = members.find((member) => member.principalKey === normalized.key);
  if (!existing && members.length >= caps.maxMembersPerGroup) {
    return { ok: false, status: 409, reason: 'worker_group_member_cap_exceeded' };
  }
  const addedAt = nowIso(deps);
  const member = {
    groupId: safeKeyPart(groupId),
    sessionSlug: safeSlugPart(slug),
    principal: normalized.principal,
    principalKey: normalized.key,
    addedBy: actorPrincipal,
    addedAt: existing?.addedAt || addedAt,
  };
  await writeMembershipRecord({ store, slug, groupId, member });
  return { ok: true, store: store.kind, group: redactGroupForMember(group), member };
};

export const removeWorkerGroupMember = async ({ env, slug, groupId, principal, actorPrincipal, deps = {} } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const group = await readGroupRecord({ store, slug, groupId });
  if (!group || group.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
  const normalized = normalizeWorkerGroupPrincipal(principal, deps);
  if (!normalized.ok) return { ok: false, status: 400, reason: normalized.reason };
  const existing = await readMembershipRecord({ store, slug, groupId, principalKey: normalized.key });
  if (!existing || existing.removedAt) return { ok: false, status: 404, reason: 'worker_group_member_not_found' };
  const removedAt = nowIso(deps);
  const member = { ...existing, removedAt, removedBy: actorPrincipal };
  await writeMembershipRecord({ store, slug, groupId, member });
  return { ok: true, store: store.kind, groupId: safeKeyPart(groupId), principal: normalized.principal };
};

export const listWorkerGroups = async ({ env, slug, actorPrincipalResult, admin = false } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const groups = await listGroupRecords({ store, slug });
  const principalKey = actorPrincipalResult?.key || '';
  const visible = [];
  for (const group of groups) {
    if (admin || group.memberVisibility === WORKER_GROUP_MEMBER_VISIBILITY.SESSION) {
      visible.push(redactGroupForMember(group));
      continue;
    }
    if (principalKey && group.memberVisibility === WORKER_GROUP_MEMBER_VISIBILITY.MEMBERS) {
      // eslint-disable-next-line no-await-in-loop
      const member = await readMembershipRecord({ store, slug, groupId: group.groupId, principalKey });
      if (member && !member.removedAt) visible.push(redactGroupForMember(group));
    }
  }
  return { ok: true, store: store.kind, groups: visible };
};

export const listWorkerGroupMembers = async ({ env, slug, groupId } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const group = await readGroupRecord({ store, slug, groupId });
  if (!group || group.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
  const members = await listMembershipRecords({ store, slug, groupId });
  return { ok: true, store: store.kind, group: redactGroupForMember(group), members };
};

export const listWorkerGroupMemberships = async ({ env, slug, principal, deps = {} } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
  const normalized = normalizeWorkerGroupPrincipal(principal, deps);
  if (!normalized.ok) return { ok: false, status: 400, reason: normalized.reason };
  const rows = await listMembershipRecords({ store, slug, principalKey: normalized.key });
  const memberships = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const group = await readGroupRecord({ store, slug, groupId: row.groupId });
    if (!group || group.deletedAt) continue;
    // The count supports the shared aggregate-privacy threshold without
    // exposing other principals or requiring an admin membership read.
    // eslint-disable-next-line no-await-in-loop
    const groupMembers = await listMembershipRecords({ store, slug, groupId: row.groupId });
    memberships.push({ group: redactGroupForMember(group), member: row, memberCount: groupMembers.length });
  }
  return { ok: true, store: store.kind, principal: normalized.principal, memberships };
};

export const isWorkerGroupMember = async ({ env, slug, groupId, principal, requesterAddress, authScopes, deps = {} } = {}) => {
  const store = resolveWorkerGroupStore(env);
  if (!store) return { ok: false, reason: 'worker_group_store_not_configured' };
  const normalized = principal
    ? normalizeWorkerGroupPrincipal(principal, deps)
    : resolveWorkerGroupPrincipal({ requesterAddress, authScopes, deps });
  if (!normalized.ok) return { ok: false, reason: normalized.reason || 'missing_principal' };
  const group = await readGroupRecord({ store, slug, groupId });
  if (!group || group.deletedAt) return { ok: false, reason: 'worker_group_not_found' };
  const member = await readMembershipRecord({ store, slug, groupId, principalKey: normalized.key });
  if (!member || member.removedAt) {
    return {
      ok: false,
      reason: 'worker_group_membership_denied',
      group: redactGroupForMember(group),
      principal: normalized.principal,
    };
  }
  return {
    ok: true,
    store: store.kind,
    group: redactGroupForMember(group),
    principal: normalized.principal,
    member,
  };
};

const parseRouteBody = async (request) => {
  try {
    const body = await request?.json?.();
    return isObj(body) ? { ok: true, body } : { ok: false, error: 'Invalid JSON.' };
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
};

const routeError = (deps, result, headers) => jsonResponse(
  deps,
  { error: 'Worker group request failed.', reason: result.reason || 'worker_group_failed' },
  result.status || 403,
  headers,
);

export const dispatchAdminWorkerGroupRequest = async ({
  action,
  body,
  env,
  slug,
  adminAddress,
  headers,
  deps,
} = {}) => {
  const actor = normalizeWorkerGroupPrincipal(
    body?.actorPrincipal || { kind: 'evm_address', address: adminAddress || body?.address },
    deps,
  );
  if (!actor.ok) {
    return jsonResponse(deps, { error: 'Invalid admin principal.', reason: actor.reason }, 400, headers);
  }
  if (action === 'groups/create') {
    const result = await createWorkerGroup({
      env,
      slug,
      input: body?.group || body,
      actorPrincipal: actor.principal,
      deps,
    });
    if (!result.ok) return routeError(deps, result, headers);
    return jsonResponse(deps, { ok: true, store: result.store, group: result.group }, 200, headers);
  }
  if (action === 'groups/update') {
    const result = await updateWorkerGroup({
      env,
      slug,
      groupId: body?.groupId || body?.group?.groupId,
      input: body?.group || body,
      actorPrincipal: actor.principal,
      deps,
    });
    if (!result.ok) return routeError(deps, result, headers);
    return jsonResponse(deps, { ok: true, store: result.store, group: result.group }, 200, headers);
  }
  if (action === 'groups/delete') {
    const result = await deleteWorkerGroup({
      env,
      slug,
      groupId: body?.groupId || body?.group?.groupId,
      actorPrincipal: actor.principal,
      deps,
    });
    if (!result.ok) return routeError(deps, result, headers);
    return jsonResponse(deps, { ok: true, store: result.store, groupId: result.groupId, removedMembers: result.removedMembers }, 200, headers);
  }
  if (action === 'groups/add-member') {
    const result = await addWorkerGroupMember({
      env,
      slug,
      groupId: body?.groupId,
      principal: body?.principal || body?.member,
      actorPrincipal: actor.principal,
      deps,
    });
    if (!result.ok) return routeError(deps, result, headers);
    return jsonResponse(deps, { ok: true, store: result.store, group: result.group, member: result.member }, 200, headers);
  }
  if (action === 'groups/remove-member') {
    const result = await removeWorkerGroupMember({
      env,
      slug,
      groupId: body?.groupId,
      principal: body?.principal || body?.member,
      actorPrincipal: actor.principal,
      deps,
    });
    if (!result.ok) return routeError(deps, result, headers);
    return jsonResponse(deps, { ok: true, store: result.store, groupId: result.groupId, principal: result.principal }, 200, headers);
  }
  if (action === 'groups/list') {
    const result = await listWorkerGroups({
      env,
      slug,
      actorPrincipalResult: actor,
      admin: true,
    });
    if (!result.ok) return routeError(deps, result, headers);
    return jsonResponse(deps, { ok: true, store: result.store, groups: result.groups }, 200, headers);
  }
  if (action === 'groups/list-members') {
    const result = await listWorkerGroupMembers({
      env,
      slug,
      groupId: body?.groupId,
    });
    if (!result.ok) return routeError(deps, result, headers);
    return jsonResponse(deps, { ok: true, store: result.store, group: result.group, members: result.members }, 200, headers);
  }
  return null;
};

export const workerGroupsRoute = async ({
  path,
  method,
  request,
  env,
  slug,
  requesterAddress,
  authScopes,
  baseHeaders,
  deps,
} = {}) => {
  const actor = resolveWorkerGroupPrincipal({ requesterAddress, authScopes, deps });
  if (!actor.ok) {
    return jsonResponse(deps, { error: 'Missing worker group principal.', reason: actor.reason }, 401, baseHeaders);
  }
  if (path === '/groups/my-memberships' && (method === 'GET' || method === 'POST')) {
    const result = await listWorkerGroupMemberships({ env, slug, principal: actor.principal, deps });
    if (!result.ok) return routeError(deps, result, baseHeaders);
    return jsonResponse(deps, {
      ok: true,
      store: result.store,
      principal: result.principal,
      memberships: result.memberships,
    }, 200, baseHeaders);
  }
  if (path === '/groups/list' && (method === 'GET' || method === 'POST')) {
    const result = await listWorkerGroups({ env, slug, actorPrincipalResult: actor, admin: false });
    if (!result.ok) return routeError(deps, result, baseHeaders);
    return jsonResponse(deps, { ok: true, store: result.store, groups: result.groups }, 200, baseHeaders);
  }
  if (path === '/groups/join' && method === 'POST') {
    const parsed = await parseRouteBody(request);
    if (!parsed.ok) return jsonResponse(deps, { error: parsed.error }, 400, baseHeaders);
    const store = resolveWorkerGroupStore(env);
    if (!store) return routeError(deps, { status: 501, reason: 'worker_group_store_not_configured' }, baseHeaders);
    const group = await readGroupRecord({ store, slug, groupId: parsed.body.groupId });
    if (!group || group.deletedAt) return routeError(deps, { status: 404, reason: 'worker_group_not_found' }, baseHeaders);
    if (group.joinMode !== WORKER_GROUP_JOIN_MODES.OPEN) {
      return routeError(deps, { status: 403, reason: 'worker_group_join_denied' }, baseHeaders);
    }
    const result = await addWorkerGroupMember({
      env,
      slug,
      groupId: group.groupId,
      principal: actor.principal,
      actorPrincipal: actor.principal,
      deps,
    });
    if (!result.ok) return routeError(deps, result, baseHeaders);
    return jsonResponse(deps, { ok: true, store: result.store, group: result.group, member: result.member }, 200, baseHeaders);
  }
  return jsonResponse(deps, { error: 'Not found.' }, 404, baseHeaders);
};
