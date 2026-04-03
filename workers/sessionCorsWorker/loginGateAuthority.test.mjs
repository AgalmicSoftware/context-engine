import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLoginGateAuthority } from './loginGateAuthority.js';

const createDeps = (overrides = {}) => ({
  readResourceGateOnChain: async ({ resourceKey }) => ({
    ok: true,
    gate: {
      sbtAddresses: resourceKey === 'default' ? [] : [`0x${resourceKey}`],
      chainId: 84532,
      mode: 0,
    },
    rpcUrl: 'https://registry.example',
    errors: [],
  }),
  resolveRpcUrlListForGate: () => ['https://gate.example'],
  checkSbtGate: async ({ sbtAddresses }) => sbtAddresses[0] === '0xai' || sbtAddresses[0] === '0xtxGas',
  probeRpcUrls: async () => {},
  readRegistryCodeOnChain: async () => ({ size: 2, rpcUrl: 'https://registry.example', errors: [], error: null }),
  maskRpcUrl: (value) => `masked:${value}`,
  toChainId: (value) => Number(value || 0),
  toStr: (value) => `${value ?? ''}`,
  log: () => {},
  ...overrides,
});

test('resolveLoginGateAuthority preserves gate evaluation ordering and default-empty allow behavior', async () => {
  const resourceGateCalls = [];
  const gateChecks = [];
  const logs = [];

  const result = await resolveLoginGateAuthority({
    address: '0xabc123',
    config: {
      registryChainId: 84532,
    },
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://registry.example'],
    registrySlug: 'session-a',
    sessionCheck: { exists: true, rpcUrl: 'https://registry.example', errors: [], error: null },
    resourceKeys: ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit'],
    deps: createDeps({
      readResourceGateOnChain: async (value) => {
        resourceGateCalls.push(value.resourceKey);
        return {
          ok: true,
          gate: {
            sbtAddresses: value.resourceKey === 'default' ? [] : [`0x${value.resourceKey}`],
            chainId: 84532,
            mode: 0,
          },
          rpcUrl: 'https://registry.example',
          errors: [],
        };
      },
      checkSbtGate: async (value) => {
        gateChecks.push(value.sbtAddresses[0]);
        return value.sbtAddresses[0] === '0xai' || value.sbtAddresses[0] === '0xtxGas';
      },
      log: (...args) => logs.push(args),
    }),
  });

  assert.deepEqual(resourceGateCalls, ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit']);
  assert.deepEqual(gateChecks, ['0xai', '0xarweave', '0xtxGas', '0xrpc', '0xlit']);
  assert.deepEqual(result, {
    default: true,
    ai: true,
    arweave: false,
    txGas: true,
    rpc: false,
    lit: false,
  });
  assert.deepEqual(logs, [[
    '[gating] default gate empty (allow) [onchain]',
    {
      slug: 'session-a',
      address: '0xabc123',
      gateChainId: 84532,
      registryAddress: '0x0000000000000000000000000000000000000001',
      registryRpcUrl: 'masked:https://registry.example',
    },
  ]]);
});

test('resolveLoginGateAuthority preserves default-gate diagnostics when lookup is unavailable', async () => {
  const logs = [];
  const probes = [];
  const registryCodeReads = [];
  const resourceGateCalls = [];

  const result = await resolveLoginGateAuthority({
    address: '0xabc123',
    config: {
      registryChainId: 84532,
    },
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://registry.example'],
    registrySlug: 'session-b',
    sessionCheck: { exists: true, rpcUrl: 'https://registry.example', errors: [], error: null },
    resourceKeys: ['default', 'ai'],
    deps: createDeps({
      readResourceGateOnChain: async (value) => {
        resourceGateCalls.push(value.resourceKey);
        if (value.resourceKey === 'default') {
          return {
            ok: false,
            error: 'gate lookup failed',
            errors: [{ rpcUrl: 'masked:https://registry.example', error: 'down' }],
          };
        }
        return {
          ok: true,
          gate: { sbtAddresses: [], chainId: 84532, mode: 0 },
          rpcUrl: 'https://registry.example',
          errors: [],
        };
      },
      probeRpcUrls: async (value) => probes.push(value),
      readRegistryCodeOnChain: async (value) => {
        registryCodeReads.push(value);
        return { size: 2, rpcUrl: 'https://registry.example', errors: [], error: null };
      },
      log: (...args) => logs.push(args),
    }),
  });

  assert.deepEqual(result, {
    default: false,
    ai: true,
  });
  assert.deepEqual(resourceGateCalls, ['default', 'ai']);
  assert.deepEqual(probes, [{
    rpcUrls: ['https://registry.example'],
    label: 'registry',
  }]);
  assert.deepEqual(registryCodeReads, [{
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://registry.example'],
  }]);
  assert.deepEqual(logs.map(([label]) => label), [
    '[gating] default gate lookup failed',
    '[gating] sessionExists probe',
    '[gating] registry code probe',
  ]);
  assert.deepEqual(logs[2], [
    '[gating] registry code probe',
    {
      slug: 'session-b',
      bytecodeSize: 2,
      rpcUrl: 'masked:https://registry.example',
      errors: [],
      error: '',
    },
  ]);
});

test('resolveLoginGateAuthority preserves default-gate missing-rpc and failed-check diagnostics', async () => {
  const logs = [];

  const result = await resolveLoginGateAuthority({
    address: '0xabc123',
    config: {
      registryChainId: 84532,
    },
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: ['https://registry.example'],
    registrySlug: 'session-c',
    sessionCheck: { exists: true, rpcUrl: 'https://registry.example', errors: [], error: null },
    resourceKeys: ['default'],
    deps: createDeps({
      readResourceGateOnChain: async () => ({
        ok: true,
        gate: {
          sbtAddresses: ['0xdefault'],
          chainId: 84532,
          mode: 1,
        },
        rpcUrl: 'https://registry.example',
        errors: [],
      }),
      resolveRpcUrlListForGate: () => [],
      log: (...args) => logs.push(args),
    }),
  });

  assert.deepEqual(result, {
    default: false,
  });
  assert.deepEqual(logs, [
    [
      '[gating] default gate missing rpc url',
      {
        slug: 'session-c',
        address: '0xabc123',
        gateChainId: 84532,
        registryChainId: 84532,
        registryAddress: '0x0000000000000000000000000000000000000001',
        registryRpcUrls: ['masked:https://registry.example'],
        source: 'onchain',
      },
    ],
    [
      '[gating] default gate check failed [onchain]',
      {
        slug: 'session-c',
        address: '0xabc123',
        gateChainId: 84532,
        mode: 1,
        sbtCount: 1,
        sbtAddresses: ['0xdefault'],
        rpcUrl: '',
        rpcUrls: [],
        registryChainId: 84532,
      },
    ],
  ]);
});
