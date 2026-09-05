import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import bundledSessionWorker, { SessionWriteCoordinator } from '../../deploy/cloudflare/session-worker/worker.mjs';

const ORIGIN = 'https://app.example';
const SESSION_SLUG = 'bundle-runtime-centralized';
const SESSION_ID = '0x0123456789abcdef0123456789abcdef';

const cloneValue = (value) => (value === undefined ? undefined : structuredClone(value));

const createMemoryKv = (seed = {}) => {
	const values = new Map(Object.entries(seed));
	return {
		async get(key, typeOrOptions) {
			const value = values.has(key) ? values.get(key) : null;
			const type = typeof typeOrOptions === 'string' ? typeOrOptions : typeOrOptions?.type;
			if (value == null || !type || type === 'text') return value;
			if (type === 'json') return JSON.parse(value);
			if (type === 'arrayBuffer') return new TextEncoder().encode(value).buffer;
			return value;
		},
		async put(key, value) {
			values.set(key, value);
		},
		async delete(key) {
			return values.delete(key);
		},
		async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
			const names = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
			const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
			const selected = names.slice(offset, offset + limit);
			const nextOffset = offset + selected.length;
			return {
				keys: selected.map((name) => ({ name })),
				list_complete: nextOffset >= names.length,
				cursor: nextOffset >= names.length ? '' : String(nextOffset),
			};
		},
		dump() {
			return new Map(values);
		},
	};
};

const createDurableStorage = () => {
	const values = new Map();
	let tail = Promise.resolve();
	const enqueue = (operation) => {
		const run = tail.then(operation);
		tail = run.catch(() => undefined);
		return run;
	};
	const view = (target) => ({
		get: async (key) => cloneValue(target.get(key)),
		put: async (key, value) => target.set(key, cloneValue(value)),
		delete: async (key) => target.delete(key),
	});
	return {
		get: (key) => enqueue(() => view(values).get(key)),
		put: (key, value) => enqueue(() => view(values).put(key, value)),
		delete: (key) => enqueue(() => view(values).delete(key)),
		transaction: (callback) =>
			enqueue(async () => {
				const staged = new Map([...values].map(([key, value]) => [key, cloneValue(value)]));
				const result = await callback(view(staged));
				values.clear();
				for (const [key, value] of staged) values.set(key, value);
				return result;
			}),
	};
};

const installCoordinatorBinding = (env) => {
	const instances = new Map();
	env.CE_SESSION_COORDINATOR = {
		idFromName: (name) => `memory:${name}`,
		get: (id) => {
			if (!instances.has(id)) {
				const coordinator = new SessionWriteCoordinator({ storage: createDurableStorage() }, env);
				instances.set(id, {
					fetch: (input, init) => coordinator.fetch(input instanceof Request ? input : new Request(input, init)),
				});
			}
			return instances.get(id);
		},
	};
	return env;
};

const centralizedProfile = Object.freeze({
	profileVersion: 1,
	preset: 'fast_cheap_cloudflare',
	authority: { mode: 'worker_canonical' },
	evm: { registryChainId: null },
	storage: {
		backend: 'cloudflare',
		payloadAccessControl: {
			gate: 'role_gate',
			encryption: 'worker_envelope',
			accessConditions: {
				match: 'any',
				conditions: [
					{ kind: 'worker_role', role: 'admin' },
					{ kind: 'agent_grant_scope', scope: 'storage' },
				],
			},
		},
	},
	identity: { default: 'passkey', enabled: ['passkey'] },
	authorization: { mechanisms: ['worker_roles'] },
	encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
	surfaces: {
		web: true,
		telegram: false,
		miniApp: false,
		agentHttp: false,
		mcp: false,
		ceCc: false,
	},
	results: {
		visibility: 'participant_aggregate',
		exposure: {
			aggregateResultsEnabled: true,
			anonymizedGroupsEnabled: false,
			minGroupSize: 2,
		},
	},
	export: { scope: 'admin_raw' },
});

const centralizedStorageProfile = Object.freeze({
	type: 'session_storage_profile',
	version: 'session-storage-profile-v1',
	backend: 'cloudflare',
	sessionOwned: true,
	telegramOwned: false,
	resources: {
		docsContext: 'active',
		questions: 'active',
		surveys: 'active',
		responses: 'active',
		generatedArtifacts: 'active',
		media: 'active',
		images: 'active',
	},
	payloadAccessControl: centralizedProfile.storage.payloadAccessControl,
	cloudflare: { payloadAccessMode: 'worker_sbt_gate' },
});

const makeRequest = (path, { method = 'GET', token = '', body } = {}) => {
	const headers = new Headers({
		Origin: ORIGIN,
		'X-Session-Slug': SESSION_SLUG,
	});
	if (token) headers.set('Authorization', `Bearer ${token}`);
	if (body !== undefined) headers.set('Content-Type', 'application/json');
	return new Request(`https://worker.example${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
};

const fetchWorker = (request, env) =>
	bundledSessionWorker.fetch(request, env, {
		waitUntil() {},
	});

const login = async ({ env, wallet }) => {
	const nonceResponse = await fetchWorker(
		makeRequest('/auth/nonce', {
			method: 'POST',
			body: {
				address: wallet.address,
				sessionSlug: SESSION_SLUG,
				sessionId: SESSION_ID,
			},
		}),
		env,
	);
	const noncePayload = await nonceResponse.json();
	assert.equal(nonceResponse.status, 200, JSON.stringify(noncePayload));

	const issuedAt = new Date(Date.now() - 60_000).toISOString();
	const expirationTime = new Date(Date.now() + 3_600_000).toISOString();
	const message = `${new URL(ORIGIN).host} wants you to sign in with your Ethereum account:
${wallet.address}

URI: ${ORIGIN}
Version: 1
Chain ID: 1
Nonce: ${noncePayload.nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`;
	const signature = await wallet.signMessage(message);
	const response = await fetchWorker(
		makeRequest('/auth/login', {
			method: 'POST',
			body: {
				address: wallet.address,
				sessionSlug: SESSION_SLUG,
				sessionId: SESSION_ID,
				message,
				signature,
			},
		}),
		env,
	);
	const payload = await response.json();
	assert.equal(response.status, 200, JSON.stringify(payload));
	assert.equal(typeof payload.token, 'string');
	return payload.token;
};

test('generated Worker bundle runs the centralized preset auth and encrypted storage path', async () => {
	const admin = Wallet.createRandom();
	const participant = Wallet.createRandom();
	const storageKv = createMemoryKv();
	const config = {
		slug: SESSION_SLUG,
		sessionId: SESSION_ID,
		configRevision: 'bundle-runtime-v1',
		sessionName: 'Bundle runtime fixture',
		adminAddress: admin.address,
		allowOrigins: [ORIGIN],
		sessionModeProfile: centralizedProfile,
		storageProfile: centralizedStorageProfile,
		workerAuthority: {
			version: 1,
			participantScopes: ['storage'],
			anonymousScopes: [],
		},
	};
	const groupKv = createMemoryKv({
		[`session:${SESSION_SLUG}:config`]: JSON.stringify(config),
	});
	const env = installCoordinatorBinding({
		GROUP_KV: groupKv,
		CE_STORAGE_INDEX_KV: storageKv,
		TOKEN_HMAC_SECRET: 'bundle-runtime-token-hmac-fixture-v1',
		CE_STORAGE_ENVELOPE_KEK: 'bundle-runtime-envelope-kek-fixture-v1',
	});

	const bootstrapResponse = await fetchWorker(makeRequest('/session-config'), env);
	const bootstrap = await bootstrapResponse.json();
	assert.equal(bootstrapResponse.status, 200, JSON.stringify(bootstrap));
	assert.equal(bootstrap.config.sessionModeProfile.preset, 'fast_cheap_cloudflare');
	assert.equal(bootstrap.config.storageProfile.payloadAccessControl.encryption, 'worker_envelope');
	assert.doesNotMatch(JSON.stringify(bootstrap), /token-hmac-fixture|envelope-kek-fixture/);

	const adminToken = await login({ env, wallet: admin });
	const participantToken = await login({ env, wallet: participant });
	const marker = 'credential-free bundle runtime plaintext marker';
	const uploadResponse = await fetchWorker(
		makeRequest('/storage/upload', {
			method: 'POST',
			token: participantToken,
			body: {
				data: marker,
				contentType: 'text/plain',
				resource: 'responses',
			},
		}),
		env,
	);
	const uploaded = await uploadResponse.json();
	assert.equal(uploadResponse.status, 200, JSON.stringify(uploaded));
	assert.equal(uploaded.storageRef.backend, 'cloudflare');
	assert.equal(typeof uploaded.storageRef.id, 'string');

	const readPath = `/storage/read?id=${encodeURIComponent(uploaded.storageRef.id)}&resource=responses`;
	const participantRead = await fetchWorker(
		makeRequest(readPath, {
			token: participantToken,
		}),
		env,
	);
	assert.equal(participantRead.status, 200, await participantRead.clone().text());
	assert.equal(await participantRead.text(), marker);

	const anonymousRead = await fetchWorker(makeRequest(readPath), env);
	assert.equal(anonymousRead.status, 403);
	assert.doesNotMatch(await anonymousRead.text(), new RegExp(marker));

	const participantExport = await fetchWorker(
		makeRequest('/storage/export-envelopes', {
			token: participantToken,
		}),
		env,
	);
	assert.equal(participantExport.status, 403);

	const adminExport = await fetchWorker(
		makeRequest('/storage/export-envelopes', {
			token: adminToken,
		}),
		env,
	);
	const exportedText = await adminExport.text();
	assert.equal(adminExport.status, 200, exportedText);
	assert.match(exportedText, /ciphertextBase64url/);
	assert.doesNotMatch(exportedText, new RegExp(marker));

	const persistedStorage = JSON.stringify([...storageKv.dump()]);
	assert.match(persistedStorage, /payloadBase64url/);
	assert.match(persistedStorage, /AES-256-GCM/);
	assert.doesNotMatch(persistedStorage, new RegExp(marker));
});
