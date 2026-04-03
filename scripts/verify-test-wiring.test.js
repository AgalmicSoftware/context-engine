'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyTestWiring } = require('./verify-test-wiring');

test('repo test wiring invariants hold', () => {
  assert.deepEqual(verifyTestWiring(), []);
});
