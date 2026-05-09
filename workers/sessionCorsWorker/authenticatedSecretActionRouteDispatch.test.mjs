import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';

test('dispatchAuthenticatedSecretActionRoute ignores unrelated actions', async () => {
  let called = false;

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/',
    action: 'fetch_url',
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => {
        called = true;
        return { ok: true };
      },
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { handled: false });
});

test('dispatchAuthenticatedSecretActionRoute blocks authenticated AI after the session ends', async () => {
  let preflightCalled = false;
  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/ai',
    action: '',
    config: { sessionEndsAt: '2030-01-02T03:04:00Z' },
    headers: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      now: () => Date.parse('2030-01-02T03:04:00Z'),
      json: (body, status, headers) => ({ body, status, headers }),
      evaluateAuthenticatedRoutePreflight: async () => {
        preflightCalled = true;
        return { ok: true };
      },
    },
  });

  assert.equal(preflightCalled, false);
  assert.deepEqual(result.response, {
    body: {
      error: 'This session has ended.',
      code: 'session_ended',
      sessionEndsAt: '2030-01-02T03:04:00.000Z',
    },
    status: 410,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchAuthenticatedSecretActionRoute preserves ai preflight failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Token missing ai scope.' }), {
    status: 403,
  });

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/ai',
    action: '',
    body: { prompt: 'ping' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { ai: false },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'ai');
        assert.equal(value.route, 'ai');
        return { ok: false, response };
      },
      resolveAuthenticatedRouteSecrets: async () => {
        throw new Error('should not resolve secrets');
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => ({}),
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedSecretActionRoute resolves ai secrets and dispatches to the selected provider', async () => {
  const secrets = { openaiKey: 'sk-openai' };
  const downstreamResponse = new Response('pong');

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/',
    action: 'ai',
    body: { prompt: 'ping' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { ai: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      normalizeAiRequestPayload: ({ payload }) => {
        assert.deepEqual(payload, { prompt: 'ping' });
        return { provider: 'openai' };
      },
      proxyOpenAI: async (value) => {
        assert.deepEqual(value, {
          payload: { prompt: 'ping' },
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': '*' },
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretActionRoute rejects models outside the provider whitelist', async () => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  let providerCalled = false;

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/ai',
    action: '',
    body: { provider: 'anthropic', model: 'gpt-5.4', prompt: 'ping' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers,
    scopes: { ai: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets: { anthropicKey: 'sk' } }),
      normalizeAiRequestPayload: ({ payload }) => ({ payload, provider: 'anthropic' }),
      proxyAnthropic: async () => {
        providerCalled = true;
        return new Response('nope');
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => ({ anthropicKey: 'sk' }),
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
    },
  });

  assert.equal(providerCalled, false);
  assert.deepEqual(result, {
    handled: true,
    response: {
      body: { error: 'Model not allowed for provider' },
      status: 400,
      headers,
    },
  });
});

test('dispatchAuthenticatedSecretActionRoute passes auth context to custom RPC execution', async () => {
  const secrets = { customRpcUrl: 'https://rpc.example.test/eth' };
  const downstreamResponse = new Response('pong');

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/ai',
    action: '',
    body: { provider: 'custom', model: 'gpt-5', prompt: 'ping' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { ai: true, custom_rpc: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      normalizeAiRequestPayload: ({ payload }) => ({ payload, provider: 'custom' }),
      proxyCustomRPC: async (value) => {
        assert.deepEqual(value, {
          payload: { provider: 'custom', model: 'gpt-5', prompt: 'ping' },
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': '*' },
          auth: {
            address: '0xabc',
            scopes: { ai: true, custom_rpc: true },
          },
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretActionRoute preserves unsupported ai provider failure', async () => {
  const headers = { 'Access-Control-Allow-Origin': '*' };

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/ai',
    action: '',
    body: { prompt: 'ping' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers,
    scopes: { ai: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets: { openaiKey: 'sk' } }),
      normalizeAiRequestPayload: () => ({ provider: 'weird' }),
      checkRateLimit: async () => true,
      getSessionSecrets: async () => ({ openaiKey: 'sk' }),
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
    },
  });

  assert.deepEqual(result, {
    handled: true,
    response: {
      body: { error: 'Unsupported provider: weird' },
      status: 400,
      headers,
    },
  });
});

test('dispatchAuthenticatedSecretActionRoute preserves lit preflight failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Token missing lit scope.' }), {
    status: 403,
  });

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/',
    action: 'lit_chipotle_execute',
    body: { op: 'check' },
    config: { litCredentials: { litActionCid: 'QmAction123' } },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { lit: false },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'lit');
        assert.equal(value.route, 'lit');
        return { ok: false, response };
      },
      resolveAuthenticatedRouteSecrets: async () => {
        throw new Error('should not resolve secrets');
      },
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedSecretActionRoute executes session-scoped Lit Chipotle actions with session secrets', async () => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  const secrets = { litUsageApiKey: 'usage-key' };
  const env = { GROUP_KV: {}, LIT_USAGE_API_KEY: 'env-usage-key' };

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/',
    action: 'lit_chipotle_execute',
    body: { op: 'encrypt', message: '0x1234' },
    config: {
      litCredentials: {
        litActionCid: 'QmAction123',
        litPkpId: '0xpkp123',
      },
    },
    slug: 'session-a',
    address: '0xabc',
    env,
    limit: 3,
    headers,
    scopes: { lit: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      executeSessionLitChipotleAction: async (value) => {
        assert.deepEqual(value, {
          env,
          config: {
            litCredentials: {
              litActionCid: 'QmAction123',
              litPkpId: '0xpkp123',
            },
          },
          secrets,
          request: { op: 'encrypt', message: '0x1234' },
          requesterAddress: '0xabc',
          fetchImpl: undefined,
        });
        return {
          ok: true,
          response: {
            response: {
              ok: true,
              ciphertext: 'wrapped-cek',
            },
          },
        };
      },
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
    },
  });

  assert.deepEqual(result, {
    handled: true,
    response: {
      body: {
        ok: true,
        response: {
          response: {
            ok: true,
            ciphertext: 'wrapped-cek',
          },
        },
      },
      status: 200,
      headers,
    },
  });
});

test('dispatchAuthenticatedSecretActionRoute preserves faucet secret failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Session secrets not configured.' }), {
    status: 401,
  });

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/',
    action: 'request_test_eth',
    body: { address: '0xabc' },
    config: { rpcUrl: 'https://rpc.example.test' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { faucet: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: false, response }),
      faucet: async () => {
        throw new Error('should not dispatch faucet');
      },
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      checkRateLimit: async () => true,
      getSessionSecrets: async () => null,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedSecretActionRoute preserves proof-backed faucet bypass and downstream handoff shape', async () => {
  const config = { rpcUrl: 'https://rpc.example.test' };
  const secrets = { faucetPrivateKey: '0xabc' };
  const downstreamResponse = new Response('funded');

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/',
    action: 'request_test_eth',
    body: {
      address: '0xabc',
      sbtAddress: '0x0000000000000000000000000000000000000100',
    },
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { faucet: false },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'faucet');
        assert.equal(value.route, 'faucet');
        assert.equal(value.allowWithoutScope, true);
        return { ok: true, tokenHasScope: false };
      },
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      faucet: async (value) => {
        assert.deepEqual(value, {
          payload: {
            address: '0xabc',
            sbtAddress: '0x0000000000000000000000000000000000000100',
          },
          secrets,
          config,
          baseHeaders: { 'Access-Control-Allow-Origin': '*' },
          slug: 'session-a',
          requesterAddress: '0xabc',
          tokenHasFaucetScope: false,
        });
        return downstreamResponse;
      },
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretActionRoute allows same-wallet faucet requests to re-check gate access without token scope', async () => {
  const config = { rpcUrl: 'https://rpc.example.test' };
  const secrets = { faucetPrivateKey: '0xabc' };
  const downstreamResponse = new Response('funded');

  const result = await dispatchAuthenticatedSecretActionRoute({
    path: '/',
    action: 'request_test_eth',
    body: {
      to: '0xabc',
    },
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { faucet: false },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'faucet');
        assert.equal(value.route, 'faucet');
        assert.equal(value.allowWithoutScope, true);
        return { ok: true, tokenHasScope: false };
      },
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      faucet: async (value) => {
        assert.equal(value.requesterAddress, '0xabc');
        assert.equal(value.tokenHasFaucetScope, false);
        assert.deepEqual(value.payload, { to: '0xabc' });
        return downstreamResponse;
      },
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});
