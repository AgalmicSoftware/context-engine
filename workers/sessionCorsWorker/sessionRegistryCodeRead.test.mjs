import test from 'node:test';
import assert from 'node:assert/strict';

import { readRegistryCodeOnChain } from './sessionRegistryCodeRead.js';

const createDeps = (overrides = {}) => ({
  rpcRequest: async () => '0x1234',
  maskRpcUrl: (value) => `masked:${value}`,
  toStr: (value) => `${value ?? ''}`,
  ...overrides,
});

test('readRegistryCodeOnChain returns the first successful bytecode size and preserves earlier masked rpc errors', async () => {
  const calls = [];

  const result = await readRegistryCodeOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example', 'https://rpc-c.example'],
    deps: createDeps({
      rpcRequest: async (value) => {
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
        error: 'rpc-a failed',
        rpcError: { code: -32000 },
      },
    ],
  });
});

test('readRegistryCodeOnChain returns size null, the raw last error, and masked rpc errors when every rpc fails', async () => {
  const lastError = new Error(' rpc-b unavailable ');
  lastError.rpcStatus = 429;
  lastError.rpcError = { code: -32005 };

  const result = await readRegistryCodeOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example'],
    deps: createDeps({
      rpcRequest: async ({ rpcUrl }) => {
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
  assert.equal(result.error, lastError);
  assert.deepEqual(result.errors, [
    {
      rpcUrl: 'masked:https://rpc-a.example',
      status: 502,
      error: 'rpc-a unavailable',
      rpcError: 'bad gateway',
    },
    {
      rpcUrl: 'masked:https://rpc-b.example',
      status: 429,
      error: 'rpc-b unavailable',
      rpcError: { code: -32005 },
    },
  ]);
});
