import test from 'node:test';
import assert from 'node:assert/strict';

import {
  exportCloudflareEncryptedPayloadEnvelopes,
  storageRoute,
} from './storageRouteExecution.js';
import { dispatchAuthenticatedSecretPathRoute } from './authenticatedSecretPathRouteDispatch.js';
import { getSessionSecrets } from './sessionConfigSecretsStore.js';
import { writeStorageEnvelopeKeyReleaseAudit } from './storageEnvelopeEncryption.js';
import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';
import { resolveRpcUrlListForGate } from './gateRpcResolution.js';
import { createEthersInterfaceProviderGateHelpersWithWorkerDeps } from './ethersInterfaceProviderGateBinding.js';
import { PRIVATE_SESSION_RPC_LABEL } from './rpcDiagnosticSafety.js';
import {
  addWorkerGroupMember,
  createWorkerGroup,
  deleteWorkerGroup,
} from './workerGroups.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';

const TX_ID = 'abc123abc123abc123abc123abc123abc123abc1230';
const CF_ID = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA';
const CLOUDFLARE_WORKER_GATE_CONFIG = {
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: { mode: 'worker_sbt_gate' },
  },
  __registry: {
    gatesByResource: {
      docUploads: { sbtAddresses: [], chainId: 84532, mode: 0 },
      questionResponses: { sbtAddresses: [], chainId: 84532, mode: 0 },
      surveyResponses: { sbtAddresses: [], chainId: 84532, mode: 0 },
    },
  },
};

const fixedRandomBytes = () => Uint8Array.from({ length: 32 }, (_, index) => index + 1);

const fixedRandomBytes = () => Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const fixedGetRandomValues = (target) => {
	target.set(fixedRandomBytes());
	return target;
};
const shortRandomBytes = () => Uint8Array.from({ length: 31 }, (_, index) => index + 1);
const createSequenceRandomBytes = (initial = 1) => {
	let seed = initial;
	return (length) =>
		Uint8Array.from({ length }, () => {
			const value = seed % 251;
			seed += 1;
			return value;
		});
};
const createCryptoDecryptSpy = () => {
	const cryptoImpl = globalThis.crypto;
	let decryptCalls = 0;
	return {
		crypto: {
			getRandomValues: cryptoImpl.getRandomValues.bind(cryptoImpl),
			subtle: {
				digest: (...args) => cryptoImpl.subtle.digest(...args),
				importKey: (...args) => cryptoImpl.subtle.importKey(...args),
				encrypt: (...args) => cryptoImpl.subtle.encrypt(...args),
				decrypt: (...args) => {
					decryptCalls += 1;
					return cryptoImpl.subtle.decrypt(...args);
				},
			},
		},
		get decryptCalls() {
			return decryptCalls;
		},
	};
};

const json = (body, status = 200, headers = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { ...headers, 'Content-Type': 'application/json' },
	});

const readJson = async (response) => JSON.parse(await response.text());

const createMockR2 = () => {
	const store = new Map();
	return {
		store,
		async put(key, value, opts = {}) {
			const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
			store.set(key, {
				httpMetadata: opts.httpMetadata || {},
				customMetadata: opts.customMetadata || {},
				async arrayBuffer() {
					return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
				},
				async text() {
					return new TextDecoder().decode(bytes);
				},
			});
		},
		async get(key) {
			return store.get(key) || null;
		},
	};
};

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
		async list({ prefix = '' } = {}) {
			return { keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })) };
		},
	};
};

const attachSessionCoordinator = (env, setConfig) => {
	env.__testProjectSessionConfig = setConfig;
	if (env.CE_SESSION_COORDINATOR) return;
	const instances = new Map();
	env.CE_SESSION_COORDINATOR = {
		idFromName: (name) => `test-coordinator:${name}`,
		get: (id) => {
			if (!instances.has(id)) {
				const values = new Map();
				let tail = Promise.resolve();
				const storage = {
					get: async (key) => structuredClone(values.get(key)),
					transaction: (callback) => {
						const run = tail.then(async () => {
							const staged = new Map([...values].map(([key, value]) => [key, structuredClone(value)]));
							const result = await callback({
								get: async (key) => structuredClone(staged.get(key)),
								put: async (key, value) => {
									staged.set(key, structuredClone(value));
								},
							});
							values.clear();
							for (const [key, value] of staged) values.set(key, value);
							return result;
						});
						tail = run.catch(() => undefined);
						return run;
					},
				};
				const coordinator = new SessionWriteCoordinator({ storage }, env, {
					putSessionConfig: async (_env, _slug, nextConfig) => env.__testProjectSessionConfig(nextConfig),
				});
				instances.set(id, {
					fetch: (input, init) => coordinator.fetch(input instanceof Request ? input : new Request(input, init)),
				});
			}
			return instances.get(id);
		},
	};
};

const readStorageIndexMetadata = async (kv, slug, resource, id) => JSON.parse(await kv.get(`ce-storage:${slug}:${resource}:${id}`));

const writeStorageIndexMetadata = async (kv, slug, resource, metadata) => {
	await kv.put(`ce-storage:${slug}:${resource}:${metadata.id}`, JSON.stringify(metadata));
	const payloadKey = `ce-storage-payload:${slug}:${metadata.id}`;
	const payloadEnvelope = JSON.parse(await kv.get(payloadKey));
	if (payloadEnvelope?.metadata) {
		payloadEnvelope.metadata = metadata;
		await kv.put(payloadKey, JSON.stringify(payloadEnvelope));
	}
};

const createEnvelopeConfig = (overrides = {}) => ({
	storageProfile: {
		backend: 'cloudflare',
		payloadAccessControl: {
			gate: 'none',
			encryption: 'worker_envelope',
			...(overrides.payloadAccessControl || {}),
		},
	},
	adminAddress: '0x0000000000000000000000000000000000000abc',
	workerRoles: {
		reviewer: ['0x0000000000000000000000000000000000000def'],
	},
	...overrides.config,
});

const uploadEnvelopePayload = async ({
	env,
	config,
	setConfig,
	data = 'classified payload',
	resource = 'docsContext',
	uploaderAddress = '0x0000000000000000000000000000000000000abc',
	deps = {},
} = {}) => {
	attachSessionCoordinator(env, setConfig);
	const response = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data, contentType: 'text/plain', resource }),
		}),
		env,
		config,
		slug: 'session-a',
		uploaderAddress,
		baseHeaders: {},
		deps: {
			json,
			randomBytes: createSequenceRandomBytes(),
			now: () => Date.parse('2026-01-02T03:04:05.000Z'),
			...deps,
		},
	});
	return { response, body: await readJson(response) };
};

test('storageRoute delegates Arweave uploads and returns storageRef compatibility fields', async () => {
	const env = { marker: 'worker-env' };
	const request = new Request('https://worker.example/storage/upload', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: { ok: true }, contentType: 'application/json', resource: 'questions' }),
	});
	let uploadContext = null;

	const response = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request,
		env,
		config: { storageProfile: { backend: 'arweave' } },
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: { 'Access-Control-Allow-Origin': 'https://app.example' },
		deps: {
			json,
			getSessionSecrets: async (receivedEnv, receivedSlug) => {
				assert.equal(receivedEnv, env);
				assert.equal(receivedSlug, 'session-a');
				return { arweaveJwk: '{}' };
			},
			arweaveUpload: async (value) => {
				uploadContext = value;
				return json({ id: TX_ID });
			},
		},
	});

	assert.equal(uploadContext.slug, 'session-a');
	assert.equal(uploadContext.uploaderAddress, '0xabc');
	const body = await readJson(response);
	assert.equal(body.id, TX_ID);
	assert.equal(body.arweaveTxId, TX_ID);
	assert.deepEqual(body.storageRef, {
		backend: 'arweave',
		id: TX_ID,
		uri: `ar://${TX_ID}`,
		contentType: 'application/json',
		resource: 'questions',
	});
});

test('storageRoute returns lit-arweave storageRef for encrypted Arweave session storage', async () => {
	const env = { marker: 'worker-env' };
	const request = new Request('https://worker.example/storage/upload', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: { ok: true }, payloadEncrypted: true, resource: 'responses' }),
	});

	const response = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request,
		env,
		config: { storageProfile: { backend: 'lit-arweave' } },
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: {
			json,
			getSessionSecrets: async (receivedEnv, receivedSlug) => {
				assert.equal(receivedEnv, env);
				assert.equal(receivedSlug, 'session-a');
				return { arweaveJwk: '{}' };
			},
			arweaveUpload: async () => json({ id: TX_ID }),
		},
	});

	const body = await readJson(response);
	assert.deepEqual(body.storageRef, {
		backend: 'lit-arweave',
		id: TX_ID,
		uri: `lit-arweave://${TX_ID}`,
		contentType: 'application/json',
		encrypted: true,
		resource: 'responses',
	});
});

test('authenticated storage binding loads production session secrets with env and slug', async () => {
	const kvReads = [];
	const env = {
		GROUP_KV: {
			async get(key) {
				kvReads.push(key);
				return JSON.stringify({ arweaveJwk: '{}' });
			},
		},
	};
	let uploadContext = null;
	const services = createWorkerExecutionServicesWithWorkerDeps({
		deps: {
			json,
			getSessionSecrets,
			createArweaveUploadWithWorkerDeps: () => async (value) => {
				uploadContext = value;
				return json({ id: TX_ID }, 200);
			},
		},
	});

	const result = await dispatchAuthenticatedSecretPathRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: { ok: true }, resource: 'questions' }),
		}),
		env,
		config: { storageProfile: { backend: 'arweave' } },
		slug: 'session-a',
		address: '0xabc',
		headers: {},
		scopes: { storage: true },
		deps: {
			evaluateAuthenticatedRoutePreflight: async () => ({ ok: true }),
			storageRoute: services.storageRoute,
		},
	});

	assert.equal(result.handled, true);
	assert.equal(result.response.status, 200);
	assert.deepEqual(kvReads, ['session:session-a:secrets']);
	assert.deepEqual(uploadContext.secrets, { arweaveJwk: '{}' });
	assert.equal(uploadContext.slug, 'session-a');
});

test('storageRoute rejects oversized Arweave storage uploads before handoff', async () => {
	let uploadCalled = false;
	const response = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: 'too-large', storage: 'arweave' }),
		}),
		env: { CE_MAX_UPLOAD_BYTES: '4' },
		config: { storageProfile: { backend: 'arweave' } },
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: {
			json,
			arweaveUpload: async () => {
				uploadCalled = true;
				return json({ id: TX_ID });
			},
		},
	});

	const body = await readJson(response);
	assert.equal(uploadCalled, false);
	assert.equal(response.status, 413);
	assert.match(body.error, /Upload payload too large/);
});

test('storageRoute rejects oversized Cloudflare uploads and accepts under-cap uploads', async () => {
	const r2 = createMockR2();
	const kv = createMockKv();
	const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv, CE_MAX_UPLOAD_BYTES: '8' };
	const oversized = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: 'too-large', contentType: 'text/plain', resource: 'questions' }),
		}),
		env,
		config: CLOUDFLARE_WORKER_GATE_CONFIG,
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: {
			json,
			randomBytes: fixedRandomBytes,
			now: () => Date.parse('2026-01-02T03:04:05.000Z'),
		},
	});

	const oversizedBody = await readJson(oversized);
	assert.equal(oversized.status, 413);
	assert.match(oversizedBody.error, /Upload payload too large/);
	assert.equal(r2.store.size, 0);

	const underCap = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: 'ok', contentType: 'text/plain', resource: 'questions' }),
		}),
		env,
		config: CLOUDFLARE_WORKER_GATE_CONFIG,
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: {
			json,
			randomBytes: fixedRandomBytes,
			now: () => Date.parse('2026-01-02T03:04:05.000Z'),
		},
	});

	const underCapBody = await readJson(underCap);
	assert.equal(underCap.status, 200);
	assert.equal(underCapBody.storageRef.backend, 'cloudflare');
	assert.equal(r2.store.size, 1);
});

for (const resource of ['questions', 'surveys', 'responses']) {
	test(`storageRoute stores and lists Cloudflare ${resource} payloads behind opaque refs`, async () => {
		const r2 = createMockR2();
		const kv = createMockKv();
		const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
		const uploadRequest = new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: { resource, ok: true },
				contentType: 'application/json',
				resource,
				payloadEncrypted: resource === 'responses',
				tags: [{ name: 'CE-Resource', value: resource }],
			}),
		});

    const uploadResponse = await storageRoute({
      path: '/storage/upload',
      method: 'POST',
      request: uploadRequest,
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: {
        json,
        randomBytes: fixedRandomBytes,
        now: () => Date.parse('2026-01-02T03:04:05.000Z'),
      },
    });

    const uploadBody = await readJson(uploadResponse);
    assert.equal(uploadBody.storageRef.backend, 'cloudflare');
    assert.equal(uploadBody.storageRef.id.length, 43);
    assert.equal(uploadBody.storageRef.resource, resource);
    assert.equal(uploadBody.storageRef.encrypted === true, resource === 'responses');
    assert.equal(Object.hasOwn(uploadBody, 'arweaveTxId'), false);
    assert.doesNotMatch(JSON.stringify(uploadBody), /sessions\/session-a\/storage|account|bucket|token|secret|r2:\/\//i);

    const readResponse = await storageRoute({
      path: '/storage/read',
      method: 'GET',
      request: new Request(`https://worker.example/storage/read?id=${encodeURIComponent(uploadBody.storageRef.id)}`),
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: { json },
    });
    assert.equal(readResponse.headers.get('X-CE-Storage-Ref'), uploadBody.storageRef.id);
    assert.deepEqual(JSON.parse(await readResponse.text()), { resource, ok: true });

    const listResponse = await storageRoute({
      path: '/storage/list',
      method: 'GET',
      request: new Request(`https://worker.example/storage/list?resource=${resource}`),
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: { json },
    });

		const listed = await readJson(listResponse);
		assert.equal(listed.items.length, 1);
		assert.equal(listed.items[0].storageRef.id, uploadBody.storageRef.id);
		assert.equal(listed.items[0].storageRef.resource, resource);
		assert.doesNotMatch(JSON.stringify(listed), /sessions\/session-a\/storage|bucket|token|secret/i);
	});
}

test('storageRoute can use KV-only Cloudflare payload storage when R2 is unavailable', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Question from KV storage?', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 200);
  assert.equal(uploadBody.storageRef.backend, 'cloudflare');
  assert.equal(uploadBody.storageRef.id, CF_ID);
  assert.equal(uploadBody.storageRef.resource, 'questions');
  assert.doesNotMatch(JSON.stringify(uploadBody), /ce-storage-payload|sessions\/session-a\/storage|bucket|token|secret/i);
  assert.equal(kv.store.has(`ce-storage-payload:session-a:${CF_ID}`), true);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${CF_ID}`),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('X-CE-Storage-Backend'), 'cloudflare');
  assert.deepEqual(JSON.parse(await readResponse.text()), { prompt: 'Question from KV storage?', ok: true });

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].storageRef.id, CF_ID);
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'worker_sbt_gate');
  assert.doesNotMatch(JSON.stringify(listed), /ce-storage-payload|bucket|token|secret/i);
});

test('storageRoute accepts deploy-helper KV alias bindings for Cloudflare payload storage', async () => {
  const kv = createMockKv();
  const env = { GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Aliased KV storage works', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  assert.equal(uploadResponse.status, 200);
  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadBody.storageRef.backend, 'cloudflare');
  assert.equal(kv.store.has(`ce-storage-payload:session-a:${uploadBody.storageRef.id}`), true);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  assert.equal(readResponse.status, 200);
  assert.deepEqual(JSON.parse(await readResponse.text()), { prompt: 'Aliased KV storage works', ok: true });
});

test('storageRoute reads legacy KV payloads after an R2 binding is added', async () => {
  const kv = createMockKv();
  const uploadEnv = { CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Still in KV after R2 attach', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env: uploadEnv,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env: { CE_STORAGE_R2: createMockR2(), CE_STORAGE_INDEX_KV: kv },
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  assert.equal(readResponse.status, 200);
  assert.deepEqual(JSON.parse(await readResponse.text()), { prompt: 'Still in KV after R2 attach', ok: true });
});

test('storageRoute rejects Cloudflare storage when neither R2 nor KV payload storage is configured', async () => {
  const response = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'missing storage', resource: 'questions' }),
    }),
    env: {},
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(response.status, 501);
  assert.equal((await readJson(response)).error, 'Cloudflare storage binding not configured.');
});

test('storageRoute rejects R2-only worker-envelope uploads before key or object writes', async () => {
  const r2 = createMockR2();
  let randomCalls = 0;
  let coordinatorCalls = 0;
  const response = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'must not be written', resource: 'docsContext' }),
    }),
    env: {
      CE_STORAGE_R2: r2,
      CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
      CE_SESSION_COORDINATOR: {
        idFromName: () => {
          coordinatorCalls += 1;
          return 'must-not-coordinate';
        },
        get: () => ({ fetch: async () => new Response(null, { status: 500 }) }),
      },
    },
    config: createEnvelopeConfig(),
    slug: 'session-a',
    uploaderAddress: '0x0000000000000000000000000000000000000abc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: () => {
        randomCalls += 1;
        return fixedRandomBytes();
      },
    },
  });

  assert.equal(response.status, 501);
  assert.equal(
    (await readJson(response)).error,
    'Cloudflare worker-envelope storage requires an index KV binding.',
  );
  assert.equal(randomCalls, 0);
  assert.equal(coordinatorCalls, 0);
  assert.equal(r2.store.size, 0);
});

test('storageRoute stores Cloudflare docs payloads behind opaque refs and reads them back', async () => {
	const r2 = createMockR2();
	const kv = createMockKv();
	const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
	const uploadRequest = new Request('https://worker.example/storage/upload', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			data: 'hello storage',
			contentType: 'text/plain',
			resource: 'docsContext',
			gate: 'docUploads',
			tags: [{ name: 'CE-SessionId', value: '0xabc' }],
		}),
	});

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: uploadRequest,
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://app.example' },
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadBody.id, CF_ID);
  assert.deepEqual(uploadBody.storageRef, {
    backend: 'cloudflare',
    id: CF_ID,
    uri: `/storage/read?id=${CF_ID}`,
    contentType: 'text/plain',
    gate: 'docUploads',
    resource: 'docsContext',
    createdAt: '2026-01-02T03:04:05.000Z',
  });
  assert.doesNotMatch(JSON.stringify(uploadBody), /account|bucket|token|secret|r2:\/\//i);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${CF_ID}`),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.headers.get('X-CE-Storage-Ref'), CF_ID);
  assert.equal(readResponse.headers.get('Content-Type'), 'text/plain');
  assert.equal(await readResponse.text(), 'hello storage');
});

test('storageRoute denies Cloudflare worker_sbt_gate reads when SBT gate check fails', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const gatedConfig = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'worker_sbt_gate' },
    },
    __registry: {
      gatesByResource: {
        docUploads: {
          sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
          chainId: 84532,
          mode: 'all',
        },
      },
    },
  };

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'gated', contentType: 'text/plain', resource: 'docsContext' }),
    }),
    env,
    config: gatedConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate: async () => true,
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: gatedConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate: async () => false,
    },
  });
  const denied = await readJson(readResponse);
  assert.equal(readResponse.status, 403);
  assert.equal(denied.error, 'Access denied: Cloudflare worker SBT gate failed.');
});

test('storageRoute allows public_read Cloudflare reads and lists without requester auth', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const publicConfig = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'public_read' },
    },
  };

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'public question', contentType: 'text/plain', resource: 'questions' }),
    }),
    env,
    config: publicConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: publicConfig,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('X-CE-Payload-Access-Mode'), 'public_read');
  assert.equal(await readResponse.text(), 'public question');

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: publicConfig,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.equal(listResponse.status, 200);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'public_read');
});

test('storageRoute scaffold rejects plaintext Cloudflare lit_encrypted uploads', async () => {
  const r2 = createMockR2();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: createMockKv() };
  const litConfig = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'lit_encrypted' },
    },
  };

  const plaintextResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'plain', contentType: 'text/plain', resource: 'docsContext' }),
    }),
    env,
    config: litConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(plaintextResponse.status, 400);
  assert.match((await readJson(plaintextResponse)).error, /payloadEncrypted=true/);

  const encryptedResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: '{"ciphertext":"encrypted"}',
        contentType: 'application/json',
        resource: 'responses',
        payloadEncrypted: true,
      }),
    }),
    env,
    config: litConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const encryptedBody = await readJson(encryptedResponse);
  assert.equal(encryptedResponse.status, 200);
  assert.equal(encryptedBody.storageRef.backend, 'cloudflare');
  assert.equal(encryptedBody.storageRef.encrypted, true);
});

test('storageRoute accepts v2 public-read payload access while preserving legacy metadata strings', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const publicV2Config = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: 'none' },
    },
  };

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'public v2', contentType: 'text/plain', resource: 'questions' }),
    }),
    env,
    config: publicV2Config,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 200);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: publicV2Config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('X-CE-Payload-Access-Mode'), 'public_read');
  assert.equal(await readResponse.text(), 'public v2');

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: publicV2Config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.deepEqual(listed.items[0].metadata.payloadAccessControl, { gate: 'none', encryption: 'none' });
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'public_read');
});

test('storageRoute read-normalizes legacy payloadAccessMode metadata rows into v2 list metadata', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  await kv.put(`ce-storage:session-a:questions:${CF_ID}`, JSON.stringify({
    id: CF_ID,
    backend: 'cloudflare',
    resource: 'questions',
    contentType: 'text/plain',
    encrypted: false,
    payloadAccessMode: 'worker_sbt_gate',
    createdAt: '2026-01-02T03:04:05.000Z',
  }));

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(listed.items[0].metadata.payloadAccessControl, { gate: 'sbt_gate', encryption: 'none' });
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'worker_sbt_gate');
});

test('storageRoute worker_envelope stores ciphertext only and audits successful key release', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { response, body } = await uploadEnvelopePayload({ env, config, setConfig });
  assert.equal(response.status, 200);
  assert.equal(body.storageRef.encrypted, true);

  const dump = [...kv.store.values()].join('\n');
  assert.doesNotMatch(dump, /classified payload/);
  assert.match(dump, /worker_envelope/);
  assert.ok(config.storageEnvelope?.sessionKey?.wrappedKey);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: {
      json,
      now: () => Date.parse('2026-01-02T03:04:06.000Z'),
      randomUUID: () => 'audit-id',
    },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(await readResponse.text(), 'classified payload');
  assert.equal(
    [...kv.store.keys()].some((key) => key.startsWith(`ce-storage-audit:session-a:${body.storageRef.id}:`)),
    true
  );
});

test('storage envelope audits ignore D1 aliases and keep KV authoritative', async () => {
  const d1BindingNames = [
    'CE_STORAGE_AUDIT_D1',
    'STORAGE_AUDIT_D1',
    'D1',
    'DB',
  ];

  for (const bindingName of d1BindingNames) {
    const kv = createMockKv();
    let d1Calls = 0;
    const d1 = {
      prepare() {
        d1Calls += 1;
        throw new Error(`${bindingName} must not be used for envelope audits`);
      },
    };
    const result = await writeStorageEnvelopeKeyReleaseAudit({
      env: {
        CE_STORAGE_AUDIT_KV: kv,
        [bindingName]: d1,
      },
      slug: 'session-a',
      payloadId: `payload-${bindingName.toLowerCase()}`,
      principal: '0x00000000000000000000000000000000000000aa',
      conditionMatched: 'public',
      deps: {
        now: () => Date.parse('2026-01-02T03:04:06.000Z'),
        randomUUID: () => `audit-${bindingName.toLowerCase()}`,
      },
    });

    assert.equal(result.ok, true, bindingName);
    assert.equal(result.store, 'kv', bindingName);
    assert.equal(d1Calls, 0, bindingName);
    assert.equal(
      [...kv.store.keys()].some((key) => key.startsWith('ce-storage-audit:session-a:')),
      true,
      bindingName,
    );

    await assert.rejects(
      writeStorageEnvelopeKeyReleaseAudit({
        env: { [bindingName]: d1 },
        slug: 'session-a',
        payloadId: `d1-only-${bindingName.toLowerCase()}`,
        principal: '0x00000000000000000000000000000000000000aa',
        conditionMatched: 'public',
      }),
      /Storage envelope audit store is not configured/,
      bindingName,
    );
    assert.equal(d1Calls, 0, bindingName);
  }
});

test('storageRoute normalizes legacy key metadata without rewrapping before a new envelope write', async () => {
  const kv = createMockKv();
  const firstEnv = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let firstConfig = createEnvelopeConfig();
  const first = await uploadEnvelopePayload({
    env: firstEnv,
    config: firstConfig,
    setConfig: (nextConfig) => { firstConfig = nextConfig; },
    data: 'legacy source payload',
  });
  assert.equal(first.response.status, 200);

  const legacyKey = firstConfig.storageEnvelope.sessionKey;
  let legacyConfig = {
    ...firstConfig,
    storageEnvelope: {
      sessionKey: {
        iv: legacyKey.iv,
        wrappedKey: legacyKey.wrappedKey,
      },
    },
  };
  const freshEnv = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  const upgraded = await uploadEnvelopePayload({
    env: freshEnv,
    config: legacyConfig,
    setConfig: (nextConfig) => { legacyConfig = nextConfig; },
    data: 'post-legacy payload',
    deps: { randomBytes: createSequenceRandomBytes(91) },
  });

  assert.equal(upgraded.response.status, 200);
  assert.equal(legacyConfig.storageEnvelope.sessionKey.version, 1);
  assert.equal(legacyConfig.storageEnvelope.sessionKey.keyProvider, 'worker_secret');
  assert.equal(legacyConfig.storageEnvelope.sessionKey.iv, legacyKey.iv);
  assert.equal(legacyConfig.storageEnvelope.sessionKey.wrappedKey, legacyKey.wrappedKey);
  const read = (id, auditId) => storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${id}`),
    env: freshEnv,
    config: legacyConfig,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json, randomUUID: () => auditId },
  });
  const [oldRead, newRead] = await Promise.all([
    read(first.body.id, 'legacy-source-read'),
    read(upgraded.body.id, 'legacy-upgrade-read'),
  ]);
  assert.equal(oldRead.status, 200);
  assert.equal(await oldRead.text(), 'legacy source payload');
  assert.equal(newRead.status, 200);
  assert.equal(await newRead.text(), 'post-legacy payload');
});

test('storageRoute worker_envelope denies conditions before key unwrap', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body } = await uploadEnvelopePayload({ env, config, setConfig });
  const metadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', body.storageRef.id);
  metadata.accessConditions = {
    match: 'all',
    conditions: [{ kind: 'worker_role', role: 'admin' }],
  };
  metadata.envelope.accessConditions = metadata.accessConditions;
  await writeStorageIndexMetadata(kv, 'session-a', 'docsContext', metadata);

  const deniedResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env: { CE_STORAGE_INDEX_KV: kv },
    config,
    slug: 'session-a',
    uploaderAddress: '0x0000000000000000000000000000000000000bad',
    baseHeaders: {},
    deps: { json },
  });
  const denied = await readJson(deniedResponse);
  assert.equal(deniedResponse.status, 403);
  assert.equal(denied.reason, 'worker_role_denied');
  assert.equal([...kv.store.keys()].some((key) => key.startsWith('ce-storage-audit:')), false);
});

test('storageRoute worker_envelope audits before decrypting payload bytes', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body } = await uploadEnvelopePayload({ env, config, setConfig });

  const originalPut = kv.put.bind(kv);
  kv.put = async (key, value) => {
    if (String(key).startsWith('ce-storage-audit:')) {
      throw new Error('audit store unavailable');
    }
    return originalPut(key, value);
  };
  const cryptoSpy = createCryptoDecryptSpy();

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: {
      json,
      crypto: cryptoSpy.crypto,
      randomUUID: () => 'audit-fail',
    },
  });

  const result = await readJson(readResponse);
  assert.equal(readResponse.status, 403);
  assert.match(result.error, /audit store unavailable/);
  assert.equal(cryptoSpy.decryptCalls, 0);
});

test('storageRoute worker_envelope evaluates any/all and supported condition kinds', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body } = await uploadEnvelopePayload({ env, config, setConfig });
  const setConditions = async (doc) => {
    const metadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', body.storageRef.id);
    metadata.accessConditions = doc;
    metadata.envelope.accessConditions = doc;
    await writeStorageIndexMetadata(kv, 'session-a', 'docsContext', metadata);
  };
  let auditCounter = 0;
  const read = async ({
    requesterAddress = '0x0000000000000000000000000000000000000bad',
    authScopes = {},
    checkSbtGate = async () => false,
  } = {}) => storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: requesterAddress,
    authScopes,
    baseHeaders: {},
    deps: {
      json,
      now: () => Date.parse('2026-01-02T03:04:06.000Z'),
      randomUUID: () => {
        auditCounter += 1;
        return `audit-${auditCounter}`;
      },
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate,
    },
  });

  await setConditions({
    match: 'any',
    conditions: [
      { kind: 'worker_role', role: 'admin' },
      { kind: 'agent_grant_scope', scope: 'storage' },
    ],
  });
  const anyResponse = await read({ authScopes: { storage: true } });
  assert.equal(anyResponse.status, 200);
  assert.equal(await anyResponse.text(), 'classified payload');

  await setConditions({
    match: 'all',
    conditions: [
      { kind: 'worker_role', role: 'admin' },
      { kind: 'agent_grant_scope', scope: 'storage' },
    ],
  });
  const allDeniedResponse = await read({
    requesterAddress: '0x0000000000000000000000000000000000000abc',
    authScopes: {},
  });
  assert.equal(allDeniedResponse.status, 403);
  assert.equal((await readJson(allDeniedResponse)).reason, 'agent_grant_scope_denied');
  const allAllowedResponse = await read({
    requesterAddress: '0x0000000000000000000000000000000000000abc',
    authScopes: { storage: true },
  });
  assert.equal(allAllowedResponse.status, 200);

  let sbtChecked = false;
  await setConditions({
    match: 'all',
    conditions: [{ kind: 'sbt_onchain', chainId: 11155420, contract: '0x00000000000000000000000000000000000000aa' }],
  });
  const sbtAllowedResponse = await read({
    checkSbtGate: async ({ sbtAddresses, chainId, mode }) => {
      sbtChecked = true;
      assert.deepEqual(sbtAddresses, ['0x00000000000000000000000000000000000000aa']);
      assert.equal(chainId, 11155420);
      assert.equal(mode, 'any');
      return true;
    },
  });
  assert.equal(sbtAllowedResponse.status, 200);
  assert.equal(sbtChecked, true);

  await setConditions({ match: 'all', conditions: [{ kind: 'worker_group', groupId: 'reserved' }] });
  const reservedResponse = await read();
  assert.equal(reservedResponse.status, 403);
  assert.equal((await readJson(reservedResponse)).reason, 'reserved_condition_kind');

  await setConditions({ match: 'all', conditions: [{ kind: 'future_kind' }] });
  const unknownResponse = await read();
  assert.equal(unknownResponse.status, 403);
  assert.equal((await readJson(unknownResponse)).reason, 'unknown_condition_kind');
});

test('exportCloudflareEncryptedPayloadEnvelopes emits ciphertext and envelope metadata only', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig({
    payloadAccessControl: {
      accessConditions: {
        match: 'any',
        conditions: [{ kind: 'worker_role', role: 'admin' }],
      },
    },
  });
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body: envelopeBody } = await uploadEnvelopePayload({
    env,
    config,
    setConfig,
    data: 'classified export payload',
    deps: { randomBytes: createSequenceRandomBytes(41) },
  });

  const litConfig = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'sbt_gate', encryption: 'lit' },
    },
  };
  const litResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: 'lit ciphertext body',
        contentType: 'text/plain',
        resource: 'responses',
        payloadEncrypted: true,
      }),
    }),
    env,
    config: litConfig,
    slug: 'session-a',
    uploaderAddress: '0x0000000000000000000000000000000000000abc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: createSequenceRandomBytes(91),
      now: () => Date.parse('2026-01-02T03:04:07.000Z'),
    },
  });
  assert.equal(litResponse.status, 200);

  const exported = await exportCloudflareEncryptedPayloadEnvelopes({
    env,
    config,
    slug: 'session-a',
    deps: { now: () => Date.parse('2026-01-02T03:05:00.000Z') },
  });
  assert.equal(exported.ok, true);
  assert.equal(exported.manifest.exportScope, 'encrypted_envelopes_only');
  assert.equal(exported.manifest.storageBackend, 'cloudflare');
  assert.equal(exported.manifest.encryptedPayloadCount, 2, JSON.stringify(exported, null, 2));
  assert.equal(exported.manifest.wrappedKeysIncluded, true);
  assert.equal(exported.manifest.keyProvider, 'mixed');
  assert.equal(exported.manifest.deploymentKekContinuityRequired, true);
  assert.equal(exported.manifest.rewrapRequiredForNewDeployment, true);
  assert.ok(exported.sessionEnvelope.sessionKey.wrappedKey);
  const dump = JSON.stringify(exported);
  assert.doesNotMatch(dump, /classified export payload/);
  assert.match(dump, /ciphertextBase64url/);
  const exportedById = new Map(exported.payloads.map((entry) => [entry.storageRef.id, entry]));
  const envelopeEntry = exportedById.get(envelopeBody.storageRef.id);
  assert.equal(envelopeEntry.metadata.payloadAccessControl.encryption, 'worker_envelope');
  assert.equal(envelopeEntry.keyProvider, 'worker_secret');
  assert.equal(envelopeEntry.envelope.dek.wrappedKey.length > 0, true);
  assert.deepEqual(envelopeEntry.envelope.accessConditions, {
    match: 'any',
    conditions: [{ kind: 'worker_role', role: 'admin' }],
  });
  const litEntry = exported.payloads.find((entry) => entry.metadata.payloadAccessControl.encryption === 'lit');
  assert.equal(litEntry.keyProvider, 'lit');
  assert.equal(litEntry.ciphertextBase64url, 'bGl0IGNpcGhlcnRleHQgYm9keQ');
  assert.equal(litEntry.wrappedKeysIncluded, false);

  const litOnly = await exportCloudflareEncryptedPayloadEnvelopes({
    env,
    config: litConfig,
    slug: 'session-a',
    resource: 'responses',
    includeSessionEnvelope: false,
    deps: { now: () => Date.parse('2026-01-02T03:06:00.000Z') },
  });
  assert.equal(litOnly.manifest.keyProvider, 'lit');
  assert.equal(litOnly.manifest.deploymentKekContinuityRequired, false);
  assert.equal(litOnly.manifest.rewrapRequiredForNewDeployment, false);

  const emptyLit = await exportCloudflareEncryptedPayloadEnvelopes({
    env,
    config: litConfig,
    slug: 'session-a',
    resource: 'missing-resource',
    includeSessionEnvelope: false,
  });
  assert.equal(emptyLit.manifest.deploymentKekContinuityRequired, false);
  assert.equal(emptyLit.manifest.rewrapRequiredForNewDeployment, false);
});

test('storageRoute /storage/export-envelopes omits session key material', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  await uploadEnvelopePayload({
    env,
    config,
    setConfig,
    data: 'route export plaintext',
    deps: { randomBytes: createSequenceRandomBytes(131) },
  });

  const response = await storageRoute({
    path: '/storage/export-envelopes',
    method: 'GET',
    request: new Request('https://worker.example/storage/export-envelopes?resource=docsContext'),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.manifest.exportScope, 'encrypted_envelopes_only');
  assert.equal(body.payloads.length, 1);
  assert.equal(Object.hasOwn(body, 'sessionEnvelope'), false);
  assert.doesNotMatch(JSON.stringify(body), /route export plaintext/);
  assert.match(JSON.stringify(body), /ciphertextBase64url/);

  const postResponse = await storageRoute({
    path: '/storage/export-envelopes',
    method: 'POST',
    request: new Request('https://worker.example/storage/export-envelopes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'docsContext' }),
    }),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  const postBody = await readJson(postResponse);
  assert.equal(postResponse.status, 200);
  assert.equal(postBody.manifest.resource, 'docsContext');
  assert.equal(postBody.payloads.length, 1);
});

test('exportCloudflareEncryptedPayloadEnvelopes counts encrypted rows when payload bytes are missing', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body } = await uploadEnvelopePayload({
    env,
    config,
    setConfig,
    data: 'missing payload bytes',
    deps: { randomBytes: createSequenceRandomBytes(141) },
  });
  kv.store.delete(`ce-storage-payload:session-a:${body.storageRef.id}`);

  const exported = await exportCloudflareEncryptedPayloadEnvelopes({
    env,
    config,
    slug: 'session-a',
    resource: 'docsContext',
  });

  assert.equal(exported.ok, true);
  assert.equal(exported.manifest.encryptedPayloadCount, 1);
  assert.equal(exported.manifest.exportedPayloadCount, 0);
  assert.equal(exported.manifest.partial, true);
  assert.deepEqual(exported.manifest.readErrors, [{
    id: body.storageRef.id,
    error: 'payload_bytes_missing',
  }]);
});

test('storageRoute lists Cloudflare refs from the metadata index without raw object keys', async () => {
	const r2 = createMockR2();
	const kv = createMockKv();
	const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
	const uploadRequest = new Request('https://worker.example/storage/upload', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: 'indexed', contentType: 'text/plain', resource: 'docsContext' }),
	});

  await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: uploadRequest,
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json, randomBytes: fixedRandomBytes, now: () => Date.parse('2026-01-02T03:04:05.000Z') },
  });

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=docsContext'),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  const body = await readJson(listResponse);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].storageRef.id, CF_ID);
  assert.equal(body.items[0].storageRef.backend, 'cloudflare');
  assert.doesNotMatch(JSON.stringify(body), /sessions\/session-a\/storage|bucket|token|secret/i);
});
