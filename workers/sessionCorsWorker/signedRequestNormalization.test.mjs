import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSignedWorkerRequest,
  validateRecoveredAddressMatchesRequest,
  validateSiweAddressMatchesRequest,
} from './signedRequestNormalization.js';

test('normalizeSignedWorkerRequest trims address and requestId and normalizes SIWE line endings', () => {
  const normalized = normalizeSignedWorkerRequest({
    address: ' 0xabc ',
    message: 'line1\r\nline2',
    signature: ' 0xsig ',
    requestId: ' req-1 ',
  });

  assert.deepEqual(normalized, {
    address: '0xabc',
    message: 'line1\nline2',
    signature: ' 0xsig ',
    requestId: 'req-1',
  });
});

test('validateRecoveredAddressMatchesRequest fails closed on mismatch', () => {
  assert.deepEqual(
    validateRecoveredAddressMatchesRequest({
      recovered: '0x00000000000000000000000000000000000000aa',
      address: '0x00000000000000000000000000000000000000AA',
    }),
    { ok: true, error: '' }
  );

  assert.deepEqual(
    validateRecoveredAddressMatchesRequest({
      recovered: '0x00000000000000000000000000000000000000aa',
      address: '0x00000000000000000000000000000000000000bb',
    }),
    { ok: false, error: 'Signature does not match address.' }
  );
});

test('validateSiweAddressMatchesRequest fails closed on mismatch and ignores blank SIWE addresses', () => {
  assert.deepEqual(
    validateSiweAddressMatchesRequest({
      siwe: { address: '' },
      address: '0x00000000000000000000000000000000000000aa',
    }),
    { ok: true, error: '' }
  );

  assert.deepEqual(
    validateSiweAddressMatchesRequest({
      siwe: { address: '0x00000000000000000000000000000000000000AA' },
      address: '0x00000000000000000000000000000000000000aa',
    }),
    { ok: true, error: '' }
  );

  assert.deepEqual(
    validateSiweAddressMatchesRequest({
      siwe: { address: '0x00000000000000000000000000000000000000bb' },
      address: '0x00000000000000000000000000000000000000aa',
    }),
    { ok: false, error: 'SIWE address mismatch.' }
  );
});
