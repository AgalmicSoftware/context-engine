import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MAX_KV_VALUE_BYTES,
  rejectKvValueOverLimit,
  resolveMaxKvValueBytes,
} from './uploadSizeLimits.js';

test('resolveMaxKvValueBytes accepts smaller test/runtime caps but never exceeds the safety ceiling', () => {
  assert.equal(resolveMaxKvValueBytes(), DEFAULT_MAX_KV_VALUE_BYTES);
  assert.equal(resolveMaxKvValueBytes({ maxKvValueBytes: 1024 }), 1024);
  assert.equal(
    resolveMaxKvValueBytes({ maxKvValueBytes: DEFAULT_MAX_KV_VALUE_BYTES + 1 }),
    DEFAULT_MAX_KV_VALUE_BYTES,
  );
});

test('rejectKvValueOverLimit measures encoded UTF-8 bytes rather than string length', () => {
  assert.equal(rejectKvValueOverLimit({ serializedValue: 'éé', maxKvValueBytes: 4 }), null);
  assert.deepEqual(
    rejectKvValueOverLimit({ serializedValue: 'éé', maxKvValueBytes: 3 }),
    {
      ok: false,
      status: 413,
      error: 'KV storage payload too large after encoding. Maximum allowed KV value is 3 bytes.',
      payload: null,
    },
  );
});
