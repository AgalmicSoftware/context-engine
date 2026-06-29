'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const E2E_TESTIDS_PATH = path.join(ROOT, 'client', 'src', 'utilities', 'e2eTestIds.js');

test('e2eTestIds compatibility module stays plain JS for Node script consumers', () => {
  const source = fs.readFileSync(E2E_TESTIDS_PATH, 'utf8');
  assert.doesNotMatch(source, /from\s+['"]\.\/e2eTestIds\.ts['"]/);
});

test('e2eTestIds.js loads through CommonJS require for node scripts', () => {
  const { E2E_TESTIDS } = require(E2E_TESTIDS_PATH);
  assert.equal(typeof E2E_TESTIDS, 'object');
  assert.equal(E2E_TESTIDS.SURVEY_CREATE_TOGGLE, 'ce-survey-create-toggle');
  assert.equal(E2E_TESTIDS.SESSION_LOADING_SKELETON, 'ce-session-loading-skeleton');
});
