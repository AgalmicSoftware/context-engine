'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const E2E_TESTIDS_PATH = path.join(ROOT, 'client', 'src', 'utilities', 'e2eTestIds.js');
const E2E_TESTIDS_TYPESCRIPT_PATH = path.join(ROOT, 'client', 'src', 'utilities', 'e2eTestIds.ts');

function readTypescriptCanonicalMap() {
  const source = fs.readFileSync(E2E_TESTIDS_TYPESCRIPT_PATH, 'utf8');
  const expressionStart = source.indexOf('Object.freeze({');
  const expressionEnd = source.lastIndexOf(');');
  assert.notEqual(expressionStart, -1, 'TypeScript canonical map must remain an Object.freeze literal');
  assert.notEqual(expressionEnd, -1, 'TypeScript canonical map must have a closing expression');
  return vm.runInNewContext(source.slice(expressionStart, expressionEnd + 1));
}

test('e2eTestIds compatibility module stays plain JS for Node script consumers', () => {
  const source = fs.readFileSync(E2E_TESTIDS_PATH, 'utf8');
  assert.doesNotMatch(source, /from\s+['"]\.\/e2eTestIds\.ts['"]/);
});

test('e2eTestIds.js loads through CommonJS require for node scripts', () => {
  const { E2E_TESTIDS } = require(E2E_TESTIDS_PATH);
  assert.equal(typeof E2E_TESTIDS, 'object');
});

test('e2eTestIds CommonJS bridge matches every TypeScript key and value', () => {
  const { E2E_TESTIDS } = require(E2E_TESTIDS_PATH);
  const canonicalMap = readTypescriptCanonicalMap();

  assert.deepEqual({ ...E2E_TESTIDS }, { ...canonicalMap });
});
