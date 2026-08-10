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
  const services = createWorkerExecutionServicesWithWorkerDeps({
    deps: {
      createVerifyAdminSignatureWithWorkerDeps: () => 'verifyAdminSignature',
    },
  });

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
  assert.equal(services.verifyAdminSignature, 'verifyAdminSignature');
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
