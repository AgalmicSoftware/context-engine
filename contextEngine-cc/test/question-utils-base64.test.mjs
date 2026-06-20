import assert from 'node:assert/strict';
import test from 'node:test';

import {
  base64urlToHex,
  hexToBase64url,
} from '../lib/shared/questionUtils.mjs';

test('shared base64url conversions do not require a global Buffer runtime', () => {
  const originalBuffer = globalThis.Buffer;
  const originalAtob = globalThis.atob;
  const originalBtoa = globalThis.btoa;
  const nodeBuffer = originalBuffer;

  try {
    globalThis.atob = (value) => nodeBuffer.from(value, 'base64').toString('binary');
    globalThis.btoa = (value) => nodeBuffer.from(value, 'binary').toString('base64');
    globalThis.Buffer = undefined;

    assert.equal(hexToBase64url('0x1234abcd'), 'EjSrzQ');
    assert.equal(base64urlToHex('EjSrzQ'), '0x1234abcd');
  } finally {
    globalThis.Buffer = originalBuffer;
    globalThis.atob = originalAtob;
    globalThis.btoa = originalBtoa;
  }
});
