import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuthTokenJti,
  buildAuthTokenKey,
  persistAuthTokenRecord,
  revokeAuthTokenRecord,
  validateAuthTokenRecord,
} from './authTokenClaims.js';

test('buildAuthTokenKey normalizes the session, subject, and token id into the KV key', () => {
  assert.equal(
    buildAuthTokenKey({
      slug: ' session-a ',
      sub: ' 0xAbC ',
      jti: ' token-id-1 ',
    }),
    'authToken:session-a:0xabc:token-id-1',
  );
});

test('buildAuthTokenJti prefers an injected random uuid source', () => {
  assert.equal(
    buildAuthTokenJti({
      randomUUID: () => 'uuid-1',
      getRandomValues: () => {
        assert.fail('getRandomValues should not run when randomUUID is available');
      },
    }),
    'uuid-1',
  );
});

test('buildAuthTokenJti falls back to encoded random bytes', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: undefined,
  });

  try {
    const jti = buildAuthTokenJti({
      getRandomValues: (bytes) => {
        assert.equal(bytes.length, 16);
        bytes.set([1, 2, 3, 4]);
        return bytes;
      },
      base64UrlEncode: (bytes) => {
        assert.deepEqual(Array.from(bytes), [1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        return 'encoded-random';
      },
    });

    assert.equal(jti, 'encoded-random');
  } finally {
    Object.defineProperty(globalThis, 'crypto', originalCrypto);
  }
});

test('persistAuthTokenRecord stores a per-token KV marker with token-aligned ttl', async () => {
  const calls = [];
  const env = {
    GROUP_KV: {
      put: async (...args) => calls.push(args),
    },
  };

  await persistAuthTokenRecord({
    env,
    slug: 'session-a',
    sub: '0xAbC',
    jti: 'jti-1',
    ttlSeconds: 14_400,
  });

  assert.deepEqual(calls, [[
    'authToken:session-a:0xabc:jti-1',
    '1',
    { expirationTtl: 14_400 },
  ]]);
});

test('validateAuthTokenRecord rejects missing or blank jti values without KV lookup', async () => {
  let getCalled = false;
  const env = {
    GROUP_KV: {
      get: async () => {
        getCalled = true;
        return null;
      },
    },
  };

  for (const payload of [
    { sub: '0xabc', slug: 'session-a' },
    { sub: '0xabc', slug: 'session-a', jti: '' },
    { sub: '0xabc', slug: 'session-a', jti: '   ' },
  ]) {
    assert.deepEqual(
      await validateAuthTokenRecord({ env, payload, slug: 'session-a' }),
      { ok: false, error: 'Invalid token.' },
    );
  }
  assert.equal(getCalled, false);
});

test('validateAuthTokenRecord requires jti tokens to have a live KV marker', async () => {
  const store = new Map([
    ['authToken:session-a:0xabc:jti-1', '1'],
  ]);
  const env = {
    GROUP_KV: {
      get: async (key) => store.get(key) || null,
      delete: async (key) => store.delete(key),
    },
  };
  const payload = {
    sub: '0xAbC',
    slug: 'session-a',
    jti: 'jti-1',
  };

  assert.deepEqual(
    await validateAuthTokenRecord({ env, payload, slug: 'session-a' }),
    { ok: true, legacy: false },
  );

  await revokeAuthTokenRecord({ env, slug: 'session-a', sub: '0xabc', jti: 'jti-1' });

  assert.deepEqual(
    await validateAuthTokenRecord({ env, payload, slug: 'session-a' }),
    { ok: false, error: 'Invalid token.' },
  );
});
