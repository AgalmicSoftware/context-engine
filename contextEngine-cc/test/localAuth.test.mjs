import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBearer, requireLocalJwtAuth } from '../lib/localAuth.mjs';

test('extractBearer parses bearer tokens case-insensitively', () => {
  assert.equal(extractBearer({ headers: { authorization: 'Bearer token-1' } }), 'token-1');
  assert.equal(extractBearer({ headers: { authorization: 'bearer token-2' } }), 'token-2');
  assert.equal(extractBearer({ headers: { authorization: 'Basic token-3' } }), null);
});

test('requireLocalJwtAuth rejects missing bearer auth', () => {
  assert.deepEqual(requireLocalJwtAuth({ headers: {} }), {
    ok: false,
    status: 401,
    error: 'Missing Authorization header.',
  });
});

test('requireLocalJwtAuth delegates JWT verification and preserves payload/errors', () => {
  const verify = (token) => (
    token === 'good'
      ? { ok: true, payload: { sub: '0xabc' } }
      : { ok: false, error: 'invalid token' }
  );

  assert.deepEqual(requireLocalJwtAuth({
    headers: { authorization: 'Bearer good' },
  }, { verify }), {
    ok: true,
    payload: { sub: '0xabc' },
  });

  assert.deepEqual(requireLocalJwtAuth({
    headers: { authorization: 'Bearer bad' },
  }, { verify }), {
    ok: false,
    status: 401,
    error: 'invalid token',
  });
});
