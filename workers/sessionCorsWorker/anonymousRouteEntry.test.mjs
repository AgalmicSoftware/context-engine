import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAnonymousRouteEntry } from './anonymousRouteEntry.js';

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
