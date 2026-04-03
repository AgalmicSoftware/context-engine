import test from 'node:test';
import assert from 'node:assert/strict';

import { toChainId } from './chainIdNormalization.js';

test('toChainId preserves Number-based decimal and hex coercion for valid chain ids', () => {
  assert.equal(toChainId(84532), 84532);
  assert.equal(toChainId('84532'), 84532);
  assert.equal(toChainId('0x2105'), 8453);
  assert.equal(toChainId('1.5'), 1.5);
});

test('toChainId returns 0 for invalid or non-finite values', () => {
  assert.equal(toChainId('not-a-chain'), 0);
  assert.equal(toChainId(Number.NaN), 0);
  assert.equal(toChainId(Number.POSITIVE_INFINITY), 0);
  assert.equal(toChainId(undefined), 0);
});
