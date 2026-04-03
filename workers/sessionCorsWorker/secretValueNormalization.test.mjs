import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSecretValue } from './secretValueNormalization.js';

test('normalizeSecretValue trims string inputs and stringifies scalar inputs', () => {
  assert.equal(normalizeSecretValue('  sk-openai  '), 'sk-openai');
  assert.equal(normalizeSecretValue(12345), '12345');
  assert.equal(normalizeSecretValue(false), 'false');
  assert.equal(normalizeSecretValue(null), '');
  assert.equal(normalizeSecretValue(undefined), '');
});

test('normalizeSecretValue stringifies objects and fails closed for circular values', () => {
  assert.equal(
    normalizeSecretValue({ kty: 'RSA', n: 'abc' }),
    '{"kty":"RSA","n":"abc"}'
  );

  const circular = {};
  circular.self = circular;
  assert.equal(normalizeSecretValue(circular), '');
});
