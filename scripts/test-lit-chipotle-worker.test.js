'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLitCredentialsConfig,
  buildSecretPayload,
  resolveLitChipotleE2eConfig,
  runLitChipotleWorkerSmokeTest,
} = require('./test-lit-chipotle-worker.js');

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

test('resolveLitChipotleE2eConfig reads the usage-key worker smoke inputs', () => {
  const config = resolveLitChipotleE2eConfig({
    env: {
      LIT_USAGE_API_KEY: 'lit-secret',
    },
    args: {},
  });

  assert.equal(config.useWorkerEnvFallback, false);
  assert.equal(config.usageApiKey, 'lit-secret');
  assert.equal(config.accountApiKey, '');
});

test('resolveLitChipotleE2eConfig preserves configured Lit runtime identifiers for status checks', () => {
  const config = resolveLitChipotleE2eConfig({
    env: {
      LIT_USAGE_API_KEY: 'lit-secret',
      LIT_GROUP_ID: 'group_123',
      LIT_PKP_ID: 'pkp_123',
      LIT_ACTION_CID: 'bafy123',
    },
    args: {},
  });

  assert.equal(config.litGroupId, 'group_123');
  assert.equal(config.litPkpId, 'pkp_123');
  assert.equal(config.litActionCid, 'bafy123');
});

test('buildLitCredentialsConfig and buildSecretPayload preserve the worker config/secret boundary', () => {
  const config = {
    litApiBase: 'https://api.chipotle.litprotocol.com',
    litGroupId: 'group_123',
    litPkpId: 'pkp_123',
    litActionCid: 'bafy123',
    usageApiKey: 'lit-secret',
    customRpcUrl: 'https://rpc.example.test',
    customRpcKey: 'rpc-secret',
    useWorkerEnvFallback: false,
  };

  assert.deepEqual(buildLitCredentialsConfig(config), {
    litApiBase: 'https://api.chipotle.litprotocol.com',
    litGroupId: 'group_123',
    litPkpId: 'pkp_123',
    litActionCid: 'bafy123',
  });
  assert.deepEqual(buildSecretPayload(config), {
    litUsageApiKey: 'lit-secret',
    customRpcUrl: 'https://rpc.example.test',
    customRpcKey: 'rpc-secret',
  });
});

test('runLitChipotleWorkerSmokeTest exercises the signed local worker path with mocked Chipotle responses', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/billing/balance')) {
      return jsonResponse({
        balance_display: '$5.00 credit',
      });
    }
    if (String(url).endsWith('/core/v1/get_lit_action_client_config')) {
      return jsonResponse({
        timeout_ms: 30000,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const report = await runLitChipotleWorkerSmokeTest({
    env: {
      LIT_USAGE_API_KEY: 'lit-secret',
      SESSION_SLUG: 'chipotle-smoke',
      AI_RUN_TAG: 'chipotle-test',
    },
    fetchImpl,
    persistArtifacts: false,
  });

  assert.equal(report.ok, true);
  assert.equal(report.setConfig.ok, true);
  assert.equal(report.setSecrets.ok, true);
  assert.equal(report.statusCheck.ok, true);
  assert.equal(report.statusCheck.response.apiKeySource, 'session-secret');
  assert.equal(calls.some(([url]) => url.endsWith('/core/v1/billing/balance')), true);
  assert.equal(calls.some(([url]) => url.endsWith('/core/v1/lit_action')), false);
});
