import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthLoginRequest } from './authLoginRequestDispatch.js';

const workerSessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const replacementWorkerSessionId = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
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
      authzEpoch: 1,
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
  buildAuthTokenJti: () => 'jti-default',
  persistAuthTokenRecord: async () => {},
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
  let persistCalled = false;
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
      persistAuthTokenRecord: async () => {
        persistCalled = true;
      },
    }),
  });

  assert.equal(persistCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Token signing failed.' },
    status: 500,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAuthLoginRequest fails closed on an invalid authorization epoch', async () => {
  let signTokenCalled = false;
  const result = await dispatchAuthLoginRequest({
    request: { json: async () => createSignedBody() },
    env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createAuthDeps({
      resolveAuthLoginRequestAuthority: async () => ({
        ok: true,
        address: '0xabc',
        config: { authzEpoch: 'invalid' },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        scopes: { ai: true },
        targetSlug: 'session-a',
      }),
      signToken: async () => {
        signTokenCalled = true;
        return 'signed-token';
      },
    }),
  });

  assert.equal(signTokenCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Session authorization epoch is invalid.' },
    status: 500,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAuthLoginRequest signs tokens with jti and persists the token marker', async () => {
  const scopes = {
    ai: true,
    arweave: false,
    transcribe: true,
    faucet: false,
    fetch: true,
  };
  const calls = [];
  const request = {
    json: async () => createSignedBody({ sessionId: workerSessionId }),
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
          config: {
            authzEpoch: 7,
            sessionId: workerSessionId,
            sessionModeProfile: {
              authority: { mode: 'worker_canonical' },
            },
          },
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          scopes,
          targetSlug: 'session-a',
        };
      },
      getAddress: (value) => {
        calls.push(['getAddress', value]);
        return '0xABC';
      },
      buildAuthTokenJti: () => {
        calls.push(['buildAuthTokenJti']);
        return 'jti-1';
      },
      signToken: async (payload, secret) => {
        calls.push(['signToken', payload, secret]);
        return 'signed-token';
      },
      persistAuthTokenRecord: async (value) => {
        calls.push(['persistAuthTokenRecord', value]);
      },
      now: () => 1_700_000_000_000,
    }),
  });

  const expectedExp = Math.floor(1_700_000_000_000 / 1000) + 60 * 60 * 24;
  assert.deepEqual(calls, [
    ['resolveAuthLoginRequestAuthority', {
      env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
      request,
      body: createSignedBody({ sessionId: workerSessionId }),
      slugHint: '',
      baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    }],
    ['getAddress', '0xabc'],
    ['buildAuthTokenJti'],
    ['signToken', {
      sub: '0xABC',
      slug: 'session-a',
      sessionId: workerSessionId,
      authzEpoch: 7,
      scopes,
      exp: expectedExp,
      jti: 'jti-1',
    }, 'test-secret'],
    ['persistAuthTokenRecord', {
      env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
      slug: 'session-a',
      sub: '0xABC',
      jti: 'jti-1',
      ttlSeconds: 60 * 60 * 24,
    }],
  ]);
  assert.deepEqual(result, {
    body: {
      token: 'signed-token',
      exp: expectedExp,
      sessionSlug: 'session-a',
      sessionId: workerSessionId,
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAuthLoginRequest rejects a missing or stale canonical session id before signing', async () => {
  for (const requestedSessionId of [undefined, replacementWorkerSessionId]) {
    let signTokenCalled = false;
    let persistCalled = false;
    const result = await dispatchAuthLoginRequest({
      request: {
        json: async () => createSignedBody({
          ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
        }),
      },
      env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
      baseHeaders: { 'Access-Control-Allow-Origin': '*' },
      slug: '',
      deps: createAuthDeps({
        resolveAuthLoginRequestAuthority: async () => ({
          ok: true,
          address: '0xabc',
          config: {
            authzEpoch: 7,
            sessionId: workerSessionId,
            sessionModeProfile: {
              authority: { mode: 'worker_canonical' },
            },
          },
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          scopes: { groups: true },
          targetSlug: 'session-a',
        }),
        signToken: async () => {
          signTokenCalled = true;
          return 'must-not-sign';
        },
        persistAuthTokenRecord: async () => {
          persistCalled = true;
        },
      }),
    });

    assert.equal(result.status, 409, String(requestedSessionId));
    assert.deepEqual(
      result.body,
      { error: 'Session identity does not match worker session.' },
      String(requestedSessionId),
    );
    assert.equal(signTokenCalled, false, String(requestedSessionId));
    assert.equal(persistCalled, false, String(requestedSessionId));
  }
});

test('dispatchAuthLoginRequest fails closed when token marker persistence fails', async () => {
  const calls = [];

  const result = await dispatchAuthLoginRequest({
    request: {
      json: async () => createSignedBody(),
    },
    env: { GROUP_KV: {}, TOKEN_HMAC_SECRET: 'test-secret' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createAuthDeps({
      buildAuthTokenJti: () => 'jti-1',
      signToken: async () => {
        calls.push('signToken');
        return 'signed-token';
      },
      persistAuthTokenRecord: async () => {
        calls.push('persistAuthTokenRecord');
        throw new Error('KV unavailable.');
      },
    }),
  });

  assert.deepEqual(calls, ['signToken', 'persistAuthTokenRecord']);
  assert.deepEqual(result, {
    body: { error: 'KV unavailable.' },
    status: 500,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});
