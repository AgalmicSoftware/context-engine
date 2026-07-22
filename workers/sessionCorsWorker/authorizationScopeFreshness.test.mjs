import test from 'node:test';
import assert from 'node:assert/strict';

import {
  incrementAuthorizationEpoch,
  normalizeAuthorizationEpoch,
  selectResourceGateKeysForScopes,
} from './authorizationScopeFreshness.js';

test('authorization epochs accept legacy absence but reject malformed or exhausted values', () => {
  assert.equal(normalizeAuthorizationEpoch(undefined), 0);
  assert.equal(normalizeAuthorizationEpoch(7), 7);
  assert.equal(normalizeAuthorizationEpoch('7'), null);
  assert.equal(normalizeAuthorizationEpoch(-1), null);
  assert.equal(incrementAuthorizationEpoch({ authzEpoch: 7 }), 8);
  assert.equal(incrementAuthorizationEpoch({ authzEpoch: Number.MAX_SAFE_INTEGER }), null);
});

test('current-scope checks select only default plus the requested resource gates', () => {
  const all = ['default', 'ai', 'arweave', 'rpc', 'txGas', 'lit'];
  assert.deepEqual(selectResourceGateKeysForScopes(all), all);
  assert.deepEqual(selectResourceGateKeysForScopes(all, ['transcribe']), ['default', 'ai']);
  assert.deepEqual(selectResourceGateKeysForScopes(all, ['fetch']), ['default', 'rpc']);
  assert.deepEqual(selectResourceGateKeysForScopes(all, ['faucet']), ['default', 'txGas']);
  assert.deepEqual(selectResourceGateKeysForScopes(all, ['groups']), ['default']);
});
