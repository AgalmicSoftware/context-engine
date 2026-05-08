import test from 'node:test';
import assert from 'node:assert/strict';

import { exportCloudflareEncryptedPayloadEnvelopes, storageRoute } from './storageRouteExecution.js';
import { dispatchAuthenticatedSecretPathRoute } from './authenticatedSecretPathRouteDispatch.js';
import { getSessionSecrets } from './sessionConfigSecretsStore.js';
import { writeStorageEnvelopeKeyReleaseAudit } from './storageEnvelopeEncryption.js';
import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';
import { resolveRpcUrlListForGate } from './gateRpcResolution.js';
import { createEthersInterfaceProviderGateHelpersWithWorkerDeps } from './ethersInterfaceProviderGateBinding.js';
import { PRIVATE_SESSION_RPC_LABEL } from './rpcDiagnosticSafety.js';
import { addWorkerGroupMember, createWorkerGroup, deleteWorkerGroup, readWorkerGroupMembershipProjection } from './workerGroups.js';
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

test('storageRoute binds response list metadata to the authenticated uploader', async () => {
	const kv = createMockKv();
	const uploaderAddress = '0x0000000000000000000000000000000000000aBc';
	const config = {
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
			body: JSON.stringify({
				data: {
					questionID: 'question-a',
					responder: '0x0000000000000000000000000000000000000bad',
					answer: { value: true },
				},
				contentType: 'application/json',
				resource: 'responses',
			}),
		}),
		env: { CE_STORAGE_INDEX_KV: kv },
		config,
		slug: 'session-a',
		uploaderAddress,
		baseHeaders: {},
		deps: {
			json,
			randomBytes: fixedRandomBytes,
			now: () => Date.parse('2026-07-22T12:00:00.000Z'),
		},
	});
	assert.equal(uploadResponse.status, 200);

	const listResponse = await storageRoute({
		path: '/storage/list',
		method: 'GET',
		request: new Request('https://worker.example/storage/list?resource=responses'),
		env: { CE_STORAGE_INDEX_KV: kv },
		config,
		slug: 'session-a',
		uploaderAddress: '',
		baseHeaders: {},
		deps: { json },
	});
	const listed = await readJson(listResponse);

	assert.equal(listResponse.status, 200);
	assert.equal(listed.items[0].metadata.responder, uploaderAddress.toLowerCase());
	assert.equal(Object.hasOwn(listed.items[0].storageRef, 'responder'), false);
});

for (const contentType of ['application/json; charset=utf-8', 'application/ld+json']) {
	test(`storageRoute serializes Cloudflare JSON object uploads for ${contentType}`, async () => {
		const r2 = createMockR2();
		const kv = createMockKv();
		const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
		const uploadResponse = await storageRoute({
			path: '/storage/upload',
			method: 'POST',
			request: new Request('https://worker.example/storage/upload', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					data: { title: 'JSON payload', count: 1 },
					contentType,
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
		assert.equal(uploadBody.storageRef.contentType, contentType);

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

		assert.equal(readResponse.status, 200);
		assert.equal(await readResponse.text(), '{"title":"JSON payload","count":1}');
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
		baseHeaders: new Headers({ 'Access-Control-Allow-Origin': 'https://contextengine.sh' }),
		deps: { json },
	});
	assert.equal(readResponse.status, 200);
	assert.equal(readResponse.headers.get('Access-Control-Allow-Origin'), 'https://contextengine.sh');
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

for (const resource of ['media', 'images']) {
	test(`storageRoute rejects encoded KV-only ${resource} values before any payload or index write`, async () => {
		const kv = createMockKv();
		const response = await storageRoute({
			path: '/storage/upload',
			method: 'POST',
			request: new Request('https://worker.example/storage/upload', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					data: 'x'.repeat(900),
					contentType: 'application/octet-stream',
					resource,
				}),
			}),
			env: { CE_STORAGE_INDEX_KV: kv, CE_MAX_UPLOAD_BYTES: '4096' },
			config: CLOUDFLARE_WORKER_GATE_CONFIG,
			slug: 'session-a',
			uploaderAddress: '0xabc',
			baseHeaders: {},
			deps: {
				json,
				maxKvValueBytes: 1024,
				randomBytes: fixedRandomBytes,
				now: () => Date.parse('2026-01-02T03:04:05.000Z'),
			},
		});
		const body = await readJson(response);

		assert.equal(response.status, 413);
		assert.match(body.error, /KV storage payload too large after encoding/);
		assert.equal(kv.store.size, 0);
	});
}

test('storageRoute applies the final KV value cap after worker-envelope expansion', async () => {
	const kv = createMockKv();
	const env = {
		CE_STORAGE_INDEX_KV: kv,
		CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
		CE_MAX_UPLOAD_BYTES: '4096',
	};
	let config = createEnvelopeConfig();
	attachSessionCoordinator(env, (nextConfig) => {
		config = nextConfig;
	});
	const response = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: 'encrypted media payload',
				contentType: 'application/octet-stream',
				resource: 'media',
			}),
		}),
		env,
		config,
		slug: 'session-a',
		uploaderAddress: '0x0000000000000000000000000000000000000abc',
		baseHeaders: {},
		deps: {
			json,
			maxKvValueBytes: 700,
			randomBytes: createSequenceRandomBytes(),
			putSessionConfig: async (_env, _slug, nextConfig) => {
				config = nextConfig;
			},
			now: () => Date.parse('2026-01-02T03:04:05.000Z'),
		},
	});
	const body = await readJson(response);

	assert.equal(response.status, 413);
	assert.match(body.error, /KV storage payload too large after encoding/);
	assert.equal(kv.store.size, 0);
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

test('storageRoute uses Web Crypto getRandomValues for Cloudflare storage refs when randomBytes is absent', async () => {
	const kv = createMockKv();
	const env = { CE_STORAGE_INDEX_KV: kv };
	const uploadResponse = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: { prompt: 'Question from Web Crypto entropy?', ok: true },
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
			getRandomValues: fixedGetRandomValues,
			now: () => Date.parse('2026-01-02T03:04:05.000Z'),
		},
	});

	const uploadBody = await readJson(uploadResponse);
	assert.equal(uploadResponse.status, 200);
	assert.equal(uploadBody.storageRef.backend, 'cloudflare');
	assert.equal(uploadBody.storageRef.id, CF_ID);
	assert.equal(kv.store.has(`ce-storage-payload:session-a:${CF_ID}`), true);
});

test('storageRoute fails closed when Cloudflare storage ref entropy is unavailable', async () => {
	const r2 = createMockR2();
	const kv = createMockKv();
	const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
	const uploadResponse = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: { prompt: 'Question without entropy?', ok: true },
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
			getRandomValues: null,
		},
	});

	const body = await readJson(uploadResponse);
	assert.equal(uploadResponse.status, 500);
	assert.match(body.error, /Secure randomness is required/);
	assert.equal(r2.store.size, 0);
	assert.equal(kv.store.size, 0);
});

test('storageRoute rejects short injected Cloudflare storage ref entropy without Web Crypto fallback', async () => {
	const r2 = createMockR2();
	const kv = createMockKv();
	const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
	const uploadResponse = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: { prompt: 'Question with short entropy?', ok: true },
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
			randomBytes: shortRandomBytes,
			getRandomValues: null,
		},
	});

	const body = await readJson(uploadResponse);
	assert.equal(uploadResponse.status, 500);
	assert.match(body.error, /Secure randomness is required/);
	assert.equal(r2.store.size, 0);
	assert.equal(kv.store.size, 0);
});

test('storageRoute reads Cloudflare list resource from POST JSON body', async () => {
	const kv = createMockKv();
	const env = { CE_STORAGE_INDEX_KV: kv };
	const uploadResponse = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: { prompt: 'Question body resource', ok: true },
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

	const listResponse = await storageRoute({
		path: '/storage/list',
		method: 'POST',
		request: new Request('https://worker.example/storage/list', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ resource: 'questions' }),
		}),
		env,
		config: CLOUDFLARE_WORKER_GATE_CONFIG,
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: { json },
	});

	const listed = await readJson(listResponse);
	assert.equal(listResponse.status, 200);
	assert.equal(listed.items.length, 1);
	assert.equal(listed.items[0].storageRef.id, uploadBody.storageRef.id);
	assert.equal(listed.items[0].storageRef.resource, 'questions');
});

test('storageRoute gives Cloudflare list query resource precedence over POST body', async () => {
	const kv = createMockKv();
	const env = { CE_STORAGE_INDEX_KV: kv };
	const uploadResponse = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: { prompt: 'Question query resource', ok: true },
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

	const listResponse = await storageRoute({
		path: '/storage/list',
		method: 'POST',
		request: new Request('https://worker.example/storage/list?resource=questions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ resource: 'docsContext' }),
		}),
		env,
		config: CLOUDFLARE_WORKER_GATE_CONFIG,
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: { json },
	});

	const listed = await readJson(listResponse);
	assert.equal(listResponse.status, 200);
	assert.equal(listed.items.length, 1);
	assert.equal(listed.items[0].storageRef.id, uploadBody.storageRef.id);
	assert.equal(listed.items[0].storageRef.resource, 'questions');
});

test('storageRoute rejects invalid Cloudflare list POST JSON body', async () => {
	const response = await storageRoute({
		path: '/storage/list',
		method: 'POST',
		request: new Request('https://worker.example/storage/list', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{',
		}),
		env: { CE_STORAGE_INDEX_KV: createMockKv() },
		config: CLOUDFLARE_WORKER_GATE_CONFIG,
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: { json },
	});

	assert.equal(response.status, 400);
	assert.equal((await readJson(response)).error, 'Invalid JSON.');
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

test('storageRoute fails closed when authoritative R2 index metadata is unavailable', async () => {
	const publicConfig = {
		storageProfile: {
			backend: 'cloudflare',
			payloadAccessControl: { gate: 'none', encryption: 'none' },
		},
	};
	const indexFailures = [
		['null', async () => null, 404, 'Storage object not found.'],
		['malformed', async () => '{"id":', 503, 'Cloudflare storage index metadata is unavailable.'],
		[
			'thrown',
			async () => {
				throw new Error('index unavailable');
			},
			503,
			'Cloudflare storage index metadata is unavailable.',
		],
		[
			'wrong id',
			async () => JSON.stringify({ id: 'wrong-id', resource: 'docsContext' }),
			503,
			'Cloudflare storage index metadata is unavailable.',
		],
		[
			'wrong resource',
			async () => JSON.stringify({ id: CF_ID, resource: 'questions' }),
			503,
			'Cloudflare storage index metadata is unavailable.',
		],
	];

	for (const [label, get, status, error] of indexFailures) {
		const r2 = createMockR2();
		await r2.put(`sessions/session-a/storage/${CF_ID}`, new TextEncoder().encode('must stay private'), {
			httpMetadata: { contentType: 'text/plain' },
			customMetadata: {
				id: CF_ID,
				resource: 'docsContext',
				payloadAccessMode: 'public_read',
				payloadAccessControl: JSON.stringify({ gate: 'none', encryption: 'none' }),
			},
		});
		const storedObject = r2.store.get(`sessions/session-a/storage/${CF_ID}`);
		const readArrayBuffer = storedObject.arrayBuffer.bind(storedObject);
		let payloadRead = false;
		storedObject.arrayBuffer = async () => {
			payloadRead = true;
			return readArrayBuffer();
		};

		const response = await storageRoute({
			path: '/storage/read',
			method: 'GET',
			request: new Request(`https://worker.example/storage/read?id=${CF_ID}`),
			env: { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: { get } },
			config: publicConfig,
			slug: 'session-a',
			uploaderAddress: '',
			baseHeaders: {},
			deps: { json },
		});
		const body = await readJson(response);

		assert.equal(response.status, status, label);
		assert.equal(body.error, error, label);
		assert.equal(payloadRead, false, label);
		assert.doesNotMatch(JSON.stringify(body), /must stay private/, label);
	}
});

test('storageRoute authorizes R2 bytes from the valid index row instead of coarse custom metadata', async () => {
	const r2 = createMockR2();
	await r2.put(`sessions/session-a/storage/${CF_ID}`, new TextEncoder().encode('indexed private payload'), {
		httpMetadata: { contentType: 'text/plain' },
		customMetadata: {
			id: CF_ID,
			resource: 'docsContext',
			payloadAccessMode: 'public_read',
			payloadAccessControl: JSON.stringify({ gate: 'none', encryption: 'none' }),
		},
	});
	const storedObject = r2.store.get(`sessions/session-a/storage/${CF_ID}`);
	const readArrayBuffer = storedObject.arrayBuffer.bind(storedObject);
	const readText = storedObject.text.bind(storedObject);
	let arrayBufferReads = 0;
	let textReads = 0;
	storedObject.arrayBuffer = async () => {
		arrayBufferReads += 1;
		return readArrayBuffer();
	};
	storedObject.text = async () => {
		textReads += 1;
		return readText();
	};
	const indexedMetadata = {
		id: CF_ID,
		backend: 'cloudflare',
		resource: 'docsContext',
		contentType: 'text/plain',
		payloadAccessControl: { gate: 'none', encryption: 'none' },
		accessConditions: {
			match: 'all',
			conditions: [{ kind: 'worker_role', role: 'admin' }],
		},
	};
	const env = {
		CE_STORAGE_R2: r2,
		CE_STORAGE_INDEX_KV: {
			get: async () => JSON.stringify(indexedMetadata),
		},
	};
	const config = {
		adminAddress: '0x0000000000000000000000000000000000000abc',
		storageProfile: {
			backend: 'cloudflare',
			payloadAccessControl: { gate: 'none', encryption: 'none' },
		},
	};
	const read = (uploaderAddress) =>
		storageRoute({
			path: '/storage/read',
			method: 'GET',
			request: new Request(`https://worker.example/storage/read?id=${CF_ID}`),
			env,
			config,
			slug: 'session-a',
			uploaderAddress,
			baseHeaders: {},
			deps: { json },
		});

	const deniedResponse = await read('');
	assert.equal(deniedResponse.status, 403);
	assert.equal(arrayBufferReads, 0);
	assert.equal(textReads, 0);
	assert.doesNotMatch(JSON.stringify(await readJson(deniedResponse)), /indexed private payload/);

	const allowedResponse = await read('0x0000000000000000000000000000000000000abc');
	assert.equal(allowedResponse.status, 200);
	assert.equal(await allowedResponse.text(), 'indexed private payload');
	assert.equal(arrayBufferReads, 1);
	assert.equal(textReads, 0);
});

test('storageRoute rejects per-item-conditioned R2 uploads without an index binding', async () => {
	const r2 = createMockR2();
	const response = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: 'conditioned payload',
				contentType: 'text/plain',
				resource: 'docsContext',
				accessConditions: {
					match: 'all',
					conditions: [{ kind: 'worker_role', role: 'admin' }],
				},
			}),
		}),
		env: { CE_STORAGE_R2: r2 },
		config: {
			adminAddress: '0x0000000000000000000000000000000000000abc',
			storageProfile: {
				backend: 'cloudflare',
				payloadAccessControl: { gate: 'none', encryption: 'none' },
			},
		},
		slug: 'session-a',
		uploaderAddress: '0x0000000000000000000000000000000000000abc',
		baseHeaders: {},
		deps: { json, randomBytes: fixedRandomBytes },
	});

	assert.equal(response.status, 501);
	assert.equal((await readJson(response)).error, 'Cloudflare R2 storage requires an index KV binding.');
	assert.equal(r2.store.size, 0);
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
	assert.equal((await readJson(response)).error, 'Cloudflare R2 storage requires an index KV binding.');
	assert.equal(randomCalls, 0);
	assert.equal(coordinatorCalls, 0);
	assert.equal(r2.store.size, 0);
});

test('storageRoute rejects R2 uploads when the index binding cannot read persisted metadata', async () => {
	const r2 = createMockR2();
	let indexWrites = 0;
	const response = await storageRoute({
		path: '/storage/upload',
		method: 'POST',
		request: new Request('https://worker.example/storage/upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: 'unreadable index', contentType: 'text/plain', resource: 'docsContext' }),
		}),
		env: {
			CE_STORAGE_R2: r2,
			CE_STORAGE_INDEX_KV: {
				put: async () => {
					indexWrites += 1;
				},
			},
		},
		config: {
			storageProfile: {
				backend: 'cloudflare',
				payloadAccessControl: { gate: 'none', encryption: 'none' },
			},
		},
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: { json, randomBytes: fixedRandomBytes },
	});

	assert.equal(response.status, 501);
	assert.equal((await readJson(response)).error, 'Cloudflare R2 storage requires an index KV binding.');
	assert.equal(indexWrites, 0);
	assert.equal(r2.store.size, 0);
});

test('storageRoute rejects coarse public R2-only uploads and reads without an index binding', async () => {
	const r2 = createMockR2();
	const config = {
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
			body: JSON.stringify({ data: 'coarse public payload', contentType: 'text/plain', resource: 'docsContext' }),
		}),
		env: { CE_STORAGE_R2: r2 },
		config,
		slug: 'session-a',
		uploaderAddress: '0xabc',
		baseHeaders: {},
		deps: { json, randomBytes: fixedRandomBytes },
	});
	const uploadBody = await readJson(uploadResponse);
	assert.equal(uploadResponse.status, 501);
	assert.equal(uploadBody.error, 'Cloudflare R2 storage requires an index KV binding.');
	assert.equal(r2.store.size, 0);

	await r2.put(`sessions/session-a/storage/${CF_ID}`, new TextEncoder().encode('legacy payload'), {
		httpMetadata: { contentType: 'text/plain' },
		customMetadata: {
			id: CF_ID,
			resource: 'docsContext',
			payloadAccessMode: 'public_read',
			payloadAccessControl: JSON.stringify({ gate: 'none', encryption: 'none' }),
		},
	});
	const storedObject = r2.store.get(`sessions/session-a/storage/${CF_ID}`);
	const readArrayBuffer = storedObject.arrayBuffer.bind(storedObject);
	let payloadRead = false;
	storedObject.arrayBuffer = async () => {
		payloadRead = true;
		return readArrayBuffer();
	};

	const readResponse = await storageRoute({
		path: '/storage/read',
		method: 'GET',
		request: new Request(`https://worker.example/storage/read?id=${CF_ID}`),
		env: { CE_STORAGE_R2: r2 },
		config,
		slug: 'session-a',
		uploaderAddress: '',
		baseHeaders: {},
		deps: { json },
	});

	const readBody = await readJson(readResponse);
	assert.equal(readResponse.status, 501);
	assert.equal(readBody.error, 'Cloudflare R2 storage requires an index KV binding.');
	assert.equal(payloadRead, false);
	assert.doesNotMatch(JSON.stringify(readBody), /legacy payload/);
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
