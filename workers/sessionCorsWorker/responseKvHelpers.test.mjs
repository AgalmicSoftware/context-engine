import test from 'node:test';
import assert from 'node:assert/strict';

import { getKvJson, json, putKvJson } from './responseKvHelpers.js';

test('json preserves base headers, sets application/json, and does not mutate the input headers', async () => {
  const baseHeaders = new Headers({
    'Access-Control-Allow-Origin': 'https://allowed.example',
    Vary: 'Origin',
  });

  const response = json({ ok: true }, 201, baseHeaders);

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://allowed.example');
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(baseHeaders.has('Content-Type'), false);
  assert.deepEqual(await response.json(), { ok: true });
});

test('getKvJson preserves valid JSON reads and returns null when the key is missing', async () => {
  const calls = [];
  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(key);
        return key === 'present' ? '{"ok":true,"count":2}' : null;
      },
    },
  };

  assert.deepEqual(await getKvJson(env, 'present'), { ok: true, count: 2 });
  assert.equal(await getKvJson(env, 'missing'), null);
  assert.deepEqual(calls, ['present', 'missing']);
});

test('getKvJson fails closed when KV stores malformed JSON', async () => {
  const env = {
    GROUP_KV: {
      get: async () => '{not-json',
    },
  };

  assert.equal(await getKvJson(env, 'broken'), null);
});

test('putKvJson preserves JSON-stringified writes and ttl expiration options', async () => {
  const writes = [];
  const env = {
    GROUP_KV: {
      put: async (...args) => {
        writes.push(args);
      },
    },
  };

  await putKvJson(env, 'session:test:config', { ok: true }, 300);

  assert.deepEqual(writes, [[
    'session:test:config',
    '{"ok":true}',
    { expirationTtl: 300 },
  ]]);
});

test('putKvJson preserves the empty-options write contract when ttl is omitted', async () => {
  const writes = [];
  const env = {
    GROUP_KV: {
      put: async (...args) => {
        writes.push(args);
      },
    },
  };

  await putKvJson(env, 'session:test:secrets', { openaiKey: 'sk-test' });

  assert.deepEqual(writes, [[
    'session:test:secrets',
    '{"openaiKey":"sk-test"}',
    {},
  ]]);
});
