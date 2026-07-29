import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedNonSecretActionRoute } from './authenticatedNonSecretActionRouteDispatch.js';

test('dispatchAuthenticatedNonSecretActionRoute ignores unrelated actions', async () => {
  let called = false;

  const result = await dispatchAuthenticatedNonSecretActionRoute({
    action: 'ai',
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => {
        called = true;
        return { ok: true };
      },
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { handled: false });
});

test('dispatchAuthenticatedNonSecretActionRoute blocks fetch work after the session ends', async () => {
  let preflightCalled = false;
  const result = await dispatchAuthenticatedNonSecretActionRoute({
    action: 'fetch_url',
    config: { sessionEndsAt: '2030-01-02T03:04:00Z' },
    headers: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      now: () => Date.parse('2030-01-02T03:04:00Z'),
      json: (body, status, headers) => ({ body, status, headers }),
      evaluateAuthenticatedRoutePreflight: async () => {
        preflightCalled = true;
        return { ok: true };
      },
    },
  });

  assert.equal(preflightCalled, false);
  assert.equal(result.handled, true);
  assert.equal(result.response.status, 410);
  assert.equal(result.response.body.code, 'session_ended');
});

test('dispatchAuthenticatedNonSecretActionRoute preserves fetch preflight failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Token missing fetch scope.' }), {
    status: 403,
  });

  const result = await dispatchAuthenticatedNonSecretActionRoute({
    action: 'fetch_url',
    body: { url: 'https://example.com' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { fetch: false },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'fetch');
        assert.equal(value.route, 'fetch');
        return { ok: false, response };
      },
      fetchUrl: async () => {
        throw new Error('should not dispatch fetch_url');
      },
      checkRateLimit: async () => true,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedNonSecretActionRoute dispatches fetch_url with the preserved url and headers', async () => {
  const downstreamResponse = new Response('html');

  const result = await dispatchAuthenticatedNonSecretActionRoute({
    action: 'fetch_url',
    body: { url: 'https://example.com' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { fetch: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      fetchUrl: async (url, headers) => {
        assert.equal(url, 'https://example.com');
        assert.deepEqual(headers, { 'Access-Control-Allow-Origin': '*' });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedNonSecretActionRoute dispatches fetch_image with the preserved url and headers', async () => {
  const downstreamResponse = new Response('image');

  const result = await dispatchAuthenticatedNonSecretActionRoute({
    action: 'fetch_image',
    body: { url: 'https://example.com/image.png' },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 3,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { fetch: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      fetchImage: async (url, headers) => {
        assert.equal(url, 'https://example.com/image.png');
        assert.deepEqual(headers, { 'Access-Control-Allow-Origin': '*' });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});
