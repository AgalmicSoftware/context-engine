import { SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
	listSelfJoinableWorkerGroupsForMember,
	listSelfJoinableWorkerGroupsForVisitor,
	addWorkerGroupMember as addWorkerGroupMemberBoundary,
	createWorkerGroup as createWorkerGroupBoundary,
	deleteWorkerGroup as deleteWorkerGroupBoundary,
	dispatchAdminWorkerGroupRequest as dispatchAdminWorkerGroupRequestBoundary,
	dispatchPublicWorkerGroupListRequest,
	forwardWorkerGroupMutation as executeCoordinatedWorkerGroupMutationBoundary,
	executeWorkerGroupMutation as executeWorkerGroupMutationBoundary,
	isWorkerGroupMember,
	listWorkerGroupMembers as listWorkerGroupMembersBoundary,
	listWorkerGroupMembersForPrincipal as listWorkerGroupMembersForPrincipalBoundary,
	listWorkerGroupMemberships as listWorkerGroupMembershipsBoundary,
	normalizeWorkerGroupId,
	normalizeWorkerGroupPrincipal,
	removeWorkerGroupMember as removeWorkerGroupMemberBoundary,
	resolveWorkerGroupBootstrap,
	resolveWorkerGroupsKv,
	resolveWorkerGroupPrincipal,
	updateWorkerGroup as updateWorkerGroupBoundary,
	workerGroupsRoute as workerGroupsRouteBoundary,
} from './workerGroups.js';
import {
	readWorkerGroupMembershipProjection as readWorkerGroupMembershipProjectionBoundary,
	snapshotWorkerGroupCapacity as snapshotWorkerGroupCapacityBoundary,
} from './workerGroupProjectionFixture.mjs';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';

const json = (body, status = 200, headers = {}) => ({ body, status, headers });
const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const replacementSessionId = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const workerCanonicalConfig = { sessionId };
const publicWorkerModeProfile = {
	profileVersion: 1,
	preset: 'custom',
	authority: { mode: 'worker_canonical' },
	evm: { registryChainId: null },
	storage: {
		backend: 'cloudflare',
		payloadAccessControl: { gate: 'none', encryption: 'none' },
	},
	identity: { default: 'passkey', enabled: ['passkey'] },
	authorization: { mechanisms: ['worker_roles'] },
	encryption: { mode: 'none' },
	surfaces: {
		web: true,
		telegram: false,
		miniApp: false,
		agentHttp: false,
		mcp: false,
		ceCc: false,
	},
	results: {
		visibility: 'public_full_if_storage_public',
		exposure: {
			aggregateResultsEnabled: true,
			anonymizedGroupsEnabled: false,
			minGroupSize: 2,
		},
	},
	export: { scope: 'all_session' },
};
const publicWorkerGroupConfig = (groupCreationPolicy = 'admin_only') => ({
	sessionId,
	groupCreationPolicy,
	sessionModeProfile: JSON.parse(JSON.stringify(publicWorkerModeProfile)),
	storageProfile: {
		backend: 'cloudflare',
		payloadAccessControl: { gate: 'none', encryption: 'none' },
	},
});
const privateWorkerGroupConfig = () => {
	const config = publicWorkerGroupConfig('participants');
	config.sessionModeProfile.results.visibility = 'session_member_aggregate';
	return config;
};
const addWorkerGroupMember = (args = {}) => addWorkerGroupMemberBoundary({ sessionId, ...args });
const createWorkerGroup = (args = {}) => createWorkerGroupBoundary({ sessionId, ...args });
const deleteWorkerGroup = (args = {}) => deleteWorkerGroupBoundary({ sessionId, ...args });
const listWorkerGroupMembers = (args = {}) => listWorkerGroupMembersBoundary({ sessionId, ...args });
const listWorkerGroupMembersForPrincipal = (args = {}) =>
	listWorkerGroupMembersForPrincipalBoundary({ sessionId, ...args });
const listWorkerGroupMemberships = (args = {}) => listWorkerGroupMembershipsBoundary({ sessionId, ...args });
const readWorkerGroupMembershipProjection = (args = {}) => readWorkerGroupMembershipProjectionBoundary({ sessionId, ...args });
const removeWorkerGroupMember = (args = {}) => removeWorkerGroupMemberBoundary({ sessionId, ...args });
const snapshotWorkerGroupCapacity = (args = {}) => snapshotWorkerGroupCapacityBoundary({ sessionId, ...args });
const updateWorkerGroup = (args = {}) => updateWorkerGroupBoundary({ sessionId, ...args });
const executeCoordinatedWorkerGroupMutation = (args = {}) => executeCoordinatedWorkerGroupMutationBoundary({ sessionId, ...args });
const executeWorkerGroupMutation = (args = {}) => executeWorkerGroupMutationBoundary({ sessionId, ...args });
const requestWithSessionId = async (request, requestedSessionId = sessionId) => {
	if (!(request instanceof Request)) return request;
	const url = new URL(request.url);
	if (request.method === 'GET' || request.method === 'HEAD') {
		url.searchParams.set('sessionId', requestedSessionId);
		return new Request(url, request);
	}
	const body = await request.clone().json();
	return new Request(url, {
		method: request.method,
		headers: request.headers,
		body: JSON.stringify({ sessionId: requestedSessionId, ...body }),
	});
};
const workerGroupsRoute = async (args = {}) => {
	const { injectSessionId = true, requestedSessionId = sessionId, ...routeArgs } = args;
	return workerGroupsRouteBoundary({
		...routeArgs,
		deps: { executeCoordinatedWorkerGroupMutation, ...routeArgs.deps },
		request: injectSessionId ? await requestWithSessionId(routeArgs.request, requestedSessionId) : routeArgs.request,
		config: routeArgs.config ?? workerCanonicalConfig,
	});
};
const dispatchAdminWorkerGroupRequest = (args = {}) =>
	dispatchAdminWorkerGroupRequestBoundary({
		...args,
		deps: { executeCoordinatedWorkerGroupMutation, ...args.deps },
		config: args.config ?? workerCanonicalConfig,
		body: {
			sessionId,
			...(args.body || {}),
		},
	});

test('admin empty-state reconciliation preserves exact session identity and returns no capacity internals', async () => {
	let reconciliationArgs = null;
	const result = await dispatchAdminWorkerGroupRequest({
		action: 'groups/reconcile-empty',
		env: {},
		slug: 'session-a',
		adminAddress: '0x0000000000000000000000000000000000000abc',
		headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
		deps: {
			json,
			reconcileCoordinatedWorkerGroupCapacity: async (args) => {
				reconciliationArgs = args;
				return {
					ok: true,
					repaired: true,
					meta: {
						groupCount: 0,
						bootstrapId: 'must-not-leak',
						phase: 'ready',
					},
				};
			},
		},
	});

	assert.deepEqual(reconciliationArgs, {
		env: {},
		slug: 'session-a',
		sessionId,
	});
	assert.deepEqual(result, {
		body: {
			ok: true,
			sessionSlug: 'session-a',
			sessionId,
			store: 'durable_object',
			repaired: true,
			groupCount: 0,
		},
		status: 200,
		headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
	});
	assert.doesNotMatch(JSON.stringify(result), /must-not-leak|bootstrapId/);
});

test('public Worker Group discovery follows the public ungated mode independently of creation policy', async () => {
	const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
	let listCalls = 0;
	const deps = {
		json,
		checkCoordinatedWorkerGroupReady: async () => ({
			ok: true,
			meta: { groupCount: 1 },
		}),
		listWorkerGroups: async (value) => {
			listCalls += 1;
			assert.equal(value.sessionId, sessionId);
			assert.equal(value.slug, 'session-a');
			assert.equal(value.admin, false);
			assert.equal(value.actorPrincipalResult, undefined);
			assert.equal(value.includeMemberCount, false);
			assert.equal(value.expectedGroupCount, 1);
			return {
				ok: true,
				store: 'kv',
				groups: [
					{
						groupId: 'open-reviewers',
						sessionSlug: 'session-a',
						label: 'Open reviewers',
						joinMode: 'open',
						memberVisibility: 'session',
					},
				],
			};
		},
	};

	const openResult = await dispatchPublicWorkerGroupListRequest({
		request: new Request(`https://worker.example/groups/list?sessionId=${sessionId}`),
		config: publicWorkerGroupConfig('admin_only'),
		env: {},
		slug: 'session-a',
		baseHeaders: headers,
		deps,
	});
	assert.equal(openResult.status, 200);
	assert.equal(openResult.body.sessionId, sessionId);
	assert.equal(openResult.body.sessionSlug, 'session-a');
	assert.equal(openResult.body.groups[0].groupId, 'open-reviewers');
	assert.equal(listCalls, 1);

	const participantPolicyResult = await dispatchPublicWorkerGroupListRequest({
		request: new Request(`https://worker.example/groups/list?sessionId=${sessionId}`),
		config: publicWorkerGroupConfig('participants'),
		env: {},
		slug: 'session-a',
		baseHeaders: headers,
		deps,
	});
	assert.equal(participantPolicyResult.status, 200);

	for (const config of [privateWorkerGroupConfig(), { sessionId, groupCreationPolicy: 'participants' }]) {
		const denied = await dispatchPublicWorkerGroupListRequest({
			request: new Request(`https://worker.example/groups/list?sessionId=${sessionId}`),
			config,
			env: {},
			slug: 'session-a',
			baseHeaders: headers,
			deps,
		});
		assert.equal(denied.status, 403);
		assert.equal(denied.body.reason, 'worker_group_discovery_not_public');
	}

	const mismatched = await dispatchPublicWorkerGroupListRequest({
		request: new Request(`https://worker.example/groups/list?sessionId=${replacementSessionId}`),
		config: publicWorkerGroupConfig('participants'),
		env: {},
		slug: 'session-a',
		baseHeaders: headers,
		deps,
	});
	assert.equal(mismatched.status, 409);
	assert.equal(mismatched.body.reason, 'worker_group_session_identity_mismatch');
	assert.equal(listCalls, 2);
});

test('a join link shows a private session only what members of its group see', async () => {
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: createMockKv() });
	const create = (groupId, input) =>
		executeCoordinatedWorkerGroupMutation({
			env,
			slug: 'session-a',
			operation: 'create',
			input: { groupId, label: `Label ${groupId}`, ...input },
			actorPrincipal: actor,
		});
	await create('salon', { joinMode: 'open', memberVisibility: 'session' });
	await create('staff', { joinMode: 'admin_add', memberVisibility: 'session' });
	await create('closing', {
		joinMode: 'open',
		memberVisibility: 'session',
		joinEndsAt: new Date(Date.now() + 60_000).toISOString(),
	});
	await create('circle', { joinMode: 'open', memberVisibility: 'members' });
	await create('admins', { joinMode: 'open', memberVisibility: 'admin_only' });
	// Listed after the closing group's deadline.
	const now = () => Date.now() + 120_000;
	const list = (query) =>
		dispatchPublicWorkerGroupListRequest({
			request: new Request(`https://worker.example/groups/list?sessionId=${sessionId}${query}`),
			config: privateWorkerGroupConfig(),
			env,
			slug: 'session-a',
			baseHeaders: {},
			deps: { json, now },
		});

	const joined = await workerGroupsRoute({
		path: '/groups/join',
		method: 'POST',
		request: new Request('https://worker.example/groups/join', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ groupId: 'salon' }),
		}),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	assert.equal(joined.status, 200);
	const memberView = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	const ids = (response) => response.body.groups.map((group) => group.groupId).sort();

	for (const query of ['&joinGroup=salon', '&joinGroup=%20SALON%20']) {
		const invited = await list(query);
		assert.equal(invited.status, 200);
		assert.deepEqual(ids(invited), ['closing', 'salon', 'staff']);
		assert.deepEqual(ids(invited), ids(memberView));
		assert.equal(invited.body.sessionId, sessionId);
		// Never counts, and never who runs a group, which for a participant's group is a participant.
		assert.ok(invited.body.groups.every((group) => !('memberCount' in group) && !('adminAddress' in group)));
	}
	assert.ok(memberView.body.groups.some((group) => group.adminAddress === actor.address.toLowerCase() || group.adminAddress === actor.address));
	// Only a link to a group someone could join on their own, still open, counts.
	for (const query of [
		'',
		'&joinGroup=staff',
		'&joinGroup=closing',
		'&joinGroup=circle',
		'&joinGroup=admins',
		'&joinGroup=missing',
		'&joinGroup=salon&joinGroup=staff',
		'&joinGroup=sal%2Fon',
	]) {
		const denied = await list(query);
		assert.equal(denied.status, 403, query);
		assert.equal(denied.body.reason, 'worker_group_discovery_not_public');
		assert.equal('groups' in denied.body, false);
	}
	const mismatched = await dispatchPublicWorkerGroupListRequest({
		request: new Request(`https://worker.example/groups/list?sessionId=${replacementSessionId}&joinGroup=salon`),
		config: privateWorkerGroupConfig(),
		env,
		slug: 'session-a',
		baseHeaders: {},
		deps: { json, now },
	});
	assert.equal(mismatched.status, 409);
	// A public session lists the same groups with or without a link.
	const publicList = await dispatchPublicWorkerGroupListRequest({
		request: new Request(`https://worker.example/groups/list?sessionId=${sessionId}&joinGroup=missing`),
		config: publicWorkerGroupConfig(),
		env,
		slug: 'session-a',
		baseHeaders: {},
		deps: { json, now },
	});
	assert.equal(publicList.status, 200);
	assert.deepEqual(ids(publicList), ['closing', 'salon', 'staff']);
});

test('only groups someone could join on their own count, for a link or for an AI to suggest', async () => {
	const nowMs = Date.parse('2026-02-03T04:05:06.000Z');
	const listed = [
		{ groupId: 'salon', label: 'Salon', joinMode: 'open', memberVisibility: 'session' },
		{ groupId: 'staff', label: 'Staff', joinMode: 'admin_add', memberVisibility: 'session' },
		{ groupId: 'circle', label: 'Circle', joinMode: 'open', memberVisibility: 'members' },
		{ groupId: 'closed', label: 'Closed', joinMode: 'open', memberVisibility: 'session', joinEndsAt: '2026-02-01T00:00:00.000Z' },
		{ groupId: 'open-later', label: 'Open later', joinMode: 'open', memberVisibility: 'session', joinEndsAt: '2026-03-01T00:00:00.000Z' },
	];
	// Even a list that held more than members see could not widen what counts.
	const deps = {
		now: () => nowMs,
		checkCoordinatedWorkerGroupReady: async () => ({ ok: true, meta: { groupCount: listed.length } }),
		listWorkerGroups: async () => ({ ok: true, store: 'kv', groups: listed }),
	};
	const joinable = await listSelfJoinableWorkerGroupsForVisitor({ env: {}, config: publicWorkerGroupConfig(), slug: 'session-a', deps });
	assert.deepEqual(joinable.map((group) => group.groupId), ['salon', 'open-later']);
	for (const inviteGroupId of ['circle', 'staff', 'closed']) {
		assert.deepEqual(
			await listSelfJoinableWorkerGroupsForVisitor({ env: {}, config: privateWorkerGroupConfig(), slug: 'session-a', inviteGroupId, deps }),
			[],
			inviteGroupId,
		);
	}
	assert.equal(
		(await listSelfJoinableWorkerGroupsForVisitor({ env: {}, config: privateWorkerGroupConfig(), slug: 'session-a', inviteGroupId: 'salon', deps })).length,
		2,
	);
	// A failing list shows nothing rather than an error.
	assert.deepEqual(
		await listSelfJoinableWorkerGroupsForVisitor({
			env: {},
			config: publicWorkerGroupConfig(),
			slug: 'session-a',
			deps: { ...deps, listWorkerGroups: async () => { throw new Error('down'); } },
		}),
		[],
	);
});

test('a signed-in person’s AI is offered only open groups they have not joined and that have room', async () => {
	const nowMs = Date.parse('2026-02-03T04:05:06.000Z');
	const address = `0x${'ab'.repeat(20)}`;
	const open = { joinMode: 'open', memberVisibility: 'session', memberCount: 1 };
	const listed = [
		{ ...open, groupId: 'salon', label: 'Salon' },
		{ ...open, groupId: 'joined', label: 'Joined' },
		{ ...open, groupId: 'full', label: 'Full', memberLimit: 2, memberCount: 2 },
		{ ...open, groupId: 'room', label: 'Room', memberLimit: 3, memberCount: 2 },
		{ ...open, groupId: 'staff', label: 'Staff', joinMode: 'admin_add' },
		{ ...open, groupId: 'closed', label: 'Closed', joinEndsAt: '2026-02-01T00:00:00.000Z' },
	];
	const listings = [];
	const deps = {
		now: () => nowMs,
		checkCoordinatedWorkerGroupReady: async () => ({ ok: true, meta: { groupCount: listed.length } }),
		listWorkerGroups: async (args) => {
			listings.push(args);
			return { ok: true, store: 'kv', groups: listed };
		},
		listWorkerGroupMemberships: async () => ({ ok: true, memberships: [{ group: { groupId: 'joined' } }] }),
	};
	const offer = (overrides = {}) => listSelfJoinableWorkerGroupsForMember({
		env: {}, config: privateWorkerGroupConfig(), slug: 'session-a', address, deps, ...overrides,
	});
	assert.deepEqual((await offer()).map((group) => group.groupId), ['salon', 'room']);
	// Listed as that person sees groups, never as an admin.
	assert.equal(listings[0].admin, false);
	assert.equal(listings[0].includeMemberCount, true);
	assert.equal(listings[0].actorPrincipalResult.principal.address, address);
	// No person, or a list that fails, offers nothing rather than an error.
	assert.deepEqual(await offer({ address: '' }), []);
	assert.deepEqual(await offer({ deps: { ...deps, listWorkerGroupMemberships: async () => ({ ok: false }) } }), []);
	assert.deepEqual(await offer({ deps: { ...deps, listWorkerGroups: async () => { throw new Error('down'); } } }), []);
});

const createMockKv = () => {
	const store = new Map();
	return {
		store,
		async put(key, value) {
			store.set(key, value);
		},
		async get(key) {
			return store.get(key) || null;
		},
		async delete(key) {
			store.delete(key);
		},
		async list({ prefix = '', cursor = '', limit = 1000 } = {}) {
			const keys = [...store.keys()].filter((name) => name.startsWith(prefix)).sort();
			const offset = cursor ? Number(cursor) : 0;
			const pageKeys = keys.slice(offset, offset + limit);
			const nextOffset = offset + pageKeys.length;
			return {
				keys: pageKeys.map((name) => ({ name })),
				list_complete: nextOffset >= keys.length,
				...(nextOffset < keys.length ? { cursor: String(nextOffset) } : {}),
			};
		},
	};
};

const installCoordinatorBinding = (env) => {
	env.CE_WORKER_GROUPS_BOOTSTRAP ||= 'fresh-template-v2';
	const instances = new Map();
	env.CE_SESSION_COORDINATOR = {
		idFromName: (name) => `coordinator:${name}`,
		get: (id) => {
			if (!instances.has(id)) {
				const values = new Map();
				let tail = Promise.resolve();
				const transaction = (callback) => {
					const run = tail.then(async () => {
						const staged = new Map([...values].map(([key, value]) => [key, structuredClone(value)]));
						const result = await callback({
							get: async (key) => staged.get(key),
							put: async (key, value) => staged.set(key, structuredClone(value)),
							delete: async (key) => staged.delete(key),
						});
						values.clear();
						for (const [key, value] of staged) values.set(key, value);
						return result;
					});
					tail = run.catch(() => undefined);
					return run;
				};
				const coordinator = new SessionWriteCoordinator(
					{
						storage: {
							get: async (key) => values.get(key),
							put: async (key, value) => values.set(key, structuredClone(value)),
							delete: async (key) => values.delete(key),
							list: async ({ prefix = '' } = {}) =>
								new Map([...values].filter(([key]) => key.startsWith(prefix))),
							transaction,
						},
					},
					env,
				);
				instances.set(id, {
					fetch: (input, init) => coordinator.fetch(input instanceof Request ? input : new Request(input, init)),
				});
			}
			return instances.get(id);
		},
	};
	return env;
};

const actor = { kind: 'evm_address', address: '0x0000000000000000000000000000000000000abc' };
const member = { kind: 'evm_address', address: '0x0000000000000000000000000000000000000def' };

test('worker groups use the stock deploy package GROUP_KV binding', () => {
	const stockKv = createMockKv();
	const explicitGroupsKv = createMockKv();

	assert.equal(resolveWorkerGroupsKv({ GROUP_KV: stockKv }), stockKv);
	assert.equal(
		resolveWorkerGroupsKv({
			GROUP_KV: stockKv,
			CE_WORKER_GROUPS_KV: explicitGroupsKv,
		}),
		explicitGroupsKv,
	);
});

test('Worker Group bootstrap accepts only the exact fresh sentinel or a deployment digest', async () => {
	const explicit = await resolveWorkerGroupBootstrap({
		env: { CE_WORKER_GROUPS_BOOTSTRAP: 'fresh-template-v2' },
		slug: 'session-a',
		sessionId,
	});
	assert.deepEqual(explicit, {
		ok: true,
		bootstrapId: 'fresh-template-v2',
	});
	assert.deepEqual(
		await resolveWorkerGroupBootstrap({
			env: { CE_WORKER_GROUPS_BOOTSTRAP: 'fresh-template-v2' },
			slug: 'session-a',
			sessionId,
			requireExhaustiveEmptyScan: true,
		}),
		{
			ok: false,
			status: 503,
			reason: 'worker_group_capacity_state_unavailable',
		},
	);

	for (const marker of ['fresh-v2', 'false', 'legacy', '0']) {
		const rejected = await resolveWorkerGroupBootstrap({
			env: { CE_WORKER_GROUPS_BOOTSTRAP: marker },
			slug: 'session-a',
			sessionId,
		});
		assert.equal(rejected.ok, false, marker);
		assert.equal(rejected.status, 503, marker);
		assert.equal(rejected.reason, 'worker_group_capacity_reconciliation_required', marker);
	}

	const kv = createMockKv();
	const configKey = 'session:session-a:config';
	await kv.put(
		configKey,
		JSON.stringify({
			slug: 'session-a',
			sessionId,
			workerGroupsBootstrap: {
				version: 2,
				state: 'fresh_empty',
				bootstrapId: 'a'.repeat(64),
			},
		}),
	);
	const configBacked = await resolveWorkerGroupBootstrap({
		env: { CE_WORKER_GROUPS_KV: kv },
		slug: 'session-a',
		sessionId,
	});
	assert.deepEqual(configBacked, {
		ok: true,
		bootstrapId: 'a'.repeat(64),
	});

	for (const bootstrapId of ['a'.repeat(63), 'A'.repeat(64), `${'a'.repeat(63)}g`]) {
		await kv.put(
			configKey,
			JSON.stringify({
				slug: 'session-a',
				sessionId,
				workerGroupsBootstrap: {
					version: 2,
					state: 'fresh_empty',
					bootstrapId,
				},
			}),
		);
		const rejected = await resolveWorkerGroupBootstrap({
			env: { CE_WORKER_GROUPS_KV: kv },
			slug: 'session-a',
			sessionId,
		});
		assert.equal(rejected.ok, false, bootstrapId);
		assert.equal(rejected.reason, 'worker_group_capacity_reconciliation_required', bootstrapId);
	}
});

test('Worker Group ids reject the delimiter used by membership prefixes', async () => {
	assert.equal(normalizeWorkerGroupId('parent:child'), '');
	const result = await createWorkerGroup({
		env: { CE_WORKER_GROUPS_KV: createMockKv() },
		slug: 'session-a',
		input: {
			groupId: 'parent:child',
			label: 'Overlapping prefix',
			joinMode: 'admin_add',
		},
		actorPrincipal: actor,
	});
	assert.equal(result.ok, false);
	assert.equal(result.reason, 'invalid_worker_group_id');
});

test('case-sensitive integration principals retain distinct membership keys', () => {
	const upperAgent = normalizeWorkerGroupPrincipal({ kind: 'agent', grantId: 'Grant-A' });
	const lowerAgent = normalizeWorkerGroupPrincipal({ kind: 'agent', grantId: 'grant-a' });
	const upperTelegram = normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: 'Room-A' });
	const lowerTelegram = normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: 'room-a' });

	assert.equal(upperAgent.ok, true);
	assert.equal(lowerAgent.ok, true);
	assert.notEqual(upperAgent.key, lowerAgent.key);
	assert.equal(upperAgent.key, 'agent:Grant-A');
	assert.notEqual(upperTelegram.key, lowerTelegram.key);
	assert.equal(upperTelegram.key, 'telegram:Room-A');
});

test('externally coordinated Worker Group mutations fail closed without the coordinator binding', async () => {
	const kv = createMockKv();
	const result = await executeCoordinatedWorkerGroupMutation({
		env: { CE_WORKER_GROUPS_KV: kv },
		slug: 'session-a',
		operation: 'create',
		input: {
			groupId: 'must-not-write',
			label: 'Must not write',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});

	assert.equal(result.ok, false);
	assert.equal(result.status, 503);
	assert.equal(result.reason, 'worker_group_coordination_unavailable');
	assert.equal(kv.store.size, 0);

	const broken = await executeCoordinatedWorkerGroupMutation({
		env: {
			CE_WORKER_GROUPS_KV: kv,
			CE_SESSION_COORDINATOR: {
				idFromName: (name) => name,
				get: () => ({
					fetch: async () => {
						throw new Error('coordinator unavailable');
					},
				}),
			},
		},
		slug: 'session-a',
		operation: 'create',
		input: {
			groupId: 'must-still-not-write',
			label: 'Must still not write',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	assert.equal(broken.status, 503);
	assert.equal(broken.reason, 'worker_group_coordination_unavailable');
	assert.equal(kv.store.size, 0);
});

test('Worker Groups prefer an independently migrated coordinator binding when configured', async () => {
	const kv = createMockKv();
	let groupCoordinatorCalls = 0;
	let sessionCoordinatorCalls = 0;
	const result = await executeCoordinatedWorkerGroupMutation({
		env: {
			CE_WORKER_GROUPS_KV: kv,
			CE_WORKER_GROUP_COORDINATOR: {
				idFromName: (name) => {
					groupCoordinatorCalls += 1;
					return `groups:${name}`;
				},
				get: () => ({
					fetch: async () =>
						new Response(JSON.stringify({ ok: false, status: 409, reason: 'preferred_group_coordinator' }), {
							status: 409,
							headers: { 'Content-Type': 'application/json' },
						}),
				}),
			},
			CE_SESSION_COORDINATOR: {
				idFromName: (name) => {
					sessionCoordinatorCalls += 1;
					return `session:${name}`;
				},
				get: () => ({
					fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
				}),
			},
		},
		slug: 'session-a',
		sessionId: '0x11111111111111111111111111111111',
		operation: 'create',
		input: {
			groupId: 'preferred-binding',
			label: 'Preferred binding',
			joinMode: 'open',
			memberVisibility: 'session',
		},
		actorPrincipal: actor,
	});

	assert.equal(result.ok, false);
	assert.equal(result.status, 409);
	assert.equal(result.reason, 'preferred_group_coordinator');
	assert.equal(groupCoordinatorCalls, 1);
	assert.equal(sessionCoordinatorCalls, 0);
	assert.equal(kv.store.size, 0);
});

test('worker group CRUD stores memberships separately and enforces caps', async () => {
	const kv = createMockKv();
	const env = {
		CE_WORKER_GROUPS_KV: kv,
		CE_WORKER_GROUP_MAX_GROUPS_PER_SESSION: '1',
		CE_WORKER_GROUP_MAX_MEMBERS_PER_GROUP: '1',
	};
	const deps = {
		now: () => Date.parse('2026-02-03T04:05:06.000Z'),
		randomUUID: () => 'group-alpha',
	};
	const created = await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			label: 'Review cohort',
			description: 'Internal review access',
			imageUrl: 'https://ar-io.dev/example-group-image',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
		deps,
	});
	assert.equal(created.ok, true);
	assert.equal(created.group.groupId, 'group-alpha');
	assert.equal(created.group.imageUrl, 'https://ar-io.dev/example-group-image');

	const duplicate = await createWorkerGroup({
		env,
		slug: 'session-a',
		input: { groupId: 'group-beta', label: 'Overflow', joinMode: 'admin_add' },
		actorPrincipal: actor,
		deps: { ...deps, randomUUID: () => 'group-beta' },
	});
	assert.equal(duplicate.ok, false);
	assert.equal(duplicate.reason, 'worker_group_session_cap_exceeded');

	const added = await addWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'group-alpha',
		principal: member,
		actorPrincipal: actor,
		deps,
	});
	assert.equal(added.ok, true);
	assert.equal(added.member.principalKey, 'evm_address:0x0000000000000000000000000000000000000def');
	assert.equal(
		[...kv.store.keys()].some((key) => key.startsWith('ce-worker-group-member:session-a:') && key.includes(':group-alpha:')),
		true,
	);

	const overflow = await addWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'group-alpha',
		principal: { kind: 'telegram', principalId: 'telegram:test-user-2' },
		actorPrincipal: actor,
		deps,
	});
	assert.equal(overflow.ok, false);
	assert.equal(overflow.reason, 'worker_group_member_cap_exceeded');

	const membership = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'group-alpha',
		principal: member,
	});
	assert.equal(membership.ok, true);

	const denied = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'group-alpha',
		principal: { kind: 'evm_address', address: '0x0000000000000000000000000000000000000bad' },
	});
	assert.equal(denied.ok, false);
	assert.equal(denied.reason, 'worker_group_membership_denied');
});

test('worker group metadata is validated, persisted, projected, and enforces its own member limit', async () => {
	const kv = createMockKv();
	const env = {
		CE_WORKER_GROUPS_KV: kv,
		CE_WORKER_GROUP_MAX_MEMBERS_PER_GROUP: '5',
	};
	const deps = {
		now: () => Date.parse('2026-02-03T04:05:06.000Z'),
	};
	const created = await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			groupId: 'metadata-group',
			label: 'Metadata group',
			tags: ['Research', 'research', 'reviewers'],
			documentURLs: ['https://docs.example.test/brief'],
			memberLimit: 1,
			joinEndsAt: '2026-03-03T04:05:06.000Z',
			adminAddress: actor.address,
			joinMode: 'open',
			memberVisibility: 'session',
		},
		actorPrincipal: actor,
		deps,
	});
	assert.equal(created.ok, true);
	assert.deepEqual(created.group.tags, ['Research', 'reviewers']);
	assert.deepEqual(created.group.documentURLs, ['https://docs.example.test/brief']);
	assert.equal(created.group.memberLimit, 1);
	assert.equal(created.group.joinEndsAt, '2026-03-03T04:05:06.000Z');
	assert.equal(created.group.adminAddress, actor.address.toLowerCase());

	const first = await addWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'metadata-group',
		principal: member,
		actorPrincipal: actor,
		deps,
	});
	assert.equal(first.ok, true);
	const overflow = await addWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'metadata-group',
		principal: { kind: 'telegram', principalId: 'telegram:overflow' },
		actorPrincipal: actor,
		deps,
	});
	assert.equal(overflow.ok, false);
	assert.equal(overflow.reason, 'worker_group_member_cap_exceeded');

	const unsafeUrl = await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			groupId: 'unsafe-url',
			label: 'Unsafe URL',
			documentURLs: ['javascript:alert(1)'],
			joinMode: 'open',
		},
		actorPrincipal: actor,
		deps,
	});
	assert.equal(unsafeUrl.ok, false);
	assert.equal(unsafeUrl.reason, 'invalid_group_document_urls');
});

test('direct open join rejects an expired group deadline', async () => {
	const env = { CE_WORKER_GROUPS_KV: createMockKv() };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			groupId: 'deadline-group',
			label: 'Deadline group',
			joinMode: 'open',
			memberVisibility: 'session',
			joinEndsAt: '2026-02-04T04:05:06.000Z',
		},
		actorPrincipal: actor,
		deps: { now: () => Date.parse('2026-02-03T04:05:06.000Z') },
	});
	const joined = await executeWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'join',
		groupId: 'deadline-group',
		principal: member,
		actorPrincipal: member,
		deps: { now: () => Date.parse('2026-02-05T04:05:06.000Z') },
	});
	assert.equal(joined.ok, false);
	assert.equal(joined.reason, 'worker_group_join_ended');
});

test('worker group membership keys cannot collide across distinct principal ids', async () => {
	const kv = createMockKv();
	const env = { CE_WORKER_GROUPS_KV: kv };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			groupId: 'collision-check',
			label: 'Collision check',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	await addWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'collision-check',
		principal: { kind: 'telegram', principalId: 'user/a' },
		actorPrincipal: actor,
	});

	const allowed = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'collision-check',
		principal: { kind: 'telegram', principalId: 'user/a' },
	});
	const colliding = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'collision-check',
		principal: { kind: 'telegram', principalId: 'user=a' },
	});

	assert.equal(allowed.ok, true);
	assert.equal(colliding.ok, false);
	assert.equal(colliding.reason, 'worker_group_membership_denied');
	const membershipKeys = [...kv.store.keys()].filter(
		(key) => key.startsWith('ce-worker-group-member:session-a:') && key.includes(':collision-check:'),
	);
	assert.equal(membershipKeys.length, 1);
	assert.equal(Buffer.byteLength(membershipKeys[0], 'utf8') <= 512, true);
});

test('legacy case-folded membership keys are ignored even for the exact integration principal', async () => {
	const kv = createMockKv();
	const env = { CE_WORKER_GROUPS_KV: kv };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			groupId: 'legacy-agent',
			label: 'Legacy agent',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	const legacyKey = 'ce-worker-group-member:session-a:legacy-agent:agent:grant-a';
	kv.store.set(
		legacyKey,
		JSON.stringify({
			groupId: 'legacy-agent',
			sessionSlug: 'session-a',
			sessionId,
			principal: { kind: 'agent', grantId: 'Grant-A' },
			principalKey: 'agent:grant-a',
			addedAt: '2026-02-03T04:05:06.000Z',
		}),
	);

	const exact = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'legacy-agent',
		principal: { kind: 'agent', grantId: 'Grant-A' },
	});
	const collision = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'legacy-agent',
		principal: { kind: 'agent', grantId: 'grant-a' },
	});

	assert.equal(exact.ok, false);
	assert.equal(exact.reason, 'worker_group_membership_denied');
	assert.equal([...kv.store.keys()].filter((key) => key.startsWith('ce-worker-group-member:')).length, 1);
	assert.equal(collision.ok, false);
});

test('legacy group identity isolation never imports old membership projections', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	const groupId = 'legacy-isolated';
	assert.equal(
		(
			await executeCoordinatedWorkerGroupMutation({
				env,
				slug: 'session-a',
				operation: 'create',
				input: {
					groupId,
					label: 'Legacy isolated',
					joinMode: 'admin_add',
					memberVisibility: 'members',
				},
				actorPrincipal: actor,
			})
		).ok,
		true,
	);
	assert.equal(
		(
			await executeCoordinatedWorkerGroupMutation({
				env,
				slug: 'session-a',
				operation: 'add-member',
				groupId,
				principal: member,
				actorPrincipal: actor,
			})
		).ok,
		true,
	);

	const canonicalGroupKey = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group:session-a:') && key.endsWith(`:${groupId}`));
	const canonicalGroupIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-index:session-a:') && key.endsWith(`:${groupId}`),
	);
	const canonicalMemberKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-member:session-a:') && key.includes(`:${groupId}:`),
	);
	const canonicalPrincipalIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-principal:session-a:') && key.endsWith(`:${groupId}`),
	);
	assert.ok(canonicalGroupKey);
	assert.ok(canonicalGroupIndexKey);
	assert.ok(canonicalMemberKey);
	assert.ok(canonicalPrincipalIndexKey);

	const principalKey = 'evm_address:0x0000000000000000000000000000000000000def';
	const encodedPrincipal = Buffer.from(principalKey).toString('base64url');
	const legacyKeys = {
		group: `ce-worker-group:session-a:${groupId}`,
		groupIndex: `ce-worker-group-index:session-a:${groupId}`,
		member: `ce-worker-group-member:session-a:${groupId}:${encodedPrincipal}`,
		principalIndex: `ce-worker-group-principal:session-a:${encodedPrincipal}:${groupId}`,
	};
	kv.store.set(legacyKeys.group, kv.store.get(canonicalGroupKey));
	kv.store.set(legacyKeys.groupIndex, kv.store.get(canonicalGroupIndexKey));
	kv.store.set(legacyKeys.member, kv.store.get(canonicalMemberKey));
	kv.store.set(legacyKeys.principalIndex, kv.store.get(canonicalPrincipalIndexKey));
	[canonicalGroupKey, canonicalGroupIndexKey, canonicalMemberKey, canonicalPrincipalIndexKey].forEach((key) => kv.store.delete(key));

	assert.deepEqual(
		await snapshotWorkerGroupCapacity({
			env,
			slug: 'session-a',
			sessionId: replacementSessionId,
		}),
		{ ok: true, groups: [] },
	);
	assert.deepEqual(
		await resolveWorkerGroupBootstrap({
			env,
			slug: 'session-a',
			sessionId: replacementSessionId,
		}),
		{ ok: true, bootstrapId: 'fresh-template-v2' },
	);
	const replacementProjection = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		sessionId: replacementSessionId,
		groupId,
		principal: member,
	});
	assert.equal(replacementProjection.ok, false);
	assert.equal(replacementProjection.reason, 'worker_group_not_found');

	const exactList = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	assert.equal(exactList.status, 200);
	assert.deepEqual(
		exactList.body.groups.map((group) => group.groupId),
		[groupId],
	);

	const exactProjection = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId,
		principal: member,
	});
	assert.equal(exactProjection.ok, false);
	assert.equal(exactProjection.reason, 'worker_group_membership_denied');
	const exactMemberships = await listWorkerGroupMemberships({ env, slug: 'session-a', principal: member });
	assert.equal(exactMemberships.ok, false);
	assert.equal(exactMemberships.reason, 'worker_group_projection_unavailable');
	assert.equal(kv.store.has(canonicalMemberKey), false);
	assert.equal(kv.store.has(canonicalPrincipalIndexKey), false);
	assert.equal(
		(await resolveWorkerGroupBootstrap({ env, slug: 'session-a', sessionId })).reason,
		'worker_group_capacity_reconciliation_required',
	);
});

test('maximum-length integration principals stay within the Workers KV key limit', async () => {
	const kv = createMockKv();
	const env = { CE_WORKER_GROUPS_KV: kv };
	await createWorkerGroup({
		env,
		slug: 's'.repeat(128),
		input: {
			groupId: 'g'.repeat(80),
			label: 'Key limit',
			joinMode: 'admin_add',
		},
		actorPrincipal: actor,
	});
	const added = await addWorkerGroupMember({
		env,
		slug: 's'.repeat(128),
		groupId: 'g'.repeat(80),
		principal: { kind: 'agent', grantId: '/'.repeat(180) },
		actorPrincipal: actor,
	});

	assert.equal(added.ok, true);
	const keys = [...kv.store.keys()].filter((key) => key.includes('worker-group'));
	assert.equal(keys.length > 0, true);
	assert.equal(
		keys.every((key) => Buffer.byteLength(key, 'utf8') <= 512),
		true,
	);
});

test('Worker Group reconciliation inventory consumes every group page without scanning members', async () => {
	const kv = createMockKv();
	const env = { CE_WORKER_GROUPS_KV: kv };
	for (const groupId of ['group-a', 'group-b']) {
		await createWorkerGroup({
			env,
			slug: 'session-a',
			input: {
				groupId,
				label: groupId,
				joinMode: 'admin_add',
				memberVisibility: 'members',
			},
			actorPrincipal: actor,
		});
		await addWorkerGroupMember({
			env,
			slug: 'session-a',
			groupId,
			principal: {
				kind: 'telegram',
				principalId: `telegram:${groupId}`,
			},
			actorPrincipal: actor,
		});
	}
	const unpagedList = kv.list;
	kv.list = async ({ prefix = '', cursor = '' } = {}) => {
		const all = (await unpagedList({ prefix })).keys;
		const offset = Number(cursor || 0);
		return {
			keys: all.slice(offset, offset + 1),
			list_complete: offset + 1 >= all.length,
			cursor: String(offset + 1),
		};
	};

	const snapshot = await snapshotWorkerGroupCapacity({ env, slug: 'session-a' });

	assert.equal(snapshot.ok, true);
	assert.deepEqual(snapshot.groups, [{ groupId: 'group-a' }, { groupId: 'group-b' }]);
});

test('worker group image metadata accepts public HTTPS URLs and rejects unsafe values', async () => {
	const env = { CE_WORKER_GROUPS_KV: createMockKv() };
	const valid = await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			groupId: 'with-image',
			label: 'With image',
			joinMode: 'open',
			memberVisibility: 'session',
			imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
		},
		actorPrincipal: actor,
	});
	assert.equal(valid.ok, true);
	assert.equal(valid.group.imageUrl, 'https://upload.wikimedia.org/wikipedia/commons/example.jpg');

	for (const imageUrl of [
		'http://example.test/group.png',
		'javascript:alert(1)',
		['https://user:password', 'example.test/group.png'].join('@'),
		`https://example.test/${'a'.repeat(2048)}`,
	]) {
		const rejected = await createWorkerGroup({
			env,
			slug: 'session-a',
			input: { groupId: `invalid-${imageUrl.length}`, label: 'Invalid image', imageUrl },
			actorPrincipal: actor,
		});
		assert.equal(rejected.ok, false, imageUrl);
		assert.equal(rejected.reason, 'invalid_group_image_url', imageUrl);
	}
});

test('worker groups operate on storage index KV without a D1 binding', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_STORAGE_INDEX_KV: kv });
	const created = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: { groupId: 'fresh-worker', label: 'Fresh worker', joinMode: 'admin_add' },
		actorPrincipal: actor,
	});
	assert.equal(created.ok, true);
	assert.equal(created.store, 'kv');

	const added = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'add-member',
		groupId: 'fresh-worker',
		principal: member,
		actorPrincipal: actor,
	});
	assert.equal(added.ok, true);
	assert.equal(added.store, 'kv');

	const membership = await isWorkerGroupMember({
		env,
		slug: 'session-a',
		sessionId,
		groupId: 'fresh-worker',
		principal: member,
	});
	assert.equal(membership.ok, true);
	assert.equal(membership.store, 'durable_object');

	const memberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId,
		principal: member,
	});
	assert.equal(memberships.ok, true);
	assert.equal(memberships.store, 'kv');
	assert.deepEqual(
		memberships.memberships.map((entry) => entry.group.groupId),
		['fresh-worker'],
	);
	assert.equal(memberships.memberships[0].memberCount, 1);
});

test('membership discovery uses the coordinator when the KV principal index is empty', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: { groupId: 'index-lag', label: 'Index lag', joinMode: 'admin_add', memberVisibility: 'members' },
		actorPrincipal: actor,
	});
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'add-member',
		groupId: 'index-lag',
		principal: member,
		actorPrincipal: actor,
	});
	const principalIndexKey = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group-principal:'));
	assert.ok(principalIndexKey);
	await kv.delete(principalIndexKey);

	const memberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId,
		principal: member,
	});

	assert.equal(memberships.ok, true);
	assert.deepEqual(memberships.memberships.map((entry) => entry.group.groupId), ['index-lag']);
	assert.equal(memberships.memberships[0].memberCount, 1);
});

test('stale positive KV rows cannot resurrect a removed membership', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: { groupId: 'stale-positive', label: 'Stale positive', joinMode: 'admin_add', memberVisibility: 'members' },
		actorPrincipal: actor,
	});
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'add-member',
		groupId: 'stale-positive',
		principal: member,
		actorPrincipal: actor,
	});
	const memberKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-member:') && key.includes(':stale-positive:'),
	);
	const principalIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-principal:') && key.endsWith(':stale-positive'),
	);
	assert.ok(memberKey);
	assert.ok(principalIndexKey);
	const staleMember = kv.store.get(memberKey);
	const staleIndex = kv.store.get(principalIndexKey);
	const removed = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'remove-member',
		groupId: 'stale-positive',
		principal: member,
		actorPrincipal: actor,
		remover: 'admin',
	});
	assert.equal(removed.ok, true);
	await kv.put(memberKey, staleMember);
	await kv.put(principalIndexKey, staleIndex);

	const memberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId,
		principal: member,
	});
	assert.equal(memberships.ok, true);
	assert.deepEqual(memberships.memberships, []);
});

test('membership discovery fails when an authoritative membership lacks a KV projection', async () => {
	for (const missingProjection of ['group', 'member']) {
		const kv = createMockKv();
		const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
		await executeCoordinatedWorkerGroupMutation({
			env,
			slug: 'session-a',
			operation: 'create',
			input: {
				groupId: `missing-${missingProjection}`,
				label: `Missing ${missingProjection}`,
				joinMode: 'admin_add',
				memberVisibility: 'members',
			},
			actorPrincipal: actor,
		});
		await executeCoordinatedWorkerGroupMutation({
			env,
			slug: 'session-a',
			operation: 'add-member',
			groupId: `missing-${missingProjection}`,
			principal: member,
			actorPrincipal: actor,
		});
		const projectionKey = [...kv.store.keys()].find((key) =>
			missingProjection === 'group'
				? key.startsWith('ce-worker-group:') && key.endsWith(`:missing-${missingProjection}`)
				: key.startsWith('ce-worker-group-member:') && key.includes(`:missing-${missingProjection}:`),
		);
		assert.ok(projectionKey, missingProjection);
		await kv.delete(projectionKey);

		const memberships = await listWorkerGroupMemberships({
			env,
			slug: 'session-a',
			sessionId,
			principal: member,
		});
		assert.equal(memberships.ok, false, missingProjection);
		assert.equal(memberships.status, 503, missingProjection);
		assert.equal(memberships.reason, 'worker_group_projection_unavailable', missingProjection);
	}
});

test('new address-shaped group ids are rejected without tightening legacy reads', async () => {
	const addressGroupId = '0x1234567890abcdef1234567890abcdef12345678';
	const freshKv = createMockKv();
	const rejected = await createWorkerGroup({
		env: { CE_WORKER_GROUPS_KV: freshKv },
		slug: 'session-a',
		input: { groupId: addressGroupId, label: 'Address shaped', joinMode: 'open', memberVisibility: 'session' },
		actorPrincipal: actor,
	});
	assert.equal(rejected.ok, false);
	assert.equal(rejected.reason, 'invalid_worker_group_id');
	assert.equal(freshKv.store.size, 0);

	const legacyKv = createMockKv();
	const sessionKey = Buffer.from(sessionId.slice(2), 'hex').toString('base64url');
	const groupKey = `ce-worker-group:session-a:${sessionKey}:${addressGroupId}`;
	const indexKey = `ce-worker-group-index:session-a:${sessionKey}:${addressGroupId}`;
	const legacyGroup = {
		groupId: addressGroupId,
		sessionSlug: 'session-a',
		sessionId,
		label: 'Legacy address group',
		joinMode: 'open',
		memberVisibility: 'session',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};
	await legacyKv.put(groupKey, JSON.stringify(legacyGroup));
	await legacyKv.put(indexKey, addressGroupId);
	const updated = await updateWorkerGroup({
		env: { CE_WORKER_GROUPS_KV: legacyKv },
		slug: 'session-a',
		sessionId,
		groupId: addressGroupId,
		input: { label: 'Legacy address group updated' },
		actorPrincipal: actor,
	});
	assert.equal(updated.ok, true);
	assert.equal(updated.group.groupId, addressGroupId);
});

test('worker groups ignore session-worker D1 bindings and keep KV authoritative', async () => {
	const d1BindingNames = ['CE_WORKER_GROUPS_D1', 'CE_STORAGE_AUDIT_D1', 'STORAGE_AUDIT_D1', 'D1', 'DB'];

	for (const bindingName of d1BindingNames) {
		const kv = createMockKv();
		let d1Calls = 0;
		const d1 = {
			async exec() {
				d1Calls += 1;
				throw new Error(`${bindingName} must not be used for worker groups`);
			},
			prepare() {
				d1Calls += 1;
				throw new Error(`${bindingName} must not be used for worker groups`);
			},
		};
		const created = await createWorkerGroup({
			env: {
				CE_STORAGE_INDEX_KV: kv,
				[bindingName]: d1,
			},
			slug: 'session-a',
			input: {
				groupId: `kv-${bindingName.toLowerCase()}`,
				label: `KV authority for ${bindingName}`,
				joinMode: 'admin_add',
			},
			actorPrincipal: actor,
		});

		assert.equal(created.ok, true, bindingName);
		assert.equal(created.store, 'kv', bindingName);
		assert.equal(d1Calls, 0, bindingName);

		const d1Only = await createWorkerGroup({
			env: { [bindingName]: d1 },
			slug: 'session-a',
			input: {
				groupId: `d1-${bindingName.toLowerCase()}`,
				label: `No D1 fallback for ${bindingName}`,
				joinMode: 'admin_add',
			},
			actorPrincipal: actor,
		});
		assert.equal(d1Only.ok, false, bindingName);
		assert.equal(d1Only.status, 501, bindingName);
		assert.equal(d1Only.reason, 'worker_group_store_not_configured', bindingName);
		assert.equal(d1Calls, 0, bindingName);
	}
});

test('worker groups reject deferred join modes and malformed principals fail closed', async () => {
	const env = { CE_WORKER_GROUPS_KV: createMockKv() };
	const password = await createWorkerGroup({
		env,
		slug: 'session-a',
		input: { label: 'Deferred join', joinMode: 'password' },
		actorPrincipal: actor,
		deps: { randomUUID: () => 'deferred' },
	});
	assert.equal(password.ok, false);
	assert.equal(password.reason, 'join_mode_not_implemented');

	assert.deepEqual(normalizeWorkerGroupPrincipal({ kind: 'telegram', principalId: '' }), {
		ok: false,
		reason: 'invalid_telegram_principal',
	});
	assert.deepEqual(resolveWorkerGroupPrincipal({}), {
		ok: false,
		reason: 'missing_principal',
	});
});

test('worker group EVM principal normalization uses getAddress while matching lower-case keys', async () => {
	const normalized = normalizeWorkerGroupPrincipal(
		{ kind: 'evm_address', address: '0x0000000000000000000000000000000000000def' },
		{
			isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
			getAddress: () => '0x0000000000000000000000000000000000000DEF',
		},
	);
	assert.equal(normalized.ok, true);
	assert.equal(normalized.principal.address, '0x0000000000000000000000000000000000000DEF');
	assert.equal(normalized.key, 'evm_address:0x0000000000000000000000000000000000000def');
});

test('token claims cannot replace the authenticated EVM group principal', () => {
	for (const authScopes of [
		{ telegramPrincipal: 'historical-subject' },
		{ integrationPrincipal: { telegram: 'historical-subject' } },
		{ integrationPrincipal: { principalId: 'historical-subject' } },
		{ telegramUserId: 'historical-user' },
		{ integrationPrincipal: { telegram_user_id: 'historical-user' } },
		{ principal: { kind: 'agent', grantId: 'grant:test-1' } },
		{ grantId: 'grant:test-1' },
		{ agentGrant: { grantId: 'grant:test-1' } },
		{ agent_grant: { grantId: 'grant:test-1' } },
		{ delegation: { grantId: 'grant:test-1' } },
	]) {
		assert.deepEqual(resolveWorkerGroupPrincipal({ requesterAddress: actor.address, authScopes }).principal,
			{ kind: 'evm_address', address: actor.address });
		assert.equal(resolveWorkerGroupPrincipal({ authScopes }).reason, 'missing_principal');
	}
});

test('explicit historical transport principals still read their original membership keys', async () => {
	const env = { CE_WORKER_GROUPS_KV: createMockKv() };
	const principal = { kind: 'telegram', principalId: 'Historical-Subject' };
	const group = await createWorkerGroup({ env, slug: 'session-a', actorPrincipal: actor,
		input: { label: 'Historical group', joinMode: 'admin_add' }, deps: { randomUUID: () => 'historical-group' } });
	assert.equal(group.ok, true);
	assert.equal((await addWorkerGroupMember({ env, slug: 'session-a', groupId: 'historical-group', principal, actorPrincipal: actor })).ok, true);
	const explicit = normalizeWorkerGroupPrincipal(principal);
	assert.equal(explicit.key, 'telegram:Historical-Subject');
	const membership = await readWorkerGroupMembershipProjection({ env, slug: 'session-a', groupId: 'historical-group', principal: explicit.principal });
	assert.equal(membership.ok, true);
	assert.deepEqual(membership.principal, principal);
});

test('Worker Group routes reject missing or mismatched session ids before coordination or mutation', async () => {
	let coordinatorCalls = 0;
	let mutationCalls = 0;
	const env = {
		CE_WORKER_GROUPS_KV: createMockKv(),
		CE_SESSION_COORDINATOR: {
			idFromName: () => {
				coordinatorCalls += 1;
				return 'must-not-run';
			},
			get: () => {
				coordinatorCalls += 1;
				return { fetch: async () => new Response('{}') };
			},
		},
	};
	const routeBase = {
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: {
			json,
			executeCoordinatedWorkerGroupMutation: async () => {
				mutationCalls += 1;
				return { ok: true };
			},
		},
	};

	const missing = await workerGroupsRoute({
		...routeBase,
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		injectSessionId: false,
	});
	assert.equal(missing.status, 409);
	assert.equal(missing.body.reason, 'worker_group_session_identity_mismatch');

	const mismatched = await workerGroupsRoute({
		...routeBase,
		path: '/groups/join',
		method: 'POST',
		request: new Request('https://worker.example/groups/join', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ groupId: 'open-review' }),
		}),
		requestedSessionId: replacementSessionId,
	});
	assert.equal(mismatched.status, 409);
	assert.equal(mismatched.body.reason, 'worker_group_session_identity_mismatch');

	const adminMismatch = await dispatchAdminWorkerGroupRequest({
		action: 'groups/create',
		body: {
			sessionId: replacementSessionId,
			group: {
				groupId: 'must-not-exist',
				label: 'Must not exist',
				joinMode: 'admin_add',
			},
		},
		env,
		slug: 'session-a',
		adminAddress: actor.address,
		headers: {},
		deps: routeBase.deps,
	});
	assert.equal(adminMismatch.status, 409);
	assert.equal(adminMismatch.body.reason, 'worker_group_session_identity_mismatch');
	assert.equal(coordinatorCalls, 0);
	assert.equal(mutationCalls, 0);
});

test('member routes respect visibility and open join mode', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: { groupId: 'open-review', label: 'Open review', joinMode: 'open', memberVisibility: 'admin_only' },
		actorPrincipal: actor,
	});
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: { groupId: 'session-visible', label: 'Visible', joinMode: 'admin_add', memberVisibility: 'session' },
		actorPrincipal: actor,
	});

	const visibleResponse = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	assert.equal(visibleResponse.status, 200);
	assert.equal(visibleResponse.body.sessionSlug, 'session-a');
	assert.equal(visibleResponse.body.sessionId, sessionId);
	assert.deepEqual(
		visibleResponse.body.groups.map((group) => group.groupId),
		['session-visible'],
	);

	const joinResponse = await workerGroupsRoute({
		path: '/groups/join',
		method: 'POST',
		request: new Request('https://worker.example/groups/join', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ groupId: 'open-review' }),
		}),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json, now: () => Date.parse('2026-02-03T04:05:06.000Z') },
	});
	assert.equal(joinResponse.status, 200);
	assert.equal(joinResponse.body.sessionSlug, 'session-a');
	assert.equal(joinResponse.body.sessionId, sessionId);
	assert.equal(joinResponse.body.memberCount, 1);

	const memberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId,
		principal: member,
	});
	assert.equal(memberships.ok, true);
	assert.deepEqual(
		memberships.memberships.map((entry) => entry.group.groupId),
		['open-review'],
	);
	assert.equal(memberships.memberships[0].memberCount, 1);

	const leaveResponse = await workerGroupsRoute({
		path: '/groups/leave',
		method: 'POST',
		request: new Request('https://worker.example/groups/leave', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				groupId: 'open-review',
				principal: actor,
			}),
		}),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json, now: () => Date.parse('2026-02-03T04:06:06.000Z') },
	});
	assert.equal(leaveResponse.status, 200);
	assert.equal(leaveResponse.body.sessionSlug, 'session-a');
	assert.equal(leaveResponse.body.sessionId, sessionId);
	assert.equal(leaveResponse.body.groupId, 'open-review');
	assert.equal(leaveResponse.body.principal.address, member.address);
	assert.equal(Object.hasOwn(leaveResponse.body, 'group'), false);
	assert.equal(Object.hasOwn(leaveResponse.body, 'memberCount'), false);

	const membershipsAfterLeave = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId,
		principal: member,
	});
	assert.equal(membershipsAfterLeave.ok, true);
	assert.deepEqual(membershipsAfterLeave.memberships, []);

	const actorMemberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId,
		principal: actor,
	});
	assert.equal(actorMemberships.ok, true);
	assert.deepEqual(actorMemberships.memberships, []);
});

test('session-visible leave returns the retained group and authoritative count', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: { groupId: 'visible-leave', label: 'Visible leave', joinMode: 'open', memberVisibility: 'session' },
		actorPrincipal: actor,
	});
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'join',
		groupId: 'visible-leave',
		principal: member,
		actorPrincipal: member,
	});

	const response = await workerGroupsRoute({
		path: '/groups/leave',
		method: 'POST',
		request: new Request('https://worker.example/groups/leave', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ groupId: 'visible-leave' }),
		}),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});

	assert.equal(response.status, 200);
	assert.equal(response.body.memberCount, 0);
	assert.equal(response.body.group.groupId, 'visible-leave');
	assert.equal(response.body.group.memberVisibility, 'session');

	const listResponse = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	assert.equal(listResponse.status, 200);
	assert.equal(listResponse.body.groups[0].groupId, 'visible-leave');
	assert.equal(listResponse.body.groups[0].memberCount, 0);

	const publicListResponse = await dispatchPublicWorkerGroupListRequest({
		request: new Request(`https://worker.example/groups/list?sessionId=${sessionId}`),
		config: publicWorkerGroupConfig(),
		env,
		slug: 'session-a',
		baseHeaders: {},
		deps: { json },
	});
	assert.equal(publicListResponse.status, 200);
	assert.equal(Object.hasOwn(publicListResponse.body.groups[0], 'memberCount'), false);
});

test('participant member lists enforce the configured identity visibility and redact storage internals', async () => {
	let listCalls = 0;
	const listPage = async () => {
		listCalls += 1;
		return {
			ok: true,
			store: 'kv',
			group: {
				groupId: 'visible',
				sessionSlug: 'session-a',
				label: 'Visible',
				joinMode: 'admin_add',
				memberVisibility: 'admin_only',
			},
			members: [
				{
					groupId: 'visible',
					sessionSlug: 'session-a',
					principal: member,
					principalKey: 'must-not-leak',
					addedAt: '2026-07-28T12:00:00.000Z',
					addedBy: 'must-not-leak',
				},
			],
			nextCursor: 'next-page',
		};
	};
	const run = ({ memberVisibility, isMember }) =>
		listWorkerGroupMembersForPrincipal({
			env: {},
			slug: 'session-a',
			groupId: 'visible',
			principal: actor,
			deps: {
				readCoordinatedWorkerGroupCatalog: async () => ({
					ok: true,
					groups: [
						{
							groupId: 'visible',
							joinMode: 'open',
							memberVisibility,
							memberCount: 2,
							isMember,
						},
					],
				}),
				listWorkerGroupMembers: listPage,
			},
		});

	const sessionVisible = await run({ memberVisibility: 'session', isMember: false });
	assert.equal(sessionVisible.ok, true);
	assert.equal(sessionVisible.memberCount, 2);
	assert.equal(sessionVisible.group.memberVisibility, 'session');
	assert.equal(sessionVisible.group.joinMode, 'open');
	assert.deepEqual(sessionVisible.members, [
		{
			groupId: 'visible',
			sessionSlug: 'session-a',
			principal: member,
			addedAt: '2026-07-28T12:00:00.000Z',
		},
	]);
	assert.doesNotMatch(JSON.stringify(sessionVisible), /principalKey|addedBy|must-not-leak/);

	const memberVisible = await run({ memberVisibility: 'members', isMember: true });
	assert.equal(memberVisible.ok, true);
	assert.equal(memberVisible.group.memberVisibility, 'members');

	for (const denied of [
		{ memberVisibility: 'members', isMember: false },
		{ memberVisibility: 'admin_only', isMember: true },
	]) {
		const response = await run(denied);
		assert.equal(response.ok, false);
		assert.equal(response.status, 403);
		assert.equal(response.reason, 'worker_group_member_list_forbidden');
	}
	assert.equal(listCalls, 2);
});

test('participant member-list route binds the authenticated principal and exact session identity', async () => {
	let memberListArgs = null;
	const response = await workerGroupsRoute({
		path: '/groups/members',
		method: 'POST',
		request: new Request('https://worker.example/groups/members', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ groupId: 'visible', cursor: 'current-page', limit: 25 }),
		}),
		env: {},
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: {
			json,
			checkCoordinatedWorkerGroupReady: async () => ({ ok: true }),
			listWorkerGroupMembersForPrincipal: async (args) => {
				memberListArgs = args;
				return {
					ok: true,
					store: 'kv',
					group: {
						groupId: 'visible',
						sessionSlug: 'session-a',
						label: 'Visible',
						joinMode: 'open',
						memberVisibility: 'session',
					},
					members: [],
					memberCount: 0,
					nextCursor: '',
				};
			},
		},
	});

	assert.equal(response.status, 200);
	assert.equal(response.body.sessionId, sessionId);
	assert.equal(response.body.sessionSlug, 'session-a');
	assert.equal(response.body.memberCount, 0);
	assert.equal(memberListArgs.slug, 'session-a');
	assert.equal(memberListArgs.sessionId, sessionId);
	assert.equal(memberListArgs.groupId, 'visible');
	assert.equal(memberListArgs.cursor, 'current-page');
	assert.equal(memberListArgs.limit, 25);
	assert.deepEqual(memberListArgs.principal, member);
});

test('participant group creation requires the explicit policy and forces an open session-visible group', async () => {
	let mutation = null;
	const deps = {
		json,
		executeCoordinatedWorkerGroupMutation: async (args) => {
			mutation = args;
			return {
				ok: true,
				store: 'kv',
				group: {
					groupId: 'generated-group',
					sessionSlug: 'session-a',
					label: args.input.label,
					description: args.input.description,
					joinMode: args.input.joinMode,
					memberVisibility: args.input.memberVisibility,
				},
			};
		},
	};
	const request = () =>
		new Request('https://worker.example/groups/create', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				group: {
					groupId: 'participant-chosen-id',
					label: 'Participant review',
					description: 'Open working group.',
					tags: ['reviewers'],
					documentURLs: ['https://docs.example.test/review'],
					memberLimit: 12,
					joinEndsAt: '2030-02-03T04:05:06.000Z',
					adminAddress: actor.address,
					joinMode: 'admin_add',
					memberVisibility: 'admin_only',
					removalAuth: 'member_only',
				},
			}),
		});

	const denied = await workerGroupsRoute({
		path: '/groups/create',
		method: 'POST',
		request: request(),
		env: {},
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps,
	});
	assert.equal(denied.status, 403);
	assert.equal(denied.body.reason, 'worker_group_creation_admin_only');
	assert.equal(mutation, null);
	for (const groupCreationPolicy of ['Participants', ' participants ', true]) {
		const noncanonical = await workerGroupsRoute({
			path: '/groups/create',
			method: 'POST',
			request: request(),
			config: { sessionId, groupCreationPolicy },
			env: {},
			slug: 'session-a',
			requesterAddress: member.address,
			baseHeaders: {},
			deps,
		});
		assert.equal(noncanonical.status, 403);
		assert.equal(noncanonical.body.reason, 'worker_group_creation_admin_only');
		assert.equal(mutation, null);
	}

	const created = await workerGroupsRoute({
		path: '/groups/create',
		method: 'POST',
		request: request(),
		config: { sessionId, groupCreationPolicy: 'participants' },
		env: {},
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps,
	});
	assert.equal(created.status, 200);
	assert.equal(created.body.sessionId, sessionId);
	assert.equal(created.body.sessionSlug, 'session-a');
	assert.equal(mutation.operation, 'create');
	assert.equal(mutation.input.groupId, undefined);
	assert.equal(mutation.input.joinMode, 'open');
	assert.equal(mutation.input.memberVisibility, 'session');
	assert.deepEqual(mutation.input.tags, ['reviewers']);
	assert.deepEqual(mutation.input.documentURLs, ['https://docs.example.test/review']);
	assert.equal(mutation.input.memberLimit, 12);
	assert.equal(mutation.input.joinEndsAt, '2030-02-03T04:05:06.000Z');
	assert.equal(mutation.input.adminAddress, member.address);
	// Who can remove members is the participant's own choice.
	assert.equal(mutation.input.removalAuth, 'member_only');
	assert.deepEqual(mutation.actorPrincipal, member);
});

test('same slug with a replacement session id cannot expose prior groups or members', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	const created = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: {
			groupId: 'prior-session-reviewers',
			label: 'Prior session reviewers',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	assert.equal(created.ok, true);
	const added = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'add-member',
		groupId: 'prior-session-reviewers',
		principal: member,
		actorPrincipal: actor,
	});
	assert.equal(added.ok, true);

	const priorMembers = await dispatchAdminWorkerGroupRequest({
		action: 'groups/list-members',
		body: { groupId: 'prior-session-reviewers' },
		env,
		slug: 'session-a',
		adminAddress: actor.address,
		headers: {},
		deps: { json },
	});
	assert.equal(priorMembers.status, 200);
	assert.equal(priorMembers.body.sessionId, sessionId);
	assert.deepEqual(
		priorMembers.body.members.map((entry) => entry.principal.address),
		[member.address],
	);

	const replacementList = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		requestedSessionId: replacementSessionId,
		config: { sessionId: replacementSessionId },
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	assert.equal(replacementList.status, 200);
	assert.deepEqual(replacementList.body.groups, []);

	const replacementMembers = await dispatchAdminWorkerGroupRequest({
		action: 'groups/list-members',
		body: {
			sessionId: replacementSessionId,
			groupId: 'prior-session-reviewers',
		},
		config: { sessionId: replacementSessionId },
		env,
		slug: 'session-a',
		adminAddress: actor.address,
		headers: {},
		deps: { json },
	});
	assert.equal(replacementMembers.status, 404);
	assert.equal(replacementMembers.body.reason, 'worker_group_not_found');
	assert.equal(replacementMembers.body.members, undefined);

	const replacementBootstrap = await resolveWorkerGroupBootstrap({
		env,
		slug: 'session-a',
		sessionId: replacementSessionId,
	});
	assert.deepEqual(replacementBootstrap, {
		ok: true,
		bootstrapId: 'fresh-template-v2',
	});
	assert.deepEqual(
		await snapshotWorkerGroupCapacity({
			env,
			slug: 'session-a',
			sessionId: replacementSessionId,
		}),
		{ ok: true, groups: [] },
	);

	const replacementPrincipal = {
		kind: 'telegram',
		principalId: 'replacement-member',
	};
	const replacementCreated = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		sessionId: replacementSessionId,
		operation: 'create',
		input: {
			groupId: 'prior-session-reviewers',
			label: 'Replacement session reviewers',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	assert.equal(replacementCreated.ok, true);
	const replacementAdded = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		sessionId: replacementSessionId,
		operation: 'add-member',
		groupId: 'prior-session-reviewers',
		principal: replacementPrincipal,
		actorPrincipal: actor,
	});
	assert.equal(replacementAdded.ok, true);

	const priorProjection = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		sessionId,
		groupId: 'prior-session-reviewers',
		principal: member,
	});
	const replacementProjection = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		sessionId: replacementSessionId,
		groupId: 'prior-session-reviewers',
		principal: member,
	});
	assert.equal(priorProjection.ok, true);
	assert.equal(replacementProjection.ok, false);
	assert.equal(replacementProjection.reason, 'worker_group_membership_denied');

	const replacementPrincipalMemberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId: replacementSessionId,
		principal: replacementPrincipal,
	});
	const priorPrincipalMemberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		sessionId,
		principal: replacementPrincipal,
	});
	assert.deepEqual(
		replacementPrincipalMemberships.memberships.map((entry) => entry.group.label),
		['Replacement session reviewers'],
	);
	assert.deepEqual(priorPrincipalMemberships.memberships, []);

	assert.deepEqual(await snapshotWorkerGroupCapacity({ env, slug: 'session-a', sessionId }), {
		ok: true,
		groups: [{ groupId: 'prior-session-reviewers' }],
	});
	assert.deepEqual(
		await snapshotWorkerGroupCapacity({
			env,
			slug: 'session-a',
			sessionId: replacementSessionId,
		}),
		{ ok: true, groups: [{ groupId: 'prior-session-reviewers' }] },
	);
	const identityGroupKeys = [...kv.store.keys()].filter(
		(key) => key.startsWith('ce-worker-group:session-a:') && key.endsWith(':prior-session-reviewers'),
	);
	assert.equal(identityGroupKeys.length, 2);
	assert.notEqual(identityGroupKeys[0], identityGroupKeys[1]);
});

test('group list projection failures return 503 instead of a false empty state', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: {
			groupId: 'visible',
			label: 'Visible',
			joinMode: 'admin_add',
			memberVisibility: 'session',
		},
		actorPrincipal: actor,
	});
	const currentGet = kv.get.bind(kv);
	const visibleIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-index:session-a:') && key.endsWith(':visible'),
	);
	assert.ok(visibleIndexKey);
	kv.get = async (key) => {
		if (key === visibleIndexKey) {
			throw new Error('KV unavailable');
		}
		return currentGet(key);
	};

	const response = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});

	assert.equal(response.status, 503);
	assert.equal(response.body.reason, 'worker_group_projection_unavailable');
});

test('group lists reject a stale-empty KV projection when Durable Objects report active groups', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: {
			groupId: 'visible',
			label: 'Visible',
			joinMode: 'admin_add',
			memberVisibility: 'session',
		},
		actorPrincipal: actor,
	});
	const currentList = kv.list.bind(kv);
	const visibleIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-index:session-a:') && key.endsWith(':visible'),
	);
	assert.ok(visibleIndexKey);
	const visibleIndexPrefix = visibleIndexKey.slice(0, -'visible'.length);
	kv.list = async (options = {}) => (options.prefix === visibleIndexPrefix ? { keys: [], list_complete: true } : currentList(options));

	const response = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});

	assert.equal(response.status, 503);
	assert.equal(response.body.reason, 'worker_group_projection_unavailable');
});

test('member list routes propagate coordinator failures after readiness succeeds', async () => {
	const kv = createMockKv();
	const env = { CE_WORKER_GROUPS_KV: kv };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		sessionId,
		input: {
			groupId: 'members-only',
			label: 'Members only',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	await addWorkerGroupMember({
		env,
		slug: 'session-a',
		sessionId,
		groupId: 'members-only',
		principal: member,
		actorPrincipal: actor,
	});
	env.CE_SESSION_COORDINATOR = {
		idFromName: (name) => name,
		get: () => ({
			fetch: async (input) => {
				const path = new URL(input instanceof Request ? input.url : input).pathname;
				if (path === '/worker-groups/ready') {
					return new Response(
						JSON.stringify({
							ok: true,
							status: 200,
							meta: { groupCount: 1 },
						}),
						{ status: 200 },
					);
				}
				return new Response(
					JSON.stringify({
						ok: false,
						status: 503,
						reason: 'worker_group_coordination_unavailable',
					}),
					{ status: 503 },
				);
			},
		}),
	};

	for (const path of ['/groups/list', '/groups/my-memberships', '/groups/members']) {
		const response = await workerGroupsRoute({
			path,
			method: 'GET',
			request: new Request(
				`https://worker.example${path}${path === '/groups/members' ? '?groupId=members-only' : ''}`,
			),
			env,
			slug: 'session-a',
			requesterAddress: member.address,
			baseHeaders: {},
			deps: { json },
		});
		assert.equal(response.status, 503, path);
		assert.equal(response.body.reason, 'worker_group_coordination_unavailable', path);
	}
});

test('participant and admin group lists use authoritative activity and visibility', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	const create = (groupId, memberVisibility) =>
		executeCoordinatedWorkerGroupMutation({
			env,
			slug: 'session-a',
			operation: 'create',
			input: {
				groupId,
				label: groupId,
				joinMode: 'open',
				memberVisibility,
			},
			actorPrincipal: actor,
		});
	await create('restricted', 'session');
	await create('deleted', 'session');
	const restrictedGroupKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group:session-a:') && key.endsWith(':restricted'),
	);
	const deletedGroupKey = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group:session-a:') && key.endsWith(':deleted'));
	const deletedIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-index:session-a:') && key.endsWith(':deleted'),
	);
	assert.ok(restrictedGroupKey);
	assert.ok(deletedGroupKey);
	assert.ok(deletedIndexKey);
	const staleRestricted = kv.store.get(restrictedGroupKey);
	const staleDeleted = kv.store.get(deletedGroupKey);
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'update',
		groupId: 'restricted',
		input: {
			label: 'restricted',
			joinMode: 'admin_add',
			memberVisibility: 'admin_only',
		},
		actorPrincipal: actor,
	});
	await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'delete',
		groupId: 'deleted',
		actorPrincipal: actor,
	});
	kv.store.set(restrictedGroupKey, staleRestricted);
	kv.store.set(deletedGroupKey, staleDeleted);
	kv.store.set(deletedIndexKey, 'deleted');

	const participantResponse = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	assert.equal(participantResponse.status, 200);
	assert.deepEqual(participantResponse.body.groups, []);

	const adminResponse = await dispatchAdminWorkerGroupRequest({
		action: 'groups/list',
		body: {},
		env,
		slug: 'session-a',
		adminAddress: actor.address,
		headers: {},
		deps: { json },
	});
	assert.equal(adminResponse.status, 200);
	assert.deepEqual(
		adminResponse.body.groups.map((group) => group.groupId),
		['restricted'],
	);
	assert.equal(adminResponse.body.groups[0].joinMode, 'admin_add');
	assert.equal(adminResponse.body.groups[0].memberVisibility, 'admin_only');
	assert.equal(adminResponse.body.groups[0].memberCount, 0);
});

test('admin member listing stays below the KV operation ceiling and returns a cursor', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	const created = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: {
			groupId: 'large-group',
			label: 'Large group',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	assert.equal(created.ok, true);
	for (let index = 0; index < 251; index += 1) {
		const added = await addWorkerGroupMember({
			env,
			slug: 'session-a',
			sessionId,
			groupId: 'large-group',
			principal: { kind: 'telegram', principalId: `member-${String(index).padStart(3, '0')}` },
			actorPrincipal: actor,
			capacityAuthorized: true,
		});
		assert.equal(added.ok, true);
	}

	let operations = 0;
	const get = kv.get.bind(kv);
	const list = kv.list.bind(kv);
	kv.get = async (...args) => {
		operations += 1;
		return get(...args);
	};
	kv.list = async (...args) => {
		operations += 1;
		return list(...args);
	};
	const firstPage = await dispatchAdminWorkerGroupRequest({
		action: 'groups/list-members',
		body: { groupId: 'large-group', limit: 250 },
		env,
		slug: 'session-a',
		adminAddress: actor.address,
		headers: {},
		deps: {
			json,
			checkCoordinatedWorkerGroupReady: async () => ({ ok: true }),
		},
	});
	assert.equal(firstPage.status, 200);
	assert.equal(firstPage.body.members.length, 250);
	assert.ok(firstPage.body.nextCursor);
	assert.equal(operations <= 252, true);

	operations = 0;
	const secondPage = await listWorkerGroupMembers({
		env,
		slug: 'session-a',
		sessionId,
		groupId: 'large-group',
		cursor: firstPage.body.nextCursor,
		limit: 250,
	});
	assert.equal(secondPage.ok, true);
	assert.equal(secondPage.members.length, 1);
	assert.equal(secondPage.nextCursor, '');
	assert.equal(operations <= 4, true);
});

test('member listings preserve removals across pages and never import legacy-only members', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	const groupId = 'removal-pages';
	assert.equal(
		(
			await executeCoordinatedWorkerGroupMutation({
				env,
				slug: 'session-a',
				operation: 'create',
				input: { groupId, label: 'Removal pages', joinMode: 'admin_add', memberVisibility: 'members' },
				actorPrincipal: actor,
			})
		).ok,
		true,
	);
	const retained = [
		{ kind: 'agent', grantId: 'Member-A' },
		{ kind: 'agent', grantId: 'Member-B' },
	];
	for (const principal of [member, ...retained]) {
		assert.equal(
			(
				await executeCoordinatedWorkerGroupMutation({
					env,
					slug: 'session-a',
					operation: 'add-member',
					groupId,
					principal,
					actorPrincipal: actor,
				})
			).ok,
			true,
		);
	}
	const principalKey = normalizeWorkerGroupPrincipal(member).key;
	const encoded = Buffer.from(principalKey).toString('base64url');
	const canonicalMemberKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-member:') && key.endsWith(`:${groupId}:${encoded}`),
	);
	const canonicalIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-principal:') && key.endsWith(`:${encoded}:${groupId}`),
	);
	assert.ok(canonicalMemberKey);
	assert.ok(canonicalIndexKey);
	const original = JSON.parse(kv.store.get(canonicalMemberKey));
	for (const keyPart of [encoded, principalKey.toLowerCase()]) {
		kv.store.set(`ce-worker-group-member:session-a:${groupId}:${keyPart}`, JSON.stringify(original));
		kv.store.set(`ce-worker-group-principal:session-a:${keyPart}:${groupId}`, groupId);
	}
	const legacyPrincipal = { kind: 'agent', grantId: 'Legacy-Only' };
	const legacyPrincipalKey = normalizeWorkerGroupPrincipal(legacyPrincipal).key;
	const legacyEncoded = Buffer.from(legacyPrincipalKey).toString('base64url');
	kv.store.set(
		`ce-worker-group-member:session-a:${groupId}:${legacyEncoded}`,
		JSON.stringify({ ...original, principal: legacyPrincipal, principalKey: legacyPrincipalKey }),
	);
	kv.store.set(`ce-worker-group-principal:session-a:${legacyEncoded}:${groupId}`, groupId);
	assert.equal(
		(
			await executeCoordinatedWorkerGroupMutation({
				env,
				slug: 'session-a',
				operation: 'remove-member',
				groupId,
				principal: member,
				actorPrincipal: actor,
				remover: 'admin',
			})
		).ok,
		true,
	);
	const tombstone = kv.store.get(canonicalMemberKey);
	assert.ok(JSON.parse(tombstone).removedAt);
	assert.equal(kv.store.has(canonicalIndexKey), false);
	const before = [...kv.store];
	for (let attempt = 0; attempt < 3; attempt += 1) {
		let cursor = '';
		const members = [];
		let pages = 0;
		do {
			const page = await listWorkerGroupMembers({ env, slug: 'session-a', groupId, cursor, limit: 1 });
			assert.equal(page.ok, true);
			members.push(...page.members.map((row) => row.principalKey));
			cursor = page.nextCursor;
			assert.ok(++pages <= 4);
		} while (cursor);
		assert.deepEqual(members.sort(), retained.map((principal) => normalizeWorkerGroupPrincipal(principal).key).sort());
		assert.equal(kv.store.get(canonicalMemberKey), tombstone);
		assert.equal(kv.store.has(canonicalIndexKey), false);
		assert.deepEqual([...kv.store], before);
	}
	assert.equal((await readWorkerGroupMembershipProjection({ env, slug: 'session-a', groupId, principal: legacyPrincipal })).ok, false);
	assert.deepEqual([...kv.store], before);
});

test('explicit removal and deletion prune list indexes while retaining tombstones', async () => {
	const kv = createMockKv();
	const env = { CE_WORKER_GROUPS_KV: kv };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		input: {
			groupId: 'indexed',
			label: 'Indexed',
			joinMode: 'admin_add',
			memberVisibility: 'members',
		},
		actorPrincipal: actor,
	});
	await addWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'indexed',
		principal: member,
		actorPrincipal: actor,
	});
	const principalIndex = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group-principal:session-a:'));
	const memberRecord = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group-member:session-a:') && key.includes(':indexed:'));
	const groupIndex = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group-index:session-a:') && key.endsWith(':indexed'));
	const groupRecord = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group:session-a:') && key.endsWith(':indexed'));
	assert.ok(principalIndex);
	assert.ok(memberRecord);
	assert.ok(groupIndex);
	assert.ok(groupRecord);

	const removed = await removeWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'indexed',
		principal: member,
		actorPrincipal: actor,
		remover: 'admin',
	});
	assert.equal(removed.ok, true);
	assert.equal(kv.store.has(principalIndex), false);
	assert.match(kv.store.get(memberRecord), /"removedAt"/);

	const deleted = await deleteWorkerGroup({
		env,
		slug: 'session-a',
		groupId: 'indexed',
		actorPrincipal: actor,
	});
	assert.equal(deleted.ok, true);
	assert.equal(kv.store.has(groupIndex), false);
	assert.match(kv.store.get(groupRecord), /"deletedAt"/);

	const listed = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'indexed',
		principal: member,
	});
	assert.equal(listed.ok, false);
	assert.equal(listed.reason, 'worker_group_not_found');
});

test('coordinated create retains a conservative reservation when the existence read fails', async () => {
	const kv = createMockKv();
	const originalGet = kv.get.bind(kv);
	kv.get = async (key) => {
		if (key.startsWith('ce-worker-group:session-a:') && key.endsWith(':ambiguous')) {
			throw new Error('KV unavailable');
		}
		return originalGet(key);
	};
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });

	const result = await executeCoordinatedWorkerGroupMutation({
		env,
		slug: 'session-a',
		operation: 'create',
		input: {
			groupId: 'ambiguous',
			label: 'Ambiguous',
			joinMode: 'admin_add',
		},
		actorPrincipal: actor,
	});

	assert.equal(result.status, 503);
	assert.equal(result.reason, 'worker_group_mutation_ambiguous');
	assert.equal(
		[...kv.store.keys()].some((key) => key.startsWith('ce-worker-group:session-a:') && key.endsWith(':ambiguous')),
		false,
	);
});

test('worker group deletion revokes membership checks', async () => {
	const env = { CE_WORKER_GROUPS_KV: createMockKv() };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		input: { groupId: 'temporary', label: 'Temporary', joinMode: 'admin_add' },
		actorPrincipal: actor,
	});
	await addWorkerGroupMember({
		env,
		slug: 'session-a',
		groupId: 'temporary',
		principal: member,
		actorPrincipal: actor,
	});
	assert.equal(
		(
			await readWorkerGroupMembershipProjection({
				env,
				slug: 'session-a',
				groupId: 'temporary',
				principal: member,
			})
		).ok,
		true,
	);

	const deleted = await deleteWorkerGroup({
		env,
		slug: 'session-a',
		groupId: 'temporary',
		actorPrincipal: actor,
	});
	assert.equal(deleted.ok, true);

	const afterDelete = await readWorkerGroupMembershipProjection({
		env,
		slug: 'session-a',
		groupId: 'temporary',
		principal: member,
	});
	assert.equal(afterDelete.ok, false);
	assert.equal(afterDelete.reason, 'worker_group_not_found');
});

test('worker group updates keep join mode implementation fail-closed', async () => {
	const env = { CE_WORKER_GROUPS_KV: createMockKv() };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		input: { groupId: 'reviewers', label: 'Reviewers', joinMode: 'admin_add' },
		actorPrincipal: actor,
	});
	const updated = await updateWorkerGroup({
		env,
		slug: 'session-a',
		groupId: 'reviewers',
		input: { label: 'Reviewers v2', memberVisibility: 'session' },
		actorPrincipal: actor,
	});
	assert.equal(updated.ok, true);
	assert.equal(updated.group.label, 'Reviewers v2');
	assert.equal(updated.group.memberVisibility, 'session');

	const invite = await updateWorkerGroup({
		env,
		slug: 'session-a',
		groupId: 'reviewers',
		input: { joinMode: 'invite' },
		actorPrincipal: actor,
	});
	assert.equal(invite.ok, false);
	assert.equal(invite.reason, 'join_mode_not_implemented');
});

test('leave and admin removal follow each group\'s removal setting, and every list reports it', async () => {
	const kv = createMockKv();
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: kv });
	const memberRoute = (path, groupId) =>
		workerGroupsRoute({
			path,
			method: 'POST',
			request: new Request(`https://worker.example${path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ groupId }),
			}),
			env,
			slug: 'session-a',
			requesterAddress: member.address,
			baseHeaders: {},
			deps: { json },
		});
	const adminRemove = (groupId) =>
		dispatchAdminWorkerGroupRequest({
			action: 'groups/remove-member',
			body: { groupId, principal: member },
			env,
			slug: 'session-a',
			adminAddress: actor.address,
			headers: {},
			deps: { json },
		});
	const settings = { kept: 'admin_only', owned: 'member_only', unset: undefined };
	for (const [groupId, removalAuth] of Object.entries(settings)) {
		const created = await executeCoordinatedWorkerGroupMutation({
			env,
			slug: 'session-a',
			operation: 'create',
			input: { groupId, label: groupId, joinMode: 'open', memberVisibility: 'session', ...(removalAuth ? { removalAuth } : {}) },
			actorPrincipal: actor,
		});
		assert.equal(created.ok, true);
		assert.equal((await memberRoute('/groups/join', groupId)).status, 200);
	}
	const expected = { kept: 'admin_only', owned: 'member_only', unset: 'both' };
	const reported = (response) => Object.fromEntries(response.body.groups.map((group) => [group.groupId, group.removalAuth]));
	const memberList = await workerGroupsRoute({
		path: '/groups/list',
		method: 'GET',
		request: new Request('https://worker.example/groups/list'),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json },
	});
	assert.deepEqual(reported(memberList), expected);
	const publicList = await dispatchPublicWorkerGroupListRequest({
		request: new Request(`https://worker.example/groups/list?sessionId=${sessionId}`),
		config: publicWorkerGroupConfig(),
		env,
		slug: 'session-a',
		baseHeaders: {},
		deps: { json },
	});
	assert.deepEqual(reported(publicList), expected);
	const adminList = await dispatchAdminWorkerGroupRequest({
		action: 'groups/list',
		env,
		slug: 'session-a',
		adminAddress: actor.address,
		headers: {},
		deps: { json },
	});
	assert.deepEqual(reported(adminList), expected);

	// Admins only: the member can't leave, and an admin can remove them.
	const keptLeave = await memberRoute('/groups/leave', 'kept');
	assert.equal(keptLeave.status, 403);
	assert.equal(keptLeave.body.reason, 'worker_group_leave_denied');
	assert.equal((await adminRemove('kept')).status, 200);
	// The member only: an admin can't remove them, and they can leave.
	const ownedRemoval = await adminRemove('owned');
	assert.equal(ownedRemoval.status, 403);
	assert.equal(ownedRemoval.body.reason, 'worker_group_removal_denied');
	assert.equal((await memberRoute('/groups/leave', 'owned')).status, 200);
	// No setting acts as both.
	assert.equal((await memberRoute('/groups/leave', 'unset')).status, 200);
	const memberships = await listWorkerGroupMemberships({ env, slug: 'session-a', sessionId, principal: member });
	assert.deepEqual(memberships.memberships, []);
});

test('the KV removal checks the setting on a fresh request and finishes a replay the coordinator allowed', async () => {
	const kv = createMockKv();
	const env = { CE_WORKER_GROUPS_KV: kv };
	await createWorkerGroup({
		env,
		slug: 'session-a',
		input: { groupId: 'kept', label: 'Kept', joinMode: 'admin_add', memberVisibility: 'members', removalAuth: 'admin_only' },
		actorPrincipal: actor,
	});
	const leave = { env, slug: 'session-a', operation: 'remove-member', groupId: 'kept', principal: member, actorPrincipal: member, remover: 'member' };
	// Only a member learns the setting from a refusal.
	assert.equal((await executeWorkerGroupMutation(leave)).reason, 'worker_group_member_not_found');
	await addWorkerGroupMember({ env, slug: 'session-a', groupId: 'kept', principal: member, actorPrincipal: actor });
	assert.equal((await executeWorkerGroupMutation(leave)).reason, 'worker_group_leave_denied');
	// Without a remover, a fresh removal is refused.
	assert.equal((await executeWorkerGroupMutation({ ...leave, remover: undefined })).reason, 'worker_group_removal_denied');
	const memberRecord = [...kv.store.keys()].find((key) => key.startsWith('ce-worker-group-member:session-a:') && key.includes(':kept:'));
	assert.doesNotMatch(kv.store.get(memberRecord), /"removedAt"/);
	assert.equal((await executeWorkerGroupMutation({ ...leave, resume: true })).ok, true);
	assert.match(kv.store.get(memberRecord), /"removedAt"/);
});

test('a busy join answers with the text clients wait on and send again; a refusal does not', async () => {
	const env = installCoordinatorBinding({ CE_WORKER_GROUPS_KV: createMockKv() });
	const join = (result) => workerGroupsRoute({
		path: '/groups/join',
		method: 'POST',
		request: new Request('https://worker.example/groups/join', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ groupId: 'open-review' }),
		}),
		env,
		slug: 'session-a',
		requesterAddress: member.address,
		baseHeaders: {},
		deps: { json, executeCoordinatedWorkerGroupMutation: async () => result },
	});
	const busy = await join({ ok: false, status: 503, reason: 'worker_group_coordination_unavailable' });
	assert.equal(busy.status, 503);
	assert.deepEqual(busy.body, { error: SESSION_COORDINATOR_UNAVAILABLE, reason: 'worker_group_coordination_unavailable' });
	assert.equal(busy.headers.get('Retry-After'), '1');
	const stuck = await join({ ok: false, status: 503, reason: 'worker_group_capacity_reconciliation_required' });
	assert.equal(stuck.body.error, 'Worker group request failed.');
	const refused = await join({ ok: false, status: 403, reason: 'worker_group_join_denied' });
	assert.equal(refused.status, 403);
	assert.equal(refused.body.error, 'Worker group request failed.');
});
