import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CLOUDFLARE_API_BASE_URL,
  CLOUDFLARE_API_BASE_URL_ENV,
  resolveCloudflareApiBaseUrl,
} from './deployHelperEndpointConfig.mjs';
import {
  cfFetch,
  lookupCloudflareAccount,
} from './deployHelperCore.mjs';

test('resolveCloudflareApiBaseUrl uses the default endpoint when unset', () => {
  assert.equal(resolveCloudflareApiBaseUrl(), DEFAULT_CLOUDFLARE_API_BASE_URL);
});

test('resolveCloudflareApiBaseUrl accepts an env override and trims the trailing slash', () => {
  assert.equal(
    resolveCloudflareApiBaseUrl({
      env: {
        [CLOUDFLARE_API_BASE_URL_ENV]: ' https://api.cloudflare.example.test/client/v4/ ',
      },
    }),
    'https://api.cloudflare.example.test/client/v4'
  );
});

test('cfFetch uses the configured Cloudflare API base URL', async () => {
  const calls = [];
  const result = await cfFetch('cf-token', '/accounts', {}, {
    env: {
      [CLOUDFLARE_API_BASE_URL_ENV]: 'https://api.cloudflare.example.test/client/v4',
    },
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify({ success: true, result: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0][0], 'https://api.cloudflare.example.test/client/v4/accounts');
});

test('lookupCloudflareAccount passes the configured API base URL to cfFetch', async () => {
  const calls = [];
  const result = await lookupCloudflareAccount({
    apiToken: 'cf-token',
    env: {
      [CLOUDFLARE_API_BASE_URL_ENV]: 'https://api.cloudflare.example.test/client/v4/',
    },
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify({
        success: true,
        result: [{
          id: 'account-123',
          name: 'Test account',
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.accountId, 'account-123');
  assert.equal(calls[0][0], 'https://api.cloudflare.example.test/client/v4/accounts?per_page=1');
});
