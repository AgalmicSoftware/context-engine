import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthNonceRequest } from './authNonceRequestDispatch.js';
import { checkNonceRateLimit } from './nonceLifecycle.js';

const workerSessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const replacementWorkerSessionId = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
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
  resolveTrustedAdminOrigins: () => ['http://localhost:3000'],
  buildNonce: () => 'nonce-1',
  issueNonce: async () => ({ ok: true }),
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
  let issueNonceCalled = false;

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
      issueNonce: async () => {
        issueNonceCalled = true;
        return { ok: true };
      },
    }),
  });

  assert.equal(toStrCalled, false);
  assert.equal(isAddressCalled, false);
  assert.equal(slugCalled, false);
  assert.equal(corsCalled, false);
  assert.equal(buildNonceCalled, false);
  assert.equal(issueNonceCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchAuthNonceRequest preserves existing-session CORS passthrough before nonce creation and storage', async () => {
  let buildNonceCalled = false;
  let issueNonceCalled = false;
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
      issueNonce: async () => {
        issueNonceCalled = true;
        return { ok: true };
      },
    }),
  });

  assert.equal(buildNonceCalled, false);
  assert.equal(issueNonceCalled, false);
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
      issueNonce: async () => {
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
      issueNonce: async () => {
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

test('dispatchAuthNonceRequest rejects missing or stale canonical session ids before nonce work', async () => {
  for (const requestedSessionId of [undefined, replacementWorkerSessionId]) {
    let rateLimitCalled = false;
    let buildNonceCalled = false;
    let issueNonceCalled = false;
    const result = await dispatchAuthNonceRequest({
      request: {
        json: async () => createNonceBody({
          ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
        }),
        headers: new Headers({ Origin: 'https://allowed.example' }),
      },
      env: { GROUP_KV: {} },
      baseHeaders: { 'Access-Control-Allow-Origin': '*' },
      slug: '',
      deps: createNonceDeps({
        resolveExistingSessionCors: async () => ({
          ok: true,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config: {
            allowOrigins: ['https://allowed.example'],
            sessionId: workerSessionId,
            sessionModeProfile: {
              authority: { mode: 'worker_canonical' },
            },
          },
        }),
        checkNonceRateLimit: async () => {
          rateLimitCalled = true;
          return { ok: true };
        },
        buildNonce: () => {
          buildNonceCalled = true;
          return 'must-not-build';
        },
        issueNonce: async () => {
          issueNonceCalled = true;
          return { ok: true };
        },
      }),
    });

    assert.equal(result.status, 409, String(requestedSessionId));
    assert.deepEqual(
      result.body,
      { error: 'Session identity does not match worker session.' },
      String(requestedSessionId),
    );
    assert.equal(rateLimitCalled, false, String(requestedSessionId));
    assert.equal(buildNonceCalled, false, String(requestedSessionId));
    assert.equal(issueNonceCalled, false, String(requestedSessionId));
  }
});

test('dispatchAuthNonceRequest applies nonce rate limits before nonce creation', async () => {
  let buildNonceCalled = false;

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({ address: '0xAbC' }),
      headers: new Headers({
        Origin: 'https://allowed.example',
        'X-Anonymous-Client-Id': 'client_abc12345',
      }),
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
          identity: 'anon:cid:client_abc12345',
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

test('dispatchAuthNonceRequest preserves trusted admin nonce recovery when LOGIN_TRUSTED_ORIGINS is narrower than admin origins', async () => {
  let issueNonceCalled = false;

  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({ adminAction: true }),
      headers: new Headers({
        Origin: 'http://localhost:3000',
        'X-Anonymous-Client-Id': 'client_admin1234',
      }),
    },
    env: {
      GROUP_KV: {},
      LOGIN_TRUSTED_ORIGINS: 'https://app.example',
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
        config: { allowOrigins: ['https://app.example'] },
      }),
      issueNonce: async () => {
        issueNonceCalled = true;
        return { ok: true };
      },
      buildNonce: () => 'nonce-admin',
    }),
  });

  assert.equal(issueNonceCalled, true);
  assert.deepEqual(result, {
    body: { nonce: 'nonce-admin' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
  });
});

test('dispatchAuthNonceRequest rate limits by requester identity rather than the claimed wallet address', async () => {
  const identities = [];
  const env = { GROUP_KV: {} };
  const createRequest = (anonymousClientId) => ({
    json: async () => createNonceBody({ address: '0xVictimWallet' }),
    headers: new Headers({
      Origin: 'https://allowed.example',
      'X-Anonymous-Client-Id': anonymousClientId,
    }),
  });
  const deps = createNonceDeps({
    now: () => 1234567890,
    NONCE_RATE_LIMIT_MAX: 1,
    NONCE_RATE_LIMIT_WINDOW_MS: 60000,
    NONCE_RATE_LIMIT_TTL_SECONDS: 60,
    checkNonceRateLimit: async (value) => {
      identities.push(value.identity);
      return { ok: true };
    },
    issueNonce: async () => ({ ok: true }),
  });

  const first = await dispatchAuthNonceRequest({
    request: createRequest('client_alpha01'),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps,
  });
  const second = await dispatchAuthNonceRequest({
    request: createRequest('client_beta0002'),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps,
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(identities, [
    'anon:cid:client_alpha01',
    'anon:cid:client_beta0002',
  ]);
});


test('dispatchAuthNonceRequest preserves missing-slug failure before CORS and nonce storage', async () => {
  let corsCalled = false;
  let issueNonceCalled = false;

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
      issueNonce: async () => {
        issueNonceCalled = true;
      },
    }),
  });

  assert.equal(corsCalled, false);
  assert.equal(issueNonceCalled, false);
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
        sessionId: workerSessionId,
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
      issueNonce: async (...args) => {
        writes.push(args);
        return { ok: true };
      },
      buildNonce: () => 'nonce-success',
      NONCE_TTL_SECONDS: 123,
    }),
  });

  assert.deepEqual(writes, [[
    env,
    'session-b',
    '0xabcdef',
    'nonce-success',
    123,
  ]]);
  assert.deepEqual(result, {
    body: {
      nonce: 'nonce-success',
      sessionSlug: 'session-b',
      sessionId: workerSessionId,
    },
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
      issueNonce: async (...args) => {
        writes.push(args);
        return { ok: true };
      },
      buildNonce: () => 'nonce-general',
    }),
  });

  assert.deepEqual(writes, [[
    { GROUP_KV: {} },
    '',
    '0xabc',
    'nonce-general',
    300,
  ]]);
  assert.deepEqual(result, {
    body: { nonce: 'nonce-general' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});
