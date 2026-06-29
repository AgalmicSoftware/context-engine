import { ethers } from 'ethers';
import { webcrypto } from 'crypto';
import {
  buildRpcFetchMock,
  createMemoryKv,
  createSignedSiweBody,
  issueWorkerLoginToken,
} from '../helpers/sessionCorsWorkerTestUtils.mjs';

const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
const RPC_URL = 'https://rpc.example';
const SESSION_CONFIG_KEY = (slug) => `session:${slug}:config`;
const SESSION_SECRETS_KEY = (slug) => `session:${slug}:secrets`;

const buildSessionConfig = (overrides = {}) => ({
  registryAddress: REGISTRY_ADDRESS,
  registryChainId: 84532,
  networkChainId: 84532,
  rpcUrl: RPC_URL,
  rpcUrlsByChainId: {
    '84532': [RPC_URL],
  },
  ...overrides,
});

const buildMockArweave = () => {
  const tx = {
    id: 'arweave-tx-123',
    tags: [],
    addTag(name, value) {
      this.tags.push({ name, value });
    },
  };
  return {
    tx,
    api: {
      createTransaction: jest.fn(async () => tx),
      transactions: {
        sign: jest.fn(async () => {}),
        getUploader: jest.fn(async () => ({
          isComplete: true,
          uploadChunk: jest.fn(async () => {}),
        })),
        post: jest.fn(async () => ({ status: 200 })),
      },
    },
  };
};

const loadWorkerWithArweaveMock = () => {
  jest.resetModules();
  const mockArweave = buildMockArweave();
  const mockInit = jest.fn(() => mockArweave.api);
  jest.doMock('arweave/web', () => ({
    __esModule: true,
    init: mockInit,
    default: { init: mockInit },
  }), { virtual: true });
  jest.doMock('arweave', () => ({
    __esModule: true,
    init: mockInit,
    default: { init: mockInit },
  }));
  const worker = require('../../workers/sessionCorsWorker/worker.js').default;
  return { worker, mockArweave, mockInit };
};

const createWorkerEnv = ({ sessionSlug, config, secrets, tokenSecret = 'test-secret' }) => {
  const seed = {};
  if (config !== undefined) {
    seed[SESSION_CONFIG_KEY(sessionSlug)] = JSON.stringify(config);
  }
  if (secrets !== undefined) {
    seed[SESSION_SECRETS_KEY(sessionSlug)] = JSON.stringify(secrets);
  }
  return {
    GROUP_KV: createMemoryKv(seed),
    TOKEN_HMAC_SECRET: tokenSecret,
  };
};

const createUploadJsonRequest = ({ headers = {}, body }) => new Request('https://worker.example/arweave/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
  body: JSON.stringify(body),
});

const createMultipartRequestLike = ({ headers = {}, formData, cloneFormData }) => {
  const requestHeaders = new Headers({
    'Content-Type': 'multipart/form-data; boundary=mock',
    ...headers,
  });
  return {
    url: 'https://worker.example/arweave/upload',
    method: 'POST',
    headers: requestHeaders,
    formData: formData || (async () => new FormData()),
    clone: () => ({
      formData: cloneFormData || formData || (async () => new FormData()),
    }),
  };
};

const createFieldMapMultipartRequest = ({ headers = {}, fields = {} }) => {
  const buildFormData = async () => {
    const entries = new Map(
      Object.entries(fields).filter(([, value]) => value != null)
    );
    return {
      get: (key) => (entries.has(key) ? entries.get(key) : null),
      has: (key) => entries.has(key),
    };
  };

  return createMultipartRequestLike({
    headers,
    formData: buildFormData,
    cloneFormData: buildFormData,
  });
};

describe('sessionCorsWorker arweave upload routes', () => {
  const originalCrypto = global.crypto;
  const originalFetch = global.fetch;
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  let sessionCorsWorker;
  let mockArweave;

  beforeAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  });

  beforeEach(() => {
    const loaded = loadWorkerWithArweaveMock();
    sessionCorsWorker = loaded.worker;
    mockArweave = loaded.mockArweave;
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

  it('rejects bootstrap uploads when session config is missing and no arweaveJwk is provided', async () => {
    const sessionSlug = 'arweave-bootstrap-missing-config';
    const env = createWorkerEnv({ sessionSlug });
    const authBody = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        body: {
          ...authBody,
          data: { prompt: 'ping' },
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload?.error).toBe(
      'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.'
    );
  });

  it('allows bootstrap uploads with a caller-provided arweaveJwk when no session config exists', async () => {
    const sessionSlug = 'arweave-bootstrap-success';
    const env = createWorkerEnv({ sessionSlug });
    const authBody = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        body: {
          ...authBody,
          data: { prompt: 'bootstrap' },
          arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }),
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ id: 'arweave-tx-123' });
    expect(mockArweave.api.createTransaction).toHaveBeenCalled();
    expect(mockArweave.api.transactions.sign).toHaveBeenCalled();
  });

  it('allows bootstrap multipart uploads with a caller-provided arweaveJwk when no session config exists', async () => {
    const sessionSlug = 'arweave-bootstrap-multipart-success';
    const env = createWorkerEnv({ sessionSlug });
    const authBody = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
    });

    const response = await sessionCorsWorker.fetch(
      createFieldMapMultipartRequest({
        fields: {
          address: authBody.address,
          message: authBody.message,
          signature: authBody.signature,
          requestId: ' bootstrap-req-1 ',
          sessionSlug,
          arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }),
          data: {
            type: 'application/json',
            arrayBuffer: async () => new TextEncoder().encode(
              JSON.stringify({ prompt: 'bootstrap-multipart' })
            ).buffer,
          },
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ id: 'arweave-tx-123' });
    expect(mockArweave.api.createTransaction).toHaveBeenCalled();
    expect(mockArweave.api.transactions.sign).toHaveBeenCalled();
  });

  it('treats invalid non-bearer Authorization headers as authenticated arweave uploads before bootstrap parsing', async () => {
    const sessionSlug = 'arweave-invalid-auth-header';
    const env = createWorkerEnv({ sessionSlug });
    const authBody = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: 'Token nope',
        },
        body: {
          ...authBody,
          data: { prompt: 'ping' },
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error).toBe('Missing Authorization header.');
  });

  it('rejects authenticated uploads when the token lacks arweave scope', async () => {
    const sessionSlug = 'arweave-no-scope';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ scopes: { arweave: false } }),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: { data: { prompt: 'ping' } },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token missing arweave scope.');
  });

  it('rejects authenticated uploads when session secrets are missing', async () => {
    const sessionSlug = 'arweave-missing-secrets';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: { data: { prompt: 'ping' } },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error).toBe('Session secrets not configured.');
  });

  it('rejects authenticated uploads when the session config disappears after token issuance', async () => {
    const sessionSlug = 'arweave-config-deleted';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
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
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: { data: { prompt: 'ping' } },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload?.error).toBe('Session config not found.');
  });

  it('rejects authenticated uploads on blocked origins and omits ACAO', async () => {
    const sessionSlug = 'arweave-cors-blocked';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
          Origin: 'https://blocked.example',
        },
        body: { data: { prompt: 'ping' } },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects authenticated uploads with invalid tags JSON', async () => {
    const sessionSlug = 'arweave-invalid-tags';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        body: {
          data: { prompt: 'ping' },
          tags: '{bad-json',
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Invalid tags JSON.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated uploads with non-CE custom tags', async () => {
    const sessionSlug = 'arweave-invalid-custom-tag-prefix';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        body: {
          data: { prompt: 'ping' },
          tags: [{ name: 'X-Test', value: 'bad' }],
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Custom tags must start with CE-');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated uploads when JSON data is missing', async () => {
    const sessionSlug = 'arweave-missing-data';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: { contentType: 'application/json' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing "data" in JSON body');
  });

  it('rejects authenticated uploads with unsupported content types', async () => {
    const sessionSlug = 'arweave-bad-content-type';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      new Request('https://worker.example/arweave/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
          'Content-Type': 'text/plain',
        },
        body: 'hello',
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Unsupported Content-Type');
  });

  it('allows authenticated uploads with worker-stored arweaveJwk', async () => {
    const sessionSlug = 'arweave-auth-success';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        body: {
          data: { prompt: 'authenticated-upload' },
          contentType: 'application/json',
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ id: 'arweave-tx-123' });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
    expect(mockArweave.api.createTransaction).toHaveBeenCalled();
  });

  it('fails closed when authenticated uploads provide an invalid arweaveJwk override even if worker secrets are valid', async () => {
    const sessionSlug = 'arweave-auth-invalid-request-jwk';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        body: {
          data: { prompt: 'authenticated-upload' },
          contentType: 'application/json',
          arweaveJwk: '{bad-json',
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload?.error).toBe('Invalid arweaveJwk (must be JSON)');
    expect(mockArweave.api.createTransaction).not.toHaveBeenCalled();
  });

  it('allows authenticated multipart uploads with worker-stored arweaveJwk', async () => {
    const sessionSlug = 'arweave-auth-multipart-success';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createFieldMapMultipartRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        fields: {
          requestId: ' auth-multipart-1 ',
          contentType: 'application/json',
          tags: '[{"name":"CE-Test","value":"ok"}]',
          data: {
            type: 'application/json',
            arrayBuffer: async () => new TextEncoder().encode(
              JSON.stringify({ prompt: 'authenticated-multipart-upload' })
            ).buffer,
          },
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ id: 'arweave-tx-123' });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
    expect(mockArweave.tx.tags).toEqual(expect.arrayContaining([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'CE-Test', value: 'ok' },
    ]));
  });

  it('rejects authenticated uploads when CE-SessionId does not match the authenticated session', async () => {
    const sessionSlug = 'arweave-session-id-mismatch';
    const expectedSessionId = '0x11111111111111111111111111111111';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    global.fetch = buildRpcFetchMock({
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
      sessionsBySlug: {
        [sessionSlug]: { sessionIdHex: expectedSessionId },
      },
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: {
          data: { prompt: 'ping' },
          tags: [{ name: 'CE-SessionId', value: '0x22222222222222222222222222222222' }],
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('CE-SessionId does not match authenticated session.');
  });

  it('allows authenticated uploads when CE-SessionId matches and normalizes it onto the transaction', async () => {
    const sessionSlug = 'arweave-session-id-match';
    const expectedSessionId = '0x11111111111111111111111111111111';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    global.fetch = buildRpcFetchMock({
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
      sessionsBySlug: {
        [sessionSlug]: { sessionIdHex: expectedSessionId },
      },
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: {
          data: { prompt: 'ping' },
          tags: [{ name: 'CE-SessionId', value: expectedSessionId }],
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ id: 'arweave-tx-123' });
    expect(mockArweave.tx.tags).toEqual(expect.arrayContaining([
      { name: 'CE-SessionId', value: expectedSessionId },
    ]));
  });

  it('rejects authenticated uploads when CE-SbtChainId and CE-SbtAddress are not provided together', async () => {
    const sessionSlug = 'arweave-sbt-missing-pair';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: {
          data: { prompt: 'ping' },
          tags: [{ name: 'CE-SbtChainId', value: '84532' }],
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('CE-SbtChainId and CE-SbtAddress must be provided together.');
  });

  it('rejects authenticated uploads when CE-SbtChainId has no mapped rpc url', async () => {
    const sessionSlug = 'arweave-sbt-missing-rpc';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: {
          data: { prompt: 'ping' },
          tags: [
            { name: 'CE-SbtChainId', value: '10' },
            { name: 'CE-SbtAddress', value: '0x0000000000000000000000000000000000000101' },
          ],
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Missing RPC URL for chainId 10.');
  });

  it('rejects authenticated uploads when the uploader is not authorized for the tagged SBT group', async () => {
    const sessionSlug = 'arweave-sbt-unauthorized';
    const sbtAddress = '0x0000000000000000000000000000000000000101';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    global.fetch = buildRpcFetchMock({
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
      balancesByToken: {
        [sbtAddress.toLowerCase()]: 0,
      },
      sbtAdminByToken: {
        [sbtAddress.toLowerCase()]: {
          admin: '0x00000000000000000000000000000000000000aa',
          owner: '0x00000000000000000000000000000000000000bb',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: {
          data: { prompt: 'ping' },
          tags: [
            { name: 'CE-SbtChainId', value: '84532' },
            { name: 'CE-SbtAddress', value: sbtAddress },
          ],
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Uploader is not authorized to associate this SBT group.');
  });

  it('allows authenticated uploads when the uploader holds the tagged SBT group', async () => {
    const sessionSlug = 'arweave-sbt-authorized';
    const sbtAddress = '0x0000000000000000000000000000000000000101';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    global.fetch = buildRpcFetchMock({
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
      balancesByToken: {
        [`${sbtAddress.toLowerCase()}:${wallet.address.toLowerCase()}`]: 1,
      },
    });

    const response = await sessionCorsWorker.fetch(
      createUploadJsonRequest({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        body: {
          data: { prompt: 'ping' },
          tags: [
            { name: 'CE-SbtChainId', value: '84532' },
            { name: 'CE-SbtAddress', value: sbtAddress },
          ],
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ id: 'arweave-tx-123' });
    expect(mockArweave.tx.tags).toEqual(expect.arrayContaining([
      { name: 'CE-SbtChainId', value: '84532' },
      { name: 'CE-SbtAddress', value: sbtAddress.toLowerCase() },
    ]));
  });

  it('rejects bootstrap multipart uploads when form parsing fails', async () => {
    const response = await sessionCorsWorker.fetch(
      createMultipartRequestLike({
        cloneFormData: async () => {
          throw new Error('bad multipart');
        },
      }),
      createWorkerEnv({ sessionSlug: 'arweave-bootstrap-form-error' }),
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Expected multipart/form-data.');
  });

  it('rejects authenticated multipart uploads when file/data is missing', async () => {
    const sessionSlug = 'arweave-auth-multipart-missing-file';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { arweaveJwk: JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' }) },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      createMultipartRequestLike({
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Session-Slug': sessionSlug,
        },
        formData: async () => new FormData(),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing "file" or "data" field');
  });
});
