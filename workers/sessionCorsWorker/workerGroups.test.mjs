import test from 'node:test';
import assert from 'node:assert/strict';

import {
	addWorkerGroupMember as addWorkerGroupMemberBoundary,
	createWorkerGroup as createWorkerGroupBoundary,
	deleteWorkerGroup as deleteWorkerGroupBoundary,
	dispatchAdminWorkerGroupRequest as dispatchAdminWorkerGroupRequestBoundary,
	executeCoordinatedWorkerGroupMutation as executeCoordinatedWorkerGroupMutationBoundary,
	isWorkerGroupMember,
	listWorkerGroupMembers as listWorkerGroupMembersBoundary,
	listWorkerGroupMemberships as listWorkerGroupMembershipsBoundary,
	normalizeWorkerGroupId,
	normalizeWorkerGroupPrincipal,
	readWorkerGroupMembershipProjection as readWorkerGroupMembershipProjectionBoundary,
	removeWorkerGroupMember as removeWorkerGroupMemberBoundary,
	resolveWorkerGroupBootstrap,
	resolveWorkerGroupsKv,
	resolveWorkerGroupPrincipal,
	snapshotWorkerGroupCapacity as snapshotWorkerGroupCapacityBoundary,
	updateWorkerGroup as updateWorkerGroupBoundary,
	workerGroupsRoute as workerGroupsRouteBoundary,
} from './workerGroups.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';

const json = (body, status = 200, headers = {}) => ({ body, status, headers });
const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const replacementSessionId = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const workerCanonicalConfig = { sessionId };
const addWorkerGroupMember = (args = {}) => addWorkerGroupMemberBoundary({ sessionId, ...args });
const createWorkerGroup = (args = {}) => createWorkerGroupBoundary({ sessionId, ...args });
const deleteWorkerGroup = (args = {}) => deleteWorkerGroupBoundary({ sessionId, ...args });
const listWorkerGroupMembers = (args = {}) => listWorkerGroupMembersBoundary({ sessionId, ...args });
const listWorkerGroupMemberships = (args = {}) => listWorkerGroupMembershipsBoundary({ sessionId, ...args });
const readWorkerGroupMembershipProjection = (args = {}) => readWorkerGroupMembershipProjectionBoundary({ sessionId, ...args });
const removeWorkerGroupMember = (args = {}) => removeWorkerGroupMemberBoundary({ sessionId, ...args });
const snapshotWorkerGroupCapacity = (args = {}) => snapshotWorkerGroupCapacityBoundary({ sessionId, ...args });
const updateWorkerGroup = (args = {}) => updateWorkerGroupBoundary({ sessionId, ...args });
const executeCoordinatedWorkerGroupMutation = (args = {}) => executeCoordinatedWorkerGroupMutationBoundary({ sessionId, ...args });
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
		request: injectSessionId ? await requestWithSessionId(routeArgs.request, requestedSessionId) : routeArgs.request,
		config: routeArgs.config ?? workerCanonicalConfig,
	});
};
const dispatchAdminWorkerGroupRequest = (args = {}) =>
	dispatchAdminWorkerGroupRequestBoundary({
		...args,
		config: args.config ?? workerCanonicalConfig,
		body: {
			sessionId,
			...(args.body || {}),
		},
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

test('legacy case-folded membership keys require the exact stored integration principal', async () => {
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

	assert.equal(exact.ok, true);
	assert.equal(exact.member.principalKey, 'agent:Grant-A');
	assert.equal(collision.ok, false);
});

test('legacy slug-only projections migrate only for their exact canonical session identity', async () => {
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
		authScopes: {},
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
	assert.equal(exactProjection.ok, true);
	const migratedPrincipalIndexKey = [...kv.store.keys()].find(
		(key) => key.startsWith('ce-worker-group-principal:session-a:') && key !== legacyKeys.principalIndex && key.endsWith(`:${groupId}`),
	);
	assert.ok(migratedPrincipalIndexKey);
	kv.store.delete(migratedPrincipalIndexKey);

	const exactMemberships = await listWorkerGroupMemberships({
		env,
		slug: 'session-a',
		principal: member,
	});
	assert.deepEqual(
		exactMemberships.memberships.map((entry) => entry.group.groupId),
		[groupId],
	);
	assert.equal(
		[...kv.store.keys()].some(
			(key) => key.startsWith('ce-worker-group-principal:session-a:') && key !== legacyKeys.principalIndex && key.endsWith(`:${groupId}`),
		),
		true,
	);
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
		'https://user:password@example.test/group.png',
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
	assert.deepEqual(
		resolveWorkerGroupPrincipal({
			authScopes: { agentGrant: { grantId: 'grant:test-1' } },
		}).principal,
		{
			kind: 'agent',
			grantId: 'grant:test-1',
		},
	);
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
		authScopes: {},
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
		authScopes: {},
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
		authScopes: {},
		baseHeaders: {},
		deps: { json, now: () => Date.parse('2026-02-03T04:05:06.000Z') },
	});
	assert.equal(joinResponse.status, 200);
	assert.equal(joinResponse.body.sessionSlug, 'session-a');
	assert.equal(joinResponse.body.sessionId, sessionId);

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
	const request = () => new Request('https://worker.example/groups/create', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			group: {
				groupId: 'participant-chosen-id',
				label: 'Participant review',
				description: 'Open working group.',
				joinMode: 'admin_add',
				memberVisibility: 'admin_only',
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
		authScopes: { groups: true },
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
			authScopes: { groups: true },
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
		authScopes: { groups: true },
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
		authScopes: {},
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
		authScopes: {},
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
		authScopes: {},
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

	for (const path of ['/groups/list', '/groups/my-memberships']) {
		const response = await workerGroupsRoute({
			path,
			method: 'GET',
			request: new Request(`https://worker.example${path}`),
			env,
			slug: 'session-a',
			requesterAddress: member.address,
			authScopes: {},
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
		authScopes: {},
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
