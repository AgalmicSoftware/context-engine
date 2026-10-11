import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNonce,
  checkNonceRateLimit,
  consumeNonce,
  issueNonce,
} from './nonceLifecycle.js';

// EIP-4361 nonces are alphanumeric; wallet parsers reject "-" and "_".
test('buildNonce issues 32 hex characters from 16 random bytes', () => {
  const nonce = buildNonce({
    getRandomValues: (bytes) => {
      assert.equal(bytes.length, 16);
      bytes.set([1, 2, 254, 255]);
      return bytes;
    },
  });
  assert.equal(nonce, '0102feff000000000000000000000000');
  for (let index = 0; index < 50; index += 1) assert.match(buildNonce(), /^[0-9a-f]{32}$/);
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
  assert.equal(calls.length, 1);
});

test('consumeNonce trusts the durable verdict without redundant KV writes', async () => {
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
  assert.deepEqual(calls.slice(1), []);
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

test('checkNonceRateLimit enforces caller-wallet and shared-network buckets separately', async () => {
  const calls = [];
  const result = await checkNonceRateLimit({
    env: {},
    slug: 'session-a',
    identity: 'anon:cid:client_abc12345',
    address: '0xVictimWallet',
    limit: 2,
    sharedNetworkLimit: 300,
    now: () => 123_456,
    windowMs: 60_000,
    ttlSeconds: 61,
    checkCoordinatedAuthRateLimit: async (value) => {
      calls.push(value);
      return {
        ok: true,
        allowed: value.route === 'authNonceCallerWallet',
        status: 200,
      };
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'Too many nonce requests. Try again shortly.',
    retryAfterSeconds: 61,
  });
  assert.deepEqual(calls.map(({ route, identity }) => [route, identity]), [
    ['authNonceCallerWallet', 'anon:cid:client_abc12345|0xvictimwallet'],
    ['authNonceNetwork', 'anon:cid:client_abc12345'],
  ]);
  assert.equal(calls[0].windowMs, 60_000);
});

test('checkNonceRateLimit blocks a hot wallet before consuming shared-network headroom', async () => {
  const calls = [];
  const result = await checkNonceRateLimit({
    env: {},
    slug: 'session-a',
    identity: 'anon:198.51.100.7',
    address: '0xVictimWallet',
    limit: 5,
    sharedNetworkLimit: 300,
    checkCoordinatedAuthRateLimit: async (value) => {
      calls.push(value);
      return { ok: true, allowed: false, status: 200 };
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(calls.map(({ route }) => route), ['authNonceCallerWallet']);
});

test('checkNonceRateLimit keeps one caller from using up another caller budget for the same wallet', async () => {
  const counts = new Map();
  const checkCoordinatedAuthRateLimit = async ({ route, identity, limit }) => {
    const key = `${route}:${identity}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    return { ok: true, allowed: counts.get(key) <= limit, status: 200 };
  };
  const request = (identity) => checkNonceRateLimit({
    env: {},
    slug: 'session-a',
    identity,
    address: '0xVictimWallet',
    limit: 5,
    sharedNetworkLimit: 300,
    checkCoordinatedAuthRateLimit,
  });

  for (let index = 0; index < 6; index += 1) await request('anon:203.0.113.9');
  assert.equal((await request('anon:203.0.113.9')).ok, false);
  assert.deepEqual(await request('anon:198.51.100.7'), { ok: true });
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
