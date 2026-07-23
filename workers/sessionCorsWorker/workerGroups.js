import { normalizeWorkerSessionSlug, validateInboundWorkerSessionSlug } from './sessionSlugResolution.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';

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
export const MAX_WORKER_GROUP_ID_LENGTH = 80;
export const MAX_WORKER_GROUP_SESSION_SLUG_LENGTH = 128;
export const DEFAULT_WORKER_GROUP_MEMBER_PAGE_SIZE = 250;
export const MAX_WORKER_GROUP_MEMBER_PAGE_SIZE = 250;
const WORKER_GROUPS_FRESH_BOOTSTRAP_SENTINEL = 'fresh-template-v2';

const IMPLEMENTED_JOIN_MODES = new Set([WORKER_GROUP_JOIN_MODES.OPEN, WORKER_GROUP_JOIN_MODES.ADMIN_ADD]);

const safeSlugPart = (value) =>
	trim(value || 'general')
		.toLowerCase()
		.replace(/[^a-z0-9._:-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'general';

const safeKeyPart = (value) =>
	trim(value || 'id')
		.toLowerCase()
		.replace(/[^a-z0-9._:-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'id';

export const normalizeWorkerGroupId = (value) => {
	const normalized = trim(value).toLowerCase();
	if (!normalized || normalized.length > MAX_WORKER_GROUP_ID_LENGTH) return '';
	if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) return '';
	return normalized;
};

const encodedPrincipalKeyPart = (value) =>
	btoa(trim(value || 'id'))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '') || 'id';

const canonicalSessionIdKeyPart = (value) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: value });
	if (!canonicalSessionId) return '';
	const hex = canonicalSessionId.slice(2);
	let binary = '';
	for (let index = 0; index < hex.length; index += 2) {
		binary += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const canonicalWorkerGroupSessionSlug = (value) => {
	const validated = validateInboundWorkerSessionSlug(value);
	if (!validated.ok) return '';
	const slug = normalizeWorkerSessionSlug(validated.slug) || 'general';
	return slug.length <= MAX_WORKER_GROUP_SESSION_SLUG_LENGTH ? slug : '';
};

const nowIso = (deps = {}) => new Date(deps.now?.() || Date.now()).toISOString();

const parsePositiveInt = (value, fallback) => {
	const parsed = Number.parseInt(trim(value), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveWorkerGroupMemberPageRequest = ({ cursor, limit } = {}) => {
	const normalizedCursor = cursor == null ? '' : cursor;
	const normalizedLimit = limit == null || limit === '' ? DEFAULT_WORKER_GROUP_MEMBER_PAGE_SIZE : Number(limit);
	if (
		typeof normalizedCursor !== 'string' ||
		normalizedCursor.length > 1024 ||
		!Number.isSafeInteger(normalizedLimit) ||
		normalizedLimit < 1 ||
		normalizedLimit > MAX_WORKER_GROUP_MEMBER_PAGE_SIZE
	) {
		return {
			ok: false,
			status: 400,
			reason: 'worker_group_member_page_invalid',
		};
	}
	return {
		ok: true,
		cursor: normalizedCursor,
		limit: normalizedLimit,
	};
};

const WORKER_GROUP_MEMBER_CURSOR_PREFIX = 'wg2:';

const decodeWorkerGroupMemberCursor = (cursor = '') => {
	if (!cursor.startsWith(WORKER_GROUP_MEMBER_CURSOR_PREFIX)) {
		return { source: 'canonical', cursor };
	}
	const encoded = cursor.slice(WORKER_GROUP_MEMBER_CURSOR_PREFIX.length);
	const separatorIndex = encoded.indexOf(':');
	const source = encoded.slice(0, separatorIndex);
	if (separatorIndex < 0 || (source !== 'canonical' && source !== 'legacy')) {
		throw new Error('Worker group member cursor is invalid.');
	}
	return {
		source,
		cursor: encoded.slice(separatorIndex + 1),
	};
};

const encodeWorkerGroupMemberCursor = (source, cursor = '') => `${WORKER_GROUP_MEMBER_CURSOR_PREFIX}${source}:${cursor}`;

export const resolveWorkerGroupCaps = (env = {}) => ({
	maxGroupsPerSession: parsePositiveInt(env.CE_WORKER_GROUP_MAX_GROUPS_PER_SESSION, DEFAULT_WORKER_GROUP_MAX_GROUPS_PER_SESSION),
	maxMembersPerGroup: parsePositiveInt(env.CE_WORKER_GROUP_MAX_MEMBERS_PER_GROUP, DEFAULT_WORKER_GROUP_MAX_MEMBERS_PER_GROUP),
});

export const resolveWorkerGroupsKv = (env = {}) =>
	env.CE_WORKER_GROUPS_KV || env.GROUP_KV || env.CE_STORAGE_INDEX_KV || env.STORAGE_INDEX_KV || env.STORAGE_KV || null;

const resolveWorkerGroupStore = (env = {}) => {
	const kv = resolveWorkerGroupsKv(env);
	if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') return { kind: 'kv', store: kv };
	return null;
};

const workerGroupIdentityKeyPrefix = ({ slug, sessionId }) => {
	const canonicalSlug = canonicalWorkerGroupSessionSlug(slug);
	const sessionIdPart = canonicalSessionIdKeyPart(sessionId);
	if (!canonicalSlug || !sessionIdPart) {
		throw new Error('Worker group session identity is invalid.');
	}
	return `${canonicalSlug}:${sessionIdPart}`;
};

const workerGroupRecordMatchesIdentity = ({ row, slug, sessionId }) => {
	const canonicalSlug = canonicalWorkerGroupSessionSlug(slug);
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	return (
		isObj(row) &&
		!!canonicalSlug &&
		!!canonicalSessionId &&
		trim(row.sessionSlug) === canonicalSlug &&
		resolveCanonicalWorkerSessionIdHex({ sessionId: row.sessionId }) === canonicalSessionId
	);
};

const groupKey = ({ slug, sessionId, groupId }) =>
	`ce-worker-group:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:${normalizeWorkerGroupId(groupId)}`;
const groupPrefix = ({ slug, sessionId }) => `ce-worker-group:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:`;
const groupIndexKey = ({ slug, sessionId, groupId }) =>
	`ce-worker-group-index:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:${normalizeWorkerGroupId(groupId)}`;
const groupIndexPrefix = ({ slug, sessionId }) => `ce-worker-group-index:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:`;
const memberKey = ({ slug, sessionId, groupId, principalKey }) =>
	`ce-worker-group-member:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:${normalizeWorkerGroupId(groupId)}:${encodedPrincipalKeyPart(principalKey)}`;
const memberIndexKey = ({ slug, sessionId, principalKey, groupId }) =>
	`ce-worker-group-principal:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:${encodedPrincipalKeyPart(principalKey)}:${normalizeWorkerGroupId(groupId)}`;
const memberPrefix = ({ slug, sessionId, groupId }) =>
	`ce-worker-group-member:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:${normalizeWorkerGroupId(groupId)}:`;
const principalPrefix = ({ slug, sessionId, principalKey }) =>
	`ce-worker-group-principal:${workerGroupIdentityKeyPrefix({ slug, sessionId })}:${encodedPrincipalKeyPart(principalKey)}:`;

const legacyGroupKey = ({ slug, groupId }) => `ce-worker-group:${safeSlugPart(slug)}:${normalizeWorkerGroupId(groupId)}`;
const legacyGroupPrefix = ({ slug }) => `ce-worker-group:${safeSlugPart(slug)}:`;
const legacyGroupIndexKey = ({ slug, groupId }) => `ce-worker-group-index:${safeSlugPart(slug)}:${normalizeWorkerGroupId(groupId)}`;
const legacyGroupIndexPrefix = ({ slug }) => `ce-worker-group-index:${safeSlugPart(slug)}:`;
const legacyEncodedMemberKey = ({ slug, groupId, principalKey }) =>
	`ce-worker-group-member:${safeSlugPart(slug)}:${normalizeWorkerGroupId(groupId)}:${encodedPrincipalKeyPart(principalKey)}`;
const legacyCaseFoldedMemberKey = ({ slug, groupId, principalKey }) =>
	`ce-worker-group-member:${safeSlugPart(slug)}:${normalizeWorkerGroupId(groupId)}:${safeKeyPart(principalKey)}`;
const legacyMemberPrefix = ({ slug, groupId }) => `ce-worker-group-member:${safeSlugPart(slug)}:${normalizeWorkerGroupId(groupId)}:`;
const legacyEncodedPrincipalPrefix = ({ slug, principalKey }) =>
	`ce-worker-group-principal:${safeSlugPart(slug)}:${encodedPrincipalKeyPart(principalKey)}:`;
const legacyCaseFoldedPrincipalPrefix = ({ slug, principalKey }) =>
	`ce-worker-group-principal:${safeSlugPart(slug)}:${safeKeyPart(principalKey)}:`;
const legacyEncodedMemberIndexKey = ({ slug, principalKey, groupId }) =>
	`${legacyEncodedPrincipalPrefix({ slug, principalKey })}${normalizeWorkerGroupId(groupId)}`;
const legacyCaseFoldedMemberIndexKey = ({ slug, principalKey, groupId }) =>
	`${legacyCaseFoldedPrincipalPrefix({ slug, principalKey })}${normalizeWorkerGroupId(groupId)}`;

const jsonResponse = (deps, body, status, headers) =>
	deps?.json?.(body, status, headers) || new Response(JSON.stringify(body), { status, headers });

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

const principalKeyFor = (kind, value) => {
	const normalizedValue = trim(value);
	const keyValue = kind === 'evm_address' || kind === 'passkey_account' ? normalizedValue.toLowerCase() : normalizedValue;
	return `${kind}:${keyValue}`;
};

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
	const explicit = scopes.principal || scopes.workerPrincipal || scopes.subjectPrincipal || scopes.delegationPrincipal;
	if (explicit) return normalizeWorkerGroupPrincipal(explicit, deps);
	const grantId = trim(scopes.grantId || scopes.agentGrant?.grantId || scopes.agent_grant?.grantId || scopes.delegation?.grantId);
	if (grantId) return normalizeWorkerGroupPrincipal({ kind: 'agent', grantId }, deps);
	const telegramPrincipal =
		scopes.telegramPrincipal ||
		scopes.integrationPrincipal?.telegram ||
		scopes.integrationPrincipal?.telegramPrincipal ||
		scopes.integrationPrincipal?.principalId;
	if (telegramPrincipal) return normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: telegramPrincipal }, deps);
	const telegramId = trim(
		scopes.telegramUserId || scopes.integrationPrincipal?.telegramUserId || scopes.integrationPrincipal?.telegram_user_id,
	);
	if (telegramId) return normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: `telegram:${telegramId}` }, deps);
	if (requesterAddress) return normalizeWorkerGroupPrincipal({ kind: 'evm_address', address: requesterAddress }, deps);
	return { ok: false, reason: 'missing_principal' };
};

export const createWorkerGroupId = (deps = {}) => {
	const supplied = trim(deps.randomUUID?.());
	if (supplied) {
		const normalized = normalizeWorkerGroupId(supplied);
		if (normalized) return normalized;
		throw new Error('Generated worker group id is invalid.');
	}
	const cryptoImpl = deps.crypto || globalThis.crypto;
	if (typeof cryptoImpl?.randomUUID === 'function') {
		const normalized = normalizeWorkerGroupId(cryptoImpl.randomUUID());
		if (normalized) return normalized;
	}
	const bytes = new Uint8Array(16);
	const getRandomValues = deps.getRandomValues || cryptoImpl?.getRandomValues?.bind(cryptoImpl);
	if (typeof getRandomValues !== 'function') throw new Error('Secure randomness is required for worker group ids.');
	getRandomValues(bytes);
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
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
			...(existing
				? {}
				: {
						createdBy: actorPrincipal,
						createdAt: updatedAt,
					}),
		},
	};
};

const kvGetJsonStrict = async (kv, key) => {
	const raw = await kv.get(key);
	if (raw == null) return null;
	if (typeof raw === 'string') {
		const parsed = JSON.parse(raw);
		if (!isObj(parsed)) throw new Error('Worker group KV record is malformed.');
		return parsed;
	}
	if (!isObj(raw)) throw new Error('Worker group KV record is malformed.');
	return raw;
};

const kvGetLegacyJson = async (kv, key) => {
	try {
		return await kvGetJsonStrict(kv, key);
	} catch {
		return null;
	}
};

export const resolveWorkerGroupBootstrap = async ({ env, slug, sessionId } = {}) => {
	const canonicalSlug = canonicalWorkerGroupSessionSlug(slug);
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!canonicalSlug || !canonicalSessionId) {
		return { ok: false, status: 400, reason: 'worker_group_session_identity_invalid' };
	}
	const explicitBootstrapId = trim(env?.CE_WORKER_GROUPS_BOOTSTRAP);
	if (explicitBootstrapId === WORKER_GROUPS_FRESH_BOOTSTRAP_SENTINEL) {
		const kv = resolveWorkerGroupsKv(env);
		if (typeof kv?.list === 'function') {
			try {
				const existingGroups = await scanWorkerGroupRecordsForIdentity({
					store: { kind: 'kv', store: kv },
					slug: canonicalSlug,
					sessionId: canonicalSessionId,
					includeDeleted: true,
				});
				if (existingGroups.length) {
					return {
						ok: false,
						status: 503,
						reason: 'worker_group_capacity_reconciliation_required',
					};
				}
			} catch {
				return {
					ok: false,
					status: 503,
					reason: 'worker_group_capacity_state_unavailable',
				};
			}
		}
		return { ok: true, bootstrapId: explicitBootstrapId };
	}
	if (explicitBootstrapId) {
		return {
			ok: false,
			status: 503,
			reason: 'worker_group_capacity_reconciliation_required',
		};
	}
	const kv = resolveWorkerGroupsKv(env);
	if (!kv?.get) {
		return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	}
	try {
		const configSlug = normalizeWorkerSessionSlug(canonicalSlug);
		const config = await kvGetJsonStrict(kv, `session:${configSlug}:config`);
		const bootstrap = isObj(config?.workerGroupsBootstrap) ? config.workerGroupsBootstrap : null;
		const configIdentity = normalizeWorkerSessionSlug(config?.slug);
		const configSessionId = resolveCanonicalWorkerSessionIdHex(config);
		const expectedIdentity = normalizeWorkerSessionSlug(canonicalSlug);
		const bootstrapId = trim(bootstrap?.bootstrapId);
		if (
			Number(bootstrap?.version) === 2 &&
			bootstrap?.state === 'fresh_empty' &&
			/^[0-9a-f]{64}$/.test(bootstrapId) &&
			configIdentity === expectedIdentity &&
			configSessionId === canonicalSessionId
		) {
			const existingGroups =
				typeof kv.list === 'function'
					? await scanWorkerGroupRecordsForIdentity({
							store: { kind: 'kv', store: kv },
							slug: canonicalSlug,
							sessionId: canonicalSessionId,
							includeDeleted: true,
						})
					: [];
			if (existingGroups.length) {
				return {
					ok: false,
					status: 503,
					reason: 'worker_group_capacity_reconciliation_required',
				};
			}
			return { ok: true, bootstrapId };
		}
		return {
			ok: false,
			status: 503,
			reason: 'worker_group_capacity_reconciliation_required',
		};
	} catch {
		return {
			ok: false,
			status: 503,
			reason: 'worker_group_capacity_state_unavailable',
		};
	}
};

const kvListKeys = async (kv, prefix) => {
	if (typeof kv.list !== 'function') return [];
	const keys = [];
	const seenCursors = new Set();
	let cursor = '';
	let hasMore = true;
	while (hasMore) {
		// Cloudflare KV list responses are paginated. Capacity initialization must
		// consume every page or a pre-existing session could be seeded below its
		// real group/member count.
		const listed = await kv.list({ prefix, ...(cursor ? { cursor } : {}) });
		if (!listed || typeof listed !== 'object' || !Array.isArray(listed.keys)) {
			throw new Error('Worker group KV listing returned an invalid page.');
		}
		keys.push(...listed.keys.map((entry) => trim(entry?.name || entry)).filter(Boolean));
		if (listed.list_complete !== false) {
			hasMore = false;
			continue;
		}
		const nextCursor = trim(listed.cursor);
		if (!nextCursor || seenCursors.has(nextCursor)) {
			throw new Error('Worker group KV listing did not provide a usable continuation cursor.');
		}
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	}
	return keys;
};

const kvListKeyPage = async (kv, prefix, { cursor = '', limit } = {}) => {
	const listed = await kv.list({
		prefix,
		limit,
		...(cursor ? { cursor } : {}),
	});
	if (!listed || typeof listed !== 'object' || !Array.isArray(listed.keys)) {
		throw new Error('Worker group KV listing returned an invalid page.');
	}
	if (listed.keys.length > limit) {
		throw new Error('Worker group KV listing exceeded the requested page size.');
	}
	const keys = listed.keys.map((entry) => trim(entry?.name || entry)).filter(Boolean);
	if (listed.list_complete !== false) return { keys, nextCursor: '' };
	const nextCursor = typeof listed.cursor === 'string' ? listed.cursor : '';
	if (!nextCursor || nextCursor.length > 1024 || nextCursor === cursor) {
		throw new Error('Worker group KV listing did not provide a usable continuation cursor.');
	}
	return { keys, nextCursor };
};

const readGroupRecord = async ({ store, slug, sessionId, groupId }) => {
	const normalizedGroupId = normalizeWorkerGroupId(groupId);
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!normalizedGroupId) throw new Error('Worker group id is invalid.');
	if (!canonicalSessionId) throw new Error('Worker group session identity is invalid.');
	const canonicalKey = groupKey({
		slug,
		sessionId: canonicalSessionId,
		groupId: normalizedGroupId,
	});
	const canonicalRow = await kvGetJsonStrict(store.store, canonicalKey);
	if (canonicalRow) {
		if (
			!workerGroupRecordMatchesIdentity({
				row: canonicalRow,
				slug,
				sessionId: canonicalSessionId,
			}) ||
			normalizeWorkerGroupId(canonicalRow.groupId) !== normalizedGroupId
		) {
			throw new Error('Worker group KV record does not match its key.');
		}
		return canonicalRow;
	}

	const legacyRow = await kvGetLegacyJson(store.store, legacyGroupKey({ slug, groupId: normalizedGroupId }));
	if (
		!legacyRow ||
		!workerGroupRecordMatchesIdentity({
			row: legacyRow,
			slug,
			sessionId: canonicalSessionId,
		}) ||
		normalizeWorkerGroupId(legacyRow.groupId) !== normalizedGroupId
	) {
		return null;
	}
	await writeGroupRecord({
		store,
		slug,
		sessionId: canonicalSessionId,
		group: legacyRow,
	});
	return legacyRow;
};

const writeGroupRecord = async ({ store, slug, sessionId, group }) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({
		sessionId: sessionId || group?.sessionId,
	});
	if (
		!canonicalSessionId ||
		!workerGroupRecordMatchesIdentity({
			row: group,
			slug,
			sessionId: canonicalSessionId,
		}) ||
		!normalizeWorkerGroupId(group?.groupId)
	) {
		throw new Error('Worker group record identity is invalid.');
	}
	await store.store.put(groupKey({ slug, sessionId: canonicalSessionId, groupId: group.groupId }), JSON.stringify(group));
	await store.store.put(groupIndexKey({ slug, sessionId: canonicalSessionId, groupId: group.groupId }), group.groupId);
};

const listGroupRecords = async ({ store, slug, sessionId, includeDeleted = false }) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!canonicalSessionId) throw new Error('Worker group session identity is invalid.');
	const canonicalKeys = await kvListKeys(store.store, groupIndexPrefix({ slug, sessionId: canonicalSessionId }));
	const legacyKeys = await kvListKeys(store.store, legacyGroupIndexPrefix({ slug }));
	const groups = new Map();
	for (const key of canonicalKeys) {
		const groupId = await store.store.get(key);
		const normalizedGroupId = normalizeWorkerGroupId(groupId);
		if (
			!normalizedGroupId ||
			key !==
				groupIndexKey({
					slug,
					sessionId: canonicalSessionId,
					groupId: normalizedGroupId,
				})
		) {
			throw new Error('Worker group index record is malformed.');
		}
		const group = await readGroupRecord({
			store,
			slug,
			sessionId: canonicalSessionId,
			groupId: normalizedGroupId,
		});
		if (!group) throw new Error('Worker group index points to a missing group.');
		if (includeDeleted || !group.deletedAt) groups.set(normalizedGroupId, group);
	}
	for (const key of legacyKeys) {
		let groupId;
		try {
			groupId = await store.store.get(key);
		} catch {
			continue;
		}
		const normalizedGroupId = normalizeWorkerGroupId(groupId);
		if (!normalizedGroupId || key !== legacyGroupIndexKey({ slug, groupId: normalizedGroupId })) {
			continue;
		}
		const group = await readGroupRecord({
			store,
			slug,
			sessionId: canonicalSessionId,
			groupId: normalizedGroupId,
		});
		if (group && (includeDeleted || !group.deletedAt)) {
			groups.set(normalizedGroupId, group);
		}
	}
	return [...groups.values()];
};

const scanWorkerGroupRecordsForIdentity = async ({ store, slug, sessionId, includeDeleted = false }) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!canonicalSessionId) throw new Error('Worker group session identity is invalid.');
	const canonicalKeys = await kvListKeys(store.store, groupPrefix({ slug, sessionId: canonicalSessionId }));
	const legacyPrefix = legacyGroupPrefix({ slug });
	const legacyKeys = (await kvListKeys(store.store, legacyPrefix)).filter((key) => !key.slice(legacyPrefix.length).includes(':'));
	const groups = new Map();

	for (const key of canonicalKeys) {
		const row = await kvGetJsonStrict(store.store, key);
		const groupId = normalizeWorkerGroupId(row?.groupId);
		if (
			!groupId ||
			!workerGroupRecordMatchesIdentity({
				row,
				slug,
				sessionId: canonicalSessionId,
			}) ||
			groupKey({ slug, sessionId: canonicalSessionId, groupId }) !== key
		) {
			throw new Error('Worker group KV record does not match its capacity key.');
		}
		if (includeDeleted || !row.deletedAt) groups.set(groupId, row);
	}

	for (const key of legacyKeys) {
		const row = await kvGetLegacyJson(store.store, key);
		const groupId = normalizeWorkerGroupId(row?.groupId);
		if (
			!groupId ||
			key !== legacyGroupKey({ slug, groupId }) ||
			!workerGroupRecordMatchesIdentity({
				row,
				slug,
				sessionId: canonicalSessionId,
			})
		) {
			continue;
		}
		await writeGroupRecord({
			store,
			slug,
			sessionId: canonicalSessionId,
			group: row,
		});
		if (includeDeleted || !row.deletedAt) groups.set(groupId, row);
	}

	return [...groups.values()];
};

const writeMembershipRecord = async ({ store, slug, sessionId, groupId, member }) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({
		sessionId: sessionId || member?.sessionId,
	});
	const normalizedGroupId = normalizeWorkerGroupId(groupId);
	const normalizedPrincipal = normalizeWorkerGroupPrincipal(member?.principal);
	if (
		!canonicalSessionId ||
		!normalizedGroupId ||
		!workerGroupRecordMatchesIdentity({
			row: member,
			slug,
			sessionId: canonicalSessionId,
		}) ||
		normalizeWorkerGroupId(member?.groupId) !== normalizedGroupId ||
		!normalizedPrincipal.ok ||
		trim(member?.principalKey) !== normalizedPrincipal.key
	) {
		throw new Error('Worker group membership record identity is invalid.');
	}
	await store.store.put(
		memberKey({
			slug,
			sessionId: canonicalSessionId,
			groupId: normalizedGroupId,
			principalKey: member.principalKey,
		}),
		JSON.stringify(member),
	);
	await store.store.put(
		memberIndexKey({
			slug,
			sessionId: canonicalSessionId,
			principalKey: member.principalKey,
			groupId: normalizedGroupId,
		}),
		normalizedGroupId,
	);
};

const canonicalizeMembershipRecord = ({ row, slug, sessionId, groupId, principalKey = '' }) => {
	if (!row) return null;
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	const normalizedPrincipal = normalizeWorkerGroupPrincipal(row.principal);
	const canonicalPrincipalKey = normalizedPrincipal.ok ? normalizedPrincipal.key : '';
	if (
		!canonicalSessionId ||
		!canonicalPrincipalKey ||
		(principalKey && canonicalPrincipalKey !== principalKey) ||
		!workerGroupRecordMatchesIdentity({
			row,
			slug,
			sessionId: canonicalSessionId,
		}) ||
		normalizeWorkerGroupId(row.groupId) !== normalizeWorkerGroupId(groupId)
	) {
		return null;
	}
	return {
		...row,
		principal: normalizedPrincipal.principal,
		principalKey: canonicalPrincipalKey,
	};
};

const readMembershipRecord = async ({ store, slug, sessionId, groupId, principalKey }) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!canonicalSessionId) throw new Error('Worker group session identity is invalid.');
	const canonicalKey = memberKey({
		slug,
		sessionId: canonicalSessionId,
		groupId,
		principalKey,
	});
	const canonicalRow = await kvGetJsonStrict(store.store, canonicalKey);
	if (canonicalRow) {
		const canonical = canonicalizeMembershipRecord({
			row: canonicalRow,
			slug,
			sessionId: canonicalSessionId,
			groupId,
			principalKey,
		});
		if (!canonical) {
			throw new Error('Worker group membership KV record does not match its key.');
		}
		return canonical;
	}

	const legacyKeys = [legacyEncodedMemberKey({ slug, groupId, principalKey }), legacyCaseFoldedMemberKey({ slug, groupId, principalKey })];
	for (const key of new Set(legacyKeys)) {
		const row = await kvGetLegacyJson(store.store, key);
		const canonical = canonicalizeMembershipRecord({
			row,
			slug,
			sessionId: canonicalSessionId,
			groupId,
			principalKey,
		});
		if (!canonical) continue;
		await writeMembershipRecord({
			store,
			slug,
			sessionId: canonicalSessionId,
			groupId,
			member: canonical,
		});
		return canonical;
	}
	return null;
};

const listMembershipRecords = async ({ store, slug, sessionId, groupId = '', principalKey = '' }) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!canonicalSessionId) throw new Error('Worker group session identity is invalid.');
	const sources = groupId
		? [
				{
					legacy: false,
					prefix: memberPrefix({
						slug,
						sessionId: canonicalSessionId,
						groupId,
					}),
				},
				{
					legacy: true,
					prefix: legacyMemberPrefix({ slug, groupId }),
				},
			]
		: [
				{
					legacy: false,
					prefix: principalPrefix({
						slug,
						sessionId: canonicalSessionId,
						principalKey,
					}),
				},
				{
					legacy: true,
					prefix: legacyEncodedPrincipalPrefix({ slug, principalKey }),
				},
				{
					legacy: true,
					prefix: legacyCaseFoldedPrincipalPrefix({ slug, principalKey }),
				},
			];
	const keyedSources = new Map();
	for (const source of sources) {
		const keys = await kvListKeys(store.store, source.prefix);
		for (const key of keys) {
			const existing = keyedSources.get(key);
			if (!existing || (existing.legacy && !source.legacy)) {
				keyedSources.set(key, source);
			}
		}
	}
	const members = new Map();
	for (const [key, source] of keyedSources) {
		let indexedGroupId = groupId;
		if (!indexedGroupId) {
			try {
				indexedGroupId = await store.store.get(key);
			} catch {
				if (source.legacy) continue;
				throw new Error('Worker group membership index is unavailable.');
			}
		}
		if (!normalizeWorkerGroupId(indexedGroupId)) {
			if (source.legacy) continue;
			throw new Error('Worker group membership index is malformed.');
		}
		if (!groupId) {
			const validIndexKey = source.legacy
				? key === legacyEncodedMemberIndexKey({ slug, principalKey, groupId: indexedGroupId }) ||
					key === legacyCaseFoldedMemberIndexKey({ slug, principalKey, groupId: indexedGroupId })
				: key ===
					memberIndexKey({
						slug,
						sessionId: canonicalSessionId,
						principalKey,
						groupId: indexedGroupId,
					});
			if (!validIndexKey) {
				if (source.legacy) continue;
				throw new Error('Worker group membership index does not match its key.');
			}
		}
		const rawRow = groupId
			? source.legacy
				? await kvGetLegacyJson(store.store, key)
				: await kvGetJsonStrict(store.store, key)
			: await readMembershipRecord({
					store,
					slug,
					sessionId: canonicalSessionId,
					groupId: indexedGroupId,
					principalKey,
				});
		const row = canonicalizeMembershipRecord({
			row: rawRow,
			slug,
			sessionId: canonicalSessionId,
			groupId: indexedGroupId,
			principalKey,
		});
		if (!row && !source.legacy && rawRow) {
			throw new Error('Worker group membership KV record does not match its key.');
		}
		if (
			row &&
			!row.removedAt &&
			(!groupId || normalizeWorkerGroupId(row.groupId) === normalizeWorkerGroupId(groupId)) &&
			(!principalKey || row.principalKey === principalKey)
		) {
			if (source.legacy) {
				await writeMembershipRecord({
					store,
					slug,
					sessionId: canonicalSessionId,
					groupId: indexedGroupId,
					member: row,
				});
			}
			members.set(`${row.groupId}\n${row.principalKey}`, row);
		}
	}
	return [...members.values()];
};

const listMembershipRecordPage = async ({ store, slug, sessionId, groupId, cursor, limit }) => {
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!canonicalSessionId) throw new Error('Worker group session identity is invalid.');
	const decodedCursor = decodeWorkerGroupMemberCursor(cursor);
	const members = new Map();
	const readPage = async ({ source, pageCursor = '', pageLimit }) => {
		const legacy = source === 'legacy';
		const page = await kvListKeyPage(
			store.store,
			legacy ? legacyMemberPrefix({ slug, groupId }) : memberPrefix({ slug, sessionId: canonicalSessionId, groupId }),
			{
				cursor: pageCursor,
				limit: pageLimit,
			},
		);
		for (const key of page.keys) {
			const rawRow = legacy ? await kvGetLegacyJson(store.store, key) : await kvGetJsonStrict(store.store, key);
			const row = canonicalizeMembershipRecord({
				row: rawRow,
				slug,
				sessionId: canonicalSessionId,
				groupId,
			});
			if (!row) {
				if (!legacy && rawRow) {
					throw new Error('Worker group membership KV record does not match its key.');
				}
				continue;
			}
			const validKey = legacy
				? key ===
						legacyEncodedMemberKey({
							slug,
							groupId,
							principalKey: row.principalKey,
						}) ||
					key ===
						legacyCaseFoldedMemberKey({
							slug,
							groupId,
							principalKey: row.principalKey,
						})
				: key ===
					memberKey({
						slug,
						sessionId: canonicalSessionId,
						groupId,
						principalKey: row.principalKey,
					});
			if (!validKey) {
				if (!legacy) {
					throw new Error('Worker group membership KV record does not match its key.');
				}
				continue;
			}
			if (legacy) {
				await writeMembershipRecord({
					store,
					slug,
					sessionId: canonicalSessionId,
					groupId,
					member: row,
				});
			}
			if (!row.removedAt) {
				members.set(`${row.groupId}\n${row.principalKey}`, row);
			}
		}
		return page;
	};

	if (decodedCursor.source === 'legacy') {
		const legacyPage = await readPage({
			source: 'legacy',
			pageCursor: decodedCursor.cursor,
			pageLimit: limit,
		});
		return {
			members: [...members.values()],
			nextCursor: legacyPage.nextCursor ? encodeWorkerGroupMemberCursor('legacy', legacyPage.nextCursor) : '',
		};
	}

	const canonicalPage = await readPage({
		source: 'canonical',
		pageCursor: decodedCursor.cursor,
		pageLimit: limit,
	});
	if (canonicalPage.nextCursor) {
		return {
			members: [...members.values()],
			nextCursor: encodeWorkerGroupMemberCursor('canonical', canonicalPage.nextCursor),
		};
	}
	const remainingLimit = limit - members.size;
	if (remainingLimit <= 0) {
		return {
			members: [...members.values()],
			nextCursor: encodeWorkerGroupMemberCursor('legacy'),
		};
	}
	const legacyPage = await readPage({
		source: 'legacy',
		pageLimit: remainingLimit,
	});
	return {
		members: [...members.values()],
		nextCursor: legacyPage.nextCursor ? encodeWorkerGroupMemberCursor('legacy', legacyPage.nextCursor) : '',
	};
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

const isDefinitiveWorkerGroupMembershipMiss = (result) =>
	(Number(result?.status) === 403 && result?.reason === 'worker_group_membership_denied') ||
	(Number(result?.status) === 404 && result?.reason === 'worker_group_not_found');

const normalizeWorkerGroupMembershipFailure = (result) => ({
	...(result && typeof result === 'object' ? result : {}),
	ok: false,
	status: Number(result?.status || 0) || 503,
	reason: result?.reason || 'worker_group_coordination_unavailable',
});

export const createWorkerGroup = async ({ env, slug, sessionId, input, actorPrincipal, capacityAuthorized = false, deps = {} } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const canonicalSlug = canonicalWorkerGroupSessionSlug(slug);
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!canonicalSlug || !canonicalSessionId) {
		return { ok: false, status: 400, reason: 'worker_group_session_identity_invalid' };
	}
	if (!capacityAuthorized) {
		const caps = resolveWorkerGroupCaps(env);
		const existingGroups = await listGroupRecords({
			store,
			slug: canonicalSlug,
			sessionId: canonicalSessionId,
		});
		if (existingGroups.length >= caps.maxGroupsPerSession) {
			return { ok: false, status: 409, reason: 'worker_group_session_cap_exceeded' };
		}
	}
	const normalized = normalizeGroupPatch({ input, actorPrincipal, deps });
	if (!normalized.ok) return normalized;
	const requestedGroupId = trim(input?.groupId);
	const groupId = requestedGroupId ? normalizeWorkerGroupId(requestedGroupId) : createWorkerGroupId(deps);
	if (!groupId) return { ok: false, status: 400, reason: 'invalid_worker_group_id' };
	const existing = await readGroupRecord({
		store,
		slug: canonicalSlug,
		sessionId: canonicalSessionId,
		groupId,
	});
	if (existing) {
		return {
			ok: false,
			status: 409,
			reason: existing.deletedAt ? 'worker_group_id_retired' : 'worker_group_exists',
			groupId,
		};
	}
	const group = {
		groupId,
		sessionSlug: canonicalSlug,
		sessionId: canonicalSessionId,
		...normalized.patch,
	};
	await writeGroupRecord({
		store,
		slug: canonicalSlug,
		sessionId: canonicalSessionId,
		group,
	});
	return { ok: true, store: store.kind, group, created: true };
};

export const updateWorkerGroup = async ({ env, slug, sessionId, groupId, input, actorPrincipal, deps = {} } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const existing = await readGroupRecord({ store, slug, sessionId, groupId });
	if (!existing || existing.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
	const normalized = normalizeGroupPatch({ input, actorPrincipal, existing, deps });
	if (!normalized.ok) return normalized;
	const group = { ...existing, ...normalized.patch };
	await writeGroupRecord({ store, slug, sessionId, group });
	return { ok: true, store: store.kind, group };
};

export const deleteWorkerGroup = async ({ env, slug, sessionId, groupId, actorPrincipal, deps = {} } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const existing = await readGroupRecord({ store, slug, sessionId, groupId });
	if (!existing || existing.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
	const deletedAt = nowIso(deps);
	const group = { ...existing, deletedAt, deletedBy: actorPrincipal, updatedAt: deletedAt };
	await writeGroupRecord({ store, slug, sessionId, group });
	if (typeof store.store.delete !== 'function') {
		throw new Error('Worker group KV deletion is unavailable.');
	}
	await store.store.delete(groupIndexKey({ slug, sessionId, groupId }));
	// Membership projections are not rewritten here. The strongly consistent
	// coordinator invalidates the entire group before this tombstone is written;
	// eager KV fan-out would exceed the per-invocation operation budget at the
	// configured member cap.
	return {
		ok: true,
		store: store.kind,
		groupId: normalizeWorkerGroupId(groupId),
		membersInvalidated: true,
	};
};

export const addWorkerGroupMember = async ({
	env,
	slug,
	sessionId,
	groupId,
	principal,
	actorPrincipal,
	capacityAuthorized = false,
	deps = {},
} = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const group = await readGroupRecord({ store, slug, sessionId, groupId });
	if (!group || group.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
	const normalized = normalizeWorkerGroupPrincipal(principal, deps);
	if (!normalized.ok) return { ok: false, status: 400, reason: normalized.reason };
	let existing;
	if (capacityAuthorized) {
		const existingRecord = await readMembershipRecord({
			store,
			slug,
			sessionId,
			groupId,
			principalKey: normalized.key,
		});
		existing = existingRecord && !existingRecord.removedAt ? existingRecord : null;
	} else {
		const caps = resolveWorkerGroupCaps(env);
		const members = await listMembershipRecords({ store, slug, sessionId, groupId });
		existing = members.find((member) => member.principalKey === normalized.key);
		if (!existing && members.length >= caps.maxMembersPerGroup) {
			return { ok: false, status: 409, reason: 'worker_group_member_cap_exceeded' };
		}
	}
	const addedAt = nowIso(deps);
	const member = {
		groupId: normalizeWorkerGroupId(groupId),
		sessionSlug: canonicalWorkerGroupSessionSlug(slug),
		sessionId: resolveCanonicalWorkerSessionIdHex({ sessionId }),
		principal: normalized.principal,
		principalKey: normalized.key,
		addedBy: actorPrincipal,
		addedAt: existing?.addedAt || addedAt,
	};
	await writeMembershipRecord({ store, slug, sessionId, groupId, member });
	return {
		ok: true,
		store: store.kind,
		group: redactGroupForMember(group),
		member,
		created: !existing,
	};
};

export const removeWorkerGroupMember = async ({ env, slug, sessionId, groupId, principal, actorPrincipal, deps = {} } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const group = await readGroupRecord({ store, slug, sessionId, groupId });
	if (!group || group.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
	const normalized = normalizeWorkerGroupPrincipal(principal, deps);
	if (!normalized.ok) return { ok: false, status: 400, reason: normalized.reason };
	const existing = await readMembershipRecord({
		store,
		slug,
		sessionId,
		groupId,
		principalKey: normalized.key,
	});
	if (!existing || existing.removedAt) return { ok: false, status: 404, reason: 'worker_group_member_not_found' };
	const removedAt = nowIso(deps);
	const member = { ...existing, removedAt, removedBy: actorPrincipal };
	await writeMembershipRecord({ store, slug, sessionId, groupId, member });
	if (typeof store.store.delete !== 'function') {
		throw new Error('Worker group KV deletion is unavailable.');
	}
	await store.store.delete(
		memberIndexKey({
			slug,
			sessionId,
			principalKey: normalized.key,
			groupId,
		}),
	);
	return {
		ok: true,
		store: store.kind,
		groupId: normalizeWorkerGroupId(groupId),
		principal: normalized.principal,
	};
};

export const listWorkerGroups = async ({ env, slug, sessionId, actorPrincipalResult, admin = false, expectedGroupCount } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const authoritativeGroupCount = Number(expectedGroupCount);
	if (!Number.isSafeInteger(authoritativeGroupCount) || authoritativeGroupCount < 0) {
		return normalizeWorkerGroupMembershipFailure({
			status: 503,
			reason: 'worker_group_projection_unavailable',
		});
	}
	const groups = await listGroupRecords({ store, slug, sessionId });
	if (!groups.length) {
		return authoritativeGroupCount === 0
			? { ok: true, store: store.kind, groups: [] }
			: normalizeWorkerGroupMembershipFailure({
					status: 503,
					reason: 'worker_group_projection_unavailable',
				});
	}
	const catalog = await readCoordinatedWorkerGroupCatalog({
		env,
		slug,
		sessionId,
		groupIds: groups.map((group) => group.groupId),
		principal: admin ? undefined : actorPrincipalResult?.principal,
	});
	if (!catalog.ok) return normalizeWorkerGroupMembershipFailure(catalog);
	const authorityByGroupId = new Map();
	for (const authority of catalog.groups || []) {
		const groupId = normalizeWorkerGroupId(authority?.groupId);
		const joinMode = trim(authority?.joinMode).toLowerCase();
		const memberVisibility = trim(authority?.memberVisibility).toLowerCase();
		const memberCount = Number(authority?.memberCount);
		if (
			!groupId ||
			authorityByGroupId.has(groupId) ||
			!IMPLEMENTED_JOIN_MODES.has(joinMode) ||
			!Object.values(WORKER_GROUP_MEMBER_VISIBILITY).includes(memberVisibility) ||
			!Number.isSafeInteger(memberCount) ||
			memberCount < 0
		) {
			return normalizeWorkerGroupMembershipFailure();
		}
		authorityByGroupId.set(groupId, {
			joinMode,
			memberVisibility,
			memberCount,
			isMember: authority?.isMember === true,
		});
	}
	// KV indexes are an eventually consistent projection. The Durable Object
	// catalog owns lifecycle truth, so never report a partial/false-empty list
	// when its active count proves that an index row is still missing.
	if (authorityByGroupId.size !== authoritativeGroupCount) {
		return normalizeWorkerGroupMembershipFailure({
			status: 503,
			reason: 'worker_group_projection_unavailable',
		});
	}
	const visible = [];
	for (const group of groups) {
		const authority = authorityByGroupId.get(normalizeWorkerGroupId(group.groupId));
		if (!authority) continue;
		const authoritativeGroup = {
			...group,
			joinMode: authority.joinMode,
			memberVisibility: authority.memberVisibility,
		};
		if (admin || authority.memberVisibility === WORKER_GROUP_MEMBER_VISIBILITY.SESSION) {
			visible.push(redactGroupForMember(authoritativeGroup));
			continue;
		}
		if (authority.isMember && authority.memberVisibility === WORKER_GROUP_MEMBER_VISIBILITY.MEMBERS) {
			visible.push(redactGroupForMember(authoritativeGroup));
		}
	}
	return { ok: true, store: store.kind, groups: visible };
};

export const listWorkerGroupMembers = async ({ env, slug, sessionId, groupId, cursor, limit } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const pageRequest = resolveWorkerGroupMemberPageRequest({ cursor, limit });
	if (!pageRequest.ok) return pageRequest;
	const normalizedGroupId = normalizeWorkerGroupId(groupId);
	if (!normalizedGroupId) {
		return { ok: false, status: 400, reason: 'invalid_worker_group_id' };
	}
	if (sessionId) {
		const catalog = await readCoordinatedWorkerGroupCatalog({
			env,
			slug,
			sessionId,
			groupIds: [normalizedGroupId],
		});
		if (!catalog.ok) return normalizeWorkerGroupMembershipFailure(catalog);
		if (
			!Array.isArray(catalog.groups) ||
			catalog.groups.length !== 1 ||
			normalizeWorkerGroupId(catalog.groups[0]?.groupId) !== normalizedGroupId
		) {
			return { ok: false, status: 404, reason: 'worker_group_not_found' };
		}
	}
	const group = await readGroupRecord({ store, slug, sessionId, groupId });
	if (!group || group.deletedAt) return { ok: false, status: 404, reason: 'worker_group_not_found' };
	const page = await listMembershipRecordPage({
		store,
		slug,
		sessionId,
		groupId,
		cursor: pageRequest.cursor,
		limit: pageRequest.limit,
	});
	return {
		ok: true,
		store: store.kind,
		group: redactGroupForMember(group),
		members: page.members,
		nextCursor: page.nextCursor,
	};
};

export const listWorkerGroupMemberships = async ({ env, slug, sessionId, principal, deps = {} } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	const normalized = normalizeWorkerGroupPrincipal(principal, deps);
	if (!normalized.ok) return { ok: false, status: 400, reason: normalized.reason };
	const rows = await listMembershipRecords({
		store,
		slug,
		sessionId,
		principalKey: normalized.key,
	});
	const memberships = [];
	for (const row of rows) {
		// A KV principal index is only a projection. Filter it through the
		// coordinator so a stale row cannot present a revoked membership as live.
		const authoritativeMembership = await isWorkerGroupMember({
			env,
			slug,
			sessionId,
			groupId: row.groupId,
			principal: normalized.principal,
		});
		if (!authoritativeMembership.ok) {
			if (isDefinitiveWorkerGroupMembershipMiss(authoritativeMembership)) continue;
			return normalizeWorkerGroupMembershipFailure(authoritativeMembership);
		}
		const authoritativeGroup = authoritativeMembership.group;
		const authoritativeJoinMode = trim(authoritativeGroup?.joinMode).toLowerCase();
		const authoritativeVisibility = trim(authoritativeGroup?.memberVisibility).toLowerCase();
		const authoritativeMemberCount = Number(authoritativeGroup?.memberCount);
		if (
			normalizeWorkerGroupId(authoritativeGroup?.groupId) !== normalizeWorkerGroupId(row.groupId) ||
			!IMPLEMENTED_JOIN_MODES.has(authoritativeJoinMode) ||
			!Object.values(WORKER_GROUP_MEMBER_VISIBILITY).includes(authoritativeVisibility) ||
			!Number.isSafeInteger(authoritativeMemberCount) ||
			authoritativeMemberCount < 0
		) {
			return normalizeWorkerGroupMembershipFailure();
		}
		const group = await readGroupRecord({ store, slug, sessionId, groupId: row.groupId });
		if (!group || group.deletedAt) continue;
		memberships.push({
			group: redactGroupForMember({
				...group,
				joinMode: authoritativeJoinMode,
				memberVisibility: authoritativeVisibility,
			}),
			member: row,
			memberCount: authoritativeMemberCount,
		});
	}
	return { ok: true, store: store.kind, principal: normalized.principal, memberships };
};

export const readWorkerGroupMembershipProjection = async ({
	env,
	slug,
	sessionId,
	groupId,
	principal,
	requesterAddress,
	authScopes,
	deps = {},
} = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) return { ok: false, reason: 'worker_group_store_not_configured' };
	const normalized = principal
		? normalizeWorkerGroupPrincipal(principal, deps)
		: resolveWorkerGroupPrincipal({ requesterAddress, authScopes, deps });
	if (!normalized.ok) return { ok: false, reason: normalized.reason || 'missing_principal' };
	const group = await readGroupRecord({ store, slug, sessionId, groupId });
	if (!group || group.deletedAt) return { ok: false, reason: 'worker_group_not_found' };
	const member = await readMembershipRecord({
		store,
		slug,
		sessionId,
		groupId,
		principalKey: normalized.key,
	});
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

export const snapshotWorkerGroupCapacity = async ({ env, slug, sessionId } = {}) => {
	const store = resolveWorkerGroupStore(env);
	if (!store) {
		return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
	}
	if (typeof store.store.list !== 'function') {
		return { ok: false, status: 503, reason: 'worker_group_capacity_seed_unavailable' };
	}
	try {
		const groups = await scanWorkerGroupRecordsForIdentity({
			store,
			slug,
			sessionId,
		});
		const { maxGroupsPerSession } = resolveWorkerGroupCaps(env);
		if (groups.length > maxGroupsPerSession) {
			throw new Error('Worker group inventory exceeds the configured reconciliation budget.');
		}
		return {
			ok: true,
			groups: groups.map((group) => ({
				groupId: normalizeWorkerGroupId(group.groupId),
			})),
		};
	} catch {
		return { ok: false, status: 503, reason: 'worker_group_capacity_seed_unavailable' };
	}
};

export const executeWorkerGroupMutation = async ({
	env,
	slug,
	sessionId,
	operation,
	input,
	groupId,
	principal,
	actorPrincipal,
	capacityAuthorized = false,
	deps = {},
} = {}) => {
	if (operation === 'create') {
		return createWorkerGroup({
			env,
			slug,
			sessionId,
			input,
			actorPrincipal,
			capacityAuthorized,
			deps,
		});
	}
	if (operation === 'update') {
		return updateWorkerGroup({ env, slug, sessionId, groupId, input, actorPrincipal, deps });
	}
	if (operation === 'delete') {
		return deleteWorkerGroup({ env, slug, sessionId, groupId, actorPrincipal, deps });
	}
	if (operation === 'add-member') {
		return addWorkerGroupMember({
			env,
			slug,
			sessionId,
			groupId,
			principal,
			actorPrincipal,
			capacityAuthorized,
			deps,
		});
	}
	if (operation === 'remove-member') {
		return removeWorkerGroupMember({
			env,
			slug,
			sessionId,
			groupId,
			principal,
			actorPrincipal,
			capacityAuthorized,
			deps,
		});
	}
	if (operation === 'join') {
		const store = resolveWorkerGroupStore(env);
		if (!store) {
			return { ok: false, status: 501, reason: 'worker_group_store_not_configured' };
		}
		const group = await readGroupRecord({ store, slug, sessionId, groupId });
		if (!group || group.deletedAt) {
			return { ok: false, status: 404, reason: 'worker_group_not_found' };
		}
		if (group.joinMode !== WORKER_GROUP_JOIN_MODES.OPEN) {
			return { ok: false, status: 403, reason: 'worker_group_join_denied' };
		}
		return addWorkerGroupMember({
			env,
			slug,
			sessionId,
			groupId: group.groupId,
			principal,
			actorPrincipal,
			capacityAuthorized,
			deps,
		});
	}
	return { ok: false, status: 400, reason: 'worker_group_mutation_invalid' };
};

const workerGroupCoordinationUnavailable = () => ({
	ok: false,
	status: 503,
	reason: 'worker_group_coordination_unavailable',
});

const callWorkerGroupCoordinator = async ({ env, slug, sessionId, path, payload = {} } = {}) => {
	const sessionSlug = canonicalWorkerGroupSessionSlug(slug);
	const canonicalSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId });
	if (!sessionSlug || !canonicalSessionId) {
		return { ok: false, status: 400, reason: 'worker_group_session_identity_invalid' };
	}
	const coordinator = env?.CE_SESSION_COORDINATOR;
	if (!coordinator?.idFromName || !coordinator?.get) {
		return workerGroupCoordinationUnavailable();
	}
	let stub;
	try {
		const coordinatorId = coordinator.idFromName(`worker-groups:${sessionSlug}:${canonicalSessionId}`);
		stub = coordinator.get(coordinatorId);
	} catch {
		return workerGroupCoordinationUnavailable();
	}
	if (!stub?.fetch) return workerGroupCoordinationUnavailable();
	try {
		const response = await stub.fetch(`https://session-coordinator.internal${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...payload, slug: sessionSlug, sessionId: canonicalSessionId }),
		});
		const result = await response.json().catch(() => null);
		if (!result || typeof result !== 'object') return workerGroupCoordinationUnavailable();
		return {
			...result,
			status: Number(result.status || 0) || response.status,
		};
	} catch {
		return workerGroupCoordinationUnavailable();
	}
};

export const checkCoordinatedWorkerGroupReady = async ({ env, slug, sessionId } = {}) =>
	callWorkerGroupCoordinator({
		env,
		slug,
		sessionId,
		path: '/worker-groups/ready',
	});

export const readCoordinatedWorkerGroupCatalog = async ({ env, slug, sessionId, groupIds, principal } = {}) =>
	callWorkerGroupCoordinator({
		env,
		slug,
		sessionId,
		path: '/worker-groups/catalog',
		payload: {
			groupIds,
			...(principal ? { principal } : {}),
		},
	});

export const isWorkerGroupMember = async ({ env, slug, sessionId, groupId, principal, requesterAddress, authScopes, deps = {} } = {}) => {
	const normalized = principal
		? normalizeWorkerGroupPrincipal(principal, deps)
		: resolveWorkerGroupPrincipal({ requesterAddress, authScopes, deps });
	const normalizedGroupId = normalizeWorkerGroupId(groupId);
	if (!normalized.ok) {
		return { ok: false, status: 400, reason: normalized.reason || 'missing_principal' };
	}
	if (!normalizedGroupId) {
		return { ok: false, status: 400, reason: 'invalid_worker_group_id' };
	}
	return callWorkerGroupCoordinator({
		env,
		slug,
		sessionId,
		path: '/worker-groups/authorize',
		payload: {
			groupId: normalizedGroupId,
			principal: normalized.principal,
		},
	});
};

export const executeCoordinatedWorkerGroupMutation = async ({
	env,
	slug,
	sessionId,
	operation,
	input,
	groupId,
	principal,
	actorPrincipal,
} = {}) => {
	return callWorkerGroupCoordinator({
		env,
		slug,
		sessionId,
		path: '/worker-groups/mutate',
		payload: {
			operation,
			input,
			groupId,
			principal,
			actorPrincipal,
		},
	});
};

const parseRouteBody = async (request) => {
	try {
		const body = await request?.json?.();
		return isObj(body) ? { ok: true, body } : { ok: false, error: 'Invalid JSON.' };
	} catch {
		return { ok: false, error: 'Invalid JSON.' };
	}
};

const routeError = (deps, result, headers) =>
	jsonResponse(
		deps,
		{ error: 'Worker group request failed.', reason: result.reason || 'worker_group_failed' },
		result.status || 403,
		headers,
	);

const resolveWorkerGroupSessionIdentity = ({ config, slug } = {}) => {
	const sessionSlug = canonicalWorkerGroupSessionSlug(slug);
	const sessionId = resolveCanonicalWorkerSessionIdHex(config);
	if (!sessionSlug || !sessionId) {
		return {
			ok: false,
			status: 503,
			reason: 'worker_group_session_identity_unavailable',
		};
	}
	return { ok: true, sessionSlug, sessionId };
};

export const dispatchAdminWorkerGroupRequest = async ({ action, body, config, env, slug, adminAddress, headers, deps } = {}) => {
	const sessionIdentity = resolveWorkerGroupSessionIdentity({ config, slug });
	if (!sessionIdentity.ok) return routeError(deps, sessionIdentity, headers);
	const requestedSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: body?.sessionId });
	if (!requestedSessionId || requestedSessionId !== sessionIdentity.sessionId) {
		return routeError(
			deps,
			{
				status: 409,
				reason: 'worker_group_session_identity_mismatch',
			},
			headers,
		);
	}
	const actor = normalizeWorkerGroupPrincipal(
		body?.actorPrincipal || { kind: 'evm_address', address: adminAddress || body?.address },
		deps,
	);
	if (!actor.ok) {
		return jsonResponse(deps, { error: 'Invalid admin principal.', reason: actor.reason }, 400, headers);
	}
	const mutate = deps?.executeCoordinatedWorkerGroupMutation || executeCoordinatedWorkerGroupMutation;
	if (action === 'groups/create') {
		const result = await mutate({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
			operation: 'create',
			input: body?.group || body,
			actorPrincipal: actor.principal,
		});
		if (!result.ok) return routeError(deps, result, headers);
		return jsonResponse(deps, { ok: true, ...sessionIdentity, store: result.store, group: result.group }, 200, headers);
	}
	if (action === 'groups/update') {
		const result = await mutate({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
			operation: 'update',
			groupId: body?.groupId || body?.group?.groupId,
			input: body?.group || body,
			actorPrincipal: actor.principal,
		});
		if (!result.ok) return routeError(deps, result, headers);
		return jsonResponse(deps, { ok: true, ...sessionIdentity, store: result.store, group: result.group }, 200, headers);
	}
	if (action === 'groups/delete') {
		const result = await mutate({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
			operation: 'delete',
			groupId: body?.groupId || body?.group?.groupId,
			actorPrincipal: actor.principal,
		});
		if (!result.ok) return routeError(deps, result, headers);
		return jsonResponse(
			deps,
			{
				ok: true,
				...sessionIdentity,
				store: result.store,
				groupId: result.groupId,
				removedMembers: result.removedMembers,
			},
			200,
			headers,
		);
	}
	if (action === 'groups/add-member') {
		const result = await mutate({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
			operation: 'add-member',
			groupId: body?.groupId,
			principal: body?.principal || body?.member,
			actorPrincipal: actor.principal,
		});
		if (!result.ok) return routeError(deps, result, headers);
		return jsonResponse(
			deps,
			{
				ok: true,
				...sessionIdentity,
				store: result.store,
				group: result.group,
				member: result.member,
			},
			200,
			headers,
		);
	}
	if (action === 'groups/remove-member') {
		const result = await mutate({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
			operation: 'remove-member',
			groupId: body?.groupId,
			principal: body?.principal || body?.member,
			actorPrincipal: actor.principal,
		});
		if (!result.ok) return routeError(deps, result, headers);
		return jsonResponse(
			deps,
			{
				ok: true,
				...sessionIdentity,
				store: result.store,
				groupId: result.groupId,
				principal: result.principal,
			},
			200,
			headers,
		);
	}
	if (action === 'groups/list') {
		const ready = await (deps?.checkCoordinatedWorkerGroupReady || checkCoordinatedWorkerGroupReady)({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
		});
		if (!ready.ok) return routeError(deps, ready, headers);
		let result;
		try {
			result = await listWorkerGroups({
				env,
				slug,
				sessionId: sessionIdentity.sessionId,
				actorPrincipalResult: actor,
				admin: true,
				expectedGroupCount: ready.meta?.groupCount,
			});
		} catch {
			result = {
				ok: false,
				status: 503,
				reason: 'worker_group_projection_unavailable',
			};
		}
		if (!result.ok) return routeError(deps, result, headers);
		return jsonResponse(deps, { ok: true, ...sessionIdentity, store: result.store, groups: result.groups }, 200, headers);
	}
	if (action === 'groups/list-members') {
		const ready = await (deps?.checkCoordinatedWorkerGroupReady || checkCoordinatedWorkerGroupReady)({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
		});
		if (!ready.ok) return routeError(deps, ready, headers);
		let result;
		try {
			result = await listWorkerGroupMembers({
				env,
				slug,
				sessionId: sessionIdentity.sessionId,
				groupId: body?.groupId,
				cursor: body?.cursor,
				limit: body?.limit,
			});
		} catch {
			result = {
				ok: false,
				status: 503,
				reason: 'worker_group_projection_unavailable',
			};
		}
		if (!result.ok) return routeError(deps, result, headers);
		return jsonResponse(
			deps,
			{
				ok: true,
				...sessionIdentity,
				store: result.store,
				group: result.group,
				members: result.members,
				nextCursor: result.nextCursor,
			},
			200,
			headers,
		);
	}
	return null;
};

export const workerGroupsRoute = async ({
	path,
	method,
	request,
	config,
	env,
	slug,
	requesterAddress,
	authScopes,
	baseHeaders,
	deps,
} = {}) => {
	const sessionIdentity = resolveWorkerGroupSessionIdentity({ config, slug });
	if (!sessionIdentity.ok) return routeError(deps, sessionIdentity, baseHeaders);
	let routeBody = null;
	let requestedSessionId = '';
	if (method === 'POST') {
		const parsed = await parseRouteBody(request);
		if (!parsed.ok) return jsonResponse(deps, { error: parsed.error }, 400, baseHeaders);
		routeBody = parsed.body;
		requestedSessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: routeBody.sessionId });
	} else if (method === 'GET') {
		try {
			requestedSessionId = resolveCanonicalWorkerSessionIdHex({
				sessionId: new URL(request?.url || '').searchParams.get('sessionId'),
			});
		} catch {
			requestedSessionId = '';
		}
	}
	if (requestedSessionId !== sessionIdentity.sessionId) {
		return routeError(
			deps,
			{
				status: 409,
				reason: 'worker_group_session_identity_mismatch',
			},
			baseHeaders,
		);
	}
	const actor = resolveWorkerGroupPrincipal({ requesterAddress, authScopes, deps });
	if (!actor.ok) {
		return jsonResponse(deps, { error: 'Missing worker group principal.', reason: actor.reason }, 401, baseHeaders);
	}
	if (path === '/groups/my-memberships' && (method === 'GET' || method === 'POST')) {
		const ready = await (deps?.checkCoordinatedWorkerGroupReady || checkCoordinatedWorkerGroupReady)({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
		});
		if (!ready.ok) return routeError(deps, ready, baseHeaders);
		let result;
		try {
			result = await listWorkerGroupMemberships({
				env,
				slug,
				sessionId: sessionIdentity.sessionId,
				principal: actor.principal,
				deps,
			});
		} catch {
			result = {
				ok: false,
				status: 503,
				reason: 'worker_group_projection_unavailable',
			};
		}
		if (!result.ok) return routeError(deps, result, baseHeaders);
		return jsonResponse(
			deps,
			{
				ok: true,
				...sessionIdentity,
				store: result.store,
				principal: result.principal,
				memberships: result.memberships,
			},
			200,
			baseHeaders,
		);
	}
	if (path === '/groups/list' && (method === 'GET' || method === 'POST')) {
		const ready = await (deps?.checkCoordinatedWorkerGroupReady || checkCoordinatedWorkerGroupReady)({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
		});
		if (!ready.ok) return routeError(deps, ready, baseHeaders);
		let result;
		try {
			result = await listWorkerGroups({
				env,
				slug,
				sessionId: sessionIdentity.sessionId,
				actorPrincipalResult: actor,
				admin: false,
				expectedGroupCount: ready.meta?.groupCount,
			});
		} catch {
			result = {
				ok: false,
				status: 503,
				reason: 'worker_group_projection_unavailable',
			};
		}
		if (!result.ok) return routeError(deps, result, baseHeaders);
		return jsonResponse(deps, { ok: true, ...sessionIdentity, store: result.store, groups: result.groups }, 200, baseHeaders);
	}
	if (path === '/groups/join' && method === 'POST') {
		const mutate = deps?.executeCoordinatedWorkerGroupMutation || executeCoordinatedWorkerGroupMutation;
		const result = await mutate({
			env,
			slug,
			sessionId: sessionIdentity.sessionId,
			operation: 'join',
			groupId: routeBody.groupId,
			principal: actor.principal,
			actorPrincipal: actor.principal,
		});
		if (!result.ok) return routeError(deps, result, baseHeaders);
		return jsonResponse(
			deps,
			{
				ok: true,
				...sessionIdentity,
				store: result.store,
				group: result.group,
				member: result.member,
			},
			200,
			baseHeaders,
		);
	}
	return jsonResponse(deps, { error: 'Not found.' }, 404, baseHeaders);
};
