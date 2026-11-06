// Reads a group's KV projections directly, without the coordinator that owns
// authorization, so tests can observe what a mutation left in the store.
import {
	__test__workerGroups,
	normalizeWorkerGroupId,
	normalizeWorkerGroupPrincipal,
	resolveWorkerGroupCaps,
	resolveWorkerGroupPrincipal,
} from './workerGroups.js';

const {
	readGroupRecord,
	readMembershipRecord,
	redactGroupForMember,
	resolveWorkerGroupStore,
	scanWorkerGroupRecordsForIdentity,
} = __test__workerGroups;

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
