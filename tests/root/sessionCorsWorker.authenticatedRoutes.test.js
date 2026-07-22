import { ethers } from 'ethers';
import { webcrypto } from 'crypto';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';
import {
  createMemoryKv,
  issueWorkerLoginToken,
  installSessionCoordinatorBinding,
  installRpcAwareUpstreamFetchMock,
} from '../helpers/sessionCorsWorkerTestUtils.mjs';

const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
const RPC_URL = 'https://rpc.example';
const SESSION_CONFIG_KEY = (slug) => `session:${slug}:config`;
const SESSION_SECRETS_KEY = (slug) => `session:${slug}:secrets`;

const buildSessionConfig = (overrides = {}) => ({
  registryAddress: REGISTRY_ADDRESS,
  registryChainId: 84532,
  rpcUrl: RPC_URL,
  ...overrides,
});

const makeRequest = (path, init = {}) => new Request(`https://worker.example${path}`, init);

const buildAuthHeaders = (token, extra = {}) => ({
  Authorization: `Bearer ${token}`,
  ...extra,
});

const createJsonRequest = ({ token, sessionSlug, body, origin = '' }) => makeRequest('/ai', {
  method: 'POST',
  headers: buildAuthHeaders(token, {
    'Content-Type': 'application/json',
    ...(sessionSlug ? { 'X-Session-Slug': sessionSlug } : {}),
    ...(origin ? { Origin: origin } : {}),
  }),
  body,
});

const createTranscribeRequest = ({ token, sessionSlug, formData, origin = '', contentType }) => {
  const headers = new Headers(buildAuthHeaders(token, {
    ...(sessionSlug ? { 'X-Session-Slug': sessionSlug } : {}),
    ...(origin ? { Origin: origin } : {}),
  }));
  if (contentType) headers.set('Content-Type', contentType);
  return {
    url: 'https://worker.example/transcribe',
    method: 'POST',
    headers,
    formData: async () => formData,
  };
};

const createWorkerEnv = ({ sessionSlug, config, secrets, tokenSecret = 'test-secret' }) => {
  const seed = {
    [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(config),
  };
  if (secrets !== undefined) {
    seed[SESSION_SECRETS_KEY(sessionSlug)] = JSON.stringify(secrets);
  }
  return installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv(seed),
    TOKEN_HMAC_SECRET: tokenSecret,
  });
};

const createAuthOnlyWorkerEnv = (sourceEnv, tokenSecret = 'test-secret') => {
  const authTokenRecords = Object.fromEntries(
    [...sourceEnv.GROUP_KV._dump()]
      .filter(([key]) => String(key || '').startsWith('authToken:'))
  );
  return installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv(authTokenRecords),
    TOKEN_HMAC_SECRET: tokenSecret,
  });
};

describe('sessionCorsWorker authenticated ai/transcribe routes', () => {
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

  it('rejects /ai when the token lacks ai scope', async () => {
    const sessionSlug = 'ai-no-scope';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ scopes: { ai: false } }),
      secrets: { openaiKey: 'sk-openai' },
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
      createJsonRequest({
        token,
        sessionSlug,
        body: JSON.stringify({ provider: 'openai', prompt: 'ping' }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token missing ai scope.');
  });

  it('rejects /transcribe when the token lacks transcribe scope', async () => {
    const sessionSlug = 'transcribe-no-scope';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ scopes: { transcribe: false } }),
      secrets: { openaiKey: 'sk-openai' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const form = new FormData();
    form.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));

    const response = await sessionCorsWorker.fetch(
      createTranscribeRequest({ token, sessionSlug, formData: form }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token missing transcribe scope.');
  });

  it('removes a signed ai scope when current session config disables it', async () => {
    const sessionSlug = 'ai-current-scope-revoked';
    const config = buildSessionConfig({ scopes: { ai: true } });
    const env = createWorkerEnv({
      sessionSlug,
      config,
      secrets: { openaiKey: 'sk-openai' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    await env.GROUP_KV.put(
      SESSION_CONFIG_KEY(sessionSlug),
      JSON.stringify({ ...config, scopes: { ai: false } }),
    );

    const response = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        body: JSON.stringify({ provider: 'openai', prompt: 'must not run' }),
      }),
      env,
      {},
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token missing ai scope.');
  });

  it('rate limits authenticated /ai requests before a second upstream proxy call', async () => {
    const sessionSlug = 'ai-rate-limit';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ limits: { perWalletPerDay: 1 } }),
      secrets: { openaiKey: 'sk-openai' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const upstreamFetch = installRpcAwareUpstreamFetchMock({
      rpcUrl: RPC_URL,
      implementation: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'pong' } }],
      }),
      }),
    });

    const firstResponse = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        body: JSON.stringify({ provider: 'openai', prompt: 'ping' }),
      }),
      env,
      {}
    );
    const secondResponse = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        body: JSON.stringify({ provider: 'openai', prompt: 'again' }),
      }),
      env,
      {}
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(secondPayload?.error).toBe('Rate limit exceeded.');
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects authenticated /ai when session secrets are missing', async () => {
    const sessionSlug = 'ai-missing-secrets';
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
      createJsonRequest({
        token,
        sessionSlug,
        body: JSON.stringify({ provider: 'openai', prompt: 'ping' }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error).toBe('Session secrets not configured.');
  });

  it('rejects authenticated /ai requests with non-json content type after CORS passes', async () => {
    const sessionSlug = 'ai-bad-content-type';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { openaiKey: 'sk-openai' },
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
      makeRequest('/ai', {
        method: 'POST',
        headers: buildAuthHeaders(token, {
          'X-Session-Slug': sessionSlug,
          'Content-Type': 'text/plain',
          Origin: 'https://allowed.example',
        }),
        body: 'ping',
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Expected application/json.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated /ai requests with invalid JSON after CORS passes', async () => {
    const sessionSlug = 'ai-invalid-json';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { openaiKey: 'sk-openai' },
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
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
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

  it('rejects authenticated /ai requests when the origin is not allowed', async () => {
    const sessionSlug = 'ai-origin-blocked';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { openaiKey: 'sk-openai' },
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
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://blocked.example',
        body: JSON.stringify({ provider: 'openai', prompt: 'ping' }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects authenticated /ai when session config is missing after auth succeeds', async () => {
    const sessionSlug = 'ai-missing-config';
    const issuingEnv = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { openaiKey: 'sk-openai' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env: issuingEnv,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const requestEnv = createAuthOnlyWorkerEnv(issuingEnv);

    const response = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        body: JSON.stringify({ provider: 'openai', prompt: 'ping' }),
      }),
      requestEnv,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload?.error).toBe('Session config not found.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated /ai requests with unsupported providers after CORS passes', async () => {
    const sessionSlug = 'ai-unsupported-provider';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: {},
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
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        body: JSON.stringify({ provider: 'bogus', prompt: 'ping' }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Unsupported provider: bogus');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('dispatches authenticated /ai anthropic requests through the extracted provider execution helper', async () => {
    const sessionSlug = 'ai-anthropic-success';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { anthropicKey: 'sk-worker-anthropic' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const upstreamFetch = installRpcAwareUpstreamFetchMock({
      rpcUrl: RPC_URL,
      implementation: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ text: 'pong' }],
      }),
      }),
    });

    const response = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        body: JSON.stringify({
          provider: 'anthropic',
          apiKey: 'sk-request-anthropic',
          prompt: 'ping',
          max_tokens_to_sample: 123,
        }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      completion: 'pong',
      raw: {
        content: [{ text: 'pong' }],
      },
    });
    expect(upstreamFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': 'sk-request-anthropic',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          temperature: 0.7,
          max_tokens: 123,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      }
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('dispatches authenticated /ai openrouter requests through the extracted provider execution helper', async () => {
    const sessionSlug = 'ai-openrouter-success';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { openrouterKey: 'sk-worker-openrouter' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const upstreamFetch = installRpcAwareUpstreamFetchMock({
      rpcUrl: RPC_URL,
      implementation: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'pong' } }],
      }),
      }),
    });

    const response = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        body: JSON.stringify({
          provider: 'openrouter',
          apiKey: 'sk-request-openrouter',
          model: 'openai/o3-mini',
          prompt: 'ping',
          max_tokens: 88,
          appUrl: 'https://app.example',
          appName: 'Context Engine',
        }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      completion: 'pong',
      raw: {
        choices: [{ message: { content: 'pong' } }],
      },
    });
    expect(upstreamFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer sk-request-openrouter',
          'HTTP-Referer': 'https://app.example',
          'X-Title': 'Context Engine',
        },
        body: JSON.stringify({
          model: 'openai/o3-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_completion_tokens: 88,
        }),
      }
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated custom /ai rpcUrl overrides when worker custom secrets are configured', async () => {
    const sessionSlug = 'ai-custom-rpc-override';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: {
        customRpcUrl: 'https://rpc.safe.example/v1/chat/completions',
        customRpcKey: 'sk-worker-secret',
      },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const upstreamFetch = installRpcAwareUpstreamFetchMock({ rpcUrl: RPC_URL });

    const response = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        body: JSON.stringify({
          provider: 'custom',
          model: 'gpt-4o-mini',
          rpcUrl: 'https://rpc.attacker.example/v1/chat/completions',
          prompt: 'ping',
        }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Custom provider rpcUrl override requires a request apiKey/rpcKey.');
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated custom /ai requests when rpcUrl targets an IPv4-mapped IPv6 loopback host', async () => {
    const sessionSlug = 'ai-custom-rpc-ipv4-mapped-loopback';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: {},
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const upstreamFetch = installRpcAwareUpstreamFetchMock({ rpcUrl: RPC_URL });

    const response = await sessionCorsWorker.fetch(
      createJsonRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        body: JSON.stringify({
          provider: 'custom',
          model: 'gpt-4o-mini',
          rpcUrl: 'http://[::ffff:127.0.0.1]/v1/chat/completions',
          apiKey: 'sk-request-key',
          prompt: 'ping',
        }),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Custom RPC must use HTTPS');
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rate limits authenticated /transcribe requests before a second upstream call', async () => {
    const sessionSlug = 'transcribe-rate-limit';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ limits: { perWalletPerDay: 1 } }),
      secrets: { openaiKey: 'sk-openai' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const upstreamFetch = installRpcAwareUpstreamFetchMock({
      rpcUrl: RPC_URL,
      implementation: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: 'pong' }),
      }),
    });

    const buildForm = () => {
      const form = new FormData();
      form.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));
      return form;
    };

    const firstResponse = await sessionCorsWorker.fetch(
      createTranscribeRequest({ token, sessionSlug, formData: buildForm() }),
      env,
      {}
    );
    const secondResponse = await sessionCorsWorker.fetch(
      createTranscribeRequest({ token, sessionSlug, formData: buildForm() }),
      env,
      {}
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(secondPayload?.error).toBe('Rate limit exceeded.');
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects authenticated /transcribe when session secrets are missing', async () => {
    const sessionSlug = 'transcribe-missing-secrets';
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
    const form = new FormData();
    form.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));

    const response = await sessionCorsWorker.fetch(
      createTranscribeRequest({ token, sessionSlug, formData: form }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error).toBe('Session secrets not configured.');
  });

  it('rejects authenticated /transcribe requests with unsupported providers', async () => {
    const sessionSlug = 'transcribe-unsupported-provider';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { openaiKey: 'sk-openai' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const form = new FormData();
    form.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));
    form.append('provider', 'anthropic');
    const upstreamFetch = installRpcAwareUpstreamFetchMock({ rpcUrl: RPC_URL });

    const response = await sessionCorsWorker.fetch(
      createTranscribeRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        formData: form,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Unsupported transcription provider: anthropic');
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated /transcribe requests without a file payload', async () => {
    const sessionSlug = 'transcribe-bad-content-type';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { openaiKey: 'sk-openai' },
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
      createTranscribeRequest({
        token,
        sessionSlug,
        origin: 'https://allowed.example',
        formData: new FormData(),
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing file (use field "file"; "audio" also accepted).');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects authenticated /transcribe requests when the origin is not allowed', async () => {
    const sessionSlug = 'transcribe-origin-blocked';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
      secrets: { openaiKey: 'sk-openai' },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const form = new FormData();
    form.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));

    const response = await sessionCorsWorker.fetch(
      createTranscribeRequest({
        token,
        sessionSlug,
        origin: 'https://blocked.example',
        formData: form,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
