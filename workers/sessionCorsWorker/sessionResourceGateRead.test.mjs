import test from 'node:test';
import assert from 'node:assert/strict';

import { toChainId } from './chainIdNormalization.js';
import { readResourceGateOnChain } from './sessionResourceGateRead.js';

const createDeps = (overrides = {}) => ({
  callRegistryFunction: async () => [['0xabc'], 84532, 0],
  maskRpcUrl: (value) => `masked:${value}`,
  rpcRequest: async ({ method }) => {
    assert.equal(method, 'eth_chainId');
    return '0x14a34';
  },
  toStr: (value) => `${value ?? ''}`,
  toChainId,
  ...overrides,
});

test('readResourceGateOnChain returns the first successful decoded gate and preserves earlier masked rpc errors', async () => {
  const calls = [];

  const result = await readResourceGateOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example', 'https://rpc-c.example'],
    registrySlug: 'session-a',
    resourceKey: 'default',
    expectedChainId: 84532,
    chainAttestationCache: new Map(),
    deps: createDeps({
      callRegistryFunction: async (value) => {
        calls.push(value);
        if (value.rpcUrl === 'https://rpc-a.example') {
          const err = new Error(' rpc-a failed ');
          err.rpcStatus = 503;
          err.rpcError = { code: -32000 };
          throw err;
        }
        if (value.rpcUrl === 'https://rpc-b.example') {
          return [['0x111', '', null, '0x222'], '84532', '2'];
        }
        throw new Error('should not reach fallback rpc');
      },
    }),
  });

  assert.deepEqual(calls, [
    {
      rpcUrl: 'https://rpc-a.example',
      registryAddress: '0x0000000000000000000000000000000000000001',
      method: 'getResourceGate',
      args: ['session-a', 'default'],
    },
    {
      rpcUrl: 'https://rpc-b.example',
      registryAddress: '0x0000000000000000000000000000000000000001',
      method: 'getResourceGate',
      args: ['session-a', 'default'],
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    gate: {
      sbtAddresses: ['0x111', '0x222'],
      chainId: 84532,
      mode: 2,
    },
    rpcUrl: 'https://rpc-b.example',
    errors: [
      {
        rpcUrl: 'masked:https://rpc-a.example',
        status: 503,
        code: -32000,
        error: 'Registry gate lookup RPC request failed.',
      },
    ],
  });
});

test('readResourceGateOnChain returns an error string and masked rpc errors when every rpc fails', async () => {
  const result = await readResourceGateOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example'],
    registrySlug: 'session-b',
    resourceKey: 'ai',
    expectedChainId: 84532,
    chainAttestationCache: new Map(),
    deps: createDeps({
      callRegistryFunction: async ({ rpcUrl }) => {
        if (rpcUrl === 'https://rpc-a.example') {
          const err = new Error(' rpc-a unavailable ');
          err.rpcStatus = 502;
          err.rpcError = 'bad gateway';
          throw err;
        }
        const err = new Error(' rpc-b unavailable ');
        err.rpcStatus = 429;
        err.rpcError = { code: -32005 };
        throw err;
      },
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'Registry gate lookup failed.',
    errors: [
      {
        rpcUrl: 'masked:https://rpc-a.example',
        status: 502,
        error: 'Registry gate lookup RPC request failed.',
      },
      {
        rpcUrl: 'masked:https://rpc-b.example',
        status: 429,
        code: -32005,
        error: 'Registry gate lookup RPC request failed.',
      },
    ],
  });
  assert.equal(JSON.stringify(result).includes('unavailable'), false);
  assert.equal(JSON.stringify(result).includes('rpcError'), false);
});

test('readResourceGateOnChain rejects a wrong-chain endpoint before the registry read', async () => {
  let registryReads = 0;
  const result = await readResourceGateOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://wrong-chain.example'],
    registrySlug: 'session-c',
    resourceKey: 'default',
    expectedChainId: 31337,
    chainAttestationCache: new Map(),
    deps: createDeps({
      rpcRequest: async () => '0x14a34',
      callRegistryFunction: async () => {
        registryReads += 1;
        return [[], 31337, 0];
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(registryReads, 0);
  assert.deepEqual(result.errors, [{
    rpcUrl: 'masked:https://wrong-chain.example',
    status: null,
    error: 'Registry gate lookup RPC chain attestation failed.',
  }]);
});

test('readResourceGateOnChain strictly normalizes an ethers-v5 BigNumber chain at the ABI boundary', async () => {
  const decodedChainId = {
    _isBigNumber: true,
    toString: () => '84532',
  };
  const result = await readResourceGateOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc.example'],
    registrySlug: 'session-d',
    resourceKey: 'default',
    expectedChainId: 84532,
    chainAttestationCache: new Map(),
    deps: createDeps({
      callRegistryFunction: async () => [['0xabc'], decodedChainId, 0],
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.gate.chainId, 84532);
});
