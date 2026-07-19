import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRegistryChainId, toChainId } from './chainIdNormalization.js';

test('toChainId accepts only positive safe-integer decimal and hex chain ids', () => {
  assert.equal(toChainId(84532), 84532);
  assert.equal(toChainId('84532'), 84532);
  assert.equal(toChainId('0x2105'), 8453);
  assert.equal(toChainId(84532n), 84532);
});

test('toChainId rejects malformed, fractional, signed, and precision-losing values', () => {
  assert.equal(toChainId('not-a-chain'), 0);
  assert.equal(toChainId('0x7a69junk'), 0);
  assert.equal(toChainId('31337.0'), 0);
  assert.equal(toChainId('3.1337e4'), 0);
  assert.equal(toChainId('-31337'), 0);
  assert.equal(toChainId(31337.5), 0);
  assert.equal(toChainId('0x20000000000000'), 0);
  assert.equal(toChainId('0x20000000000001'), 0);
  assert.equal(toChainId(Number.NaN), 0);
  assert.equal(toChainId(Number.POSITIVE_INFINITY), 0);
  assert.equal(toChainId(undefined), 0);
  assert.equal(toChainId({ _isBigNumber: true, _hex: '0x14a34' }), 0);
});

test('resolveRegistryChainId preserves the legacy networkChainId fallback without bypassing invalid explicit values', () => {
  assert.equal(resolveRegistryChainId({ registryChainId: 84532, networkChainId: 11155420 }), 84532);
  assert.equal(resolveRegistryChainId({ networkChainId: 11155420 }), 11155420);
  assert.equal(resolveRegistryChainId({ registryChainId: 0, networkChainId: 84532 }), 84532);
  assert.equal(resolveRegistryChainId({ registryChainId: '0x0', networkChainId: '84532' }), 84532);
  assert.equal(resolveRegistryChainId({}, 11155420), 11155420);
  assert.equal(resolveRegistryChainId({ registryChainId: 0, networkChainId: 0 }, '0x14a34'), 84532);
  assert.equal(resolveRegistryChainId({ registryChainId: '1.5', networkChainId: 84532 }), 0);
  assert.equal(resolveRegistryChainId({ registryChainId: false, networkChainId: 84532 }), 0);
  assert.equal(resolveRegistryChainId({ registryChainId: Number.NaN, networkChainId: 84532 }), 0);
  assert.equal(resolveRegistryChainId({ networkChainId: false }, 84532), 0);
  assert.equal(resolveRegistryChainId({ networkChainId: '3.1337e4' }, 31337), 0);
  assert.equal(resolveRegistryChainId({}), 0);
});
