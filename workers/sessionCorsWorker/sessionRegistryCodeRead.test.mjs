import test from 'node:test';
import assert from 'node:assert/strict';

import { toChainId } from './chainIdNormalization.js';
import { readRegistryCodeOnChain } from './sessionRegistryCodeRead.js';

const createDeps = (overrides = {}) => ({
  rpcRequest: async ({ method }) => (method === 'eth_chainId' ? '0x14a34' : '0x1234'),
  maskRpcUrl: (value) => `masked:${value}`,
  toStr: (value) => `${value ?? ''}`,
  toChainId,
  ...overrides,
});

test('readRegistryCodeOnChain returns the first successful bytecode size and preserves earlier masked rpc errors', async () => {
  const calls = [];

  const result = await readRegistryCodeOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example', 'https://rpc-c.example'],
    expectedChainId: 84532,
    chainAttestationCache: new Map(),
    deps: createDeps({
      rpcRequest: async (value) => {
        if (value.method === 'eth_chainId') return '0x14a34';
        calls.push(value);
        if (value.rpcUrl === 'https://rpc-a.example') {
          const err = new Error(' rpc-a failed ');
          err.rpcStatus = 503;
          err.rpcError = { code: -32000 };
          throw err;
        }
        if (value.rpcUrl === 'https://rpc-b.example') {
          return '0x1234';
        }
        throw new Error('should not reach fallback rpc');
      },
    }),
  });

  assert.deepEqual(calls, [
    {
      rpcUrl: 'https://rpc-a.example',
      method: 'eth_getCode',
      params: ['0x0000000000000000000000000000000000000001', 'latest'],
    },
    {
      rpcUrl: 'https://rpc-b.example',
      method: 'eth_getCode',
      params: ['0x0000000000000000000000000000000000000001', 'latest'],
    },
  ]);
  assert.deepEqual(result, {
    size: 2,
    rpcUrl: 'https://rpc-b.example',
    errors: [
      {
        rpcUrl: 'masked:https://rpc-a.example',
        status: 503,
        code: -32000,
        error: 'Registry code RPC request failed.',
      },
    ],
  });
});

test('readRegistryCodeOnChain returns a safe last error and masked rpc diagnostics when every rpc fails', async () => {
  const lastError = new Error(' rpc-b unavailable ');
  lastError.rpcStatus = 429;
  lastError.rpcError = { code: -32005 };

  const result = await readRegistryCodeOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example'],
    expectedChainId: 84532,
    chainAttestationCache: new Map(),
    deps: createDeps({
      rpcRequest: async ({ rpcUrl, method }) => {
        if (method === 'eth_chainId') return '0x14a34';
        if (rpcUrl === 'https://rpc-a.example') {
          const err = new Error(' rpc-a unavailable ');
          err.rpcStatus = 502;
          err.rpcError = 'bad gateway';
          throw err;
        }
        throw lastError;
      },
    }),
  });

  assert.equal(result.size, null);
  assert.equal(result.error.message, 'Registry code RPC request failed.');
  assert.equal(result.error.rpcStatus, 429);
  assert.equal(result.error.rpcCode, -32005);
  assert.deepEqual(result.errors, [
    {
      rpcUrl: 'masked:https://rpc-a.example',
      status: 502,
      error: 'Registry code RPC request failed.',
    },
    {
      rpcUrl: 'masked:https://rpc-b.example',
      status: 429,
      code: -32005,
      error: 'Registry code RPC request failed.',
    },
  ]);
  assert.equal(JSON.stringify(result).includes('unavailable'), false);
  assert.equal(JSON.stringify(result).includes('rpcError'), false);
});

test('readRegistryCodeOnChain rejects a wrong-chain endpoint before the bytecode read', async () => {
  const methods = [];
  const result = await readRegistryCodeOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://wrong-chain.example'],
    expectedChainId: 31337,
    chainAttestationCache: new Map(),
    deps: createDeps({
      rpcRequest: async ({ method }) => {
        methods.push(method);
        return method === 'eth_chainId' ? '0x14a34' : '0x1234';
      },
    }),
  });

  assert.equal(result.size, null);
  assert.deepEqual(methods, ['eth_chainId']);
  assert.deepEqual(result.errors, [{
    rpcUrl: 'masked:https://wrong-chain.example',
    status: null,
    error: 'Registry code RPC chain attestation failed.',
  }]);
});
