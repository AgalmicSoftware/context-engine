import test from 'node:test';
import assert from 'node:assert/strict';

import { attestRpcEndpointChain } from './rpcChainAttestation.js';
import { toChainId } from './chainIdNormalization.js';

test('attestRpcEndpointChain matches the endpoint chain and memoizes by url plus expected chain', async () => {
  let calls = 0;
  const cache = new Map();
  const input = {
    rpcUrl: 'https://rpc.example',
    expectedChainId: 31337,
    rpcRequest: async ({ method }) => {
      calls += 1;
      assert.equal(method, 'eth_chainId');
      return '0x7a69';
    },
    toChainId,
    cache,
  };

  assert.deepEqual(await attestRpcEndpointChain(input), {
    ok: true,
    reason: '',
    expectedChainId: 31337,
    actualChainId: 31337,
    status: null,
    code: null,
  });
  assert.deepEqual(await attestRpcEndpointChain(input), {
    ok: true,
    reason: '',
    expectedChainId: 31337,
    actualChainId: 31337,
    status: null,
    code: null,
  });
  assert.equal(calls, 1);
});

test('attestRpcEndpointChain fails closed on wrong-chain and unavailable endpoints without raw errors', async () => {
  const mismatch = await attestRpcEndpointChain({
    rpcUrl: 'https://TENANT_SECRET.rpc.example/v2/SECRET',
    expectedChainId: 31337,
    rpcRequest: async () => '0x14a34',
    toChainId,
  });
  assert.deepEqual(mismatch, {
    ok: false,
    reason: 'rpc-chain-mismatch',
    expectedChainId: 31337,
    actualChainId: 84532,
    status: null,
    code: null,
  });

  const error = new Error('failed at https://TENANT_SECRET.rpc.example/v2/SECRET');
  error.rpcStatus = 503;
  error.rpcError = { code: -32000, data: 'SECRET' };
  const unavailable = await attestRpcEndpointChain({
    rpcUrl: 'https://TENANT_SECRET.rpc.example/v2/SECRET',
    expectedChainId: 31337,
    rpcRequest: async () => { throw error; },
    toChainId,
  });
  assert.deepEqual(unavailable, {
    ok: false,
    reason: 'rpc-chain-attestation-failed',
    expectedChainId: 31337,
    actualChainId: null,
    status: 503,
    code: -32000,
  });
  assert.equal(JSON.stringify(unavailable).includes('SECRET'), false);
});

test('attestRpcEndpointChain default normalization rejects malformed and precision-losing chain ids', async () => {
  for (const actualChainId of [
    '0x7a69junk',
    '31337.0',
    '3.1337e4',
    '-31337',
    '0x20000000000001',
  ]) {
    const result = await attestRpcEndpointChain({
      rpcUrl: 'https://rpc.example',
      expectedChainId: 31337,
      rpcRequest: async () => actualChainId,
    });
    assert.equal(result.ok, false, actualChainId);
    assert.equal(result.actualChainId, null, actualChainId);
  }

  const unsafeExpected = await attestRpcEndpointChain({
    rpcUrl: 'https://rpc.example',
    expectedChainId: '0x20000000000000',
    rpcRequest: async () => '0x20000000000001',
  });
  assert.equal(unsafeExpected.ok, false);
  assert.equal(unsafeExpected.expectedChainId, null);
});
