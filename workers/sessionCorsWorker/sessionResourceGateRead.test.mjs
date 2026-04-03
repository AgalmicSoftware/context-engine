import test from 'node:test';
import assert from 'node:assert/strict';

import { readResourceGateOnChain } from './sessionResourceGateRead.js';

const createDeps = (overrides = {}) => ({
  callRegistryFunction: async () => [['0xabc'], 84532, 0],
  maskRpcUrl: (value) => `masked:${value}`,
  toStr: (value) => `${value ?? ''}`,
  toChainId: (value) => Number(value || 0),
  ...overrides,
});

test('readResourceGateOnChain returns the first successful decoded gate and preserves earlier masked rpc errors', async () => {
  const calls = [];

  const result = await readResourceGateOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example', 'https://rpc-c.example'],
    registrySlug: 'session-a',
    resourceKey: 'default',
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
        error: 'rpc-a failed',
        rpcError: { code: -32000 },
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
    error: 'rpc-b unavailable',
    errors: [
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
    ],
  });
});
