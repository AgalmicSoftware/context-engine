import test from 'node:test';
import assert from 'node:assert/strict';

import { createOutboundUrlSafetyHelpersWithWorkerDeps } from './outboundUrlSafetyBinding.js';

test('createOutboundUrlSafetyHelpersWithWorkerDeps returns the expected helper functions', () => {
  const helpers = createOutboundUrlSafetyHelpersWithWorkerDeps();

  assert.equal(typeof helpers.normalizeOutboundHostname, 'function');
  assert.equal(typeof helpers.parseIpv4Octets, 'function');
  assert.equal(typeof helpers.isBlockedIpv4Octets, 'function');
  assert.equal(typeof helpers.parseMappedIpv4OctetsFromIpv6, 'function');
  assert.equal(typeof helpers.isBlockedIpv6Hostname, 'function');
  assert.equal(typeof helpers.isBlockedOutboundUrl, 'function');
  assert.equal(typeof helpers.buildSafeRedirectHeaders, 'function');
  assert.equal(typeof helpers.safeFetch, 'function');
});

test('createOutboundUrlSafetyHelpersWithWorkerDeps preserves hostname normalization and ipv4 parsing helpers', () => {
  const helpers = createOutboundUrlSafetyHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    },
  });

  assert.equal(helpers.normalizeOutboundHostname(' Example.COM... '), 'example.com');
  assert.deepEqual(helpers.parseIpv4Octets('192.168.1.5'), [192, 168, 1, 5]);
  assert.equal(helpers.parseIpv4Octets('999.168.1.5'), null);
  assert.equal(helpers.isBlockedIpv4Octets([127, 0, 0, 1]), true);
  assert.equal(helpers.isBlockedIpv4Octets([8, 8, 8, 8]), false);
  assert.deepEqual(helpers.parseMappedIpv4OctetsFromIpv6('[::ffff:7f00:1]'), [127, 0, 0, 1]);
  assert.equal(helpers.isBlockedIpv6Hostname('fe80::1'), true);
  assert.equal(helpers.isBlockedIpv6Hostname('2001:4860:4860::8888'), false);
});

test('createOutboundUrlSafetyHelpersWithWorkerDeps preserves outbound url blocking rules', () => {
  const { isBlockedOutboundUrl } = createOutboundUrlSafetyHelpersWithWorkerDeps();

  assert.equal(isBlockedOutboundUrl('not-a-url'), true);
  assert.equal(isBlockedOutboundUrl('ftp://example.com/file.txt'), true);
  assert.equal(isBlockedOutboundUrl('http://localhost:3000'), true);
  assert.equal(isBlockedOutboundUrl('http://127.0.0.1:8545'), true);
  assert.equal(isBlockedOutboundUrl('https://[::1]/health'), true);
  assert.equal(isBlockedOutboundUrl('https://[::ffff:7f00:1]/health'), true);
  assert.equal(isBlockedOutboundUrl('http://metadata.google.internal/computeMetadata/v1'), true);
  assert.equal(isBlockedOutboundUrl('https://example.com/path?q=1'), false);
});

test('createOutboundUrlSafetyHelpersWithWorkerDeps preserves redirect header filtering', () => {
  const { buildSafeRedirectHeaders } = createOutboundUrlSafetyHelpersWithWorkerDeps();
  const headers = buildSafeRedirectHeaders({
    'content-type': 'application/json',
    'user-agent': 'ce-test',
    authorization: 'Bearer secret',
    cookie: 'a=b',
  });

  assert.equal(headers.get('content-type'), 'application/json');
  assert.equal(headers.get('user-agent'), 'ce-test');
  assert.equal(headers.get('authorization'), null);
  assert.equal(headers.get('cookie'), null);
});

test('createOutboundUrlSafetyHelpersWithWorkerDeps preserves non-redirect response passthrough', async () => {
  const calls = [];
  const response = new Response('ok', { status: 200 });
  const { safeFetch } = createOutboundUrlSafetyHelpersWithWorkerDeps({
    deps: {
      fetch: async (...args) => {
        calls.push(args);
        return response;
      },
    },
  });

  const result = await safeFetch('https://example.com/page', {
    method: 'POST',
    headers: { authorization: 'Bearer secret' },
  });

  assert.equal(result, response);
  assert.deepEqual(calls, [[
    'https://example.com/page',
    {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      redirect: 'manual',
    },
  ]]);
});

test('createOutboundUrlSafetyHelpersWithWorkerDeps preserves safe single-redirect follow behavior', async () => {
  const calls = [];
  const { safeFetch } = createOutboundUrlSafetyHelpersWithWorkerDeps({
    deps: {
      fetch: async (url, options) => {
        calls.push([url, options]);
        if (calls.length === 1) {
          return new Response(null, {
            status: 302,
            headers: {
              location: '/final?secret=yes',
            },
          });
        }
        return new Response('done', { status: 200 });
      },
    },
  });

  const result = await safeFetch('https://example.com/start', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'ce-test',
      authorization: 'Bearer secret',
    },
  });

  assert.equal(await result.text(), 'done');
  assert.deepEqual(calls, [
    ['https://example.com/start', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'ce-test',
        authorization: 'Bearer secret',
      },
      redirect: 'manual',
    }],
    ['https://example.com/final?secret=yes', {
      method: 'POST',
      headers: new Headers({
        'content-type': 'application/json',
        'user-agent': 'ce-test',
      }),
      redirect: 'manual',
    }],
  ]);
});

test('createOutboundUrlSafetyHelpersWithWorkerDeps preserves blocked redirect and too-many-redirect failures', async () => {
  const blockedHelpers = createOutboundUrlSafetyHelpersWithWorkerDeps({
    deps: {
      fetch: async () => new Response(null, {
        status: 302,
        headers: {
          location: 'http://127.0.0.1:8545',
        },
      }),
    },
  });

  assert.deepEqual(
    await blockedHelpers.safeFetch('https://example.com/start'),
    { ok: false, error: 'Redirect to blocked target', status: 403 },
  );

  let callCount = 0;
  const loopingHelpers = createOutboundUrlSafetyHelpersWithWorkerDeps({
    deps: {
      fetch: async () => {
        callCount += 1;
        if (callCount === 1) {
          return new Response(null, {
            status: 302,
            headers: {
              location: 'https://example.com/second',
            },
          });
        }
        return new Response(null, {
          status: 301,
          headers: {
            location: 'https://example.com/third',
          },
        });
      },
    },
  });

  assert.deepEqual(
    await loopingHelpers.safeFetch('https://example.com/start'),
    { ok: false, error: 'Too many redirects', status: 403 },
  );
});

test('safeFetch strict HTTPS policy rejects insecure and credential-bearing redirects', async () => {
  for (const location of [
    'http://example.com/insecure',
    'https://user:[redacted-email]/credentialed',
  ]) {
    let callCount = 0;
    const { safeFetch } = createOutboundUrlSafetyHelpersWithWorkerDeps({
      deps: {
        fetch: async () => {
          callCount += 1;
          return new Response(null, { status: 302, headers: { location } });
        },
      },
    });

    assert.deepEqual(
      await safeFetch('https://example.com/start', {
        outboundUrlPolicy: 'strict-https-no-credentials',
      }),
      { ok: false, error: 'Redirect to blocked target', status: 403 },
    );
    assert.equal(callCount, 1);
  }
});
