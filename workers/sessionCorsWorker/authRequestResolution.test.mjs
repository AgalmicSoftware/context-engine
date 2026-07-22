import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthenticatedRequest } from './authRequestResolution.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('resolveAuthenticatedRequest preserves missing authorization header failure', async () => {
  let verifyCalled = false;
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers(),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
    },
    baseHeaders,
    deps: {
      verifyToken: async () => {
        verifyCalled = true;
        return { ok: true };
      },
      resolveWorkerRequestSlugContext: () => ({ ok: true, slug: 'unused', explicitSlugProvided: true }),
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.equal(verifyCalled, false);
  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Missing Authorization header.' },
      status: 401,
      headers: baseHeaders,
    },
  });
});

test('resolveAuthenticatedRequest preserves verifyToken error passthrough', async () => {
  const calls = [];
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
      }),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
    },
    baseHeaders,
    deps: {
      verifyToken: async (token, secret) => {
        calls.push(['verifyToken', token, secret]);
        return { ok: false, error: 'Token expired.' };
      },
      resolveWorkerRequestSlugContext: () => {
        calls.push(['resolveWorkerRequestSlugContext']);
        return { ok: true, slug: 'unused', explicitSlugProvided: true };
      },
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.deepEqual(calls, [
    ['verifyToken', 'test-token', 'secret'],
  ]);
  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Token expired.' },
      status: 401,
      headers: baseHeaders,
    },
  });
});

test('resolveAuthenticatedRequest records invalid bearer tokens as auth failures', async () => {
  const events = [];
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
      }),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
    },
    baseHeaders,
    deps: {
      verifyToken: async () => ({ ok: false, error: 'Token expired.' }),
      recordAbuseEvent: async (event) => {
        events.push(event);
        return { ok: true };
      },
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'auth_failures');
});

test('resolveAuthenticatedRequest passes token and header slug data through with countEmptyHeaderAsExplicit enabled', async () => {
  let received = null;
  const payload = { sub: '0xabc', jti: 'jti-1' };

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
        'X-Session-Slug': '',
      }),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
      DEFAULT_SESSION_SLUG: '',
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slugHint: 'slug-hint',
    deps: {
      verifyToken: async () => ({ ok: true, payload }),
      resolveWorkerRequestSlugContext: (value) => {
        received = value;
        return { ok: true, slug: 'resolved-slug', tokenSlug: '', explicitSlugProvided: true };
      },
      validateAuthTokenRecord: async () => ({ ok: true, legacy: false }),
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.deepEqual(received, {
    tokenSlug: undefined,
    tokenHasSlug: false,
    headerSlug: '',
    env: {
      TOKEN_HMAC_SECRET: 'secret',
      DEFAULT_SESSION_SLUG: '',
    },
    slugHint: 'slug-hint',
    countEmptyHeaderAsExplicit: true,
  });
  assert.deepEqual(result, {
    ok: true,
    payload,
    slug: 'resolved-slug',
  });
});

test('resolveAuthenticatedRequest preserves missing explicit slug failure', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
      }),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
    },
    baseHeaders,
    deps: {
      verifyToken: async () => ({ ok: true, payload: { sub: '0xabc' } }),
      resolveWorkerRequestSlugContext: () => ({
        ok: true,
        slug: '',
        tokenSlug: '',
        explicitSlugProvided: false,
      }),
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Missing sessionSlug.' },
      status: 400,
      headers: baseHeaders,
    },
  });
});

test('resolveAuthenticatedRequest preserves token/request slug mismatch failure', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
        'X-Session-Slug': 'request-slug',
      }),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
    },
    baseHeaders,
    deps: {
      verifyToken: async () => ({ ok: true, payload: { sub: '0xabc', slug: 'token-slug' } }),
      resolveWorkerRequestSlugContext: () => ({
        ok: true,
        slug: 'request-slug',
        tokenSlug: 'token-slug',
        explicitSlugProvided: true,
      }),
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Token does not match requested session slug.' },
      status: 403,
      headers: baseHeaders,
    },
  });
});

test('resolveAuthenticatedRequest preserves success payload and resolved slug shape', async () => {
  const payload = { sub: '0xabc', scopes: { ai: true }, jti: 'jti-1' };
  let validateCalled = false;

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
        'X-Session-Slug': 'session-a',
      }),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      verifyToken: async () => ({ ok: true, payload }),
      resolveWorkerRequestSlugContext: () => ({
        ok: true,
        slug: 'session-a',
        tokenSlug: '',
        explicitSlugProvided: true,
      }),
      validateAuthTokenRecord: async () => {
        validateCalled = true;
        return { ok: true, legacy: false };
      },
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.equal(validateCalled, true);
  assert.deepEqual(result, {
    ok: true,
    payload,
    slug: 'session-a',
  });
});

test('resolveAuthenticatedRequest rejects tokens without a live non-empty jti record', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };
  const validationPayloads = [];

  for (const payload of [
    { sub: '0xabc', slug: 'session-a', scopes: { ai: true } },
    { sub: '0xabc', slug: 'session-a', scopes: { ai: true }, jti: '   ' },
  ]) {
    const result = await resolveAuthenticatedRequest({
      request: {
        headers: new Headers({
          Authorization: 'Bearer test-token',
          'X-Session-Slug': 'session-a',
        }),
      },
      env: { TOKEN_HMAC_SECRET: 'secret', GROUP_KV: { id: 'kv' } },
      baseHeaders,
      deps: {
        verifyToken: async () => ({ ok: true, payload }),
        resolveWorkerRequestSlugContext: () => ({
          ok: true,
          slug: 'session-a',
          tokenSlug: 'session-a',
          explicitSlugProvided: true,
        }),
        validateAuthTokenRecord: async (value) => {
          validationPayloads.push(value.payload);
          return { ok: false, error: 'Invalid token.' };
        },
        json: createJsonStub(),
        MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      },
    });

    assert.deepEqual(result, {
      ok: false,
      response: {
        body: { error: 'Invalid token.' },
        status: 401,
        headers: baseHeaders,
      },
    });
  }

  assert.deepEqual(validationPayloads.map((payload) => payload.jti), [undefined, '   ']);
});

test('resolveAuthenticatedRequest requires live KV marker for jti tokens', async () => {
  const payload = {
    sub: '0xabc',
    slug: 'session-a',
    scopes: { ai: true },
    jti: 'jti-1',
  };
  const env = {
    TOKEN_HMAC_SECRET: 'secret',
    GROUP_KV: { id: 'kv' },
  };
  const calls = [];

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
        'X-Session-Slug': 'session-a',
      }),
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      verifyToken: async () => ({ ok: true, payload }),
      resolveWorkerRequestSlugContext: () => ({
        ok: true,
        slug: 'session-a',
        tokenSlug: 'session-a',
        explicitSlugProvided: true,
      }),
      validateAuthTokenRecord: async (value) => {
        calls.push(value);
        return { ok: true, legacy: false };
      },
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.deepEqual(calls, [{
    env,
    payload,
    slug: 'session-a',
  }]);
  assert.deepEqual(result, {
    ok: true,
    payload,
    slug: 'session-a',
  });
});

test('resolveAuthenticatedRequest rejects jti tokens after token marker revocation or expiry', async () => {
  const payload = {
    sub: '0xabc',
    slug: 'session-a',
    scopes: { ai: true },
    jti: 'jti-1',
  };
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRequest({
    request: {
      headers: new Headers({
        Authorization: 'Bearer test-token',
        'X-Session-Slug': 'session-a',
      }),
    },
    env: {
      TOKEN_HMAC_SECRET: 'secret',
      GROUP_KV: { id: 'kv' },
    },
    baseHeaders,
    deps: {
      verifyToken: async () => ({ ok: true, payload }),
      resolveWorkerRequestSlugContext: () => ({
        ok: true,
        slug: 'session-a',
        tokenSlug: 'session-a',
        explicitSlugProvided: true,
      }),
      validateAuthTokenRecord: async () => ({ ok: false, error: 'Invalid token.' }),
      json: createJsonStub(),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
    },
  });

  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Invalid token.' },
      status: 401,
      headers: baseHeaders,
    },
  });
});
