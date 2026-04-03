import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedRouteEntry } from './authenticatedRouteEntry.js';

test('dispatchAuthenticatedRouteEntry preserves auth failure passthrough', async () => {
  let contextCalled = false;
  let dispatchCalled = false;

  const response = { body: { error: 'Missing Authorization header.' }, status: 401 };
  const result = await dispatchAuthenticatedRouteEntry({
    path: '/health',
    method: 'GET',
    request: { headers: new Headers() },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      requireAuth: async () => ({ ok: false, response }),
      resolveAuthenticatedRouteContext: async () => {
        contextCalled = true;
        return { ok: true };
      },
      dispatchAuthenticatedRoute: async () => {
        dispatchCalled = true;
        return new Response('ok');
      },
      json: () => null,
    },
  });

  assert.equal(contextCalled, false);
  assert.equal(dispatchCalled, false);
  assert.equal(result, response);
});

test('dispatchAuthenticatedRouteEntry preserves /health success without route-context resolution', async () => {
  let contextCalled = false;
  let dispatchCalled = false;

  const result = await dispatchAuthenticatedRouteEntry({
    path: '/health',
    method: 'GET',
    request: { headers: new Headers({ Origin: 'https://app.example' }) },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://app.example' },
    deps: {
      requireAuth: async () => ({ ok: true, payload: { sub: '0xabc' }, slug: 'session-a' }),
      resolveAuthenticatedRouteContext: async () => {
        contextCalled = true;
        return { ok: true };
      },
      dispatchAuthenticatedRoute: async () => {
        dispatchCalled = true;
        return new Response('ok');
      },
      json: (body, status, headers) => ({ body, status, headers }),
      now: () => 1234567890,
    },
  });

  assert.equal(contextCalled, false);
  assert.equal(dispatchCalled, false);
  assert.deepEqual(result, {
    body: { ok: true, ts: 1234567890 },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://app.example' },
  });
});

test('dispatchAuthenticatedRouteEntry preserves authenticated route-context failure passthrough', async () => {
  let dispatchCalled = false;
  const response = { body: { error: 'Session config not found.' }, status: 404 };

  const result = await dispatchAuthenticatedRouteEntry({
    path: '/ai',
    method: 'POST',
    request: { headers: new Headers() },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      requireAuth: async () => ({ ok: true, payload: { sub: '0xabc' }, slug: 'session-a' }),
      resolveAuthenticatedRouteContext: async (value) => {
        assert.equal(value.auth.slug, 'session-a');
        return { ok: false, response };
      },
      dispatchAuthenticatedRoute: async () => {
        dispatchCalled = true;
        return new Response('ok');
      },
      json: () => null,
    },
  });

  assert.equal(dispatchCalled, false);
  assert.equal(result, response);
});

test('dispatchAuthenticatedRouteEntry dispatches authenticated routes with resolved context', async () => {
  const request = new Request('https://worker.example/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'ping' }),
  });
  const authenticatedContext = {
    ok: true,
    slug: 'session-a',
    config: { limits: { perWalletPerDay: 7 } },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { ai: true },
    address: '0xabc',
    limit: 7,
  };
  const response = new Response('ok');

  const result = await dispatchAuthenticatedRouteEntry({
    path: '/ai',
    method: 'POST',
    request,
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      requireAuth: async () => ({ ok: true, payload: { sub: '0xabc' }, slug: 'session-a' }),
      resolveAuthenticatedRouteContext: async () => ({ ok: true, ...authenticatedContext }),
      dispatchAuthenticatedRoute: async (value) => {
        assert.deepEqual(value, {
          path: '/ai',
          method: 'POST',
          request,
          authenticatedContext,
        });
        return response;
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
});
