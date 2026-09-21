import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAnonymousRouteEntry } from './anonymousRouteEntry.js';
import { createRateLimitFaucetSupportWithWorkerDeps } from './rateLimitFaucetSupportBinding.js';

test('dispatchAnonymousRouteEntry preserves missing explicit slug failure', async () => {
  let configCalled = false;

  const result = await dispatchAnonymousRouteEntry({
    path: '/ai',
    anonymousRoute: 'ai',
    request: { headers: new Headers() },
    env: { GROUP_KV: {} },
    slugHint: '',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: false, slug: '' }),
      getSessionConfig: async () => {
        configCalled = true;
        return null;
      },
      json: (body, status, headers) => ({ body, status, headers }),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal(configCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Missing sessionSlug.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchAnonymousRouteEntry preserves missing-config failure before cors and rate checks', async () => {
  let corsCalled = false;
  let rateCalled = false;

  const result = await dispatchAnonymousRouteEntry({
    path: '/ai',
    anonymousRoute: 'ai',
    request: { headers: new Headers({ Origin: 'https://app.example' }) },
    env: { GROUP_KV: {} },
    slugHint: '',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://app.example' },
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'session-a' }),
      getSessionConfig: async () => null,
      getCorsContext: async () => {
        corsCalled = true;
        return { ok: true, headers: {} };
      },
      checkRateLimit: async () => {
        rateCalled = true;
        return true;
      },
      json: (body, status, headers) => ({ body, status, headers }),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal(corsCalled, false);
  assert.equal(rateCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Session config not found.' },
    status: 404,
    headers: { 'Access-Control-Allow-Origin': 'https://app.example' },
  });
});

test('dispatchAnonymousRouteEntry preserves blocked-origin passthrough before rate checks', async () => {
  let rateCalled = false;
  const blockedResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers: { Vary: 'Origin' },
  });

  const result = await dispatchAnonymousRouteEntry({
    path: '/ai',
    anonymousRoute: 'ai',
    request: { headers: new Headers({ Origin: 'https://blocked.example' }) },
    env: { GROUP_KV: {} },
    slugHint: '',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://blocked.example' },
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'session-a' }),
      getSessionConfig: async () => ({ allowOrigins: ['https://allowed.example'] }),
      getCorsContext: async () => ({ ok: false, response: blockedResponse }),
      checkRateLimit: async () => {
        rateCalled = true;
        return true;
      },
      json: () => null,
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal(rateCalled, false);
  assert.equal(result, blockedResponse);
});

test('dispatchAnonymousRouteEntry preserves rate-limit failure after slug/config/cors resolution', async () => {
  let dispatchCalled = false;
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const result = await dispatchAnonymousRouteEntry({
    path: '/transcribe',
    anonymousRoute: 'transcribe',
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    env: { GROUP_KV: {} },
    slugHint: '',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'session-a' }),
      getSessionConfig: async () => ({
        limits: { perWalletPerDay: 2 },
      }),
      getCorsContext: async () => ({ ok: true, headers }),
      resolveAnonymousRateIdentity: () => 'anon:test',
      checkRateLimit: async (value) => {
        assert.deepEqual(value, {
          env: { GROUP_KV: {} },
          slug: 'session-a',
          address: 'anon:test',
          limit: 2,
          route: 'transcribe',
        });
        return false;
      },
      dispatchAnonymousRoute: async () => {
        dispatchCalled = true;
        return new Response('ok');
      },
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal(dispatchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Rate limit exceeded.' },
    status: 429,
    headers,
  });
});


test('dispatchAnonymousRouteEntry resolves anonymous IP daily budgets for each anonymous route key', async () => {
  const cases = [
    {
      name: 'explicit zero disables anonymous limiter while wallet limit stays positive',
      path: '/storage/read',
      anonymousRoute: 'storage',
      limits: { perWalletPerDay: 8, perAnonymousIpPerDay: 0 },
      expectedLimit: 0,
    },
    {
      name: 'explicit anonymous limit overrides wallet limit',
      path: '/transcribe',
      anonymousRoute: 'transcribe',
      limits: { perWalletPerDay: 8, perAnonymousIpPerDay: 3 },
      expectedLimit: 3,
    },
    {
      name: 'realtime calls use the selected anonymous realtime route key',
      path: '/realtime/call',
      anonymousRoute: 'realtime',
      limits: { perWalletPerDay: 8, perAnonymousIpPerDay: 4 },
      expectedLimit: 4,
    },
    {
      name: 'storage reads use the selected anonymous storage route key',
      path: '/storage/read',
      anonymousRoute: 'storage',
      limits: { perWalletPerDay: 8, perAnonymousIpPerDay: 5 },
      expectedLimit: 5,
    },
    {
      name: 'storage lists use the selected anonymous storage route key',
      path: '/storage/list',
      anonymousRoute: 'storage',
      limits: { perWalletPerDay: 8, perAnonymousIpPerDay: 6 },
      expectedLimit: 6,
    },
    {
      name: 'group discovery uses the selected anonymous groups route key',
      path: '/groups/list',
      anonymousRoute: 'groups',
      limits: { perWalletPerDay: 8, perAnonymousIpPerDay: 7 },
      expectedLimit: 7,
    },
    {
      name: 'absent anonymous limit keeps legacy wallet fallback',
      path: '/ai',
      anonymousRoute: 'ai',
      limits: { perWalletPerDay: 8 },
      expectedLimit: 8,
    },
    {
      name: 'malformed anonymous limit keeps legacy wallet fallback',
      path: '/transcribe',
      anonymousRoute: 'transcribe',
      limits: { perWalletPerDay: 8, perAnonymousIpPerDay: '3' },
      expectedLimit: 8,
    },
  ];

  for (const entry of cases) {
    let dispatchCalled = false;
    let capturedRateLimit = null;
    const env = { GROUP_KV: { caseName: entry.name } };
    const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

    const result = await dispatchAnonymousRouteEntry({
      path: entry.path,
      anonymousRoute: entry.anonymousRoute,
      request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
      env,
      slugHint: '',
      baseHeaders: headers,
      deps: {
        resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'session-a' }),
        getSessionConfig: async () => ({ limits: entry.limits }),
        getCorsContext: async () => ({ ok: true, headers }),
        resolveAnonymousRateIdentity: () => 'anon:test',
        checkRateLimit: async (value) => {
          capturedRateLimit = value;
          return false;
        },
        dispatchAnonymousRoute: async () => {
          dispatchCalled = true;
          return new Response('ok');
        },
        json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
        MISSING_SLUG_ERROR: 'Missing sessionSlug.',
        SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
      },
    });

    assert.equal(dispatchCalled, false, entry.name);
    assert.deepEqual(capturedRateLimit, {
      env,
      slug: 'session-a',
      address: 'anon:test',
      limit: entry.expectedLimit,
      route: entry.anonymousRoute,
    }, entry.name);
    assert.deepEqual(result, {
      body: { error: 'Rate limit exceeded.' },
      status: 429,
      headers,
    }, entry.name);
  }
});


test('dispatchAnonymousRouteEntry allows 100 same-IP anonymous storage reads when the anonymous IP budget is unlimited', async () => {
  const env = { GROUP_KV: {} };
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const counters = new Map();
  const coordinator = async ({ slug, route, identity, limit }) => {
    const key = `${slug}:${route}:${identity}`;
    const count = (counters.get(key) || 0) + 1;
    counters.set(key, count);
    return { ok: true, allowed: count <= limit, count };
  };
  const { checkRateLimit } = createRateLimitFaucetSupportWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      checkCoordinatedAuthRateLimit: coordinator,
    },
  });
  let dispatchCount = 0;

  for (let index = 0; index < 101; index++) {
    const result = await dispatchAnonymousRouteEntry({
      path: '/storage/read',
      anonymousRoute: 'storage',
      request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
      env,
      slugHint: '',
      baseHeaders: headers,
      deps: {
        resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'session-a' }),
        getSessionConfig: async () => ({ limits: { perWalletPerDay: 1, perAnonymousIpPerDay: 0 } }),
        getCorsContext: async () => ({ ok: true, headers }),
        resolveAnonymousRateIdentity: () => 'anon:same-ip',
        checkRateLimit,
        dispatchAnonymousRoute: async () => {
          dispatchCount++;
          return new Response('ok');
        },
        json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
        MISSING_SLUG_ERROR: 'Missing sessionSlug.',
        SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
      },
    });

    assert.equal(result.status, 200, `request ${index + 1}`);
  }

  assert.equal(dispatchCount, 101);
  assert.equal(counters.size, 0, 'limit 0 should not touch the daily coordinator');
});

test('dispatchAnonymousRouteEntry enforces positive anonymous budgets per session and route', async () => {
  const env = { GROUP_KV: {} };
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const counters = new Map();
  const coordinator = async ({ slug, route, identity, limit }) => {
    const key = `${slug}:${route}:${identity}`;
    const count = (counters.get(key) || 0) + 1;
    counters.set(key, count);
    return { ok: true, allowed: count <= limit, count };
  };
  const { checkRateLimit } = createRateLimitFaucetSupportWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      checkCoordinatedAuthRateLimit: coordinator,
      recordAbuseEvent: async () => ({ ok: true }),
    },
  });
  const callRoute = async ({ slug = 'session-a', route = 'ai' } = {}) => dispatchAnonymousRouteEntry({
    path: `/${route}`,
    anonymousRoute: route,
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    env,
    slugHint: '',
    baseHeaders: headers,
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug }),
      getSessionConfig: async () => ({ limits: { perWalletPerDay: 1, perAnonymousIpPerDay: 3 } }),
      getCorsContext: async () => ({ ok: true, headers }),
      resolveAnonymousRateIdentity: () => 'anon:same-ip',
      checkRateLimit,
      dispatchAnonymousRoute: async () => new Response('ok'),
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal((await callRoute()).status, 200);
  assert.equal((await callRoute()).status, 200);
  assert.equal((await callRoute()).status, 200);
  assert.equal((await callRoute()).status, 429);
  assert.equal((await callRoute({ route: 'transcribe' })).status, 200);
  assert.equal((await callRoute({ slug: 'session-b' })).status, 200);
});

test('dispatchAnonymousRouteEntry dispatches anonymous route with resolved slug, config, and headers', async () => {
  const request = new Request('https://worker.example/ai', {
    method: 'POST',
    headers: { Origin: 'https://allowed.example' },
    body: JSON.stringify({ prompt: 'ping' }),
  });
  const config = {
    allowOrigins: ['https://allowed.example'],
    limits: { perWalletPerDay: 7 },
  };
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const response = new Response('ok');

  const result = await dispatchAnonymousRouteEntry({
    path: '/ai',
    anonymousRoute: 'ai',
    request,
    env: { GROUP_KV: {} },
    slugHint: 'session-hint',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    deps: {
      resolveRequestSlugWithoutToken: (value) => {
        assert.equal(value.slugHint, 'session-hint');
        return { ok: true, explicitSlugProvided: true, slug: 'session-a' };
      },
      getSessionConfig: async (_env, slug) => {
        assert.equal(slug, 'session-a');
        return config;
      },
      getCorsContext: async ({ request: receivedRequest, config: receivedConfig }) => {
        assert.equal(receivedRequest, request);
        assert.equal(receivedConfig, config);
        return { ok: true, headers };
      },
      resolveAnonymousRateIdentity: () => 'anon:test',
      checkRateLimit: async () => true,
      dispatchAnonymousRoute: async (value) => {
        assert.deepEqual(value, {
          path: '/ai',
          request,
          anonymousContext: {
            slug: 'session-a',
            config,
            headers,
            env: { GROUP_KV: {} },
          },
        });
        return response;
      },
      json: () => null,
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
    },
  });

  assert.equal(result, response);
});
