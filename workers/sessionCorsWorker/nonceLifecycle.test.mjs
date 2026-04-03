import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNonce,
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

test('consumeNonce preserves mismatch and already-used failures before mutating KV', async () => {
  const calls = [];
  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        if (key === 'nonce:session-a:0xabc') return 'different-nonce';
        return null;
      },
      put: async (...args) => calls.push(['put', ...args]),
      delete: async (...args) => calls.push(['delete', ...args]),
    },
  };

  assert.deepEqual(
    await consumeNonce(env, 'session-a', '0xabc', 'nonce-1'),
    { ok: false, error: 'Nonce mismatch or expired.' }
  );
  assert.deepEqual(calls, [['get', 'nonce:session-a:0xabc']]);

  calls.length = 0;
  env.GROUP_KV.get = async (key) => {
    calls.push(['get', key]);
    if (key === 'nonce:session-a:0xabc') return 'nonce-1';
    if (key === 'usedNonce:session-a:nonce-1') return '1';
    return null;
  };

  assert.deepEqual(
    await consumeNonce(env, 'session-a', '0xabc', 'nonce-1'),
    { ok: false, error: 'Nonce already used.' }
  );
  assert.deepEqual(calls, [
    ['get', 'nonce:session-a:0xabc'],
    ['get', 'usedNonce:session-a:nonce-1'],
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
    await consumeNonce(env, 'session-a', '0xabc', 'nonce-1', { usedNonceTtlSeconds: 321 }),
    { ok: true }
  );
  assert.deepEqual(calls, [
    ['get', 'nonce:session-a:0xabc'],
    ['get', 'usedNonce:session-a:nonce-1'],
    ['put', 'usedNonce:session-a:nonce-1', '1', { expirationTtl: 321 }],
    ['delete', 'nonce:session-a:0xabc'],
  ]);
});

test('consumeNonce serializes concurrent reads for the same slug/address/nonce within an isolate', async () => {
  const store = new Map([
    ['nonce:session-a:0xabc', 'nonce-1'],
  ]);
  const calls = [];
  let releaseUsedNonceRead = () => {};
  const usedNonceReadBarrier = new Promise((resolve) => {
    releaseUsedNonceRead = resolve;
  });
  let blockFirstUsedNonceRead = true;

  const env = {
    GROUP_KV: {
      get: async (key) => {
        calls.push(['get', key]);
        if (key === 'usedNonce:session-a:nonce-1') {
          if (blockFirstUsedNonceRead) {
            blockFirstUsedNonceRead = false;
            await usedNonceReadBarrier;
          }
        }
        return store.has(key) ? store.get(key) : null;
      },
      put: async (key, value) => {
        calls.push(['put', key, value]);
        store.set(key, value);
      },
      delete: async (key) => {
        calls.push(['delete', key]);
        store.delete(key);
      },
    },
  };

  const firstPromise = consumeNonce(env, 'session-a', '0xabc', 'nonce-1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  const secondPromise = consumeNonce(env, 'session-a', '0xabc', 'nonce-1');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, [
    ['get', 'nonce:session-a:0xabc'],
    ['get', 'usedNonce:session-a:nonce-1'],
  ]);

  releaseUsedNonceRead();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: false, error: 'Nonce mismatch or expired.' });
});
