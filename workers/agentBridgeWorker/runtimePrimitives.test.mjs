import test from 'node:test';
import assert from 'node:assert/strict';
import {
  envFlagDisabled,
  envFlagEnabled,
  kvKeySafePart,
  lower,
  safeJsonParse,
  safeString,
  stableFingerprint,
  stableJson,
} from './runtimePrimitives.mjs';

test('runtime string primitives preserve legacy falsy coercion', () => {
  assert.equal(safeString('  Session One  '), 'Session One');
  assert.equal(safeString(0), '');
  assert.equal(safeString(false), '');
  assert.equal(safeString(null), '');
  assert.equal(lower('  YES  '), 'yes');
});

test('safeJsonParse returns parsed values or the supplied fallback', () => {
  const fallback = { fallback: true };
  assert.deepEqual(safeJsonParse(' {"ok":true} ', fallback), { ok: true });
  assert.equal(safeJsonParse('0', fallback), 0);
  assert.equal(safeJsonParse('', fallback), fallback);
  assert.equal(safeJsonParse('{broken', fallback), fallback);
});

test('stable JSON and fingerprints remain independent of object key order', () => {
  const first = { nested: { z: 3, a: [2, undefined] }, empty: undefined };
  const second = { empty: undefined, nested: { a: [2, undefined], z: 3 } };
  assert.equal(stableJson(first), '{"empty":null,"nested":{"a":[2,null],"z":3}}');
  assert.equal(stableJson(second), stableJson(first));
  assert.equal(stableFingerprint(first), '0000r4nkp5');
  assert.equal(stableFingerprint(second), stableFingerprint(first));
});

test('KV-safe parts retain the persisted sanitizer and fingerprint format', () => {
  assert.equal(kvKeySafePart(''), '');
  assert.equal(kvKeySafePart('Hello, World!'), 'Hello_World_0000npwtfm');
  assert.equal(kvKeySafePart('***'), 'ref_000052yihp');
  assert.match(kvKeySafePart('x'.repeat(80)), /^x{56}_[a-z0-9]{10}$/);
});

test('environment flag helpers accept only the established truthy and falsy tokens', () => {
  for (const value of ['1', ' TRUE ', 'yes', 'On']) assert.equal(envFlagEnabled(value), true);
  for (const value of ['0', ' FALSE ', 'no', 'Off']) assert.equal(envFlagDisabled(value), true);
  assert.equal(envFlagEnabled('enabled'), false);
  assert.equal(envFlagDisabled('disabled'), false);
});
