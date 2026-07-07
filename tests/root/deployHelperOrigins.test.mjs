import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveDeployHelperAllowList,
  resolveDeployHelperFallbackAllowList,
} from '../../workers/shared/deployHelperOrigins.mjs';
import {
  DEFAULT_ALLOWED_ORIGINS,
  ensureWorkersDevSubdomain,
} from '../../workers/shared/deployHelperCore.mjs';
import {
  CLOUDFLARE_API_BASE_URL_ENV,
} from '../../workers/shared/deployHelperEndpointConfig.mjs';

const makeKvBinding = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
  };
};

test('resolveDeployHelperAllowList prefers the KV override over env origins', async () => {
  const allowList = await resolveDeployHelperAllowList({
    ALLOWED_ORIGINS: 'https://env.example.test',
    DEPLOY_HELPER_KV: makeKvBinding({
      'deploy-helper:origins': JSON.stringify(['https://kv.example.test']),
    }),
  });

  assert.deepEqual(allowList, {
    origins: ['https://kv.example.test'],
    source: 'kv',
  });
});

test('resolveDeployHelperAllowList falls back to localhost-only when env and KV are unset', async () => {
  const allowList = await resolveDeployHelperAllowList({});

  assert.deepEqual(DEFAULT_ALLOWED_ORIGINS, ['http://localhost:3000']);
  assert.deepEqual(allowList, {
    origins: ['http://localhost:3000'],
    source: 'default',
  });
});

test('resolveDeployHelperFallbackAllowList keeps configured env origins available for admin CORS', async () => {
  assert.deepEqual(
    resolveDeployHelperFallbackAllowList({
      ALLOWED_ORIGINS: 'https://env.example.test\nhttp://localhost:3000',
    }),
    ['https://env.example.test', 'http://localhost:3000']
  );
});

test('ensureWorkersDevSubdomain clears stale lookup errors after it successfully enables a CE-prefixed fallback subdomain', async () => {
  const responses = [
    new Response(JSON.stringify({
      success: false,
      errors: [{
        message: 'You do not have a worker subdomain. Please go to Cloudflare Workers first.',
      }],
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
    new Response(JSON.stringify({
      success: true,
      result: {
        subdomain: 'ce-ab09af5b7d',
        status: 'active',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    new Response(JSON.stringify({
      success: true,
      result: {
        enabled: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ];
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    return next;
  };

  const result = await ensureWorkersDevSubdomain({
    apiToken: 'cf-token',
    accountId: 'ab09af5b7d123456',
    workerName: 'ce-deploy-helper',
    fetchImpl,
  });

  assert.equal(result.subdomain, 'ce-ab09af5b7d');
  assert.equal(result.subdomainStatus, 'active');
  assert.equal(result.subdomainEnabled, true);
  assert.equal(result.subdomainError, '');
  assert.equal(result.scriptSubdomainEnabled, true);
  assert.equal(result.scriptSubdomainError, '');
  assert.equal(
    result.workerUrl,
    'https://ce-deploy-helper.ce-ab09af5b7d.workers.dev/' // intentional: real URL — tests worker URL construction
  );
  assert.match(String(calls[1][1]?.body || ''), /"subdomain":"ce-ab09af5b7d"/);
});

test('ensureWorkersDevSubdomain uses the configured Cloudflare API base URL', async () => {
  const responses = [
    new Response(JSON.stringify({
      success: true,
      result: {
        subdomain: 'tenant-subdomain',
        status: 'active',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    new Response(JSON.stringify({
      success: true,
      result: {
        enabled: true,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ];
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    return next;
  };

  const result = await ensureWorkersDevSubdomain({
    apiToken: 'cf-token',
    accountId: 'account-123',
    workerName: 'ce-worker',
    env: {
      [CLOUDFLARE_API_BASE_URL_ENV]: 'https://api.cloudflare.example.test/client/v4/',
    },
    fetchImpl,
  });

  assert.equal(result.workerUrl, 'https://ce-worker.tenant-subdomain.workers.dev/');
  assert.equal(
    calls[0][0],
    'https://api.cloudflare.example.test/client/v4/accounts/account-123/workers/subdomain'
  );
  assert.equal(
    calls[1][0],
    'https://api.cloudflare.example.test/client/v4/accounts/account-123/workers/scripts/ce-worker/subdomain'
  );
});
