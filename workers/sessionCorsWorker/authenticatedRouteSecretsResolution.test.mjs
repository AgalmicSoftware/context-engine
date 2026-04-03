import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthenticatedRouteSecrets } from './authenticatedRouteSecretsResolution.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('resolveAuthenticatedRouteSecrets preserves missing-secrets failure', async () => {
  const calls = [];
  const headers = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveAuthenticatedRouteSecrets({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    headers,
    deps: {
      getSessionSecrets: async (env, slug) => {
        calls.push([env, slug]);
        return null;
      },
      json: createJsonStub(),
    },
  });

  assert.deepEqual(calls, [
    [{ GROUP_KV: {} }, 'session-a'],
  ]);
  assert.deepEqual(result, {
    ok: false,
    reason: 'missing_secrets',
    response: {
      body: { error: 'Session secrets not configured.' },
      status: 401,
      headers,
    },
  });
});

test('resolveAuthenticatedRouteSecrets preserves successful secret payload shape', async () => {
  const secrets = { openaiKey: 'secret-key' };

  const result = await resolveAuthenticatedRouteSecrets({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    headers: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      getSessionSecrets: async () => secrets,
      json: createJsonStub(),
    },
  });

  assert.deepEqual(result, {
    ok: true,
    reason: 'resolved',
    secrets,
  });
});

test('resolveAuthenticatedRouteSecrets allows empty secret objects when the store resolves truthy data', async () => {
  const secrets = {};

  const result = await resolveAuthenticatedRouteSecrets({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    headers: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      getSessionSecrets: async () => secrets,
      json: createJsonStub(),
    },
  });

  assert.deepEqual(result, {
    ok: true,
    reason: 'resolved',
    secrets,
  });
});
