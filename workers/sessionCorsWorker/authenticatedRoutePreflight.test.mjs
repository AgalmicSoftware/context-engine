import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('evaluateAuthenticatedRoutePreflight preserves missing-scope failure and skips rate limiting', async () => {
  let checkRateLimitCalled = false;
  const headers = { 'Access-Control-Allow-Origin': '*' };

  const result = await evaluateAuthenticatedRoutePreflight({
    scopes: { ai: true },
    scope: 'fetch',
    route: 'fetch',
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    limit: 7,
    headers,
    deps: {
      checkRateLimit: async () => {
        checkRateLimitCalled = true;
        return true;
      },
      json: createJsonStub(),
    },
  });

  assert.equal(checkRateLimitCalled, false);
  assert.deepEqual(result, {
    ok: false,
    tokenHasScope: false,
    response: {
      body: { error: 'Token missing fetch scope.' },
      status: 403,
      headers,
    },
  });
});

test('evaluateAuthenticatedRoutePreflight allows missing scope when explicitly permitted and still rate limits', async () => {
  let received = null;

  const result = await evaluateAuthenticatedRoutePreflight({
    scopes: { faucet: false },
    scope: 'faucet',
    route: 'faucet',
    allowWithoutScope: true,
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      computeScopesForLogin: async (value) => {
        assert.deepEqual(value.requestedScopes, ['faucet']);
        return { faucet: false };
      },
      checkRateLimit: async (value) => {
        received = value;
        return true;
      },
      json: createJsonStub(),
    },
  });

  assert.deepEqual(received, {
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    limit: 3,
    route: 'faucet',
  });
  assert.deepEqual(result, {
    ok: true,
    tokenHasScope: false,
  });
});

test('evaluateAuthenticatedRoutePreflight preserves rate-limit rejection', async () => {
  const headers = { 'Access-Control-Allow-Origin': '*' };

  const result = await evaluateAuthenticatedRoutePreflight({
    scopes: { ai: true },
    scope: 'ai',
    route: 'ai',
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    limit: 1,
    headers,
    deps: {
      computeScopesForLogin: async () => ({ ai: true }),
      checkRateLimit: async () => false,
      json: createJsonStub(),
    },
  });

  assert.deepEqual(result, {
    ok: false,
    tokenHasScope: true,
    response: {
      body: { error: 'Rate limit exceeded.' },
      status: 429,
      headers,
    },
  });
});

test('evaluateAuthenticatedRoutePreflight preserves success shape for scoped routes', async () => {
  const result = await evaluateAuthenticatedRoutePreflight({
    scopes: { transcribe: true },
    scope: 'transcribe',
    route: 'transcribe',
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    limit: 5,
    headers: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      computeScopesForLogin: async () => ({ transcribe: true }),
      checkRateLimit: async () => true,
      json: createJsonStub(),
    },
  });

  assert.deepEqual(result, {
    ok: true,
    tokenHasScope: true,
  });
});

test('evaluateAuthenticatedRoutePreflight intersects signed scope with current authorization', async () => {
  let checkRateLimitCalled = false;
  const headers = { 'Access-Control-Allow-Origin': '*' };
  const config = { authzEpoch: 4, scopes: { ai: false } };
  const result = await evaluateAuthenticatedRoutePreflight({
    scopes: { ai: true },
    scope: 'ai',
    route: 'ai',
    config,
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    limit: 5,
    headers,
    deps: {
      computeScopesForLogin: async (value) => {
        assert.equal(value.config, config);
        assert.deepEqual(value.requestedScopes, ['ai']);
        return { ai: false };
      },
      checkRateLimit: async () => {
        checkRateLimitCalled = true;
        return true;
      },
      json: createJsonStub(),
    },
  });

  assert.equal(checkRateLimitCalled, false);
  assert.deepEqual(result, {
    ok: false,
    tokenHasScope: false,
    response: {
      body: { error: 'Token missing ai scope.' },
      status: 403,
      headers,
    },
  });
});

test('evaluateAuthenticatedRoutePreflight fails closed when current authorization cannot be resolved', async () => {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  const result = await evaluateAuthenticatedRoutePreflight({
    scopes: { ai: true },
    scope: 'ai',
    route: 'ai',
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    headers,
    deps: {
      computeScopesForLogin: async () => {
        throw new Error('registry unavailable');
      },
      checkRateLimit: async () => true,
      json: createJsonStub(),
    },
  });

  assert.deepEqual(result, {
    ok: false,
    tokenHasScope: false,
    response: {
      body: { error: 'Current authorization check failed.' },
      status: 403,
      headers,
    },
  });
});
