import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAiDailyLimit } from './aiRateLimitPolicy.js';
import { applySessionConfigMutation } from './sessionConfigMutation.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { dispatchAuthenticatedSecretPathRoute } from './authenticatedSecretPathRouteDispatch.js';
import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { AI_MODEL_NOT_ALLOWED } from './aiRequestPolicy.js';

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

test('storage and transcription keep the general limit when an AI limit is set', async () => {
  for (const path of ['/transcribe', '/storage/upload', '/storage/read-batch']) {
    const seen = [];
    await dispatchAuthenticatedSecretPathRoute({
      path, method: 'POST', request: new Request('https://worker.example'), config: both, slug: 'session-a', address: '0xabc',
      env: {}, limit: 400, headers: {}, scopes: { storage: true, transcribe: true },
      deps: {
        evaluateAuthenticatedRoutePreflight: async ({ route, limit }) => {
          seen.push({ route, limit });
          return { ok: false, response: 'refused' };
        },
        json,
      },
    });
    assert.equal(seen[0]?.limit, 400, path);
  }
});

test('an /ai call refused before any AI runs costs nothing from the day', async () => {
  const counted = [];
  const call = (model) => dispatchAuthenticatedSecretActionRoute({
    path: '/ai', action: 'ai', config: { ...both, aiProvider: 'openai' }, body: { model, messages: [] }, slug: 'session-a', address: '0xabc',
    env: {}, headers: {}, scopes: { ai: true },
    deps: {
      evaluateAuthenticatedRoutePreflight,
      computeScopesForLogin: async () => ({ ai: true }),
      checkRateLimit: async (args) => { counted.push(args.route); return true; },
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets: {} }),
      normalizeAiRequestPayload: ({ payload }) => ({ payload, provider: 'openai' }),
      proxyOpenAI: async () => 'answered',
      json,
    },
  });
  const refused = await call('not-a-model');
  assert.deepEqual([refused.response.status, refused.response.body, counted], [403, AI_MODEL_NOT_ALLOWED, []]);
  const answered = await call('gpt-5.4-mini');
  assert.deepEqual([answered.response, counted], ['answered', ['ai']]);
  // Over the day's limit, nothing reaches the provider.
  const over = await dispatchAuthenticatedSecretActionRoute({
    path: '/ai', action: 'ai', config: { ...both, aiProvider: 'openai' }, body: { model: 'gpt-5.4-mini', messages: [] }, slug: 'session-a', address: '0xabc',
    env: {}, headers: {}, scopes: { ai: true },
    deps: {
      evaluateAuthenticatedRoutePreflight,
      computeScopesForLogin: async () => ({ ai: true }),
      checkRateLimit: async () => false,
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets: {} }),
      normalizeAiRequestPayload: ({ payload }) => ({ payload, provider: 'openai' }),
      proxyOpenAI: async () => assert.fail('the provider was called over the limit'),
      json,
    },
  });
  assert.equal(over.response.status, 429);
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
