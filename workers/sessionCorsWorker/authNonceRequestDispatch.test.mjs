import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthNonceRequest } from './authNonceRequestDispatch.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createNonceBody = (overrides = {}) => ({
  address: '0xabc',
  sessionSlug: 'session-a',
  ...overrides,
});

const createNonceDeps = (overrides = {}) => ({
  json: createJsonStub(),
  toStr: (value) => `${value ?? ''}`,
  isAddress: () => true,
  resolveWorkerBodySlugContext: () => ({
    ok: true,
    targetSlug: 'session-a',
  }),
  resolveExistingSessionCors: async () => ({
    ok: true,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    config: { allowOrigins: ['https://allowed.example'] },
  }),
  buildNonce: () => 'nonce-1',
  putNonce: async () => {},
  MISSING_SLUG_ERROR: 'Missing sessionSlug.',
  NONCE_TTL_SECONDS: 60 * 5,
  ...overrides,
});

test('dispatchAuthNonceRequest preserves invalid-json failure before address, slug, cors, and nonce work', async () => {
  let toStrCalled = false;
  let isAddressCalled = false;
  let slugCalled = false;
  let corsCalled = false;
  let buildNonceCalled = false;
  let putNonceCalled = false;

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => {
        throw new Error('bad json');
      },
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      toStr: (value) => {
        toStrCalled = true;
        return `${value ?? ''}`;
      },
      isAddress: () => {
        isAddressCalled = true;
        return true;
      },
      resolveWorkerBodySlugContext: () => {
        slugCalled = true;
        return { ok: true, targetSlug: 'session-a' };
      },
      resolveExistingSessionCors: async () => {
        corsCalled = true;
        return { ok: true, headers: {} };
      },
      buildNonce: () => {
        buildNonceCalled = true;
        return 'nonce-1';
      },
      putNonce: async () => {
        putNonceCalled = true;
      },
    }),
  });

  assert.equal(toStrCalled, false);
  assert.equal(isAddressCalled, false);
  assert.equal(slugCalled, false);
  assert.equal(corsCalled, false);
  assert.equal(buildNonceCalled, false);
  assert.equal(putNonceCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchAuthNonceRequest preserves existing-session CORS passthrough before nonce creation and storage', async () => {
  let buildNonceCalled = false;
  let putNonceCalled = false;
  const corsResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
  });

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody(),
      headers: new Headers({ Origin: 'https://blocked.example' }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      resolveExistingSessionCors: async (value) => {
        assert.equal(value.slug, 'session-a');
        return { ok: false, response: corsResponse };
      },
      buildNonce: () => {
        buildNonceCalled = true;
        return 'nonce-1';
      },
      putNonce: async () => {
        putNonceCalled = true;
      },
    }),
  });

  assert.equal(buildNonceCalled, false);
  assert.equal(putNonceCalled, false);
  assert.equal(result, corsResponse);
});

test('dispatchAuthNonceRequest rejects missing and untrusted Origins before nonce creation', async () => {
  let missingOriginNonceCalled = false;
  const missingOrigin = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody(),
      headers: new Headers(),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      putNonce: async () => {
        missingOriginNonceCalled = true;
      },
    }),
  });

  assert.equal(missingOriginNonceCalled, false);
  assert.deepEqual(missingOrigin, {
    body: { error: 'Missing Origin for worker login.' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });

  let untrustedNonceCalled = false;
  const untrustedOrigin = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody(),
      headers: new Headers({ Origin: 'https://blocked.example' }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://blocked.example' },
        config: { allowOrigins: ['https://allowed.example'] },
      }),
      putNonce: async () => {
        untrustedNonceCalled = true;
      },
    }),
  });

  assert.equal(untrustedNonceCalled, false);
  assert.deepEqual(untrustedOrigin, {
    body: { error: 'Untrusted worker login origin.' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': 'https://blocked.example' },
  });
});

test('dispatchAuthNonceRequest applies nonce rate limits before nonce creation', async () => {
  let buildNonceCalled = false;

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({ address: '0xAbC' }),
      headers: new Headers({ Origin: 'https://allowed.example' }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      now: () => 1234567890,
      NONCE_RATE_LIMIT_MAX: 5,
      NONCE_RATE_LIMIT_WINDOW_MS: 60000,
      NONCE_RATE_LIMIT_TTL_SECONDS: 60,
      checkNonceRateLimit: async (value) => {
        assert.deepEqual(value, {
          env: { GROUP_KV: {} },
          slug: 'session-a',
          address: '0xAbC',
          limit: 5,
          now: value.now,
          windowMs: 60000,
          ttlSeconds: 60,
        });
        assert.equal(value.now(), 1234567890);
        return { ok: false, error: 'Too many nonce requests. Try again shortly.' };
      },
      buildNonce: () => {
        buildNonceCalled = true;
        return 'nonce-1';
      },
    }),
  });

  assert.equal(buildNonceCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Too many nonce requests. Try again shortly.' },
    status: 429,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});


test('dispatchAuthNonceRequest preserves missing-slug failure before CORS and nonce storage', async () => {
  let corsCalled = false;
  let putNonceCalled = false;

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({ sessionSlug: '' }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      resolveWorkerBodySlugContext: () => ({
        ok: true,
        targetSlug: '',
      }),
      resolveExistingSessionCors: async () => {
        corsCalled = true;
        return { ok: true, headers: {} };
      },
      putNonce: async () => {
        putNonceCalled = true;
      },
    }),
  });

  assert.equal(corsCalled, false);
  assert.equal(putNonceCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Missing sessionSlug.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchAuthNonceRequest forwards trusted-admin bypass intent for explicit admin nonce requests', async () => {
  let receivedAllowTrustedAdminAuthOrigin = null;

  await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({ adminAction: true }),
      headers: new Headers({ Origin: 'http://localhost:3000' }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      resolveExistingSessionCors: async (value) => {
        receivedAllowTrustedAdminAuthOrigin = value.allowTrustedAdminAuthOrigin;
        return {
          ok: true,
          headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
        };
      },
    }),
  });

  assert.equal(receivedAllowTrustedAdminAuthOrigin, true);
});

test('dispatchAuthNonceRequest lowercases the nonce storage key, preserves ttl, and returns the nonce response', async () => {
  const writes = [];
  const env = { GROUP_KV: {} };

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({
        address: '0xAbCDEF',
        sessionSlug: 'session-b',
      }),
      headers: new Headers({ Origin: 'https://allowed.example' }),
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      resolveWorkerBodySlugContext: () => ({
        ok: true,
        targetSlug: 'session-b',
      }),
      putNonce: async (...args) => {
        writes.push(args);
      },
      buildNonce: () => 'nonce-success',
      NONCE_TTL_SECONDS: 123,
    }),
  });

  assert.deepEqual(writes, [[
    env,
    'nonce:session-b:0xabcdef',
    'nonce-success',
    123,
  ]]);
  assert.deepEqual(result, {
    body: { nonce: 'nonce-success' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('dispatchAuthNonceRequest accepts an explicit general-session slug without treating it as missing', async () => {
  const writes = [];

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({
        sessionSlug: 'general',
      }),
      headers: new Headers({ Origin: 'https://allowed.example' }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: 'general',
    deps: createNonceDeps({
      resolveWorkerBodySlugContext: () => ({
        ok: true,
        targetSlug: '',
        explicitSlugProvided: true,
      }),
      resolveExistingSessionCors: async (value) => {
        assert.equal(value.slug, '');
        return {
          ok: true,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config: { allowOrigins: ['https://allowed.example'] },
        };
      },
      putNonce: async (...args) => {
        writes.push(args);
      },
      buildNonce: () => 'nonce-general',
    }),
  });

  assert.deepEqual(writes, [[
    { GROUP_KV: {} },
    'nonce::0xabc',
    'nonce-general',
    300,
  ]]);
  assert.deepEqual(result, {
    body: { nonce: 'nonce-general' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});
