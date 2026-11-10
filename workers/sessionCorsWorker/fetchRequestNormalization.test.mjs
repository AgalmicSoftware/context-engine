import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFetchTargetUrl } from './fetchRequestNormalization.js';

test('normalizeFetchTargetUrl trims and preserves valid https targets', () => {
  assert.deepEqual(
    normalizeFetchTargetUrl({
      url: ' https://example.com/path?q=1 ',
      deps: { isBlockedOutboundUrl: () => false },
    }),
    {
      ok: true,
      status: 200,
      error: '',
      targetUrl: 'https://example.com/path?q=1',
    }
  );
});

test('normalizeFetchTargetUrl preserves missing, invalid, protocol, and blocked-target failures', () => {
  assert.deepEqual(
    normalizeFetchTargetUrl({
      url: '   ',
      deps: { isBlockedOutboundUrl: () => false },
    }),
    {
      ok: false,
      status: 400,
      error: 'Missing url',
      targetUrl: '',
    }
  );

  assert.deepEqual(
    normalizeFetchTargetUrl({
      url: 'not-a-url',
      deps: { isBlockedOutboundUrl: () => false },
    }),
    {
      ok: false,
      status: 400,
      error: 'Invalid URL',
      targetUrl: '',
    }
  );

  for (const url of ['ftp://example.com/file.txt', 'http://example.com/page']) {
    assert.deepEqual(
      normalizeFetchTargetUrl({
        url,
        deps: { isBlockedOutboundUrl: () => false },
      }),
      {
        ok: false,
        status: 400,
        error: 'URL must be https',
        targetUrl: url,
      }
    );
  }

  assert.deepEqual(
    normalizeFetchTargetUrl({
      url: 'https://example.com/private',
      deps: { isBlockedOutboundUrl: () => true },
    }),
    {
      ok: false,
      status: 403,
      error: 'URL target is not allowed',
      targetUrl: 'https://example.com/private',
    }
  );
});
