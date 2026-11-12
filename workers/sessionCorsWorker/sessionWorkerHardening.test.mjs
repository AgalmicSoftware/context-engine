import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import sessionWorker, { SessionWriteCoordinator } from './worker.js';
import { ADMIN_ACTION_TYPES, buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';
import { loadWorkerCanonicalResultsAnalysisSource } from './resultsAnalysisGeneration.js';
import {
	decryptPayloadWithStorageEnvelope,
	encryptPayloadWithStorageEnvelope,
	ensureStorageEnvelopeSessionKey,
} from './storageEnvelopeEncryption.js';
import { buildIndexKey, buildPayloadKey } from './storageRouteExecution.js';
import { signToken } from './tokenSigning.js';

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
			if (Array.isArray(key)) return new Map(await Promise.all(key.map(async (name) => [name, await this.get(name, typeOrOptions)])));
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

const signedAdminRequest = async ({ env, wallet, action, body }) => {
	const nonce = await readJson(await fetchWorker(makeRequest('/auth/nonce', {
		method: 'POST',
		body: { address: wallet.address, sessionSlug: SLUG, sessionId: SESSION_ID, adminAction: true },
	}), env));
	assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
	const unsigned = { address: wallet.address, sessionSlug: SLUG, sessionId: SESSION_ID, ...body };
	const typedData = buildAdminActionTypedData({
		action,
		slug: SLUG,
		bodyHash: buildAdminActionBodyHash(unsigned),
		nonce: nonce.body.nonce,
		audience: APP_ORIGIN,
		expiration: Math.floor(Date.now() / 1000) + 300,
	});
	const signature = await wallet.signTypedData(typedData.domain, ADMIN_ACTION_TYPES, typedData.message);
	return readJson(await fetchWorker(makeRequest(`/admin/${action}`, {
		method: 'POST',
		body: { ...unsigned, ...typedData.message, signature },
	}), env));
};

const readCatalogPrompts = async (env) => {
	const catalog = await readJson(await fetchWorker(new Request(`${WORKER_ORIGIN}/agent/interview-catalog`, {
		headers: { Origin: APP_ORIGIN },
	}), env));
	assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
	return catalog.body.questions.map((question) => question.prompt);
};

test('participants cannot rewrite an official question, and admins can hide one', async () => {
	const { admin, config, env } = createSessionEnv({ configOverrides: { sessionUrl: `${APP_ORIGIN}/session/${SLUG}` } });
	const attacker = Wallet.createRandom();
	const adminToken = await login({ env, wallet: admin });
	const attackerToken = await login({ env, wallet: attacker });
	const question = (prompt) => ({ id: 'q-official-1', prompt, type: 'binary', sessionId: SESSION_ID, sessionSlug: SLUG });

	assert.equal((await uploadJson({ env, token: adminToken, resource: 'questions', data: question('Official: should the pilot continue?') })).status, 200);
	const rewrite = await uploadJson({ env, token: attackerToken, resource: 'questions', data: question('ATTACKER: rewritten prompt') });
	assert.equal(rewrite.status, 409);
	assert.equal(rewrite.body.reason, 'storage_resource_id_owned');

	// A rewrite stored before this release: later, with no recorded uploader.
	const legacyId = 'legacy-attacker-rewrite-0001';
	const legacyMetadata = {
		id: legacyId,
		backend: 'cloudflare',
		resource: 'questions',
		contentType: 'application/json',
		encrypted: false,
		createdAt: new Date(Date.now() + 60_000).toISOString(),
		payloadAccessControl: payloadAccessControl,
	};
	await env.CE_STORAGE_INDEX_KV.put(buildIndexKey({ slug: SLUG, resource: 'questions', id: legacyId }), JSON.stringify(legacyMetadata));
	await env.CE_STORAGE_INDEX_KV.put(buildPayloadKey({ slug: SLUG, id: legacyId }), JSON.stringify({
		metadata: legacyMetadata,
		payloadBase64url: Buffer.from(JSON.stringify(question('ATTACKER: legacy rewrite'))).toString('base64url'),
	}));

	const listed = (await listResource({ env, resource: 'questions' })).body.items;
	assert.equal(listed.length, 2);
	assert.equal(listed.find((item) => item.metadata.uploader)?.metadata.uploader, admin.address.toLowerCase());
	assert.deepEqual(await readCatalogPrompts(env), ['Official: should the pilot continue?']);
	const analysis = await loadWorkerCanonicalResultsAnalysisSource({ env, slug: SLUG, config });
	assert.deepEqual(analysis.snapshot.questions.map((entry) => entry.prompt), ['Official: should the pilot continue?']);

	const forbidden = await signedAdminRequest({
		env, wallet: attacker, action: 'storage/set-hidden', body: { resource: 'questions', id: 'q-official-1', hidden: true },
	});
	assert.equal(forbidden.status, 403);
	const hidden = await signedAdminRequest({
		env, wallet: admin, action: 'storage/set-hidden', body: { resource: 'questions', id: 'q-official-1', hidden: true },
	});
	assert.equal(hidden.status, 200, JSON.stringify(hidden.body));
	assert.deepEqual(hidden.body.hiddenIds, ['q-official-1']);
	assert.equal(hidden.body.matchedRows, 2);
	assert.deepEqual((await listResource({ env, resource: 'questions' })).body.items.map((item) => item.metadata), [
		{ resource: 'questions', resourceId: 'q-official-1', hidden: true },
		{ resource: 'questions', resourceId: 'q-official-1', hidden: true },
	]);
	const afterHide = await loadWorkerCanonicalResultsAnalysisSource({ env, slug: SLUG, config });
	assert.deepEqual(afterHide.snapshot.questions, []);
});

test('login accepts the exact client sign-in message and rejects lenient look-alikes', async () => {
	const { env } = createSessionEnv();
	const wallet = Wallet.createRandom();
	const issuedAt = new Date(Date.now() - 5_000).toISOString();
	const lookAlikes = [
		// An extra free-text line makes wallets show plain text instead of a sign-in request.
		(nonce) => [
			'app.example wants you to sign in with your Ethereum account:',
			wallet.address,
			'',
			'Claim your evaluator reward (no gas).',
			'',
			'URI: https://app.example',
			'Version: 1',
			'Chain ID: 1',
			`Nonce: ${nonce}`,
			`Issued At: ${issuedAt}`,
			'Reward code: 7731',
		].join('\n'),
		// Fields out of order and buried inside prose.
		(nonce) => [
			'app.example wants you to sign in with your Ethereum account:',
			wallet.address,
			`Issued At: ${issuedAt}`,
			'To verify your wallet for the giveaway, sign this text.',
			`Nonce: ${nonce}`,
			'Chain ID: 1',
			'URI: https://app.example',
		].join('\n'),
	];
	for (const build of lookAlikes) {
		const nonce = await requestNonce({ env, address: wallet.address });
		const login = await loginWithMessage({ env, wallet, message: build(nonce.body.nonce) });
		assert.equal(login.status, 400, JSON.stringify(login.body));
		assert.match(login.body.error, /^Malformed SIWE message/);
		assert.equal(login.body.token, undefined);
	}

	const nonce = await requestNonce({ env, address: wallet.address });
	const login = await loginWithMessage({
		env,
		wallet,
		message: buildClientSiweMessage({ address: wallet.address, nonce: nonce.body.nonce }),
	});
	assert.equal(login.status, 200, JSON.stringify(login.body));
});

test('login requires the signed Worker and session binding and keeps the nonce on refusal', async () => {
	const { env } = createSessionEnv();
	const wallet = Wallet.createRandom();
	const nonce = await requestNonce({ env, address: wallet.address });
	const bound = buildClientSiweMessage({ address: wallet.address, nonce: nonce.body.nonce });
	const unbound = bound.slice(0, bound.indexOf('\nResources:'));
	const otherWorker = bound.replace(`- ${WORKER_ORIGIN}`, '- https://other-worker.example');

	for (const message of [unbound, otherWorker]) {
		const refused = await loginWithMessage({ env, wallet, message });
		assert.equal(refused.status, 403, JSON.stringify(refused.body));
		assert.equal(refused.body.error, 'Signed login resources do not match this Worker and session.');
	}
	const login = await loginWithMessage({ env, wallet, message: bound });
	assert.equal(login.status, 200, JSON.stringify(login.body));
});

// Builds a signed admin action where each signed field can be overridden, so
// every refusal below goes through the real Worker entry, not a mocked check.
const buildAdminAction = async ({ env, signer, claimed = signer.address, action, body = {}, signed = {} }) => {
	const nonce = await readJson(await fetchWorker(makeRequest('/auth/nonce', {
		method: 'POST',
		body: { address: claimed, sessionSlug: SLUG, sessionId: SESSION_ID, adminAction: true },
	}), env));
	assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
	const unsigned = { address: claimed, sessionSlug: SLUG, sessionId: SESSION_ID, ...body };
	const typedData = buildAdminActionTypedData({
		action,
		slug: SLUG,
		bodyHash: buildAdminActionBodyHash(unsigned),
		nonce: nonce.body.nonce,
		audience: APP_ORIGIN,
		expiration: Math.floor(Date.now() / 1000) + 300,
		...signed,
	});
	const signature = await signer.signTypedData(typedData.domain, ADMIN_ACTION_TYPES, typedData.message);
	return { ...unsigned, ...typedData.message, signature };
};

const postAdmin = async ({ env, path, body }) =>
	readJson(await fetchWorker(makeRequest(`/admin/${path}`, { method: 'POST', body }), env));

test('signed admin actions are refused when any signed field is forged, stale or replayed', async () => {
	const action = 'storage/set-hidden';
	const body = { resource: 'questions', id: 'q-official-1', hidden: true };
	const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
	const refusals = [
		['forged signer', (admin) => ({ signer: Wallet.createRandom(), claimed: admin.address }), 'Signature does not match address.'],
		['expired action', (admin) => ({ signer: admin, signed: { expiration: tenMinutesAgo } }), 'Admin action expired.'],
		['wrong action', (admin) => ({ signer: admin, signed: { action: 'set-config' } }), 'Admin action mismatch.'],
		['wrong slug', (admin) => ({ signer: admin, signed: { slug: 'other-session' } }), 'Admin slug mismatch.'],
		['wrong audience', (admin) => ({ signer: admin, signed: { audience: 'https://attacker.example' } }), /audience/i],
	];
	// A fresh session per case keeps the nonce rate limit out of the way.
	for (const [label, options, error] of refusals) {
		const { admin, env } = createSessionEnv();
		const refused = await postAdmin({ env, path: action, body: await buildAdminAction({ env, action, body, ...options(admin) }) });
		assert.equal(refused.status, 400, `${label}: ${JSON.stringify(refused.body)}`);
		if (error instanceof RegExp) assert.match(refused.body.error, error, label);
		else assert.equal(refused.body.error, error, label);
	}

	const { admin, env } = createSessionEnv();
	const altered = await buildAdminAction({ env, signer: admin, action, body });
	const tampered = await postAdmin({ env, path: action, body: { ...altered, id: 'q-other' } });
	assert.equal(tampered.status, 400, JSON.stringify(tampered.body));
	assert.equal(tampered.body.error, 'Admin request body mismatch.');

	const genuine = await buildAdminAction({ env, signer: admin, action, body });
	const accepted = await postAdmin({ env, path: action, body: genuine });
	assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
	const replayed = await postAdmin({ env, path: action, body: genuine });
	assert.equal(replayed.status, 400, JSON.stringify(replayed.body));
	assert.match(replayed.body.error, /nonce/i);
});

test('a bearer token with a rewritten payload or a foreign signing key is refused', async () => {
	const { admin, env } = createSessionEnv();
	const token = await login({ env, wallet: Wallet.createRandom() });
	const [payloadPart, signaturePart] = token.split('.');
	const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
	const claimsAdmin = { ...payload, address: admin.address.toLowerCase() };
	const forgedTokens = [
		`${Buffer.from(JSON.stringify(claimsAdmin)).toString('base64url')}.${signaturePart}`,
		await signToken(claimsAdmin, 'not-the-worker-secret'),
	];
	const answer = { questionID: 'q-official-1', answer: 'Agree' };
	for (const forged of forgedTokens) {
		const upload = await uploadJson({ env, token: forged, resource: 'responses', data: answer });
		assert.equal(upload.status, 401, JSON.stringify(upload.body));
	}
	assert.deepEqual((await listResource({ env, resource: 'responses' })).body.items, []);
	assert.equal((await uploadJson({ env, token, resource: 'responses', data: answer })).status, 200);
});

test('envelope encryption draws a fresh key and IV every time', async () => {
	const env = { CE_STORAGE_ENVELOPE_KEK: 'hardening-envelope-kek' };
	const deps = {
		getOrCreateCoordinatedStorageEnvelopeSessionKey: async ({ baseConfig, candidateRecord }) => ({
			config: { ...baseConfig, storageEnvelope: { sessionKey: candidateRecord } },
			created: true,
		}),
	};
	const sessionKey = await ensureStorageEnvelopeSessionKey({ env, config: {}, slug: SLUG, deps });
	assert.equal(sessionKey.keyBytes.length, 32);
	assert.ok(sessionKey.keyBytes.some((byte) => byte !== 0), 'session key is all zeros');

	const plaintext = 'the same answer, stored twice';
	const encrypt = () => encryptPayloadWithStorageEnvelope({
		env, config: sessionKey.config, slug: SLUG, payloadId: 'answer-1',
		plaintextBytes: new TextEncoder().encode(plaintext), contentType: 'text/plain', deps,
	});
	const first = await encrypt();
	const second = await encrypt();
	assert.notEqual(first.envelope.payloadIv, second.envelope.payloadIv);
	assert.notEqual(first.envelope.dek.iv, second.envelope.dek.iv);
	assert.notDeepEqual(first.ciphertextBytes, second.ciphertextBytes);
	for (const encrypted of [first, second]) {
		const decrypted = await decryptPayloadWithStorageEnvelope({
			env, config: sessionKey.config, slug: SLUG, payloadId: 'answer-1',
			ciphertextBytes: encrypted.ciphertextBytes, envelope: encrypted.envelope, deps,
		});
		assert.equal(new TextDecoder().decode(decrypted), plaintext);
	}
});
