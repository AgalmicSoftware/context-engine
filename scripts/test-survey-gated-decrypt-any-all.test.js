'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveGatedDecryptTimeoutMs } = require('./test-survey-gated-decrypt-any-all.js');

test('resolveGatedDecryptTimeoutMs stays above the child gated decrypt UI budget by default', () => {
  const timeoutMs = resolveGatedDecryptTimeoutMs({});
  assert.equal(timeoutMs, 48 * 60 * 1000);
});

test('resolveGatedDecryptTimeoutMs inherits a larger child UI timeout when no parent override is set', () => {
  const timeoutMs = resolveGatedDecryptTimeoutMs({
    GATED_DECRYPT_UI_TIMEOUT_MS: String(55 * 60 * 1000),
  });
  assert.equal(timeoutMs, 63 * 60 * 1000);
});

test('resolveGatedDecryptTimeoutMs preserves explicit parent overrides', () => {
  const timeoutMs = resolveGatedDecryptTimeoutMs({
    SURVEY_GATED_DECRYPT_TIMEOUT_MS: String(75 * 60 * 1000),
    GATED_DECRYPT_UI_TIMEOUT_MS: String(55 * 60 * 1000),
  });
  assert.equal(timeoutMs, 75 * 60 * 1000);
});
