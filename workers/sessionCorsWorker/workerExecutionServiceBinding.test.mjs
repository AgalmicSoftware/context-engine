import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';

test('createWorkerExecutionServicesWithWorkerDeps directly owns the five execution services', async () => {
  const calls = [];
  const services = createWorkerExecutionServicesWithWorkerDeps({
    deps: {
      fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ content: [{ text: 'direct' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });

  const response = await services.proxyAnthropic({
    payload: { prompt: 'ping' },
    secrets: { anthropicKey: 'test-key' },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    completion: 'direct',
    raw: { content: [{ text: 'direct' }] },
  });
  assert.equal(calls.length, 1);
});

test('createWorkerExecutionServicesWithWorkerDeps returns the complete service surface', () => {
  const services = createWorkerExecutionServicesWithWorkerDeps();

  assert.equal(typeof services.proxyAnthropic, 'function');
  assert.equal(typeof services.proxyOpenAI, 'function');
  assert.equal(typeof services.proxyOpenRouter, 'function');
  assert.equal(typeof services.proxyCustomRPC, 'function');
  assert.equal(typeof services.transcribe, 'function');
  assert.equal(typeof services.faucet, 'function');
  assert.equal(typeof services.fetchImage, 'function');
  assert.equal(typeof services.fetchUrl, 'function');
  assert.equal(typeof services.arweaveUpload, 'function');
  assert.equal(typeof services.storageRoute, 'function');
  assert.equal(typeof services.verifyAdminSignature, 'function');
});

test('createWorkerExecutionServicesWithWorkerDeps preserves admin-signature deps and logging wiring', async () => {
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const body = { sessionSlug: 'session-a' };
  const logs = [];
  const response = { ok: true, slug: 'session-a', address: '0xabc' };
  const services = createWorkerExecutionServicesWithWorkerDeps({
    deps: {
      verifyAdminSignature: async (value) => {
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slugHint, 'session-a');
        assert.equal(value.body, body);
        assert.deepEqual(value.config, { adminAddress: '0xadmin' });
        assert.equal(value.allowBootstrapWithoutConfig, true);
        assert.equal(value.deps.normalizeSignedWorkerRequest, 'normalizeSignedWorkerRequest');
        assert.equal(value.deps.resolveWorkerBodySlugContext, 'resolveWorkerBodySlugContext');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.verifyMessage, 'verifyMessage');
        assert.equal(value.deps.validateRecoveredAddressMatchesRequest, 'validateRecoveredAddressMatchesRequest');
        assert.equal(value.deps.parseSiweMessage, 'parseSiweMessage');
        assert.equal(value.deps.validateSiwe, 'validateSiwe');
        assert.equal(value.deps.validateSiweAddressMatchesRequest, 'validateSiweAddressMatchesRequest');
        assert.equal(value.deps.validateAdmin, 'validateAdmin');
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(value.deps.SLUG_ALIAS_MISMATCH_ERROR, 'sessionSlug aliases do not match.');
        assert.equal(value.deps.SLUG_MISMATCH_ERROR, 'sessionSlug does not match worker session.');
        assert.equal(
          await value.deps.consumeNonce(env, 'session-a', '0xabc', 'nonce-1'),
          'consumeNonceResult',
        );
        value.deps.log('[arweave] admin verify start', { requestId: 'req-1' });
        return response;
      },
      normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
      resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
      toStr: 'toStr',
      isAddress: 'isAddress',
      json: 'json',
      verifyMessage: 'verifyMessage',
      validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
      parseSiweMessage: 'parseSiweMessage',
      validateSiwe: 'validateSiwe',
      validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
      consumeNonce: async (...args) => {
        assert.deepEqual(args, [
          env,
          'session-a',
          '0xabc',
          'nonce-1',
          { usedNonceTtlSeconds: 600 },
        ]);
        return 'consumeNonceResult';
      },
      validateAdmin: 'validateAdmin',
      log: (...args) => logs.push(args),
    },
    constants: {
      usedNonceTtlSeconds: 600,
      missingSlugError: 'Missing sessionSlug.',
      slugAliasMismatchError: 'sessionSlug aliases do not match.',
      slugMismatchError: 'sessionSlug does not match worker session.',
    },
  });

  const result = await services.verifyAdminSignature({
    env,
    baseHeaders,
    slugHint: 'session-a',
    body,
    config: { adminAddress: '0xadmin' },
    allowBootstrapWithoutConfig: true,
  });

  assert.equal(result, response);
  assert.deepEqual(logs, [[
    '[arweave] admin verify start',
    { requestId: 'req-1' },
  ]]);
});

test('createWorkerExecutionServicesWithWorkerDeps retains logging injection for faucet execution', async () => {
  const logs = [];
  const services = createWorkerExecutionServicesWithWorkerDeps({
    deps: {
      log: (...args) => logs.push(args),
      isAddress: () => true,
      resolveFaucetRpcUrls: () => ['https://rpc.example'],
      maskRpcUrl: () => 'https://rpc.example',
    },
    defaults: {
      defaultAmountEth: '0.0002',
      defaultThresholdEth: '0.001',
    },
  });

  const response = await services.faucet({
    payload: { address: '0x1111111111111111111111111111111111111111' },
    config: {},
    secrets: {},
  });

  assert.equal(response.status, 401);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[faucet] request');
  assert.equal(logs[0][1].rpcUrl, 'https://rpc.example');
});

test('createWorkerExecutionServicesWithWorkerDeps directly imports pure request helpers', async () => {
  const services = createWorkerExecutionServicesWithWorkerDeps({
    deps: {
      normalizeFetchTargetUrl: () => {
        throw new Error('injected fetch normalizer should not run');
      },
    },
  });

  const response = await services.fetchUrl('not-a-valid-url', {});

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid URL' });
});
