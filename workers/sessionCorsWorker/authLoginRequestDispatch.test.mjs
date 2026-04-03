import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthLoginRequest } from './authLoginRequestDispatch.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createSignedBody = (overrides = {}) => ({
  address: '0xabc',
  message: 'signed-message',
  signature: '0xsig',
  ...overrides,
});

const createAuthDeps = (overrides = {}) => ({
  json: createJsonStub(),
  resolveAuthLoginRequestAuthority: async () => ({
    ok: true,
    address: '0xabc',
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
    },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: {
      ai: true,
      arweave: true,
      transcribe: true,
      faucet: true,
      fetch: true,
    },
    targetSlug: 'session-a',
  }),
  signToken: async () => 'signed-token',
  getAddress: (value) => value,
  now: () => 1_700_000_000_000,
  TOKEN_TTL_SECONDS: 60 * 60 * 24,
  MISSING_SLUG_ERROR: 'Missing sessionSlug.',
  SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
  ...overrides,
});

test('dispatchAuthLoginRequest preserves invalid-json failure before signed request handling', async () => {
  let authorityCalled = false;

  const result = await dispatchAuthLoginRequest({
    request: {
      json: async () => {
        throw new Error('bad json');
      },
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createAuthDeps({
      resolveAuthLoginRequestAuthority: async () => {
        authorityCalled = true;
        return { ok: true };
      },
    }),
  });

  assert.equal(authorityCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchAuthLoginRequest preserves authority failure passthrough before token signing', async () => {
  let signTokenCalled = false;

  const result = await dispatchAuthLoginRequest({
    request: {
      json: async () => createSignedBody(),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createAuthDeps({
      resolveAuthLoginRequestAuthority: async () => ({
        ok: false,
        response: {
          body: { error: 'Session config not found.' },
          status: 404,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        },
      }),
      signToken: async () => {
        signTokenCalled = true;
        return 'signed-token';
      },
    }),
  });

  assert.equal(signTokenCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Session config not found.' },
    status: 404,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAuthLoginRequest preserves token-signing failure contract', async () => {
  const result = await dispatchAuthLoginRequest({
    request: {
      json: async () => createSignedBody(),
    },
    env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createAuthDeps({
      signToken: async () => {
        throw new Error('Token signing failed.');
      },
    }),
  });

  assert.deepEqual(result, {
    body: { error: 'Token signing failed.' },
    status: 500,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAuthLoginRequest signs tokens with the resolved slug, scopes, and ttl', async () => {
  const scopes = {
    ai: true,
    arweave: false,
    transcribe: true,
    faucet: false,
    fetch: true,
  };
  const calls = [];
  const request = {
    json: async () => createSignedBody(),
  };

  const result = await dispatchAuthLoginRequest({
    request,
    env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createAuthDeps({
      resolveAuthLoginRequestAuthority: async (value) => {
        calls.push(['resolveAuthLoginRequestAuthority', {
          env: value.env,
          request: value.request,
          body: value.body,
          slugHint: value.slugHint,
          baseHeaders: value.baseHeaders,
        }]);
        return {
          ok: true,
          address: '0xabc',
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          scopes,
          targetSlug: 'session-a',
        };
      },
      getAddress: (value) => {
        calls.push(['getAddress', value]);
        return '0xABC';
      },
      signToken: async (payload, secret) => {
        calls.push(['signToken', payload, secret]);
        return 'signed-token';
      },
      now: () => 1_700_000_000_000,
    }),
  });

  const expectedExp = Math.floor(1_700_000_000_000 / 1000) + 60 * 60 * 24;
  assert.deepEqual(calls, [
    ['resolveAuthLoginRequestAuthority', {
      env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
      request,
      body: createSignedBody(),
      slugHint: '',
      baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    }],
    ['getAddress', '0xabc'],
    ['signToken', {
      sub: '0xABC',
      slug: 'session-a',
      scopes,
      exp: expectedExp,
    }, 'test-secret'],
  ]);
  assert.deepEqual(result, {
    body: { token: 'signed-token', exp: expectedExp },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});
