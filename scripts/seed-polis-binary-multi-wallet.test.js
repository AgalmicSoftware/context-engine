'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveSessionSlug } = require('./seed-polis-binary-multi-wallet.js');

test('resolveSessionSlug accepts an explicit session slug from args', () => {
  assert.equal(
    resolveSessionSlug({
      args: { 'session-slug': 'edge-session' },
      env: {},
    }),
    'edge-session',
  );
});

test('resolveSessionSlug accepts an explicit session slug from env', () => {
  assert.equal(
    resolveSessionSlug({
      args: {},
      env: { SESSION_SLUG: 'env-session' },
    }),
    'env-session',
  );
});

test('resolveSessionSlug no longer silently defaults to a legacy fixture slug', () => {
  assert.throws(
    () => resolveSessionSlug({
      args: {},
      env: {},
    }),
    /no longer defaults to a legacy fixture slug/i,
  );
});
