import test from 'node:test';
import assert from 'node:assert/strict';

import { computeLoginScopes } from './loginScopeEvaluation.js';

test('computeLoginScopes preserves scope mapping, overrides, and login gate authority wiring', async () => {
  const calls = [];

  const scopes = await computeLoginScopes({
    address: '0xabc123',
    config: {
      registryChainId: 84532,
      scopes: { faucet: false },
    },
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://registry.example'],
    registrySlug: 'session-a',
    sessionCheck: { exists: true, rpcUrl: 'https://registry.example', errors: [], error: null },
    resourceKeys: ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit'],
    deps: {
      resolveLoginGateAuthority: async (value) => {
        calls.push(value);
        return {
          default: true,
          ai: true,
          arweave: false,
          txGas: true,
          rpc: false,
          lit: false,
        };
      },
      readResourceGateOnChain: 'readResourceGateOnChain',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      checkSbtGate: 'checkSbtGate',
      probeRpcUrls: 'probeRpcUrls',
      readRegistryCodeOnChain: 'readRegistryCodeOnChain',
      maskRpcUrl: 'maskRpcUrl',
      toChainId: 'toChainId',
      toStr: 'toStr',
      log: 'log',
    },
  });

  assert.deepEqual(scopes, {
    ai: true,
    arweave: false,
    transcribe: true,
    faucet: false,
    fetch: false,
    lit: false,
  });
  assert.deepEqual(calls, [{
    address: '0xabc123',
    config: {
      registryChainId: 84532,
      scopes: { faucet: false },
    },
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://registry.example'],
    registrySlug: 'session-a',
    sessionCheck: { exists: true, rpcUrl: 'https://registry.example', errors: [], error: null },
    resourceKeys: ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit'],
    deps: {
      readResourceGateOnChain: 'readResourceGateOnChain',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      checkSbtGate: 'checkSbtGate',
      probeRpcUrls: 'probeRpcUrls',
      readRegistryCodeOnChain: 'readRegistryCodeOnChain',
      maskRpcUrl: 'maskRpcUrl',
      toChainId: 'toChainId',
      toStr: 'toStr',
      log: 'log',
    },
  }]);
});

test('computeLoginScopes preserves default-gate denial when login gate authority rejects default access', async () => {
  await assert.rejects(
    computeLoginScopes({
      address: '0xabc123',
      config: {},
      registryAddress: '0x0000000000000000000000000000000000000001',
      registryRpcUrls: ['https://registry.example'],
      registrySlug: 'session-b',
      sessionCheck: { exists: true, rpcUrl: 'https://registry.example', errors: [], error: null },
      resourceKeys: ['default', 'ai'],
      deps: {
        resolveLoginGateAuthority: async () => ({
          default: false,
          ai: true,
        }),
      },
    }),
    /Access denied: default gate failed\./
  );
});

test('computeLoginScopes delegates worker-canonical scopes without reading registry gates', async () => {
  const calls = [];
  const scopes = await computeLoginScopes({
    address: '0x0000000000000000000000000000000000000002',
    authorityMode: 'worker_canonical',
    config: {
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      workerAuthority: { version: 1, participantScopes: ['storage'] },
    },
    env: { GROUP_KV: {} },
    registrySlug: 'session-worker',
    deps: {
      resolveWorkerCanonicalLoginScopes: async (value) => {
        calls.push(value);
        return { storage: true };
      },
      resolveLoginGateAuthority: async () => {
        throw new Error('registry gate authority must not run');
      },
    },
  });

  assert.deepEqual(scopes, { storage: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].slug, 'session-worker');
  assert.deepEqual(calls[0].env, { GROUP_KV: {} });
});
