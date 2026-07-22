import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkCoordinatedAuthRateLimit,
  consumeCoordinatedAuthNonce,
  issueCoordinatedAuthNonce,
  SessionWriteCoordinator,
  executeCoordinatedSponsoredDeploy,
} from './sessionWriteCoordinator.js';
import { getSessionConfig } from './sessionConfigSecretsStore.js';
import { normalizeWorkerSessionSlug } from './sessionSlugResolution.js';

const createTransactionalState = () => {
  const store = new Map();
  let tail = Promise.resolve();
  const transaction = (callback) => {
    const run = tail.then(async () => {
      const staged = new Map([...store].map(([key, value]) => (
        [key, structuredClone(value)]
      )));
      const result = await callback({
        get: async (key) => staged.get(key),
        put: async (key, value) => staged.set(key, structuredClone(value)),
        delete: async (key) => staged.delete(key),
      });
      store.clear();
      for (const [key, value] of staged) store.set(key, value);
      return result;
    });
    tail = run.catch(() => undefined);
    return run;
  };
  return {
    state: {
      storage: {
        transaction,
        get: async (key) => store.get(key),
        put: async (key, value) => store.set(key, structuredClone(value)),
        delete: async (key) => store.delete(key),
      },
    },
    store,
  };
};

const createRequest = ({ requestDigest, deployBody = {}, sensitiveValues = [] } = {}) =>
	new Request('https://session-coordinator.internal/sponsored-deploy', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			requestDigest,
			deployBody,
			requestOrigin: 'https://allowed.example.test',
			sensitiveValues,
		}),
	});

const readResponse = async (response) => ({
	status: response.status,
	body: await response.json(),
});

const createCoordinatorRequest = (path, payload) =>
	new Request(`https://session-coordinator.internal${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...(path.startsWith('/worker-groups/') ? { sessionId: workerSessionId } : {}),
			...payload,
		}),
	});

const createWrappedCandidate = (suffix, {
  slug = 'session-a',
  createdAt = '2026-07-15T12:00:00.000Z',
} = {}) => ({
  version: 1,
  keyProvider: 'worker_secret',
  keyId: `session:${slug}:${createdAt}`,
  createdAt,
  alg: 'AES-256-GCM',
  wrapAlg: 'AES-GCM-KW-v1',
  iv: suffix.repeat(16).slice(0, 16),
  wrappedKey: suffix.repeat(64).slice(0, 64),
});

test('SessionWriteCoordinator consumes one issued auth nonce exactly once under concurrency', async () => {
  const { state, store } = createTransactionalState();
  const coordinator = new SessionWriteCoordinator(state, {}, { now: () => 1_000 });
  const issue = await coordinator.fetch(createCoordinatorRequest('/auth-state/nonce/issue', {
    slug: 'session-a',
    address: '0xabc',
    nonce: 'nonce-1',
    expiresAtMs: 301_000,
    usedExpiresAtMs: 601_000,
  }));
  assert.equal(issue.status, 200);

  const consume = () => coordinator.fetch(createCoordinatorRequest('/auth-state/nonce/consume', {
    slug: 'session-a',
    address: '0xabc',
    nonce: 'nonce-1',
    usedExpiresAtMs: 601_000,
  }));
  const responses = await Promise.all([consume(), consume()]);
  const bodies = await Promise.all(responses.map((response) => response.json()));

  assert.deepEqual(bodies.map((body) => body.ok).sort(), [false, true]);
  assert.deepEqual(
    bodies.map((body) => body.error || '').sort(),
    ['', 'Nonce already used.'],
  );
  assert.doesNotMatch(JSON.stringify([...store.values()]), /session-a|0xabc/i);
});

test('SessionWriteCoordinator admits exactly the configured number of concurrent rate checks', async () => {
  const { state, store } = createTransactionalState();
  const coordinator = new SessionWriteCoordinator(state, {}, { now: () => 1_000 });
  const check = () => coordinator.fetch(createCoordinatorRequest('/auth-state/rate/check', {
    slug: 'session-a',
    route: 'ai',
    identity: '0xabc',
    limit: 5,
    resetAtMs: 86_401_000,
  }));
  const responses = await Promise.all(Array.from({ length: 10 }, check));
  const bodies = await Promise.all(responses.map((response) => response.json()));

  assert.equal(bodies.filter((body) => body.allowed === true).length, 5);
  assert.equal(bodies.filter((body) => body.allowed === false).length, 5);
  assert.deepEqual(bodies.map((body) => body.count).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.doesNotMatch(JSON.stringify([...store.values()]), /session-a|0xabc|ai/i);
});

test('auth-state coordination clients fail closed without the Durable Object binding', async () => {
  assert.deepEqual(await issueCoordinatedAuthNonce({
    env: {}, slug: 'session-a', address: '0xabc', nonce: 'nonce-1', ttlSeconds: 300,
  }), {
    ok: false,
    status: 503,
    error: 'Authorization state coordination is unavailable.',
  });
  assert.deepEqual(await consumeCoordinatedAuthNonce({
    env: {}, slug: 'session-a', address: '0xabc', nonce: 'nonce-1', usedNonceTtlSeconds: 600,
  }), {
    ok: false,
    status: 503,
    error: 'Authorization state coordination is unavailable.',
  });
  assert.deepEqual(await checkCoordinatedAuthRateLimit({
    env: {}, slug: 'session-a', route: 'ai', identity: '0xabc', limit: 1, windowMs: 60_000,
  }), {
    ok: false,
    status: 503,
    error: 'Authorization state coordination is unavailable.',
  });
});

const createSessionConfigRequest = ({
  path,
  candidateRecord,
  mutation,
  slug = 'session-a',
  baseConfig,
} = {}) => (
  createCoordinatorRequest(path, {
    slug,
    baseConfig: baseConfig || {
      slug,
      adminAddress: '0x0000000000000000000000000000000000000abc',
      storageProfile: {
        backend: 'cloudflare',
        payloadAccessControl: { encryption: 'worker_envelope' },
      },
    },
    ...(candidateRecord ? { candidateRecord } : {}),
    ...(mutation ? { mutation } : {}),
  })
);

test('SessionWriteCoordinator atomically chooses and projects one wrapped session-key candidate', async () => {
	const { state, store } = createTransactionalState();
	await assert.rejects(
		state.storage.transaction(async (transaction) => {
			await transaction.put('rollback-sentinel', { shouldPersist: false });
			throw new Error('rollback');
		}),
		/rollback/,
	);
	assert.equal(store.has('rollback-sentinel'), false);
	const projections = [];
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			putSessionConfig: async (_env, _slug, config) => {
				projections.push(config);
			},
		},
	);
	const candidates = [createWrappedCandidate('A'), createWrappedCandidate('B')];

	const responses = await Promise.all(
		candidates.map((candidateRecord) =>
			coordinator.fetch(
				createSessionConfigRequest({
					path: '/session-config/storage-envelope-key/get-or-create',
					candidateRecord,
				}),
			),
		),
	);
	const bodies = await Promise.all(responses.map((response) => response.json()));

	assert.deepEqual(
		responses.map((response) => response.status),
		[200, 200],
	);
	assert.equal(new Set(bodies.map((body) => body.sessionKey.wrappedKey)).size, 1);
	assert.equal(projections.length, 1);
	assert.equal(projections[0].storageEnvelope.sessionKey.wrappedKey, bodies[0].sessionKey.wrappedKey);
	const serialized = JSON.stringify([...store.values()]);
	assert.match(serialized, new RegExp(bodies[0].sessionKey.wrappedKey));
	assert.doesNotMatch(serialized, /raw-session-key|deployment-kek|plaintext-payload|raw-dek|requestBody|credentials/i);
});

test('SessionWriteCoordinator rejects candidate records with raw key material', async () => {
	const { state, store } = createTransactionalState();
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			putSessionConfig: async () => undefined,
		},
	);
	const response = await coordinator.fetch(
		createSessionConfigRequest({
			path: '/session-config/storage-envelope-key/get-or-create',
			candidateRecord: {
				...createWrappedCandidate('C'),
				rawKey: 'raw-session-key-sentinel',
			},
		}),
	);
	const invalidBaseResponse = await coordinator.fetch(
		createCoordinatorRequest('/session-config/storage-envelope-key/get-or-create', {
			slug: 'session-a',
			baseConfig: null,
			candidateRecord: createWrappedCandidate('C'),
		}),
	);

	assert.equal(response.status, 400);
	assert.equal(invalidBaseResponse.status, 400);
	assert.equal(store.size, 0);
	assert.doesNotMatch(JSON.stringify([...store.values()]), /raw-session-key-sentinel/);
});

test('SessionWriteCoordinator projects the reserved tenant to the KV key used by readers', async () => {
  const { state } = createTransactionalState();
  const kvStore = new Map();
  const env = {
    GROUP_KV: {
      get: async (key) => kvStore.get(key) || null,
      put: async (key, value) => { kvStore.set(key, value); },
    },
  };
  const coordinator = new SessionWriteCoordinator(state, env);
  const baseConfig = {
    slug: 'general',
    adminAddress: '0x0000000000000000000000000000000000000abc',
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { encryption: 'worker_envelope' },
    },
  };
  const keyResponse = await coordinator.fetch(createSessionConfigRequest({
    path: '/session-config/storage-envelope-key/get-or-create',
    slug: 'general',
    baseConfig,
    candidateRecord: createWrappedCandidate('G', { slug: 'general' }),
  }));
  const mutationResponse = await coordinator.fetch(createSessionConfigRequest({
    path: '/session-config/mutate',
    slug: 'general',
    baseConfig,
    mutation: { kind: 'set-limits', incomingLimits: { perIpPerHour: 8 } },
  }));

  assert.equal(keyResponse.status, 200);
  assert.equal(mutationResponse.status, 200);
  assert.deepEqual([...kvStore.keys()].sort(), ['session::config']);
  assert.equal(kvStore.has('session:general:config'), false);
  const readable = await getSessionConfig(env, normalizeWorkerSessionSlug('general'));
  assert.equal(readable.limits.perIpPerHour, 8);
  assert.equal(
    readable.storageEnvelope.sessionKey.wrappedKey,
    createWrappedCandidate('G', { slug: 'general' }).wrappedKey,
  );
});

test('SessionWriteCoordinator preserves unchanged minimal legacy keys across config mutations', async () => {
  const legacySessionKey = {
    iv: 'legacy-iv-value1',
    wrappedKey: 'L'.repeat(64),
  };
  const cases = [
    {
      name: 'set-config',
      mutation: { kind: 'set-config', incomingConfig: { sessionName: 'Legacy session' } },
      readValue: (config) => config.sessionName,
      expected: 'Legacy session',
    },
    {
      name: 'set-limits',
      mutation: { kind: 'set-limits', incomingLimits: { perIpPerHour: 9 } },
      readValue: (config) => config.limits?.perIpPerHour,
      expected: 9,
    },
    {
      name: 'merge-lit-credentials',
      mutation: {
        kind: 'merge-lit-credentials',
        litCredentials: { litActionCid: 'bafy-legacy-action' },
      },
      readValue: (config) => config.litCredentials?.litActionCid,
      expected: 'bafy-legacy-action',
    },
  ];

  for (const testCase of cases) {
    const { state } = createTransactionalState();
    const projections = [];
    const coordinator = new SessionWriteCoordinator(state, {}, {
      putSessionConfig: async (_env, _slug, config) => { projections.push(config); },
    });
    const response = await coordinator.fetch(createSessionConfigRequest({
      path: '/session-config/mutate',
      baseConfig: {
        slug: 'session-a',
        adminAddress: '0x0000000000000000000000000000000000000abc',
        storageEnvelope: { sessionKey: legacySessionKey },
      },
      mutation: testCase.mutation,
    }));

    assert.equal(response.status, 200, testCase.name);
    assert.equal(projections.length, 1, testCase.name);
    assert.deepEqual(projections[0].storageEnvelope.sessionKey, legacySessionKey, testCase.name);
    assert.equal(testCase.readValue(projections[0]), testCase.expected, testCase.name);
  }
});

test('SessionWriteCoordinator rejects generic mutation of uncoordinated session keys', async () => {
  const legacySessionKey = {
    iv: 'legacy-iv-value1',
    wrappedKey: 'L'.repeat(64),
  };
  const changedLegacySessionKey = {
    iv: 'legacy-iv-value2',
    wrappedKey: 'M'.repeat(64),
  };
  const cases = [
    {
      name: 'introduction',
      baseConfig: { slug: 'session-a' },
      incomingStorageEnvelope: { sessionKey: legacySessionKey },
    },
    {
      name: 'change',
      baseConfig: { slug: 'session-a', storageEnvelope: { sessionKey: legacySessionKey } },
      incomingStorageEnvelope: { sessionKey: changedLegacySessionKey },
    },
    {
      name: 'removal',
      baseConfig: { slug: 'session-a', storageEnvelope: { sessionKey: legacySessionKey } },
      incomingStorageEnvelope: {},
    },
  ];

  for (const testCase of cases) {
    const { state, store } = createTransactionalState();
    const projections = [];
    const coordinator = new SessionWriteCoordinator(state, {}, {
      putSessionConfig: async (_env, _slug, config) => { projections.push(config); },
    });
    const response = await coordinator.fetch(createSessionConfigRequest({
      path: '/session-config/mutate',
      baseConfig: testCase.baseConfig,
      mutation: {
        kind: 'set-config',
        incomingConfig: { storageEnvelope: testCase.incomingStorageEnvelope },
      },
    }));

    assert.equal(response.status, 409, testCase.name);
    assert.equal(projections.length, 0, testCase.name);
    assert.equal(store.size, 0, testCase.name);
  }
});

test('SessionWriteCoordinator repairs a pending key projection after restart without adopting a new candidate', async () => {
	const { state, store } = createTransactionalState();
	const firstCandidate = createWrappedCandidate('D');
	const secondCandidate = createWrappedCandidate('E');
	const interrupted = new SessionWriteCoordinator(
		state,
		{},
		{
			putSessionConfig: async () => {
				throw new Error('projection interrupted');
			},
		},
	);
	const firstResponse = await interrupted.fetch(
		createSessionConfigRequest({
			path: '/session-config/storage-envelope-key/get-or-create',
			candidateRecord: firstCandidate,
		}),
	);
	assert.equal(firstResponse.status, 503);

	const projections = [];
	const restarted = new SessionWriteCoordinator(
		state,
		{},
		{
			putSessionConfig: async (_env, _slug, config) => {
				projections.push(config);
			},
		},
	);
	const retryResponse = await restarted.fetch(
		createSessionConfigRequest({
			path: '/session-config/storage-envelope-key/get-or-create',
			candidateRecord: secondCandidate,
		}),
	);
	const retryBody = await retryResponse.json();

	assert.equal(retryResponse.status, 200);
	assert.equal(retryBody.sessionKey.wrappedKey, firstCandidate.wrappedKey);
	assert.equal(projections.length, 1);
	assert.equal(projections[0].storageEnvelope.sessionKey.wrappedKey, firstCandidate.wrappedKey);
	assert.equal([...store.values()][0].projectionPending, false);
});

test('SessionWriteCoordinator applies stale admin mutations to the authoritative key projection', async () => {
	const { state } = createTransactionalState();
	const projections = [];
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			putSessionConfig: async (_env, _slug, config) => {
				projections.push(config);
			},
		},
	);
	const candidate = createWrappedCandidate('F');
	await coordinator.fetch(
		createSessionConfigRequest({
			path: '/session-config/storage-envelope-key/get-or-create',
			candidateRecord: candidate,
		}),
	);
	const mutationResponse = await coordinator.fetch(
		createSessionConfigRequest({
			path: '/session-config/mutate',
			mutation: { kind: 'set-limits', incomingLimits: { perIpPerHour: 8 } },
		}),
	);

  assert.equal(mutationResponse.status, 200);
  assert.equal(projections.length, 2);
  assert.equal(projections[1].limits.perIpPerHour, 8);
  assert.equal(projections[1].storageEnvelope.sessionKey.wrappedKey, candidate.wrappedKey);
});

test('SessionWriteCoordinator chooses one payload before concurrent sponsored deploy mutation', async () => {
	const { state, store } = createTransactionalState();
	let releaseFirst;
	const firstCanFinish = new Promise((resolve) => {
		releaseFirst = resolve;
	});
	const calls = [];
	const coordinator = new SessionWriteCoordinator(
		state,
		{ GROUP_KV: {} },
		{
			now: () => 1_000,
			crypto: { randomUUID: () => 'attempt-1' },
			executeDeployHelperRequest: async (request) => {
				calls.push(request);
				await firstCanFinish;
				return {
					ok: true,
					status: 200,
					body: { ok: true, workerUrl: 'https://winner.example.test' },
				};
			},
		},
	);

	const first = coordinator.fetch(
		createRequest({
			requestDigest: 'digest-a',
			deployBody: { apiToken: 'cf-sponsor-secret', secrets: { openaiKey: 'sk-provider-secret' } },
			sensitiveValues: ['cf-sponsor-secret', 'sk-provider-secret'],
		}),
	);
	while (calls.length === 0) await Promise.resolve();

	const changed = await readResponse(
		await coordinator.fetch(
			createRequest({
				requestDigest: 'digest-b',
				deployBody: { apiToken: 'cf-other', sessionSlug: 'changed' },
			}),
		),
	);
	assert.equal(changed.status, 409);
	assert.equal(changed.body.body.sponsoredGrantPayloadConflict, true);
	assert.equal(calls.length, 1);

	releaseFirst();
	const winner = await readResponse(await first);
	assert.equal(winner.status, 200);
	assert.equal(winner.body.body.workerUrl, 'https://winner.example.test');
	assert.equal(calls.length, 1);
	assert.doesNotMatch(JSON.stringify([...store.values()]), /cf-sponsor-secret|sk-provider-secret/);
});

test('SessionWriteCoordinator returns pending for a concurrent identical payload and replays terminal success', async () => {
	const { state } = createTransactionalState();
	let releaseFirst;
	const firstCanFinish = new Promise((resolve) => {
		releaseFirst = resolve;
	});
	let calls = 0;
	let nowMs = 2_000;
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			now: () => nowMs,
			crypto: { randomUUID: () => 'attempt-2' },
			executeDeployHelperRequest: async () => {
				calls += 1;
				await firstCanFinish;
				return { ok: true, status: 200, body: { ok: true, workerName: 'worker-a' } };
			},
		},
	);

	const first = coordinator.fetch(createRequest({ requestDigest: 'same-digest' }));
	while (calls === 0) await Promise.resolve();
	// Even after the durable crash-recovery lease ages out, the live object must
	// not start a second helper while its original outbound request is active.
	nowMs += 70_000;
	const pending = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'same-digest' })));
	assert.equal(pending.status, 503);
	assert.equal(pending.body.body.deploymentRequestPending, true);
	assert.equal(calls, 1);

	releaseFirst();
	await first;
	const replay = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'same-digest' })));
	assert.equal(replay.status, 200);
	assert.equal(replay.body.body.workerName, 'worker-a');
	assert.equal(calls, 1);
});

test('SessionWriteCoordinator allows one same-digest retry after a retryable helper result', async () => {
	const { state } = createTransactionalState();
	let calls = 0;
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			now: () => 3_000 + calls,
			crypto: { randomUUID: () => `attempt-${calls + 3}` },
			executeDeployHelperRequest: async () => {
				calls += 1;
				return calls === 1
					? {
							ok: false,
							status: 503,
							body: { error: 'Retry this deployment.', deploymentRequestPending: true },
						}
					: { ok: true, status: 200, body: { ok: true, workerName: 'recovered-worker' } };
			},
		},
	);

	const first = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'retry-digest' })));
	assert.equal(first.status, 503);
	const second = await readResponse(await coordinator.fetch(createRequest({ requestDigest: 'retry-digest' })));
	assert.equal(second.status, 200);
	assert.equal(second.body.body.workerName, 'recovered-worker');
	assert.equal(calls, 2);
});

test('SessionWriteCoordinator preserves safe retry recovery metadata for the caller', async () => {
	const { state, store } = createTransactionalState();
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			now: () => 4_000,
			crypto: { randomUUID: () => 'attempt-recovery' },
			executeDeployHelperRequest: async () => ({
				ok: false,
				status: 503,
				body: {
					error: 'Upload is pending for cf-sensitive-value.',
					deploymentRequestPending: true,
					orphanResources: {
						kvNamespaceId: 'kv-recover-1',
						kvCleanupStatus: 'retained-upload-pending',
						workerName: 'worker-recover-1',
					},
					bundleDiagnostics: {
						source: 'bundleUrl',
						length: 123,
						sha256: 'a'.repeat(64),
						hasExportDefault: true,
					},
				},
			}),
		},
	);

	const response = await readResponse(
		await coordinator.fetch(
			createRequest({
				requestDigest: 'recovery-digest',
				deployBody: { apiToken: 'cf-sensitive-value' },
				sensitiveValues: ['cf-sensitive-value'],
			}),
		),
	);
	assert.equal(response.status, 503);
	assert.equal(response.body.body.error, 'Upload is pending for [REDACTED].');
	assert.deepEqual(response.body.body.orphanResources, {
		kvNamespaceId: 'kv-recover-1',
		kvCleanupStatus: 'retained-upload-pending',
		workerName: 'worker-recover-1',
	});
	assert.deepEqual(response.body.body.bundleDiagnostics, {
		source: 'bundleUrl',
		length: 123,
		sha256: 'a'.repeat(64),
		hasExportDefault: true,
	});
	assert.doesNotMatch(JSON.stringify([...store.values()]), /cf-sensitive-value/);
});

test('executeCoordinatedSponsoredDeploy fails closed without a Durable Object binding', async () => {
	const result = await executeCoordinatedSponsoredDeploy({
		env: { GROUP_KV: {} },
		grantToken: 'grant-a',
		requestDigest: 'digest-a',
		deployBody: { apiToken: 'must-not-run' },
	});
	assert.equal(result.status, 503);
	assert.equal(result.body.deploymentRequestPending, true);
	assert.match(result.body.error, /no Cloudflare action was attempted/i);
});

test('executeCoordinatedSponsoredDeploy routes one grant identity to its coordinator object', async () => {
	const calls = [];
	const result = await executeCoordinatedSponsoredDeploy({
		env: {
			CE_SESSION_COORDINATOR: {
				idFromName: (name) => {
					calls.push(['idFromName', name]);
					return `id:${name}`;
				},
				get: (id) => ({
					fetch: async (url, init) => {
						calls.push(['fetch', id, url, init]);
						return new Response(
							JSON.stringify({
								ok: true,
								status: 200,
								body: { ok: true, workerName: 'coordinated-worker' },
							}),
							{ status: 200, headers: { 'Content-Type': 'application/json' } },
						);
					},
				}),
			},
		},
		grantToken: 'grant-stable-id',
		requestDigest: 'digest-stable-id',
		deployBody: { apiToken: 'cf-transient-secret' },
		sensitiveValues: ['cf-transient-secret'],
	});

	assert.equal(calls[0][0], 'idFromName');
	assert.match(calls[0][1], /^[0-9a-f]{64}$/);
	assert.equal(calls[1][0], 'fetch');
	assert.equal(calls[1][1], `id:${calls[0][1]}`);
	assert.equal(calls[1][2], 'https://session-coordinator.internal/sponsored-deploy');
	assert.equal(JSON.parse(calls[1][3].body).deployBody.apiToken, 'cf-transient-secret');
	assert.deepEqual(result, {
		ok: true,
		status: 200,
		body: { ok: true, workerName: 'coordinated-worker' },
	});
});

test('SessionWriteCoordinator reserves one faucet transfer and durably replays its safe terminal receipt', async () => {
	const { state, store } = createTransactionalState();
	const coordinator = new SessionWriteCoordinator(state, {});
	const reserve = () =>
		coordinator.fetch(
			createCoordinatorRequest('/sponsored-faucet/reserve', {
				requestDigest: 'faucet-digest',
			}),
		);
	const [first, second] = await Promise.all([reserve(), reserve()]);
	const firstBody = await first.json();
	const secondBody = await second.json();
	assert.deepEqual(new Set([firstBody.kind, secondBody.kind]), new Set(['execute', 'pending']));

	const finalized = await coordinator.fetch(
		createCoordinatorRequest('/sponsored-faucet/finalize', {
			requestDigest: 'faucet-digest',
			receipt: {
				status: 200,
				body: { txHash: `0x${'12'.repeat(32)}`, privateKey: 'must-not-persist' },
			},
		}),
	);
	assert.equal(finalized.status, 200);
	const replay = await reserve();
	const replayBody = await replay.json();
	assert.equal(replayBody.kind, 'terminal');
	assert.equal(replayBody.receipt.body.txHash, `0x${'12'.repeat(32)}`);
	assert.doesNotMatch(JSON.stringify([...store.values()]), /must-not-persist|privateKey/);
});

test('SessionWriteCoordinator binds direct deployment recovery to account and immutable identity', async () => {
	const { state, store } = createTransactionalState();
	let release;
	const canFinish = new Promise((resolve) => {
		release = resolve;
	});
	let deployCalls = 0;
	let nowMs = 30_000;
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			now: () => nowMs,
			lookupCloudflareAccount: async ({ apiToken }) => ({
				ok: true,
				accountId: apiToken === 'token-other-account' ? 'account-b' : 'account-a',
			}),
			executeDeployHelperRequest: async () => {
				deployCalls += 1;
				await canFinish;
				return {
					ok: true,
					status: 200,
					body: {
						ok: true,
						workerName: 'worker-a',
						configVerified: true,
						writesSessionConfig: true,
						writesSessionSecrets: true,
					},
				};
			},
			crypto: { randomUUID: () => 'direct-attempt' },
		},
	);
	const payload = {
		requestDigest: 'full-digest-a',
		immutableIdentityDigest: 'immutable-digest-a',
		deployBody: { apiToken: 'token-a', deploymentRequestId: 'request-a' },
		sensitiveValues: ['token-a'],
	};
	const firstPromise = coordinator.fetch(createCoordinatorRequest('/deploy-helper', payload));
	// Direct coordination hashes its stable identity before invoking the helper.
	// Yield a full event-loop turn so Web Crypto can settle; a microtask-only
	// spin would starve the digest callback and make this concurrency probe hang.
	while (deployCalls === 0) await new Promise((resolve) => setImmediate(resolve));
	nowMs += 70_000;
	const pending = await coordinator.fetch(createCoordinatorRequest('/deploy-helper', payload));
	assert.equal(pending.status, 503);
	assert.equal(deployCalls, 1);
	release();
	assert.equal((await firstPromise).status, 200);

	const exactReplay = await readResponse(await coordinator.fetch(createCoordinatorRequest('/deploy-helper', payload)));
	assert.equal(exactReplay.status, 200);
	assert.equal(exactReplay.body.body.configVerified, true);
	assert.equal(exactReplay.body.body.writesSessionConfig, true);
	assert.equal(exactReplay.body.body.writesSessionSecrets, true);
	assert.equal(exactReplay.body.body.partial, undefined);

	const mutableReplay = await coordinator.fetch(
		createCoordinatorRequest('/deploy-helper', {
			...payload,
			requestDigest: 'full-digest-config-drift',
			deployBody: { ...payload.deployBody, apiToken: 'rotated-token', sessionName: 'Updated' },
			sensitiveValues: ['rotated-token'],
		}),
	);
	const mutableReplayResult = await readResponse(mutableReplay);
	assert.equal(mutableReplayResult.status, 200);
	assert.equal(mutableReplayResult.body.body.partial, true);
	assert.equal(mutableReplayResult.body.body.configVerified, false);
	assert.equal(mutableReplayResult.body.body.writesSessionConfig, false);
	assert.equal(mutableReplayResult.body.body.writesSessionSecrets, false);
	assert.equal(deployCalls, 1);

	const identityConflict = await readResponse(
		await coordinator.fetch(
			createCoordinatorRequest('/deploy-helper', {
				...payload,
				immutableIdentityDigest: 'immutable-digest-b',
			}),
		),
	);
	assert.equal(identityConflict.status, 409);
	assert.equal(identityConflict.body.body.deploymentRequestTerminal, true);
	const accountConflict = await readResponse(
		await coordinator.fetch(
			createCoordinatorRequest('/deploy-helper', {
				...payload,
				deployBody: { ...payload.deployBody, apiToken: 'token-other-account' },
				sensitiveValues: ['token-other-account'],
			}),
		),
	);
	assert.equal(accountConflict.status, 409);
	assert.equal(accountConflict.body.body.deploymentRequestTerminal, true);
	assert.equal(deployCalls, 1);
	assert.doesNotMatch(JSON.stringify([...store.values()]), /token-a|rotated-token|token-other-account|deployBody/);
});

test('SessionWriteCoordinator recovers an expired direct-deploy lease after an object crash', async () => {
	const { state, store } = createTransactionalState();
	store.set('direct-deploy', {
		version: 1,
		state: 'running',
		requestDigest: 'pre-crash-digest',
		immutableIdentityDigest: 'immutable-digest-a',
		accountId: 'account-a',
		attemptId: 'crashed-attempt',
		startedAtMs: 1_000,
	});
	let deployCalls = 0;
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			now: () => 70_000,
			crypto: { randomUUID: () => 'recovery-attempt' },
			lookupCloudflareAccount: async () => ({ ok: true, accountId: 'account-a' }),
			executeDeployHelperRequest: async () => {
				deployCalls += 1;
				return { ok: true, status: 200, body: { ok: true, workerName: 'reconciled-worker' } };
			},
		},
	);

	const recovered = await coordinator.fetch(
		createCoordinatorRequest('/deploy-helper', {
			requestDigest: 'post-crash-digest',
			immutableIdentityDigest: 'immutable-digest-a',
			deployBody: { apiToken: 'rotated-after-crash', deploymentRequestId: 'request-a' },
			sensitiveValues: ['rotated-after-crash'],
		}),
	);
	assert.equal(recovered.status, 200);
	assert.equal(deployCalls, 1);
	assert.equal(store.get('direct-deploy').state, 'terminal');
	assert.equal(store.get('direct-deploy').requestDigest, 'post-crash-digest');
	assert.doesNotMatch(JSON.stringify([...store.values()]), /rotated-after-crash/);
});

test('SessionWriteCoordinator retries retryable direct deployment after mutable payload drift', async () => {
	const { state, store } = createTransactionalState();
	let deployCalls = 0;
	const coordinatedRequestDigests = [];
	const coordinator = new SessionWriteCoordinator(
		state,
		{},
		{
			now: () => 80_000 + deployCalls,
			crypto: { randomUUID: () => `retry-attempt-${deployCalls + 1}` },
			lookupCloudflareAccount: async () => ({ ok: true, accountId: 'account-a' }),
			executeDeployHelperRequest: async ({ coordinatedRequestDigest }) => {
				coordinatedRequestDigests.push(coordinatedRequestDigest);
				deployCalls += 1;
				return deployCalls === 1
					? {
							ok: false,
							status: 503,
							body: { error: 'Propagation pending.', deploymentRequestPending: true },
							fallbackEligible: true,
						}
					: { ok: true, status: 200, body: { ok: true, workerName: 'recovered-worker' } };
			},
		},
	);
	const basePayload = {
		requestDigest: 'full-digest-before-drift',
		immutableIdentityDigest: 'immutable-digest-a',
		deployBody: { apiToken: 'token-before-drift', deploymentRequestId: 'request-a' },
		sensitiveValues: ['token-before-drift'],
	};

	const first = await coordinator.fetch(createCoordinatorRequest('/deploy-helper', basePayload));
	assert.equal(first.status, 503);
	const retry = await coordinator.fetch(
		createCoordinatorRequest('/deploy-helper', {
			...basePayload,
			requestDigest: 'full-digest-after-drift',
			deployBody: {
				...basePayload.deployBody,
				apiToken: 'token-after-drift',
				sessionName: 'Mutable recovery edit',
			},
			sensitiveValues: ['token-after-drift'],
		}),
	);
	assert.equal(retry.status, 200);
	assert.equal(deployCalls, 2);
	assert.equal(coordinatedRequestDigests.length, 2);
	assert.match(coordinatedRequestDigests[0], /^[0-9a-f]{64}$/);
	assert.equal(coordinatedRequestDigests[1], coordinatedRequestDigests[0]);
	assert.equal(store.get('direct-deploy').state, 'terminal');
	assert.doesNotMatch(JSON.stringify([...store.values()]), /token-before-drift|token-after-drift/);
});
