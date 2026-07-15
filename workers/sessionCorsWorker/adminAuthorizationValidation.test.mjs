import test from 'node:test';
import assert from 'node:assert/strict';

import { validateAdmin } from './adminAuthorizationValidation.js';
import { toChainId } from './chainIdNormalization.js';

const createDeps = (overrides = {}) => ({
  toStr: (value) => `${value ?? ''}`,
  isAddress: (value) => /^0x[a-fA-F0-9]+$/.test(`${value ?? ''}`),
  resolveRegistryRpcUrls: () => [],
  rpcRequest: async () => '0x14a34',
  toChainId,
  getHatsInterface: () => 'hats-iface',
  callContractFunction: async () => [false],
  ...overrides,
});

test('validateAdmin fails closed when session config is missing', async () => {
  let rpcCalled = false;

  const result = await validateAdmin({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc123',
    config: null,
    body: {},
    deps: createDeps({
      callContractFunction: async () => {
        rpcCalled = true;
        return [true];
      },
    }),
  });

  assert.equal(rpcCalled, false);
  assert.equal(result, false);
});

test('validateAdmin allows direct adminAddress matches before hat checks', async () => {
  let rpcCalled = false;

  const result = await validateAdmin({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xAbC123',
    config: {
      adminAddress: '0xabc123',
      hatsAddress: '0x999999',
      adminHatId: '7',
    },
    body: {},
    deps: createDeps({
      callContractFunction: async () => {
        rpcCalled = true;
        return [true];
      },
    }),
  });

  assert.equal(rpcCalled, false);
  assert.equal(result, true);
});

test('validateAdmin ignores malformed adminHatId values and fails closed without hat RPC calls', async () => {
  let rpcCalled = false;

  const result = await validateAdmin({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc123',
    config: {
      hatsAddress: '0x999999',
      adminHatId: 'not-a-number',
    },
    body: {
      rpcUrl: 'https://attacker.example',
    },
    deps: createDeps({
      resolveRegistryRpcUrls: () => ['https://safe.example'],
      callContractFunction: async () => {
        rpcCalled = true;
        return [true];
      },
    }),
  });

  assert.equal(rpcCalled, false);
  assert.equal(result, false);
});

test('validateAdmin fails closed for hat-based authorization when config provides no registry RPC urls', async () => {
  const result = await validateAdmin({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc123',
    config: {
      hatsAddress: '0x999999',
      adminHatId: '7',
    },
    body: {},
    deps: createDeps({
      resolveRegistryRpcUrls: () => [],
    }),
  });

  assert.equal(result, false);
});

test('validateAdmin uses config-derived RPC urls for hat checks and continues after earlier RPC errors', async () => {
  const calls = [];

  const result = await validateAdmin({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc123',
    config: {
      hatsAddress: '0x999999',
      adminHatId: '7',
      registryChainId: 84532,
      rpcUrl: 'https://safe.example',
    },
    body: {
      rpcUrl: 'https://attacker.example',
    },
    deps: createDeps({
      resolveRegistryRpcUrls: (config) => {
        assert.deepEqual(config, {
          hatsAddress: '0x999999',
          adminHatId: '7',
          registryChainId: 84532,
          rpcUrl: 'https://safe.example',
        });
        return ['https://safe.example', 'https://backup.example'];
      },
      callContractFunction: async (value) => {
        calls.push(value);
        if (value.rpcUrl === 'https://safe.example') {
          throw new Error('first rpc failed');
        }
        return [true];
      },
    }),
  });

  assert.deepEqual(calls, [
    {
      rpcUrl: 'https://safe.example',
      contractAddress: '0x999999',
      iface: 'hats-iface',
      method: 'isWearerOfHat',
      args: ['0xabc123', 7n],
    },
    {
      rpcUrl: 'https://backup.example',
      contractAddress: '0x999999',
      iface: 'hats-iface',
      method: 'isWearerOfHat',
      args: ['0xabc123', 7n],
    },
  ]);
  assert.equal(result, true);
});

test('validateAdmin rejects wrong-chain Hat grants before the protected contract read', async () => {
  const rpcMethods = [];
  let contractCalls = 0;
  const result = await validateAdmin({
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc123',
    config: {
      hatsAddress: '0x999999',
      adminHatId: '7',
      registryChainId: 84532,
      rpcUrl: 'https://wrong-chain.example',
    },
    body: {},
    deps: createDeps({
      resolveRegistryRpcUrls: () => ['https://wrong-chain.example'],
      rpcRequest: async ({ method }) => {
        rpcMethods.push(method);
        return '0xaa36a7';
      },
      callContractFunction: async () => {
        contractCalls += 1;
        return [true];
      },
    }),
  });

  assert.equal(result, false);
  assert.deepEqual(rpcMethods, ['eth_chainId']);
  assert.equal(contractCalls, 0);
});

test('validateAdmin re-attests Hat RPC identity on each admin request', async () => {
  let chainChecks = 0;
  const deps = createDeps({
    resolveRegistryRpcUrls: () => ['https://safe.example'],
    rpcRequest: async () => {
      chainChecks += 1;
      return '0x14a34';
    },
    callContractFunction: async () => [true],
  });
  const request = {
    env: { GROUP_KV: {} },
    slug: 'session-a',
    address: '0xabc123',
    config: {
      hatsAddress: '0x999999',
      adminHatId: '7',
      registryChainId: 84532,
      rpcUrl: 'https://safe.example',
    },
    body: {},
    deps,
  };

  assert.equal(await validateAdmin(request), true);
  assert.equal(await validateAdmin(request), true);
  assert.equal(chainChecks, 2);
});
