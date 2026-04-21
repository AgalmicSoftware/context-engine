import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchSponsoredBootstrapRedeem } from './sponsoredBootstrapRedeemDispatch.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createKvEnv = (record = null, envOverrides = {}) => {
  const deletes = [];
  return {
    deletes,
    env: {
      GROUP_KV: {
        get: async () => (record ? JSON.stringify(record) : null),
        delete: async (key) => {
          deletes.push(key);
        },
      },
      ...envOverrides,
    },
  };
};

const createDeployRequest = (body = {}, origin = 'https://allowed.example.test') => ({
  headers: new Headers({ Origin: origin }),
  json: async () => body,
});

const createDeployDeps = (overrides = {}) => ({
  json: createJsonStub(),
  getCorsContext: async () => ({
    ok: true,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  }),
  ...overrides,
});

test('dispatchSponsoredBootstrapRedeem rejects invalid JSON before reading grant records', async () => {
  const { env } = createKvEnv();

  const result = await dispatchSponsoredBootstrapRedeem({
    request: {
      json: async () => {
        throw new Error('bad json');
      },
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: {
      json: createJsonStub(),
    },
  });

  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchSponsoredBootstrapRedeem uses the embedded deploy-helper path first and consumes the grant on success', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });
  const embeddedCalls = [];

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: 'new-worker',
        sessionSlug: 'fresh-session',
        embeddedDeployHelperEnabled: true,
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async (value) => {
        embeddedCalls.push(value);
        return {
          ok: true,
          status: 200,
          body: { ok: true, workerUrl: 'https://fresh-session.example.test' },
        };
      },
      fetch: async () => {
        assert.fail('fallback helper should not run when embedded deploy succeeds');
      },
    }),
  });

  assert.deepEqual(embeddedCalls, [{
    body: {
      workerName: 'new-worker',
      sessionSlug: 'fresh-session',
      embeddedDeployHelperEnabled: true,
      apiToken: 'cf-sponsored-token',
    },
    env,
    requestOrigin: 'https://allowed.example.test',
    consoleImpl: console,
  }]);
  assert.deepEqual(deletes, ['sponsoredGrant:deploy-grant-1']);
  assert.deepEqual(result, {
    body: { ok: true, workerUrl: 'https://fresh-session.example.test' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem returns retryable embedded deploy failures directly and keeps the grant', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: 'new-worker',
        sessionSlug: 'fresh-session',
        secrets: { openaiKey: 'sk-sponsored' },
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async () => ({
        ok: false,
        status: 502,
        body: { error: 'Embedded deploy unavailable.' },
        fallbackEligible: true,
      }),
      fetch: async (url, init) => {
        assert.fail(`fallback helper should not run (${url} ${init?.method || 'GET'})`);
      },
    }),
  });

  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { error: 'Embedded deploy unavailable.' },
    status: 502,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem rejects deploy grants when embedded deploy-helper is disabled on the source worker', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
      embeddedDeployHelperEnabled: true,
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '0',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: 'new-worker',
        sessionSlug: 'fresh-session',
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async () => {
        assert.fail('embedded deploy should be skipped when disabled');
      },
      fetch: async (url, init) => {
        assert.fail(`fallback helper should not run (${url} ${init?.method || 'GET'})`);
      },
    }),
  });

  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { error: 'Embedded sponsored deploy is disabled on this worker.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem returns embedded deploy failures directly when they are not fallback-eligible', async () => {
  const { env, deletes } = createKvEnv({
    type: 'deploy-worker',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
    },
    cloudflareApiToken: 'cf-sponsored-token',
  }, {
    DEPLOY_HELPER_ENABLED: '1',
  });

  const result = await dispatchSponsoredBootstrapRedeem({
    request: createDeployRequest({
      deployGrantToken: 'deploy-grant-1',
      deployPayload: {
        workerName: '',
        sessionSlug: 'fresh-session',
      },
    }),
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'deploy',
    deps: createDeployDeps({
      executeDeployHelperRequest: async () => ({
        ok: false,
        status: 400,
        body: { error: 'Missing workerName.' },
        fallbackEligible: false,
      }),
      fetch: async () => {
        assert.fail('fallback helper should not run for non-retryable embedded failures');
      },
    }),
  });

  assert.deepEqual(deletes, []);
  assert.deepEqual(result, {
    body: { error: 'Missing workerName.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchSponsoredBootstrapRedeem runs faucet grants through the faucet service and consumes them on success', async () => {
  const { env, deletes } = createKvEnv({
    type: 'faucet-tx',
    sourceSessionSlug: 'source-session',
    sourceConfig: {
      allowOrigins: ['https://allowed.example.test'],
      faucet: { amountEth: '0.0002' },
    },
    faucetPrivateKey: '0xfaucet',
  });
  const faucetCalls = [];

  const result = await dispatchSponsoredBootstrapRedeem({
    request: {
      headers: new Headers({ Origin: 'https://allowed.example.test' }),
      json: async () => ({
        faucetGrantToken: 'faucet-grant-1',
        to: '0x1111111111111111111111111111111111111111',
      }),
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    action: 'faucet',
    deps: {
      json: createJsonStub(),
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
      }),
      faucet: async (value) => {
        faucetCalls.push(value);
        return {
          body: { txHash: '0xfaucet123' },
          status: 200,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        };
      },
    },
  });

  assert.deepEqual(faucetCalls, [{
    payload: {
      action: 'request_test_eth',
      to: '0x1111111111111111111111111111111111111111',
    },
    secrets: {
      faucetPrivateKey: '0xfaucet',
    },
    config: {
      allowOrigins: ['https://allowed.example.test'],
      faucet: { amountEth: '0.0002' },
    },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    slug: 'source-session',
    requesterAddress: '0x1111111111111111111111111111111111111111',
    tokenHasFaucetScope: true,
  }]);
  assert.deepEqual(deletes, ['sponsoredGrant:faucet-grant-1']);
  assert.deepEqual(result, {
    body: { txHash: '0xfaucet123' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});
