import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import sessionWorker, { SessionWriteCoordinator } from './worker.js';

// End-to-end checks against the real Worker entry with in-memory KV and the
// real session coordinator, shaped like a public evaluator session.
const SLUG = 'hardening-session';
const SESSION_ID = '0x0123456789abcdef0123456789abcdef';
const WORKER_ORIGIN = 'https://worker.example';
const APP_ORIGIN = 'https://app.example';

const cloneValue = (value) => (value === undefined ? undefined : structuredClone(value));

const createMemoryKv = (seed = {}) => {
	const values = new Map(Object.entries(seed));
	return {
		values,
		async get(key, typeOrOptions) {
			const value = values.has(key) ? values.get(key) : null;
			const type = typeof typeOrOptions === 'string' ? typeOrOptions : typeOrOptions?.type;
			if (value == null || !type || type === 'text') return value;
			if (type === 'json') return JSON.parse(value);
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
		setAlarm: async () => {},
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

const payloadAccessControl = Object.freeze({ gate: 'none', encryption: 'none' });

const buildPublicSessionConfig = ({ admin, overrides = {} }) => ({
	slug: SLUG,
	sessionId: SESSION_ID,
	configRevision: 'hardening-v1',
	sessionName: 'Hardening session',
	adminAddress: admin,
	allowOrigins: [APP_ORIGIN],
	sessionModeProfile: {
		profileVersion: 1,
		preset: 'fast_cheap_cloudflare',
		authority: { mode: 'worker_canonical' },
		evm: { registryChainId: null },
		storage: { backend: 'cloudflare', payloadAccessControl },
		identity: { default: 'passkey', enabled: ['passkey'] },
		authorization: { mechanisms: ['worker_roles'] },
		encryption: { mode: 'none' },
		surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
		results: { visibility: 'public_full_if_storage_public' },
	},
	storageProfile: {
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
		payloadAccessControl,
	},
	workerAuthority: { version: 1, participantScopes: ['storage', 'groups'], anonymousScopes: ['ai'] },
	...overrides,
});

const createSessionEnv = ({ configOverrides = {} } = {}) => {
	const admin = Wallet.createRandom();
	const config = buildPublicSessionConfig({ admin: admin.address, overrides: configOverrides });
	const instances = new Map();
	const env = {
		GROUP_KV: createMemoryKv({ [`session:${SLUG}:config`]: JSON.stringify(config) }),
		CE_STORAGE_INDEX_KV: createMemoryKv(),
		TOKEN_HMAC_SECRET: 'hardening-token-hmac-secret',
		DEFAULT_SESSION_SLUG: SLUG,
		CE_SESSION_COORDINATOR: {
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
		},
	};
	return { admin, config, env };
};

const fetchWorker = (request, env) => sessionWorker.fetch(request, env, { waitUntil() {} });

const makeRequest = (path, { method = 'GET', token = '', body, origin = APP_ORIGIN } = {}) => {
	const headers = new Headers();
	if (origin) headers.set('Origin', origin);
	if (token) headers.set('Authorization', `Bearer ${token}`);
	if (body !== undefined) headers.set('Content-Type', 'application/json');
	return new Request(`${WORKER_ORIGIN}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
};

const readJson = async (response) => ({ status: response.status, body: await response.json() });

const requestNonce = async ({ env, address }) =>
	readJson(await fetchWorker(makeRequest('/auth/nonce', {
		method: 'POST',
		body: { address, sessionSlug: SLUG, sessionId: SESSION_ID },
	}), env));

// The exact message shape the current client builds in workerAuth.ts.
const buildClientSiweMessage = ({ address, nonce }) => {
	const issuedAt = new Date(Date.now() - 10_000).toISOString();
	const expirationTime = new Date(Date.now() + 3_600_000).toISOString();
	return `${new URL(APP_ORIGIN).host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Context Engine.\n\nURI: ${APP_ORIGIN}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}\nResources:\n- ${WORKER_ORIGIN}\n- urn:context-engine:session:id:${SESSION_ID}`;
};

const loginWithMessage = async ({ env, wallet, message }) =>
	readJson(await fetchWorker(makeRequest('/auth/login', {
		method: 'POST',
		body: {
			address: wallet.address,
			sessionSlug: SLUG,
			sessionId: SESSION_ID,
			message,
			signature: await wallet.signMessage(message),
		},
	}), env));

test('a stranger requesting a nonce for a wallet does not cancel the owner pending login', async () => {
	const { env } = createSessionEnv();
	const owner = Wallet.createRandom();

	const ownerNonce = await requestNonce({ env, address: owner.address });
	assert.equal(ownerNonce.status, 200);
	// The stranger only knows the public address.
	assert.equal((await requestNonce({ env, address: owner.address })).status, 200);

	const login = await loginWithMessage({
		env,
		wallet: owner,
		message: buildClientSiweMessage({ address: owner.address, nonce: ownerNonce.body.nonce }),
	});
	assert.equal(login.status, 200, JSON.stringify(login.body));
	assert.equal(typeof login.body.token, 'string');
});

const login = async ({ env, wallet }) => {
	const nonce = await requestNonce({ env, address: wallet.address });
	assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
	const result = await loginWithMessage({
		env,
		wallet,
		message: buildClientSiweMessage({ address: wallet.address, nonce: nonce.body.nonce }),
	});
	assert.equal(result.status, 200, JSON.stringify(result.body));
	return result.body.token;
};

const uploadJson = async ({ env, token, resource, data }) =>
	readJson(await fetchWorker(makeRequest('/storage/upload', {
		method: 'POST',
		token,
		body: { data, contentType: 'application/json', resource },
	}), env));

const listResource = async ({ env, resource }) =>
	readJson(await fetchWorker(new Request(`${WORKER_ORIGIN}/storage/list?resource=${resource}`), env));

test('a participant cannot store a 15 MiB answer that every results viewer would download', async () => {
	const { env } = createSessionEnv();
	const token = await login({ env, wallet: Wallet.createRandom() });

	const upload = await uploadJson({
		env,
		token,
		resource: 'responses',
		data: { questionID: 'q-official-1', answer: 'Agree', comment: 'x'.repeat(15 * 1024 * 1024), sessionId: SESSION_ID, sessionSlug: SLUG },
	});
	assert.equal(upload.status, 413, JSON.stringify(upload.body).slice(0, 200));
	assert.deepEqual((await listResource({ env, resource: 'responses' })).body.items, []);

	const shapeless = await uploadJson({ env, token, resource: 'responses', data: { comment: 'no question' } });
	assert.equal(shapeless.status, 400);
	const accepted = await uploadJson({ env, token, resource: 'responses', data: { questionID: 'q-official-1', answer: 'Agree' } });
	assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
});
