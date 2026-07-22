import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNonce,
  checkNonceRateLimit,
  consumeNonce,
  issueNonce,
} from './nonceLifecycle.js';

test('buildNonce fills a 16-byte buffer and encodes it with the provided base64url helper', () => {
  const calls = [];

  const nonce = buildNonce({
    getRandomValues: (bytes) => {
      assert.equal(bytes.length, 16);
      bytes.set([1, 2, 3, 4]);
      return bytes;
    },
    base64UrlEncode: (bytes) => {
      calls.push(Array.from(bytes));
      return 'encoded-nonce';
    },
  });

  assert.equal(nonce, 'encoded-nonce');
  assert.deepEqual(calls, [[1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]);
});

test('issueNonce requires durable coordination before writing the KV compatibility mirror', async () => {
  const calls = [];
  const env = { GROUP_KV: { put: async (...args) => calls.push(args) } };
  const unavailable = await issueNonce(env, 'session-a', '0xabc', 'nonce-1', 300, {
    issueCoordinatedAuthNonce: async () => ({
      ok: false,
      status: 503,
      error: 'Authorization state coordination is unavailable.',
    }),
  });
  assert.equal(unavailable.ok, false);
  assert.deepEqual(calls, []);

  const issued = await issueNonce(env, 'session-a', '0xabc', 'nonce-1', 300, {
    usedNonceTtlSeconds: 600,
    issueCoordinatedAuthNonce: async (value) => {
      calls.push(value);
      return { ok: true, status: 200 };
    },
  });
  assert.equal(issued.ok, true);
  assert.equal(calls[0].slug, 'session-a');
  assert.equal(calls[0].usedNonceTtlSeconds, 600);
  assert.deepEqual(calls[1], [
    'nonce:session-a:0xabc',
    'nonce-1',
    { expirationTtl: 300 },
  ]);
});

test('consumeNonce trusts the durable verdict and mirrors successful consumption to KV', async () => {
  const calls = [];
  const env = {
    GROUP_KV: {
      put: async (...args) => calls.push(['put', ...args]),
      delete: async (...args) => calls.push(['delete', ...args]),
    },
  };
  const result = await consumeNonce(env, 'session-a', '0xabc', 'nonce-1', {
    usedNonceTtlSeconds: 321,
    consumeCoordinatedAuthNonce: async (value) => {
      calls.push(['coordinator', value]);
      return { ok: true, status: 200 };
    },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0][1].nonce, 'nonce-1');
  assert.deepEqual(calls.slice(1), [
    ['put', 'usedNonce:session-a:nonce-1', '1', { expirationTtl: 321 }],
    ['delete', 'nonce:session-a:0xabc'],
  ]);
});

test('consumeNonce records durable replay verdicts without mutating KV mirrors', async () => {
  const events = [];
  const env = { GROUP_KV: { put: async () => assert.fail(), delete: async () => assert.fail() } };
  const result = await consumeNonce(env, 'session-a', '0xabc', 'nonce-1', {
    consumeCoordinatedAuthNonce: async () => ({
      ok: false,
      status: 409,
      error: 'Nonce already used.',
    }),
    recordAbuseEvent: async (event) => events.push(event),
  });
  assert.deepEqual(result, { ok: false, error: 'Nonce already used.', status: 409 });
  assert.equal(events[0].type, 'nonce_replays');
});

test('checkNonceRateLimit uses the caller identity and durable fixed-window verdict', async () => {
  const calls = [];
  const result = await checkNonceRateLimit({
    env: {},
    slug: 'session-a',
    identity: 'anon:cid:client_abc12345',
    address: '0xVictimWallet',
    limit: 2,
    now: () => 123_456,
    windowMs: 60_000,
    ttlSeconds: 61,
    checkCoordinatedAuthRateLimit: async (value) => {
      calls.push(value);
      return { ok: true, allowed: false, status: 200 };
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'Too many nonce requests. Try again shortly.',
    retryAfterSeconds: 61,
  });
  assert.equal(calls[0].identity, 'anon:cid:client_abc12345');
  assert.equal(calls[0].route, 'authNonce');
  assert.equal(calls[0].windowMs, 60_000);
});

test('checkNonceRateLimit fails closed distinctly when durable coordination is unavailable', async () => {
  const result = await checkNonceRateLimit({
    env: {},
    slug: 'session-a',
    address: '0xabc',
    limit: 2,
    checkCoordinatedAuthRateLimit: async () => ({
      ok: false,
      status: 503,
      error: 'Authorization state coordination is unavailable.',
    }),
  });
  assert.deepEqual(result, {
    ok: false,
    status: 503,
    error: 'Authorization state coordination is unavailable.',
  });
});
