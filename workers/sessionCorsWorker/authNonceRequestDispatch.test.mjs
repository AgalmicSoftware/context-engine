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
