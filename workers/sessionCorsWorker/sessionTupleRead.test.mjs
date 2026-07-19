import test from 'node:test';
import assert from 'node:assert/strict';

import { toChainId } from './chainIdNormalization.js';
import { readSessionBySlugOnChain } from './sessionTupleRead.js';

const createDeps = (overrides = {}) => ({
  callRegistryFunction: async () => ['session-a', 84532, '', '', '0xabc123', 0, 0, '0x11111111111111111111111111111111'],
  maskRpcUrl: (value) => `masked:${value}`,
  rpcRequest: async ({ method }) => {
    assert.equal(method, 'eth_chainId');
    return '0x14a34';
  },
  toStr: (value) => `${value ?? ''}`,
  toChainId,
  ...overrides,
});

test('readSessionBySlugOnChain returns the first successful tuple and preserves earlier masked rpc errors', async () => {
  const calls = [];

  const result = await readSessionBySlugOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example', 'https://rpc-c.example'],
    registrySlug: 'session-a',
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
          return ['session-a', 84532, '', '', '0xabc123', 0, 0, '0x11111111111111111111111111111111'];
        }
        throw new Error('should not reach fallback rpc');
      },
    }),
  });

  assert.deepEqual(calls, [
    {
      rpcUrl: 'https://rpc-a.example',
      registryAddress: '0x0000000000000000000000000000000000000001',
      method: 'getSessionBySlug',
      args: ['session-a'],
    },
    {
      rpcUrl: 'https://rpc-b.example',
      registryAddress: '0x0000000000000000000000000000000000000001',
      method: 'getSessionBySlug',
      args: ['session-a'],
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    tuple: ['session-a', 84532, '', '', '0xabc123', 0, 0, '0x11111111111111111111111111111111'],
    rpcUrl: 'https://rpc-b.example',
    errors: [
      {
        rpcUrl: 'masked:https://rpc-a.example',
        status: 503,
        code: -32000,
        error: 'Session tuple RPC request failed.',
      },
    ],
  });
});

test('readSessionBySlugOnChain returns a safe last error and masked rpc diagnostics when every rpc fails', async () => {
  const lastError = new Error(' rpc-b unavailable ');
  lastError.rpcStatus = 429;
  lastError.rpcError = { code: -32005 };

  const result = await readSessionBySlugOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://rpc-a.example', 'https://rpc-b.example'],
    registrySlug: 'session-b',
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
        throw lastError;
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'Session tuple RPC request failed.');
  assert.equal(result.error.rpcStatus, 429);
  assert.equal(result.error.rpcCode, -32005);
  assert.deepEqual(result.errors, [
    {
      rpcUrl: 'masked:https://rpc-a.example',
      status: 502,
      error: 'Session tuple RPC request failed.',
    },
    {
      rpcUrl: 'masked:https://rpc-b.example',
      status: 429,
      code: -32005,
      error: 'Session tuple RPC request failed.',
    },
  ]);
  assert.equal(JSON.stringify(result).includes('unavailable'), false);
  assert.equal(JSON.stringify(result).includes('rpcError'), false);
});

test('readSessionBySlugOnChain rejects a wrong-chain endpoint before the registry read', async () => {
  let registryReads = 0;
  const result = await readSessionBySlugOnChain({
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://wrong-chain.example'],
    registrySlug: 'session-c',
    expectedChainId: 31337,
    chainAttestationCache: new Map(),
    deps: createDeps({
      rpcRequest: async () => '0x14a34',
      callRegistryFunction: async () => {
        registryReads += 1;
        return [];
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(registryReads, 0);
  assert.deepEqual(result.errors, [{
    rpcUrl: 'masked:https://wrong-chain.example',
    status: null,
    error: 'Session tuple RPC chain attestation failed.',
  }]);
});
