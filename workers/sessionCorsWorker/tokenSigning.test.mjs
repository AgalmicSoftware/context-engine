import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  base64UrlDecode,
  base64UrlEncode,
  signToken,
  timingSafeEqual,
  verifyToken,
} from './tokenSigning.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const createBase64Deps = (overrides = {}) => ({
  btoa: (binary) => Buffer.from(binary, 'binary').toString('base64'),
  atob: (base64) => Buffer.from(base64, 'base64').toString('binary'),
  crypto: webcrypto,
  ...overrides,
});

test('base64UrlEncode/base64UrlDecode preserve url-safe token bytes', () => {
  const deps = createBase64Deps();
  const bytes = Uint8Array.from([251, 255]);
  const encoded = base64UrlEncode(bytes, deps);

  assert.equal(encoded, '-_8');
  assert.deepEqual(Array.from(base64UrlDecode(encoded, deps)), [251, 255]);
});

test('timingSafeEqual preserves same-length string comparison semantics', () => {
  assert.equal(timingSafeEqual('match', 'match'), true);
  assert.equal(timingSafeEqual('match', 'mismatch'), false);
  assert.equal(timingSafeEqual('short', 'longer'), false);
});

test('signToken preserves JSON.stringify payload format and verifyToken round-trips the payload', async () => {
  const deps = createBase64Deps();
  const payload = {
    sub: '0xABC',
    slug: 'session-a',
    scopes: { ai: true, arweave: false },
    exp: 1_700_000_000,
  };

  const token = await signToken(payload, 'test-secret', deps);
  const [payloadPart, sigPart] = token.split('.');

  assert.equal(
    decoder.decode(base64UrlDecode(payloadPart, deps)),
    JSON.stringify(payload)
  );
  assert.equal(typeof sigPart, 'string');
  assert.ok(sigPart.length > 0);

  const verification = await verifyToken(token, 'test-secret', {
    ...deps,
    now: () => (payload.exp - 1) * 1000,
  });
  assert.deepEqual(verification, { ok: true, payload });
});

test('verifyToken preserves invalid token format failures', async () => {
  const result = await verifyToken('not-a-jwt', 'test-secret', createBase64Deps());

  assert.deepEqual(result, { ok: false, error: 'Invalid token format.' });
});

test('verifyToken preserves invalid token payload failures', async () => {
  const result = await verifyToken('payload.sig', 'test-secret', createBase64Deps({
    atob: () => {
      throw new Error('bad base64');
    },
  }));

  assert.deepEqual(result, { ok: false, error: 'Invalid token payload.' });
});

test('verifyToken preserves invalid token payload json failures', async () => {
  const deps = createBase64Deps();
  const payloadPart = base64UrlEncode(encoder.encode('not-json'), deps);

  const result = await verifyToken(`${payloadPart}.ignored`, 'test-secret', deps);

  assert.deepEqual(result, { ok: false, error: 'Invalid token payload JSON.' });
});

test('verifyToken preserves invalid token signature failures', async () => {
  const deps = createBase64Deps();
  const token = await signToken({ sub: '0xabc', exp: 1_700_000_000 }, 'test-secret', deps);

  const result = await verifyToken(token, 'other-secret', {
    ...deps,
    now: () => 1_699_999_000 * 1000,
  });

  assert.deepEqual(result, { ok: false, error: 'Invalid token signature.' });
});

test('verifyToken preserves missing exp failures', async () => {
  const deps = createBase64Deps();
  const token = await signToken({ sub: '0xabc' }, 'test-secret', deps);

  const result = await verifyToken(token, 'test-secret', deps);

  assert.deepEqual(result, { ok: false, error: 'Token missing exp.' });
});

test('verifyToken preserves token expired failures using epoch seconds', async () => {
  const deps = createBase64Deps();
  const token = await signToken({ sub: '0xabc', exp: 1_700_000_000 }, 'test-secret', deps);

  const result = await verifyToken(token, 'test-secret', {
    ...deps,
    now: () => 1_700_000_000 * 1000,
  });

  assert.deepEqual(result, { ok: false, error: 'Token expired.' });
});

test('verifyToken rejects invalid token payload field types after expiration validation', async () => {
  const deps = createBase64Deps();
  const now = () => 1_699_999_000 * 1000;

  const badScopesToken = await signToken({ sub: '0xabc', scopes: 'admin', exp: 1_700_000_000 }, 'test-secret', deps);
  const badSubToken = await signToken({ sub: 123, exp: 1_700_000_000 }, 'test-secret', deps);
  const badSlugToken = await signToken({ sub: '0xabc', slug: ['a'], exp: 1_700_000_000 }, 'test-secret', deps);
  const badJtiToken = await signToken({ sub: '0xabc', jti: 123, exp: 1_700_000_000 }, 'test-secret', deps);

  assert.deepEqual(
    await verifyToken(badScopesToken, 'test-secret', { ...deps, now }),
    { ok: false, error: 'Token scopes must be an object.' },
  );
  assert.deepEqual(
    await verifyToken(badSubToken, 'test-secret', { ...deps, now }),
    { ok: false, error: 'Token sub must be a string.' },
  );
  assert.deepEqual(
    await verifyToken(badSlugToken, 'test-secret', { ...deps, now }),
    { ok: false, error: 'Token slug must be a string.' },
  );
  assert.deepEqual(
    await verifyToken(badJtiToken, 'test-secret', { ...deps, now }),
    { ok: false, error: 'Token jti must be a string.' },
  );
});

test('verifyToken accepts valid token payload field types', async () => {
  const deps = createBase64Deps();
  const payload = {
    sub: '0xabc',
    scopes: { admin: true },
    slug: 'session-a',
    jti: 'jti-1',
    exp: 1_700_000_000,
  };
  const token = await signToken(payload, 'test-secret', deps);

  assert.deepEqual(
    await verifyToken(token, 'test-secret', {
      ...deps,
      now: () => 1_699_999_000 * 1000,
    }),
    { ok: true, payload },
  );
});

test('verifyToken preserves token-signing error passthrough when HMAC signing fails', async () => {
  const deps = createBase64Deps();
  const token = await signToken({ sub: '0xabc', exp: 1_700_000_000 }, 'test-secret', deps);

  const result = await verifyToken(token, '', {
    ...deps,
    now: () => 1_699_999_000 * 1000,
  });

  assert.deepEqual(result, { ok: false, error: 'TOKEN_HMAC_SECRET is missing.' });
});

test('signToken preserves cached hmac-key reuse for repeated secrets', async () => {
  const cache = new Map();
  const calls = [];
  const deps = createBase64Deps({
    hmacKeyCache: cache,
    crypto: {
      subtle: {
        importKey: async (...args) => {
          calls.push(['importKey', ...args]);
          return { imported: true };
        },
        sign: async (algorithm, key, payloadBytes) => {
          calls.push(['sign', algorithm, key, Array.from(new Uint8Array(payloadBytes))]);
          return Uint8Array.from([payloadBytes.byteLength % 256, 42]).buffer;
        },
      },
    },
  });

  await signToken({ sub: '0xabc', exp: 10 }, 'shared-secret', deps);
  await signToken({ sub: '0xdef', exp: 20 }, 'shared-secret', deps);

  assert.equal(calls.filter(([name]) => name === 'importKey').length, 1);
  assert.equal(calls.filter(([name]) => name === 'sign').length, 2);
  assert.equal(cache.has('shared-secret'), true);
});
