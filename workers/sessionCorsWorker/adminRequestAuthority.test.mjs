import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAdminRequestAuthority } from './adminRequestAuthority.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createSignedBody = (overrides = {}) => ({
  address: '0xabc',
  signature: '0xsig',
  action: 'set-config',
  slug: 'session-a',
  bodyHash: '0xbodyhash',
  nonce: 'nonce-1',
  audience: 'https://contextengine.xyz',
  expiration: Math.floor(Date.now() / 1000) + 300,
  ...overrides,
});

const createAuthorityDeps = (overrides = {}) => ({
  json: createJsonStub(),
  normalizeSignedWorkerRequest: (body) => ({
    address: body.address,
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
    config: { adminAddress: '0xabc' },
  }),
  buildAdminActionBodyHash: () => '0xbodyhash',
  validateAdminActionAudience: () => ({ ok: true, audience: 'https://contextengine.xyz' }),
  verifyAdminActionSignature: () => ({ valid: true, address: '0xabc' }),
  consumeNonce: async () => ({ ok: true }),
  validateBootstrapAdmin: async () => false,
  validateAdmin: async () => true,
  MISSING_SLUG_ERROR: 'Missing sessionSlug.',
  ...overrides,
});

const createRequestArgs = (overrides = {}) => ({
  env: { GROUP_KV: {} },
  request: {
    url: 'https://worker.example/admin/set-config',
    headers: new Headers({ Origin: 'https://allowed.example' }),
  },
  body: createSignedBody(),
  slugHint: '',
  action: 'set-config',
  baseHeaders: { 'Access-Control-Allow-Origin': '*' },
  deps: createAuthorityDeps(),
  ...overrides,
});

test('resolveAdminRequestAuthority preserves slug and signed-request precondition failures', async () => {
  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
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
    await resolveAdminRequestAuthority(createRequestArgs({
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
    await resolveAdminRequestAuthority(createRequestArgs({
      body: createSignedBody({ signature: '' }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Missing admin action signature fields.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    },
  );

  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
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

test('resolveAdminRequestAuthority accepts an explicit general-session slug', async () => {
  const result = await resolveAdminRequestAuthority(createRequestArgs({
    slugHint: 'general',
    body: createSignedBody({ slug: '' }),
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
          config: { adminAddress: '0xabc' },
        };
      },
    }),
  }));

  assert.equal(result.ok, true);
  assert.equal(result.targetSlug, '');
});

test('resolveAdminRequestAuthority preserves existing-session CORS passthrough before signature verification', async () => {
  let verifyCalled = false;
  const corsResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
  });

  const result = await resolveAdminRequestAuthority(createRequestArgs({
    deps: createAuthorityDeps({
      resolveExistingSessionCors: async (value) => {
        assert.equal(value.slug, 'session-a');
        return { ok: false, response: corsResponse };
      },
      verifyAdminActionSignature: () => {
        verifyCalled = true;
        return { valid: true, address: '0xabc' };
      },
    }),
  }));

  assert.equal(verifyCalled, false);
  assert.deepEqual(result, {
    ok: false,
    response: corsResponse,
  });
});

test('resolveAdminRequestAuthority preserves existing allowOrigins when validating admin audience', async () => {
  let audienceArgs = null;

  const result = await resolveAdminRequestAuthority(createRequestArgs({
    request: {
      url: 'https://worker.example/admin/set-config',
      headers: new Headers({ Origin: 'https://custom.example' }),
    },
    body: createSignedBody({
      audience: 'https://custom.example',
      config: {
        allowOrigins: ['https://custom.example'],
      },
    }),
    deps: createAuthorityDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://custom.example' },
        config: { adminAddress: '0xabc', allowOrigins: ['https://existing.example'] },
      }),
      validateAdminActionAudience: (value) => {
        audienceArgs = value;
        return { ok: true, audience: value.audience };
      },
    }),
  }));

  assert.equal(result.ok, true);
  assert.equal(audienceArgs?.audience, 'https://custom.example');
  assert.equal(audienceArgs?.request?.url, 'https://worker.example/admin/set-config');
  assert.equal(audienceArgs?.request?.headers?.get('Origin'), 'https://custom.example');
  assert.deepEqual(audienceArgs?.env, { GROUP_KV: {} });
  assert.deepEqual(audienceArgs?.config, {
    adminAddress: '0xabc',
    allowOrigins: ['https://existing.example'],
  });
  assert.equal(audienceArgs?.initializingConfig, null);
});

test('resolveAdminRequestAuthority forwards the initializing allowOrigins for bootstrap set-config requests', async () => {
  let audienceArgs = null;

  const result = await resolveAdminRequestAuthority(createRequestArgs({
    request: {
      url: 'https://worker.example/admin/set-config',
      headers: new Headers({ Origin: 'https://custom.example' }),
    },
    body: createSignedBody({
      audience: 'https://custom.example',
      config: {
        allowOrigins: ['https://custom.example'],
      },
    }),
    deps: createAuthorityDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://custom.example' },
        config: null,
      }),
      validateAdminActionAudience: (value) => {
        audienceArgs = value;
        return { ok: true, audience: value.audience };
      },
      validateBootstrapAdmin: async () => true,
    }),
  }));

  assert.equal(result.ok, true);
  assert.equal(audienceArgs?.audience, 'https://custom.example');
  assert.equal(audienceArgs?.config, null);
  assert.deepEqual(audienceArgs?.initializingConfig, {
    allowOrigins: ['https://custom.example'],
  });
});

test('resolveAdminRequestAuthority preserves admin-action validation and nonce failure contracts', async () => {
  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
      body: createSignedBody({ action: 'set-secrets' }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Admin action mismatch.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
      body: createSignedBody({ slug: 'other-session' }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Admin slug mismatch.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        buildAdminActionBodyHash: () => '0xdifferent',
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Admin request body mismatch.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        validateAdminActionAudience: () => ({
          ok: false,
          error: 'Untrusted admin audience.',
        }),
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Untrusted admin audience.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        verifyAdminActionSignature: () => ({
          valid: false,
          error: 'Invalid signature.',
        }),
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
    await resolveAdminRequestAuthority(createRequestArgs({
      deps: createAuthorityDeps({
        verifyAdminActionSignature: () => ({
          valid: false,
          error: 'Signature does not match address.',
        }),
      }),
    })),
    {
      ok: false,
      response: {
        body: { error: 'Signature does not match address.' },
        status: 400,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      },
    },
  );

  assert.deepEqual(
    await resolveAdminRequestAuthority(createRequestArgs({
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

test('resolveAdminRequestAuthority preserves bootstrap set-config authorization before configured-admin fallback', async () => {
  const calls = [];

  const result = await resolveAdminRequestAuthority(createRequestArgs({
    body: createSignedBody({
      config: { sessionName: 'Bootstrap Session' },
    }),
    deps: createAuthorityDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        config: null,
      }),
      validateBootstrapAdmin: async (value) => {
        calls.push(['validateBootstrapAdmin', value.slug, value.address, value.body.config.sessionName]);
        return true;
      },
      validateAdmin: async () => {
        calls.push(['validateAdmin']);
        return true;
      },
    }),
  }));

  assert.deepEqual(calls, [[
    'validateBootstrapAdmin',
    'session-a',
    '0xabc',
    'Bootstrap Session',
  ]]);
  assert.deepEqual(result, {
    ok: true,
    address: '0xabc',
    existingConfig: null,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    targetSlug: 'session-a',
  });
});

test('resolveAdminRequestAuthority falls back from bootstrap auth to validateAdmin when bootstrap fails', async () => {
  const calls = [];

  const result = await resolveAdminRequestAuthority(createRequestArgs({
    deps: createAuthorityDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        config: null,
      }),
      validateBootstrapAdmin: async () => {
        calls.push('validateBootstrapAdmin');
        return false;
      },
      validateAdmin: async (value) => {
        calls.push(['validateAdmin', value.config]);
        return true;
      },
    }),
  }));

  assert.deepEqual(calls, [
    'validateBootstrapAdmin',
    ['validateAdmin', null],
  ]);
  assert.deepEqual(result, {
    ok: true,
    address: '0xabc',
    existingConfig: null,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    targetSlug: 'session-a',
  });
});

test('resolveAdminRequestAuthority preserves the final admin authorization failure contract', async () => {
  const body = createSignedBody({
    action: 'set-secrets',
  });
  const result = await resolveAdminRequestAuthority(createRequestArgs({
    action: 'set-secrets',
    body,
    deps: createAuthorityDeps({
      validateBootstrapAdmin: async () => {
        throw new Error('bootstrap auth should not run for set-secrets');
      },
      validateAdmin: async (value) => {
        assert.deepEqual(value, {
          env: { GROUP_KV: {} },
          slug: 'session-a',
          address: '0xabc',
          config: { adminAddress: '0xabc' },
          body,
        });
        return false;
      },
    }),
  }));

  assert.deepEqual(result, {
    ok: false,
    response: {
      body: { error: 'Admin authorization failed.' },
      status: 403,
      headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    },
  });
});
