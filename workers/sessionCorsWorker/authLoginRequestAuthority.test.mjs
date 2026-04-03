import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthLoginRequestAuthority } from './authLoginRequestAuthority.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createSignedBody = (overrides = {}) => ({
  address: '0xabc',
  message: 'signed-message',
  signature: '0xsig',
  ...overrides,
});

const createAuthorityDeps = (overrides = {}) => ({
  json: createJsonStub(),
  normalizeSignedWorkerRequest: (body) => ({
    address: body.address,
    message: body.message,
    signature: body.signature,
  }),
  resolveWorkerBodySlugContext: () => ({
    ok: true,
    envSlug: '',
    slugPayload: { hasAnySlug: true },
    targetSlug: 'session-a',
  }),
  isAddress: () => true,
  resolveExistingSessionCors: async () => ({
    ok: true,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
    },
  }),
  verifyMessage: () => '0xabc',
  validateRecoveredAddressMatchesRequest: () => ({ ok: true }),
  parseSiweMessage: () => ({ nonce: 'nonce-1' }),
  validateSiwe: () => ({ ok: true }),
  validateSiweAddressMatchesRequest: () => ({ ok: true }),
  consumeNonce: async () => ({ ok: true }),
  computeScopesForLogin: async () => ({
    ai: true,
    arweave: true,
    transcribe: true,
    faucet: true,
    fetch: true,
  }),
  MISSING_SLUG_ERROR: 'Missing sessionSlug.',
  SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
  ...overrides,
});

const createRequestArgs = (overrides = {}) => ({
  env: { GROUP_KV: {} },
  request: {
    headers: new Headers({ Origin: 'https://allowed.example' }),
  },
  body: createSignedBody(),
  slugHint: '',
  baseHeaders: { 'Access-Control-Allow-Origin': '*' },
  deps: createAuthorityDeps(),
  ...overrides,
});

test('resolveAuthLoginRequestAuthority preserves slug and signed-request precondition failures', async () => {
  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        resolveWorkerBodySlugContext: () => ({
          ok: false,
          error: 'Invalid session slug.',
        }),
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Invalid session slug.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    },
  );

  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        isAddress: () => false,
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Invalid address.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    },
  );

  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      body: createSignedBody({ signature: '' }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Missing message or signature.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    },
  );

  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        resolveWorkerBodySlugContext: () => ({
          ok: true,
          envSlug: '',
          slugPayload: { hasAnySlug: false },
          targetSlug: 'session-a',
        }),
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Missing sessionSlug.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    },
  );
});

test('resolveAuthLoginRequestAuthority preserves existing-session CORS passthrough before signature verification', async () => {
  let verifyCalled = false;
  const corsResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
  });

  const result = await resolveAuthLoginRequestAuthority(createRequestArgs({
    deps: createAuthorityDeps({
      resolveExistingSessionCors: async (value) => {
        assert.equal(value.slug, 'session-a');
        return { ok: false, response: corsResponse };
      },
      verifyMessage: () => {
        verifyCalled = true;
        return '0xabc';
      },
    }),
  }));

  assert.equal(verifyCalled, false);
  assert.deepEqual(result, {
    ok: false,
    response: corsResponse,
  });
});

test('resolveAuthLoginRequestAuthority preserves signature, SIWE, and nonce failure contracts', async () => {
  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        verifyMessage: () => {
          throw new Error('bad signature');
        },
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Invalid signature.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        validateRecoveredAddressMatchesRequest: () => ({
          ok: false,
          error: 'Recovered address does not match request address.',
        }),
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Recovered address does not match request address.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        validateSiwe: () => ({
          ok: false,
          error: 'Invalid SIWE message.',
        }),
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Invalid SIWE message.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        validateSiweAddressMatchesRequest: () => ({
          ok: false,
          error: 'SIWE address does not match request address.',
        }),
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'SIWE address does not match request address.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        consumeNonce: async (env, slug, address, nonce) => {
          assert.deepEqual([env, slug, address, nonce], [
            { GROUP_KV: {} },
            'session-a',
            '0xabc',
            'nonce-1',
          ]);
          return { ok: false, error: 'Invalid or expired nonce.' };
        },
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Invalid or expired nonce.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );
});

test('resolveAuthLoginRequestAuthority accepts an explicit general-session slug', async () => {
  const result = await resolveAuthLoginRequestAuthority(createRequestArgs({
    slugHint: 'general',
    deps: createAuthorityDeps({
      resolveWorkerBodySlugContext: () => ({
        ok: true,
        envSlug: '',
        slugPayload: { hasAnySlug: false },
        targetSlug: '',
        explicitSlugProvided: true,
      }),
      resolveExistingSessionCors: async (value) => {
        assert.equal(value.slug, '');
        return {
          ok: true,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config: {
            registryAddress: '0x0000000000000000000000000000000000000001',
          },
        };
      },
      computeScopesForLogin: async (value) => {
        assert.equal(value.slug, '');
        return {
          ai: true,
          arweave: false,
          transcribe: true,
          faucet: false,
          fetch: false,
        };
      },
    }),
  }));

  assert.equal(result.ok, true);
  assert.equal(result.targetSlug, '');
});

test('resolveAuthLoginRequestAuthority preserves missing-config 404 before scope computation', async () => {
  let scopesCalled = false;

  const result = await resolveAuthLoginRequestAuthority(createRequestArgs({
    deps: createAuthorityDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        config: null,
      }),
      computeScopesForLogin: async () => {
        scopesCalled = true;
        return {};
      },
    }),
  }));

  assert.equal(scopesCalled, false);
  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Session config not found.' },
      status: 404,
      headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    },
  });
});

test('resolveAuthLoginRequestAuthority preserves gate failure passthrough and returns scopes on success', async () => {
  assert.deepEqual(
    await resolveAuthLoginRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        computeScopesForLogin: async () => {
          throw new Error('Access denied: default gate failed.');
        },
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Access denied: default gate failed.' },
        status: 403,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  const scopes = {
    ai: true,
    arweave: false,
    transcribe: true,
    faucet: false,
    fetch: true,
  };
  const calls = [];

  const result = await resolveAuthLoginRequestAuthority(createRequestArgs({
    deps: createAuthorityDeps({
      computeScopesForLogin: async (value) => {
        calls.push(value);
        return scopes;
      },
    }),
  }));

  assert.deepEqual(calls, [{
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc',
    config: { registryAddress: '0x0000000000000000000000000000000000000001' },
  }]);
  assert.deepEqual(result, {
    ok: true,
    address: '0xabc',
    config: { registryAddress: '0x0000000000000000000000000000000000000001' },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes,
    targetSlug: 'session-a',
  });
});
