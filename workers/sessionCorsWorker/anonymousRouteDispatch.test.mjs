import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAnonymousRoute } from './anonymousRouteDispatch.js';

const createAnonymousContext = () => ({
  slug: 'session-a',
  config: {
    registryAddress: '0x0000000000000000000000000000000000000001',
    scopes: { ai: true, transcribe: true },
  },
  headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
});

test('dispatchAnonymousRoute forwards public group discovery without loading secrets', async () => {
  const request = new Request(
    'https://worker.example/groups/list?sessionId=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    { method: 'GET' },
  );
  const response = new Response('public groups');
  let secretLookupCalled = false;

  const result = await dispatchAnonymousRoute({
    path: '/groups/list',
    request,
    anonymousContext: {
      ...createAnonymousContext(),
      config: {
        sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        groupCreationPolicy: 'participants',
        sessionEndsAt: '2000-01-01T00:00:00Z',
      },
      env: { GROUP_KV: 'group-kv' },
    },
    deps: {
      dispatchPublicWorkerGroupListRequest: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.slug, 'session-a');
        assert.deepEqual(value.env, { GROUP_KV: 'group-kv' });
        assert.equal(value.config.groupCreationPolicy, 'participants');
        assert.deepEqual(value.baseHeaders, { 'Access-Control-Allow-Origin': 'https://allowed.example' });
        return response;
      },
      getSessionSecrets: async () => {
        secretLookupCalled = true;
        return {};
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
  assert.equal(secretLookupCalled, false);
});

test('dispatchAnonymousRoute blocks anonymous AI after the session ends', async () => {
  let bodyRead = false;
  const result = await dispatchAnonymousRoute({
    path: '/ai',
    request: new Request('https://worker.example/ai', { method: 'POST' }),
    anonymousContext: {
      ...createAnonymousContext(),
      config: {
        ...createAnonymousContext().config,
        sessionEndsAt: '2030-01-02T03:04:00Z',
      },
    },
    deps: {
      now: () => Date.parse('2030-01-02T03:04:00Z'),
      readAiRequestPayload: async () => {
        bodyRead = true;
        return { ok: true };
      },
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(bodyRead, false);
  assert.deepEqual(result, {
    body: {
      error: 'This session has ended.',
      code: 'session_ended',
      sessionEndsAt: '2030-01-02T03:04:00.000Z',
    },
    status: 410,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAnonymousRoute forwards public storage reads to storageRoute without requester auth', async () => {
  const request = new Request('https://worker.example/storage/read?id=ref1', { method: 'GET' });
  const response = new Response('public payload');

  const result = await dispatchAnonymousRoute({
    path: '/storage/read',
    request,
    anonymousContext: {
      ...createAnonymousContext(),
      env: { CE_STORAGE_R2: 'binding' },
    },
    deps: {
      storageRoute: async (value) => {
        assert.equal(value.path, '/storage/read');
        assert.equal(value.method, 'GET');
        assert.equal(value.request, request);
        assert.equal(value.slug, 'session-a');
        assert.equal(value.uploaderAddress, '');
        assert.deepEqual(value.env, { CE_STORAGE_R2: 'binding' });
        return response;
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
});

test('dispatchAnonymousRoute preserves transcribe parse error passthrough', async () => {
  let accessCalled = false;

  const result = await dispatchAnonymousRoute({
    path: '/transcribe',
    request: { headers: new Headers() },
    anonymousContext: createAnonymousContext(),
    deps: {
      readTranscribeRequestPayload: async () => ({
        ok: false,
        status: 400,
        error: 'Expected multipart/form-data.',
      }),
      evaluateAnonymousRouteAccess: async () => {
        accessCalled = true;
        return { ok: true };
      },
      getSessionSecrets: async () => ({}),
      transcribe: async () => new Response('ok'),
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(accessCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Expected multipart/form-data.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAnonymousRoute preserves anonymous transcribe eligibility failure passthrough', async () => {
  let secretsCalled = false;

  const result = await dispatchAnonymousRoute({
    path: '/transcribe',
    request: { headers: new Headers() },
    anonymousContext: createAnonymousContext(),
    deps: {
      readTranscribeRequestPayload: async () => ({
        ok: true,
        payload: { requestApiKey: '' },
      }),
      evaluateAnonymousRouteAccess: async (value) => {
        assert.equal(value.route, 'transcribe');
        return {
          ok: false,
          status: 403,
          error: 'Anonymous access denied: route scope disabled in session config.',
        };
      },
      getSessionSecrets: async () => {
        secretsCalled = true;
        return {};
      },
      transcribe: async () => new Response('ok'),
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(secretsCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Anonymous access denied: route scope disabled in session config.' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAnonymousRoute skips worker secrets for request-api-key transcribe access', async () => {
  const transcribeRequest = {
    ok: true,
    payload: {
      provider: 'openai',
      requestApiKey: 'sk-local-123',
    },
  };
  const response = new Response('transcribed');

  const result = await dispatchAnonymousRoute({
    path: '/transcribe',
    request: { headers: new Headers() },
    anonymousContext: createAnonymousContext(),
    deps: {
      readTranscribeRequestPayload: async () => transcribeRequest,
      evaluateAnonymousRouteAccess: async () => ({ ok: true, reason: 'request-api-key' }),
      getSessionSecrets: async () => {
        throw new Error('should not load worker secrets');
      },
      transcribe: async (value) => {
        assert.deepEqual(value, {
          request: null,
          secrets: {},
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          transcribeRequest,
        });
        return response;
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
});

test('dispatchAnonymousRoute preserves ai parse error passthrough', async () => {
  let accessCalled = false;

  const result = await dispatchAnonymousRoute({
    path: '/ai',
    request: new Request('https://worker.example/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai' }),
    }),
    anonymousContext: createAnonymousContext(),
    deps: {
      readAiRequestPayload: async () => ({
        ok: false,
        status: 400,
        error: 'Invalid JSON.',
      }),
      evaluateAnonymousRouteAccess: async () => {
        accessCalled = true;
        return { ok: true };
      },
      validateAnonymousAiRequest: () => ({ ok: true }),
      getSessionSecrets: async () => ({}),
      proxyOpenAI: async () => new Response('ok'),
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(accessCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAnonymousRoute preserves anonymous ai validation failure and skips worker secrets', async () => {
  let secretsCalled = false;

  const result = await dispatchAnonymousRoute({
    path: '/ai',
    request: new Request('https://worker.example/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'custom', apiKey: 'sk-local-123' }),
    }),
    anonymousContext: createAnonymousContext(),
    deps: {
      readAiRequestPayload: async () => ({
        ok: true,
        payload: { provider: 'custom', apiKey: 'sk-local-123' },
        provider: 'custom',
        requestApiKey: 'sk-local-123',
        requestRpcUrl: '',
      }),
      evaluateAnonymousRouteAccess: async (value) => {
        assert.equal(value.route, 'ai');
        assert.equal(value.apiKey, 'sk-local-123');
        return { ok: true, reason: 'request-api-key' };
      },
      validateAnonymousAiRequest: (value) => {
        assert.deepEqual(value, {
          provider: 'custom',
          requestRpcUrl: '',
          anonymousAccessReason: 'request-api-key',
        });
        return {
          ok: false,
          status: 400,
          error: 'Anonymous custom provider requires request rpcUrl when using apiKey bypass.',
        };
      },
      getSessionSecrets: async () => {
        secretsCalled = true;
        return {};
      },
      proxyCustomRPC: async () => new Response('ok'),
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(secretsCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Anonymous custom provider requires request rpcUrl when using apiKey bypass.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAnonymousRoute rejects models outside the provider whitelist before loading secrets', async () => {
  let secretsCalled = false;
  let providerCalled = false;

  const result = await dispatchAnonymousRoute({
    path: '/ai',
    request: new Request('https://worker.example/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic', model: 'gpt-5.4' }),
    }),
    anonymousContext: createAnonymousContext(),
    deps: {
      readAiRequestPayload: async () => ({
        ok: true,
        payload: { provider: 'anthropic', model: 'gpt-5.4' },
        provider: 'anthropic',
        requestApiKey: '',
        requestRpcUrl: '',
      }),
      evaluateAnonymousRouteAccess: async () => ({ ok: true, reason: 'open-default-ai-gates' }),
      validateAnonymousAiRequest: () => ({ ok: true }),
      getSessionSecrets: async () => {
        secretsCalled = true;
        return { anthropicKey: 'sk-worker-anthropic' };
      },
      proxyAnthropic: async () => {
        providerCalled = true;
        return new Response('nope');
      },
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(secretsCalled, false);
  assert.equal(providerCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Model not allowed for provider' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAnonymousRoute rejects custom rpc providers before loading secrets or proxying', async () => {
  let secretsCalled = false;
  let proxyCalled = false;

  const result = await dispatchAnonymousRoute({
    path: '/ai',
    request: new Request('https://worker.example/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'custom',
        model: 'gpt-5',
        apiKey: 'sk-local-123',
        rpcUrl: 'https://rpc.example/v1/chat/completions',
      }),
    }),
    anonymousContext: createAnonymousContext(),
    deps: {
      readAiRequestPayload: async () => ({
        ok: true,
        payload: {
          provider: 'custom',
          model: 'gpt-5',
          apiKey: 'sk-local-123',
          rpcUrl: 'https://rpc.example/v1/chat/completions',
        },
        provider: 'custom',
        requestApiKey: 'sk-local-123',
        requestRpcUrl: 'https://rpc.example/v1/chat/completions',
      }),
      evaluateAnonymousRouteAccess: async () => ({ ok: true, reason: 'request-api-key' }),
      validateAnonymousAiRequest: () => ({ ok: true }),
      getSessionSecrets: async () => {
        secretsCalled = true;
        return {};
      },
      proxyCustomRPC: async () => {
        proxyCalled = true;
        return new Response('nope');
      },
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(secretsCalled, false);
  assert.equal(proxyCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Custom RPC not available for anonymous requests' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAnonymousRoute dispatches ai providers with worker secrets when not using apiKey bypass', async () => {
  const response = new Response('pong');
  const secrets = { openaiKey: 'sk-worker-openai' };

  const result = await dispatchAnonymousRoute({
    path: '/ai',
    request: new Request('https://worker.example/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', prompt: 'ping' }),
    }),
    anonymousContext: createAnonymousContext(),
    deps: {
      readAiRequestPayload: async () => ({
        ok: true,
        payload: { provider: 'openai', prompt: 'ping' },
        provider: 'openai',
        requestApiKey: '',
        requestRpcUrl: '',
      }),
      evaluateAnonymousRouteAccess: async () => ({ ok: true, reason: 'open-default-ai-gates' }),
      validateAnonymousAiRequest: () => ({ ok: true }),
      getSessionSecrets: async (slug) => {
        assert.equal(slug, 'session-a');
        return secrets;
      },
      proxyOpenAI: async (value) => {
        assert.deepEqual(value, {
          payload: { provider: 'openai', prompt: 'ping' },
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        });
        return response;
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
});

test('dispatchAnonymousRoute preserves unsupported provider failure contract', async () => {
  const result = await dispatchAnonymousRoute({
    path: '/ai',
    request: new Request('https://worker.example/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'weird' }),
    }),
    anonymousContext: createAnonymousContext(),
    deps: {
      readAiRequestPayload: async () => ({
        ok: true,
        payload: { provider: 'weird' },
        provider: 'weird',
        requestApiKey: '',
        requestRpcUrl: '',
      }),
      evaluateAnonymousRouteAccess: async () => ({ ok: true, reason: 'open-default-ai-gates' }),
      validateAnonymousAiRequest: () => ({ ok: true }),
      getSessionSecrets: async () => ({ openaiKey: 'sk-worker-openai' }),
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.deepEqual(result, {
    body: { error: 'Unsupported provider: weird' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});
