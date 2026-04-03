import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseArweaveJwkInput,
  resolveArweaveUploadJwk,
} from './arweaveJwkNormalization.js';

test('parseArweaveJwkInput accepts object, trimmed JSON, and newline-padded JSON strings', () => {
  const jwkObject = { kty: 'RSA', n: 'abc', e: 'AQAB' };
  assert.deepEqual(parseArweaveJwkInput(jwkObject), jwkObject);

  assert.deepEqual(
    parseArweaveJwkInput(' {"kty":"RSA","n":"abc","e":"AQAB"} '),
    jwkObject
  );

  assert.deepEqual(
    parseArweaveJwkInput('{\n"kty":"RSA",\n"n":"abc",\n"e":"AQAB"\n}'),
    jwkObject
  );
});

test('resolveArweaveUploadJwk falls back to worker secrets when no request override is present', () => {
  const resolved = resolveArweaveUploadJwk({
    providedJwk: null,
    secrets: {
      arweaveJwk: '{"kty":"RSA","n":"abc","e":"AQAB"}',
    },
  });

  assert.deepEqual(resolved, {
    ok: true,
    error: '',
    jwk: { kty: 'RSA', n: 'abc', e: 'AQAB' },
    source: 'worker',
    hasProvidedJwk: false,
    hasWorkerJwk: true,
  });
});

test('resolveArweaveUploadJwk fails closed when a malformed request override is present even if worker secrets are valid', () => {
  const resolved = resolveArweaveUploadJwk({
    providedJwk: '{bad-json',
    secrets: {
      arweaveJwk: '{"kty":"RSA","n":"abc","e":"AQAB"}',
    },
  });

  assert.deepEqual(resolved, {
    ok: false,
    error: 'Invalid arweaveJwk (must be JSON)',
    jwk: null,
    source: 'request',
    hasProvidedJwk: true,
    hasWorkerJwk: true,
  });
});

test('resolveArweaveUploadJwk preserves missing-key failures when neither request nor worker supplies a usable key', () => {
  const resolved = resolveArweaveUploadJwk({
    providedJwk: null,
    secrets: {},
  });

  assert.deepEqual(resolved, {
    ok: false,
    error: 'Arweave key not configured in worker.',
    jwk: null,
    source: '',
    hasProvidedJwk: false,
    hasWorkerJwk: false,
  });
});
