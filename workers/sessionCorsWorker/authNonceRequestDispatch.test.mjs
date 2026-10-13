import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthNonceRequest } from './authNonceRequestDispatch.js';
import { buildNonce, checkNonceRateLimit, consumeNonce, issueNonce } from './nonceLifecycle.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { parseSiweMessage } from './siweMessageValidation.js';

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
  // The coordinator returns the signed nonce; tests echo the random part.
  issueNonce: async (_env, _slug, _address, nonce) => ({ ok: true, nonce }),
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

test('dispatchAuthNonceRequest echoes an explicit canonical identity only while config is uninitialized', async () => {
  const result = await dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({
        adminAction: true,
        sessionId: workerSessionId,
        bootstrapWorkerCanonicalIdentity: true,
      }),
      headers: new Headers({ Origin: 'http://localhost:3000' }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: createNonceDeps({
      resolveExistingSessionCors: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
        config: null,
      }),
      buildNonce: () => 'nonce-worker-bootstrap',
    }),
  });

  assert.deepEqual(result, {
    body: {
      nonce: 'nonce-worker-bootstrap',
      sessionSlug: 'session-a',
      sessionId: workerSessionId,
      bootstrapWorkerCanonicalIdentity: true,
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
  });
});

test('dispatchAuthNonceRequest rejects invalid or initialized identity bootstrap nominations before nonce work', async () => {
  for (const scenario of [
    {
      label: 'missing bootstrap identity',
      body: { adminAction: true, bootstrapWorkerCanonicalIdentity: true },
      config: null,
      status: 400,
      error: 'Worker bootstrap session identity is invalid.',
    },
    {
      label: 'all-zero bootstrap identity',
      body: {
        adminAction: true,
        sessionId: '0x00000000000000000000000000000000',
        bootstrapWorkerCanonicalIdentity: true,
      },
      config: null,
      status: 400,
      error: 'Worker bootstrap session identity is invalid.',
    },
    {
      label: 'initialized registry config',
      body: {
        adminAction: true,
        sessionId: workerSessionId,
        bootstrapWorkerCanonicalIdentity: true,
      },
      config: {
        sessionId: workerSessionId,
        sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } },
      },
      status: 409,
      error: 'Worker identity bootstrap is unavailable after initialization.',
    },
  ]) {
    let rateLimitCalled = false;
    let issueNonceCalled = false;
    const result = await dispatchAuthNonceRequest({
      request: {
        json: async () => createNonceBody(scenario.body),
        headers: new Headers({ Origin: 'http://localhost:3000' }),
      },
      env: { GROUP_KV: {} },
      baseHeaders: { 'Access-Control-Allow-Origin': '*' },
      slug: '',
      deps: createNonceDeps({
        resolveExistingSessionCors: async () => ({
          ok: true,
          headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
          config: scenario.config,
        }),
        checkNonceRateLimit: async () => {
          rateLimitCalled = true;
          return { ok: true };
        },
        issueNonce: async () => {
          issueNonceCalled = true;
          return { ok: true };
        },
      }),
    });

    assert.equal(result.status, scenario.status, scenario.label);
    assert.deepEqual(result.body, { error: scenario.error }, scenario.label);
    assert.equal(rateLimitCalled, false, scenario.label);
    assert.equal(issueNonceCalled, false, scenario.label);
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
      NONCE_SHARED_NETWORK_RATE_LIMIT_MAX: 300,
      NONCE_RATE_LIMIT_WINDOW_MS: 60000,
      NONCE_RATE_LIMIT_TTL_SECONDS: 60,
      checkNonceRateLimit: async (value) => {
        assert.deepEqual(value, {
          env: { GROUP_KV: {} },
          slug: 'session-a',
          identity: 'anon:unknown',
          address: '0xAbC',
          limit: 5,
          sharedNetworkLimit: 300,
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
      issueNonce: async (_env, _slug, _address, nonce) => {
        issueNonceCalled = true;
        return { ok: true, nonce };
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

test('dispatchAuthNonceRequest does not use caller-controlled ids for auth nonce shared-network limits', async () => {
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
  assert.deepEqual(identities, ['anon:unknown', 'anon:unknown']);
});


test('dispatchAuthNonceRequest treats one IPv6 /64 as one caller for nonce limits', async () => {
  const identities = [];
  const deps = createNonceDeps({
    checkNonceRateLimit: async (value) => {
      identities.push(value.identity);
      return { ok: true };
    },
  });
  for (const ip of ['2001:db8:1:2:aaaa::1', '2001:0DB8:0001:0002:ffff:ffff:ffff:ffff', '2001:db8:1:3::1', '203.0.113.7', '::ffff:203.0.113.7', 'not-an-ip']) {
    const result = await dispatchAuthNonceRequest({
      request: {
        json: async () => createNonceBody(),
        headers: new Headers({ Origin: 'https://allowed.example', 'CF-Connecting-IP': ip }),
        cf: {},
      },
      env: {},
      baseHeaders: {},
      slug: '',
      deps,
    });
    assert.equal(result.status, 200);
  }
  assert.deepEqual(identities, [
    'anon:2001:db8:1:2::/64',
    'anon:2001:db8:1:2::/64',
    'anon:2001:db8:1:3::/64',
    'anon:203.0.113.7',
    'anon:203.0.113.7',
    'anon:not-an-ip',
  ]);
});

// One in-memory coordinator per name, with serialized transactions.
const createCoordinatorNamespace = (env, now) => {
  const instances = new Map();
  return {
    idFromName: (name) => name,
    get: (id) => {
      if (!instances.has(id)) {
        const values = new Map();
        let tail = Promise.resolve();
        const storage = {
          get: async (key) => structuredClone(values.get(key)),
          put: async (key, value) => values.set(key, structuredClone(value)),
          delete: async (key) => values.delete(key),
          transaction: (callback) => {
            const run = tail.then(async () => {
              const staged = new Map([...values].map(([key, value]) => [key, structuredClone(value)]));
              const result = await callback({
                get: async (key) => structuredClone(staged.get(key)),
                put: async (key, value) => staged.set(key, structuredClone(value)),
                delete: async (key) => staged.delete(key),
              });
              values.clear();
              for (const [key, value] of staged) values.set(key, value);
              return result;
            });
            tail = run.catch(() => undefined);
            return run;
          },
        };
        const coordinator = new SessionWriteCoordinator({ storage }, env, { now });
        instances.set(id, { fetch: (input, init) => coordinator.fetch(input instanceof Request ? input : new Request(input, init)) });
      }
      return instances.get(id);
    },
  };
};

test('dispatchAuthNonceRequest keeps issuing a wallet nonces while strangers hold many', async () => {
  let nowMs = Date.parse('2026-10-11T12:00:00.000Z');
  const now = () => nowMs;
  const env = {};
  env.CE_SESSION_COORDINATOR = createCoordinatorNamespace(env, now);
  const admin = '0x00000000000000000000000000000000000000aa';
  const deps = createNonceDeps({
    resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: 'session-a' }),
    checkNonceRateLimit: (args) => checkNonceRateLimit({ ...args, now }),
    NONCE_RATE_LIMIT_MAX: 5,
    NONCE_SHARED_NETWORK_RATE_LIMIT_MAX: 300,
    NONCE_RATE_LIMIT_WINDOW_MS: 60_000,
    buildNonce: () => buildNonce(),
    // Like the route shell, pass through anything else the dispatch sends.
    issueNonce: (currentEnv, slug, address, nonce, ttl, caller) => issueNonce(currentEnv, slug, address, nonce, ttl, { now, caller }),
    NONCE_TTL_SECONDS: 300,
    now,
  });
  const requestNonce = (ip) => dispatchAuthNonceRequest({
    request: {
      json: async () => createNonceBody({ address: admin }),
      headers: new Headers({ Origin: 'https://allowed.example', 'CF-Connecting-IP': ip }),
      cf: {},
    },
    env,
    baseHeaders: {},
    slug: '',
    deps,
  });
  // Strangers on 20 IPv6 networks each keep a nonce for the admin's wallet.
  const attack = () => Promise.all(Array.from({ length: 20 }, (_, index) => requestNonce(`2001:db8:abcd:${(index + 1).toString(16)}::1`)));
  assert.equal((await attack()).every((result) => result.status === 200), true);
  const first = await requestNonce('198.51.100.7');
  assert.equal(first.status, 200);
  nowMs += 4 * 60_000;
  await attack();
  nowMs += 2 * 60_000;
  const later = await requestNonce('2001:db8:9999:1::5');
  assert.equal(later.status, 200);
  // EIP-4361 nonces, consumable once by the wallet's signed sign-in.
  assert.match(later.body.nonce, /^[A-Za-z0-9]{8,}$/);
  const message = ['allowed.example wants you to sign in with your Ethereum account:', admin, '', 'Sign in.', '',
    'URI: https://allowed.example', 'Version: 1', 'Chain ID: 1', `Nonce: ${later.body.nonce}`,
    'Issued At: 2026-10-11T12:00:00.000Z'].join('\n');
  assert.equal(parseSiweMessage(message).nonce, later.body.nonce);
  assert.deepEqual(await consumeNonce(env, 'session-a', admin, later.body.nonce, { now }), { ok: true });
  assert.equal((await consumeNonce(env, 'session-a', admin, later.body.nonce, { now })).error, 'Nonce already used.');
  // The first nonce expired with its five-minute lifetime.
  assert.equal((await consumeNonce(env, 'session-a', admin, first.body.nonce, { now })).error, 'Nonce mismatch or expired.');
});

test('dispatchAuthNonceRequest refuses successful issue results without a signed nonce', async () => {
  const result = await dispatchAuthNonceRequest({
    request: { json: async () => createNonceBody(), headers: new Headers({ Origin: 'https://allowed.example' }) },
    env: {},
    baseHeaders: {},
    slug: '',
    deps: createNonceDeps({ issueNonce: async () => ({ ok: true }) }),
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.nonce, undefined);
  assert.equal(result.body.error, 'Authorization state coordination is unavailable.');
});

test('dispatchAuthNonceRequest preserves production fail-closed behavior for old or unavailable coordinators', async () => {
  for (const coordinatedResult of [{ ok: true }, { ok: true, nonce: '' }, { ok: false, status: 503 }]) {
    const result = await dispatchAuthNonceRequest({
      request: { json: async () => createNonceBody(), headers: new Headers({ Origin: 'https://allowed.example' }) },
      env: {},
      baseHeaders: {},
      slug: '',
      deps: createNonceDeps({
        issueNonce: (...args) => issueNonce(...args, {
          issueCoordinatedAuthNonce: async () => coordinatedResult,
        }),
      }),
    });
    assert.equal(result.status, 503);
    assert.equal(result.body.nonce, undefined);
  }
});

test('dispatchAuthNonceRequest keeps a coordinator error status', async () => {
  const result = await dispatchAuthNonceRequest({
    request: { json: async () => createNonceBody(), headers: new Headers({ Origin: 'https://allowed.example' }) },
    env: {},
    baseHeaders: {},
    slug: '',
    deps: createNonceDeps({ issueNonce: async () => ({ ok: false, status: 0 }) }),
  });
  assert.deepEqual(result, {
    body: { error: 'Authorization state coordination is unavailable.' },
    status: 503,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
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
      issueNonce: async (...args) => {
        writes.push(args);
        return { ok: true, nonce: args[3] };
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
        return { ok: true, nonce: args[3] };
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
