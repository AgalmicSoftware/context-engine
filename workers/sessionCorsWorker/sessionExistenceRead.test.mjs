import test from 'node:test';
import assert from 'node:assert/strict';

import { readSessionExistsOnChain } from './sessionExistenceRead.js';

const createDeps = (overrides = {}) => ({
  callRegistryFunction: async () => [true],
  maskRpcUrl: (value) => `masked:${value}`,
  toStr: (value) => `${value ?? ''}`,
  ...overrides,
});

test('readSessionExistsOnChain returns the first successful decoded result and preserves earlier masked rpc errors', async () => {
  const calls = [];

  const result = await readSessionExistsOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example', 'https://rpc-c.example'],
    registrySlug: 'session-a',
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
          return [1];
        }
        throw new Error('should not reach fallback rpc');
      },
    }),
  });

  assert.deepEqual(calls, [
    {
      rpcUrl: 'https://rpc-a.example',
      registryAddress: '0x0000000000000000000000000000000000000001',
      method: 'sessionExists',
      args: ['session-a'],
    },
    {
      rpcUrl: 'https://rpc-b.example',
      registryAddress: '0x0000000000000000000000000000000000000001',
      method: 'sessionExists',
      args: ['session-a'],
    },
  ]);
  assert.deepEqual(result, {
    exists: true,
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

test('readSessionExistsOnChain returns exists null, the raw last error, and masked rpc errors when every rpc fails', async () => {
  const lastError = new Error(' rpc-b unavailable ');
  lastError.rpcStatus = 429;
  lastError.rpcError = { code: -32005 };

  const result = await readSessionExistsOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example'],
    registrySlug: 'session-b',
    deps: createDeps({
      callRegistryFunction: async ({ rpcUrl }) => {
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

  assert.equal(result.exists, null);
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
