import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNonce,
  checkNonceRateLimit,
  consumeNonce,
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

test('consumeNonce rejects already-used nonces before writing a claim', async () => {
  const calls = [];
  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        if (key === 'usedNonce:session-a:nonce-1') return '1';
        return null;
      },
      put: async (...args) => calls.push(['put', ...args]),
      delete: async (...args) => calls.push(['delete', ...args]),
    },
  };

  assert.deepEqual(
    await consumeNonce(env, 'session-a', '0xabc', 'nonce-1'),
    { ok: false, error: 'Nonce already used.' }
  );
  assert.deepEqual(calls, [['get', 'usedNonce:session-a:nonce-1']]);
});

test('consumeNonce writes a claim before checking the active nonce and rolls claim back on mismatch', async () => {
  const store = new Map();
  const calls = [];
  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        if (store.has(key)) return store.get(key);
        if (key === 'nonce:session-a:0xabc') return 'different-nonce';
        return null;
      },
      put: async (key, value, opts) => {
        calls.push(['put', key, value, opts]);
        store.set(key, value);
      },
      delete: async (key) => {
        calls.push(['delete', key]);
        store.delete(key);
      },
    },
  };

  assert.deepEqual(
    await consumeNonce(env, 'session-a', '0xabc', 'nonce-1', {
      buildClaimId: () => 'claim-1',
      usedNonceTtlSeconds: 321,
    }),
    { ok: false, error: 'Nonce mismatch or expired.' }
  );
  assert.deepEqual(calls, [
    ['get', 'usedNonce:session-a:nonce-1'],
    ['put', 'usedNonce:session-a:nonce-1', 'claim-1', { expirationTtl: 321 }],
    ['get', 'nonce:session-a:0xabc'],
    ['get', 'usedNonce:session-a:nonce-1'],
    ['delete', 'usedNonce:session-a:nonce-1'],
  ]);
});

test('consumeNonce stores the used marker, deletes the active nonce, and returns ok on success', async () => {
  const calls = [];
  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        if (key === 'nonce:session-a:0xabc') return 'nonce-1';
        return null;
      },
      put: async (...args) => calls.push(['put', ...args]),
      delete: async (...args) => calls.push(['delete', ...args]),
    },
  };

  assert.deepEqual(
    await consumeNonce(env, 'session-a', '0xabc', 'nonce-1', {
      buildClaimId: () => 'claim-1',
      usedNonceTtlSeconds: 321,
    }),
    { ok: true }
  );
  assert.deepEqual(calls, [
    ['get', 'usedNonce:session-a:nonce-1'],
    ['put', 'usedNonce:session-a:nonce-1', 'claim-1', { expirationTtl: 321 }],
    ['get', 'nonce:session-a:0xabc'],
    ['get', 'usedNonce:session-a:nonce-1'],
    ['delete', 'nonce:session-a:0xabc'],
  ]);
});

test('consumeNonce serializes concurrent reads for the same slug/address/nonce within an isolate', async () => {
  const store = new Map([
    ['nonce:session-a:0xabc', 'nonce-1'],
  ]);
  const calls = [];
  let releaseClaimWrite = () => {};
  const claimWriteBarrier = new Promise((resolve) => {
    releaseClaimWrite = resolve;
  });
  let blockFirstClaimWrite = true;
  let claimCounter = 0;

  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        return store.has(key) ? store.get(key) : null;
      },
      put: async (key, value) => {
        calls.push(['put', key, value]);
        if (key === 'usedNonce:session-a:nonce-1' && blockFirstClaimWrite) {
          blockFirstClaimWrite = false;
          await claimWriteBarrier;
        }
        store.set(key, value);
      },
      delete: async (key) => {
        calls.push(['delete', key]);
        store.delete(key);
      },
    },
  };

  const buildClaimId = () => {
    claimCounter += 1;
    return `claim-${claimCounter}`;
  };
  const firstPromise = consumeNonce(env, 'session-a', '0xabc', 'nonce-1', { buildClaimId });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const secondPromise = consumeNonce(env, 'session-a', '0xabc', 'nonce-1', { buildClaimId });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, [
    ['get', 'usedNonce:session-a:nonce-1'],
    ['put', 'usedNonce:session-a:nonce-1', 'claim-1'],
  ]);

  releaseClaimWrite();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: false, error: 'Nonce already used.' });
});

test('checkNonceRateLimit enforces a per-address fixed window limit', async () => {
  const store = new Map();
  const calls = [];
  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        return store.get(key) || null;
      },
      put: async (key, value, opts) => {
        calls.push(['put', key, value, opts]);
        store.set(key, value);
      },
    },
  };

  const opts = {
    env,
    slug: 'session-a',
    address: '0xAbC',
    limit: 2,
    now: () => 123_456,
    windowMs: 60_000,
    ttlSeconds: 61,
  };

  assert.deepEqual(await checkNonceRateLimit(opts), { ok: true });
  assert.deepEqual(await checkNonceRateLimit(opts), { ok: true });
  assert.deepEqual(await checkNonceRateLimit(opts), {
    ok: false,
    error: 'Too many nonce requests. Try again shortly.',
    retryAfterSeconds: 61,
  });

  assert.deepEqual(calls, [
    ['get', 'rate:authNonce:session-a:0xabc:120000'],
    ['put', 'rate:authNonce:session-a:0xabc:120000', '1', { expirationTtl: 61 }],
    ['get', 'rate:authNonce:session-a:0xabc:120000'],
    ['put', 'rate:authNonce:session-a:0xabc:120000', '2', { expirationTtl: 61 }],
    ['get', 'rate:authNonce:session-a:0xabc:120000'],
    ['put', 'rate:authNonce:session-a:0xabc:120000', '3', { expirationTtl: 61 }],
  ]);
});

test('checkNonceRateLimit preserves burst behavior inside one fixed window', async () => {
  const store = new Map();
  const env = {
    GROUP_KV: {
      get: async (key) => store.get(key) || null,
      put: async (key, value) => {
        store.set(key, value);
      },
    },
  };
  const opts = {
    env,
    slug: 'session-a',
    identity: 'anon:cid:client_abc12345',
    address: '0xAbC',
    limit: 5,
    now: () => 123_456,
    windowMs: 60_000,
    ttlSeconds: 61,
  };

  const results = [];
  for (let index = 0; index < 6; index += 1) {
    results.push(await checkNonceRateLimit(opts));
  }

  assert.deepEqual(results, [
    { ok: true },
    { ok: true },
    { ok: true },
    { ok: true },
    { ok: true },
    {
      ok: false,
      error: 'Too many nonce requests. Try again shortly.',
      retryAfterSeconds: 61,
    },
  ]);
  assert.equal(store.get('rate:authNonce:session-a:anon:cid:client_abc12345:120000'), '6');
});

test('checkNonceRateLimit prefers caller identity over the claimed wallet address', async () => {
  const store = new Map();
  const calls = [];
  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        return store.get(key) || null;
      },
      put: async (key, value, opts) => {
        calls.push(['put', key, value, opts]);
        store.set(key, value);
      },
    },
  };

  await checkNonceRateLimit({
    env,
    slug: 'session-a',
    identity: 'anon:cid:client_abc12345',
    address: '0xVictimWallet',
    limit: 2,
    now: () => 123_456,
    windowMs: 60_000,
    ttlSeconds: 61,
  });

  assert.deepEqual(calls, [
    ['get', 'rate:authNonce:session-a:anon:cid:client_abc12345:120000'],
    ['put', 'rate:authNonce:session-a:anon:cid:client_abc12345:120000', '1', { expirationTtl: 61 }],
  ]);
});
