import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAnonymousRateIdentity } from './anonymousRateIdentityNormalization.js';
import { dispatchAnonymousRouteEntry } from './anonymousRouteEntry.js';
import { createRateLimitFaucetSupportWithWorkerDeps } from './rateLimitFaucetSupportBinding.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';

const deps = {
  toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
};

const constants = {
  anonymousRateIdHeader: 'X-Anonymous-Client-Id',
  anonymousUnknownIdentity: 'anon:unknown',
};

test('anonymous quotas count an IPv6 /64 and mapped IPv4 as one caller', async () => {
  const instances = new Map();
  const env = {
    CE_SESSION_COORDINATOR: {
      idFromName: (name) => name,
      get: (id) => {
        if (!instances.has(id)) {
          const values = new Map();
          const storage = {
            get: async (key) => values.get(key),
            put: async (key, value) => values.set(key, structuredClone(value)),
            delete: async (key) => values.delete(key),
            transaction: (callback) => callback(storage),
          };
          const coordinator = new SessionWriteCoordinator({ storage }, env);
          instances.set(id, { fetch: (input, init) => coordinator.fetch(new Request(input, init)) });
        }
        return instances.get(id);
      },
    },
  };
  const { checkRateLimit } = createRateLimitFaucetSupportWithWorkerDeps({
    deps: { ...deps, recordAbuseEvent: async () => ({ ok: true }) },
  });
  for (const [ip, expected] of [
    ['2001:db8:1234:5678::1', 200],
    ['2001:db8:1234:5678::1', 429],
    ['2001:db8:1234:5678::2', 429],
    ['2001:db8:1234:5678::3', 429],
    ['2001:db8:1234:5679::1', 200],
    ['203.0.113.7', 200],
    ['::ffff:203.0.113.7', 429],
  ]) {
    const result = await dispatchAnonymousRouteEntry({
      path: '/ai', anonymousRoute: 'ai', env,
      request: { cf: {}, headers: new Headers({ 'CF-Connecting-IP': ip }) },
      deps: {
        resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'session-a' }),
        readCurrentSessionConfig: async () => ({ config: { limits: { perAnonymousIpPerDay: 1 } } }),
        getCorsContext: async () => ({ ok: true, headers: {} }),
        resolveAnonymousRateIdentity: (request) => resolveAnonymousRateIdentity({ request, deps, constants }),
        checkRateLimit,
        dispatchAnonymousRoute: async () => new Response('ok'),
        json: (body, status) => ({ body, status }),
      },
    });
    assert.equal(result.status, expected, ip);
  }
});

test('anonymous identities preserve unparseable IP values', () => {
  assert.equal(resolveAnonymousRateIdentity({
    request: { cf: {}, headers: new Headers({ 'CF-Connecting-IP': 'not:an:ip' }) }, deps, constants,
  }), 'anon:not:an:ip');
});

test('resolveAnonymousRateIdentity ignores forwarded headers outside Cloudflare runtime', () => {
  const identity = resolveAnonymousRateIdentity({
    request: {
      headers: new Headers({
        'x-forwarded-for': '203.0.113.9',
        'CF-Connecting-IP': '198.51.100.7',
      }),
    },
    deps,
    constants,
  });

  assert.equal(identity, 'anon:unknown');
});

test('resolveAnonymousRateIdentity trims and lowercases X-Anonymous-Client-Id when used for sharding', () => {
  const identity = resolveAnonymousRateIdentity({
    request: {
      headers: new Headers({ 'X-Anonymous-Client-Id': '  CLIENT_Abc12345  ' }),
    },
    deps,
    constants,
  });

  assert.equal(identity, 'anon:cid:client_abc12345');
});

test('resolveAnonymousRateIdentity falls back to unknown for invalid client ids', () => {
  const identity = resolveAnonymousRateIdentity({
    request: {
      headers: new Headers({ 'X-Anonymous-Client-Id': 'bad value!' }),
    },
    deps,
    constants,
  });

  assert.equal(identity, 'anon:unknown');
});

test('resolveAnonymousRateIdentity prefers Cloudflare CF-Connecting-IP in native runtime', () => {
  const identity = resolveAnonymousRateIdentity({
    request: {
      headers: new Headers({
        'CF-Connecting-IP': ' 198.51.100.7 ',
        'X-Anonymous-Client-Id': 'client_abc12345',
      }),
      cf: { colo: 'SJC' },
    },
    deps,
    constants,
  });

  assert.equal(identity, 'anon:198.51.100.7');
});

test('resolveAnonymousRateIdentity falls back to client id when Cloudflare runtime lacks CF-Connecting-IP', () => {
  const identity = resolveAnonymousRateIdentity({
    request: {
      headers: new Headers({ 'X-Anonymous-Client-Id': 'client_abc12345' }),
      cf: { colo: 'SJC' },
    },
    deps,
    constants,
  });

  assert.equal(identity, 'anon:cid:client_abc12345');
});
