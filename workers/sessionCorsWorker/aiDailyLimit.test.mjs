import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAiDailyLimit } from './aiRateLimitPolicy.js';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';

const json = (body, status, headers) => ({ body, status, headers });
const both = { limits: { perWalletPerDay: 400, aiPerWalletPerDay: 15 } };

test('AI calls use their own daily limit when one is set, else the general one', () => {
  assert.equal(resolveAiDailyLimit(both), 15);
  assert.equal(resolveAiDailyLimit({ limits: { perWalletPerDay: 400 } }), 400);
  assert.equal(resolveAiDailyLimit({ limits: { perWalletPerDay: 400, aiPerWalletPerDay: 0 } }), 400);
  assert.equal(resolveAiDailyLimit({ limits: { aiPerWalletPerDay: null } }), 0);
  assert.equal(resolveAiDailyLimit({}), 0);
});

test('the /ai route counts against the AI limit, not the general one', async () => {
  const seen = [];
  await dispatchAuthenticatedSecretActionRoute({
    path: '/ai', action: 'ai', config: both, body: {}, slug: 'session-a', address: '0xabc',
    env: {}, limit: 400, headers: {}, scopes: { ai: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async ({ route, limit }) => {
        seen.push({ route, limit });
        return { ok: false, response: 'refused' };
      },
      json,
    },
  });
  assert.deepEqual(seen, [{ route: 'ai', limit: 15 }]);
});

test('a set or saved AI limit must be a whole number, or empty', () => {
  const existingConfig = { adminAddress: '0xabc', limits: { perWalletPerDay: 400 } };
  const save = (incomingLimits) => applySessionConfigMutation({
    existingConfig, slug: 'session-a', mutation: { kind: 'set-limits', incomingLimits },
  });
  for (const bad of [-1, 1.5, '15', 100_001]) {
    const result = save({ aiPerWalletPerDay: bad });
    assert.equal(result.ok, false, String(bad));
    assert.match(result.error, /aiPerWalletPerDay/);
  }
  for (const good of [15, 0, null]) assert.equal(save({ aiPerWalletPerDay: good }).ok, true, String(good));
  assert.equal(save({ aiPerWalletPerDay: 15 }).config.limits.perWalletPerDay, 400);
});
