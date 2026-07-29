import { ethers } from 'ethers';
import { webcrypto } from 'crypto';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';
import {
  createMemoryKv,
  issueWorkerLoginToken,
} from '../helpers/sessionCorsWorkerTestUtils.mjs';

const SESSION_CONFIG_KEY = (slug) => `session:${slug}:config`;
const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
const RPC_URL = 'https://rpc.example';

const makeRequest = (path, init = {}) => new Request(`https://worker.example${path}`, init);

const buildOpenSessionConfig = (overrides = {}) => ({
  registryAddress: REGISTRY_ADDRESS,
  registryChainId: 84532,
  rpcUrl: RPC_URL,
  ...overrides,
});

const buildWorkerCanonicalModeConfig = () => {
  const payloadAccessControl = { gate: 'none', encryption: 'none' };
  return {
    sessionModeProfile: {
      profileVersion: 1,
      preset: 'custom',
      authority: { mode: 'worker_canonical' },
      evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl },
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
    },
    storageProfile: { backend: 'cloudflare', payloadAccessControl },
  };
};

describe('sessionCorsWorker /health and request validation routes', () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');

  beforeAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('rejects /health when the Authorization header is missing', async () => {
    const response = await sessionCorsWorker.fetch(
      makeRequest('/health', { method: 'GET' }),
      { GROUP_KV: createMemoryKv(), TOKEN_HMAC_SECRET: 'test-secret' },
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error).toBe('Missing Authorization header.');
  });

  it('rejects /health with reflected default base headers before auth when Origin is present', async () => {
    const response = await sessionCorsWorker.fetch(
      makeRequest('/health', {
        method: 'GET',
        headers: {
          Origin: 'https://app.example',
        },
      }),
      { GROUP_KV: createMemoryKv(), TOKEN_HMAC_SECRET: 'test-secret' },
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error).toBe('Missing Authorization header.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('returns a redacted worker-canonical session bootstrap through the public CORS route', async () => {
    const sessionSlug = 'worker-bootstrap';
    const env = {
      GROUP_KV: createMemoryKv({
        [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
          slug: sessionSlug,
          sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          configRevision: 'revision-a',
          sessionName: 'Worker Bootstrap',
          corsWorkerUrl: 'https://worker.example',
          allowOrigins: ['https://app.example'],
          ...buildWorkerCanonicalModeConfig(),
          workerAuthority: { version: 1, participantScopes: ['storage'] },
          rpcUrl: 'https://rpc.example/secret',
          litCredentials: { litActionCid: 'secret-cid' },
          secrets: { openaiKey: 'sk-secret' },
        }),
      }),
    };

    const response = await sessionCorsWorker.fetch(
      makeRequest('/session-config', {
        method: 'GET',
        headers: {
          Origin: 'https://app.example',
          'X-Session-Slug': sessionSlug,
        },
      }),
      env,
      {},
    );
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(payload).toMatchObject({
      ok: true,
      sessionSlug,
      config: {
        slug: sessionSlug,
        sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        configRevision: 'revision-a',
        sessionName: 'Worker Bootstrap',
      },
    });
    expect(serialized).not.toContain('sk-secret');
    expect(serialized).not.toContain('secret-cid');
    expect(serialized).not.toContain('rpc.example');
  });

  it('returns /health for a valid token even if the session config is later removed', async () => {
    const sessionSlug = 'health-check';
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildOpenSessionConfig()),
    });
    const env = {
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    };
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    await env.GROUP_KV.delete(SESSION_CONFIG_KEY(sessionSlug));

    const response = await sessionCorsWorker.fetch(
      makeRequest('/health', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: 'https://blocked.example',
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload?.ok).toBe(true);
    expect(typeof payload?.ts).toBe('number');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://blocked.example');
  });

  it('rejects /health when the requested slug header does not match the token slug', async () => {
    const sessionSlug = 'health-auth';
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildOpenSessionConfig()),
    });
    const env = {
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    };
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeRequest('/health', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': 'other-session',
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token does not match requested session slug.');
  });

  it('rejects anonymous /ai requests when no explicit session slug is provided', async () => {
    const response = await sessionCorsWorker.fetch(
      makeRequest('/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'ping' }),
      }),
      { GROUP_KV: createMemoryKv() },
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing sessionSlug.');
  });

  it('rejects anonymous /ai requests when the session config is missing for the requested slug', async () => {
    const response = await sessionCorsWorker.fetch(
      makeRequest('/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Slug': 'missing-session',
        },
        body: JSON.stringify({ prompt: 'ping' }),
      }),
      { GROUP_KV: createMemoryKv() },
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload?.error).toBe('Session config not found.');
  });

  it('rejects disallowed origins before anonymous /ai body parsing and omits ACAO', async () => {
    const sessionSlug = 'cors-reject';
    const env = {
      GROUP_KV: createMemoryKv({
        [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildOpenSessionConfig({
          allowOrigins: ['https://allowed.example'],
        })),
      }),
    };

    const response = await sessionCorsWorker.fetch(
      makeRequest('/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Slug': sessionSlug,
          Origin: 'https://blocked.example',
        },
        body: '{not-json',
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns invalid JSON with reflected ACAO when anonymous /ai origin is allowed', async () => {
    const sessionSlug = 'cors-allowed';
    const env = {
      GROUP_KV: createMemoryKv({
        [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildOpenSessionConfig({
          allowOrigins: ['https://allowed.example'],
        })),
      }),
    };

    const response = await sessionCorsWorker.fetch(
      makeRequest('/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        body: '{bad-json',
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Invalid JSON.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects anonymous /ai requests with non-json content types after passing CORS', async () => {
    const sessionSlug = 'content-type-check';
    const env = {
      GROUP_KV: createMemoryKv({
        [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildOpenSessionConfig({
          allowOrigins: ['https://allowed.example'],
        })),
      }),
    };

    const response = await sessionCorsWorker.fetch(
      makeRequest('/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        body: 'prompt=ping',
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Expected application/json.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });
});
