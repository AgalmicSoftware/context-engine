import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedRoute } from './authenticatedRouteDispatch.js';

const createAuthenticatedContext = () => ({
  slug: 'session-a',
  config: { registryAddress: '0x0000000000000000000000000000000000000001' },
  headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  scopes: { ai: true, fetch: true, arweave: true, transcribe: true, faucet: true },
  address: '0xabc',
  limit: 7,
});

test('dispatchAuthenticatedRoute short-circuits secret path routes before authenticated action parsing', async () => {
  const response = new Response('transcribed');
  let readPayloadCalled = false;
  let nonSecretCalled = false;
  let secretActionCalled = false;

  const result = await dispatchAuthenticatedRoute({
    path: '/transcribe',
    method: 'POST',
    request: { headers: new Headers() },
    authenticatedContext: createAuthenticatedContext(),
    deps: {
      dispatchAuthenticatedSecretPathRoute: async (value) => {
        assert.equal(value.path, '/transcribe');
        assert.equal(value.method, 'POST');
        assert.equal(value.slug, 'session-a');
        assert.equal(value.address, '0xabc');
        return { handled: true, response };
      },
      readAuthenticatedActionPayload: async () => {
        readPayloadCalled = true;
        return { ok: true, payload: null, action: '' };
      },
      dispatchAuthenticatedNonSecretActionRoute: async () => {
        nonSecretCalled = true;
        return { handled: false };
      },
      dispatchAuthenticatedSecretActionRoute: async () => {
        secretActionCalled = true;
        return { handled: false };
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
  assert.equal(readPayloadCalled, false);
  assert.equal(nonSecretCalled, false);
  assert.equal(secretActionCalled, false);
});

test('dispatchAuthenticatedRoute preserves authenticated action parse error passthrough', async () => {
  let nonSecretCalled = false;
  let secretActionCalled = false;
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const result = await dispatchAuthenticatedRoute({
    path: '/',
    method: 'POST',
    request: { headers: new Headers({ 'content-type': 'application/json' }) },
    authenticatedContext: {
      ...createAuthenticatedContext(),
      headers,
    },
    deps: {
      dispatchAuthenticatedSecretPathRoute: async () => ({ handled: false }),
      readAuthenticatedActionPayload: async () => ({
        ok: false,
        error: 'Invalid JSON.',
        status: 400,
      }),
      dispatchAuthenticatedNonSecretActionRoute: async () => {
        nonSecretCalled = true;
        return { handled: false };
      },
      dispatchAuthenticatedSecretActionRoute: async () => {
        secretActionCalled = true;
        return { handled: false };
      },
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
    },
  });

  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers,
  });
  assert.equal(nonSecretCalled, false);
  assert.equal(secretActionCalled, false);
});

test('dispatchAuthenticatedRoute short-circuits non-secret action routes before secret action routes', async () => {
  const response = new Response('fetched');
  let secretActionCalled = false;

  const result = await dispatchAuthenticatedRoute({
    path: '/',
    method: 'POST',
    request: { headers: new Headers({ 'content-type': 'application/json' }) },
    authenticatedContext: createAuthenticatedContext(),
    deps: {
      dispatchAuthenticatedSecretPathRoute: async () => ({ handled: false }),
      readAuthenticatedActionPayload: async () => ({
        ok: true,
        payload: { action: 'fetch_url', url: 'https://example.com' },
        action: 'fetch_url',
      }),
      dispatchAuthenticatedNonSecretActionRoute: async (value) => {
        assert.deepEqual(value, {
          action: 'fetch_url',
          body: { action: 'fetch_url', url: 'https://example.com' },
          config: { registryAddress: '0x0000000000000000000000000000000000000001' },
          slug: 'session-a',
          address: '0xabc',
          limit: 7,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          scopes: { ai: true, fetch: true, arweave: true, transcribe: true, faucet: true },
        });
        return { handled: true, response };
      },
      dispatchAuthenticatedSecretActionRoute: async () => {
        secretActionCalled = true;
        return { handled: false };
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
  assert.equal(secretActionCalled, false);
});

test('dispatchAuthenticatedRoute short-circuits secret action routes after non-secret routes decline', async () => {
  const response = new Response('proxied');

  const result = await dispatchAuthenticatedRoute({
    path: '/ai',
    method: 'POST',
    request: { headers: new Headers({ 'content-type': 'application/json' }) },
    authenticatedContext: createAuthenticatedContext(),
    deps: {
      dispatchAuthenticatedSecretPathRoute: async () => ({ handled: false }),
      readAuthenticatedActionPayload: async () => ({
        ok: true,
        payload: { action: 'ai', prompt: 'ping' },
        action: 'ai',
      }),
      dispatchAuthenticatedNonSecretActionRoute: async (value) => {
        assert.equal(value.action, 'ai');
        return { handled: false };
      },
      dispatchAuthenticatedSecretActionRoute: async (value) => {
        assert.deepEqual(value, {
          path: '/ai',
          action: 'ai',
          body: { action: 'ai', prompt: 'ping' },
          config: { registryAddress: '0x0000000000000000000000000000000000000001' },
          slug: 'session-a',
          address: '0xabc',
          limit: 7,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          scopes: { ai: true, fetch: true, arweave: true, transcribe: true, faucet: true },
        });
        return { handled: true, response };
      },
      json: () => null,
    },
  });

  assert.equal(result, response);
});

test('dispatchAuthenticatedRoute returns the authenticated not-found response when no helper handles the request', async () => {
  let readPayloadCalled = false;
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const result = await dispatchAuthenticatedRoute({
    path: '/unknown',
    method: 'GET',
    request: { headers: new Headers() },
    authenticatedContext: {
      ...createAuthenticatedContext(),
      headers,
    },
    deps: {
      dispatchAuthenticatedSecretPathRoute: async () => ({ handled: false }),
      readAuthenticatedActionPayload: async () => {
        readPayloadCalled = true;
        return { ok: true, payload: null, action: '' };
      },
      dispatchAuthenticatedNonSecretActionRoute: async (value) => {
        assert.equal(value.action, '');
        assert.equal(value.body, null);
        return { handled: false };
      },
      dispatchAuthenticatedSecretActionRoute: async (value) => {
        assert.equal(value.path, '/unknown');
        assert.equal(value.action, '');
        assert.equal(value.body, null);
        return { handled: false };
      },
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
    },
  });

  assert.equal(readPayloadCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Not found.' },
    status: 404,
    headers,
  });
});
