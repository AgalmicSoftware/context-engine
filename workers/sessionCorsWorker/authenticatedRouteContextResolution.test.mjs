import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthenticatedRouteContext } from './authenticatedRouteContextResolution.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('resolveAuthenticatedRouteContext preserves missing session-config failure', async () => {
  const calls = [];
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRouteContext({
    request: {
      headers: new Headers({ Origin: 'https://app.example' }),
    },
    env: { GROUP_KV: {} },
    auth: {
      slug: 'session-a',
      payload: {
        sub: '0xABC',
        scopes: { ai: true },
      },
    },
    baseHeaders,
    deps: {
      getSessionConfig: async (env, slug) => {
        calls.push(['getSessionConfig', env, slug]);
        return null;
      },
      getCorsContext: async () => {
        calls.push(['getCorsContext']);
        return { ok: true, headers: { nope: 'unused' } };
      },
      json: createJsonStub(),
      toStr: String,
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.deepEqual(calls, [
    ['getSessionConfig', { GROUP_KV: {} }, 'session-a'],
  ]);
  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Session config not found.' },
      status: 404,
      headers: baseHeaders,
    },
  });
});

test('resolveAuthenticatedRouteContext preserves blocked-origin passthrough response', async () => {
  const config = { allowOrigins: ['https://allowed.example'] };
  const blockedResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers: { Vary: 'Origin' },
  });

  const result = await resolveAuthenticatedRouteContext({
    request: {
      headers: new Headers({ Origin: 'https://blocked.example' }),
    },
    env: { GROUP_KV: {} },
    auth: {
      slug: 'session-a',
      payload: {
        sub: '0xABC',
        scopes: { ai: true },
      },
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      getSessionConfig: async () => config,
      getCorsContext: async ({ request, config: receivedConfig }) => {
        assert.equal(request.headers.get('Origin'), 'https://blocked.example');
        assert.equal(receivedConfig, config);
        return {
          ok: false,
          response: blockedResponse,
          headers: { 'Access-Control-Allow-Origin': null },
        };
      },
      json: createJsonStub(),
      toStr: String,
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.response, blockedResponse);
  assert.equal(result.config, config);
});

test('resolveAuthenticatedRouteContext returns common authenticated route context on success', async () => {
  const config = {
    authzEpoch: 3,
    limits: {
      perWalletPerDay: 7,
    },
  };
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const result = await resolveAuthenticatedRouteContext({
    request: {
      headers: new Headers({ Origin: 'https://allowed.example' }),
    },
    env: { GROUP_KV: {} },
    auth: {
      slug: 'session-a',
      payload: {
        sub: '0xAbC123',
        authzEpoch: 3,
        scopes: { ai: true, fetch: false, groups: true },
      },
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      getSessionConfig: async () => config,
      getCorsContext: async () => ({ ok: true, headers }),
      json: createJsonStub(),
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.deepEqual(result, {
    ok: true,
    slug: 'session-a',
    config,
    headers,
    scopes: { ai: true, fetch: false, groups: true },
    address: '0xabc123',
    limit: 7,
  });
});

test('resolveAuthenticatedRouteContext rejects a token from an older authorization epoch', async () => {
  let scopeCheckCalled = false;
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const result = await resolveAuthenticatedRouteContext({
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    env: { GROUP_KV: {} },
    auth: {
      slug: 'session-a',
      payload: { sub: '0xabc', authzEpoch: 4, scopes: { ai: true } },
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      getSessionConfig: async () => ({ authzEpoch: 5 }),
      getCorsContext: async () => ({ ok: true, headers }),
      computeScopesForLogin: async () => {
        scopeCheckCalled = true;
        return { ai: true };
      },
      json: createJsonStub(),
      toStr: String,
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal(scopeCheckCalled, false);
  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Token authorization is stale.' },
      status: 401,
      headers,
    },
  });
});
