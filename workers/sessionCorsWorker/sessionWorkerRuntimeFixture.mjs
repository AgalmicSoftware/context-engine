import assert from 'node:assert/strict';

import { Wallet } from 'ethers';
import sessionWorker, { SessionWriteCoordinator } from './worker.js';
import { ADMIN_ACTION_TYPES, buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';

// Tests against the real Worker entry with in-memory KV and the real session
// coordinator, signing in exactly as the web client does.
export const SLUG = 'runtime-session';
export const SESSION_ID = '0x0123456789abcdef0123456789abcdef';
export const WORKER_ORIGIN = 'https://worker.example';
export const APP_ORIGIN = 'https://app.example';

const cloneValue = (value) => (value === undefined ? undefined : structuredClone(value));

export const createMemoryKv = (seed = {}) => {
  const values = new Map(Object.entries(seed));
  return {
    values,
    async get(key, typeOrOptions) {
      // Cloudflare's bulk get: up to 100 keys in one call, answered as a Map.
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
    list: async ({ prefix = '' } = {}) => new Map([...target].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, cloneValue(value)])),
  });
  return {
    get: (key) => enqueue(() => view(values).get(key)),
    put: (key, value) => enqueue(() => view(values).put(key, value)),
    delete: (key) => enqueue(() => view(values).delete(key)),
    list: (options) => enqueue(() => view(values).list(options)),
    setAlarm: async () => {},
    getAlarm: async () => null,
    transaction: (callback) => enqueue(async () => {
      const staged = new Map([...values].map(([key, value]) => [key, cloneValue(value)]));
      const result = await callback(view(staged));
      values.clear();
      for (const [key, value] of staged) values.set(key, value);
      return result;
    }),
  };
};

const payloadAccessControl = Object.freeze({ gate: 'none', encryption: 'none' });

export const buildPublicSessionConfig = ({ admin, overrides = {} }) => ({
  slug: SLUG,
  sessionId: SESSION_ID,
  configRevision: 'runtime-v1',
  sessionName: 'Runtime session',
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
      docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active',
      generatedArtifacts: 'active', media: 'active', images: 'active',
    },
    payloadAccessControl,
  },
  workerAuthority: { version: 1, participantScopes: ['storage', 'groups'], anonymousScopes: ['ai'] },
  ...overrides,
});

// `onCoordinatorFetch` sees every coordinator call, for request budgets.
export const createSessionEnv = ({ configOverrides = {}, onCoordinatorFetch } = {}) => {
  const admin = Wallet.createRandom();
  const config = buildPublicSessionConfig({ admin: admin.address, overrides: configOverrides });
  const instances = new Map();
  const env = {
    GROUP_KV: createMemoryKv({ [`session:${SLUG}:config`]: JSON.stringify(config) }),
    CE_STORAGE_INDEX_KV: createMemoryKv(),
    TOKEN_HMAC_SECRET: 'runtime-token-hmac-secret',
    DEFAULT_SESSION_SLUG: SLUG,
    CE_SESSION_COORDINATOR: {
      idFromName: (name) => `memory:${name}`,
      get: (id) => {
        if (!instances.has(id)) {
          const coordinator = new SessionWriteCoordinator({ storage: createDurableStorage() }, env);
          instances.set(id, {
            fetch: (input, init) => {
              const request = input instanceof Request ? input : new Request(input, init);
              onCoordinatorFetch?.(request);
              return coordinator.fetch(request);
            },
          });
        }
        return instances.get(id);
      },
    },
  };
  return { admin, config, env };
};

export const fetchWorker = (request, env) => sessionWorker.fetch(request, env, { waitUntil() {} });

export const makeRequest = (path, { method = 'GET', token = '', body, origin = APP_ORIGIN } = {}) => {
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

export const readJson = async (response) => ({ status: response.status, body: await response.json() });

const requestNonce = async ({ env, address, adminAction = false }) => readJson(await fetchWorker(makeRequest('/auth/nonce', {
  method: 'POST',
  body: { address, sessionSlug: SLUG, sessionId: SESSION_ID, ...(adminAction ? { adminAction: true } : {}) },
}), env));

// The exact message shape the web client builds in workerAuth.ts.
const buildClientSiweMessage = ({ address, nonce }) => {
  const issuedAt = new Date(Date.now() - 10_000).toISOString();
  const expirationTime = new Date(Date.now() + 3_600_000).toISOString();
  return `${new URL(APP_ORIGIN).host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Context Engine.\n\nURI: ${APP_ORIGIN}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}\nResources:\n- ${WORKER_ORIGIN}\n- urn:context-engine:session:id:${SESSION_ID}`;
};

export const login = async ({ env, wallet }) => {
  const nonce = await requestNonce({ env, address: wallet.address });
  assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
  const message = buildClientSiweMessage({ address: wallet.address, nonce: nonce.body.nonce });
  const result = await readJson(await fetchWorker(makeRequest('/auth/login', {
    method: 'POST',
    body: { address: wallet.address, sessionSlug: SLUG, sessionId: SESSION_ID, message, signature: await wallet.signMessage(message) },
  }), env));
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.token;
};

export const uploadJson = async ({ env, token, resource, data, requestId }) => readJson(await fetchWorker(makeRequest('/storage/upload', {
  method: 'POST',
  token,
  body: { data, contentType: 'application/json', resource, ...(requestId ? { requestId } : {}) },
}), env));

export const signedAdminRequest = async ({ env, wallet, action, body = {}, expiration = Math.floor(Date.now() / 1000) + 300 }) => {
  const nonce = await requestNonce({ env, address: wallet.address, adminAction: true });
  assert.equal(nonce.status, 200, JSON.stringify(nonce.body));
  const unsigned = { address: wallet.address, sessionSlug: SLUG, sessionId: SESSION_ID, ...body };
  const typedData = buildAdminActionTypedData({
    action,
    slug: SLUG,
    bodyHash: buildAdminActionBodyHash(unsigned),
    nonce: nonce.body.nonce,
    audience: APP_ORIGIN,
    expiration,
  });
  const signature = await wallet.signTypedData(typedData.domain, ADMIN_ACTION_TYPES, typedData.message);
  return readJson(await fetchWorker(makeRequest(`/admin/${action}`, {
    method: 'POST',
    body: { ...unsigned, ...typedData.message, signature },
  }), env));
};
