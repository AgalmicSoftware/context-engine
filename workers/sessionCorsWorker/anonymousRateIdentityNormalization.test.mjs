import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAnonymousRateIdentity } from './anonymousRateIdentityNormalization.js';

const deps = {
  toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
};

const constants = {
  anonymousRateIdHeader: 'X-Anonymous-Client-Id',
  anonymousUnknownIdentity: 'anon:unknown',
};

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
