import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAnonymousIpDailyLimit } from './anonymousRateLimitPolicy.js';

test('resolveAnonymousIpDailyLimit uses explicit anonymous IP budget when valid', () => {
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 25, perAnonymousIpPerDay: 4 } }), 4);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 25, perAnonymousIpPerDay: 0 } }), 0);
});

test('resolveAnonymousIpDailyLimit leaves anonymous routes unlimited when absent or malformed', () => {
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9 } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9, perAnonymousIpPerDay: '5' } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9, perAnonymousIpPerDay: -1 } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9, perAnonymousIpPerDay: 1.5 } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9, perAnonymousIpPerDay: null } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9, perAnonymousIpPerDay: true } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9, perAnonymousIpPerDay: '' } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: { perWalletPerDay: 9, perAnonymousIpPerDay: {} } }), 0);
  assert.equal(resolveAnonymousIpDailyLimit({ limits: 'bad-limits' }), 0);
});
