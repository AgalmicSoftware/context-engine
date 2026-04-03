import test from 'node:test';
import assert from 'node:assert/strict';

import { trimIfString, toStr, toTrimmedString } from './stringCoercion.js';

test('toStr preserves strings and converts nullish values to an empty string', () => {
  assert.equal(toStr('hello'), 'hello');
  assert.equal(toStr(''), '');
  assert.equal(toStr(null), '');
  assert.equal(toStr(undefined), '');
});

test('toStr stringifies non-string values with String(...) semantics', () => {
  assert.equal(toStr(84532), '84532');
  assert.equal(toStr(false), 'false');
  assert.equal(toStr({ value: 1 }), '[object Object]');
});

test('trimIfString only trims string inputs and preserves non-string values', () => {
  const rawObject = { value: 1 };

  assert.equal(trimIfString('  hello  '), 'hello');
  assert.equal(trimIfString('   '), '');
  assert.equal(trimIfString(84532), 84532);
  assert.equal(trimIfString(rawObject), rawObject);
});

test('toTrimmedString trims the shared fallback coercion result', () => {
  assert.equal(toTrimmedString('  hello  '), 'hello');
  assert.equal(toTrimmedString(null), '');
  assert.equal(toTrimmedString(84532), '84532');
});

test('toTrimmedString preserves one-argument request helper trim semantics', () => {
  assert.equal(toTrimmedString('   '), '');
  assert.equal(toTrimmedString({ toString: () => '  fetch_url  ' }), 'fetch_url');
});

test('toTrimmedString prefers deps.toStr before trimming', () => {
  const input = { value: 1 };
  const calls = [];

  assert.equal(
    toTrimmedString(input, {
      toStr: (value) => {
        calls.push(value);
        return '  normalized  ';
      },
    }),
    'normalized'
  );
  assert.deepEqual(calls, [input]);
});
