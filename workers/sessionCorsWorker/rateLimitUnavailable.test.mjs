import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { dispatchAnonymousRouteEntry } from './anonymousRouteEntry.js';
import { createRateLimitFaucetSupportWithWorkerDeps } from './rateLimitFaucetSupportBinding.js';
import { checkCoordinatedAuthRateLimit, coordinateResponseUploadReceipt } from './sessionWriteCoordinator.js';
import { SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';

const json = (body, status, headers) => ({ body, status, headers });

test('an unreachable limit is refused as busy, not as over the limit or abuse', async () => {
  const events = [];
  const { checkRateLimit } = createRateLimitFaucetSupportWithWorkerDeps({
    deps: {
      toStr: (value) => String(value ?? ''),
      recordAbuseEvent: async (event) => { events.push(event); },
      checkCoordinatedAuthRateLimit: async () => ({ ok: false, status: 503, error: 'Authorization state coordination is unavailable.' }),
    },
  });
  const allowed = await checkRateLimit({ env: {}, slug: 's', address: '0xabc', limit: 5, route: 'ai' });
  assert.equal(allowed, null);
  assert.deepEqual(events, []);

  const signedIn = await evaluateAuthenticatedRoutePreflight({
    scopes: { ai: true }, scope: 'ai', route: 'ai', limit: 5, headers: {},
    deps: { checkRateLimit, computeScopesForLogin: async () => ({ ai: true }), json },
  });
  assert.equal(signedIn.ok, false);
  assert.deepEqual(signedIn.response.body, { error: SESSION_COORDINATOR_UNAVAILABLE, reason: 'rate_limit_unavailable' });
  assert.equal(signedIn.response.status, 503);

  const anonymous = await dispatchAnonymousRouteEntry({
    path: '/ai', anonymousRoute: 'ai', request: new Request('https://w.example/ai', { method: 'POST' }), env: {},
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 's', explicitSlugProvided: true }),
      readCurrentSessionConfig: async () => ({ ok: true, config: { limits: { perAnonymousIpPerDay: 5 } } }),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      resolveAnonymousRateIdentity: () => '203.0.113.9',
      checkRateLimit, json,
    },
  });
  assert.equal(anonymous.status, 503);
  assert.equal(anonymous.body.error, SESSION_COORDINATOR_UNAVAILABLE);
});

test('a refused count is still 429', async () => {
  const preflight = await evaluateAuthenticatedRoutePreflight({
    scopes: { ai: true }, scope: 'ai', route: 'ai', limit: 5, headers: {},
    deps: { checkRateLimit: async () => false, computeScopesForLogin: async () => ({ ai: true }), json },
  });
  assert.equal(preflight.response.status, 429);
});

test('an unreachable limit or receipt object leaves one log line', async (t) => {
  const lines = [];
  t.mock.method(console, 'warn', (...args) => lines.push(args.join(' ')));
  const env = {
    CE_SESSION_COORDINATOR: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { throw new Error('Durable Object is overloaded.'); } }),
    },
  };
  const limit = await checkCoordinatedAuthRateLimit({ env, slug: 's', route: 'ai', identity: '0xabc', limit: 5, windowMs: 1000 });
  assert.equal(limit.ok, false);
  assert.equal(limit.status, 503);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const receipt = await coordinateResponseUploadReceipt({ env, slug: 's', responder: '0xabc', operation: 'reserve', payload: {} });
  assert.equal(receipt.reason, 'upload_receipt_unavailable');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /unavailable.*auth-state\/rate\/check.*overloaded/);
  assert.match(lines[1], /unavailable.*upload-receipts\/reserve.*overloaded/);
  assert.doesNotMatch(lines.join('\n'), /0xabc/);
});
